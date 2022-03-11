# sam-local-express
Local testing of simple AWS SAM templates via Express

## Usage

Use --help to get a list of options
``` text
Usage: template-to-express [options]

Options:
  -V, --version                  output the version number
  -t, --template <template>      Source AWS SAM template yaml filename
  -e, --extensions [extensions]  Comma separated list of file extensions to watch (default: "js,json,yaml")
  -s, --singleport               If set then all APIs will be served on a single port, use stages to separate (default: false)
  -b, --baseport [portnumber]    The base port for Express servers (default: 3000)
  -h, --help                     display help for command
```

Serve multiple APIs defined in a SAM template with Express servers starting at port 3000
``` bash
template-to-express --template template.yaml
```
![multiple](https://github.com/NickHeap2/sam-local-express/blob/123c930c7725d2927f52fde5ba69708857b65fe4/images/multiple.png)

Serve multiple APIs defined in a SAM template with Express all on port 4000
``` bash
template-to-express --template template.yaml --singleport --baseport 4000
```
![single](https://github.com/NickHeap2/sam-local-express/blob/123c930c7725d2927f52fde5ba69708857b65fe4/images/single.png)
