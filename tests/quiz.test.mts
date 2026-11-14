import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import {
  buildCapitalQuestions,
  type CapitalCatalogEntry,
  type CapitalRecord
} from '../src/renderer/src/data/quiz/buildCapitalQuestions.ts'
import {
  advanceQuizSession,
  createQuizSession,
  submitQuizAnswer,
  submitQuizAnswerItems
} from '../src/renderer/src/data/quiz/useQuizSession.ts'
import { loadQuizProgress, saveCompletedQuiz } from '../src/renderer/src/data/quiz/progress.ts'
import {
  loadCountryQuizStats,
  saveCountryQuizStats,
  updateCountryQuizStats
} from '../src/renderer/src/data/quiz/countryQuizStats.ts'
import { getLabelPrecision } from '../src/renderer/src/data/geography/labelPrecision.ts'
import { geographicGeometryLinks } from '../src/renderer/src/data/geography/geometries.ts'

const catalog = JSON.parse(
  await readFile(
    new URL('../src/renderer/src/data/quiz/countryCatalog.json', import.meta.url),
    'utf8'
  )
) as CapitalCatalogEntry[]

const capitals = JSON.parse(
  await readFile(
    new URL('../src/renderer/src/data/quiz/countryCapitals.json', import.meta.url),
    'utf8'
  )
) as CapitalRecord[]

function setLocalStorage(initialValues: Record<string, string> = {}): void {
  const values = new Map(Object.entries(initialValues))
  const storage = {
    getItem(key: string): string | null {
      return values.get(key) ?? null
    },
    setItem(key: string, value: string): void {
      values.set(key, value)
    }
  }

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage
  })
}

test('le catalogue et les capitales couvrent les mêmes 195 pays', (): void => {
  const countryIds = catalog.map(({ sourceFeatureId }) => sourceFeatureId)
  const countryCodes = catalog.map(({ alpha2 }) => alpha2)
  const capitalIds = capitals.map(({ sourceFeatureId }) => sourceFeatureId)

  assert.equal(catalog.length, 195)
  assert.equal(new Set(countryIds).size, 195)
  assert.equal(new Set(countryCodes).size, 195)
  assert.equal(capitals.length, 195)
  assert.equal(new Set(capitalIds).size, 195)
  assert.deepEqual(new Set(capitalIds), new Set(countryIds))
  assert.ok(catalog.every(({ alpha2 }) => /^[A-Z]{2}$/.test(alpha2)))
  assert.ok(capitals.every(({ capitalName }) => capitalName.trim().length > 0))
})

test('chaque question de capitale propose quatre réponses uniques', (): void => {
  const questions = buildCapitalQuestions(catalog, capitals)

  assert.equal(questions.length, 195)
  for (const question of questions) {
    assert.equal(question.kind, 'capitals')
    assert.equal(question.choices.length, 4, question.countryName)
    assert.equal(new Set(question.choices).size, 4, question.countryName)
    assert.equal(
      question.choices.filter((choice) => choice === question.capitalName).length,
      1,
      question.countryName
    )
  }
})

test('la génération signale une capitale manquante', (): void => {
  assert.throws(() => buildCapitalQuestions(catalog.slice(0, 1), []), /Missing capital for/)
})

test('une session garde la question après erreur et réduit le score selon les essais', (): void => {
  const questions = ['A', 'B', 'C', 'D']
  let session = createQuizSession(questions)

  assert.deepEqual([...session.questionOrder].sort(), questions)
  assert.equal(session.questionIndex, 0)
  assert.equal(session.score, 0)
  assert.equal(session.attemptCount, 0)
  assert.equal(session.completed, false)

  session = submitQuizAnswer(session, false, 'incorrect')
  assert.equal(session.score, 0)
  assert.equal(session.attemptCount, 1)
  assert.equal(session.answerCorrect, false)
  session = submitQuizAnswer(session, true, 'correct')
  assert.equal(session.score, 0.5)
  assert.equal(session.attemptCount, 2)
  assert.equal(session.answerCorrect, true)
  assert.equal(submitQuizAnswer(session, true), session)

  session = advanceQuizSession(session)
  assert.equal(session.questionIndex, 1)
  assert.equal(session.attemptCount, 0)
  assert.equal(session.answerCorrect, null)
  assert.equal(session.selectedAnswer, null)

  session = submitQuizAnswer(session, true)
  assert.equal(session.score, 1.5)
  session = advanceQuizSession(session)
  session = submitQuizAnswer(session, false)
  assert.equal(advanceQuizSession(session), session)
  session = submitQuizAnswer(session, false)
  session = submitQuizAnswer(session, true)
  assert.equal(session.score, 1.75)
  assert.equal(session.attemptCount, 3)
  session = advanceQuizSession(session)

  session = submitQuizAnswer(session, false)
  session = submitQuizAnswer(session, false)
  session = submitQuizAnswer(session, false)
  session = submitQuizAnswer(session, true)
  assert.equal(session.score, 1.75)
  assert.equal(session.attemptCount, 4)
  session = advanceQuizSession(session)
  assert.equal(session.completed, true)
  assert.equal(session.score, 1.75)
  assert.equal(advanceQuizSession(session), session)
})

