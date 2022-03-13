#!/usr/bin/env node
const { program } = require('commander')

const nodemon = require('nodemon')
const colors = require('colors')
const path = require('path')
const { exit } = require('process')
const fs = require('fs')

program
  .name('sam-local-express')
  .version(process.env.npm_package_version || '0.0.1')
  .requiredOption('-t, --template <template>', 'Source AWS SAM template yaml filename')
  .option('-e, --extensions [extensions]', 'Comma separated list of file extensions to watch', 'js,json,yaml')
  .option('-s, --singleport', 'If set then all APIs will be served on a single port, use stages to separate', false)
  .option('-b, --baseport [portnumber]', 'The base port for Express servers', 3000)
program.parse(process.argv)
const options = program.opts()

const templateFilename = options.template
const extensions = options.extensions
const singleport = options.singleport
const baseport = options.baseport

;
(async function () {
  //check if template file exists
  if (!fs.statSync(templateFilename)) {
    console.error(`Template file ${templateFilename} does not exist!`.red)
    exit(1)
  }

  const script = path.join(__dirname, 'server.js')
  nodemon({
    script: script,
    args: [
      `${templateFilename}`,
      `${singleport}`,
      `${baseport}`
    ],
    ext: extensions
  })

  nodemon.on('start', function () {
    console.log('SAM local express server is starting...'.green)
  }).on('quit', function () {
    console.log('SAM local express server has quit'.red)
    process.exit()
  }).on('restart', function (files) {
    if (files) {
      console.log('SAM local express server restarted due to change in:'.yellow)
      console.log(JSON.stringify(files, null, 2))
    } else {
      console.log('SAM local express server restarted manually'.yellow)
    }
  })
}())
