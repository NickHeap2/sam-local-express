const templateParser = require('../lib/template-parser')

describe('template-parser', () => {

  it('should parse a template', () => {
    const result = templateParser.parseFile('./test/templates/simple-api.yaml')
    expect(result).toBeDefined()
  })
})