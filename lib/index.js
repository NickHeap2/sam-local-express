#!/usr/bin/env node
const { program } = require('commander')

const fs = require('fs')
const path = require('path')
const express = require('express')
const lambdaLocal = require('lambda-local')
const bodyParser = require('body-parser')

const templateParser = require('./template-parser')
const { exit } = require('process')

const BASE_PORT = 3000

program
  .name('template-to-express')
  .version(process.env.npm_package_version || '0.0.1')
  .requiredOption('-t, --template <source>', 'Source AWS SAM template yaml filename')
program.parse(process.argv)
const options = program.opts()

const templateFilename = options.template

;
(async function () {
  console.log(`Parsing template file ${templateFilename}...`)
  // get our apis from template
  const { apis, globalEnvVars } = templateParser.parseFile(templateFilename)

  // set env vars
  console.log('Setting env vars...')
  for (const envVar of globalEnvVars) {
    console.log(`  ${envVar.name}=${envVar.value}`)
    process.env[envVar.name] = envVar.value
  }

  console.log(`Found ${apis.length} apis...`)

  if (apis.length === 0) {
    console.error('No APIs found!')
    exit(1)
  }

  let apiNumber = 0
  for (const api of apis) {
    apiNumber += 1

    console.log(`Creating server for ${api.name}...`)
    // add an express server per api
    const app = api.app = express()
    app.use(bodyParser.urlencoded({ extended: true }))
    app.use(bodyParser.json())

    // hook up the routes
    for (const route of api.routes) {
      const routeHandler = `${route.handler.codeUri}/${route.handler.handler}`

      const lastIndex = routeHandler.lastIndexOf('.')
      const handlerName = path.join(process.cwd(), routeHandler.substr(0, lastIndex))
      const handlerMethod = routeHandler.substr(lastIndex + 1)

      if (!fs.existsSync(handlerName + '.js')) {
        console.warn(`  WARNING: Route handler ${handlerName} does not exist!`)
      }

      console.log(`  Attaching ${routeHandler} at ${route.path}...`)
      app.use(route.path, async (req, res) => {
        await invokeHandler(handlerName, handlerMethod, req, res)
      })
    }

    const listenPort = BASE_PORT + apiNumber
    app.listen(listenPort, () => console.log(`  Listening on port: ${listenPort}`))
  }
}())

async function invokeHandler (handlerName, handlerMethod, req, res) {
  console.log(`Calling ${handlerName}.${handlerMethod}`)

  const handlerFunc = require(handlerName)

  const result = await lambdaLocal.execute({
    lambdaFunc: handlerFunc,
    lambdaHandler: handlerMethod,
    event: {
      headers: req.headers, // Pass on request headers
      body: req.body, // Pass on request body
      requestContext: {
        authorizer: ''
      },
      queryStringParameters: req.query
    },
    envfile: path.join(__dirname, '.env')
  })

  // Respond to HTTP request
  res
    .status(result.statusCode)
    .set(result.headers)
    .end(result.body)
}
