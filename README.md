# sam-local-express
Local testing of simple AWS SAM templates via Express.  
The aim of this package is to support local testing of simple API gateways with attached AWS lambda functions/authorizors defined in an AWS SAM template.  
SAM start-api should still be used to more accurately verify functionality before deployment.

## Supported functionality
* Global environmental variables are populated from parameters and mappings
* Http and Rest Apis are discovered and served under a single or multiple Express instances
* Any authorizor lambda function defined in the template is called before the routes
* Serverless functions with Path, Method and ApiId are attached to the Express instances
* Routes are built like `http://localhost:3000/{api stage}/{function path}`

## Main packages used
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
Then you can use like this in your package.json
``` json
  "scripts": {
    "sam-local-express": "node ./node_modules/sam-local-express --template template.yaml",
    "sam-local-express-debug": "node --inspect-brk ./node_modules/sam-local-express --template template.yaml"
  }
```
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
  -h, --help                     display help for command
```

### Serve multiple APIs defined in a SAM template with Express servers starting at port 3000
``` bash
sam-local-express --template template.yaml
```
![multiple](https://github.com/NickHeap2/sam-local-express/blob/3f84f853a694f8eb6551c664f6f122a25ca35a1c/images/multiple.png)

### Serve multiple APIs defined in a SAM template with Express all on port 4000
Use the command below and then attach the debugger from VS Code
``` bash
sam-local-express --template template.yaml --singleport --baseport 4000
```
![single](https://github.com/NickHeap2/sam-local-express/blob/123c930c7725d2927f52fde5ba69708857b65fe4/images/single.png)

### Debug APIs defined in a SAM template with Express all on port 4000

``` bash
sam-local-express --inspect-brk --template template.yaml --singleport --baseport 4000
```
![single](https://github.com/NickHeap2/sam-local-express/blob/123c930c7725d2927f52fde5ba69708857b65fe4/images/single.png)


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
  PassedInParameter:
    Description: An example parameter passed into the template
    Type: String
    Default: ""

# Environment mapped variables
Mappings:
  Environments:
    local:
      DependencyUrl: 'http://host.docker.internal:3001/local/dependency'
    qa:
      DependencyUrl: 'http://host.docker.internal:3001/qa/dependency'
    prod:
      DependencyUrl: 'http://host.docker.internal:3001/prod/dependency'

# Global function env vars
Globals:
  Function:
    Environment:
      Variables:
        DEPENDENCY_URL: !FindInMap [Environments, !Ref Environment, DependencyUrl]
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
  # http api with routes defined on function events, events are routed through the auth function first
  TestHttpApiv1:
    Type: AWS::Serverless::HttpApi
    Properties:
      Auth:
        DefaultAuthorizer: MyLambdaRequestAuthorizer
        Authorizers:
          MyLambdaRequestAuthorizer:
            FunctionPayloadType: REQUEST
            FunctionArn: !GetAtt lambdaAuthorizer.Arn
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
      DefinitionBody:
        'Fn::Transform':
          Name: AWS::Include
          Parameters:
            Location: openapi.yaml
      StageName: v2

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

  testGet:
    Type: AWS::Serverless::Function
    Properties:
      Handler: handlers/v1/index.testGet
      Events:
        Apiv1:
          Type: HttpApi
          Properties:
            Path: /test
            Method: get
            ApiId: !Ref TestHttpApiv1
        Apiv2:
          Type: HttpApi
          Properties:
            Path: /test
            Method: get
            ApiId: !Ref TestHttpApiv2

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

Outputs:
  TestHttpApiv1:
    Description: "API Gateway endpoint URL for test api v1"
    Value:
      Fn::Sub: https://${TestHttpApiv1}.execute-api.${AWS::Region}.amazonaws.com/v1
  TestHttpApiv2:
    Description: "API Gateway endpoint URL for test api v2"
    Value:
      Fn::Sub: https://${TestHttpApiv2}.execute-api.${AWS::Region}.amazonaws.com/v2
```
