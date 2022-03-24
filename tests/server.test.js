const process = require('process')
const mockExit = jest.spyOn(process, 'exit').mockImplementation((exitCode) => {
  throw new Error(exitCode)
})

global.console = {
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn()
}

let oldArgs
describe('server', () => {
  beforeAll(() => {
    oldArgs = process.argv
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(() => {
    process.argv = oldArgs
  })

  it('can fail for none existing template', () => {
    process.argv = [
      'node',
      'script',
      'filename',
      'true',
      '3000'
    ]

    jest.isolateModules(() => {
      const templateLoader = require('../lib/template-loader')
      const mockLoadFile = jest.spyOn(templateLoader, 'loadFile')

      mockLoadFile.mockReturnValueOnce(undefined)

      expect(() => {
        require('../lib/server')
      }).toThrow()

      expect(mockExit).toBeCalledTimes(1)
    })
  })

  it('can succeed for existing template', () => {
    process.argv = [
      'node',
      'script',
      'filename',
      'true',
      'aaa'
    ]

    jest.isolateModules(() => {
      const templateLoader = require('../lib/template-loader')
      const mockLoadFile = jest.spyOn(templateLoader, 'loadFile')

      const templateParser = require('../lib/template-parser')
      const mockParseTemplate = jest.spyOn(templateParser, 'parseTemplate')

      const serverProcess = require('../lib/server-process')
      const mockStartServer = jest.spyOn(serverProcess, 'startServer').mockImplementation(() => {})

      mockLoadFile.mockReturnValueOnce({})
      mockParseTemplate.mockReturnValueOnce({
        globalEnvVars: [],
        globalCors: {
          corsConfiguration: {
          }
        },
        apis: [
          {
            name: 'myApi'
          }
        ]
      })

      const server = require('../lib/server')
      expect(server).toBeDefined()

      expect(mockExit).toBeCalledTimes(0)
      expect(mockStartServer).toHaveBeenCalledTimes(1)
    })
  })
})
