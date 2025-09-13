import type {Analysis} from '../../types.js'

export interface DiagramResult {
    mermaidDiagram: string
    summary: string
}

export interface DiagramOptions {
    targetClass: string
    language: 'en' | 'ko'
}

export interface DiagramAgent {
    // eslint-disable-next-line no-unused-vars
    generateDiagram(analysis: Analysis, options: DiagramOptions): Promise<DiagramResult>
}

export interface PromptSet {
    systemPrompt: string
    userPrefix: string
}
