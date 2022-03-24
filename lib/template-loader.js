const { yamlParse } = require('yaml-cfn')
const fs = require('fs')
require('colors')

module.exports = {
  loadFile
}

function loadFile (fileName) {
  let inputFile
  try {
    inputFile = fs.readFileSync(fileName, 'utf8')
  } catch (error) {
    console.error(`error loading file ${fileName} [${error}]!`)
    return undefined
  }

  const inputText = pointToLocalhost(inputFile)

  let parsed
  try {
    parsed = yamlParse(inputText)
    if (!parsed) {
      console.error('yaml parsing failed!')
      return undefined
    }
  } catch (error) {
    console.error(error)
    return undefined
  }

  return parsed
}

function pointToLocalhost (input) {
  const output = input.replace(/((172.17.0.1)|(host.docker.internal))/g, 'localhost')
  // console.log(JSON.stringify(output, null, 2))

  return output
}
