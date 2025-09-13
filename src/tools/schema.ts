import {z} from 'zod'

export const classInputSchema = z.object({
    projectPath: z
        .string()
        .describe('Absolute path to project directory (Automatically detected when using vscode with copilot)')
        .optional(),
    targetClass: z.string().describe('Target class name (e.g., "StateManager")'),
    depth: z
        .number()
        .min(1)
        .max(10)
        .describe('Relationship depth to analyze (1=direct only, 2=second level, etc.)')
        .default(1),
    includeInterfaces: z.boolean().describe('Include interfaces that the class implements').default(true),
    includeComposes: z.boolean().describe('Include classes that are composed within this class').default(false),
    includeUsages: z.boolean().describe('Include classes that use this class').default(true),
    includePrivate: z.boolean().describe('Include private members').default(false),
    excludePatterns: z
        .array(z.string())
        .optional()
        .describe('Glob patterns to exclude files or directories (e.g., "**/test/**", "**/*.spec.*")')
        .default(['**/test/**', '**/spec/**', '**/__tests__/**', '**/stories/**', '**/*.test.*', '**/*.spec.*']),
    language: z.enum(['en', 'ko']).describe('Language for prompts and output (en=English, ko=Korean)').default('en'),
})
export type ClassInputSchema = z.infer<typeof classInputSchema>
