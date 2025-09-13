import type {FastMCP} from 'fastmcp'
import type {ZodSchema} from 'zod'

export interface ToolDefinition {
    name: string
    description: string
    parameters: ZodSchema
    execute: (_params: any) => Promise<any>
}

export class ToolRegistry {
    private tools: ToolDefinition[] = []

    register(tool: ToolDefinition): void {
        this.tools.push(tool)
    }

    registerAll(server: FastMCP): void {
        for (const tool of this.tools) {
            server.addTool({
                name: tool.name,
                description: tool.description,
                parameters: tool.parameters,
                execute: tool.execute,
            })
        }
    }

    getToolsMetadata(): Array<{
        name: string
        description: string
        parameters: Array<{
            name: string
            description: string
            required: boolean
            type: string
        }>
    }> {
        return this.tools.map((tool) => {
            const shape = (tool.parameters as any).shape || {}
            return {
                name: tool.name,
                description: tool.description,
                parameters: Object.entries(shape).map(([key, schema]: [string, any]) => ({
                    name: key,
                    description: schema.description || '',
                    required: !schema.isOptional(),
                    type: schema._def?.typeName || 'unknown',
                })),
            }
        })
    }
}
