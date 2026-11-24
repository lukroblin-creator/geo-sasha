import { useState } from 'react'
import type { QuizMode } from './progress'

export type QuizSession<Question> = {
  questionOrder: Question[]
  questionIndex: number
  score: number
  attemptCount: number
  answerWeights: Record<string, number>
  answerAttempts: Record<string, number>
  answerResults: Record<string, boolean | null>
  answerPoints: Record<string, number>
  answerCorrect: boolean | null
  answerRevealed: boolean
  answerTimedOut: boolean
  selectedAnswer: string | null
  questionHistory: Array<{
    question: Question
    correct: boolean
    revealed: boolean
    selectedAnswer: string | null
    answerResults: Record<string, boolean | null>
    answerAttempts: Record<string, number>
    answerPoints: Record<string, number>
    timedOut?: boolean
    notReached?: boolean
  }>
  completed: boolean
}

export function shuffleItems<T>(items: readonly T[]): T[] {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]]
  }

  return shuffled
}

export function createQuizSession<Question>(
  questionBank: readonly Question[],
  answerWeights: Record<string, number> = { answer: 1 }
): QuizSession<Question> {
  const validWeights = Object.entries(answerWeights).filter(
    ([, weight]) => Number.isFinite(weight) && weight > 0
  )
  const weightTotal = validWeights.reduce((sum, [, weight]) => sum + weight, 0)
  const normalizedWeights =
    weightTotal > 0
      ? Object.fromEntries(validWeights.map(([key, weight]) => [key, weight / weightTotal]))
      : { answer: 1 }

  return {
    questionOrder: shuffleItems(questionBank),
    questionIndex: 0,
    score: 0,
    attemptCount: 0,
    answerWeights: normalizedWeights,
    answerAttempts: Object.fromEntries(Object.keys(normalizedWeights).map((key) => [key, 0])),
    answerResults: Object.fromEntries(Object.keys(normalizedWeights).map((key) => [key, null])),
    answerPoints: Object.fromEntries(Object.keys(normalizedWeights).map((key) => [key, 0])),
    answerCorrect: null,
    answerRevealed: false,
    answerTimedOut: false,
    selectedAnswer: null,
    questionHistory: [],
    completed: false
  }
}

export function submitQuizAnswer<Question>(
  session: QuizSession<Question>,
  isCorrect: boolean,
  selectedAnswer: string | null = null
): QuizSession<Question> {
  return submitQuizAnswerItems(session, { answer: isCorrect }, selectedAnswer)
}

export function submitQuizAnswerItems<Question>(
  session: QuizSession<Question>,
  outcomes: Record<string, boolean>,
  selectedAnswer: string | null = null
): QuizSession<Question> {
  if (session.completed || session.answerCorrect === true || session.answerRevealed) return session

  const answerAttempts = { ...session.answerAttempts }
  const answerResults = { ...session.answerResults }
  const answerPoints = { ...session.answerPoints }
  let scoreIncrease = 0
  let changed = false

  for (const [key, isCorrect] of Object.entries(outcomes)) {
    if (!(key in session.answerWeights) || answerResults[key] === true) continue

    const attempts = (answerAttempts[key] ?? 0) + 1
    const points = isCorrect ? getQuizAttemptPoints(attempts) : 0
    answerAttempts[key] = attempts
    answerResults[key] = isCorrect
    answerPoints[key] = points
    scoreIncrease += (session.answerWeights[key] ?? 0) * points
    changed = true
  }

  if (!changed) return session

  const answerKeys = Object.keys(session.answerWeights)
  const answerCorrect = answerKeys.every((key) => answerResults[key] === true)
    ? true
    : answerKeys.some((key) => answerResults[key] === false)
      ? false
      : null

  return {
    ...session,
    score: session.score + scoreIncrease,
    attemptCount: session.attemptCount + 1,
    answerAttempts,
    answerResults,
    answerPoints,
    answerCorrect,
    selectedAnswer
  }
}

