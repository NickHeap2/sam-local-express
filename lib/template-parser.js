const { yamlParse } = require('yaml-cfn')
const fs = require('fs')
require('colors')
const path = require('path')

module.exports = {
  parseFile
}

function parseFile (fileName) {
  const parameters = {}
  const mappings = {}
  const noneRouteFunctions = {}

  const globalEnvVars = []
  let globalCors = {
    hasCorsConfiguration: false
  }
  const apis = []
  const routes = []

  const input = fs.readFileSync(fileName)

  let parsed
  try {
    parsed = yamlParse(input)
    if (!parsed) {
      console.error('yaml parsing failed!')
      return undefined
    }
  } catch (error) {
    console.error(error)
    return undefined
  }

  let globalTimeout = 3000

  // get parameters so we can use the default values
  for (const paramName in parsed.Parameters) {
    const param = parsed.Parameters[paramName]
    parameters[paramName] = param.Default
  }

  // get mappings
  for (const mappingName in parsed.Mappings) {
    const mapping = parsed.Mappings[mappingName]
    mappings[mappingName] = mapping
  }

  // get global options
  for (const type in parsed.Globals) {
    if (type === 'Function') {
      const functionGlobals = parsed.Globals[type]
      for (const global in functionGlobals) {
        if (global === 'Timeout' && typeof functionGlobals[global] === 'number') {
          globalTimeout = functionGlobals[global] * 1000
        } else if (global === 'Environment' && functionGlobals[global].Variables) {
          const envVars = functionGlobals[global].Variables

          for (const envVar in envVars) {
            const aVar = {
              name: envVar
            }
            const value = envVars[envVar]
            if (typeof value === 'string') {
              aVar.value = value
            } else if (value.Ref) {
              aVar.value = parameters[value.Ref]
            } else if (value['Fn::FindInMap']) {
              const findInMap = value['Fn::FindInMap']
              const mapName = findInMap[0]
              let mapEntry = findInMap[1]

              // resolve ref to parameter
              if (typeof mapEntry !== 'string') {
                if (mapEntry.Ref) {
                  mapEntry = parameters[mapEntry.Ref]
                }
              }

              const mapValue = findInMap[2]
              const map = mappings[mapName]
              const mapSet = map[mapEntry]
              aVar.value = mapSet[mapValue]
            } else {
              console.warn(`  WARNING: Can't set ${envVar} as only strings, refs and FindInMap are currently supported!`.yellow)
            }

            globalEnvVars.push(aVar)
          }
        }
      }
    } else if (type === 'Api') {
      const apiGlobals = parsed.Globals[type]
      if (apiGlobals.Cors) {
        globalCors = getCorsConfiguration(apiGlobals.Cors)
      }
    }
  }

  // get api gateway and function resources
  for (const resourceName in parsed.Resources) {
    const resource = parsed.Resources[resourceName]

    if (resource.Type === 'AWS::Serverless::HttpApi' || resource.Type === 'AWS::Serverless::RestApi') {
      apis.push(getApi(resourceName, resource))
    } else if (resource.Type === 'AWS::Serverless::Function') {
      const handler = {
        codeUri: '.'
      }

      let attached = false
      const properties = resource.Properties
      for (const property in properties) {
        if (property === 'Handler') {
          handler.handler = properties[property]
        } else if (property === 'CodeUri') {
          handler.codeUri = properties[property]
        } else if (property === 'Events') {
          const events = properties[property]

          for (const eventName in events) {
            const event = events[eventName]
            if (event.Type === 'HttpApi' || event.Type === 'RestApi') {
              const route = {
                name: eventName,
                handler: handler
              }
              const properties = event.Properties
              for (const property in properties) {
                if (property === 'Path') {
                  route.path = properties[property]
                } else if (property === 'Method') {
                  route.method = properties[property]
                } else if (property === 'ApiId') {
                  route.apiName = properties[property].Ref
                }
              }

              if (route.path) {
                attached = true
                routes.push(route)
              }
            }
          }
        }
      }
      if (!attached) {
        noneRouteFunctions[resourceName] = handler
      }
    }
  }

  for (const api of apis) {
    // attach routes
    api.routes = routes.filter((r) => r.apiName === api.name)

    // setup auth
    if (api.auth.hasAuthorizer) {
      const authFunction = noneRouteFunctions[api.auth.name]
      if (authFunction) {
        api.auth.handler = getRouteHandler(authFunction.codeUri, authFunction.handler)
      } else {
        console.warn(`  WARNING: Can't find authorizer function named ${api.auth.name}!`.yellow)
        api.auth.hasAuthorizer = false
        api.auth.handler = undefined
      }
    }

    // copy global cors
    if (globalCors.hasCorsConfiguration) {
      if (api.cors.hasCorsConfiguration === false) {
        api.cors.hasCorsConfiguration = true
        api.cors.corsConfiguration = {}
      }

      // copy global settings if not already set
      for (const corsSetting in globalCors.corsConfiguration) {
        if (api.cors.corsConfiguration[corsSetting] === undefined) {
          api.cors.corsConfiguration[corsSetting] = globalCors.corsConfiguration[corsSetting]
        }
      }
    }
  }

  return {
    apis,
    globalEnvVars,
    globalTimeout,
    globalCors
  }
}

