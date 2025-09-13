import {AnthropicAgent} from './AnthropicAgent.js'
import {LLM_CONFIG} from './configs/llm-configs.js'
import {OpenAIAgent} from './OpenAIAgent.js'

import type {DiagramAgent} from './types.js'

export function createAgent(): DiagramAgent {
    const config = LLM_CONFIG
    switch (config.provider) {
        case 'anthropic':
            return new AnthropicAgent(config.apiKey, config.model)
        case 'openai':
            return new OpenAIAgent(config.apiKey, config.model)
        default:
            throw new Error(`Unsupported LLM provider: ${config.provider}. Supported providers: anthropic, openai`)
    }
}
