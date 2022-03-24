const templateLoader = require('../lib/template-loader')

global.console = {
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}

describe('template-parser', () => {
  it('should not load a missing file', () => {
    const template = templateLoader.loadFile('./not-a-file.yaml')
    expect(template).toBeUndefined()
  })

  it('should load a no apis template', () => {
    const template = templateLoader.loadFile('./tests/templates/no-apis.yaml')
    expect(template).toBeDefined()
  })

  it('should load an api with no stage template', () => {
    const template = templateLoader.loadFile('./tests/templates/api-no-stage.yaml')
    expect(template).toBeDefined()
  })

  it('should load a complex template', () => {
    const template = templateLoader.loadFile('./template.yaml')
    expect(template).toBeDefined()
  })

  it('should load an empty yaml template', () => {
    const template = templateLoader.loadFile('./tests/templates/empty.notyaml')
    expect(template).toBeUndefined()
  })

  it('should load not valid yaml template', () => {
    const template = templateLoader.loadFile('./tests/templates/not-valid.notyaml')
    expect(template).toBeUndefined()
  })

  it('should replace docker urls with localhost', () => {
    const template = templateLoader.loadFile('./template.yaml')
    expect(template).toBeDefined()
    expect(template).toHaveProperty('Mappings.Environments.local.DependencyUrl')
    expect(template.Mappings.Environments.local.DependencyUrl).toEqual('http://localhost:3001/local/dependency')
    expect(template).toHaveProperty('Mappings.Environments.qa.DependencyUrl')
    expect(template.Mappings.Environments.qa.DependencyUrl).toEqual('http://localhost:3001/qa/dependency')
  })
})
