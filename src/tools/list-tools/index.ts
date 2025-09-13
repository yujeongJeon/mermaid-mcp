import {z} from 'zod'

import type {ToolRegistry} from '../registry.js'

export function createListToolsTool(registry: ToolRegistry) {
    return {
        name: 'list-tools',
        description: 'List all available tools and their descriptions',
        parameters: z.object({}),
        execute: async () => {
            const toolsMetadata = registry.getToolsMetadata()

            return {
                content: [
                    {
                        type: 'text',
                        text: `# Available Tools in mermaid-mcp

${toolsMetadata
    .map(
        (tool) => `## ${tool.name}

**Description:** ${tool.description}

**Parameters:**
${
    tool.parameters.length > 0
        ? tool.parameters
              .map((param) => `- \`${param.name}\` (${param.required ? 'required' : 'optional'}): ${param.description}`)
              .join('\n')
        : 'No parameters required'
}
`,
    )
    .join('\n---\n\n')}

## How to use

Each tool can be called with the specified parameters. Use the tool name and provide the required parameters to execute the tool.
`,
                    },
                ],
            }
        },
    }
}
