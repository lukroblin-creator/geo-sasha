import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  QuizHistoryEntry,
  QuizHistoryQuestion
} from '../src/renderer/src/data/quiz/quizHistory.ts'
import {
  calculateQuizAchievements,
  type QuizAchievementProgress
} from '../src/renderer/src/data/quiz/quizRewards.ts'

type EntryOverrides = Partial<
  Pick<QuizHistoryEntry, 'mode' | 'score' | 'total' | 'questions' | 'comparisonKey' | 'timing'>
>

function question(overrides: Partial<QuizHistoryQuestion> = {}): QuizHistoryQuestion {
  return {
    alpha2: 'FR',
    countryName: 'France',
    prompt: 'Pays à retrouver',
    answer: 'France',
    selectedAnswer: 'France',
    correct: true,
    revealed: false,
    attempts: 1,
    points: 1,
    ...overrides
  }
}

function entry(id: string, completedAt: string, overrides: EntryOverrides = {}): QuizHistoryEntry {
  return {
    id,
    completedAt,
    mode: 'flags',
    score: 1,
    total: 1,
    presetId: null,
    presetName: null,
    region: 'Tous les continents',
    settings: [],
    questions: Array.from({ length: overrides.total ?? 1 }, () => question()),
    ...overrides
  }
}

function achievement(history: readonly QuizHistoryEntry[], id: string): QuizAchievementProgress {
  const result = calculateQuizAchievements(history).find((item) => item.id === id)
  assert.ok(result, `achievement ${id} should exist`)
  return result
}

test('les accomplissements de départ et de polyvalence progressent avec les parties terminées', (): void => {
  const history = [
    entry('a', '2026-11-01T10:00:00.000Z', { mode: 'flags' }),
    entry('b', '2026-11-02T10:00:00.000Z', { mode: 'capitals' })
  ]

  assert.deepEqual(
    [achievement(history, 'first-game').current, achievement(history, 'first-game').unlocked],
    [1, true]
  )
  assert.equal(achievement(history, 'versatile-player').current, 2)
  assert.equal(achievement(history, 'versatile-player').unlocked, false)
  assert.equal(
    achievement(
      [...history, entry('c', '2026-11-03T10:00:00.000Z', { mode: 'estimation' })],
      'versatile-player'
    ).unlocked,
    true
  )
})

test('la précision utilise les points réellement gagnés et garde une progression partielle', (): void => {
  const partial = entry('partial', '2026-11-01T10:00:00.000Z', {
    score: 1.5,
    total: 2,
    questions: [question({ points: 1 }), question({ points: 0.5, correct: false, attempts: 2 })]
  })
  const progress = achievement([partial], 'precision')

  assert.equal(progress.current, 75)
  assert.equal(progress.target, 90)
  assert.equal(progress.unlocked, false)
  const nearThreshold = entry('near-threshold', '2026-11-03T10:00:00.000Z', {
    score: 1.79,
    total: 2,
    questions: [question({ points: 1 }), question({ points: 0.79 })]
  })
  assert.equal(achievement([nearThreshold], 'precision').current, 89.5)
  assert.equal(achievement([nearThreshold], 'precision').unlocked, false)
  assert.equal(
    achievement(
      [entry('precise', '2026-11-02T10:00:00.000Z', { score: 9, total: 10 })],
      'precision'
    ).unlocked,
    true
  )
})

test('la partie longue mesure les questions et exclut les modes dont total représente des points', (): void => {
  const shortGame = entry('short', '2026-11-01T10:00:00.000Z', {
    total: 24,
    questions: Array.from({ length: 24 }, () => question())
  })
  assert.equal(achievement([shortGame], 'long-quiz').current, 24)
  assert.equal(achievement([shortGame], 'long-quiz').unlocked, false)

  const longGame = entry('long', '2026-11-02T10:00:00.000Z', {
    total: 25,
    questions: Array.from({ length: 25 }, () => question())
  })
  assert.equal(achievement([longGame], 'long-quiz').unlocked, true)
  assert.equal(achievement([longGame], 'long-quiz').unlockedAt, longGame.completedAt)

  const specialMode = entry('estimation', '2026-11-03T10:00:00.000Z', {
    mode: 'estimation',
    total: 100,
    score: 100,
    questions: []
  })
  assert.equal(achievement([specialMode], 'long-quiz').current, 0)
})

test('une série ne compte que les bonnes réponses du premier coup sans aide', (): void => {
  const fiveCleanAnswers = Array.from({ length: 5 }, (_, index) =>
    question({ countryName: `Pays ${index}` })
  )
  const clean = entry('clean', '2026-11-01T10:00:00.000Z', {
    questions: fiveCleanAnswers,
    score: 5,
    total: 5
  })
  assert.equal(achievement([clean], 'clean-streak').unlocked, true)

  const broken = entry('broken', '2026-11-02T10:00:00.000Z', {
    questions: [
      ...fiveCleanAnswers.slice(0, 2),
      question({ correct: true, revealed: true }),
      ...fiveCleanAnswers.slice(3)
    ],
    score: 5,
    total: 5
  })
  assert.equal(achievement([broken], 'clean-streak').current, 2)
  assert.equal(achievement([broken], 'clean-streak').unlocked, false)
})

