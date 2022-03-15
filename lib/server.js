const util = require('util')

const fs = require('fs')
const path = require('path')
const express = require('express')
const lambdaLocal = require('lambda-local')
const bodyParser = require('body-parser')
require('colors')

const templateParser = require('./template-parser')
const { exit } = require('process')
const querystring = require('querystring')

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
  console.log('Monitoring for changes (type rs ENTER to manually restart)...'.green)
  exit(1)
}

let instance
let listenPort
if (singlePort) {
  console.log('  Creating Express server for all APIs...'.green)
  instance = newExpress()
  listenPort = basePort

  for (const api of apis) {
    console.log(`  Adding routes for ${api.type} ${api.name} stage ${api.stage}...`.green)
    if (api.auth) {
      console.log(`    Custom authorizer ${api.auth.path} attached...`.blue)
    }

    addRoutesToAPI(instance, api, listenPort)
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
    instance = newExpress()

    if (api.auth) {
      console.log(`    Custom authorizer ${api.auth.path} attached...`.blue)
    }
    addRoutesToAPI(instance, api, listenPort)

    console.log(`    Listening on port: ${listenPort}`.blue)
    instance.listen(listenPort)
  }
}

console.log('Monitoring for changes (type rs ENTER to manually restart)...'.green)

function newExpress () {
  const app = express()
  app.use(bodyParser.urlencoded({ extended: true }))
  app.use(bodyParser.json())
  return app
}

function addRoutesToAPI (app, api, portNumber) {
  const routes = api.routes
  const stage = api.stage
  const auth = api.auth

  // hook up the routes
  for (const route of routes) {
    const routeHandler = getRouteHandler(route.handler.codeUri, route.handler.handler)
    if (!fs.existsSync(routeHandler.path + '.js')) {
      console.warn(`    WARNING: Route handler ${routeHandler.path} does not exist!`.yellow)
    }

    const invokePath = convertPathToExpress(stage, route.path)
    console.log(`    Attaching ${route.method.toUpperCase()} ${routeHandler.name} at http://localhost:${portNumber}${invokePath}...`.blue)

    // attach route for method
    app[route.method](invokePath, async (req, res) => {
      if (auth) {
        const authResponse = await invokeHandler(auth.path, auth.method, req, invokeOpts)
        if (typeof authResponse === 'string') {
          console.log(authResponse)
          if (authResponse === 'Unauthorized') {
            res
              .status(401)
              .set({ 'Content-Type': 'application/json' })
              .end(JSON.stringify({
                message: 'Unauthorized'
              }))
          } else {
            res
              .status(500)
              .set({ 'Content-Type': 'application/json' })
              .end(JSON.stringify({
                message: authResponse
              }))
          }
          return
        }
      }
      // invoke the handler lambda
      const response = await invokeHandler(routeHandler.path, routeHandler.method, req, invokeOpts)
      // Respond to HTTP request
      res
        .status(response.statusCode)
        .set(response.headers)
        .end(response.body)
    })
  }
}

async function invokeHandler (handlerName, handlerMethod, req, opts) {
  console.log(`Calling ${handlerName}.${handlerMethod}`)

  const handlerFunc = require(handlerName)

  const logReq = {
    headers: req.headers,
    url: req.url,
    method: req.method,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body
  }
  console.log('REQ')
  console.log(util.inspect(logReq))

  const firstQM = req.originalUrl.indexOf('?')
  const rawPath = (firstQM < 0) ? req.originalUrl : req.originalUrl.substring(0, firstQM)
  const rawQueryString = (firstQM > 0) ? req.originalUrl.substring(firstQM + 1) : undefined

  try {
    // we have to re-encode the body
    let body
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      body = Buffer.from(querystring.stringify(req.body)).toString('base64')
    } else {
      body = JSON.stringify(req.body)
    }

    let cookies = []
    if (req.headers.cookie) {
      cookies = req.headers.cookie.split('; ')
    }

    const result = await lambdaLocal.execute({
      lambdaFunc: handlerFunc,
      lambdaHandler: handlerMethod,
      timeoutMs: opts.timeoutMs || 3000,
      event: {
        headers: req.headers, // Pass on request headers
        body: body, // Pass on request body
        cookies: cookies,
        requestContext: {
          authorizer: '',
          http: {
            method: req.method
          }
        },
        queryStringParameters: req.query,
        pathParameters: req.params,
        rawPath: rawPath,
        rawQueryString: rawQueryString
      },
      envfile: path.join(__dirname, '.env')
    })

    return result
  } catch (error) {
    console.log(error)

    return error
  }
}

function getRouteHandler (uri, handler) {
  const filePath = `${uri}/${handler}`

  const lastIndex = filePath.lastIndexOf('.')
  return {
    name: filePath,
    path: path.join(process.cwd(), filePath.substr(0, lastIndex)),
    method: filePath.substr(lastIndex + 1)
  }
}

function convertPathToExpress (stage, routePath) {
  let apiPath
  if (stage === '') {
    apiPath = `${routePath}`
  } else {
    apiPath = `/${stage}${routePath}`
  }

  // replace {path} with :path and + with *
  const convertedPath = apiPath.replace('{', ':').replace('}', '').replace('+', '*')
  return convertedPath
}
