const templateLoader = require('../lib/template-loader')
const templateParser = require('../lib/template-parser')

global.console = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

describe('template-parser', () => {
  it('should parse a no apis template', () => {
    const template = templateLoader.loadFile('./tests/templates/no-apis.yaml')
    const result = templateParser.parseTemplate(template)
    expect(result).toBeDefined()
  })

  it('should parse an api with no stage template', () => {
    const template = templateLoader.loadFile('./tests/templates/api-no-stage.yaml')
    const result = templateParser.parseTemplate(template)
    expect(result).toBeDefined()
  })

  it('should parse a complex template', () => {
    const template = templateLoader.loadFile('./template.yaml')
    const result = templateParser.parseTemplate(template)
    expect(result).toBeDefined()
  })

  it('should parse api path', () => {
    const template = templateLoader.loadFile('./template.yaml')
    const result = templateParser.parseTemplate(template)
    expect(result).toBeDefined()
    expect(result).toHaveProperty('apis[0].routes[1].path')
    expect(result.apis[0].routes[1].path).toEqual('/{pathParam1}/test/{pathParam2}/testagain')
  })
})
