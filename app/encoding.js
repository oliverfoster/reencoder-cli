const async = require('async')
const globs = require('globs')
const util = require('util')
const fs = require('fs-extra')
const path = require('path')
const spawn = require('child_process').spawn
const os = require('os')
const ffmpegPath = require('ffmpeg-static')
const { path: ffprobePath } = require('ffprobe-static')
const { stringReplace, getInputFilePath, getTerminalOutputGroupNames, getFfmpegParameters, getConfig, ensureOutputFilePaths } = require('./parameters')
const _ = require('lodash')

function execute (program, parameters, process = (stdout, stderr) => {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(program, parameters)
    const stdout = []
    const stderr = []
    let exitCode = null
    proc.stdout.setEncoding('utf8')
    proc.stderr.setEncoding('utf8')
    proc.stdout.on('data', data => { stdout.push(data); process(stdout, stderr) })
    proc.stderr.on('data', data => { stderr.push(data); process(stdout, stderr) })
    proc.on('exit', code => {
      exitCode = code
    })
    proc.on('error', err => {
      reject(err)
    })
    proc.on('close', () => {
      if (exitCode) return reject(new Error(stderr.join('')))
      resolve([
        stdout.join(''),
        stderr.join('')
      ])
    })
  })
};

function processFfmpegOutputToSeconds (process = seconds => {}, stdout, stderr) {
  // Parse time=##:##:##.## from last ffmpeg voutput line and turn into a seconds value
  const lastOutput = stderr[stderr.length - 1]
  const atTime = lastOutput.match(/time=\d\d:\d\d:\d\d\.\d\d/)
  if (!atTime) return
  const position = atTime[0].slice(5).split(/:|\./g).reduce((seconds, value, index) => {
    value = parseInt(value)
    switch (index) {
      case 3:
        // Ignore sub seconds
        break
      case 2:
        seconds += value
        break
      case 1:
        seconds += value * 60
        break
      case 0:
        seconds += value * 60 * 60
        break
    }
    return seconds
  }, 0)
  process(position)
}

function unixPath (dir) {
  return dir.replace(/\\/g, '/')
}

async function getInputFilePaths (config, inputDir, outputDir) {
  const inputDirStat = await fs.stat(inputDir)
  const outputDirStat = await fs.stat(outputDir)
  const isInDirectory = inputDirStat.isDirectory
  if (isInDirectory) {
    // Use configured ffmpeg -i parameter value as a glob, return files
    const glob = unixPath(stringReplace({ inputDir, outputDir }, getInputFilePath(config.parameters)))
    const inputFiles = (await util.promisify(globs)(
      glob,
      // Assume glob starts from inputDir
      { cwd: inputDir, absolute: true }
    ))
      // Exclude files in the outputDir
      .filter(file => {
        // Check if lowercase paths match
        const looseCompare = file.toLowerCase().startsWith(outputDir.toLowerCase())
        if (!looseCompare) return true
        try {
          // Check if refering to the same inode
          const fileDirStat = fs.statSync(file.slice(0, outputDir.length))
          return (fileDirStat.ino !== outputDirStat.ino)
        } catch (err) {
          return true
        }
      })
      .map(file => {
        // Return relative paths to inputDir
        if (file.startsWith(inputDir)) return file.slice(inputDir.length + 1)
        return file
      })
    return inputFiles
  }
  // Return inputDir as already pointing to a file
  return [inputDir]
}

