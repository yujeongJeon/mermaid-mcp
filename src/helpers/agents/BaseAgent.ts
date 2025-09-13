import {getClassDiagramPrompts} from './prompts/class-diagram.js'

import type {DiagramAgent, DiagramOptions, DiagramResult, PromptSet} from './types.js'
import type {Analysis} from '../../types.js'

export abstract class BaseAgent implements DiagramAgent {
    protected apiKey: string
    protected model: string

    constructor(apiKey: string, model: string) {
        this.apiKey = apiKey
        this.model = model
    }

    async generateDiagram(analysis: Analysis, options: DiagramOptions): Promise<DiagramResult> {
        const prompts = this.getPrompts(options)
        const userPrompt = this.buildUserPrompt(analysis, options, prompts)

        return this.callAPI(prompts.systemPrompt, userPrompt)
    }

    protected getPrompts(options: DiagramOptions): PromptSet {
        return getClassDiagramPrompts(options.language, options.targetClass)
    }

    protected buildUserPrompt(analysis: Analysis, options: DiagramOptions, prompts: PromptSet): string {
        return `${prompts.userPrefix}

Target Class: ${options.targetClass}

Relationships:
${JSON.stringify(analysis.relationships, null, 2)}

Class Information:
${JSON.stringify(
    {
        targetClass: analysis.targetClass,
        relatedClasses: analysis.relatedClasses,
    },
    null,
    2,
)}`
    }

    // eslint-disable-next-line no-unused-vars
    protected abstract callAPI(systemPrompt: string, userPrompt: string): Promise<DiagramResult>
}
