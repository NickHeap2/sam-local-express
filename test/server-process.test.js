const express = require('express')

jest.mock('express', () => {
  return jest.fn(() => {
    return {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
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

const templateParser = require('../lib/template-parser')
const serverProcess = require('../lib/server-process')

describe('server-process', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should serve a no apis template', () => {
    const parseResult = templateParser.parseFile('./test/templates/no-apis.yaml')
    expect(parseResult).toBeDefined()
    parseResult.singlePort = 'true'
    parseResult.basePort = 3000

    const servers = serverProcess.startServer(parseResult)
    expect(servers.length).toBe(0)
  })

  it('should serve an api with no stage', () => {
    const parseResult = templateParser.parseFile('./test/templates/api-no-stage.yaml')
    expect(parseResult).toBeDefined()
    parseResult.singlePort = 'true'
    parseResult.basePort = 3000

    const servers = serverProcess.startServer(parseResult)
    expect(servers.length).toBe(1)
    expect(servers[0].listen).toHaveBeenCalledTimes(1)
  })

  it('should serve an api with missing handler', () => {
    const parseResult = templateParser.parseFile('./test/templates/api-missing-handler.yaml')
    expect(parseResult).toBeDefined()
    parseResult.singlePort = 'true'
    parseResult.basePort = 3000

    const servers = serverProcess.startServer(parseResult)
    expect(servers.length).toBe(1)
    expect(servers[0].listen).toHaveBeenCalledTimes(1)
  })

  it('should serve a complex template on single port', () => {
    const parseResult = templateParser.parseFile('./template.yaml')
    expect(parseResult).toBeDefined()
    parseResult.singlePort = true
    parseResult.basePort = 3000

    const servers = serverProcess.startServer(parseResult)
    expect(servers.length).toBe(1)
    expect(servers[0].listen).toHaveBeenCalledTimes(1)
  })

  it('should serve a complex template on multiple ports', () => {
    const parseResult = templateParser.parseFile('./template.yaml')
    expect(parseResult).toBeDefined()
    parseResult.singlePort = false
    parseResult.basePort = 3000

    const servers = serverProcess.startServer(parseResult)
    expect(servers.length).toBe(5)
    expect(servers[0].listen).toHaveBeenCalledTimes(1)
    expect(servers[1].listen).toHaveBeenCalledTimes(1)
    expect(servers[2].listen).toHaveBeenCalledTimes(1)
    expect(servers[3].listen).toHaveBeenCalledTimes(1)
    expect(servers[4].listen).toHaveBeenCalledTimes(1)
  })
})
