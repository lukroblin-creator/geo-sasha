export type ComparatorQueryTarget = {
  id: string
  label: string
  kind: 'text' | 'number' | 'flag'
  aliases?: string[]
}

export type ComparatorQueryClause = {
  targetId: string
  negated?: boolean
  operator:
    | 'contains'
    | 'equals'
    | 'lt'
    | 'gt'
    | 'eq'
    | 'lte'
    | 'gte'
    | 'between'
    | 'flagColor'
    | 'flagBand'
    | 'flagRatio'
    | 'flagShape'
  value: string
  upperValue?: string
  bandDirection?: 'horizontal' | 'vertical' | 'oblique'
}

export type ComparatorQueryExpression =
  | { kind: 'clause'; clause: ComparatorQueryClause }
  | { kind: 'constant'; value: boolean }
  | { kind: 'not'; expression: ComparatorQueryExpression }
  | { kind: 'and' | 'or'; left: ComparatorQueryExpression; right: ComparatorQueryExpression }

export type ComparatorQuerySuggestion = {
  label: string
  insertion: string
}

export type FlattenedComparatorQuery = {
  clauses: ComparatorQueryClause[]
  relations: Array<'and' | 'or'>
  groups: Array<{ startIndex: number; endIndex: number }>
  constant?: boolean
}

export type ComparatorTruthRegion = 'both' | 'aOnly' | 'bOnly' | 'neither'

type QueryToken = { value: string; start: number; end: number; quoted: boolean }

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’‘]/g, "'")
    .toLocaleLowerCase()
    .trim()

function tokenize(source: string): QueryToken[] {
  const tokens: QueryToken[] = []
  let cursor = 0
  while (cursor < source.length) {
    if (/\s/.test(source[cursor] ?? '')) {
      cursor += 1
      continue
    }

    const start = cursor
    const character = source[cursor]
    if (character === '(' || character === ')') {
      tokens.push({ value: character, start, end: ++cursor, quoted: false })
      continue
    }
    if ('<>!='.includes(character ?? '') || character === '≠') {
      cursor += 1
      if (source[cursor] === '=') cursor += 1
      tokens.push({ value: source.slice(start, cursor), start, end: cursor, quoted: false })
      continue
    }
    if (character === '"' || character === "'") {
      const quote = character
      cursor += 1
      let value = ''
      while (cursor < source.length) {
        const current = source[cursor]
        if (current === '\\' && cursor + 1 < source.length) {
          value += source[cursor + 1]
          cursor += 2
          continue
        }
        if (current === quote) {
          cursor += 1
          break
        }
        value += current
        cursor += 1
      }
      tokens.push({ value, start, end: cursor, quoted: true })
      continue
    }

    while (
      cursor < source.length &&
      !/\s/.test(source[cursor] ?? '') &&
      !'()<>!='.includes(source[cursor] ?? '') &&
      source[cursor] !== '≠'
    ) {
      cursor += 1
    }
    tokens.push({ value: source.slice(start, cursor), start, end: cursor, quoted: false })
  }
  return tokens
}

const belongsWords = new Set(['appartient', 'belongs', 'pertenece'])
const containsWords = new Set(['contient', 'contains', 'contiene'])
const equalsWords = new Set(['est', 'equals', 'equal', 'is', 'es', 'exactement', 'exactly'])
const notEqualsWords = new Set(["n'est", "isn't", 'isnt', 'noes'])
const andWords = new Set(['et', 'and', 'y'])
const orWords = new Set(['ou', 'or', 'o'])
const notWords = new Set(['non', 'not', 'pas', 'no'])

