const lambdaLocal = require('lambda-local')

jest.mock('lambda-local', () => {
  const lambdaLocal = {
    execute: jest.fn()
  }
  return lambdaLocal
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
const res = {
  status: jest.fn(() => {
    const set = {
      set: jest.fn(() => {
        const end = {
          end: jest.fn(() => {
          })
        }
        return end
      })
    }
    return set
  })
}

describe('lambda-invoker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('can get an invoker', () => {
    const auth = {
      hasAuthorizer: false
    }
    const routeHandler = {
      name: './handlers/v1/index.testGet',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
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
        body: {}
      })

    const auth = {
      hasAuthorizer: false
    }
    const invokeOpts = {
    }
    const routeHandler = {
      name: './handlers/v1/index.testGet',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    await invoker(req, res)
  })

  it('can call an invoker with object auth response authorized', async () => {
    lambdaLocal.execute
      .mockReturnValueOnce({
        isAuthorized: true
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        body: {}
      })

    const authHandler = {
      name: './handlers/v1/index.simpleAuthorizer',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
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
      name: './handlers/v1/index.testGet',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    await invoker(req, res)
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
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        body: {}
      })

    const authHandler = {
      name: './handlers/v1/index.simpleAuthorizer',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
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
      name: './handlers/v1/index.testGet',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    await invoker(req, res)
  })

  it('can call an invoker with object auth response unauthorized', async () => {
    lambdaLocal.execute
      .mockReturnValueOnce({
        isAuthorized: false
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        body: {}
      })

    const authHandler = {
      name: './handlers/v1/index.simpleAuthorizer',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
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
      name: './handlers/v1/index.testGet',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    await invoker(req, res)
  })

  it('can call an invoker with string auth response unauthorized', async () => {
    lambdaLocal.execute
      .mockReturnValueOnce('Unauthorized')
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        body: {}
      })

    const authHandler = {
      name: './handlers/v1/index.simpleAuthorizer',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
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
      name: './handlers/v1/index.testGet',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    await invoker(req, res)
  })

  it('can call an invoker with string auth response authorized', async () => {
    lambdaLocal.execute
      .mockReturnValueOnce('authorized')
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        body: {}
      })

    const authHandler = {
      name: './handlers/v1/index.simpleAuthorizer',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
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
      name: './handlers/v1/index.testGet',
      path: 'S:\\Workspaces\\sam-local-express\\handlers\\v1\\index',
      method: 'testGet'
    }
    const invoker = lambdaInvoker.getInvoker(auth, routeHandler, invokeOpts)

    await invoker(req, res)
  })
})
