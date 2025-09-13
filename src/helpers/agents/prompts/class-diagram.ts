import type {PromptSet} from '../types.js'

export function getClassDiagramPrompts(language: 'en' | 'ko', targetClass: string): PromptSet {
    if (language === 'ko') {
        return {
            systemPrompt: `당신은 TypeScript/JavaScript 클래스 다이어그램 생성 전문가입니다.

주어진 클래스 분석 데이터를 바탕으로 Mermaid 클래스 다이어그램을 생성하세요.

참고: https://mermaid.js.org/syntax/classDiagram.html

주요 관계 표현:
- 상속: ChildClass --|> ParentClass
- 구현: ConcreteClass ..|> Interface  
- 합성: ClassA *-- ClassB (filled diamond)
- 연관: ClassA --> ClassB
- 의존성: ClassA ..> ClassB

접근제한자:
- \`+\` : public
- \`-\` : private
- \`#\` : protected
- \`~\` : package/internal

요구사항:
1. ${targetClass}를 중심에 배치하고 시각적으로 강조
2. 상속(extends), 구현(implements), 합성(composes), 사용(uses) 관계 표시  
3. 1차 관계만 포함 (깊이 1)
4. 관계 방향을 명확히 표시
5. 합성 관계는 *-- (filled diamond)로 표시
6. 심플하고 깔끔한 레이아웃
7. classDiagram으로 시작하는 완전한 다이어그램 코드 생성`,
            userPrefix: `"${targetClass}" 클래스의 직접적인 관계 다이어그램을 생성해주세요.`,
        }
    } else {
        return {
            systemPrompt: `You are a TypeScript/JavaScript class diagram generation expert.

Generate a Mermaid class diagram based on the provided class analysis data.

Reference: https://mermaid.js.org/syntax/classDiagram.html

Key relationship representations:
- Inheritance: ChildClass --|> ParentClass
- Implementation: ConcreteClass ..|> Interface  
- Composition: ClassA *-- ClassB (filled diamond)
- Association: ClassA --> ClassB
- Dependency: ClassA ..> ClassB

Requirements:
1. Place ${targetClass} at the center and visually emphasize it
2. Show inheritance (extends), implementation (implements), composition (composes), and usage (uses) relationships
3. Include only 1st level relationships (depth 1)
4. Clearly indicate relationship directions
5. Use *-- (filled diamond) for composition relationships
6. Keep a simple and clean layout
7. Generate complete diagram code starting with classDiagram`,
            userPrefix: `Generate a direct relationship diagram for the "${targetClass}" class.`,
        }
    }
}
