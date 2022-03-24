require('colors')
const path = require('path')

module.exports = {
  parseTemplate
}

const result = {
}

function parseTemplate (parsed) {
  resetResult()

  result.parameters = getParameters(parsed.Parameters)
  result.mappings = getMappings(parsed.Mappings)
  result.conditions = getConditions(parsed.Conditions)
  // { result.globalEnvVars, result.globalCors } = getGlobals(parsed.Globals)
  const globals = getGlobals(parsed.Globals)
  result.globalEnvVars = globals.globalEnvVars
  result.globalCors = globals.globalCors

  // resolveConditions(result.conditions)

  getResources(parsed.Resources)

  setApiRoutes(result.apis)
  setApiAuth(result.apis)
  setApiCors(result.apis)

  return {
    apis: result.apis,
    globalEnvVars: result.globalEnvVars,
    globalTimeout: result.globalTimeout,
    globalCors: result.globalCors
  }
}

function resetResult () {
  result.parameters = {}
  result.mappings = {}
  result.conditions = {}
  result.noneRouteFunctions = {}
  result.globalEnvVars = []
  result.globalCors = {
    hasCorsConfiguration: false
  }
  result.apis = []
  result.routes = []
  result.globalTimeout = 3000
}

function getParameters (parameters) {
  const outputParameters = {}
  // get parameters so we can use the default values
  for (const paramName in parameters) {
    const param = parameters[paramName]
    outputParameters[paramName] = param.Default
  }

  return outputParameters
}

function getMappings (mappings) {
  const outputMappings = {}
  // get mappings
  for (const mappingName in mappings) {
    const mapping = mappings[mappingName]
    outputMappings[mappingName] = mapping
  }

  return outputMappings
}

function getConditions (conditions) {
  const outputConditions = {}
  // get conditions
  for (const conditionName in conditions) {
    const condition = conditions[conditionName]
    outputConditions[conditionName] = condition
  }

  return outputConditions
}

function getGlobals (globals) {
  let globalEnvVars = []
  let globalCors = {
    hasCorsConfiguration: false
  }
  // get global options
  for (const type in globals) {
    if (type === 'Function') {
      globalEnvVars = getFunctionGlobals(globals[type])
    } else if (type === 'Api') {
      globalCors = getApiGlobals(globals[type])
    }
  }

  return {
    globalEnvVars,
    globalCors
  }
}

function getFunctionGlobals (functionGlobals) {
  const globalEnvVars = []
  for (const global in functionGlobals) {
    if (global === 'Timeout' && typeof functionGlobals[global] === 'number') {
      result.globalTimeout = functionGlobals[global] * 1000
    } else if (global === 'Environment' && functionGlobals[global].Variables) {
      const envVars = functionGlobals[global].Variables

      for (const envVar in envVars) {
        const aVar = {
          name: envVar
        }
        const value = envVars[envVar]

        aVar.value = parseValue(value, envVar)
        globalEnvVars.push(aVar)
      }
    }
  }

  return globalEnvVars
}

function getApiGlobals (apiGlobals) {
  let globalCors
  if (apiGlobals.Cors) {
    globalCors = getCorsConfiguration(apiGlobals.Cors)
  }

  return globalCors
}

function getResources (resources) {
  // get api gateway and function resources
  for (const resourceName in resources) {
    const resource = resources[resourceName]

    if (resource.Type === 'AWS::Serverless::HttpApi' || resource.Type === 'AWS::Serverless::RestApi') {
      result.apis.push(getApi(resourceName, resource))
    } else if (resource.Type === 'AWS::Serverless::Function') {
      getFunction(resourceName, resource)
    }
  }
}

function getFunction (resourceName, resource) {
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
      const foundRouteEvent = processFunctionEvents(handler, properties[property])
      if (foundRouteEvent) {
        attached = true
      }
    }
  }
  if (!attached) {
    result.noneRouteFunctions[resourceName] = handler
  }
}

