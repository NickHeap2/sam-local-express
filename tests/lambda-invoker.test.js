const lambdaLocal = require('lambda-local')
const path = require('path')

jest.mock('lambda-local', () => {
  const lambdaLocalMock = {
    execute: jest.fn()
  }
  return lambdaLocalMock
})

global.console = {
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn()
}

const lambdaInvoker = require('../lib/lambda-invoker')

const req = {
  headers: {
    host: 'localhost:4000',
    accept: 'application/xml'
  },
  url: '/v5/test',
  method: 'GET',
  baseUrl: '',
  originalUrl: '/v5/test',
  params: {},
  query: {},
  body: {}
}

const postReq = {
  headers: {
    host: 'localhost:4000',
    accept: 'application/xml',
    'content-type': 'application/x-www-form-urlencoded'
  },
  url: '/v5/test',
  method: 'POST',
  baseUrl: '',
  originalUrl: '/v5/test',
  params: {},
  query: {},
  body: {}
}

const mockResponse = () => {
  const response = {
    statusCode: undefined
  }
  response.status = jest.fn().mockImplementation((statusCode) => {
    response.statusCode = statusCode
    return response
  })
  response.json = jest.fn().mockReturnValue(response)
  response.set = jest.fn().mockReturnValue(response)
  response.end = jest.fn().mockReturnValue(response)
  return response
}

const testGetHandlerName = './handlers/v1/index.testGet'
const testGetHandlerPath = path.join(__dirname, '../handlers/v1/index')

const simpleAuthorizerHandlerName = './handlers/v1/index.simpleAuthorizer'

describe('lambda-invoker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('can get an invoker', () => {
    const auth = {
      hasAuthorizer: false
    }
    const routeHandler = {
      name: testGetHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler)
    expect(invoker).toBeDefined()
  })

  it('can call an invoker without auth', async () => {
    lambdaLocal.execute
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        body: JSON.stringify({})
      })

    const auth = {
      hasAuthorizer: false
    }
    const invokeOpts = {
    }
    const routeHandler = {
      name: testGetHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    const res = mockResponse()

    await invoker(req, res)
    expect(res.statusCode).toEqual(200)
  })

  it('can call an invoker without auth for post', async () => {
    lambdaLocal.execute
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        body: JSON.stringify({})
      })

    const auth = {
      hasAuthorizer: false
    }
    const invokeOpts = {
    }
    const routeHandler = {
      name: testGetHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    const res = mockResponse()

    await invoker(postReq, res)
    expect(res.statusCode).toEqual(200)
  })

  it('can call an invoker with object auth response authorized', async () => {
    lambdaLocal.execute
      .mockReturnValueOnce({
        isAuthorized: true
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        body: JSON.stringify({})
      })

    const authHandler = {
      name: simpleAuthorizerHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const auth = {
      hasAuthorizer: true,
      simpleResponses: true,
      handler: authHandler
    }
    const invokeOpts = {
    }
    const routeHandler = {
      name: testGetHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    const res = mockResponse()

    await invoker(req, res)
    expect(res.statusCode).toEqual(200)
  })

  it('can call an invoker with object auth response authorized not simple', async () => {
    lambdaLocal.execute
      .mockReturnValueOnce({
        policyDocument: {
          Statement: [
            {
              Effect: 'Deny'
            }
          ]
        }
      })

    const authHandler = {
      name: simpleAuthorizerHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const auth = {
      hasAuthorizer: true,
      simpleResponses: false,
      handler: authHandler
    }
    const invokeOpts = {
    }
    const routeHandler = {
      name: testGetHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    const res = mockResponse()

    await invoker(req, res)
    expect(res.statusCode).toEqual(401)
  })

  it('can call an invoker with object auth response unauthorized', async () => {
    lambdaLocal.execute
      .mockReturnValueOnce({
        isAuthorized: false
      })

    const authHandler = {
      name: simpleAuthorizerHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const auth = {
      hasAuthorizer: true,
      simpleResponses: true,
      handler: authHandler
    }
    const invokeOpts = {
    }
    const routeHandler = {
      name: testGetHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    const res = mockResponse()

    await invoker(req, res)
    expect(res.statusCode).toEqual(401)
  })

  it('can call an invoker with string auth response unauthorized', async () => {
    lambdaLocal.execute
      .mockReturnValueOnce('Unauthorized')

    const authHandler = {
      name: simpleAuthorizerHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const auth = {
      hasAuthorizer: true,
      simpleResponses: true,
      handler: authHandler
    }
    const invokeOpts = {
    }
    const routeHandler = {
      name: testGetHandlerName,
      path: testGetHandlerPath,
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    const res = mockResponse()

    await invoker(req, res)
    expect(res.statusCode).toEqual(401)
  })
})