function comparisonOperatorLength(tokens: QueryToken[], index: number): number {
  const word = normalize(tokens[index]?.value ?? '')
  const next = normalize(tokens[index + 1]?.value ?? '')
  const afterNext = normalize(tokens[index + 2]?.value ?? '')
  if (word === 'ne' && containsWords.has(next) && afterNext === 'pas') return 3
  if (notEqualsWords.has(word)) return next === 'pas' || next === 'not' ? 2 : 1
  if ((equalsWords.has(word) || containsWords.has(word)) && (next === 'pas' || next === 'not'))
    return 2
  if (['<', '>', '<=', '>=', '=', '!=', '≠'].includes(tokens[index]?.value ?? '')) return 1
  if (
    equalsWords.has(word) ||
    containsWords.has(word) ||
    belongsWords.has(word) ||
    [
      'entre',
      'between',
      'couleur',
      'color',
      'colour',
      'bandes',
      'bands',
      'franjas',
      'proportion',
      'proportions',
      'proporciones',
      'forme',
      'shape',
      'outline',
      'ratio'
    ].includes(word)
  )
    return 1
  return 0
}

function parseNumber(value: string): number | null {
  const normalized = normalize(value).replace(/\s/g, '').replace(',', '.')
  const match = normalized.match(
    /^([-+]?\d+(?:\.\d+)?)(k|m|bn|million|millions|milliard|milliards)?$/
  )
  if (!match) return null
  const amount = Number(match[1])
  const suffix = match[2]
  const multiplier =
    suffix === 'k'
      ? 1_000
      : suffix === 'm' || suffix === 'million' || suffix === 'millions'
        ? 1_000_000
        : suffix === 'bn' || suffix === 'milliard' || suffix === 'milliards'
          ? 1_000_000_000
          : 1
  return Number.isFinite(amount) ? amount * multiplier : null
}

function targetPhrases(target: ComparatorQueryTarget): string[][] {
  return [target.label, target.id, ...(target.aliases ?? [])]
    .map((phrase) => normalize(phrase).split(/\s+/).filter(Boolean))
    .filter((words) => words.length > 0)
}

function matchTarget(
  tokens: QueryToken[],
  index: number,
  targets: ComparatorQueryTarget[]
): { target: ComparatorQueryTarget; end: number } | null {
  const matches = targets.flatMap((target) =>
    targetPhrases(target).map((words) => ({ target, words }))
  )
  matches.sort((a, b) => b.words.length - a.words.length)
  for (const { target, words } of matches) {
    const phraseMatches = words.every(
      (word, offset) => normalize(tokens[index + offset]?.value ?? '') === word
    )
    if (phraseMatches) return { target, end: index + words.length }
  }
  return null
}

function isLogical(token: QueryToken | undefined): boolean {
  if (!token || token.quoted) return false
  const word = normalize(token.value)
  return andWords.has(word) || orWords.has(word)
}

