const mockCommander = {
  opts: {
  }
}

global.console = {
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn()
}

const mockNodemon = jest.fn()

const noneExistingFile = './tests/templates/this-file-does-not-exist.yaml'
const existingFile = './tests/templates/no-apis.yaml'

let mockExit
let mockExistsSync

describe('index', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetModules()

    const process = require('process')
    delete process.env.npm_package_version

    mockExit = jest.spyOn(process, 'exit').mockImplementation((exitCode) => {
      throw new Error(exitCode)
    })

    const fs = require('fs')
    mockExistsSync = jest.spyOn(fs, 'existsSync')

    jest.mock('commander', () => {
      mockCommander.program = {
      }
      mockCommander.program.name = jest.fn(() => {
        return mockCommander.program
      })
      mockCommander.program.version = jest.fn(() => {
        return mockCommander.program
      })
      mockCommander.program.requiredOption = jest.fn(() => {
        return mockCommander.program
      })
      mockCommander.program.option = jest.fn(() => {
        return mockCommander.program
      })
      mockCommander.program.parse = jest.fn(() => {
        return mockCommander.program
      })
      mockCommander.program.opts = jest.fn(() => {
        return mockCommander.opts
      })
      return mockCommander
    })

    jest.mock('nodemon', () => {
      mockNodemon.callbacks = []
      mockNodemon.mockImplementation(() => {
        for (const callback of mockNodemon.callbacks) {
          if (callback.event === 'restart') {
            callback.callbackFunction()
            callback.callbackFunction(['fileone.js', 'filetwo.js'])
          } else {
            callback.callbackFunction()
          }
        }
      })
      mockNodemon.on = jest.fn().mockImplementation((event, callbackFunction) => {
        mockNodemon.callbacks.push({ event, callbackFunction })
        return mockNodemon
      })
      return mockNodemon
    })
  })

  afterAll(() => {
    mockExit.mockRestore()
  })

  it('can check for none existing template', async () => {
    mockCommander.opts = {
      template: noneExistingFile,
      extensions: undefined,
      singleport: undefined,
      baseport: undefined,
      noauth: undefined
    }

    await require('../lib/index')

    expect(mockExistsSync).toHaveBeenLastCalledWith(noneExistingFile)

    expect(mockCommander.program.name).toBeCalledTimes(1)
    expect(mockCommander.program.name).toBeCalledWith('sam-local-express')

    expect(mockCommander.program.version).toBeCalledTimes(1)

    expect(mockCommander.program.requiredOption).toBeCalledTimes(1)
    expect(mockCommander.program.option).toBeCalledTimes(4)

    expect(mockCommander.program.parse).toBeCalledTimes(1)

    expect(mockCommander.program.opts).toBeCalledTimes(1)

    expect(mockExit).toBeCalledTimes(1)
    expect(mockExit).toBeCalledWith(1)

    expect(mockNodemon).toBeCalledTimes(0)
  })

  it('can check for existing template', async () => {
    mockCommander.opts = {
      template: existingFile,
      extensions: undefined,
      singleport: undefined,
      baseport: undefined,
      noauth: undefined
    }

    await require('../lib/index')

    expect(mockExistsSync).toHaveBeenLastCalledWith(existingFile)

    expect(mockCommander.program.name).toBeCalledTimes(1)
    expect(mockCommander.program.name).toBeCalledWith('sam-local-express')

    expect(mockCommander.program.version).toBeCalledTimes(1)

    expect(mockCommander.program.requiredOption).toBeCalledTimes(1)
    expect(mockCommander.program.option).toBeCalledTimes(4)

    expect(mockCommander.program.parse).toBeCalledTimes(1)

    expect(mockCommander.program.opts).toBeCalledTimes(1)

    expect(mockNodemon).toBeCalledTimes(1)

    expect(mockExit).toBeCalledTimes(1)
    expect(mockExit).toBeCalledWith(0)
  })
})
