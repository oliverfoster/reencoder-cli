const Applause = require('applause')
const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')
const findUp = require('find-up')
const sanitize = require('sanitize-filename')
const sanitizeREGEX = /[._\- ()]*/g

function getInputFilePath (parameters) {
  const index = parameters.findIndex(item => item === '-i')
  const value = parameters[index + 1]
  if (value[0] === '-') return
  return value
}

function stringReplace (context, parameters) {
  const replacer = Applause.create({ patterns: [ { json: context } ] })
  const isArray = Array.isArray(parameters)
  const arr = (!isArray ? [parameters] : parameters)
  const replaced = arr.map(parameter => {
    if (typeof parameter !== 'string') return parameter
    const replaced = replacer.replace(parameter).content
    return replaced === false
      ? parameter
      : replaced
  })
  return (!isArray ? replaced[0] : replaced)
}

function reduceParameters (parameters, outputGroupNames, context) {
  context = Object.assign({}, context)
  parameters = parameters.reduce((parameters, option) => {
    if (typeof option === 'object') {
      const namedParameters = Object
        .entries(option)
        .filter(([name]) => !outputGroupNames || !outputGroupNames.length || outputGroupNames.includes(name))
        .map(([name, value]) => {
          context.outputGroupName = name
          return stringReplace(context, value)
        })
      parameters.push(...namedParameters)
      return parameters
    }
    context.outputGroupName = ''
    option = stringReplace(context, option)
    parameters.push(option)
    return parameters
  }, [])
  return _.flatten(parameters)
}

function getGroupNames (options) {
  const names = options.reduce((names, value) => {
    if (typeof value !== 'object') return names
    names.push(...Object.keys(value))
    return names
  }, [])
  return names
}

function getConfig () {
  const config = fs.readJsonSync(findUp.sync('.reencoderrc.json'))
  return config
}

function getTerminalOutputGroupNames (config = getConfig()) {
  const configNames = getGroupNames(config.parameters)
  let outputGroupNames = process.argv.filter(name => configNames.includes(name))
  outputGroupNames = outputGroupNames.length
    ? outputGroupNames
    : config.default ?? ''
  return outputGroupNames
}

async function getFfmpegParameters (inputDir, inputFile, outputDir, config = getConfig(), outputGroupNames = getTerminalOutputGroupNames(config)) {
  const inputFileParsed = path.parse(inputFile)
  // Make sure inputFile is absolute in parameters
  inputFile = path.resolve(inputDir, inputFile)
  const sanitized = sanitize(inputFileParsed.name).replace(sanitizeREGEX, '')
  const parameters = reduceParameters(config.parameters, outputGroupNames, {
    inputFile,
    inputFileBase: inputFileParsed.base,
    // Relative to inputDir unless otherwise specified
    inputFileDir: inputFileParsed.dir,
    inputFileExt: inputFileParsed.ext,
    inputFileName: inputFileParsed.name,
    inputFileNameSanitized: sanitized,
    inputFileNameSanitizedLowerCase: sanitized.toLowerCase(),
    inputFileRoot: inputFileParsed.root,
    outputDir
  })
  // Replace input glob with absolute filename
  const inputFileIndex = parameters.findIndex(param => param === '-i')
  parameters[inputFileIndex + 1] = inputFile
  return parameters
}

function getOutputFilePaths (parameters, propertyName = null) {
  let skip = false
  let isCaptureNext = false
  const outputs = parameters.reduce((outputs, item) => {
    const isFlag = (item[0] === '-')
    if (isCaptureNext) {
      isCaptureNext = false
      skip = false
      outputs.push(item)
      return outputs
    }
    isCaptureNext = (isFlag && item === propertyName)
    if (skip && !isFlag) {
      skip = false
      return outputs
    }
    if (isFlag) {
      skip = true
      return outputs
    }
    outputs.push(item)
    return outputs
  }, [])
  return outputs
}

async function ensureOutputFilePaths (parameters, parameterName = null) {
  const outputFilePaths = getOutputFilePaths(parameters, parameterName)
  const fileDirs = outputFilePaths.map(filePath => path.parse(filePath).dir)
  await Promise.all(fileDirs.map(fileDir => fs.ensureDir(fileDir)))
  return fileDirs
}

module.exports = {
  stringReplace,
  getInputFilePath,
  getConfig,
  getTerminalOutputGroupNames,
  getFfmpegParameters,
  ensureOutputFilePaths
}
