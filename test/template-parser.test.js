const templateParser = require('../lib/template-parser')

global.console = {
  warn: jest.fn(),
  error: jest.fn()
}

describe('template-parser', () => {
  it('should parse a no apis template', () => {
    const result = templateParser.parseFile('./test/templates/no-apis.yaml')
    expect(result).toBeDefined()
  })

  it('should parse an api with no stage template', () => {
    const result = templateParser.parseFile('./test/templates/api-no-stage.yaml')
    expect(result).toBeDefined()
  })

  it('should parse a complex template', () => {
    const result = templateParser.parseFile('./template.yaml')
    expect(result).toBeDefined()
  })

  it('should detect not valid yaml template', () => {
    const result = templateParser.parseFile('./test/templates/not-valid.yaml')
    expect(result).toBeUndefined()
  })
})
