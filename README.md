# sam-local-express
Local testing of simple AWS SAM templates via Express.  
The aim of this package is to support local testing of simple API gateways with attached AWS lambda functions/authorizers defined in an AWS SAM template.  
SAM start-api should still be used to more accurately verify functionality before deployment.  

[![Node.js CI](https://github.com/NickHeap2/sam-local-express/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/NickHeap2/sam-local-express/actions/workflows/main.yml)
[![Standardjs](https://github.com/NickHeap2/sam-local-express/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/NickHeap2/sam-local-express/actions/workflows/lint.yml)
[![CodeQL](https://github.com/NickHeap2/sam-local-express/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/NickHeap2/sam-local-express/actions/workflows/codeql-analysis.yml)

## Supported functionality
* The values `172.17.0.1` and `host.docker.internal` are replaced in your template with `localhost`
* The functions `Equals`, `If`, `Not` and `FindInMap` are processed for conditions and environmental variables (`And` and `Or` are not yet)
* Conditions are evaluated from parameters and mappings
* Global environmental variables are populated from parameters, mappings and conditions
* Http and Rest Apis are discovered and served under a single or multiple Express instances
* Cors rules are applied from global and api level settings
* Any authorizer lambda function defined in the template is called before the routes
* Serverless functions with Path, Method and ApiId are attached to the Express instances
* Routes are built like `http://localhost:3000/{api stage}/{function path}`
* Any set cookies in the response have `Secure` removed so that they will work with http

## Functionality that will be supported in the future
* `And` and `Or` function processing
* Environmental variables defined at the function level

## Main packages used
`cors` - cors configuration.  
`express` - routing to the handlers.  
`lambda-local` - invoking the lambda functions.  
`nodemon` - watching code for any changes and restarting the server.  
`yaml-cfn` - parsing the template file.

See below for an example of the type of template that this is designed to support

## Installing
### Globally
``` bash
npm install --global sam-local-express
```
Then you can use it like this
``` bash
sam-local-express --template template.yaml
```

### Project level
``` bash
npm install --save-dev sam-local-express
```

Then you can use it like this in your package.json
``` json
  "scripts": {
    "sam-local-express": "sam-local-express --template template.yaml"
  }
```
Or from the terminal like this
``` bash
npx sam-local-express --template template.yaml
```

Details of how to debug your serverless functions is found under `Debug APIs defined in a SAM template with Express all on port 4000`.

## Usage

Use --help to get a list of options
``` text
Usage: sam-local-express [options]

Options:
  -V, --version                  output the version number
  -t, --template <template>      Source AWS SAM template yaml filename
  -e, --extensions [extensions]  Comma separated list of file extensions to watch (default: "js,json,yaml")
  -s, --singleport               If set then all APIs will be served on a single port, use stages to separate (default: false)
  -b, --baseport [portnumber]    The base port for Express servers (default: 3000)
  -a, --noauth                   Don't attach authorisers (default: false)
  -h, --help                     display help for command
```

### Serve multiple APIs defined in a SAM template with Express servers starting at port 3000
``` bash
sam-local-express --template template.yaml
```
![multiple](https://github.com/NickHeap2/sam-local-express/blob/3f84f853a694f8eb6551c664f6f122a25ca35a1c/images/multiple.png)

### Serve multiple APIs defined in a SAM template with Express all on port 4000
``` bash
sam-local-express --template template.yaml --singleport --baseport 4000
```
![single](https://github.com/NickHeap2/sam-local-express/blob/123c930c7725d2927f52fde5ba69708857b65fe4/images/single.png)

### Serve multiple APIs defined in a SAM template with Express all on port 4000 and don't attach any auth function
``` bash
sam-local-express --template template.yaml --singleport --baseport 4000 --noauth
```

### Debug APIs defined in a SAM template with Express all on port 4000

There are two ways to debug your APIs:

The best way is to use the 'Run "npm start" in a debug terminal' option in VS Code by adding through the Add configuration Debug UI or setting your .vscode/launch.json to the below
``` json
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "command": "npm run sam-local-express",
      "name": "sam-local-express",
      "request": "launch",
      "type": "node-terminal"
    }
  ]
}
```

The other way is to use --inspect-brk on the command line
``` bash
sam-local-express --inspect-brk --template template.yaml --singleport --baseport 4000
```
or in your package.json
``` json
    "sam-local-express-debug": "node --inspect-brk ./node_modules/sam-local-express --template template.yaml"
```
Then attach to the session via Attach in VS Code. The problem with this is that you have to hit continue in two files of the package before continuing to your own code.

### Watching for changes

You can use standard nodemon config in your package.json to change how the file watching works.
``` json
  "nodemonConfig": {
    "ignore": ["test/*", "docs/*"],
    "delay": 2500
  }
```

## Example template
``` yaml
---
AWSTemplateFormatVersion: '2010-09-09'
Transform: "AWS::Serverless-2016-10-31"
Description: >
  test-apis

# Parameters are populated atm with the default values
Parameters:
  Environment:
    Description: Environment to run under
    Type: String
    Default: "local"
    AllowedValues:
      - "local"
      - "qa"
      - "prod"
  LocalEnvironmentType:
    Description: Type of Local Environment to run under
    Type: String
    Default: "one"
    AllowedValues:
      - "one"
      - "two"
  PassedInParameter:
    Description: An example parameter passed into the template
    Type: String
    Default: ""

# Environment mapped variables
Mappings:
  LocalEnvironmentSettings:
    one:
      DependencyUrl: 'http://172.17.0.1:3001/local/one/dependency'
    two:
      DependencyUrl: 'http://host.docker.internal:3001/local/two/dependency'
  Environments:
    local:
      DependencyUrl: 'http://host.docker.internal:3001/local/dependency'
    qa:
      DependencyUrl: 'http://172.17.0.1:3001/qa/dependency'
    prod:
      DependencyUrl: 'http://my.server.com:3001/prod/dependency'

# apply some conditions
Conditions:
  LocalEnvironment: !Equals [ !Ref Environment, 'local' ]
  NotLocalEnvironment: !Not [ !Equals [ !Ref Environment, 'local' ] ]

# Global function env vars
Globals:
  Api:
    Cors:
      AllowMethods: 'OPTIONS'
  Function:
    Environment:
      Variables:
        DEPENDENCY_URL: !FindInMap [Environments, !Ref Environment, DependencyUrl]
        # the if will get resolved
        DEPENDENCY_URL_IF: !If [
          LocalEnvironment,
          !FindInMap [LocalEnvironmentSettings, !Ref LocalEnvironmentType, DependencyUrl],
          !FindInMap [Environments, !Ref Environment, DependencyUrl]
        ]
        MY_PARAMETER_VARIABLE:
          Ref: PassedInParameter
        MY_SECRET:
          Fn::Sub: "{{resolve:secretsmanager:${SecretType}:SecretString:secretValue}}"
    Runtime: nodejs14.x
    Timeout: 15
    Layers:
      - !Ref BaseLayer

# Http API Gateway and Resources
Resources:
  # http api with routes defined on function events,
  # events are routed through the auth function first
  TestHttpApiv1:
    Type: AWS::Serverless::HttpApi
    Properties:
      Auth:
        DefaultAuthorizer: LambdaRequestAuthorizer
        Authorizers:
          LambdaRequestAuthorizer:
            FunctionPayloadType: REQUEST
            FunctionArn: !GetAtt lambdaAuthorizer.Arn
      CorsConfiguration: true
      DefinitionBody:
        'Fn::Transform':
          Name: AWS::Include
          Parameters:
            Location: openapi.yaml
      StageName: v1

  # http api with routes defined on function events
  TestHttpApiv2:
    Type: AWS::Serverless::HttpApi
    Properties:
      Auth:
        DefaultAuthorizer: SimpleLambdaRequestAuthorizer
        Authorizers:
          SimpleLambdaRequestAuthorizer:
            FunctionArn: !GetAtt simpleLambdaAuthorizer.Arn
            EnableSimpleResponses: true
            Identity:
              Headers:
                - Authorization
      CorsConfiguration: 'localhost'
      DefinitionBody:
        'Fn::Transform':
          Name: AWS::Include
          Parameters:
            Location: openapi.yaml
      StageName: v2

  # http api with token authorizer
  TestHttpApiv3:
    Type: AWS::Serverless::HttpApi
    Properties:
      Auth:
        DefaultAuthorizer: SimpleLambdaRequestAuthorizer
        Authorizers:
          SimpleLambdaRequestAuthorizer:
            FunctionArn: !GetAtt simpleLambdaAuthorizer.Arn
            EnableSimpleResponses: true
      CorsConfiguration: true
      DefinitionBody:
        'Fn::Transform':
          Name: AWS::Include
          Parameters:
            Location: openapi.yaml
      StageName: v3

  # http api with external authorizer that will be ignored
  TestHttpApiv4:
    Type: AWS::Serverless::HttpApi
    Properties:
      Auth:
        DefaultAuthorizer: ExternalAuthorizer
        Authorizers:
          ExternalAuthorizer:
            FunctionArn:
              Fn::ImportValue: ExternalAuthorizer
            EnableSimpleResponses: true
      CorsConfiguration: true
      DefinitionBody:
        'Fn::Transform':
          Name: AWS::Include
          Parameters:
            Location: openapi.yaml
      StageName: v4

  # http api with no auth and cors
  TestHttpApiv5:
    Type: AWS::Serverless::HttpApi
    Properties:
      CorsConfiguration:
        AllowCredentials: true
        AllowHeaders: 'Authorization, *'
        AllowMethods: 'GET, POST, DELETE, *'
        AllowOrigins: 'http://localhost, https://stackoverflow.com'
        ExposeHeaders: 'Date, x-api-id'
        MaxAge: 100
      DefinitionBody:
        'Fn::Transform':
          Name: AWS::Include
          Parameters:
            Location: openapi.yaml
      StageName: v5

  # base layer for functions, this isn't used atm the handlers run against your dev dependencies instead
  BaseLayer:
    Type: AWS::Serverless::LayerVersion
    Properties:
      LayerName: base_layer
      Description: Base layer for containers
      ContentUri: base
      CompatibleRuntimes:
        - nodejs14.x
      RetentionPolicy: Delete
    Metadata:
      BuildMethod: nodejs14.x

  # a secret from secret manager, we don't do anything with this yet
  EncryptionSecret:
    Type: AWS::SecretsManager::Secret
    Properties:
      Name: my-secret
      Description: My Secret
      GenerateSecretString:
        SecretStringTemplate: "{}"
        GenerateStringKey: "secretValue"
        ExcludeCharacters: '"@/\\'

  # functions
  pathParamTestGet:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/v1/index.pathParamTestGet
      Events:
        Apiv1:
          Type: HttpApi
          Properties:
            Path: /{pathParam}/test/
            Method: get
            ApiId: !Ref TestHttpApiv1

  doublePathParamTestGet:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/v1/index.doublePathParamTestGet
      Events:
        Apiv1:
          Type: HttpApi
          Properties:
            Path: /{pathParam1}/test/{pathParam2}/testagain
            Method: get
            ApiId: !Ref TestHttpApiv1

  testGet:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/v1/index.testGet
      Events:
        Apiv1Get:
          Type: HttpApi
          Properties:
            Path: /test
            Method: get
            ApiId: !Ref TestHttpApiv1
        Apiv1Delete:
          Type: HttpApi
          Properties:
            Path: /test
            Method: delete
            ApiId: !Ref TestHttpApiv1
        Apiv2:
          Type: HttpApi
          Properties:
            Path: /test
            Method: get
            ApiId: !Ref TestHttpApiv2
        Apiv3:
          Type: HttpApi
          Properties:
            Path: /test
            Method: get
            ApiId: !Ref TestHttpApiv3
        Apiv5:
          Type: HttpApi
          Properties:
            Path: /test
            Method: get
            ApiId: !Ref TestHttpApiv5

  proxyTestGet:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/v1/index.proxyTestGet
      Events:
        Apiv1:
          Type: HttpApi
          Properties:
            Path: /proxy/{proxy}+
            Method: get
            ApiId: !Ref TestHttpApiv1

  testPost:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/v1/index.testPost
      Events:
        Apiv2:
          Type: HttpApi
          Properties:
            Path: /test
            Method: post
            ApiId: !Ref TestHttpApiv2

  scheduledPost:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/v1/index.scheduledPost
      Events:
        Apiv2:
          Type: HttpApi
          Properties:
            Path: /scheduled
            Method: post
            ApiId: !Ref TestHttpApiv2
        EveryTenMinutes:
          Type: Schedule
          Properties:
            Schedule: 'rate(10 minutes)'
            Name: EveryTenMinutes
            Description: Run every 10 minutes
            Enabled: true

  # an authorizer function
  lambdaAuthorizer:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/v1/index.authorizer

  simpleLambdaAuthorizer:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/v1/index.simpleAuthorizer

Outputs:
  TestHttpApiv1:
    Description: "API Gateway endpoint URL for test api v1"
    Value:
      Fn::Sub: https://${TestHttpApiv1}.execute-api.${AWS::Region}.amazonaws.com/v1
  TestHttpApiv2:
    Description: "API Gateway endpoint URL for test api v2"
    Value:
      Fn::Sub: https://${TestHttpApiv2}.execute-api.${AWS::Region}.amazonaws.com/v2
  TestHttpApiv3:
    Description: "API Gateway endpoint URL for test api v3"
    Value:
      Fn::Sub: https://${TestHttpApiv3}.execute-api.${AWS::Region}.amazonaws.com/v3
  TestHttpApiv4:
    Description: "API Gateway endpoint URL for test api v4"
    Value:
      Fn::Sub: https://${TestHttpApiv4}.execute-api.${AWS::Region}.amazonaws.com/v4
  TestHttpApiv5:
    Description: "API Gateway endpoint URL for test api v5"
    Value:
      Fn::Sub: https://${TestHttpApiv5}.execute-api.${AWS::Region}.amazonaws.com/v5
```
