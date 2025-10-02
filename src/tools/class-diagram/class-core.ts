/* eslint-disable no-console */
import path from 'path'

import {SyntaxKind, type Project} from 'ts-morph'

import {
    analyzeMorphConstructorForComposition,
    analyzeMorphMethod,
    analyzeMorphProperty,
    isCompositionRelationship,
} from './class-utils.js'

import type {ClassInfo, Relationship} from '../../types.js'
import type {ClassInputSchema} from './schema.js'

export async function findChildClasses(project: Project, targetClassName: string) {
    const childClasses: string[] = []

    try {
        const sourceFiles = project.getSourceFiles()

        for (const sourceFile of sourceFiles) {
            const filePath = sourceFile.getFilePath()

            // const relativePath = path.relative(projectPath, filePath)
            // const shouldExclude = excludePatterns.some(
            //     (pattern) =>
            //         minimatch(relativePath, pattern, {dot: true}) ||
            //         minimatch(path.basename(filePath), pattern, {dot: true}),
            // )

            // if (shouldExclude) {
            //     continue
            // }

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

export async function analyzeClassFile(
    project: Project,
    filePath: string,
    targetClassName: string,
    options: Pick<
        ClassInputSchema,
        'includeInterfaces' | 'includeComposes' | 'includeUsages' | 'includePrivate' | 'excludePatterns'
    >,
) {
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
        // 화살표 함수인지 확인
        const initializer = property.getInitializer()
        const isArrowFunction =
            initializer &&
            (initializer.getKindName() === 'ArrowFunction' || initializer.getKindName() === 'FunctionExpression')

        if (isArrowFunction) {
            // 화살표 함수는 메서드로 처리
            const scope = property.getScope() || 'public'
            const name = property.getName()

            // private 체크
            const isPrivate = scope === 'private' || name.startsWith('_')
            if (!options.includePrivate && isPrivate) {
                return
            }

            const methodInfo = {
                name,
                visibility: scope as 'public' | 'protected' | 'private',
                isStatic: property.isStatic(),
                isAbstract: false, // 화살표 함수는 abstract일 수 없음
            }

            classInfo.methods.push(methodInfo)
        } else {
            // 일반 속성으로 처리
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

export function generateRelationships(targetClass: ClassInfo | null) {
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
