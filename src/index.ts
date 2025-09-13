#!/usr/bin/env node
import {FastMCP} from 'fastmcp'

import {executeClassDiagram} from './tools/class-diagram/index.js'
import {classInputSchema} from './tools/schema.js'

const server = new FastMCP({
    name: 'mermaid-mcp',
    version: '1.0.0',
    logger: console,
})

server.addTool({
    name: 'generate-class-diagram',
    description: 'Generate class diagram showing direct relationships of target class only',
    parameters: classInputSchema,
    execute: executeClassDiagram,
})

server.start({
    transportType: 'stdio',
})
