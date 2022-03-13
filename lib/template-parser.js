const { yamlParse } = require('yaml-cfn')
const fs = require('fs')
const colors = require('colors')

module.exports = {
  parseFile
}

function parseFile (fileName) {

  const parameters = {}
  const mappings = {}

  const globalEnvVars = []
  const apis = []
  const routes = []

  const input = fs.readFileSync(fileName)
  const parsed = yamlParse(input)

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
              console.warn(` WARN: Can't set ${envVar} as only strings, refs and FindInMap are currently supported!`.yellow)
            }

            globalEnvVars.push(aVar)
          }
        }
      }
    }
  }

  for (const resourceName in parsed.Resources) {
    const resource = parsed.Resources[resourceName]

    if (resource.Type === 'AWS::Serverless::HttpApi') {
      const stageName = getStageName(resource.Properties)
      apis.push({
        name: resourceName,
        type: 'HttpApi',
        stage: stageName
      })
    } else if (resource.Type === 'AWS::Serverless::RestApi') {
      const stageName = getStageName(resource.Properties)
      apis.push({
        name: resourceName,
        type: 'RestApi',
        stage: stageName
      })
    } else if (resource.Type === 'AWS::Serverless::Function') {
      const handler = {
        codeUri: '.'
      }

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
            if (event.Type === 'HttpApi') {
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
                routes.push(route)
              }
            }
          }
        }
      }
    }
  }

  // attach routes
  for (const api of apis) {
    api.routes = routes.filter((r) => r.apiName === api.name)
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

