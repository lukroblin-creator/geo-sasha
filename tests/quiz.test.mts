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
  submitQuizAnswer
} from '../src/renderer/src/data/quiz/useQuizSession.ts'
import {
  loadQuizProgress,
  saveCompletedQuiz
} from '../src/renderer/src/data/quiz/progress.ts'

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
  assert.throws(
    () => buildCapitalQuestions(catalog.slice(0, 1), []),
    /Missing capital for/
  )
})

test('une session mélange les questions et gère les réponses et la fin', (): void => {
  const questions = ['A', 'B', 'C']
  let session = createQuizSession(questions)

  assert.deepEqual([...session.questionOrder].sort(), questions)
  assert.equal(session.questionIndex, 0)
  assert.equal(session.score, 0)
  assert.equal(session.completed, false)

  session = submitQuizAnswer(session, false, 'incorrect')
  assert.equal(session.score, 0)
  assert.equal(session.answerCorrect, false)
  session = submitQuizAnswer(session, true, 'correct')
  assert.equal(session.score, 1)
  assert.equal(session.answerCorrect, true)
  assert.equal(submitQuizAnswer(session, true), session)

  session = advanceQuizSession(session)
  assert.equal(session.questionIndex, 1)
  assert.equal(session.answerCorrect, null)
  assert.equal(session.selectedAnswer, null)

  session = submitQuizAnswer(session, true)
  session = advanceQuizSession(session)
  session = submitQuizAnswer(session, false)
  session = advanceQuizSession(session)
  assert.equal(session.completed, true)
  assert.equal(session.score, 2)
  assert.equal(advanceQuizSession(session), session)
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
    capitals: { completedSessions: 0, bestScore: 0, lastScore: 0 }
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
    capitals: { completedSessions: 0, bestScore: 0, lastScore: 0 }
  })
})
