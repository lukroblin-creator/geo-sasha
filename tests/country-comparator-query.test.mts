import assert from 'node:assert/strict'
import test from 'node:test'
import {
  flattenComparatorQueryExpression,
  getComparatorQuerySuggestions,
  parseComparatorTextQuery,
  serializeComparatorTruthRelation,
  type ComparatorQueryTarget
} from '../src/renderer/src/data/geography/countryComparatorTextQuery.ts'

const targets: ComparatorQueryTarget[] = [
  { id: 'continent', label: 'continent', kind: 'text' },
  { id: 'population', label: 'population', kind: 'number' },
  { id: 'capital', label: 'capitale', kind: 'text' },
  { id: 'flag', label: 'drapeau', kind: 'flag' }
]

test('parses the implicit belongs-to-continent phrase', () => {
  const parsed = parseComparatorTextQuery('appartient Europe', targets)
  assert.equal(parsed.error, null)
  assert.deepEqual(parsed.expression, {
    kind: 'clause',
    clause: { targetId: 'continent', operator: 'equals', value: 'Europe' }
  })
})

test('parses French not-equal phrases and negated parenthesized expressions', () => {
  const notEquals = parseComparatorTextQuery('continent n’est pas Europe', targets)
  assert.deepEqual(notEquals.expression, {
    kind: 'clause',
    clause: { targetId: 'continent', operator: 'equals', value: 'Europe', negated: true }
  })

  const negatedGroup = parseComparatorTextQuery(
    'non (continent est Europe ou population > 50000000)',
    targets
  )
  assert.ok(negatedGroup.expression)
  const flattened = flattenComparatorQueryExpression(negatedGroup.expression)
  assert.deepEqual(
    flattened.clauses.map((clause) => clause.negated),
    [true, true]
  )
  assert.deepEqual(flattened.relations, ['and'])

  const contains = parseComparatorTextQuery('capitale ne contient pas Paris', targets)
  assert.deepEqual(contains.expression, {
    kind: 'clause',
    clause: { targetId: 'capital', operator: 'contains', value: 'Paris', negated: true }
  })
})

test('parses the suggested not-equal symbol and Spanish flag-band operator', () => {
  const notEquals = parseComparatorTextQuery('population ≠ 50000000', targets)
  assert.deepEqual(notEquals.expression, {
    kind: 'clause',
    clause: { targetId: 'population', operator: 'eq', value: '50000000', negated: true }
  })

  const flagBands = parseComparatorTextQuery('drapeau franjas horizontales 3', targets)
  assert.deepEqual(flagBands.expression, {
    kind: 'clause',
    clause: {
      targetId: 'flag',
      operator: 'flagBand',
      value: '3',
      bandDirection: 'horizontal'
    }
  })
})

test('parses quoted text and numeric values with separators and suffixes', () => {
  const phrase = parseComparatorTextQuery('capitale contient "Port of Spain"', targets)
  assert.deepEqual(phrase.expression, {
    kind: 'clause',
    clause: { targetId: 'capital', operator: 'contains', value: 'Port of Spain' }
  })

  const population = parseComparatorTextQuery('population > 50 000 000', targets)
  assert.deepEqual(population.expression, {
    kind: 'clause',
    clause: { targetId: 'population', operator: 'gt', value: '50000000' }
  })

  const shorthand = parseComparatorTextQuery('population >= 50m', targets)
  assert.deepEqual(shorthand.expression, {
    kind: 'clause',
    clause: { targetId: 'population', operator: 'gte', value: '50000000' }
  })
})

test('parses flag band directions and ratio ranges', () => {
  const bands = parseComparatorTextQuery('drapeau bandes verticales 3', targets)
  assert.deepEqual(bands.expression, {
    kind: 'clause',
    clause: {
      targetId: 'flag',
      operator: 'flagBand',
      value: '3',
      bandDirection: 'vertical'
    }
  })

  const ratio = parseComparatorTextQuery('drapeau proportions entre 1.5 et 2', targets)
  assert.deepEqual(ratio.expression, {
    kind: 'clause',
    clause: {
      targetId: 'flag',
      operator: 'flagRatio',
      value: '1.5',
      upperValue: '2'
    }
  })

  const shape = parseComparatorTextQuery('drapeau forme "Népal"', targets)
  assert.deepEqual(shape.expression, {
    kind: 'clause',
    clause: { targetId: 'flag', operator: 'flagShape', value: 'Népal' }
  })
})

