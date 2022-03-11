
const fs = require('fs')
const path = require('path')
const express = require('express')
const lambdaLocal = require('lambda-local')
const bodyParser = require('body-parser')
const colors = require('colors')

const templateParser = require('./template-parser')
const { exit } = require('process')

const templateFilename = process.argv[2]
const singlePort = process.argv[3] === 'true'
const basePort = parseInt(process.argv[4]) || 3000

console.log(`Parsing template file ${templateFilename}...`.green)
// get our apis from template
const parseResult = templateParser.parseFile(templateFilename)

const { apis, globalEnvVars, globalTimeout } = parseResult

const invokeOpts = {
}
if (globalTimeout) {
  invokeOpts.timeoutMs = globalTimeout
}

// set env vars
console.log('Setting env vars...'.green)
for (const envVar of globalEnvVars) {
  console.log(`  ${envVar.name}=${envVar.value}`.blue)
  process.env[envVar.name] = envVar.value
}

console.log(`Function timeouts are set as ${globalTimeout / 1000}s.`.green)


console.log(`Found ${apis.length} apis...`.green)

if (apis.length === 0) {
  console.error('No APIs found!'.red)
  exit(1)
}

let instance
let listenPort
if (singlePort) {
  console.log(`  Creating Express server for all APIs...`.green)
  instance = newExpress()
  listenPort = basePort

  for (const api of apis) {
    console.log(`  Adding routes for ${api.type} ${api.name} stage ${api.stage}...`.green)
    addRoutesToAPI(instance, api.routes, api.stage, listenPort)
  }

  console.log(`  Listening on port: ${listenPort}`.blue)
  instance.listen(listenPort)
} else {
  let apiNumber = 0
  for (const api of apis) {
    listenPort = basePort + apiNumber
    apiNumber += 1
  
    // add an express server per api
    console.log(`  Creating Express server for ${api.type} ${api.name} stage ${api.stage}...`.green)
    instance = api.app = express()
    instance.use(bodyParser.urlencoded({ extended: true }))
    instance.use(bodyParser.json())
  
    addRoutesToAPI(instance, api.routes, api.stage, listenPort)
  
    console.log(`    Listening on port: ${listenPort}`.blue)
    instance.listen(listenPort)
  }  
}

console.log(`Monitoring for changes...`.green)

function newExpress() {
  const app = express()
  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json())
  return app
}

async function invokeHandler (handlerName, handlerMethod, req, res, opts) {
  console.log(`Calling ${handlerName}.${handlerMethod}`)

  const handlerFunc = require(handlerName)

  console.log(opts.timeoutMs || 3000)

  const result = await lambdaLocal.execute({
    lambdaFunc: handlerFunc,
    lambdaHandler: handlerMethod,
    timeoutMs: opts.timeoutMs || 3000,
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

function addRoutesToAPI (app, routes, stage, portNumber) {
  // hook up the routes
  for (const route of routes) {
    const routeHandler = `${route.handler.codeUri}/${route.handler.handler}`

    const lastIndex = routeHandler.lastIndexOf('.')
    const handlerName = path.join(process.cwd(), routeHandler.substr(0, lastIndex))
    const handlerMethod = routeHandler.substr(lastIndex + 1)

    if (!fs.existsSync(handlerName + '.js')) {
      console.warn(`    WARNING: Route handler ${handlerName} does not exist!`.yellow)
    }

    const invokePath = `/${stage}${route.path}`
    console.log(`    Attaching ${route.method.toUpperCase()} ${routeHandler} at http://localhost:${portNumber}${invokePath}...`.blue)

    // attach route for method
    app[route.method](invokePath, async (req, res) => {
      await invokeHandler(handlerName, handlerMethod, req, res, invokeOpts)
    })
  }
}
