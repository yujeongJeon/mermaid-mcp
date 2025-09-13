/* eslint-disable no-console */
import {findTargetClass} from './class-analyzer.js'
import {ClassRelationShipAnalyzer} from './class-relationship-analyzer.js'
import {createAgent} from '../../helpers/agents/AgentFactory.js'
import {getProjectRoot} from '../../helpers/git/GitUtils.js'

import type {ClassInputSchema} from '../schema.js'

export async function executeClassDiagram(params: ClassInputSchema) {
    try {
        console.error(`Searching for class "${params.targetClass}"...`)

        const rootPath = params.projectPath || (await getProjectRoot())
        const targetClassFile = await findTargetClass(rootPath, params.targetClass, params.excludePatterns)

        if (!targetClassFile) {
            throw new Error(`Class "${params.targetClass}" not found in project`)
        }

        console.error(`Found target class in: ${targetClassFile.relativePath}`)

        const analysis = await ClassRelationShipAnalyzer.create(rootPath, {
            depth: params.depth,
            includeInterfaces: params.includeInterfaces,
            includeComposes: params.includeComposes,
            includeUsages: params.includeUsages,
            includePrivate: params.includePrivate,
            excludePatterns: params.excludePatterns,
        }).analyzeDirectRelationships(targetClassFile, params.targetClass)

        console.error(`Found ${analysis.relatedClasses.length} directly related classes`)

        const agent = createAgent()
        const diagram = await agent.generateDiagram(analysis, {
            targetClass: params.targetClass,
            language: params.language,
        })

        return {
            content: [
                {
                    type: 'text',
                    text: `# ${params.targetClass} Class Diagram

## Generated Diagram
\`\`\`mermaid
${diagram.mermaidDiagram}
\`\`\`

## Summary
${diagram.summary}

## Analysis Details
- **Target Class**: ${params.targetClass}
- **Source File**: ${targetClassFile.relativePath}
- **Direct Relationships**: ${analysis.relationships.length}
- **Related Classes**: ${analysis.relatedClasses.length}

## Relationships
${analysis.relationships.map((rel) => `- ${rel.from} ${rel.type} ${rel.to}`).join('\n')}
`,
                },
            ],
        }
    } catch (error) {
        throw new Error(`Failed to generate class diagram: ${error.message}`)
    }
}