function processFunctionEvents (handler, events) {
  let foundRoutePath = false
  for (const eventName in events) {
    const event = events[eventName]
    if (event.Type === 'HttpApi' || event.Type === 'RestApi') {
      const route = {
        name: eventName,
        handler: handler
      }
      const eventProperties = event.Properties
      for (const eventProperty in eventProperties) {
        if (eventProperty === 'Path') {
          route.path = eventProperties[eventProperty]
        } else if (eventProperty === 'Method') {
          route.method = eventProperties[eventProperty]
        } else if (eventProperty === 'ApiId') {
          route.apiName = eventProperties[eventProperty].Ref
        }
      }

      // do we have a valid path?
      if (route.path) {
        foundRoutePath = true
        result.routes.push(route)
      }
    }
  }

  return foundRoutePath
}

function setApiRoutes (apis) {
  for (const api of apis) {
    // attach routes
    api.routes = result.routes.filter((r) => r.apiName === api.name)
  }
}

function setApiAuth (apis) {
  for (const api of apis) {
    // setup auth
    if (api.auth.hasAuthorizer) {
      const authFunction = result.noneRouteFunctions[api.auth.name]
      if (authFunction) {
        api.auth.handler = getRouteHandler(authFunction.codeUri, authFunction.handler)
      } else {
        console.warn(`  WARNING: Can't find authorizer function named ${api.auth.name}!`.yellow)
        api.auth.hasAuthorizer = false
        api.auth.handler = undefined
      }
    }
  }
}

function setApiCors (apis) {
  for (const api of apis) {
    // copy global cors
    if (result.globalCors.hasCorsConfiguration) {
      if (api.cors.hasCorsConfiguration === false) {
        api.cors.hasCorsConfiguration = true
        api.cors.corsConfiguration = {}
      }

      // copy global settings if not already set
      for (const corsSetting in result.globalCors.corsConfiguration) {
        if (api.cors.corsConfiguration[corsSetting] === undefined) {
          api.cors.corsConfiguration[corsSetting] = result.globalCors.corsConfiguration[corsSetting]
        }
      }
    }
  }
}

function parseValue (value, context) {
  let parsedValue
  if (typeof value === 'string') {
    parsedValue = value
  } else if (value.Ref) {
    parsedValue = result.parameters[value.Ref]
  } else if (value['Fn::FindInMap']) {
    const findInMap = value['Fn::FindInMap']
    const mapName = findInMap[0]
    let mapEntry = findInMap[1]

    // resolve ref to parameter
    if (typeof mapEntry !== 'string') {
      if (mapEntry.Ref) {
        mapEntry = result.parameters[mapEntry.Ref]
      }
    }

    const mapValue = findInMap[2]
    const map = result.mappings[mapName]
    const mapSet = map[mapEntry]
    parsedValue = mapSet[mapValue]
  } else {
    console.warn(`  WARNING: Can't set ${context} as only strings, refs and FindInMap are currently supported!`.yellow)
  }

  return parsedValue
}

function processFunction () {
  let functionValue

  return functionValue
}

function getApi (resourceName, resource) {
  const apiType = (resource.Type === 'AWS::Serverless::HttpApi') ? 'HttpApi' : 'RestApi'
  const stageName = getStageName(resource.Properties)
  const customAuth = getCustomAuth(resource.Properties)
  const corsConfiguration = getCorsConfiguration(resource.Properties ? resource.Properties.CorsConfiguration : undefined)

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

    authConfig.simpleResponses = (defaultAuthorizer.EnableSimpleResponses === 'true')
    authConfig.hasAuthorizer = true
  }

  return authConfig
}

function lowercaseFirstLetter (string) {
  return string.charAt(0).toLowerCase() + string.slice(1)
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
    for (const corsProp in cors) {
      corsConfig[lowercaseFirstLetter(corsProp)] = cors[corsProp]
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
