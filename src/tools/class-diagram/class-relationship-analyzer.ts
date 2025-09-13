/* eslint-disable no-console */
import {findTargetClass} from './class-analyzer.js'
import {analyzeClassFile, findChildClasses, generateRelationships} from './class-core.js'
import {createProject} from '../../helpers/project/ProjectManager.js'

import type {Analysis, ClassInfo} from '../../types.js'
import type {ClassInputSchema} from '../schema.js'
import type {Project} from 'ts-morph'

export class ClassRelationShipAnalyzer {
    /**
     * 클래스 분석 결과를 캐싱하기 위한 Map
     */
    private classCache = new Map<string, ClassInfo | null>()
    private project: Project

    constructor(
        private projectPath: string,
        private options: Pick<
            ClassInputSchema,
            'depth' | 'includeInterfaces' | 'includeComposes' | 'includeUsages' | 'includePrivate' | 'excludePatterns'
        >,
    ) {
        this.options = options
        this.project = createProject(projectPath)
    }

    static create(
        projectPath: string,
        options: Pick<
            ClassInputSchema,
            'depth' | 'includeInterfaces' | 'includeComposes' | 'includeUsages' | 'includePrivate' | 'excludePatterns'
        >,
    ) {
        return new ClassRelationShipAnalyzer(projectPath, options)
    }

    private async getClassInfo(className: string): Promise<ClassInfo | null> {
        if (this.classCache.has(className)) {
            return this.classCache.get(className)!
        }

        const classFile = await findTargetClass(this.projectPath, className, this.options.excludePatterns)
        if (!classFile) {
            console.error(`Could not find file for class: ${className}`)
            this.classCache.set(className, null)
            return null
        }

        const classInfo = await analyzeClassFile(this.project, classFile.filePath, className, this.options)
        this.classCache.set(className, classInfo)

        if (classInfo) {
            console.error(`Successfully analyzed: ${className}`)
        } else {
            console.error(`Failed to analyze: ${className}`)
        }

        return classInfo
    }

    async analyzeDirectRelationships(
        targetClassFile: {filePath: string; relativePath: string},
        targetClassName: string,
    ) {
        const analysis: Analysis = {
            targetClass: null,
            relatedClasses: [],
            relationships: [],
        }

        console.error('Analyzing target class...')
        analysis.targetClass = await analyzeClassFile(
            this.project,
            targetClassFile.filePath,
            targetClassName,
            this.options,
        )

        if (!analysis.targetClass) {
            throw new Error(`Failed to analyze target class ${targetClassName}`)
        }

        this.classCache.set(targetClassName, analysis.targetClass)

        // 합성 관계 분석 (includeComposes가 true일 때만)
        if (this.options.includeComposes) {
            console.error('Analyzing inheritance chain for compositions...')
            let currentClass = analysis.targetClass
            while (currentClass?.extends) {
                const parentClass = await this.getClassInfo(currentClass.extends)
                if (parentClass) {
                    console.error(
                        `Found parent class ${currentClass.extends} with ${parentClass.compositions.length} compositions`,
                    )
                    // 부모의 합성을 상속받은 합성으로 추가 (from과 to 정보 포함)
                    parentClass.compositions.forEach((composition) => {
                        analysis.targetClass.inheritedCompositions.push({
                            from: parentClass.name,
                            to: composition,
                        })
                    })
                    currentClass = parentClass
                } else {
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

        for (let depth = 1; depth <= this.options.depth; depth++) {
            const nextLevelClasses = new Set<string>()

            console.error(`Analyzing depth ${depth} with ${currentLevelClasses.size} classes...`)

            for (const currentClassName of currentLevelClasses) {
                if (processedClasses.has(currentClassName)) {
                    continue
                }
                processedClasses.add(currentClassName)

                const currentClassInfo = await this.getClassInfo(currentClassName)

                if (!currentClassInfo) {
                    console.error(`Could not analyze class: ${currentClassName}`)
                    continue
                }

                // 관련 클래스 수집
                if (currentClassInfo.extends) {
                    allRelatedClasses.add(currentClassInfo.extends)
                    nextLevelClasses.add(currentClassInfo.extends)
                }

                if (this.options.includeInterfaces) {
                    currentClassInfo.implements.forEach((impl) => {
                        allRelatedClasses.add(impl)
                        nextLevelClasses.add(impl)
                    })
                }

                if (this.options.includeUsages) {
                    const childClasses = await findChildClasses(this.project, currentClassName)
                    childClasses.forEach((className) => {
                        allRelatedClasses.add(className)
                        nextLevelClasses.add(className)
                    })
                }

                if (this.options.includeComposes) {
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

        // 타겟 클래스 제외
        allRelatedClasses.delete(targetClassName)

        console.error(`Found ${allRelatedClasses.size} related classes to analyze`)
        console.error('Related class names:', Array.from(allRelatedClasses))

        // 이미 처리된 클래스들은 제외하고, 캐시에 없는 클래스들만 분석
        for (const className of allRelatedClasses) {
            if (!this.classCache.has(className)) {
                await this.getClassInfo(className)
            }
        }

        // 캐시에서 관련 클래스들 수집 (null이 아닌 것만)
        for (const className of allRelatedClasses) {
            const classInfo = this.classCache.get(className)
            if (classInfo) {
                analysis.relatedClasses.push(classInfo)
            }
        }

        analysis.relationships = generateRelationships(analysis.targetClass)

        return analysis
    }
}
