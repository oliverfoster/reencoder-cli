const { getConfig, reencode, getTerminalOutputGroupNames } = require('./encoding')
const config = getConfig()
config.outputGroupNames = getTerminalOutputGroupNames(config)
reencode({ config })
