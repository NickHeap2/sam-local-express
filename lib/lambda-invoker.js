const path = require('path')
const util = require('util')
const lambdaLocal = require('lambda-local')
const querystring = require('querystring')

module.exports = {
  getInvoker
}

const jsonContentType = { 'Content-Type': 'application/json' }

function getInvoker (auth, routeHandler, invokeOpts) {
  return async (req, res) => {
    if (auth.hasAuthorizer) {
      const authInvokeOpts = {
        ...invokeOpts,
        auth
      }
      const authResponse = await invokeHandler(auth.handler.path, auth.handler.method, req, authInvokeOpts)
      if (typeof authResponse === 'string') {
        console.log(authResponse)
        if (authResponse === 'Unauthorized') {
          setUnauthorized(res)
          return
        } else {
          setError(res, authResponse)
        }
        return
      } else if (auth.simpleResponses === true && authResponse.isAuthorized !== true) {
        // simple format authorizer
        setUnauthorized(res)
        return
      } else if (auth.simpleResponses === false &&
                 (!authResponse.policyDocument ||
                  !authResponse.policyDocument.Statement ||
                  !authResponse.policyDocument.Statement[0] ||
                  authResponse.policyDocument.Statement[0].Effect !== 'Allow')) {
        // no allow in response
        setUnauthorized(res)
        return
      }
    }
    // invoke the handler lambda
    const response = await invokeHandler(routeHandler.path, routeHandler.method, req, invokeOpts)

    // strip off secure so we can re-send via http
    if (response.headers && response.headers['set-cookie'] !== undefined && Array.isArray(response.headers['set-cookie'])) {
      const setCookie = response.headers['set-cookie'].map((cookie) => {
        return cookie.replace('; Secure', '')
      })
      response.headers['set-cookie'] = setCookie
    }

    // Respond to HTTP request
    res
      .status(response.statusCode)
      .set(response.headers)
      .end(response.body)
  }
}

function setUnauthorized (res) {
  res
    .status(401)
    .set(jsonContentType)
    .end(JSON.stringify({
      message: 'Unauthorized'
    }))
}

function setError (res, authResponse) {
  res
    .status(500)
    .set(jsonContentType)
    .end(JSON.stringify({
      message: authResponse
    }))
}

async function invokeHandler (handlerName, handlerMethod, req, opts) {
  console.log(`Calling ${handlerName}.${handlerMethod}`)

  const handlerFunc = require(handlerName)

  const logReq = {
    headers: req.headers,
    url: req.url,
    method: req.method,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body
  }
  console.log('REQ')
  console.log(util.inspect(logReq))

  const firstQM = req.originalUrl.indexOf('?')
  const rawPath = (firstQM < 0) ? req.originalUrl : req.originalUrl.substring(0, firstQM)
  const rawQueryString = (firstQM > 0) ? req.originalUrl.substring(firstQM + 1) : undefined

  try {
    // we have to re-encode the body
    let body
    // in Express req._body is set to true when there is an actual body
    // if there isn't we need to set body to null to match aws expectations
    if (!req._body === true) {
      body = null
    } else if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      body = Buffer.from(querystring.stringify(req.body)).toString('base64')
    } else {
      body = JSON.stringify(req.body)
    }

    let cookies = []
    if (req.headers.cookie) {
      cookies = req.headers.cookie.split('; ')
    }

    let lambdaEvent = {
      headers: req.headers, // Pass on request headers
      body: body, // Pass on request body
      cookies: cookies,
      requestContext: {
        authorizer: '',
        http: {
          method: req.method
        }
      },
      queryStringParameters: req.query,
      pathParameters: req.params,
      rawPath: rawPath,
      rawQueryString: rawQueryString
    }

    // is this an auth event?
    if (opts.auth) {
      if (opts.auth.type === 'token') {
        lambdaEvent = {
          type: 'TOKEN',
          authorizationToken: req.headers ? req.headers.authorization : undefined,
          methodArn: handlerMethod
        }
      } else {
        lambdaEvent.type = 'REQUEST'
      }
    }

    const lambdaRequest = {
      lambdaFunc: handlerFunc,
      lambdaHandler: handlerMethod,
      timeoutMs: opts.timeoutMs || 3000,
      event: lambdaEvent,
      envfile: path.join(__dirname, '.env')
    }

    const result = await lambdaLocal.execute(lambdaRequest)

    return result
  } catch (error) {
    console.log(error)

    return error
  }
}
