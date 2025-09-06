export type ClassInfo = {
    name: string
    filePath: string
    relativePath: string
    isAbstract: boolean
    isExported: boolean
    /**
     * 상속하는 부모 클래스 (없으면 null)
     */
    extends: string | null
    /**
     * 구현하는 인터페이스들
     */
    implements: string[]
    /**
     * 클래스 메서드들
     */
    methods: {
        name: string
        visibility: 'public' | 'protected' | 'private'
        isStatic: boolean
        isAbstract: boolean
    }[]
    /**
     * 클래스 속성들
     */
    properties: {
        name: string
        visibility: 'public' | 'protected' | 'private'
        isStatic: boolean
        isReadonly: boolean
        type?: string
    }[]
    /**
     * 현재 클래스가 합성으로 가지는 클래스들
     */
    compositions: string[]
    /**
     * 상속받은 부모 클래스들의 합성 관계 (includeComposes가 true일 때만 포함)
     */
    inheritedCompositions: Array<{from: string; to: string}>
}

export type Relationship = {type: 'extends' | 'implements' | 'uses' | 'composes'; from: string; to: string}
export type Analysis = {
    targetClass: ClassInfo | null
    relatedClasses: (ClassInfo | null)[]
    relationships: Relationship[]
}
