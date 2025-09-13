import z from 'zod'

export interface LLMConfig {
    provider: 'openai' | 'anthropic'
    apiKey: string
    model: string
}

const LLMConfigSchema = z.object({
    provider: z.enum(['openai', 'anthropic']),
    apiKey: z.string().min(1, 'LLM API key is required'),
    model: z.string().min(1, 'LLM model is required'),
})

function getLLMConfigFromEnv() {
    try {
        const provider = process.env.MCP_LLM_PROVIDER || process.env.provider
        let apiKey = ''
        if (provider === 'openai') {
            apiKey = process.env.OPENAI_API_KEY || process.env.MCP_LLM_API_KEY || process.env.apiKey || ''
        } else if (provider === 'anthropic') {
            apiKey = process.env.ANTHROPIC_API_KEY || process.env.MCP_LLM_API_KEY || process.env.apiKey || ''
        }
        const model = process.env.MCP_LLM_MODEL || process.env.model || ''
        return LLMConfigSchema.parse({provider, apiKey, model})
    } catch (error) {
        if (error instanceof z.ZodError) {
            const issues = error.issues.map((issue) => {
                switch (issue.path[0]) {
                    case 'provider':
                        return `Provider: ${issue.message}. Supported values: 'openai' or 'anthropic'...`
                    case 'apiKey':
                        return `API Key: ${issue.message}. Set OPENAI_API_KEY/ANTHROPIC_API_KEY...`
                    case 'model':
                        return `Model: ${issue.message}. Set MCP_LLM_MODEL or model...`
                    default:
                        return `Configuration error at ${issue.path.join('.')}: ${issue.message}`
                }
            })

            throw new Error(`LLM configuration error:\n${issues.join('\n')}`)
        }
        throw error
    }
}

export const LLM_CONFIG: LLMConfig = getLLMConfigFromEnv() as LLMConfig