export function parseComparatorTextQuery(
  source: string,
  targets: ComparatorQueryTarget[]
): { expression: ComparatorQueryExpression | null; error: string | null } {
  const tokens = tokenize(source)
  if (tokens.length === 0) return { expression: null, error: null }
  let cursor = 0

  const readValue = (stopAtLogical = true): string => {
    const values: string[] = []
    while (cursor < tokens.length) {
      const token = tokens[cursor]
      if (!token || token.value === ')' || (stopAtLogical && isLogical(token))) break
      if (token.value === '(') break
      values.push(token.value)
      cursor += 1
    }
    return values.join(' ').trim()
  }

  const parseClause = (): ComparatorQueryExpression | null => {
    const first = tokens[cursor]
    if (!first) return null
    const firstWord = normalize(first.value)

    if (belongsWords.has(firstWord)) {
      cursor += 1
      if (
        normalize(tokens[cursor]?.value ?? '') === 'to' ||
        normalize(tokens[cursor]?.value ?? '') === 'a'
      )
        cursor += 1
      const continent = targets.find((target) => target.id === 'continent')
      const value = readValue()
      if (!continent || !value) return null
      return { kind: 'clause', clause: { targetId: continent.id, operator: 'equals', value } }
    }

    const match = matchTarget(tokens, cursor, targets)
    if (!match) return null
    const { target } = match
    cursor = match.end
    const operation = tokens[cursor]
    if (!operation) return null
    const operationWord = normalize(operation.value)
    let operator: ComparatorQueryClause['operator'] | null = null
    let negated = false
    let operationTokenCount = 1

    if (operation.value === '!=' || operation.value === '≠') {
      operator = 'eq'
      negated = true
    } else if (operation.value === '<') operator = 'lt'
    else if (operation.value === '>') operator = 'gt'
    else if (operation.value === '<=') operator = 'lte'
    else if (operation.value === '>=') operator = 'gte'
    else if (operation.value === '=') operator = 'eq'
    else if (
      operationWord === 'ne' &&
      containsWords.has(normalize(tokens[cursor + 1]?.value ?? '')) &&
      normalize(tokens[cursor + 2]?.value ?? '') === 'pas'
    ) {
      operator = 'contains'
      negated = true
      operationTokenCount = 3
    } else if (containsWords.has(operationWord)) operator = 'contains'
    else if (notEqualsWords.has(operationWord)) {
      operator = 'equals'
      negated = true
      if (['pas', 'not'].includes(normalize(tokens[cursor + 1]?.value ?? '')))
        operationTokenCount += 1
    } else if (equalsWords.has(operationWord) || belongsWords.has(operationWord)) {
      operator = 'equals'
      if (['pas', 'not'].includes(normalize(tokens[cursor + 1]?.value ?? ''))) {
        negated = true
        operationTokenCount += 1
      }
    } else if (operationWord === 'entre' || operationWord === 'between') operator = 'between'
    else if (target.kind === 'flag' && ['couleur', 'color', 'colour'].includes(operationWord))
      operator = 'flagColor'
    else if (
      target.kind === 'flag' &&
      ['bandes', 'bands', 'franjas', 'rayures', 'stripes'].includes(operationWord)
    )
      operator = 'flagBand'
    else if (
      target.kind === 'flag' &&
      ['proportion', 'proportions', 'ratio'].includes(operationWord)
    )
      operator = 'flagRatio'
    else if (target.kind === 'flag' && ['forme', 'shape', 'outline'].includes(operationWord))
      operator = 'flagShape'
    if (!operator) return null
    if (target.kind === 'text' && !['contains', 'equals'].includes(operator)) return null
    if (
      target.kind === 'number' &&
      !['lt', 'gt', 'eq', 'lte', 'gte', 'between', 'equals'].includes(operator)
    )
      return null
    if (
      target.kind === 'flag' &&
      !['flagColor', 'flagBand', 'flagRatio', 'flagShape'].includes(operator)
    )
      return null
    if (target.kind === 'number' && operator === 'equals') operator = 'eq'
    cursor += operationTokenCount

    let bandDirection: ComparatorQueryClause['bandDirection']
    if (operator === 'flagBand') {
      const direction = normalize(tokens[cursor]?.value ?? '')
      if (['horizontale', 'horizontales', 'horizontal', 'horizontally'].includes(direction)) {
        bandDirection = 'horizontal'
        cursor += 1
      } else if (['verticale', 'verticales', 'vertical', 'vertically'].includes(direction)) {
        bandDirection = 'vertical'
        cursor += 1
      } else if (
        ['oblique', 'obliques', 'diagonal', 'diagonals', 'diagonale', 'diagonales'].includes(
          direction
        )
      ) {
        bandDirection = 'oblique'
        cursor += 1
      }
    }

    if (operator === 'between' || operator === 'flagRatio') {
      if (
        operator === 'flagRatio' &&
        ['entre', 'between'].includes(normalize(tokens[cursor]?.value ?? ''))
      )
        cursor += 1
      const firstValue = tokens[cursor]?.value ?? ''
      if (parseNumber(firstValue) === null) return null
      cursor += 1
      if (isLogical(tokens[cursor])) cursor += 1
      const upperValue = tokens[cursor]?.value ?? ''
      if (parseNumber(upperValue) === null) return null
      cursor += 1
      return {
        kind: 'clause',
        clause: {
          targetId: target.id,
          operator,
          value: String(parseNumber(firstValue)),
          upperValue: String(parseNumber(upperValue)),
          ...(negated ? { negated: true } : {}),
          ...(bandDirection ? { bandDirection } : {})
        }
      }
    }

    const value = readValue()
    if (!value) return null
    if (target.kind === 'number' && !['flagColor', 'flagBand'].includes(operator)) {
      const numericValue = parseNumber(value)
      if (numericValue === null) return null
      return {
        kind: 'clause',
        clause: {
          targetId: target.id,
          operator,
          value: String(numericValue),
          ...(negated ? { negated: true } : {})
        }
      }
    }
    if (operator === 'flagBand') {
      const bandCount = parseNumber(value)
      if (bandCount === null) return null
      return {
        kind: 'clause',
        clause: {
          targetId: target.id,
          operator,
          value: String(bandCount),
          ...(negated ? { negated: true } : {}),
          ...(bandDirection ? { bandDirection } : {})
        }
      }
    }
    return {
      kind: 'clause',
      clause: { targetId: target.id, operator, value, ...(negated ? { negated: true } : {}) }
    }
  }

  const parsePrimary = (): ComparatorQueryExpression | null => {
    const firstThree = tokens
      .slice(cursor, cursor + 3)
      .map((token) => normalize(token?.value ?? ''))
    const firstTwo = firstThree.slice(0, 2)
    if (
      firstThree.join(' ') === 'tous les pays' ||
      firstTwo.join(' ') === 'all countries' ||
      firstThree.join(' ') === 'todos los paises'
    ) {
      cursor += firstThree.join(' ') === 'all countries' ? 2 : 3
      return { kind: 'constant', value: true }
    }
    if (
      firstTwo.join(' ') === 'aucun pays' ||
      firstTwo.join(' ') === 'no countries' ||
      firstTwo.join(' ') === 'ningun pais'
    ) {
      cursor += 2
      return { kind: 'constant', value: false }
    }
    if (notWords.has(normalize(tokens[cursor]?.value ?? ''))) {
      cursor += 1
      const expression = parsePrimary()
      return expression ? { kind: 'not', expression } : null
    }
    if (tokens[cursor]?.value === '(') {
      cursor += 1
      const expression = parseOr()
      if (!expression || tokens[cursor]?.value !== ')') return null
      cursor += 1
      return expression
    }
    return parseClause()
  }

  const parseAnd = (): ComparatorQueryExpression | null => {
    let expression = parsePrimary()
    while (expression && andWords.has(normalize(tokens[cursor]?.value ?? ''))) {
      cursor += 1
      const right = parsePrimary()
      if (!right) return null
      expression = { kind: 'and', left: expression, right }
    }
    return expression
  }

  const parseOr = (): ComparatorQueryExpression | null => {
    let expression = parseAnd()
    while (expression && orWords.has(normalize(tokens[cursor]?.value ?? ''))) {
      cursor += 1
      const right = parseAnd()
      if (!right) return null
      expression = { kind: 'or', left: expression, right }
    }
    return expression
  }

  const expression = parseOr()
  return expression && cursor === tokens.length
    ? { expression, error: null }
    : { expression: null, error: 'Requête incomplète ou syntaxe inconnue.' }
}

