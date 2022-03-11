const { yamlParse } = require('yaml-cfn')
const fs = require('fs')

module.exports = {
  parseFile
}

function parseFile (fileName) {
  const input = fs.readFileSync(fileName)

  const parsed = yamlParse(input)

  const apis = []
  const routes = []

  const mappings = []
  const globalEnvVars = []

  const currentEnvironment = 'local'

  const mappings = parsed.Mappings

  // const mapping = parsed.mappings[currentEnvironment]
  // if (mapping) {

  // }

  for (const type in parsed.Globals) {
    if (type === 'Function') {
      const functionGlobals = parsed.Globals[type]
      for (const global in functionGlobals) {
        if (global === 'Environment' && functionGlobals[global].Variables) {
          const envVars = functionGlobals[global].Variables

          for (const envVar in envVars) {
            // this is more complicated!
            // "Variables": {
            //   "ENV_SPECIFIC_VAR": {
            //     "Fn::FindInMap": [
            //       "environments",
            //       {
            //         "Ref": "Environment"
            //       },
            //       "EnvSpecificVar"
            //     ]
            //   },
            //   "ENV_VAR_1": {
            //     "Ref": "EnvVarParameter"
            //   },
            //   "SECRET_KEY": {
            //     "Fn::Sub": "secretsmanager key"
            //   }
            // }
            const aVar = {
              name: envVar
            }
            const value = envVars[envVar]
            if (typeof value === 'string') {
              aVar.value = value
            } else if (value['Fn::FindInMap']) {
              // find value in map
              aVar.findInMap = 
              {
                ...value
              } 
            } else {
              console.warn(` WARN: Can't set ${envVar} as only strings currently supported!`)
            }

            globalEnvVars.push(aVar)
          }
        }
      }
    }
  }

  for (const resourceName in parsed.Resources) {
    const resource = parsed.Resources[resourceName]
    // console.log(resource.Type)
    if (resource.Type === 'AWS::Serverless::HttpApi') {
      // console.log(JSON.stringify(resource, null, 2))
      apis.push({
        name: resourceName
      })
    } else if (resource.Type === 'AWS::Serverless::RestApi') {
      // console.log(JSON.stringify(resource, null, 2))
      apis.push({
        name: resourceName
      })
    } else if (resource.Type === 'AWS::Serverless::Function') {
      const handler = {
        codeUri: '.'
      }
      // console.log(JSON.stringify(resource, null, 2))
      const properties = resource.Properties
      for (const property in properties) {
        if (property === 'Handler') {
          handler.handler = properties[property]
        } else if (property === 'CodeURI') {
          handler.codeUri = properties[property]
        } else if (property === 'Events') {
          const events = properties[property]
          for (const eventName in events) {
            const event = events[eventName]
            // console.log(JSON.stringify(event, null, 2))

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
                // console.log(`handler=${route.handler.handler}, codeUri=${route.handler.codeUri}, path=${route.path}, method=${route.method}`)
              }
            }
          }
        }
      }
    }
  }

  // console.log(JSON.stringify(apis, null, 2))
  // console.log(JSON.stringify(routes, null, 2))

  // attach routes
  for (const api of apis) {
    api.routes = routes.filter((r) => r.apiName === api.name)
  }

  return {
    apis,
    globalEnvVars
  }
}
