// eslint-disable-next-line no-unused-vars
const express = require('express')

jest.mock('express', () => {
  return jest.fn(() => {
    const serverMock = {
      routes: []
    }
    return {
      routes: serverMock.routes,
      get: jest.fn((path) => {
        serverMock.routes.push(path)
      }),
      post: jest.fn((path) => {
        serverMock.routes.push(path)
      }),
      delete: jest.fn((path) => {
        serverMock.routes.push(path)
      }),
      use: jest.fn(),
      listen: jest.fn()
    }
  })
})

global.console = {
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn()
}

const templateLoader = require('../lib/template-loader')
const templateParser = require('../lib/template-parser')
const serverProcess = require('../lib/server-process')

describe('server-process', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should serve a no apis template', () => {
    const template = templateLoader.loadFile('./tests/templates/no-apis.yaml')
    const parseResult = templateParser.parseTemplate(template)
    expect(parseResult).toBeDefined()
    parseResult.parameters = {
      singlePort: true,
      basePort: 3000
    }

    const servers = serverProcess.startServer(parseResult)
    expect(servers.length).toBe(0)
  })

  it('should serve an api with no stage', () => {
    const template = templateLoader.loadFile('./tests/templates/api-no-stage.yaml')
    const parseResult = templateParser.parseTemplate(template)

    expect(parseResult).toBeDefined()
    parseResult.parameters = {
      singlePort: true,
      basePort: 3000
    }

    const servers = serverProcess.startServer(parseResult)
    expect(servers.length).toBe(1)
    expect(servers[0].listen).toHaveBeenCalledTimes(1)
  })

  it('should serve an api with missing handler', () => {
    const template = templateLoader.loadFile('./tests/templates/api-missing-handler.yaml')
    const parseResult = templateParser.parseTemplate(template)

    expect(parseResult).toBeDefined()
    parseResult.parameters = {
      singlePort: true,
      basePort: 3000
    }

    const servers = serverProcess.startServer(parseResult)
    expect(servers.length).toBe(1)
    expect(servers[0].listen).toHaveBeenCalledTimes(1)
  })

  it('should serve a complex template on single port', () => {
    const template = templateLoader.loadFile('./template.yaml')
    const parseResult = templateParser.parseTemplate(template)

    expect(parseResult).toBeDefined()
    parseResult.parameters = {
      singlePort: true,
      basePort: 3000
    }

    const servers = serverProcess.startServer(parseResult)
    expect(servers.length).toBe(1)
    expect(servers[0].listen).toHaveBeenCalledTimes(1)

    expect(servers[0].routes[0]).toEqual('/v1/:pathParam/test/')
    expect(servers[0].routes[1]).toEqual('/v1/:pathParam1/test/:pathParam2/testagain')
    expect(servers[0].routes[2]).toEqual('/v1/test')
    expect(servers[0].routes[3]).toEqual('/v1/test')
    expect(servers[0].routes[4]).toEqual('/v1/proxy/:proxy*')
    expect(servers[0].routes[5]).toEqual('/v2/test')
    expect(servers[0].routes[6]).toEqual('/v2/test')
    expect(servers[0].routes[7]).toEqual('/v2/scheduled')
    expect(servers[0].routes[8]).toEqual('/v3/test')
    expect(servers[0].routes[9]).toEqual('/v5/test')
  })

  it('should serve a complex template on multiple ports', () => {
    const template = templateLoader.loadFile('./template.yaml')
    const parseResult = templateParser.parseTemplate(template)

    expect(parseResult).toBeDefined()
    parseResult.parameters = {
      singlePort: false,
      basePort: 3000
    }

    const servers = serverProcess.startServer(parseResult)
    expect(servers.length).toBe(5)
    expect(servers[0].listen).toHaveBeenCalledTimes(1)
    expect(servers[1].listen).toHaveBeenCalledTimes(1)
    expect(servers[2].listen).toHaveBeenCalledTimes(1)
    expect(servers[3].listen).toHaveBeenCalledTimes(1)
    expect(servers[4].listen).toHaveBeenCalledTimes(1)
  })
})
