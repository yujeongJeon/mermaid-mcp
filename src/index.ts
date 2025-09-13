#!/usr/bin/env node
import {FastMCP} from 'fastmcp'

import {createToolRegistry} from './tools/index.js'

const server = new FastMCP({
    name: 'mermaid-mcp',
    version: '1.0.0',
    logger: console,
})

// Create and register all tools
const registry = createToolRegistry()
registry.registerAll(server)

server.start({
    transportType: 'stdio',
})
