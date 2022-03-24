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

  // result.conditions = resolveConditions(result.conditions)

  getResources(parsed.Resources)

  setApiRoutes(result.apis)
  setApiAuth(result.apis)
  setApiCors(result.apis)

  return {
    apis: result.apis,
    globalEnvVars: result.globalEnvVars,
    globalTimeout: result.globalTimeout,
    globalCors: result.globalCors,
    templateDetail: {
      conditions: result.conditions,
      globals: result.globalEnvVars
    }
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
    // outputConditions[conditionName] = condition
    outputConditions[conditionName] = parseValue(condition, conditionName)
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
    if (event.Type !== 'HttpApi' && event.Type !== 'RestApi') {
      continue
    }

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
    // console.log(`getting Ref ${value.Ref}`)
    parsedValue = result.parameters[value.Ref]
  } else {
    parsedValue = processFunction(value, context)
  }
  if (parsedValue !== undefined) {
    // console.log(`context=${context} parsedValue=${parsedValue}`)
    return parsedValue
  }

  console.warn(`  WARNING: Can't set ${context} as only strings, refs, Equals, If, Not and FindInMap are currently supported!`.yellow)
  return undefined
}

function processFunction (value, context) {
  if (value['Fn::Equals']) {
    return processEquals(value, context)
  } else if (value['Fn::FindInMap']) {
    return processFindInMap(value, context)
  } else if (value['Fn::If']) {
    return processIf(value, context)
  } else if (value['Fn::Not']) {
    return processNot(value, context)
  }

  return undefined
}

function processEquals (value, context) {
  const functionParams = value['Fn::Equals']
  // console.log(`Fn::Equals=${JSON.stringify(functionParams, null, 2)}`)

  // check correctly formed
  if (!Array.isArray(functionParams) || functionParams.length < 2) {
    console.warn(`  WARNING: Can't set ${context} as Equals function parameters are invalid!`.yellow)
    return undefined
  }

  // return a boolean if they equal
  const lhs = parseValue(functionParams[0], context)
  const rhs = parseValue(functionParams[1], context)
  // console.log(`lhs=[${lhs}] rhs=[${rhs}]`)

  return (lhs === rhs)
}

function processFindInMap (value, context) {
  const functionParams = value['Fn::FindInMap']
  // console.log(`Fn::FindInMap=${JSON.stringify(functionParams, null, 2)}`)

  // check correctly formed
  if (!Array.isArray(functionParams) || functionParams.length < 3) {
    console.warn(`  WARNING: Can't set ${context} as FindInMap function parameters are invalid!`.yellow)
    return undefined
  }

  const mapName = functionParams[0]
  let mapEntry = functionParams[1]

  // resolve ref to parameter
  if (typeof mapEntry !== 'string') {
    // console.log('mapEntry is not a string')
    if (mapEntry.Ref) {
      // console.log(`mapEntry.Ref=${mapEntry.Ref}`)
      mapEntry = result.parameters[mapEntry.Ref]
    }
  }

  // get the map
  const map = result.mappings[mapName]

  // get the map set of values
  const mapValue = functionParams[2]
  const mapSet = map[mapEntry]

  // return the map value
  return mapSet[mapValue]
}

function processIf (value, context) {
  const functionParams = value['Fn::If']
  // console.log(`Fn::If=${JSON.stringify(functionParams, null, 2)}`)

  // check correctly formed
  if (!Array.isArray(functionParams) || functionParams.length < 3) {
    console.warn(`  WARNING: Can't set ${context} as If function parameters are invalid!`.yellow)
    return undefined
  }

  const conditionName = functionParams[0]
  const condition = result.conditions[conditionName]

  const trueResult = parseValue(functionParams[1], context)
  const falseResult = parseValue(functionParams[2], context)
  // console.log(`condition=${condition} trueResult=[${trueResult}] falseResult=[${falseResult}]`)

  return condition ? trueResult : falseResult
}

function processNot (value, context) {
  const functionParams = value['Fn::Not']
  // console.log(`Fn::Not=${JSON.stringify(functionParams, null, 2)}`)

  // check correctly formed
  if (!Array.isArray(functionParams) || functionParams.length !== 1) {
    console.warn(`  WARNING: Can't set ${context} as Not function parameters are invalid!`.yellow)
    return undefined
  }

  return !parseValue(functionParams[0], context)
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