function getApi (resourceName, resource) {
  const apiType = (resource.Type === 'AWS::Serverless::HttpApi') ? 'HttpApi' : 'RestApi'
  const stageName = getStageName(resource.Properties)
  const customAuth = getCustomAuth(resource.Properties)
  const corsConfiguration = getCorsConfiguration(resource.Properties?.CorsConfiguration)

  return {
    name: resourceName,
    type: apiType,
    stage: stageName,
    auth: customAuth,
    cors: corsConfiguration
  }
}

function getStageName (properties) {
  for (const property in properties) {
    if (property === 'StageName' && properties[property]) {
      return properties[property]
    }
  }
  return ''
}

function getCustomAuth (properties) {
  const authConfig = {
    hasAuthorizer: false
  }

  if (!properties.Auth) {
    return authConfig
  }

  // look for a local lambda authorizer we can attach
  const auth = properties.Auth
  const defaultAuthorizerName = auth.DefaultAuthorizer
  if (defaultAuthorizerName && auth.Authorizers) {
    const defaultAuthorizer = auth.Authorizers[auth.DefaultAuthorizer]

    if (defaultAuthorizer.FunctionPayloadType === 'REQUEST' ||
        (defaultAuthorizer.FunctionPayloadType === undefined && defaultAuthorizer.Identity)) {
      authConfig.type = 'request'
    } else {
      authConfig.type = 'token'
    }

    if (defaultAuthorizer.FunctionArn) {
      authConfig.name = getFunctionNameFromFunctionArn(defaultAuthorizer.FunctionArn)
      // if we couldn't get a local name then disable the authorizer
      if (!authConfig.name) {
        console.warn(`  WARNING: Couldn't resolve authorizer ${defaultAuthorizerName} to a local function so ignoring!`.yellow)
        return authConfig
      }
    }

    if (defaultAuthorizer.EnableSimpleResponses === 'true') {
      authConfig.simpleResponses = true
    } else {
      authConfig.simpleResponses = false
    }

    authConfig.hasAuthorizer = true
  }

  return authConfig
}

function getCorsConfiguration (cors) {
  const corsConfig = {}
  if (!cors) {
    return {
      hasCorsConfiguration: false
    }
  }

  if (typeof cors === 'boolean') {
    corsConfig.allowOrigins = 'http://localhost'
  } else if (typeof cors === 'string') {
    corsConfig.allowOrigins = cors
  } else {
    if (cors.AllowCredentials) {
      corsConfig.allowCredentials = cors.AllowCredentials
    }
    if (cors.AllowHeaders) {
      corsConfig.allowHeaders = cors.AllowHeaders
    }
    if (cors.AllowMethods) {
      corsConfig.allowMethods = cors.AllowMethods
    }
    if (cors.AllowOrigins) {
      corsConfig.allowOrigins = cors.AllowOrigins
    }
    if (cors.ExposeHeaders) {
      corsConfig.exposeHeaders = cors.ExposeHeaders
    }
    if (cors.MaxAge) {
      corsConfig.maxAge = cors.MaxAge
    }
  }

  // any cors config?
  if (Object.keys(corsConfig).length === 0) {
    return {
      hasCorsConfiguration: false
    }
  }

  return {
    hasCorsConfiguration: true,
    corsConfiguration: corsConfig
  }
}

function getFunctionNameFromFunctionArn (functionArn) {
  if (functionArn['Fn::GetAtt']) {
    return functionArn['Fn::GetAtt'][0]
  }
  return undefined
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