export function flattenComparatorQueryExpression(
  expression: ComparatorQueryExpression
): FlattenedComparatorQuery {
  const simplify = (node: ComparatorQueryExpression): ComparatorQueryExpression => {
    if (node.kind === 'clause' || node.kind === 'constant') return node
    if (node.kind === 'not') {
      const child = simplify(node.expression)
      if (child.kind === 'constant') return { kind: 'constant', value: !child.value }
      if (child.kind === 'not') return simplify(child.expression)
      return { kind: 'not', expression: child }
    }
    const left = simplify(node.left)
    const right = simplify(node.right)
    if (left.kind === 'constant' && right.kind === 'constant')
      return {
        kind: 'constant',
        value: node.kind === 'and' ? left.value && right.value : left.value || right.value
      }
    if (left.kind === 'constant') {
      if (node.kind === 'and') return left.value ? right : left
      return left.value ? left : right
    }
    if (right.kind === 'constant') {
      if (node.kind === 'and') return right.value ? left : right
      return right.value ? right : left
    }
    return { kind: node.kind, left, right }
  }
  const simplified = simplify(expression)
  if (simplified.kind === 'constant')
    return { clauses: [], relations: [], groups: [], constant: simplified.value }

  const clauses: ComparatorQueryClause[] = []
  const relations: Array<'and' | 'or'> = []
  const groups: Array<{ startIndex: number; endIndex: number }> = []

  const visit = (
    node: ComparatorQueryExpression,
    wrapInGroup: boolean,
    negated = false
  ): { startIndex: number; endIndex: number } => {
    if (node.kind === 'clause') {
      const shouldNegate = Boolean(node.clause.negated) !== negated
      const index = clauses.push(shouldNegate ? { ...node.clause, negated: true } : node.clause) - 1
      return { startIndex: index, endIndex: index }
    }
    if (node.kind === 'constant') {
      const index = clauses.length
      return { startIndex: index, endIndex: index }
    }
    if (node.kind === 'not') return visit(node.expression, wrapInGroup, !negated)

    const startIndex = clauses.length
    const expressionKind = negated ? (node.kind === 'and' ? 'or' : 'and') : node.kind
    const left = visit(node.left, true, negated)
    relations[left.endIndex] = expressionKind
    const right = visit(node.right, true, negated)
    const range = { startIndex, endIndex: right.endIndex }
    if (wrapInGroup && range.endIndex > range.startIndex) groups.push(range)
    return range
  }

  visit(simplified, false)
  groups.sort(
    (first, second) => first.startIndex - second.startIndex || second.endIndex - first.endIndex
  )
  return { clauses, relations, groups }
}

