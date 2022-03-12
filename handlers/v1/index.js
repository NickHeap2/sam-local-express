module.exports = {
  testGet,
  testPost,
  scheduledPost,
  pathParamTestGet
}

async function testGet (event) {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return getResponse('testGet')
}

async function testPost (event) {
  return getResponse('testPost')
}

async function scheduledPost (event) {
  return getResponse('scheduledPost')
}

async function pathParamTestGet (event) {
  const pathParameters = event.pathParameters

  const response = getResponse('pathParamTestGet')
  response.body = response.body.replace('OK', pathParameters.pathParam)

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
