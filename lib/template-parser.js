const { yamlParse } = require('yaml-cfn')
const fs = require('fs')
const colors = require('colors')
const path = require('path')

module.exports = {
  parseFile
}

function parseFile (fileName) {

  const parameters = {}
  const mappings = {}
  const noneRouteFunctions = {}

  const globalEnvVars = []
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
  } catch(error) {
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
    }
  }

  // get api gateway and function resources
  for (const resourceName in parsed.Resources) {
    const resource = parsed.Resources[resourceName]

    if (resource.Type === 'AWS::Serverless::HttpApi') {
      const stageName = getStageName(resource.Properties)
      const customAuth = getCustomAuth(resource.Properties)

      apis.push({
        name: resourceName,
        type: 'HttpApi',
        stage: stageName,
        auth: customAuth
      })
    } else if (resource.Type === 'AWS::Serverless::RestApi') {
      const stageName = getStageName(resource.Properties)
      const customAuth = getCustomAuth(resource.Properties)

      apis.push({
        name: resourceName,
        type: 'RestApi',
        stage: stageName,
        auth: customAuth
      })
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
    if (api.auth) {
      const authFunction = noneRouteFunctions[api.auth]
      if (authFunction) {
        api.auth = getRouteHandler(authFunction.codeUri, authFunction.handler)
      } else {
        api.auth = undefined
      }
    }
  }

  return {
    apis,
    globalEnvVars,
    globalTimeout
  }
}

function getStageName(properties) {
  for (const property in properties) {
    if (property === 'StageName' && properties[property]) {
      return properties[property]
    }
  }
  return ''
}

function getCustomAuth(properties) {
  // search for a local lambda authorizer we can attach
  for (const property in properties) {
    if (property === 'Auth' && properties[property]) {
      const auth = properties[property]
      const defaultAuthorizerName = auth.DefaultAuthorizer
      if (defaultAuthorizerName && auth.Authorizers) {
        const defaultAuthorizer = auth.Authorizers[auth.DefaultAuthorizer]

        if (defaultAuthorizer.FunctionPayloadType !== 'REQUEST') {
          console.warn('  WARNING: Only REQUEST authorizer functions are supported!'.yellow)
          return undefined
        }

        if (defaultAuthorizer.FunctionArn) {
          const auth = getFunctionNameFromFunctionArn(defaultAuthorizer.FunctionArn)
          return auth
        }
      }
    }
  }
  return undefined
}

function getFunctionNameFromFunctionArn (functionArn) {
  if (functionArn['Fn::GetAtt']) {
    return functionArn['Fn::GetAtt'][0]
  }
  return undefined
}

function getRouteHandler (uri, handler) {
  const filePath  =  `${uri}/${handler}`

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

  //replace {path} with :path and + with *
  const convertedPath = apiPath.replace('{',':').replace('}', '').replace('+', '*')

  return convertedPath
}