export function submitQuizPartialAnswer<Question>(
  session: QuizSession<Question>,
  key: string,
  pointsEarned: number,
  outcome: 'progress' | 'correct' | 'incorrect',
  selectedAnswer: string | null = null
): QuizSession<Question> {
  if (
    session.completed ||
    session.answerCorrect === true ||
    session.answerRevealed ||
    !(key in session.answerWeights)
  ) {
    return session
  }

  const isFailedOrCompletedSubmission = outcome !== 'progress'
  const answerAttempts = {
    ...session.answerAttempts,
    [key]: (session.answerAttempts[key] ?? 0) + (isFailedOrCompletedSubmission ? 1 : 0)
  }
  const answerResults = { ...session.answerResults }
  const answerPoints = { ...session.answerPoints }
  const previousPoints = answerPoints[key] ?? 0
  const nextPoints =
    outcome === 'incorrect' ? 0 : Math.min(1, previousPoints + Math.max(0, pointsEarned))
  answerPoints[key] = nextPoints
  if (outcome === 'progress') answerResults[key] = null
  if (outcome === 'correct') answerResults[key] = true
  if (outcome === 'incorrect') answerResults[key] = false

  const answerKeys = Object.keys(session.answerWeights)
  const answerCorrect = answerKeys.every((answerKey) => answerResults[answerKey] === true)
    ? true
    : answerKeys.some((answerKey) => answerResults[answerKey] === false)
      ? false
      : null
  const scoreDelta = (nextPoints - previousPoints) * (session.answerWeights[key] ?? 0)

  return {
    ...session,
    score: Math.max(0, session.score + scoreDelta),
    attemptCount: session.attemptCount + (isFailedOrCompletedSubmission ? 1 : 0),
    answerAttempts,
    answerResults,
    answerPoints,
    answerCorrect,
    selectedAnswer
  }
}

export function getQuizAttemptPoints(attemptCount: number): number {
  if (attemptCount <= 1) return 1
  if (attemptCount === 2) return 0.5
  if (attemptCount === 3) return 0.25
  return 0
}

export function formatQuizScore(score: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(score)
}

export function revealQuizAnswer<Question>(session: QuizSession<Question>): QuizSession<Question> {
  if (session.completed || session.answerCorrect === true || session.answerRevealed) {
    return session
  }

  return { ...session, answerRevealed: true }
}

export function timeoutQuizQuestion<Question>(
  session: QuizSession<Question>
): QuizSession<Question> {
  if (session.completed || session.answerCorrect === true || session.answerRevealed) return session
  return { ...session, answerRevealed: true, answerTimedOut: true }
}

function questionHistoryRow<Question>(
  session: QuizSession<Question>,
  question: Question,
  status: { timedOut?: boolean; notReached?: boolean } = {}
): QuizSession<Question>['questionHistory'][number] {
  return {
    question,
    correct: session.answerCorrect === true,
    revealed: session.answerRevealed,
    selectedAnswer: session.selectedAnswer,
    answerResults: { ...session.answerResults },
    answerAttempts: { ...session.answerAttempts },
    answerPoints: { ...session.answerPoints },
    ...(status.timedOut ? { timedOut: true } : {}),
    ...(status.notReached ? { notReached: true } : {})
  }
}

export function finishQuizSessionByTimeout<Question>(
  session: QuizSession<Question>
): QuizSession<Question> {
  if (session.completed) return session
  const questionHistory = [...session.questionHistory]
  const currentQuestion = session.questionOrder[session.questionIndex]
  if (currentQuestion) {
    questionHistory.push(
      questionHistoryRow(session, currentQuestion, {
        timedOut: session.answerCorrect !== true && !session.answerRevealed
      })
    )
  }
  const unansweredSession: QuizSession<Question> = {
    ...session,
    answerCorrect: null,
    answerRevealed: false,
    answerTimedOut: false,
    selectedAnswer: null,
    answerResults: Object.fromEntries(Object.keys(session.answerWeights).map((key) => [key, null])),
    answerAttempts: Object.fromEntries(Object.keys(session.answerWeights).map((key) => [key, 0])),
    answerPoints: Object.fromEntries(Object.keys(session.answerWeights).map((key) => [key, 0]))
  }
  for (const question of session.questionOrder.slice(session.questionIndex + 1)) {
    questionHistory.push(questionHistoryRow(unansweredSession, question, { notReached: true }))
  }
  return { ...session, questionHistory, completed: true }
}

