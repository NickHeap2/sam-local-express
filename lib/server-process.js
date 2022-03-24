const path = require('path')
const fs = require('fs')
const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')

require('colors')

const lambdaInvoker = require('./lambda-invoker')

module.exports = {
  startServer
}

const invokeOpts = {
}

let servers = []

function startServer (serverConfig) {
  servers = []
  const { apis, globalEnvVars, globalTimeout, globalCors, singlePort, basePort } = serverConfig

  if (globalTimeout) {
    invokeOpts.timeoutMs = globalTimeout
  }

  // set env vars
  console.log('Setting env vars...'.green)
  for (const envVar of globalEnvVars) {
    console.log(`  ${envVar.name}=${envVar.value}`.blue)
    process.env[envVar.name] = envVar.value
  }

  console.log('Global CORS configuration'.green)
  for (const corsConfig in globalCors.corsConfiguration) {
    console.log(`  ${corsConfig}=${globalCors.corsConfiguration[corsConfig]}`.blue)
  }
  console.log(`Function timeouts are set as ${globalTimeout / 1000}s.`.green)

  console.log(`Found ${apis.length} apis...`.green)

  if (apis.length === 0) {
    console.error('No APIs found!'.red)
    console.log('Monitoring for changes (type rs ENTER to manually restart)...'.green)
    return servers
  }

  let instance
  let listenPort
  if (singlePort) {
    console.log('  Creating Express server for all APIs...'.green)

    instance = newExpress(apis[0], true)
    servers.push(instance)
    listenPort = basePort

    for (const api of apis) {
      console.log(`  Configuring ${api.type} ${api.name} stage ${api.stage}...`.green)

      logApiOptions(api)

      if (api.routes.length > 0) {
        console.log('    Attaching routes...'.green)
        addRoutesToAPI(instance, api, listenPort)
      }
    }

    console.log(`  Listening on port: ${listenPort}`.blue)
    instance.listen(listenPort)
  } else {
    let apiNumber = 0
    for (const api of apis) {
      console.log(`  Configuring ${api.type} ${api.name} stage ${api.stage}...`.green)
      listenPort = basePort + apiNumber
      apiNumber += 1

      // add an express server per api
      console.log(`  Creating Express server on port ${listenPort}...`.green)
      instance = newExpress(api, false)
      servers.push(instance)

      logApiOptions(api)
      addRoutesToAPI(instance, api, listenPort)

      console.log(`    Listening on port: ${listenPort}`.blue)
      instance.listen(listenPort)
    }
  }

  console.log('Monitoring for changes (type rs ENTER to manually restart)...'.green)

  return servers
}

function logApiOptions (api) {
  if (api.auth.hasAuthorizer) {
    console.log(`    Custom ${api.auth.type} authorizer ${api.auth.handler.name} attached...`.green)
  }
}

function newExpress (api, combined) {
  const app = express()

  const combinedText = combined ? '(from first API)' : ''

  if (api.cors.hasCorsConfiguration) {
    const corsConfig = {}
    console.log(`    Setting CORS configuration${combinedText}...`.green)
    for (const corsSetting in api.cors.corsConfiguration) {
      const corsValue = api.cors.corsConfiguration[corsSetting]
      let settingName
      switch (corsSetting) {
        case 'allowCredentials':
          corsConfig.credentials = corsValue
          settingName = 'credentials'
          break
        case 'allowHeaders':
          corsConfig.allowedHeaders = corsValue
          settingName = 'allowHeaders'
          break
        case 'allowMethods':
          corsConfig.methods = corsValue
          settingName = 'methods'
          break
        case 'allowOrigins':
          corsConfig.origin = corsValue.split(', ')
          settingName = 'origin'
          break
        case 'exposeHeaders':
          corsConfig.exposedHeaders = corsValue
          settingName = 'exposedHeaders'
          break
        case 'maxAge':
          corsConfig.maxAge = corsValue
          settingName = 'maxAge'
          break
      }
      console.log(`      ${settingName}=${api.cors.corsConfiguration[corsSetting]}`.blue)
    }
    app.use(cors(corsConfig))
  }

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
      console.warn(`      WARNING: Route handler ${routeHandler.path} does not exist!`.yellow)
    }

    const invokePath = convertPathToExpress(stage, route.path)
    console.log(`      Attaching ${routeHandler.name} at ${route.method.toUpperCase()} http://localhost:${portNumber}${invokePath}...`.blue)

    // attach route for method
    app[route.method](invokePath, lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts))
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
  const convertedPath = apiPath.replace(/\{/g, ':').replace(/\}/g, '').replace(/\+/g, '*')
  return convertedPath
}