export function getComparatorQuerySuggestions(
  query: string,
  targets: ComparatorQueryTarget[],
  valuesByTarget: Map<string, string[]>
): ComparatorQuerySuggestion[] {
  const trimmed = query.trimEnd()
  const tokens = tokenize(trimmed)
  const hasTrailingSpace = query.length > trimmed.length
  const currentToken = hasTrailingSpace ? '' : (tokens.at(-1)?.value ?? '')
  const tokensBeforeCurrent = hasTrailingSpace ? tokens : tokens.slice(0, -1)
  let clauseStartIndex = -1
  for (let index = tokensBeforeCurrent.length - 1; index >= 0; index -= 1) {
    const token = tokensBeforeCurrent[index]
    if (token && (token.value === '(' || isLogical(token))) {
      clauseStartIndex = index
      break
    }
  }
  const replacementStart =
    clauseStartIndex >= 0 ? (tokensBeforeCurrent[clauseStartIndex]?.end ?? 0) : 0
  const clauseTokensWithPrefix = tokensBeforeCurrent.slice(clauseStartIndex + 1)
  const sourceClausePrefix = query.slice(0, replacementStart)
  const hasNegationPrefix = notWords.has(normalize(clauseTokensWithPrefix[0]?.value ?? ''))
  const clauseTokens = hasNegationPrefix ? clauseTokensWithPrefix.slice(1) : clauseTokensWithPrefix
  const clausePrefix = hasNegationPrefix
    ? `${sourceClausePrefix}${clauseTokensWithPrefix[0]?.value ?? 'non'} `
    : sourceClausePrefix

  const openParentheses = tokens.reduce(
    (depth, token) =>
      token.value === '(' ? depth + 1 : token.value === ')' ? Math.max(0, depth - 1) : depth,
    0
  )
  const closesCurrentExpression =
    openParentheses > 0 &&
    Boolean(
      parseComparatorTextQuery(`${trimmed} ${')'.repeat(openParentheses)}`, targets).expression
    )
  if (
    hasTrailingSpace &&
    (parseComparatorTextQuery(query, targets).expression || closesCurrentExpression)
  ) {
    return [
      { label: 'ET', insertion: `${trimmed} et ` },
      { label: 'OU', insertion: `${trimmed} ou ` },
      ...(openParentheses > 0 ? [{ label: ')', insertion: `${trimmed}) ` }] : [])
    ]
  }

  const word = normalize(currentToken)
  const specialBelongs =
    clauseTokens.length === 1 && belongsWords.has(normalize(clauseTokens[0]?.value ?? ''))
  if (specialBelongs) {
    const valuePrefix = normalize(currentToken)
    return (valuesByTarget.get('continent') ?? [])
      .filter((value) => !valuePrefix || normalize(value).startsWith(valuePrefix))
      .slice(0, 10)
      .map((value) => ({ label: value, insertion: `${clausePrefix}appartient ${value} ` }))
  }

  const targetMatch = matchTarget(clauseTokens, 0, targets)
  if (!targetMatch) {
    const prefix = normalize(currentToken)
    const suggestions: ComparatorQuerySuggestion[] = [
      ...targets.map((target) => ({
        label: target.label,
        insertion: `${clausePrefix}${target.label.toLocaleLowerCase()} `
      })),
      { label: 'tous les pays', insertion: `${sourceClausePrefix}tous les pays ` },
      { label: 'aucun pays', insertion: `${sourceClausePrefix}aucun pays ` },
      { label: 'non', insertion: `${sourceClausePrefix}non ` },
      { label: '(', insertion: `${clausePrefix}( ` }
    ]
    return suggestions.filter((item) => !prefix || normalize(item.label).startsWith(prefix))
  }

  const target = targetMatch.target
  const remaining = clauseTokens.slice(targetMatch.end)
  if (remaining.length === 0) {
    const operators =
      target.kind === 'number'
        ? [
            { label: '>', insertion: '>' },
            { label: '>=', insertion: '>=' },
            { label: '<', insertion: '<' },
            { label: '<=', insertion: '<=' },
            { label: '=', insertion: '=' },
            { label: '≠', insertion: "n'est pas" },
            { label: 'entre', insertion: 'entre' }
          ]
        : target.kind === 'flag'
          ? [
              { label: 'couleur', insertion: 'couleur' },
              { label: 'bandes', insertion: 'bandes' },
              { label: 'proportions', insertion: 'proportions entre' },
              { label: 'forme', insertion: 'forme' }
            ]
          : [
              { label: 'contient', insertion: 'contient' },
              { label: 'est', insertion: 'est' },
              { label: "n'est pas", insertion: "n'est pas" },
              { label: 'ne contient pas', insertion: 'ne contient pas' }
            ]
    return operators
      .filter((item) => !word || normalize(item.label).startsWith(word))
      .map((item) => ({
        label: item.label,
        insertion: `${clausePrefix}${target.label.toLocaleLowerCase()} ${item.insertion} `
      }))
  }

  const operatorIndex = remaining.findIndex(
    (_, index) => comparisonOperatorLength(remaining, index) > 0
  )
  const operatorLength = operatorIndex >= 0 ? comparisonOperatorLength(remaining, operatorIndex) : 0
  if (
    operatorIndex >= 0 &&
    operatorLength === 1 &&
    notEqualsWords.has(normalize(remaining[operatorIndex]?.value ?? ''))
  ) {
    return [
      { label: 'pas', insertion: `${clausePrefix}${target.label.toLocaleLowerCase()} n'est pas ` }
    ]
  }
  if (operatorIndex < 0 || operatorIndex + operatorLength >= remaining.length) {
    const operation = remaining[operatorIndex]?.value
    const isImplicitBelongs =
      clauseTokens.length === 1 && belongsWords.has(normalize(clauseTokens[0]?.value ?? ''))
    const valueTarget = isImplicitBelongs ? targets.find((item) => item.id === 'continent') : target
    const operationWord = normalize(operation ?? '')
    const afterOperation = remaining.slice(operatorIndex + operatorLength)
    const hasFlagDirection = afterOperation.some((token) =>
      [
        'horizontale',
        'horizontales',
        'horizontal',
        'verticale',
        'verticales',
        'vertical',
        'oblique',
        'obliques',
        'diagonal',
        'diagonals',
        'diagonale',
        'diagonales'
      ].includes(normalize(token.value))
    )
    const options =
      valueTarget?.kind === 'number'
        ? [...(valuesByTarget.get(valueTarget.id) ?? []), '1000', '1000000', '1000000000']
        : target.kind === 'flag' &&
            ['bandes', 'bands', 'franjas', 'rayures', 'stripes'].includes(operationWord)
          ? hasFlagDirection
            ? (valuesByTarget.get('flag-band-count') ?? [])
            : [
                'horizontales',
                'verticales',
                'obliques',
                ...(valuesByTarget.get('flag-band-count') ?? [])
              ]
          : target.kind === 'flag' && ['forme', 'shape', 'outline'].includes(operationWord)
            ? (valuesByTarget.get('flag-shape') ?? [])
            : target.kind === 'flag' &&
                ['proportion', 'proportions', 'proporciones', 'ratio'].includes(operationWord)
              ? (valuesByTarget.get('flag-ratio') ?? [])
              : (valuesByTarget.get(valueTarget?.id ?? '') ?? [])
    const prefix = normalize(currentToken)
    const valuePrefix = prefix
    return [...new Set(options)]
      .filter((value) => !valuePrefix || normalize(value).startsWith(valuePrefix))
      .slice(0, 10)
      .map((value) => {
        const formatted = /\s/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value
        const base = isImplicitBelongs
          ? `${clausePrefix}appartient`
          : `${clausePrefix}${target.label.toLocaleLowerCase()} ${remaining
              .slice(0, operatorIndex + operatorLength)
              .map((item) => item.value)
              .join(' ')}`
        return { label: value, insertion: `${base} ${formatted} ` }
      })
  }

  return []
}