export function advanceQuizSession<Question>(
  session: QuizSession<Question>
): QuizSession<Question> {
  if (session.completed || (session.answerCorrect !== true && !session.answerRevealed))
    return session

  const question = session.questionOrder[session.questionIndex]
  const questionHistory =
    question === undefined
      ? session.questionHistory
      : [
          ...session.questionHistory,
          questionHistoryRow(session, question, { timedOut: session.answerTimedOut })
        ]

  if (session.questionIndex === session.questionOrder.length - 1) {
    return { ...session, questionHistory, completed: true }
  }

  return {
    ...session,
    questionHistory,
    questionIndex: session.questionIndex + 1,
    attemptCount: 0,
    answerAttempts: Object.fromEntries(Object.keys(session.answerWeights).map((key) => [key, 0])),
    answerResults: Object.fromEntries(Object.keys(session.answerWeights).map((key) => [key, null])),
    answerPoints: Object.fromEntries(Object.keys(session.answerWeights).map((key) => [key, 0])),
    answerCorrect: null,
    answerRevealed: false,
    answerTimedOut: false,
    selectedAnswer: null
  }
}

type UseQuizSessionOptions<Question> = {
  mode: QuizMode
  questionBank: () => readonly Question[]
  onCompleted: (
    mode: QuizMode,
    score: number,
    total: number,
    questionHistory: QuizSession<Question>['questionHistory']
  ) => void
}

type UseQuizSessionResult<Question> = {
  session: QuizSession<Question>
  answer: (isCorrect: boolean, selectedAnswer?: string | null) => void
  answerItems: (outcomes: Record<string, boolean>, selectedAnswer?: string | null) => void
  answerPartial: (
    key: string,
    pointsEarned: number,
    outcome: 'progress' | 'correct' | 'incorrect',
    selectedAnswer?: string | null
  ) => void
  timeoutCurrent: () => void
  finishByTimeout: () => void
  revealAnswer: () => void
  next: () => void
  restart: (questions?: readonly Question[], answerWeights?: Record<string, number>) => void
}

export function useQuizSession<Question>({
  mode,
  questionBank,
  onCompleted
}: UseQuizSessionOptions<Question>): UseQuizSessionResult<Question> {
  const [session, setSession] = useState(() => createQuizSession(questionBank()))

  const answer = (isCorrect: boolean, selectedAnswer: string | null = null): void => {
    setSession((current) => submitQuizAnswer(current, isCorrect, selectedAnswer))
  }

  const answerItems = (
    outcomes: Record<string, boolean>,
    selectedAnswer: string | null = null
  ): void => {
    setSession((current) => submitQuizAnswerItems(current, outcomes, selectedAnswer))
  }

  const answerPartial = (
    key: string,
    pointsEarned: number,
    outcome: 'progress' | 'correct' | 'incorrect',
    selectedAnswer: string | null = null
  ): void => {
    setSession((current) =>
      submitQuizPartialAnswer(current, key, pointsEarned, outcome, selectedAnswer)
    )
  }

  const next = (): void => {
    const updated = advanceQuizSession(session)
    if (updated === session) return

    if (updated.completed) {
      onCompleted(mode, session.score, session.questionOrder.length, updated.questionHistory)
    }

    setSession(updated)
  }

  const timeoutCurrent = (): void => {
    setSession((current) => timeoutQuizQuestion(current))
  }

  const finishByTimeout = (): void => {
    const updated = finishQuizSessionByTimeout(session)
    if (updated === session) return
    onCompleted(mode, updated.score, updated.questionHistory.length, updated.questionHistory)
    setSession(updated)
  }

  const revealAnswer = (): void => {
    setSession((current) => revealQuizAnswer(current))
  }

  const restart = (
    questions?: readonly Question[],
    answerWeights?: Record<string, number>
  ): void => {
    setSession(createQuizSession(questions ?? questionBank(), answerWeights))
  }

  return {
    session,
    answer,
    answerItems,
    answerPartial,
    timeoutCurrent,
    finishByTimeout,
    revealAnswer,
    next,
    restart
  }
}
