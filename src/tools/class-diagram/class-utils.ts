export function analyzeMorphMethod(method, options) {
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

export function analyzeMorphProperty(property, options, classDeclaration = null) {
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
export function isCompositionRelationship(property, availableClasses = new Set()) {
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

export function analyzeMorphConstructorForComposition(constructor, importedClasses, classDeclaration = null) {
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
