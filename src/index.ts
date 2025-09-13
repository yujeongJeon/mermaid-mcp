#!/usr/bin/env node
/* eslint-disable no-console */
import fs from 'fs/promises'
import path from 'path'

import {FastMCP} from 'fastmcp'
import {minimatch} from 'minimatch'
import {SyntaxKind} from 'ts-morph'
import * as ts from 'typescript'
import {z} from 'zod'

import {createAgent} from './helpers/agents/AgentFactory.js'
import {getProjectRoot} from './helpers/git/GitUtils.js'
import {createProject} from './helpers/project/ProjectManager.js'

import type {Analysis, ClassInfo, Relationship} from './types.js'

const server = new FastMCP({
    name: 'mermaid-mcp',
    version: '1.0.0',
    logger: console,
})

const classInputSchema = z.object({
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
type ClassInputSchema = z.infer<typeof classInputSchema>

server.addTool({
    name: 'generate-class-diagram',
    description: 'Generate class diagram showing direct relationships of target class only',
    parameters: classInputSchema,
    execute: async (params) => {
        try {
            console.error(`Searching for class "${params.targetClass}"...`)

            const rootPath = params.projectPath || (await getProjectRoot())
            const targetClassFile = await findTargetClass(rootPath, params.targetClass, params.excludePatterns)

            if (!targetClassFile) {
                throw new Error(`Class "${params.targetClass}" not found in project`)
            }

            console.error(`Found target class in: ${targetClassFile.relativePath}`)

            const analysis = await analyzeDirectRelationships(params.projectPath, targetClassFile, params.targetClass, {
                depth: params.depth,
                includeInterfaces: params.includeInterfaces,
                includeComposes: params.includeComposes,
                includeUsages: params.includeUsages,
                includePrivate: params.includePrivate,
                excludePatterns: params.excludePatterns,
            })

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
    },
})

async function findTargetClass(projectPath: string, targetClassName: string, excludePatterns: string[]) {
    const files = await scanProjectFiles(projectPath, excludePatterns)

    for (const file of files) {
        try {
            const content = await fs.readFile(file, 'utf-8')

            if (!content.includes(`class ${targetClassName}`)) {
                continue
            }

            const sourceFile = ts.createSourceFile(
                file,
                content,
                ts.ScriptTarget.Latest,
                true,
                file.endsWith('.tsx') || file.endsWith('.jsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
            )

            let found = false

            function visit(node) {
                if (ts.isClassDeclaration(node) && node.name?.text === targetClassName) {
                    found = true
                    return
                }
                ts.forEachChild(node, visit)
            }

            visit(sourceFile)

            if (found) {
                return {
                    filePath: file,
                    relativePath: path.relative(process.cwd(), file),
                }
            }
        } catch (error) {
            console.error(`Failed to check ${file}:`, error.message)
        }
    }

    return null
}

async function analyzeDirectRelationships(
    projectPath: string,
    targetClassFile: {filePath: string; relativePath: string},
    targetClassName: string,
    options: Pick<
        ClassInputSchema,
        'depth' | 'includeInterfaces' | 'includeComposes' | 'includeUsages' | 'includePrivate' | 'excludePatterns'
    >,
) {
    const analysis: Analysis = {
        targetClass: null,
        relatedClasses: [],
        relationships: [],
    }

    console.error('Analyzing target class...')
    analysis.targetClass = await analyzeClassFile(projectPath, targetClassFile.filePath, targetClassName, options)

    if (!analysis.targetClass) {
        throw new Error(`Failed to analyze target class ${targetClassName}`)
    }

    // 합성 관계 분석 (includeComposes가 true일 때만)
    if (options.includeComposes) {
        console.error('Analyzing inheritance chain for compositions...')
        let currentClass = analysis.targetClass
        while (currentClass?.extends) {
            const parentClassFile = await findTargetClass(projectPath, currentClass.extends, options.excludePatterns)
            if (parentClassFile) {
                const parentClass = await analyzeClassFile(
                    projectPath,
                    parentClassFile.filePath,
                    currentClass.extends,
                    options,
                )
                if (parentClass) {
                    console.error(
                        `Found parent class ${currentClass.extends} with ${parentClass.compositions.length} compositions`,
                    )
                    // 부모의 합성을 상속받은 합성으로 추가 (from과 to 정보 포함)
                    parentClass.compositions.forEach((composition) => {
                        analysis.targetClass!.inheritedCompositions.push({
                            from: parentClass.name,
                            to: composition,
                        })
                    })
                    currentClass = parentClass
                } else {
                    break
                }
            } else {
                console.error(`Could not find parent class file: ${currentClass.extends}`)
                break
            }
        }

        const uniqueInheritedCompositions = new Map()
        analysis.targetClass.inheritedCompositions.forEach((comp) => {
            const key = `${comp.from}-${comp.to}`
            uniqueInheritedCompositions.set(key, comp)
        })
        analysis.targetClass.inheritedCompositions = Array.from(uniqueInheritedCompositions.values())
    }

    const allRelatedClasses = new Set<string>()
    const processedClasses = new Set<string>()

    let currentLevelClasses = new Set([targetClassName])

    for (let depth = 1; depth <= options.depth; depth++) {
        const nextLevelClasses = new Set<string>()

        console.error(`Analyzing depth ${depth} with ${currentLevelClasses.size} classes...`)

        for (const currentClassName of currentLevelClasses) {
            if (processedClasses.has(currentClassName)) {
                continue
            }
            processedClasses.add(currentClassName)

            let currentClassInfo: ClassInfo | null = null
            if (currentClassName === targetClassName) {
                currentClassInfo = analysis.targetClass
            } else {
                const classFile = await findTargetClass(projectPath, currentClassName, options.excludePatterns)
                if (classFile) {
                    currentClassInfo = await analyzeClassFile(
                        projectPath,
                        classFile.filePath,
                        currentClassName,
                        options,
                    )
                }
            }

            if (!currentClassInfo) {
                console.error(`Could not analyze class: ${currentClassName}`)
                continue
            }

            if (currentClassInfo.extends) {
                allRelatedClasses.add(currentClassInfo.extends)
                nextLevelClasses.add(currentClassInfo.extends)
            }

            if (options.includeInterfaces) {
                currentClassInfo.implements.forEach((impl) => {
                    allRelatedClasses.add(impl)
                    nextLevelClasses.add(impl)
                })
            }

            if (options.includeUsages) {
                const childClasses = await findChildClasses(projectPath, currentClassName, options.excludePatterns)
                childClasses.forEach((className) => {
                    allRelatedClasses.add(className)
                    nextLevelClasses.add(className)
                })
            }

            if (options.includeComposes) {
                currentClassInfo.compositions.forEach((composition) => {
                    allRelatedClasses.add(composition)
                    nextLevelClasses.add(composition)
                })

                if (currentClassName === targetClassName) {
                    currentClassInfo.inheritedCompositions.forEach((inheritedComponent) => {
                        allRelatedClasses.add(inheritedComponent.from)
                        allRelatedClasses.add(inheritedComponent.to)
                        nextLevelClasses.add(inheritedComponent.from)
                        nextLevelClasses.add(inheritedComponent.to)
                    })
                }
            }
        }

        currentLevelClasses = nextLevelClasses

        if (nextLevelClasses.size === 0) {
            console.error(`No more classes found at depth ${depth}, stopping early`)
            break
        }
    }

    allRelatedClasses.delete(targetClassName)

    console.error(`Analyzing ${allRelatedClasses.size} related classes...`)
    console.error('Related class names:', Array.from(allRelatedClasses))

    for (const className of allRelatedClasses) {
        console.error(`Looking for class: ${className}`)
        const classFile = await findTargetClass(projectPath, className, options.excludePatterns)
        if (classFile) {
            console.error(`Found ${className} in: ${classFile.relativePath}`)
            const classInfo = await analyzeClassFile(projectPath, classFile.filePath, className, options)
            if (classInfo) {
                analysis.relatedClasses.push(classInfo)
                console.error(`Successfully analyzed: ${className}`)
            } else {
                console.error(`Failed to analyze: ${className}`)
            }
        } else {
            console.error(`Could not find file for class: ${className}`)
        }
    }

    analysis.relationships = generateRelationships(analysis.targetClass)

    return analysis
}

async function findChildClasses(projectPath: string, targetClassName: string, excludePatterns: string[]) {
    const childClasses: string[] = []

    try {
        const project = await createProject(projectPath)

        const sourceFiles = project.getSourceFiles()

        for (const sourceFile of sourceFiles) {
            const filePath = sourceFile.getFilePath()

            const relativePath = path.relative(projectPath, filePath)
            const shouldExclude = excludePatterns.some(
                (pattern) =>
                    minimatch(relativePath, pattern, {dot: true}) ||
                    minimatch(path.basename(filePath), pattern, {dot: true}),
            )

            if (shouldExclude) {
                continue
            }

            const classes = sourceFile.getClasses()
            for (const classDecl of classes) {
                const className = classDecl.getName()
                if (!className) continue

                const extendsExpr = classDecl.getExtends()
                if (extendsExpr) {
                    const expression = extendsExpr.getExpression()

                    let baseClassName = ''

                    if (expression.getKindName() === 'Identifier') {
                        baseClassName = expression.getText()
                    } else {
                        const symbol = expression.getSymbol()
                        if (symbol) {
                            // Symbol을 통해 실제 타입명 가져오기
                            baseClassName = symbol.getName()
                        } else {
                            // Symbol 없으면 첫 번째 Identifier 사용
                            const firstIdentifier = expression.getFirstChildByKind(SyntaxKind.Identifier)
                            baseClassName = firstIdentifier?.getText() || expression.getText().split('<')[0].trim()
                        }
                    }

                    if (baseClassName === targetClassName) {
                        console.error(`Found child class: ${className} extends ${baseClassName} in ${filePath}`)
                        childClasses.push(className)
                    }
                }
            }
        }
    } catch (error) {
        console.error('Failed to analyze child classes with ts-morph:', error.message)
        return []
    }

    return [...new Set(childClasses)]
}

async function analyzeClassFile(
    projectPath: string,
    filePath: string,
    targetClassName: string,
    options: Pick<
        ClassInputSchema,
        'includeInterfaces' | 'includeComposes' | 'includeUsages' | 'includePrivate' | 'excludePatterns'
    >,
) {
    const project = await createProject(projectPath)
    const sourceFile = project.addSourceFileAtPath(filePath)

    const importedClasses = new Set<string>()
    const imports = sourceFile.getImportDeclarations()

    for (const importDecl of imports) {
        try {
            const moduleSymbol = importDecl.getModuleSpecifierSourceFile()

            if (moduleSymbol) {
                const resolvedPath = moduleSymbol.getFilePath()

                // node_modules가 아닌 프로젝트 파일만
                if (!resolvedPath.includes('node_modules')) {
                    const namedImports = importDecl.getNamedImports()
                    namedImports.forEach((namedImport) => {
                        const importName = namedImport.getName()

                        if (/^[A-Z]/.test(importName)) {
                            importedClasses.add(importName)
                        }
                    })

                    const defaultImport = importDecl.getDefaultImport()
                    if (defaultImport && /^[A-Z]/.test(defaultImport.getText())) {
                        importedClasses.add(defaultImport.getText())
                    }
                }
            }
        } catch {
            continue
        }
    }

    const classDecl = sourceFile.getClass(targetClassName)
    if (!classDecl) {
        return null
    }

    const classInfo: ClassInfo = {
        name: targetClassName,
        filePath,
        relativePath: path.relative(process.cwd(), filePath),
        isAbstract: classDecl.isAbstract(),
        isExported: classDecl.isExported(),
        extends: null,
        implements: [],
        methods: [],
        properties: [],
        compositions: [],
        inheritedCompositions: [],
    }

    // 상속 관계
    const extendsExpr = classDecl.getExtends()
    if (extendsExpr) {
        const baseClassName = extendsExpr.getExpression().getText().split('<')[0].trim()
        classInfo.extends = baseClassName
    }

    // 구현 관계
    const implementsExprs = classDecl.getImplements()
    implementsExprs.forEach((impl) => {
        const interfaceName = impl.getExpression().getText().split('<')[0].trim()
        classInfo.implements.push(interfaceName)
    })

    // 메서드 분석
    const methods = classDecl.getMethods()
    methods.forEach((method) => {
        const methodInfo = analyzeMorphMethod(method, options)
        if (methodInfo) {
            classInfo.methods.push(methodInfo)
        }
    })

    // 속성 분석
    const properties = classDecl.getProperties()
    properties.forEach((property) => {
        const propertyInfo = analyzeMorphProperty(property, options, classDecl)
        if (propertyInfo) {
            classInfo.properties.push(propertyInfo)

            // 합성 관계 분석: includeComposes가 true이고 필드 타입이 내부 클래스인 경우
            if (
                options.includeComposes &&
                propertyInfo.type &&
                isCompositionRelationship(propertyInfo, importedClasses)
            ) {
                classInfo.compositions.push(propertyInfo.type)
            }
        }
    })

    // 생성자 매개변수에서 합성 관계 분석: includeComposes가 true일 때만
    if (options.includeComposes) {
        const constructors = classDecl.getConstructors()
        constructors.forEach((constructor) => {
            const compositionsFromConstructor = analyzeMorphConstructorForComposition(
                constructor,
                importedClasses,
                classDecl,
            )
            classInfo.compositions.push(...compositionsFromConstructor)
        })
    }

    classInfo.compositions = [...new Set(classInfo.compositions)]

    return classInfo
}

function generateRelationships(targetClass: ClassInfo | null) {
    const relationships: Relationship[] = []

    // 타겟 클래스의 상속 관계
    if (targetClass?.extends) {
        relationships.push({
            type: 'extends',
            from: targetClass.name,
            to: targetClass.extends,
        })
    }

    // 타겟 클래스의 구현 관계
    targetClass?.implements.forEach((impl) => {
        relationships.push({
            type: 'implements',
            from: targetClass.name,
            to: impl,
        })
    })

    // 타겟 클래스의 합성 관계
    targetClass?.compositions.forEach((composition) => {
        relationships.push({
            type: 'composes',
            from: targetClass.name,
            to: composition,
        })
    })

    // 상속받은 합성 관계 (부모 클래스들의 합성)
    targetClass?.inheritedCompositions.forEach((composition) => {
        relationships.push({
            type: 'composes',
            from: composition.from, // 실제 소유하는 부모 클래스
            to: composition.to,
        })
    })

    // 타겟 클래스가 사용하는 타입들
    if (targetClass) {
        const usedTypes = new Set<string>()

        // 속성에서 사용하는 타입들
        targetClass.properties.forEach((prop) => {
            if (prop.type && /^[A-Z]/.test(prop.type)) {
                const excludeTypes = [
                    'string',
                    'number',
                    'boolean',
                    'Date',
                    'Array',
                    'Map',
                    'Set',
                    'Object',
                    'Function',
                    'Promise',
                ]
                if (!excludeTypes.includes(prop.type)) {
                    usedTypes.add(prop.type)
                }
            }
        })

        const existingRelations = new Set(
            [
                targetClass.extends,
                ...targetClass.implements,
                ...targetClass.compositions,
                ...targetClass.inheritedCompositions.map((comp) => comp.to),
            ].filter(Boolean),
        )

        usedTypes.forEach((type) => {
            if (!existingRelations.has(type)) {
                relationships.push({
                    type: 'uses',
                    from: targetClass.name,
                    to: type,
                })
            }
        })
    }

    return relationships
}

async function scanProjectFiles(projectPath, excludePatterns) {
    const files = []

    async function scanDirectory(dirPath) {
        const entries = await fs.readdir(dirPath, {withFileTypes: true})

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name)
            const relativePath = path.relative(projectPath, fullPath)

            const defaultExcludes = ['node_modules', '.git', 'dist', 'build']
            if (defaultExcludes.includes(entry.name) || entry.name.startsWith('.')) {
                continue
            }

            const shouldExclude = excludePatterns.some(
                (pattern) =>
                    minimatch(relativePath, pattern, {dot: true}) || minimatch(entry.name, pattern, {dot: true}),
            )

            if (entry.isDirectory() && !shouldExclude) {
                await scanDirectory(fullPath)
            } else if (entry.isFile() && /\.(js|jsx|ts|tsx)$/.test(entry.name) && !shouldExclude) {
                files.push(fullPath)
            }
        }
    }

    await scanDirectory(projectPath)
    return files
}

function analyzeMorphMethod(method, options) {
    const name = method.getName()
    if (!name) {
        return null
    }

    const scope = method.getScope()
    const isPrivate = scope === 'private' || name.startsWith('_')
    if (!options.includePrivate && isPrivate) {
        return null
    }

    return {
        name,
        visibility: scope,
        isStatic: method.isStatic(),
        isAbstract: method.isAbstract(),
    }
}

function analyzeMorphProperty(property, options, classDeclaration = null) {
    const name = property.getName()
    if (!name) {
        return null
    }

    const scope = property.getScope()
    const isPrivate = scope === 'private' || name.startsWith('_')
    if (!options.includePrivate && isPrivate) {
        return null
    }

    // 타입 정보 추출
    let type = null
    const typeNode = property.getTypeNode()
    if (typeNode) {
        const typeName = getMorphTypeFromNode(typeNode)

        // 제네릭 타입 파라미터인지 확인
        if (classDeclaration && isGenericTypeParameter(typeNode, classDeclaration)) {
            // 제네릭 타입 파라미터는 합성 관계에서 제외
            type = null
        } else {
            type = typeName
        }
    }

    return {
        name,
        visibility: scope,
        isStatic: property.isStatic(),
        isReadonly: property.isReadonly(),
        type,
    }
}

function getMorphTypeFromNode(typeNode) {
    if (!typeNode) return null

    const typeText = typeNode.getText().trim()

    // 제네릭 빠르게 확인하기 위해 문자열 사용
    const baseType = typeText.split('<')[0].trim()

    return baseType
}

function isGenericTypeParameter(typeNode, classDeclaration) {
    if (!typeNode || !classDeclaration) return false

    try {
        const typeParameters = classDeclaration.getTypeParameters()

        const typeText = typeNode.getText().trim()
        const typeParamNames = typeParameters.map((tp) => tp.getName())

        return typeParamNames.includes(typeText)
    } catch {
        return false
    }
}

/**
 *
 * @description 합성 관계 판별 기준:
 *
 * 1. private/protected 필드
 * 2. 타입이 클래스/인터페이스 (대문자로 시작)
 * 3. 배열이나 기본 타입이 아닌 경우
 * 4. 프로젝트 내부의 클래스인지 확인 (외부 라이브러리 제외)
 */
function isCompositionRelationship(property, availableClasses = new Set()) {
    if (!property.type) return false

    // 기본 타입들 제외
    const primitiveTypes = ['string', 'number', 'boolean', 'Date', 'Array', 'Map', 'Set', 'Object', 'Function']
    if (primitiveTypes.includes(property.type)) return false

    // 범용 외부 라이브러리 타입들 제외 (성능)
    const externalLibraryTypes = ['Promise', 'Buffer', 'Stream']
    if (externalLibraryTypes.includes(property.type)) return false

    // 대문자로 시작하는 타입이 아니면 클래스로 간주하지 않음
    if (!/^[A-Z]/.test(property.type)) return false

    // private나 protected 필드인 경우만 합성으로 간주
    if (property.visibility !== 'private' && property.visibility !== 'protected') {
        return false
    }

    // 프로젝트 내에 실제로 해당 클래스가 존재하는지 확인: availableClasses가 있는 경우
    if (availableClasses.size > 0 && !availableClasses.has(property.type)) {
        return false
    }

    return true
}

function analyzeMorphConstructorForComposition(constructor, importedClasses, classDeclaration = null) {
    const compositions = []

    const parameters = constructor.getParameters()

    parameters.forEach((param) => {
        const scope = param.getScope()
        const isPrivate = scope === 'private'
        const isProtected = scope === 'protected'

        if (isPrivate || isProtected) {
            const typeNode = param.getTypeNode()
            if (typeNode) {
                const typeName = getMorphTypeFromNode(typeNode)

                // 제네릭은 합성으로 안봄
                if (classDeclaration && isGenericTypeParameter(typeNode, classDeclaration)) {
                    return
                }

                if (typeName && /^[A-Z]/.test(typeName)) {
                    // primitive 타입 및 외부 라이브러리 타입 제외
                    const excludeTypes = [
                        'string',
                        'number',
                        'boolean',
                        'Date',
                        'Array',
                        'Map',
                        'Set',
                        'Object',
                        'Function',
                        'Promise',
                        'Observable',
                        'EventEmitter',
                        'Buffer',
                        'Stream',
                    ]

                    if (!excludeTypes.includes(typeName)) {
                        if (importedClasses.size === 0 || importedClasses.has(typeName)) {
                            compositions.push(typeName)
                        }
                    }
                }
            }
        }
    })

    return compositions
}

server.start({
    transportType: 'stdio',
})
