import fs from 'fs'
import path from 'path'

import {Project} from 'ts-morph'
import * as ts from 'typescript'

export function createProject(projectPath: string): Project {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json')

    try {
        if (!fs.existsSync(tsConfigPath)) {
            throw new Error(`${tsConfigPath} not found`)
        }
        return new Project({
            tsConfigFilePath: tsConfigPath,
        })
    } catch {
        // eslint-disable-next-line no-console
        console.error('tsconfig.json not found, using default configuration with allowJs: true')
        return new Project({
            compilerOptions: {
                target: ts.ScriptTarget.ES2020,
                module: ts.ModuleKind.CommonJS as any,
                allowJs: true,
                checkJs: false,
                declaration: false,
                strict: false,
            },
        })
    }
}