test('une question combinée répartit son point et garde les essais séparés par réponse', (): void => {
  const weights = { countryOnMap: 1 / 3, flag: 1 / 3, capital: 1 / 3 }
  let session = createQuizSession(['question'], weights)

  session = submitQuizAnswerItems(session, { countryOnMap: true, flag: false })
  assert.equal(session.score, 1 / 3)
  assert.equal(session.answerResults.countryOnMap, true)
  assert.equal(session.answerResults.flag, false)
  assert.equal(session.answerResults.capital, null)

  session = submitQuizAnswerItems(session, { flag: true })
  assert.equal(session.score, 1 / 3 + 0.5 / 3)
  assert.equal(session.answerAttempts.flag, 2)
  assert.equal(session.answerResults.flag, true)

  session = submitQuizAnswerItems(session, { capital: false })
  session = submitQuizAnswerItems(session, { capital: true })
  assert.equal(session.score, 1 / 3 + 0.5 / 3 + 0.5 / 3)
  assert.equal(session.answerAttempts.capital, 2)
  assert.equal(session.answerCorrect, true)
})

test('la progression sauvegarde les scores séparément par quiz', (): void => {
  setLocalStorage()

  saveCompletedQuiz('flags', 12)
  saveCompletedQuiz('capitals', 8)
  saveCompletedQuiz('flags', 10)
  const progress = loadQuizProgress()

  assert.deepEqual(progress.flags, {
    completedSessions: 2,
    bestScore: 12,
    lastScore: 10
  })
  assert.deepEqual(progress.capitals, {
    completedSessions: 1,
    bestScore: 8,
    lastScore: 8
  })
  assert.deepEqual(loadQuizProgress(), progress)
})

test('les scores décimaux restent lisibles après rechargement', (): void => {
  setLocalStorage()

  saveCompletedQuiz('custom', 1.75)
  assert.deepEqual(loadQuizProgress().custom, {
    completedSessions: 1,
    bestScore: 1.75,
    lastScore: 1.75
  })
})

test('les statistiques par pays suivent les bonnes réponses et le mode de quiz', (): void => {
  setLocalStorage()

  const initial = loadCountryQuizStats()
  const afterCorrect = updateCountryQuizStats(initial, 'fr', 'capitals', true)
  const afterWrong = updateCountryQuizStats(afterCorrect, 'FR', 'flags', false)
  saveCountryQuizStats(afterWrong)

  assert.deepEqual(loadCountryQuizStats().FR, {
    answered: 2,
    correct: 1,
    pointsEarned: 1,
    pointsPossible: 2,
    byMode: {
      flags: { answered: 1, correct: 0, pointsEarned: 0, pointsPossible: 1 },
      capitals: { answered: 1, correct: 1, pointsEarned: 1, pointsPossible: 1 },
      custom: { answered: 0, correct: 0, pointsEarned: 0, pointsPossible: 0 },
      knowledge: { answered: 0, correct: 0, pointsEarned: 0, pointsPossible: 0 }
    },
    byAnswer: {}
  })
})

