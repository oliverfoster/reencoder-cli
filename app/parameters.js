const Applause = require('applause')
const _ = require('lodash')
const fs = require('fs-extra')
const path = require('path')
const findUp = require('find-up')
const sanitize = require('sanitize-filename')
const sanitizeREGEX = /[._ ]*/g

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
  let hasResolvedObjects = true
  function perform (parameters) {
    hasResolvedObjects = false
    parameters = parameters.reduce((parameters, option) => {
      if (typeof option === 'object') {
        hasResolvedObjects = true
        const namedParameters = Object
          .entries(option)
          .filter(([name]) => !outputGroupNames || !outputGroupNames.length || outputGroupNames.includes(name))
          .map(([name, value]) => {
            // NOTE: This should process nested group names better, only first group comes out currently
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
  while (hasResolvedObjects) {
    parameters = perform(parameters)
  }
  return parameters
}

function getGroupNames (parameters) {
  const names = parameters.reduce((names, value) => {
    if (typeof value !== 'object') return names
    const keys = Object.keys(value)
    names.push(...keys)
    keys.forEach(key => names.push(...getGroupNames(value[key])))
    return names
  }, [])
  return names
}

function getConfig () {
  const filePath = findUp.sync('.reencoderrc.json')
  if (!filePath) {
    throw new Error('No ".reencoderrc.json" file found. Please check your configuration.');
  }
  console.log(`Using ${filePath}`);
  const config = fs.readJsonSync(filePath);
  return config
}

function getTerminalOutputGroupNames (config) {
  const configNames = getGroupNames(config.parameters)
  let outputGroupNames = process.argv.filter(name => configNames.includes(name))
  outputGroupNames = outputGroupNames.length
    ? outputGroupNames
    : (config.default ?? '').split(/ |,/g)
  return outputGroupNames
}

async function getFfmpegParameters (inputDir, inputFile, outputDir, config, outputGroupNames) {
  const inputFileParsed = path.parse(inputFile)
  // Make sure inputFile is absolute in parameters
  inputFile = path.resolve(inputDir, inputFile)
  outputGroupNames = typeof outputGroupNames === 'string'
    ? outputGroupNames.split(/ |,/g)
    : outputGroupNames
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
    outputDir,
    outputGroupName: ''
  })
  // Replace input glob with absolute filename
  const inputFileIndex = parameters.findIndex(param => param === '-i')
  parameters[inputFileIndex + 1] = inputFile
  // Make sure to silently not overwrite
  const overwriteIndex = parameters.findIndex(param => param === '-y')
  if (overwriteIndex === -1) {
    parameters.unshift('-n')
  }
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
