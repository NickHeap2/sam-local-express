const templateLoader = require('./template-loader')
const templateParser = require('./template-parser')
const serverProcess = require('./server-process')
const { exit } = require('process')

// set AWS_SAM_LOCAL for compatibility
process.env.AWS_SAM_LOCAL = 'true'

const templateFilename = process.argv[2]
const singlePort = process.argv[3] === 'true'
const basePort = parseInt(process.argv[4]) || 3000
const disableAuth = process.argv[5] === 'true'

const monitoringText = 'Monitoring for changes (type rs ENTER to manually restart)...'.green

console.log(`Loading template file ${templateFilename}...`.green)
const templateFile = templateLoader.loadFile(templateFilename)
if (!templateFile) {
  console.error('Parsing didn\'t produce a result!'.red)
  console.log(monitoringText)
  exit(1)
}

console.log('Parsing template...'.green)
// get our apis from template
const parseResult = templateParser.parseTemplate(templateFile)
if (!parseResult || !parseResult.apis) {
  console.error('Parsing didn\'t find any APIs!'.red)
  console.log(monitoringText)
  exit(1)
}

parseResult.parameters = {
  singlePort: singlePort,
  basePort: basePort,
  disableAuth: disableAuth
}

serverProcess.startServer(parseResult)
