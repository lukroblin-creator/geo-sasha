import { useState } from 'react'
import type { QuizMode } from './progress'

export type QuizSession<Question> = {
  questionOrder: Question[]
  questionIndex: number
  score: number
  answerCorrect: boolean | null
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
  questionBank: readonly Question[]
): QuizSession<Question> {
  return {
    questionOrder: shuffleItems(questionBank),
    questionIndex: 0,
    score: 0,
    answerCorrect: null,
    selectedAnswer: null,
    completed: false
  }
}

export function submitQuizAnswer<Question>(
  session: QuizSession<Question>,
  isCorrect: boolean,
  selectedAnswer: string | null = null
): QuizSession<Question> {
  if (session.completed || session.answerCorrect === true) return session

  return {
    ...session,
    score: session.score + (isCorrect ? 1 : 0),
    answerCorrect: isCorrect,
    selectedAnswer
  }
}

export function advanceQuizSession<Question>(
  session: QuizSession<Question>
): QuizSession<Question> {
  if (session.completed || session.answerCorrect === null) return session

  if (session.questionIndex === session.questionOrder.length - 1) {
    return { ...session, completed: true }
  }

  return {
    ...session,
    questionIndex: session.questionIndex + 1,
    answerCorrect: null,
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
  next: () => void
  restart: () => void
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

  const next = (): void => {
    const updated = advanceQuizSession(session)
    if (updated === session) return

    if (updated.completed) {
      onCompleted(mode, session.score, session.questionOrder.length)
    }

    setSession(updated)
  }

  const restart = (): void => {
    setSession(createQuizSession(questionBank()))
  }

  return { session, answer, next, restart }
}