async function getInputFileDurations (config, inputDir, inputFiles, status = state => {}) {
  const total = inputFiles.length
  let currentIndex = -1
  const durations = await async.mapLimit(inputFiles, getConcurrency(config), async (currentInputFile) => {
    currentIndex++
    const probeParameters = ['-of', 'json', '-show_format', path.resolve(inputDir, currentInputFile)]
    try {
      const [ stdout ] = await encoding.ffprobe(probeParameters)
      const probe = JSON.parse(stdout)
      // Ignore sub seconds
      const duration = parseInt(probe.format.duration)
      status({
        mode: 'calculate',
        inputFiles,
        totalPercentComplete: '0.00%',
        total,
        currentInputFile,
        currentItem: (currentIndex + 1),
        currentPercentComplete: '0.00%'
      })
      return duration
    } catch (err) {
      console.log(`Corrupt: ${currentInputFile}`)
    }
  })
  // Remove files where the duration cannot be calculated
  return [
    inputFiles.filter((value, index) => (durations[index] ?? null) !== null),
    durations.filter(value => (value ?? null) !== null)
  ]
}

function getConcurrency (config) {
  // const usableCpus = ((os.cpus().length) / 2) - 1
  const concurrency = config.concurrency ?? 1 // _.min([2, _.max([usableCpus, 1])])
  return concurrency
}

const encoding = {

  getTerminalOutputGroupNames (config = getConfig()) {
    return getTerminalOutputGroupNames(config)
  },

  getConfig () {
    return getConfig()
  },

  async ffprobe (parameters) {
    const [ stdout, stderr ] = await execute(ffprobePath, parameters)
    return [ stdout, stderr ]
  },

  async ffmpeg (parameters, output = (stdout, stderr) => {}) {
    const [ stdout, stderr ] = await execute(ffmpegPath, parameters, output)
    return [ stdout, stderr ]
  },

  async reencode ({
    config = getConfig(),
    outputGroupNames = config.default,
    inputDir = path.resolve(process.cwd(), config.inputDir ?? './'),
    outputDir = path.resolve(process.cwd(), config.outputDir ?? './reencoder'),
    status = (state) => console.log(
      state.mode,
      state.totalPercentComplete,
      `${state.currentItem}/${state.total}`,
      state.currentPercentComplete,
      state.currentInputFile
    )
  } = {}) {
    inputDir = unixPath(inputDir)
    outputDir = unixPath(outputDir)
    config.clearOutputDir && await fs.remove(outputDir)
    await fs.ensureDir(outputDir)
    let inputFiles = await getInputFilePaths(config, inputDir, outputDir)
    let durationSeconds
    [ inputFiles, durationSeconds ] = await getInputFileDurations(config, inputDir, inputFiles, status)
    const elapsedSeconds = new Array(inputFiles.length)
    const totalSeconds = _.sum(durationSeconds)
    const total = String(inputFiles.length)
    await async.eachOfLimit(inputFiles, getConcurrency(config), async (currentInputFile, currentIndex) => {
      const ffmpegParameters = await getFfmpegParameters(inputDir, currentInputFile, outputDir, config, outputGroupNames)
      await ensureOutputFilePaths(ffmpegParameters)
      const currentDuration = durationSeconds[currentIndex]
      const currentItem = String(currentIndex + 1)
      try {
        await encoding.ffmpeg(ffmpegParameters, processFfmpegOutputToSeconds.bind(null, seconds => {
          // Calculate the percentage position in the total seconds of video to process
          elapsedSeconds[currentIndex] = seconds
          const currentTotalSeconds = _.sum(elapsedSeconds)
          const currentPercentComplete = (seconds / currentDuration * 100).toFixed(2) + '%'
          const totalPercentComplete = (currentTotalSeconds / totalSeconds * 100).toFixed(2) + '%'
          status({
            mode: 'reencode',
            inputFiles,
            totalPercentComplete,
            total,
            currentInputFile,
            currentItem,
            currentPercentComplete
          })
        }))
      } catch (err) {
        if (/already exists\. Exiting\./gi.test(err.message)) {
          elapsedSeconds[currentIndex] = durationSeconds[currentIndex]
          return
        }
        throw err
      }
    })
  },

  isSupported () {
    return (os.platform().match(/(^win)|(^darwin)|(^linux)/g) !== null)
  }

}

module.exports = encoding
