export type QuizTimingMode = 'none' | 'stopwatch' | 'countdown'
export type QuizTimingScope = 'session' | 'question'

export type QuizTimingSettings = {
  mode: QuizTimingMode
  scope: QuizTimingScope
  limitSeconds: number
}

export type QuizTimingOutcome = {
  timedOutQuestions: number
  notReachedQuestions: number
  expired: boolean
}

export const noQuizTiming: QuizTimingSettings = {
  mode: 'none',
  scope: 'session',
  limitSeconds: 60
}

export function isQuizTimingSettings(value: unknown): value is QuizTimingSettings {
  if (!value || typeof value !== 'object') return false
  const timing = value as Record<string, unknown>
  return (
    ['none', 'stopwatch', 'countdown'].includes(String(timing.mode)) &&
    ['session', 'question'].includes(String(timing.scope)) &&
    typeof timing.limitSeconds === 'number' &&
    Number.isInteger(timing.limitSeconds) &&
    timing.limitSeconds >= 5 &&
    timing.limitSeconds <= 7200
  )
}

export function normalizeQuizTiming(value: unknown): QuizTimingSettings {
  return isQuizTimingSettings(value) ? { ...value } : { ...noQuizTiming }
}

export function getElapsedMilliseconds(startedAt: number, now: number): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return 0
  return Math.max(0, Math.floor(now - startedAt))
}

export function getRemainingMilliseconds(deadline: number, now: number): number {
  if (!Number.isFinite(deadline) || !Number.isFinite(now)) return 0
  return Math.max(0, Math.ceil(deadline - now))
}

export function formatDuration(milliseconds: number, language: string): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  const twoDigits = new Intl.NumberFormat(language, { minimumIntegerDigits: 2 })
  return hours > 0
    ? `${hours}:${twoDigits.format(remainingMinutes)}:${twoDigits.format(seconds)}`
    : `${minutes}:${twoDigits.format(seconds)}`
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([key, child]) => [key, stableValue(child)])
  )
}

export function getQuizConfigurationKey(configuration: unknown): string {
  return JSON.stringify(stableValue(configuration))
}