test('les statistiques distinguent les éléments d’une question personnalisée', (): void => {
  setLocalStorage()
  const points = 1 / 3
  const result = {
    pointsEarned: points,
    answers: [
      { id: 'countryOnMap', correct: true, pointsEarned: 1 },
      { id: 'flag', correct: false, pointsEarned: 0 },
      { id: 'capital', correct: false, pointsEarned: 0 }
    ]
  }
  const updated = updateCountryQuizStats(loadCountryQuizStats(), 'FR', 'custom', false, result)
  saveCountryQuizStats(updated)

  const france = loadCountryQuizStats().FR
  assert.ok(france)
  assert.equal(france.correct, 0)
  assert.equal(france.pointsEarned, points)
  assert.equal(france.pointsPossible, 1)
  assert.deepEqual(france.byAnswer.countryOnMap, {
    answered: 1,
    correct: 1,
    pointsEarned: 1,
    pointsPossible: 1
  })
  assert.deepEqual(france.byAnswer.flag, {
    answered: 1,
    correct: 0,
    pointsEarned: 0,
    pointsPossible: 1
  })
  assert.equal(france.byMode.custom.pointsEarned, points)
})

test('les anciennes statistiques restent lisibles sans fabriquer de détails par élément', (): void => {
  setLocalStorage({
    'world-atlas:country-quiz-stats:v1': JSON.stringify({
      FR: {
        answered: 3,
        correct: 2,
        byMode: {
          flags: { answered: 2, correct: 2 },
          capitals: { answered: 1, correct: 0 }
        }
      }
    })
  })

  const france = loadCountryQuizStats().FR
  assert.ok(france)
  assert.equal(france.pointsEarned, 2)
  assert.equal(france.pointsPossible, 3)
  assert.equal(france.byMode.flags.pointsEarned, 2)
  assert.equal(france.byMode.capitals.pointsPossible, 1)
  assert.deepEqual(france.byAnswer, {})
})

test('la progression v2 des drapeaux est reprise sans inventer un score capitales', (): void => {
  setLocalStorage({
    'world-atlas:quiz-progress:v2': JSON.stringify({
      completedCountryFlagSessions: 3,
      bestCountryFlagScore: 17,
      lastCountryFlagScore: 11
    })
  })

  assert.deepEqual(loadQuizProgress(), {
    flags: { completedSessions: 3, bestScore: 17, lastScore: 11 },
    capitals: { completedSessions: 0, bestScore: 0, lastScore: 0 },
    custom: { completedSessions: 0, bestScore: 0, lastScore: 0 },
    knowledge: { completedSessions: 0, bestScore: 0, lastScore: 0 }
  })
})

test('la progression v1 des drapeaux reste lisible', (): void => {
  setLocalStorage({
    'world-atlas:quiz-progress:v1': JSON.stringify({
      completedFlagSessions: 2,
      bestFlagScore: 15,
      lastFlagScore: 9
    })
  })

  assert.deepEqual(loadQuizProgress(), {
    flags: { completedSessions: 2, bestScore: 15, lastScore: 9 },
    capitals: { completedSessions: 0, bestScore: 0, lastScore: 0 },
    custom: { completedSessions: 0, bestScore: 0, lastScore: 0 },
    knowledge: { completedSessions: 0, bestScore: 0, lastScore: 0 }
  })
})

test('la précision des étiquettes augmente avec le zoom', (): void => {
  assert.equal(getLabelPrecision(1.5), 0.05)
  assert.ok(getLabelPrecision(8) < getLabelPrecision(5))
  assert.equal(getLabelPrecision(12), 0.00034332275390625)
  assert.equal(getLabelPrecision(Number.NaN), 0.05)
})

test('les polygones ultramarins de France gardent leur entité par résolution', (): void => {
  const territoryAt = (resolution: string, index: number): string | undefined =>
    geographicGeometryLinks.find(
      (link) =>
        link.sourceId === `natural-earth-${resolution}` &&
        link.sourceFeatureId === 250 &&
        link.sourcePolygonIndex === index
    )?.entityId

  assert.equal(territoryAt('110m', 0), 'territory:guyane')
  assert.equal(territoryAt('50m', 0), undefined)
  assert.equal(territoryAt('50m', 9), 'territory:guyane')
  assert.equal(territoryAt('50m', 6), 'territory:guadeloupe')
  assert.equal(territoryAt('10m', 0), 'territory:guyane')
  assert.equal(territoryAt('10m', 6), 'territory:guadeloupe')
  assert.equal(territoryAt('10m', 2), 'territory:martinique')
})
