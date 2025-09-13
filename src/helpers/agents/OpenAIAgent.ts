import OpenAI from 'openai'

import {BaseAgent} from './BaseAgent.js'
import {DIAGRAM_GENERATION_TOOL} from './tools.js'

import type {DiagramResult} from './types.js'

export class OpenAIAgent extends BaseAgent {
    async callAPI(systemPrompt: string, userPrompt: string): Promise<DiagramResult> {
        if (!this.apiKey) {
            throw new Error('OpenAI API key is required but not provided')
        }

        const openai = new OpenAI({apiKey: this.apiKey})

        const completion = await openai.chat.completions.create({
            model: this.model,
            messages: [
                {role: 'system', content: systemPrompt},
                {role: 'user', content: userPrompt},
            ],
            max_tokens: 4000,
            tools: [
                {
                    type: 'function',
                    function: {
                        name: DIAGRAM_GENERATION_TOOL.name,
                        description: DIAGRAM_GENERATION_TOOL.description,
                        parameters: DIAGRAM_GENERATION_TOOL.parameters,
                    },
                },
            ],
            tool_choice: {type: 'function', function: {name: DIAGRAM_GENERATION_TOOL.name}},
        })

        const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
        if (!toolCall || toolCall.type !== 'function' || toolCall.function.name !== DIAGRAM_GENERATION_TOOL.name) {
            throw new Error('Expected function call response from OpenAI API')
        }

        try {
            return JSON.parse(toolCall.function.arguments) as DiagramResult
        } catch (error) {
            throw new Error(`Failed to parse function arguments from OpenAI API: ${error}`)
        }
    }
}
