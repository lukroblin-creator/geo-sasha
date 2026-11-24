import assert from 'node:assert/strict'
import test from 'node:test'
import type { CountryQuizStats } from '../src/renderer/src/data/quiz/countryQuizStats.ts'
import type { QuizHistoryEntry } from '../src/renderer/src/data/quiz/quizHistory.ts'
import {
  countHistorySessionsByMode,
  getCountryStatsForRegion,
  getQuizHistoryForContinent
} from '../src/renderer/src/data/quiz/regionalStatistics.ts'

function countryStats(): CountryQuizStats {
  const metric = { answered: 1, correct: 1, pointsEarned: 1, pointsPossible: 1 }
  return {
    ...metric,
    byMode: {
      flags: metric,
      capitals: metric,
      custom: metric,
      knowledge: metric,
      estimation: { answered: 0, correct: 0, pointsEarned: 0, pointsPossible: 0 },
      'draw-borders': { answered: 0, correct: 0, pointsEarned: 0, pointsPossible: 0 }
    },
    byAnswer: {}
  }
}

function entry(
  id: string,
  mode: QuizHistoryEntry['mode'],
  questions: QuizHistoryEntry['questions'] = [],
  configuration?: Record<string, unknown>
): QuizHistoryEntry {
  return {
    id,
    completedAt: '2026-11-24T10:00:00.000Z',
    mode,
    score: 1,
    total: 1,
    presetId: null,
    presetName: null,
    region: 'Monde entier',
    settings: [],
    questions,
    ...(configuration ? { comparisonKey: JSON.stringify({ configuration }) } : {})
  }
}

const franceQuestion = {
  alpha2: 'FR',
  countryName: 'France',
  prompt: 'Pays',
  answer: 'France',
  selectedAnswer: 'France',
  correct: true,
  revealed: false,
  attempts: 1,
  points: 1
}

test('les statistiques pays se limitent au continent choisi', (): void => {
  const stats = { FR: countryStats(), JP: countryStats(), US: countryStats() }

  assert.deepEqual(Object.keys(getCountryStatsForRegion(stats, 'europe')), ['FR'])
  assert.equal(getCountryStatsForRegion(stats, 'world'), stats)
})

test('une session de quiz mixte est attribuée aux continents des questions enregistrées', (): void => {
  const mixed = entry('mixed', 'flags', [
    franceQuestion,
    { ...franceQuestion, alpha2: 'JP', countryName: 'Japan' }
  ])

  assert.deepEqual(getQuizHistoryForContinent([mixed], 'europe'), [mixed])
  assert.deepEqual(getQuizHistoryForContinent([mixed], 'asia'), [mixed])
  assert.deepEqual(countHistorySessionsByMode([mixed]), {
    flags: 1,
    capitals: 0,
    custom: 0,
    knowledge: 0,
    estimation: 0,
    'draw-borders': 0
  })
})

test('estimation et frontières ne sont attribués que si leur configuration cible le continent', (): void => {
  const europeanEstimation = entry('est-europe', 'estimation', [], {
    gameMode: 'estimation',
    region: 'europe',
    alpha2s: []
  })
  const selectedEuropeanCountries = entry('est-selected', 'estimation', [], {
    gameMode: 'estimation',
    region: 'world',
    alpha2s: ['FR', 'DE']
  })
  const mixedEstimation = entry('est-mixed', 'estimation', [], {
    gameMode: 'estimation',
    region: 'world',
    alpha2s: ['FR', 'JP']
  })
  const europeanBorders = entry('borders-europe', 'draw-borders', [], {
    gameMode: 'draw-borders',
    continents: ['europe']
  })
  const mixedBorders = entry('borders-mixed', 'draw-borders', [], {
    gameMode: 'draw-borders',
    continents: ['europe', 'asia']
  })
  const oldWithoutConfiguration = entry('old-estimation', 'estimation')
  const history = [
    europeanEstimation,
    selectedEuropeanCountries,
    mixedEstimation,
    europeanBorders,
    mixedBorders,
    oldWithoutConfiguration
  ]

  assert.deepEqual(getQuizHistoryForContinent(history, 'europe'), [
    europeanEstimation,
    selectedEuropeanCountries,
    europeanBorders
  ])
  assert.deepEqual(getQuizHistoryForContinent(history, 'asia'), [])
})
