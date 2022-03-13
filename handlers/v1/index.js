const util = require('util')

module.exports = {
  testGet,
  testPost,
  scheduledPost,
  pathParamTestGet,
  proxyTestGet
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
