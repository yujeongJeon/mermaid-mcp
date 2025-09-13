export const DIAGRAM_GENERATION_TOOL = {
    name: 'generate_class_diagram',
    description: 'Generate a mermaid class diagram with summary',
    parameters: {
        type: 'object' as const,
        properties: {
            mermaidDiagram: {
                type: 'string',
                description: 'Complete mermaid class diagram code starting with classDiagram',
            },
            summary: {
                type: 'string',
                description: 'Brief summary of the class relationships shown in the diagram',
            },
        },
        required: ['mermaidDiagram', 'summary'],
    },
}
