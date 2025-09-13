import Anthropic from '@anthropic-ai/sdk'

import {BaseAgent} from './BaseAgent.js'
import {DIAGRAM_GENERATION_TOOL} from './tools.js'

import type {DiagramResult} from './types.js'

export class AnthropicAgent extends BaseAgent {
    async callAPI(systemPrompt: string, userPrompt: string): Promise<DiagramResult> {
        if (!this.apiKey) {
            throw new Error('Anthropic API key is required but not provided')
        }

        const anthropic = new Anthropic({apiKey: this.apiKey})

        try {
            const message = await anthropic.messages.create({
                model: this.model,
                max_tokens: 4000,
                system: systemPrompt,
                tools: [
                    {
                        name: DIAGRAM_GENERATION_TOOL.name,
                        description: DIAGRAM_GENERATION_TOOL.description,
                        input_schema: DIAGRAM_GENERATION_TOOL.parameters,
                    },
                ],
                tool_choice: {type: 'tool', name: DIAGRAM_GENERATION_TOOL.name},
                messages: [{role: 'user', content: userPrompt}],
            })

            const toolUse = message.content.find((content) => content.type === 'tool_use')
            if (!toolUse || toolUse.name !== DIAGRAM_GENERATION_TOOL.name) {
                throw new Error('Expected tool_use response from Anthropic API')
            }

            const input = toolUse.input as {mermaidDiagram: string; summary: string}
            return input
        } catch (error) {
            if (error.name === 'SyntaxError') {
                throw new Error('Failed to parse JSON response from Anthropic API')
            }
            throw error
        }
    }
}