export function serializeComparatorQueryValue(value: string): string {
  return /[\s()]/.test(value) ? `"${value.replaceAll('"', '\\"')}"` : value
}

export function serializeComparatorTruthRelation(
  left: string,
  right: string,
  regions: ComparatorTruthRegion[]
): string | null {
  const constantValues = new Map([
    ['tous les pays', true],
    ['aucun pays', false]
  ])
  const leftConstant = constantValues.get(left)
  const rightConstant = constantValues.get(right)
  if (leftConstant !== undefined || rightConstant !== undefined) {
    const outputWhenRightTrue =
      leftConstant !== undefined
        ? regions.includes(leftConstant ? 'both' : 'bOnly')
        : regions.includes(rightConstant ? 'both' : 'aOnly')
    const outputWhenRightFalse =
      leftConstant !== undefined
        ? regions.includes(leftConstant ? 'aOnly' : 'neither')
        : regions.includes(rightConstant ? 'bOnly' : 'neither')
    if (outputWhenRightTrue === outputWhenRightFalse)
      return outputWhenRightTrue ? 'tous les pays' : 'aucun pays'
    const variable = leftConstant !== undefined ? right : left
    return outputWhenRightTrue ? variable : `non (${variable})`
  }
  if (regions.length === 0) return 'aucun pays'
  if (regions.length === 4) return 'tous les pays'
  const terms = regions.map((region) => {
    const includesA = region === 'both' || region === 'aOnly'
    const includesB = region === 'both' || region === 'bOnly'
    return `(${includesA ? left : `non (${left})`} et ${includesB ? right : `non (${right})`})`
  })
  return terms.join(' ou ')
}