test('les modes sans détail de réponse interrompent une série mesurable', (): void => {
  const history = [
    entry('before-special', '2026-11-01T10:00:00.000Z', {
      total: 2,
      questions: [question(), question()]
    }),
    entry('special', '2026-11-02T10:00:00.000Z', {
      mode: 'estimation',
      score: 100,
      total: 100,
      questions: []
    }),
    entry('after-special', '2026-11-03T10:00:00.000Z', {
      total: 3,
      questions: [question(), question(), question()]
    })
  ]

  assert.equal(achievement(history, 'clean-streak').current, 3)
  assert.equal(achievement(history, 'clean-streak').unlocked, false)
  assert.equal(achievement(history, 'versatile-player').current, 2)
})

test('les expirations et historiques partiels ne donnent pas de récompense de performance', (): void => {
  const timedOut = entry('expired', '2026-11-01T10:00:00.000Z', {
    score: 1,
    total: 1,
    timing: {
      settings: { mode: 'countdown', scope: 'session', limitSeconds: 60 },
      elapsedMilliseconds: 60_000,
      remainingMilliseconds: 0,
      expired: true,
      timedOutQuestions: 1,
      notReachedQuestions: 0
    },
    questions: [question({ status: 'timed-out' })]
  })
  const incomplete = entry('incomplete', '2026-11-02T10:00:00.000Z', {
    score: 1,
    total: 1,
    questions: [question({ status: 'not-reached' })]
  })

  assert.equal(achievement([timedOut, incomplete], 'first-game').unlocked, false)
  assert.equal(achievement([timedOut, incomplete], 'precision').current, 0)
  assert.equal(achievement([timedOut, incomplete], 'clean-streak').current, 0)

  const missingQuestionRows = entry('missing-rows', '2026-11-03T10:00:00.000Z', {
    score: 10,
    total: 10,
    questions: [question()]
  })
  assert.equal(achievement([missingQuestionRows], 'first-game').unlocked, false)
})

test('un historique ancien sans timing reste exploitable sans durée inventée', (): void => {
  const legacy = entry('legacy', '2026-11-01T10:00:00.000Z', {
    score: 8,
    total: 10,
    questions: Array.from({ length: 10 }, () => question())
  })
  const achievements = calculateQuizAchievements([legacy])

  assert.equal(achievement([legacy], 'first-game').unlocked, true)
  assert.equal(achievement([legacy], 'precision').current, 80)
  assert.equal(achievement([legacy], 'quick-and-accurate').current, 0)
  assert.equal(achievements.find(({ id }) => id === 'first-game')?.unlockedAt, legacy.completedAt)
})

test('les records personnels comparent uniquement une même configuration et ignorent les entrées anciennes sans clé', (): void => {
  const initial = entry('old', '2026-11-01T10:00:00.000Z', {
    score: 6,
    total: 10,
    comparisonKey: 'same'
  })
  const legacy = entry('legacy', '2026-11-02T10:00:00.000Z', {
    score: 10,
    total: 10
  })
  const unrelated = entry('other', '2026-11-03T10:00:00.000Z', {
    score: 10,
    total: 10,
    comparisonKey: 'other'
  })
  assert.equal(achievement([initial, legacy, unrelated], 'personal-best').unlocked, false)

  const improvement = entry('improved', '2026-11-04T10:00:00.000Z', {
    score: 8,
    total: 10,
    comparisonKey: 'same'
  })
  const result = achievement([initial, legacy, unrelated, improvement], 'personal-best')
  assert.equal(result.unlocked, true)
  assert.equal(result.unlockedAt, improvement.completedAt)
})

test('le badge chrono exige une partie rapide, précise et terminée', (): void => {
  const timing = {
    settings: { mode: 'stopwatch' as const, scope: 'session' as const, limitSeconds: 60 },
    elapsedMilliseconds: 30_000,
    remainingMilliseconds: null,
    expired: false,
    timedOutQuestions: 0,
    notReachedQuestions: 0
  }
  const quick = entry('quick', '2026-11-01T10:00:00.000Z', {
    score: 9,
    total: 10,
    questions: Array.from({ length: 10 }, () => question()),
    timing
  })
  assert.equal(achievement([quick], 'quick-and-accurate').unlocked, true)

  const slow = entry('slow', '2026-11-02T10:00:00.000Z', {
    score: 10,
    total: 10,
    questions: Array.from({ length: 10 }, () => question()),
    timing: { ...timing, elapsedMilliseconds: 151_000 }
  })
  assert.equal(achievement([slow], 'quick-and-accurate').unlocked, false)
  assert.deepEqual(calculateQuizAchievements([quick]), calculateQuizAchievements([quick]))
})

test('un accomplissement obtenu reste indépendant des recalculs et sa date reste absente si elle est invalide', (): void => {
  const invalidDate = entry('undated', 'date inconnue', { score: 9, total: 10 })
  const earned = achievement([invalidDate], 'precision')

  assert.equal(earned.unlocked, true)
  assert.equal(earned.unlockedAt, null)
  assert.deepEqual(
    calculateQuizAchievements([invalidDate]),
    calculateQuizAchievements([invalidDate])
  )
})
