const util = require('util')

module.exports = {
  testGet,
  testPost,
  scheduledPost,
  pathParamTestGet,
  proxyTestGet,
  authorizer,
  simpleAuthorizer
}

async function testGet (event) {
  console.log('EVENT')
  console.log(util.inspect(event))

  await new Promise(resolve => setTimeout(resolve, 1000))
  return getResponse('testGet')
}

async function testPost (event) {
  console.log('EVENT')
  console.log(util.inspect(event))

  const response = getResponse('testPost')
  response.body = JSON.stringify(event.body)
  return response
}

async function scheduledPost (event) {
  const response = getResponse('scheduledPost')
  response.body = event.body
  return response
}

async function pathParamTestGet (event) {
  console.log('EVENT')
  console.log(util.inspect(event))
  const pathParameters = event.pathParameters

  const response = getResponse('pathParamTestGet')
  response.body = response.body.replace('OK', pathParameters.pathParam)

  return response
}

async function proxyTestGet (event) {
  console.log('EVENT')
  console.log(util.inspect(event))

  const response = getResponse('proxyTestGet')
  return response
}

async function simpleAuthorizer (event, context) {
  console.log('EVENT')
  console.log(util.inspect(event))

  let token
  if (event.type === 'TOKEN') {
    token = event.authorizationToken
  } else {
    token = event.headers ? event.headers.authorization : undefined
  }

  let isAuthorized
  switch (token) {
    case 'allow':
      isAuthorized = true
      break
    case 'deny':
    default:
      isAuthorized = false
  }

  return {
    isAuthorized: isAuthorized
  }
}

async function authorizer (event, context, callback) {
  console.log('EVENT')
  console.log(util.inspect(event))

  const token = event.headers ? event.headers.authorization : undefined
  event.methodArn = 'arn:aws:lambda:eu-west-2:123456:function:the-function:1'

  const unauthorized = 'Unauthorized'
  const invalidToken = 'Error: Invalid token'

  switch (token) {
    case 'allow':
      callback(null, generatePolicy('user', 'Allow', event.methodArn))
      break
    case 'deny':
      callback(null, generatePolicy('user', 'Deny', event.methodArn))
      break
    case 'unauthorized':
      callback(unauthorized) // Return a 401 Unauthorized response
      break
    default:
      callback(invalidToken) // Return a 500 Invalid token response
  }
}

// Help function to generate an IAM policy
const generatePolicy = function (principalId, effect, resource) {
  const authResponse = {}

  authResponse.principalId = principalId
  if (effect && resource) {
    const policyDocument = {}
    policyDocument.Version = '2012-10-17'
    policyDocument.Statement = []
    const statementOne = {}
    statementOne.Action = 'execute-api:Invoke'
    statementOne.Effect = effect
    statementOne.Resource = resource
    policyDocument.Statement[0] = statementOne
    authResponse.policyDocument = policyDocument
  }

  // Optional output with custom properties of the String, Number or Boolean type.
  authResponse.context = {
    stringKey: 'stringval',
    numberKey: 123,
    booleanKey: true
  }
  return authResponse
}

function getResponse (thisFunction) {
  return {
    isBase64Encoded: false,
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ youCalled: thisFunction, everythingIs: 'OK' }, null, 2)
  }
}
