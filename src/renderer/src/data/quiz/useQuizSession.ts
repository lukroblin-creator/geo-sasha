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
  selectedAnswer: string | null
  completed: boolean
}

export function shuffleItems<T>(items: readonly T[]): T[] {
  const shuffled = [...items]

  for (let index = shuffled.length - 1; index > 0; index--) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index]
    ]
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
  const normalizedWeights = weightTotal > 0
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
    selectedAnswer: null,
    completed: false
  }
}

export function submitQuizAnswer<Question>(
  session: QuizSession<Question>,
  isCorrect: boolean,
  selectedAnswer: string | null = null
): QuizSession<Question> {
  return submitQuizAnswerItems(
    session,
    { answer: isCorrect },
    selectedAnswer
  )
}

export function submitQuizAnswerItems<Question>(
  session: QuizSession<Question>,
  outcomes: Record<string, boolean>,
  selectedAnswer: string | null = null
): QuizSession<Question> {
  if (
    session.completed ||
    session.answerCorrect === true ||
    session.answerRevealed
  ) return session

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

export function getQuizAttemptPoints(attemptCount: number): number {
  if (attemptCount <= 1) return 1
  if (attemptCount === 2) return 0.5
  if (attemptCount === 3) return 0.25
  return 0
}

export function formatQuizScore(score: number, language: string): string {
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(score)
}

export function revealQuizAnswer<Question>(
  session: QuizSession<Question>
): QuizSession<Question> {
  if (session.completed || session.answerCorrect === true || session.answerRevealed) {
    return session
  }

  return { ...session, answerRevealed: true }
}

export function advanceQuizSession<Question>(
  session: QuizSession<Question>
): QuizSession<Question> {
  if (
    session.completed ||
    (session.answerCorrect !== true && !session.answerRevealed)
  ) return session

  if (session.questionIndex === session.questionOrder.length - 1) {
    return { ...session, completed: true }
  }

  return {
    ...session,
    questionIndex: session.questionIndex + 1,
    attemptCount: 0,
    answerAttempts: Object.fromEntries(Object.keys(session.answerWeights).map((key) => [key, 0])),
    answerResults: Object.fromEntries(Object.keys(session.answerWeights).map((key) => [key, null])),
    answerPoints: Object.fromEntries(Object.keys(session.answerWeights).map((key) => [key, 0])),
    answerCorrect: null,
    answerRevealed: false,
    selectedAnswer: null
  }
}

type UseQuizSessionOptions<Question> = {
  mode: QuizMode
  questionBank: () => readonly Question[]
  onCompleted: (mode: QuizMode, score: number, total: number) => void
}

type UseQuizSessionResult<Question> = {
  session: QuizSession<Question>
  answer: (isCorrect: boolean, selectedAnswer?: string | null) => void
  answerItems: (outcomes: Record<string, boolean>, selectedAnswer?: string | null) => void
  revealAnswer: () => void
  next: () => void
  restart: (questions?: readonly Question[], answerWeights?: Record<string, number>) => void
}

export function useQuizSession<Question>({
  mode,
  questionBank,
  onCompleted
}: UseQuizSessionOptions<Question>): UseQuizSessionResult<Question> {
  const [session, setSession] = useState(() =>
    createQuizSession(questionBank())
  )

  const answer = (
    isCorrect: boolean,
    selectedAnswer: string | null = null
  ): void => {
    setSession((current) =>
      submitQuizAnswer(current, isCorrect, selectedAnswer)
    )
  }

  const answerItems = (
    outcomes: Record<string, boolean>,
    selectedAnswer: string | null = null
  ): void => {
    setSession((current) =>
      submitQuizAnswerItems(current, outcomes, selectedAnswer)
    )
  }

  const next = (): void => {
    const updated = advanceQuizSession(session)
    if (updated === session) return

    if (updated.completed) {
      onCompleted(mode, session.score, session.questionOrder.length)
    }

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

  return { session, answer, answerItems, revealAnswer, next, restart }
}
