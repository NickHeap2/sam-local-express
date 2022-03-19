const templateParser = require('./template-parser')
const serverProcess = require('./server-process')
const { exit } = require('process')

// set AWS_SAM_LOCAL for compatability
process.env.AWS_SAM_LOCAL = 'true'

const templateFilename = process.argv[2]
const singlePort = process.argv[3] === 'true'
const basePort = parseInt(process.argv[4]) || 3000

console.log(`Parsing template file ${templateFilename}...`.green)
// get our apis from template
const parseResult = templateParser.parseFile(templateFilename)
if (!parseResult) {
  console.error('Parsing didn\'t produce a result!'.red)
  console.log('Monitoring for changes (type rs ENTER to manually restart)...'.green)
  exit(1)
}

parseResult.singlePort = singlePort
parseResult.basePort = basePort

serverProcess.startServer(parseResult)
