module.exports = {
  testGet,
  testPost,
  scheduledPost
}

async function testGet (event) {
  await new Promise(resolve => setTimeout(resolve, 1000))
  return getResponse(Object.values(this)[0].name)
}

async function testPost (event) {
  return getResponse(Object.values(this)[0].name)
}

async function scheduledPost (event) {
  return getResponse(Object.values(this)[0].name)
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
