const { getConfig, reencode, getTerminalOutputGroupNames } = require('./encoding')
const config = getConfig()
reencode({
  config,
  outputGroupNames: getTerminalOutputGroupNames(config)
})