test('preserves AND precedence and parenthesized groups', () => {
  const parsed = parseComparatorTextQuery(
    'continent est Europe ou (continent est Asie et population > 50000000)',
    targets
  )
  assert.equal(parsed.error, null)
  assert.ok(parsed.expression)

  const flattened = flattenComparatorQueryExpression(parsed.expression)
  assert.deepEqual(
    flattened.clauses.map((clause) => clause.value),
    ['Europe', 'Asie', '50000000']
  )
  assert.deepEqual(flattened.relations, ['or', 'and'])
  assert.deepEqual(flattened.groups, [{ startIndex: 1, endIndex: 2 }])
})

test('serializes custom A/B relation rows with ordinary boolean filters', () => {
  const query = serializeComparatorTruthRelation('population > 10', 'capitale est Paris', ['aOnly'])
  assert.equal(query, '(population > 10 et non (capitale est Paris))')

  const parsed = parseComparatorTextQuery(query ?? '', targets)
  assert.ok(parsed.expression)
  const flattened = flattenComparatorQueryExpression(parsed.expression)
  assert.deepEqual(flattened.relations, ['and'])
  assert.deepEqual(
    flattened.clauses.map((clause) => clause.negated),
    [undefined, true]
  )

  const allCountries = parseComparatorTextQuery('tous les pays', targets)
  assert.ok(allCountries.expression)
  assert.deepEqual(flattenComparatorQueryExpression(allCountries.expression), {
    clauses: [],
    relations: [],
    groups: [],
    constant: true
  })
  assert.equal(
    serializeComparatorTruthRelation('population > 10', 'capitale est Paris', [
      'both',
      'aOnly',
      'bOnly',
      'neither'
    ]),
    'tous les pays'
  )

  const simplified = parseComparatorTextQuery('tous les pays ou capitale est Paris', targets)
  assert.ok(simplified.expression)
  assert.deepEqual(flattenComparatorQueryExpression(simplified.expression), {
    clauses: [],
    relations: [],
    groups: [],
    constant: true
  })
})

test('suggests continent values and logical joins while typing', () => {
  const values = new Map([
    ['continent', ['Afrique', 'Asie', 'Europe']],
    ['population', ['1000000', '50000000']]
  ])
  assert.deepEqual(
    getComparatorQuerySuggestions('appartient Eur', targets, values).map(
      (suggestion) => suggestion.insertion
    ),
    ['appartient Europe ']
  )
  assert.deepEqual(
    getComparatorQuerySuggestions('appartient Europe ', targets, values).map(
      (suggestion) => suggestion.insertion
    ),
    ['appartient Europe et ', 'appartient Europe ou ']
  )
})

test('suggests fields first and completes the “n’est pas” operator', () => {
  const values = new Map([['continent', ['Afrique', 'Asie', 'Europe']]])
  const initial = getComparatorQuerySuggestions('', targets, values)
  assert.ok(initial.some((item) => item.label === 'continent'))
  assert.ok(!initial.some((item) => item.label === 'appartient'))
  assert.ok(initial.some((item) => item.insertion === 'non '))
  assert.ok(
    getComparatorQuerySuggestions('non ', targets, values).some(
      (item) => item.insertion === 'non continent '
    )
  )

  const completion = getComparatorQuerySuggestions('continent n’est p', targets, values)
  assert.ok(completion.some((item) => item.insertion === "continent n'est pas "))

  const valueCompletion = getComparatorQuerySuggestions('continent n’est pas Eur', targets, values)
  assert.ok(valueCompletion.some((item) => item.insertion === 'continent n’est pas Europe '))

  const closeParen = getComparatorQuerySuggestions('(continent est Europe ', targets, values)
  assert.ok(closeParen.some((item) => item.label === ')'))
})

test('rejects incomplete and unknown expressions without partial results', () => {
  const incomplete = parseComparatorTextQuery('population >', targets)
  assert.equal(incomplete.expression, null)
  assert.ok(incomplete.error)

  const unknownField = parseComparatorTextQuery('capital > London', targets)
  assert.equal(unknownField.expression, null)
  assert.ok(unknownField.error)
})
