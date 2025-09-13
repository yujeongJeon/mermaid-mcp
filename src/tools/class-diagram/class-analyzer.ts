/* eslint-disable no-console */
import fs from 'fs/promises'
import path from 'path'

import {Project, ScriptTarget, type SourceFile} from 'ts-morph'

async function scanProjectFiles(projectPath: string, excludePatterns: string[]): Promise<SourceFile[]> {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json')
    let project: Project

    try {
        await fs.access(tsConfigPath)
        project = new Project({
            tsConfigFilePath: tsConfigPath,
            skipAddingFilesFromTsConfig: true,
        })
    } catch {
        project = new Project({
            compilerOptions: {
                allowJs: true,
                target: ScriptTarget.ESNext,
            },
            skipAddingFilesFromTsConfig: true,
        })
    }

    const defaultExcludes = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.*/**']
    const allExcludes = [...defaultExcludes, ...excludePatterns]

    project.addSourceFilesAtPaths([
        path.join(projectPath, '**/*.{js,jsx,ts,tsx}'),
        ...allExcludes.map((pattern) => `!${path.join(projectPath, pattern)}`),
    ])

    const sourceFiles = project.getSourceFiles()
    return sourceFiles
}

export async function findTargetClass(
    projectPath: string,
    targetClassName: string,
    excludePatterns: string[],
): Promise<{filePath: string; relativePath: string} | null> {
    const sourceFiles = await scanProjectFiles(projectPath, excludePatterns)
    console.error(`Scanning ${sourceFiles.length} files for class "${targetClassName}"...`)

    for (const sourceFile of sourceFiles) {
        try {
            const classDeclarations = sourceFile.getClasses()

            const found = classDeclarations.some((classDecl) => classDecl.getName() === targetClassName)

            if (found) {
                console.error(`Successfully found class "${targetClassName}" in ${sourceFile.getFilePath()}`)
                return {
                    filePath: sourceFile.getFilePath(),
                    relativePath: path.relative(process.cwd(), sourceFile.getFilePath()),
                }
            }
        } catch (error) {
            console.error(`Failed to check ${sourceFile.getFilePath()}:`, error.message)
        }
    }

    return null
}
