import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import WorldMap from './components/WorldMapLoader'
import { ExplorationView } from './components/ExplorationView'
import {
  CountryQuizPanel,
  QuizCluesInline,
  QuizFullscreenBar,
  QuizReviewCountryCard
} from './components/QuizPanels'
import { ExplorationPlaceDetails } from './components/ExplorationPlaceDetails'
import { QuizCountryStudyView } from './components/QuizCountryStudyView'
import { StatisticsView } from './components/StatisticsView'
import { CountryQuizSelectionView } from './components/CountryQuizSelectionView'
import { AppModeSwitcher, SkinSelector, type AppPrimaryMode } from './components/AppModeSwitcher'
import { CountryKnowledgeQuizView } from './components/CountryKnowledgeQuizView'
import { CountryComparatorView } from './components/CountryComparatorView'
import { EstimationQuizView } from './components/EstimationQuizView'
import { DrawBordersQuizView } from './components/DrawBordersQuizView'
import { MapLayerControls } from './components/MapLayerControls'
import { formatQuizScore, getQuizAttemptPoints, useQuizSession } from './data/quiz/useQuizSession'
import {
  createCountryQuizQuestions,
  type CountryQuizQuestion,
  normalizeQuizAnswer
} from './data/quiz/countryQuiz'
import {
  supplementalQuizFactOptions,
  type QuizAnswers,
  type QuizClues,
  type SupplementalQuizFactId,
  type SupplementalQuizFactSettings
} from './data/quiz/quizTypes'
import {
  createRandomQuizSetup,
  flagPresetAnswers,
  flagPresetClues,
  getContentLabels,
  getCountryQuizQuestionResult,
  getQuizAnswerWeights,
  getQuizModeForContent,
  idleQuizAnswers,
  idleQuizClues,
  matchesQuizConfiguration,
  matchesSupplementalQuizSettings,
  quizContentOptions,
  type QuizGameMode,
  type QuizSetup
} from './data/quiz/quizConfiguration'
import {
  createCountryKnowledgeQuestions,
  type CountryKnowledgeQuestionKind,
  type CountryKnowledgeQuestion
} from './data/quiz/countryKnowledge'
import {
  getAvailableQuizQuestionCount,
  getQuizQuestionsForRegion,
  quizRegions,
  type QuizQuestionCount,
  type QuizRegion,
  type ContinentId
} from './data/quiz/countryContinents'
import { createEstimationQuestions, type EstimationQuestion } from './data/quiz/estimationQuiz'
import { loadQuizProgress, saveCompletedQuiz, type QuizMode } from './data/quiz/progress'
import {
  loadCountryQuizStats,
  saveCountryQuizStats,
  updateCountryQuizStats
} from './data/quiz/countryQuizStats'
import { getMapProximityResult, type MapProximityResult } from './data/quiz/mapProximity'
import { getExplorationDetails } from './data/geography/exploration'
import countryCatalog from './data/quiz/countryCatalog.json'
import { activateUndoScope, undoActiveScope } from './data/undo'
import {
  loadDefaultQuizPresetId,
  loadQuizPresets,
  saveDefaultQuizPresetId,
  saveQuizPresets,
  type QuizPreset
} from './data/quiz/presets'
import { useLanguage } from './data/i18n'
import {
  formatShortcutBinding,
  useKeyboardShortcut,
  useKeyboardShortcuts,
  type KeyboardShortcutActionId
} from './data/keyboardShortcuts'
import { useSkin } from './data/skin'
import {
  loadQuizHistory,
  saveQuizHistoryEntry,
  summarizeQuizHistoryQuestions,
  type QuizHistoryEntry,
  type QuizHistoryQuestion,
  type QuizHistorySourceRow
} from './data/quiz/quizHistory'
import {
  fullMapLayerDensities,
  mapLayerDensityMaximums,
  type DensityLayerId,
  type MapLayerDensities
} from './data/geography/mapLayerDensity'
import { mountainRanges } from './data/geography/physical/mountainRanges'
import {
  formatDuration,
  getElapsedMilliseconds,
  getQuizConfigurationKey,
  getRemainingMilliseconds,
  noQuizTiming,
  type QuizTimingOutcome,
  type QuizTimingSettings
} from './data/quiz/quizTiming'

type MapLayerId =
  | 'borders'
  | 'rivers'
  | 'mountains'
  | 'labels'
  | 'marineLabels'
  | 'marineBorders'
  | 'flags'
  | 'summits'
type MapLayerVisibility = Record<MapLayerId, boolean>
type QuizRunSnapshot = {
  presetId: string | null
  presetName: string | null
  region: string
  settings: string[]
  comparisonKey: string
  timing: QuizTimingSettings
}
function normalizeCountrySourceFeatureId(sourceFeatureId: string | number): string {
  const value = String(sourceFeatureId)
  return /^\d+$/.test(value) ? String(Number(value)) : value
}

function normalizeCountrySearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim()
}

const mapLayerOptions: {
  id: MapLayerId
  label: string
  available: boolean
  title?: string
  subLayer?: { id: MapLayerId; label: string; showDensity?: boolean }
}[] = [
  {
    id: 'borders',
    label: 'Frontières',
    available: true,
    title: 'Afficher ou masquer les frontières des pays et territoires'
  },
  { id: 'labels', label: 'Noms des pays', available: true },
  {
    id: 'marineLabels',
    label: 'Mer/Océans',
    available: true,
    title: 'Afficher les noms des mers et océans documentés',
    subLayer: { id: 'marineBorders', label: 'Contours', showDensity: false }
  },
  {
    id: 'rivers',
    label: 'Fleuves',
    available: true,
    title: 'Afficher les principaux fleuves documentés'
  },
  {
    id: 'mountains',
    label: 'Chaînes de montagnes',
    available: true,
    title: 'Afficher les principales chaînes de montagnes documentées',
    subLayer: { id: 'summits', label: 'Sommets' }
  },
  {
    id: 'flags',
    label: 'Drapeaux',
    available: true,
    title: 'Intégrer le drapeau dans le contour des pays et territoires'
  }
]

function getKnowledgeStatId(kind: CountryKnowledgeQuestionKind): string {
  return `knowledge:${kind}`
}

function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable || target.tagName === 'TEXTAREA') return true
  if (target instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'color', 'radio', 'range', 'reset', 'submit'].includes(
      target.type
    )
  }
  return false
}

function App(): React.JSX.Element {
  const { language, t } = useLanguage()
  const { bindings } = useKeyboardShortcuts()
  const { skin } = useSkin()
  const drawCountryOptions = useMemo(() => {
    const displayNames = new Intl.DisplayNames([language], { type: 'region' })
    return countryCatalog
      .map((country) => ({
        alpha2: country.alpha2,
        name: displayNames.of(country.alpha2) ?? country.countryName
      }))
      .sort((first, second) => first.name.localeCompare(second.name, language))
  }, [language])
  type AppView =
    'quiz' | 'exploration' | 'statistics' | 'country-select' | 'country-quiz' | 'comparator'
  const [appView, setAppView] = useState<AppView>('quiz')
  const [statisticsReturnView, setStatisticsReturnView] =
    useState<Exclude<AppView, 'statistics'>>('quiz')
  const [comparisonInitialAlpha2, setComparisonInitialAlpha2] = useState<string[]>([])
  const [savedQuizPresets, setSavedQuizPresets] = useState<QuizPreset[]>(loadQuizPresets)
  const [defaultQuizPresetId, setDefaultQuizPresetId] = useState(loadDefaultQuizPresetId)
  const initialDefaultQuizPreset = savedQuizPresets.find(
    (preset) => preset.id === defaultQuizPresetId
  )
  const [isQuizFullscreen, setIsQuizFullscreen] = useState(false)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [perspectiveComparisonPortal, setPerspectiveComparisonPortal] =
    useState<HTMLDivElement | null>(null)
  const [fullscreenAnswersOpen, setFullscreenAnswersOpen] = useState(false)
  const [mapLayers, setMapLayers] = useState<MapLayerVisibility>({
    borders: true,
    rivers: false,
    mountains: false,
    summits: false,
    labels: false,
    marineLabels: false,
    marineBorders: false,
    flags: false
  })
  const [mapLayerDensities, setMapLayerDensities] =
    useState<MapLayerDensities>(fullMapLayerDensities)
  const [globeMode, setGlobeMode] = useState(false)
  const [quizRegion, setQuizRegion] = useState<QuizRegion>(
    initialDefaultQuizPreset?.region ?? 'world'
  )
  const [quizGameMode, setQuizGameMode] = useState<QuizGameMode>(
    initialDefaultQuizPreset?.gameMode ?? 'base'
  )
  const [quizTiming, setQuizTiming] = useState<QuizTimingSettings>(
    initialDefaultQuizPreset?.timing ?? noQuizTiming
  )
  const [activeQuizTiming, setActiveQuizTiming] = useState<QuizTimingSettings>(noQuizTiming)
  const [timerNow, setTimerNow] = useState(0)
  const [specialTimerExpired, setSpecialTimerExpired] = useState(false)
  const timerStartedAtRef = useRef<number | null>(null)
  const timerStoppedAtRef = useRef<number | null>(null)
  const questionTimerStartedAtRef = useRef<number | null>(null)
  const questionTimerKeyRef = useRef<string | null>(null)
  const questionTimerRemainingRef = useRef(0)
  const timerExpirationRef = useRef<string | null>(null)
  const [estimationRegion, setEstimationRegion] = useState<QuizRegion>(
    initialDefaultQuizPreset?.estimationRegion ?? 'world'
  )
  const [estimationAlpha2s, setEstimationAlpha2s] = useState<string[]>(
    initialDefaultQuizPreset?.estimationAlpha2s ?? []
  )
  const [drawContinents, setDrawContinents] = useState<ContinentId[]>(
    initialDefaultQuizPreset?.drawContinents ?? []
  )
  const [drawCountryAlpha2, setDrawCountryAlpha2] = useState<string | null>(
    initialDefaultQuizPreset?.drawCountryAlpha2 ?? null
  )
  const [drawCountrySearch, setDrawCountrySearch] = useState('')
  const [drawCountrySearchOpen, setDrawCountrySearchOpen] = useState(false)
  const [estimationQuestions, setEstimationQuestions] = useState<EstimationQuestion[]>([])
  const [specialQuizGeneration, setSpecialQuizGeneration] = useState(0)
  const [quizQuestionCount, setQuizQuestionCount] = useState<QuizQuestionCount>(
    initialDefaultQuizPreset
      ? Math.min(
          initialDefaultQuizPreset.questionCount,
          getAvailableQuizQuestionCount(initialDefaultQuizPreset.region)
        )
      : 10
  )
  const [activeQuizRegion, setActiveQuizRegion] = useState<QuizRegion>(
    initialDefaultQuizPreset?.region ?? 'world'
  )
  const [activeQuizQuestionCount, setActiveQuizQuestionCount] = useState<QuizQuestionCount>(
    initialDefaultQuizPreset?.questionCount ?? 10
  )
  const [isQuizRunning, setIsQuizRunning] = useState(false)
  const [isQuizSetupOpen, setIsQuizSetupOpen] = useState(false)
  const [isPresetQuickMenuOpen, setIsPresetQuickMenuOpen] = useState(false)
  const [quizClues, setQuizClues] = useState<QuizClues>(
    initialDefaultQuizPreset?.clues ?? flagPresetClues
  )
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>(
    initialDefaultQuizPreset?.answers ?? flagPresetAnswers
  )
  const [supplementalQuizClues, setSupplementalQuizClues] = useState<SupplementalQuizFactSettings>(
    initialDefaultQuizPreset?.supplementalClues ?? {}
  )
  const [supplementalQuizAnswers, setSupplementalQuizAnswers] =
    useState<SupplementalQuizFactSettings>(initialDefaultQuizPreset?.supplementalAnswers ?? {})
  const [supplementalQuizMenuSide, setSupplementalQuizMenuSide] = useState<
    'clue' | 'answer' | null
  >(null)
  const [activeQuizClues, setActiveQuizClues] = useState<QuizClues>(idleQuizClues)
  const [activeQuizAnswers, setActiveQuizAnswers] = useState<QuizAnswers>(idleQuizAnswers)
  const [activeSupplementalQuizClues, setActiveSupplementalQuizClues] =
    useState<SupplementalQuizFactSettings>({})
  const [activeSupplementalQuizAnswers, setActiveSupplementalQuizAnswers] =
    useState<SupplementalQuizFactSettings>({})
  const [sessionMode, setSessionMode] = useState<QuizMode>('flags')
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [showQuizRevealCard, setShowQuizRevealCard] = useState(false)
  const [showExpandedQuizCountry, setShowExpandedQuizCountry] = useState(false)
  const [reviewQuizCountryAlpha2, setReviewQuizCountryAlpha2] = useState<string | null>(null)
  const [selectedQuizCountry, setSelectedQuizCountry] = useState<string | null>(null)
  const [countryKnowledgeAlpha2, setCountryKnowledgeAlpha2] = useState<string | null>(null)
  const [countryQuizReturnView, setCountryQuizReturnView] = useState<
    'country-select' | 'statistics'
  >('country-select')
  const [selectedMapCountry, setSelectedMapCountry] = useState<{
    sourceFeatureId: string | number
    name: string
    entityId: string | null
    revealed?: boolean
  } | null>(null)
  const [selectedMapAnswerAlpha2s, setSelectedMapAnswerAlpha2s] = useState<string[]>([])
  const [mapProximity, setMapProximity] = useState<MapProximityResult | null>(null)
  const borderlessMapPrecisionRef = useRef({ total: 0, samples: 0 })
  const [quizProgress, setQuizProgress] = useState(loadQuizProgress)
  const [quizHistory, setQuizHistory] = useState<QuizHistoryEntry[]>(loadQuizHistory)
  const [activeQuizHistorySnapshot, setActiveQuizHistorySnapshot] =
    useState<QuizRunSnapshot | null>(null)
  const [countryQuizStats, setCountryQuizStats] = useState(loadCountryQuizStats)
  const [selectedQuizPresetId, setSelectedQuizPresetId] = useState(
    initialDefaultQuizPreset?.id ?? ''
  )
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetFeedback, setPresetFeedback] = useState('')
  const presetQuickMenuRef = useRef<HTMLDivElement>(null)
  const defaultQuizPreset = savedQuizPresets.find((preset) => preset.id === defaultQuizPresetId)
  const lastRecordedQuestionRef = useRef<string | null>(null)
  const countryKnowledgeRecordedQuestionRef = useRef<string | null>(null)

  const createRunSnapshot = (
    region: QuizRegion,
    settings: string[],
    preset?: QuizPreset,
    configuration: unknown = { gameMode: quizGameMode, region, settings },
    timing: QuizTimingSettings = quizTiming
  ): QuizRunSnapshot => ({
    presetId: preset?.id ?? null,
    presetName: preset?.name ?? null,
    region: t(quizRegions.find((item) => item.id === region)?.label ?? 'Tous les continents'),
    settings,
    comparisonKey: getQuizConfigurationKey({ configuration, timing }),
    timing: { ...timing }
  })

  const createBaseRunSnapshot = (setup: QuizSetup, preset?: QuizPreset): QuizRunSnapshot => {
    const supplementalClues = setup.supplementalClues ?? {}
    const supplementalAnswers = setup.supplementalAnswers ?? {}
    const clueLabels = [
      ...quizContentOptions.filter(({ id }) => setup.clues[id]).map(({ label }) => t(label)),
      ...supplementalQuizFactOptions
        .filter(({ id }) => supplementalClues[id])
        .map(({ label }) => t(label))
    ]
    const answerLabels = [
      ...quizContentOptions.filter(({ id }) => setup.answers[id]).map(({ label }) => t(label)),
      ...supplementalQuizFactOptions
        .filter(({ id }) => supplementalAnswers[id])
        .map(({ label }) => t(label))
    ]
    const effectiveTiming = setup.timing ?? quizTiming
    return createRunSnapshot(
      setup.region,
      [
        `${t('Nombre de pays')} : ${Math.min(setup.questionCount, getAvailableQuizQuestionCount(setup.region))}`,
        `${t('Indices')} : ${clueLabels.join(', ') || '—'}`,
        `${t('Réponses')} : ${answerLabels.join(', ') || '—'}`,
        ...(effectiveTiming.mode === 'none'
          ? []
          : [
              effectiveTiming.mode === 'stopwatch'
                ? `${t('Chrono')} : ${t('Temps total')}`
                : `${t('Minuteur')} : ${t(effectiveTiming.scope === 'question' ? 'Par question' : 'Partie entière')} · ${effectiveTiming.limitSeconds} s`
            ])
      ],
      preset,
      {
        gameMode: 'base',
        region: setup.region,
        questionCount: Math.min(setup.questionCount, getAvailableQuizQuestionCount(setup.region)),
        clues: setup.clues,
        answers: setup.answers,
        supplementalClues,
        supplementalAnswers
      },
      effectiveTiming
    )
  }

  const createHistoryEntry = (
    mode: QuizMode,
    score: number,
    total: number,
    snapshot: QuizRunSnapshot | null,
    questions: QuizHistoryQuestion[],
    timing: QuizHistoryEntry['timing'] = undefined,
    comparisonKey = snapshot?.comparisonKey
  ): QuizHistoryEntry => ({
    id: `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    completedAt: new Date().toISOString(),
    mode,
    score,
    total,
    presetId: snapshot?.presetId ?? null,
    presetName: snapshot?.presetName ?? null,
    region: snapshot?.region ?? t('Tous les continents'),
    settings: snapshot?.settings ?? [],
    questions,
    ...(comparisonKey ? { comparisonKey } : {}),
    ...(mode !== 'estimation' &&
    mode !== 'draw-borders' &&
    borderlessMapPrecisionRef.current.samples > 0
      ? { borderlessMapPrecision: { ...borderlessMapPrecisionRef.current } }
      : {}),
    ...(timing ? { timing } : {})
  })

  const startQuizClock = (settings: QuizTimingSettings): void => {
    const now = performance.now()
    setActiveQuizTiming({ ...settings })
    timerStartedAtRef.current = now
    timerStoppedAtRef.current = null
    questionTimerStartedAtRef.current = null
    questionTimerKeyRef.current = null
    questionTimerRemainingRef.current = settings.limitSeconds * 1000
    timerExpirationRef.current = null
    setSpecialTimerExpired(false)
    setTimerNow(now)
  }

  const getCurrentQuizTimingHistory = (
    questions: readonly QuizHistorySourceRow[]
  ): QuizHistoryEntry['timing'] => {
    if (activeQuizTiming.mode === 'none' || timerStartedAtRef.current === null) return undefined
    const endedAt = timerStoppedAtRef.current ?? performance.now()
    const elapsedMilliseconds = getElapsedMilliseconds(timerStartedAtRef.current, endedAt)
    const timedOutQuestions = questions.filter((question) => question.timedOut).length
    const notReachedQuestions = questions.filter((question) => question.notReached).length
    const remainingMilliseconds =
      activeQuizTiming.mode === 'countdown' && activeQuizTiming.scope === 'session'
        ? getRemainingMilliseconds(
            timerStartedAtRef.current + activeQuizTiming.limitSeconds * 1000,
            endedAt
          )
        : null
    return {
      settings: { ...activeQuizTiming },
      elapsedMilliseconds,
      remainingMilliseconds,
      expired:
        remainingMilliseconds === 0 &&
        activeQuizTiming.mode === 'countdown' &&
        activeQuizTiming.scope === 'session',
      timedOutQuestions,
      notReachedQuestions
    }
  }

  const appendQuizHistory = (entry: QuizHistoryEntry): void => {
    setQuizHistory(saveQuizHistoryEntry(entry))
  }

  const toggleGlobeMode = (): void => setGlobeMode((current) => !current)

  const toggleMapFullscreen = (): void => {
    const entering = !isMapFullscreen
    setIsMapFullscreen(entering)
    if (entering) {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        void document.documentElement.requestFullscreen().catch(() => undefined)
      }
    } else if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    }
  }

  const openStatistics = (): void => {
    if (appView !== 'statistics') setStatisticsReturnView(appView)
    setIsMapFullscreen(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    setAppView('statistics')
  }

  const openCountryComparator = (alpha2s: string[]): void => {
    setComparisonInitialAlpha2([...new Set(alpha2s.map((alpha2) => alpha2.toUpperCase()))])
    setIsMapFullscreen(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    setAppView('comparator')
  }

  const openPrimaryMode = (mode: AppPrimaryMode): void => {
    if (mode === 'comparator') setComparisonInitialAlpha2([])
    if (mode === 'quiz' && !isQuizRunning) {
      applyDefaultQuizPreset()
      setIsQuizSetupOpen(false)
    }
    setAppView(mode)
  }

  useKeyboardShortcut('app.mode.quiz', () => openPrimaryMode('quiz'))
  useKeyboardShortcut('app.mode.exploration', () => openPrimaryMode('exploration'))
  useKeyboardShortcut('app.mode.countryQuiz', () => openPrimaryMode('country-select'))
  useKeyboardShortcut('app.mode.comparator', () => openPrimaryMode('comparator'))
  useKeyboardShortcut('app.mode.statistics', openStatistics)

  useEffect(() => {
    if (!selectedQuizPresetId) return
    const selectedPreset = savedQuizPresets.find((preset) => preset.id === selectedQuizPresetId)
    if (!selectedPreset) {
      // Keep the selected preset in sync when the saved preset is deleted.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear the stale ID after the preset list changes.
      setSelectedQuizPresetId('')
      return
    }
    const expectedQuestionCount = Math.min(
      selectedPreset.questionCount,
      getAvailableQuizQuestionCount(selectedPreset.region)
    )
    const presetMode = selectedPreset.gameMode ?? 'base'
    const sameList = (first: string[], second: string[]): boolean =>
      first.length === second.length && first.every((item, index) => item === second[index])
    const baseSettingsMatch =
      quizGameMode !== 'base' ||
      (quizRegion === selectedPreset.region &&
        quizQuestionCount === expectedQuestionCount &&
        matchesQuizConfiguration(
          quizClues,
          quizAnswers,
          selectedPreset.clues,
          selectedPreset.answers
        ) &&
        matchesSupplementalQuizSettings(supplementalQuizClues, selectedPreset.supplementalClues) &&
        matchesSupplementalQuizSettings(
          supplementalQuizAnswers,
          selectedPreset.supplementalAnswers
        ))
    const modeSettingsMatch =
      quizGameMode === presetMode &&
      (quizGameMode === 'base' ||
        (quizGameMode === 'estimation' &&
          estimationRegion === (selectedPreset.estimationRegion ?? 'world') &&
          sameList(estimationAlpha2s, selectedPreset.estimationAlpha2s ?? [])) ||
        (quizGameMode === 'draw-borders' &&
          sameList(drawContinents, selectedPreset.drawContinents ?? []) &&
          drawCountryAlpha2 === (selectedPreset.drawCountryAlpha2 ?? null)))
    const stillMatchesPreset = baseSettingsMatch && modeSettingsMatch

    if (!stillMatchesPreset) {
      // Manual edits intentionally detach the current settings from the preset.
      setSelectedQuizPresetId('')
    }
  }, [
    quizAnswers,
    quizClues,
    quizGameMode,
    quizQuestionCount,
    quizRegion,
    supplementalQuizClues,
    supplementalQuizAnswers,
    estimationRegion,
    estimationAlpha2s,
    drawContinents,
    drawCountryAlpha2,
    savedQuizPresets,
    selectedQuizPresetId
  ])

  useEffect(() => {
    if (!isPresetQuickMenuOpen) return

    const closeOnOutsidePointer = (event: PointerEvent): void => {
      if (!presetQuickMenuRef.current?.contains(event.target as Node)) {
        setIsPresetQuickMenuOpen(false)
      }
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setIsPresetQuickMenuOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [isPresetQuickMenuOpen])

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent): void => {
      activateUndoScope(event.target)
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (
        (!event.metaKey && !event.ctrlKey) ||
        event.key.toLowerCase() !== 'z' ||
        event.shiftKey ||
        isTextEditingTarget(event.target) ||
        (event.target instanceof Element && event.target.closest('dialog[open], [role="dialog"]'))
      ) {
        return
      }

      if (undoActiveScope()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [])

  const enterQuizFullscreen = (): void => {
    if (!isQuizRunning) return
    setFullscreenAnswersOpen(false)
    setShowQuizRevealCard(false)
    setIsQuizFullscreen(true)

    if (document.fullscreenEnabled && !document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {
        // La vue sans panneaux reste disponible si le plein écran système est refusé.
      })
    }
  }

  const exitQuizFullscreen = (): void => {
    setIsQuizFullscreen(false)
    setFullscreenAnswersOpen(false)
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined)
    }
  }

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      if (!document.fullscreenElement) {
        setIsQuizFullscreen(false)
        setIsMapFullscreen(false)
        setFullscreenAnswersOpen(false)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    const tooltip = document.createElement('div')
    tooltip.id = 'app-button-tooltip'
    tooltip.className = 'app-button-tooltip'
    tooltip.setAttribute('role', 'tooltip')
    tooltip.hidden = true
    document.body.appendChild(tooltip)

    let activeButton: HTMLElement | null = null
    let timer: number | null = null
    let originalTitle: string | null = null
    let originalDescription: string | null = null

    const restoreActiveButton = (): void => {
      if (!activeButton) return
      if (originalTitle !== null) activeButton.setAttribute('title', originalTitle)
      if (originalDescription !== null) {
        activeButton.setAttribute('aria-describedby', originalDescription)
      } else {
        activeButton.removeAttribute('aria-describedby')
      }
      activeButton = null
      originalTitle = null
      originalDescription = null
    }

    const hideTooltip = (): void => {
      if (timer !== null) window.clearTimeout(timer)
      timer = null
      tooltip.classList.remove('visible')
      tooltip.hidden = true
      restoreActiveButton()
    }

    const showTooltip = (button: HTMLElement): void => {
      if (activeButton === button) return
      hideTooltip()
      const label = (
        button.getAttribute('data-tooltip') ||
        button.getAttribute('title') ||
        button.getAttribute('aria-label') ||
        button.innerText
      ).trim()
      if (!label) return

      activeButton = button
      originalTitle = button.getAttribute('title')
      originalDescription = button.getAttribute('aria-describedby')
      if (originalTitle !== null) button.setAttribute('title', '')

      timer = window.setTimeout(() => {
        timer = null
        if (!activeButton || !activeButton.isConnected) {
          hideTooltip()
          return
        }

        const shortcutAction = button.dataset.shortcutAction as KeyboardShortcutActionId | undefined
        const shortcut = shortcutAction ? formatShortcutBinding(bindings[shortcutAction], '') : ''
        const labelNode = document.createElement('span')
        labelNode.textContent = label
        tooltip.replaceChildren(labelNode)
        if (shortcut) {
          const shortcutNode = document.createElement('kbd')
          shortcutNode.textContent = shortcut
          tooltip.appendChild(shortcutNode)
        }
        tooltip.hidden = false
        const buttonBounds = activeButton.getBoundingClientRect()
        const tooltipBounds = tooltip.getBoundingClientRect()
        const left = Math.max(
          8,
          Math.min(
            window.innerWidth - tooltipBounds.width - 8,
            buttonBounds.left + (buttonBounds.width - tooltipBounds.width) / 2
          )
        )
        const above = buttonBounds.top - tooltipBounds.height - 8
        const top =
          above >= 8
            ? above
            : Math.min(window.innerHeight - tooltipBounds.height - 8, buttonBounds.bottom + 8)

        tooltip.style.left = `${left}px`
        tooltip.style.top = `${Math.max(8, top)}px`
        activeButton.setAttribute(
          'aria-describedby',
          [originalDescription, tooltip.id].filter(Boolean).join(' ')
        )
        window.requestAnimationFrame(() => tooltip.classList.add('visible'))
      }, 500)
    }

    const getButton = (target: EventTarget | null): HTMLElement | null => {
      if (!(target instanceof Element)) return null
      const button = target.closest('button, summary')
      if (!(button instanceof HTMLElement)) return null
      if (button.matches('.country-flag-choices .country-flag-choice')) return null
      return button
    }

    const handlePointerOver = (event: PointerEvent): void => {
      const button = getButton(event.target)
      if (
        !button ||
        (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))
      ) {
        return
      }
      showTooltip(button)
    }

    const handlePointerOut = (event: PointerEvent): void => {
      const button = getButton(event.target)
      if (
        !button ||
        button !== activeButton ||
        (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))
      ) {
        return
      }
      hideTooltip()
    }

    const handleFocusIn = (event: FocusEvent): void => {
      const button = getButton(event.target)
      if (button) showTooltip(button)
    }

    const handleFocusOut = (event: FocusEvent): void => {
      const button = getButton(event.target)
      if (
        !button ||
        button !== activeButton ||
        (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))
      ) {
        return
      }
      hideTooltip()
    }

    document.addEventListener('pointerover', handlePointerOver)
    document.addEventListener('pointerout', handlePointerOut)
    document.addEventListener('focusin', handleFocusIn)
    document.addEventListener('focusout', handleFocusOut)
    window.addEventListener('scroll', hideTooltip, true)
    window.addEventListener('resize', hideTooltip)

    return () => {
      hideTooltip()
      document.removeEventListener('pointerover', handlePointerOver)
      document.removeEventListener('pointerout', handlePointerOut)
      document.removeEventListener('focusin', handleFocusIn)
      document.removeEventListener('focusout', handleFocusOut)
      window.removeEventListener('scroll', hideTooltip, true)
      window.removeEventListener('resize', hideTooltip)
      tooltip.remove()
    }
  }, [bindings])

  const maxQuizQuestionCount = selectedQuizCountry ? 1 : getAvailableQuizQuestionCount(quizRegion)
  const quizCountProgress =
    ((Math.min(quizQuestionCount, maxQuizQuestionCount) - 1) /
      Math.max(1, maxQuizQuestionCount - 1)) *
    100

  const getCurrentQuestionBank = (): CountryQuizQuestion[] => {
    const allQuestions = createCountryQuizQuestions(language)
    if (selectedQuizCountry) {
      return allQuestions.filter((question) => question.alpha2 === selectedQuizCountry)
    }
    return getQuizQuestionsForRegion(allQuestions, quizRegion, quizQuestionCount)
  }

  const recordCompletedQuiz = (
    mode: QuizMode,
    score: number,
    total: number,
    questionHistory: readonly QuizHistorySourceRow[]
  ): void => {
    const endedAt = performance.now()
    timerStoppedAtRef.current = endedAt
    setTimerNow(endedAt)
    setQuizProgress(saveCompletedQuiz(mode, score))
    appendQuizHistory(
      createHistoryEntry(
        mode,
        score,
        total,
        activeQuizHistorySnapshot,
        summarizeQuizHistoryQuestions(questionHistory, language),
        getCurrentQuizTimingHistory(questionHistory)
      )
    )
  }

  const quiz = useQuizSession<CountryQuizQuestion>({
    mode: sessionMode,
    questionBank: () => (isQuizRunning ? getCurrentQuestionBank() : []),
    onCompleted: recordCompletedQuiz
  })
  const countryKnowledgeQuiz = useQuizSession<CountryKnowledgeQuestion>({
    mode: 'knowledge',
    questionBank: () => [],
    onCompleted: recordCompletedQuiz
  })
  const currentQuizQuestion = quiz.session.questionOrder[quiz.session.questionIndex]
  useEffect(() => {
    if (
      !isQuizRunning ||
      appView !== 'quiz' ||
      activeQuizTiming.mode === 'none' ||
      (quizGameMode === 'base' && quiz.session.completed) ||
      timerStartedAtRef.current === null
    ) {
      return
    }

    const tick = (): void => {
      const now = performance.now()
      setTimerNow(now)

      if (activeQuizTiming.mode !== 'countdown') return
      if (activeQuizTiming.scope === 'session') {
        const key = 'session'
        const deadline = timerStartedAtRef.current! + activeQuizTiming.limitSeconds * 1000
        if (now >= deadline && timerExpirationRef.current !== key) {
          timerExpirationRef.current = key
          if (quizGameMode === 'base') {
            recordCurrentQuestionResult()
            quiz.finishByTimeout()
          } else {
            setSpecialTimerExpired(true)
          }
        }
        return
      }

      if (quizGameMode !== 'base') return
      const questionKey = `${sessionGeneration}:${quiz.session.questionIndex}`
      const questionFinished = quiz.session.answerCorrect === true || quiz.session.answerRevealed
      if (questionFinished) {
        questionTimerStartedAtRef.current = null
        questionTimerKeyRef.current = questionKey
        return
      }
      if (questionTimerKeyRef.current !== questionKey) {
        questionTimerKeyRef.current = questionKey
        questionTimerStartedAtRef.current = now
        questionTimerRemainingRef.current = activeQuizTiming.limitSeconds * 1000
        timerExpirationRef.current = null
        return
      }
      const startedAt = questionTimerStartedAtRef.current
      if (startedAt === null) return
      const deadline = startedAt + activeQuizTiming.limitSeconds * 1000
      questionTimerRemainingRef.current = getRemainingMilliseconds(deadline, now)
      if (now >= deadline && timerExpirationRef.current !== questionKey) {
        timerExpirationRef.current = questionKey
        quiz.timeoutCurrent()
      }
    }

    tick()
    const interval = window.setInterval(tick, 100)
    return () => window.clearInterval(interval)
  }, [
    activeQuizTiming,
    appView,
    isQuizRunning,
    quizGameMode,
    quiz.session.answerCorrect,
    quiz.session.answerRevealed,
    quiz.session.completed,
    quiz.session.questionIndex,
    sessionGeneration
  ])

  const activeTimerMilliseconds =
    activeQuizTiming.mode === 'countdown'
      ? activeQuizTiming.scope === 'session'
        ? getRemainingMilliseconds(
            (timerStartedAtRef.current ?? timerNow) + activeQuizTiming.limitSeconds * 1000,
            timerStoppedAtRef.current ?? timerNow
          )
        : getRemainingMilliseconds(timerNow + questionTimerRemainingRef.current, timerNow)
      : timerStartedAtRef.current === null
        ? 0
        : getElapsedMilliseconds(timerStartedAtRef.current, timerStoppedAtRef.current ?? timerNow)
  const quizRevealTargetFeatureIds = useMemo(
    () =>
      quiz.session.answerRevealed && (currentQuizQuestion?.countryAnswerGroup.length ?? 0) > 1
        ? (currentQuizQuestion?.countryAnswerGroup.map(({ sourceFeatureId }) => sourceFeatureId) ??
          [])
        : [],
    [currentQuizQuestion, quiz.session.answerRevealed]
  )
  const revealedQuizPlace = currentQuizQuestion
    ? getExplorationDetails(
        currentQuizQuestion.sourceFeatureId,
        currentQuizQuestion.frenchCountryName,
        null
      )
    : null
  const reviewQuizCountry = reviewQuizCountryAlpha2
    ? (countryCatalog as { alpha2: string; sourceFeatureId: number; countryName: string }[]).find(
        (country) => country.alpha2 === reviewQuizCountryAlpha2
      )
    : undefined
  const reviewQuizPlace = reviewQuizCountry
    ? getExplorationDetails(reviewQuizCountry.sourceFeatureId, reviewQuizCountry.countryName, null)
    : null
  const selectQuizReviewCountry = (alpha2: string): void => {
    setReviewQuizCountryAlpha2(alpha2.toUpperCase())
    setShowQuizRevealCard(false)
    if (isQuizFullscreen) exitQuizFullscreen()
  }

  const handleQuizRegionChange = (region: QuizRegion): void => {
    setQuizRegion(region)
    setQuizQuestionCount((current) => Math.min(current, getAvailableQuizQuestionCount(region)))
  }

  const startCountryQuiz = (alpha2: string): void => {
    const countryQuestions = createCountryKnowledgeQuestions(alpha2, language)
    if (!countryQuestions.length) return

    setCountryQuizReturnView(appView === 'statistics' ? 'statistics' : 'country-select')
    setCountryKnowledgeAlpha2(alpha2.toUpperCase())
    setReviewQuizCountryAlpha2(null)
    const countryName = new Intl.DisplayNames([language], { type: 'region' }).of(alpha2) ?? alpha2
    setActiveQuizHistorySnapshot(
      createRunSnapshot('world', [
        `${t('Pays étudié')} : ${countryName}`,
        `${t('Nombre de questions')} : ${countryQuestions.length}`
      ])
    )
    countryKnowledgeRecordedQuestionRef.current = null
    countryKnowledgeQuiz.restart(countryQuestions)
    setAppView('country-quiz')
  }

  const answerCountryKnowledgeQuestion = (answer: string): void => {
    const current = countryKnowledgeQuiz.session
    const question = current.questionOrder[current.questionIndex]
    if (!question || current.answerCorrect === true || current.answerRevealed) return
    const questionKey = `${question.alpha2}:${current.questionIndex}:${question.id}`

    const isCorrect = answer === question.answer
    const attemptPoints = isCorrect
      ? getQuizAttemptPoints((current.answerAttempts.answer ?? 0) + 1)
      : 0
    countryKnowledgeQuiz.answer(isCorrect, answer)
    if (!isCorrect || countryKnowledgeRecordedQuestionRef.current === questionKey) return
    countryKnowledgeRecordedQuestionRef.current = questionKey

    const updatedStats = updateCountryQuizStats(
      countryQuizStats,
      question.alpha2,
      'knowledge',
      true,
      {
        pointsEarned: attemptPoints,
        answers: [
          {
            id: getKnowledgeStatId(question.kind),
            correct: true,
            pointsEarned: attemptPoints
          }
        ]
      }
    )
    setCountryQuizStats(updatedStats)
    saveCountryQuizStats(updatedStats)
  }

  const revealCountryKnowledgeAnswer = (): void => {
    const current = countryKnowledgeQuiz.session
    const question = current.questionOrder[current.questionIndex]
    if (!question || current.answerCorrect === true || current.answerRevealed) return

    countryKnowledgeQuiz.revealAnswer()
    const questionKey = `${question.alpha2}:${current.questionIndex}:${question.id}`
    if (countryKnowledgeRecordedQuestionRef.current === questionKey) return
    countryKnowledgeRecordedQuestionRef.current = questionKey

    const updatedStats = updateCountryQuizStats(
      countryQuizStats,
      question.alpha2,
      'knowledge',
      false,
      {
        pointsEarned: current.answerPoints.answer ?? 0,
        answers: [
          {
            id: getKnowledgeStatId(question.kind),
            correct: false,
            pointsEarned: 0
          }
        ]
      }
    )
    setCountryQuizStats(updatedStats)
    saveCountryQuizStats(updatedStats)
  }

  const replayCountryQuiz = (): void => {
    if (!countryKnowledgeAlpha2) return
    countryKnowledgeRecordedQuestionRef.current = null
    countryKnowledgeQuiz.restart(createCountryKnowledgeQuestions(countryKnowledgeAlpha2, language))
  }

  const stopCountryQuiz = (): void => {
    countryKnowledgeQuiz.restart([])
    setCountryKnowledgeAlpha2(null)
    countryKnowledgeRecordedQuestionRef.current = null
    setReviewQuizCountryAlpha2(null)
    setAppView(countryQuizReturnView)
  }

  const startQuizWithSetup = (
    setup: QuizSetup,
    clearSelectedPreset = false,
    presetOverride?: QuizPreset
  ): void => {
    const selectedTiming = setup.timing ?? quizTiming
    const hasClue =
      Object.values(setup.clues).some(Boolean) ||
      Object.values(setup.supplementalClues ?? {}).some(Boolean)
    const hasAnswer =
      Object.values(setup.answers).some(Boolean) ||
      Object.values(setup.supplementalAnswers ?? {}).some(Boolean)
    if (!hasClue || !hasAnswer) {
      return
    }

    borderlessMapPrecisionRef.current = { total: 0, samples: 0 }

    const questionCount = Math.min(setup.questionCount, getAvailableQuizQuestionCount(setup.region))
    const candidatePreset =
      presetOverride ??
      (!clearSelectedPreset
        ? savedQuizPresets.find((preset) => preset.id === selectedQuizPresetId)
        : undefined)
    const matchedPreset =
      candidatePreset &&
      candidatePreset.region === setup.region &&
      Math.min(
        candidatePreset.questionCount,
        getAvailableQuizQuestionCount(candidatePreset.region)
      ) === questionCount &&
      JSON.stringify(candidatePreset.clues) === JSON.stringify(setup.clues) &&
      JSON.stringify(candidatePreset.answers) === JSON.stringify(setup.answers) &&
      JSON.stringify(candidatePreset.timing ?? noQuizTiming) === JSON.stringify(selectedTiming) &&
      matchesSupplementalQuizSettings(candidatePreset.supplementalClues, setup.supplementalClues) &&
      matchesSupplementalQuizSettings(
        candidatePreset.supplementalAnswers,
        setup.supplementalAnswers
      )
        ? candidatePreset
        : undefined
    const generatedQuestions = createCountryQuizQuestions(language)
    const requiredSupplementalClues = supplementalQuizFactOptions.filter(
      ({ id }) => setup.supplementalClues?.[id]
    )
    const requiredSupplementalAnswers = supplementalQuizFactOptions.filter(
      ({ id }) => setup.supplementalAnswers?.[id]
    )
    const clueEligibleQuestions = generatedQuestions.filter((question) =>
      requiredSupplementalClues.every(({ id }) => Boolean(question.supplementalFacts[id]?.trim()))
    )
    const answerEligibleQuestions = clueEligibleQuestions.filter((question) =>
      requiredSupplementalAnswers.every(
        ({ id }) => (question.supplementalAnswerValues[id]?.length ?? 0) > 0
      )
    )
    const regionalQuestions = getQuizQuestionsForRegion(
      clueEligibleQuestions,
      setup.region,
      clueEligibleQuestions.length
    )
    const answerEligibleRegionalQuestions = getQuizQuestionsForRegion(
      answerEligibleQuestions,
      setup.region,
      answerEligibleQuestions.length
    )
    const groupingEnabled = requiredSupplementalClues.length > 0
    const localizedCountryNames = new Intl.DisplayNames([language], { type: 'region' })
    const groupedQuestions = answerEligibleRegionalQuestions.map((question) => {
      const matchingCountries = groupingEnabled
        ? regionalQuestions.filter((candidate) => {
            const matchesSupplementalClues = supplementalQuizFactOptions
              .filter(({ id }) => setup.supplementalClues?.[id])
              .every(({ id }) => {
                const questionKeys = [...(question.supplementalFactKeys[id] ?? [])].sort()
                const candidateKeys = [...(candidate.supplementalFactKeys[id] ?? [])].sort()
                return (
                  questionKeys.length === candidateKeys.length &&
                  questionKeys.every((key, index) => key === candidateKeys[index])
                )
              })
            const matchesBaseClues =
              (!(setup.clues.countryName || setup.clues.flag || setup.clues.countryOnMap) ||
                candidate.alpha2 === question.alpha2) &&
              (!setup.clues.capital ||
                normalizeQuizAnswer(candidate.capitalName) ===
                  normalizeQuizAnswer(question.capitalName))
            return matchesSupplementalClues && matchesBaseClues
          })
        : [question]
      return {
        ...question,
        countryAnswerGroup: matchingCountries.map((country) => ({
          alpha2: country.alpha2,
          sourceFeatureId: country.sourceFeatureId,
          name: localizedCountryNames.of(country.alpha2) ?? country.countryName
        }))
      }
    })
    const questionsForRun =
      groupingEnabled && (setup.answers.countryName || setup.answers.countryOnMap)
        ? groupedQuestions.filter(
            (question, index, all) =>
              all.findIndex(
                (candidate) =>
                  candidate.countryAnswerGroup
                    .map(({ alpha2 }) => alpha2)
                    .sort()
                    .join(',') ===
                  question.countryAnswerGroup
                    .map(({ alpha2 }) => alpha2)
                    .sort()
                    .join(',')
              ) === index
          )
        : groupedQuestions
    const quizQuestions = getQuizQuestionsForRegion(questionsForRun, setup.region, questionCount)
    if (!quizQuestions.length) return

    const runSetup = { ...setup, timing: selectedTiming, questionCount: quizQuestions.length }
    setActiveQuizHistorySnapshot(createBaseRunSnapshot(runSetup, matchedPreset))
    setReviewQuizCountryAlpha2(null)
    setQuizRegion(setup.region)
    setQuizGameMode('base')
    setQuizQuestionCount(questionCount)
    setQuizClues(setup.clues)
    setQuizAnswers(setup.answers)
    if (clearSelectedPreset) setSelectedQuizPresetId('')

    const hasSupplementalContent =
      Object.values(setup.supplementalClues ?? {}).some(Boolean) ||
      Object.values(setup.supplementalAnswers ?? {}).some(Boolean)
    const nextMode = hasSupplementalContent
      ? 'custom'
      : getQuizModeForContent(setup.clues, setup.answers)
    setSessionMode(nextMode)
    setActiveQuizClues(setup.clues)
    setActiveQuizAnswers(setup.answers)
    setActiveSupplementalQuizClues(setup.supplementalClues ?? {})
    setActiveSupplementalQuizAnswers(setup.supplementalAnswers ?? {})
    setActiveQuizRegion(setup.region)
    setActiveQuizQuestionCount(quizQuestions.length)
    setSessionGeneration((current) => current + 1)
    lastRecordedQuestionRef.current = null
    setSelectedMapCountry(null)
    setSelectedMapAnswerAlpha2s([])
    setMapProximity(null)
    setShowQuizRevealCard(false)
    setShowExpandedQuizCountry(false)
    setFullscreenAnswersOpen(false)
    setIsQuizRunning(true)
    startQuizClock(selectedTiming)
    setIsQuizSetupOpen(false)
    setIsPresetQuickMenuOpen(false)
    quiz.restart(quizQuestions, getQuizAnswerWeights(setup.answers, setup.supplementalAnswers))
  }

  const startNewQuiz = (): void => {
    if (quizGameMode === 'estimation') {
      const questions = createEstimationQuestions(estimationRegion, estimationAlpha2s, language)
      const preset = savedQuizPresets.find((item) => item.id === selectedQuizPresetId)
      startQuizClock(quizTiming)
      setActiveQuizHistorySnapshot(
        createRunSnapshot(
          estimationRegion,
          [
            `${t('Mode')} : ${t('Mode estimation')}`,
            `${t('Pays sélectionnés')} : ${estimationAlpha2s.length || t('Tous')}`
          ],
          preset,
          { gameMode: 'estimation', region: estimationRegion, alpha2s: [...estimationAlpha2s] },
          quizTiming
        )
      )
      setEstimationQuestions(questions)
      setIsQuizRunning(true)
      setIsQuizSetupOpen(false)
      setIsPresetQuickMenuOpen(false)
      setSpecialQuizGeneration((current) => current + 1)
      return
    }
    if (quizGameMode === 'draw-borders') {
      const preset = savedQuizPresets.find((item) => item.id === selectedQuizPresetId)
      startQuizClock(quizTiming)
      setActiveQuizHistorySnapshot(
        createRunSnapshot(
          quizRegion,
          [
            `${t('Mode')} : ${t('Dessine les frontières')}`,
            `${t('Zone')} : ${drawCountryAlpha2 ?? drawContinents.map((id) => t(quizRegions.find((region) => region.id === id)?.label ?? id)).join(', ')}`
          ],
          preset,
          {
            gameMode: 'draw-borders',
            region: quizRegion,
            continents: [...drawContinents],
            countryAlpha2: drawCountryAlpha2
          },
          quizTiming
        )
      )
      setIsQuizRunning(true)
      setIsQuizSetupOpen(false)
      setIsPresetQuickMenuOpen(false)
      setSpecialQuizGeneration((current) => current + 1)
      return
    }
    startQuizWithSetup({
      region: quizRegion,
      questionCount: quizQuestionCount,
      clues: quizClues,
      answers: quizAnswers,
      supplementalClues: supplementalQuizClues,
      supplementalAnswers: supplementalQuizAnswers,
      timing: quizTiming
    })
  }

  const startRandomQuiz = (): void => {
    setQuizGameMode('base')
    startQuizWithSetup({ ...createRandomQuizSetup(), timing: noQuizTiming }, true)
  }

  const startQuizPreset = (presetId: string): void => {
    const preset = savedQuizPresets.find((item) => item.id === presetId)
    if (!preset) return

    setSelectedQuizPresetId(preset.id)
    setPresetFeedback('')
    setIsPresetQuickMenuOpen(false)
    setSupplementalQuizClues(preset.supplementalClues ?? {})
    setSupplementalQuizAnswers(preset.supplementalAnswers ?? {})
    setSupplementalQuizMenuSide(null)
    const questionCount = Math.min(
      preset.questionCount,
      getAvailableQuizQuestionCount(preset.region)
    )
    const gameMode = preset.gameMode ?? 'base'

    if (gameMode === 'base') {
      startQuizWithSetup(
        {
          region: preset.region,
          questionCount,
          clues: preset.clues,
          answers: preset.answers,
          supplementalClues: preset.supplementalClues ?? {},
          supplementalAnswers: preset.supplementalAnswers ?? {},
          timing: preset.timing ?? noQuizTiming
        },
        false,
        preset
      )
      return
    }

    setQuizRegion(preset.region)
    setQuizQuestionCount(questionCount)
    setQuizClues(preset.clues)
    setQuizAnswers(preset.answers)
    setQuizGameMode(gameMode)
    setEstimationRegion(preset.estimationRegion ?? 'world')
    setEstimationAlpha2s(preset.estimationAlpha2s ?? [])
    setDrawContinents(preset.drawContinents ?? [])
    setDrawCountryAlpha2(preset.drawCountryAlpha2 ?? null)
    setDrawCountrySearch('')
    setDrawCountrySearchOpen(false)
    setActiveQuizClues(preset.clues)
    setActiveQuizAnswers(preset.answers)
    setActiveSupplementalQuizClues(preset.supplementalClues ?? {})
    setActiveSupplementalQuizAnswers(preset.supplementalAnswers ?? {})
    setActiveQuizRegion(preset.region)
    setActiveQuizQuestionCount(questionCount)
    setQuizTiming(preset.timing ?? noQuizTiming)
    startQuizClock(preset.timing ?? noQuizTiming)
    setSelectedQuizCountry(null)
    setSelectedMapCountry(null)
    setMapProximity(null)
    setShowQuizRevealCard(false)
    setShowExpandedQuizCountry(false)
    setFullscreenAnswersOpen(false)
    setIsQuizRunning(true)
    setIsQuizSetupOpen(false)
    lastRecordedQuestionRef.current = null
    quiz.restart([])

    if (gameMode === 'estimation') {
      const region = preset.estimationRegion ?? 'world'
      const alpha2s = preset.estimationAlpha2s ?? []
      setEstimationQuestions(createEstimationQuestions(region, alpha2s, language))
    }
    setActiveQuizHistorySnapshot(
      createRunSnapshot(
        preset.region,
        [
          `${t('Mode')} : ${t(gameMode === 'estimation' ? 'Mode estimation' : 'Dessine les frontières')}`,
          `${t('Nombre de questions')} : ${gameMode === 'estimation' ? preset.estimationAlpha2s?.length || getAvailableQuizQuestionCount(preset.estimationRegion ?? 'world') : preset.drawCountryAlpha2 ? 1 : (preset.drawContinents?.length ?? 0)}`
        ],
        preset,
        gameMode === 'estimation'
          ? {
              gameMode,
              region: preset.estimationRegion ?? 'world',
              alpha2s: preset.estimationAlpha2s ?? []
            }
          : {
              gameMode,
              region: preset.region,
              continents: preset.drawContinents ?? [],
              countryAlpha2: preset.drawCountryAlpha2 ?? null
            },
        preset.timing ?? noQuizTiming
      )
    )
    setReviewQuizCountryAlpha2(null)
    setSpecialQuizGeneration((current) => current + 1)
  }

  const toggleEstimationCountry = (sourceFeatureId: string | number): boolean => {
    const normalizedSourceFeatureId = normalizeCountrySourceFeatureId(sourceFeatureId)
    const country = (countryCatalog as { sourceFeatureId: number; alpha2: string }[]).find(
      (item) => normalizeCountrySourceFeatureId(item.sourceFeatureId) === normalizedSourceFeatureId
    )
    if (!country) return false
    setEstimationAlpha2s((current) =>
      current.includes(country.alpha2)
        ? current.filter((alpha2) => alpha2 !== country.alpha2)
        : [...current, country.alpha2]
    )
    return true
  }

  const stopSpecialQuiz = (): void => {
    timerStartedAtRef.current = null
    timerStoppedAtRef.current = null
    questionTimerStartedAtRef.current = null
    setIsQuizRunning(false)
    setIsQuizSetupOpen(true)
    setFullscreenAnswersOpen(false)
    setActiveQuizClues(idleQuizClues)
    setActiveQuizAnswers(idleQuizAnswers)
    setIsPresetQuickMenuOpen(false)
    setAppView('quiz')
  }

  const recordSpecialQuiz = (
    mode: 'estimation' | 'draw-borders',
    score: number,
    outcome?: QuizTimingOutcome
  ): void => {
    const timing = getCurrentQuizTimingHistory([])
    const finalTiming = timing
      ? {
          ...timing,
          ...(outcome ?? {}),
          expired: outcome?.expired ?? specialTimerExpired
        }
      : timing
    timerStoppedAtRef.current = performance.now()
    setTimerNow(timerStoppedAtRef.current)
    setQuizProgress(saveCompletedQuiz(mode, score))
    appendQuizHistory(
      createHistoryEntry(mode, score, 100, activeQuizHistorySnapshot, [], finalTiming)
    )
  }

  const applyQuizPreset = (presetId: string): void => {
    const preset = savedQuizPresets.find((item) => item.id === presetId)
    setSelectedQuizPresetId(presetId)
    setPresetFeedback('')
    if (!preset) return

    setQuizRegion(preset.region)
    setQuizTiming(preset.timing ?? noQuizTiming)
    setQuizQuestionCount(
      Math.min(preset.questionCount, getAvailableQuizQuestionCount(preset.region))
    )
    setQuizClues(preset.clues)
    setQuizAnswers(preset.answers)
    setSupplementalQuizClues(preset.supplementalClues ?? {})
    setSupplementalQuizAnswers(preset.supplementalAnswers ?? {})
    setSupplementalQuizMenuSide(null)
    setQuizGameMode(preset.gameMode ?? 'base')
    setEstimationRegion(preset.estimationRegion ?? 'world')
    setEstimationAlpha2s(preset.estimationAlpha2s ?? [])
    setDrawContinents(preset.drawContinents ?? [])
    setDrawCountryAlpha2(preset.drawCountryAlpha2 ?? null)
    setDrawCountrySearch('')
    setDrawCountrySearchOpen(false)
  }

  function applyDefaultQuizPreset(): void {
    const preset = savedQuizPresets.find((item) => item.id === defaultQuizPresetId)
    if (preset) applyQuizPreset(preset.id)
  }

  const toggleSelectedPresetDefault = (): void => {
    if (!selectedQuizPresetId) return
    const nextDefaultPresetId =
      selectedQuizPresetId === defaultQuizPresetId ? '' : selectedQuizPresetId
    if (!saveDefaultQuizPresetId(nextDefaultPresetId)) {
      setPresetFeedback(t('Enregistrement impossible sur cet appareil.'))
      return
    }

    setDefaultQuizPresetId(nextDefaultPresetId)
    setPresetFeedback(
      t(nextDefaultPresetId ? 'Preset défini par défaut.' : 'Preset par défaut désactivé.')
    )
  }

  const returnFromStatistics = (): void => {
    if (statisticsReturnView === 'quiz') {
      applyDefaultQuizPreset()
      setIsQuizSetupOpen(false)
    }
    setAppView(statisticsReturnView)
  }

  const saveCurrentQuizPreset = (): void => {
    const name = presetName.trim()
    if (!name) return

    const existing = savedQuizPresets.find(
      (preset) =>
        preset.id === selectedQuizPresetId ||
        preset.name.toLocaleLowerCase('fr') === name.toLocaleLowerCase('fr')
    )
    const preset: QuizPreset = {
      id: existing?.id ?? `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      region: quizRegion,
      questionCount: Math.min(quizQuestionCount, getAvailableQuizQuestionCount(quizRegion)),
      clues: { ...quizClues },
      answers: { ...quizAnswers },
      supplementalClues: { ...supplementalQuizClues },
      supplementalAnswers: { ...supplementalQuizAnswers },
      gameMode: quizGameMode,
      timing: { ...quizTiming },
      estimationRegion,
      estimationAlpha2s: [...estimationAlpha2s],
      drawContinents: [...drawContinents],
      drawCountryAlpha2
    }
    const updated = existing
      ? savedQuizPresets.map((item) => (item.id === existing.id ? preset : item))
      : [...savedQuizPresets, preset]

    if (!saveQuizPresets(updated)) {
      setPresetFeedback(t('Enregistrement impossible sur cet appareil.'))
      return
    }

    setSavedQuizPresets(updated)
    setSelectedQuizPresetId(preset.id)
    setIsSavingPreset(false)
    setPresetName('')
    setPresetFeedback(`${t('Preset enregistré')} « ${name} »`)
  }

  const deleteSelectedQuizPreset = (): void => {
    const updated = savedQuizPresets.filter((preset) => preset.id !== selectedQuizPresetId)
    if (!saveQuizPresets(updated)) {
      setPresetFeedback(t('Suppression impossible sur cet appareil.'))
      return
    }
    setSavedQuizPresets(updated)
    setSelectedQuizPresetId('')
    if (defaultQuizPresetId === selectedQuizPresetId) {
      saveDefaultQuizPresetId('')
      setDefaultQuizPresetId('')
    }
    setPresetFeedback(t('Preset supprimé.'))
  }

  const selectQuizContent = (
    id: keyof QuizClues,
    side: 'clue' | 'answer',
    checked: boolean
  ): void => {
    if (side === 'clue') {
      setQuizClues((current) => ({ ...current, [id]: checked }))
      if (checked) setQuizAnswers((current) => ({ ...current, [id]: false }))
      return
    }

    setQuizAnswers((current) => ({ ...current, [id]: checked }))
    if (checked) setQuizClues((current) => ({ ...current, [id]: false }))
  }

  const addSupplementalQuizContent = (
    side: 'clue' | 'answer',
    id: SupplementalQuizFactId
  ): void => {
    const addIfMissing = (current: SupplementalQuizFactSettings): SupplementalQuizFactSettings =>
      id in current ? current : { ...current, [id]: false }
    if (side === 'clue') setSupplementalQuizClues(addIfMissing)
    else setSupplementalQuizAnswers(addIfMissing)
    setSupplementalQuizMenuSide(null)
  }

  const removeSupplementalQuizContent = (
    side: 'clue' | 'answer',
    id: SupplementalQuizFactId
  ): void => {
    const remove = (current: SupplementalQuizFactSettings): SupplementalQuizFactSettings => {
      const next = { ...current }
      delete next[id]
      return next
    }
    if (side === 'clue') setSupplementalQuizClues(remove)
    else setSupplementalQuizAnswers(remove)
  }

  const selectSupplementalQuizContent = (
    id: SupplementalQuizFactId,
    side: 'clue' | 'answer',
    checked: boolean
  ): void => {
    const setSelectedValue = (
      current: SupplementalQuizFactSettings
    ): SupplementalQuizFactSettings => ({
      ...current,
      [id]: checked
    })
    if (side === 'clue') {
      setSupplementalQuizClues(setSelectedValue)
      if (checked) {
        setSupplementalQuizAnswers((current) =>
          id in current ? { ...current, [id]: false } : current
        )
      }
      return
    }

    setSupplementalQuizAnswers(setSelectedValue)
    if (checked) {
      setSupplementalQuizClues((current) => (id in current ? { ...current, [id]: false } : current))
    }
  }

  const snapQuestionCountToMark = (value: number): number => {
    const marks = [10, 25, 50, maxQuizQuestionCount].filter(
      (mark, index, allMarks) => mark <= maxQuizQuestionCount && allMarks.indexOf(mark) === index
    )
    return marks.find((mark) => Math.abs(value - mark) <= 1) ?? value
  }

  const rejectLateQuestionAction = (): boolean => {
    if (activeQuizTiming.mode !== 'countdown') return false
    if (activeQuizTiming.scope === 'session') {
      if (timerStartedAtRef.current === null) return false
      const sessionKey = 'session'
      const deadline = timerStartedAtRef.current + activeQuizTiming.limitSeconds * 1000
      if (performance.now() < deadline) return false
      if (timerExpirationRef.current !== sessionKey) {
        timerExpirationRef.current = sessionKey
        recordCurrentQuestionResult()
        quiz.finishByTimeout()
      }
      return true
    }
    const questionKey = `${sessionGeneration}:${quiz.session.questionIndex}`
    if (quiz.session.answerCorrect === true || quiz.session.answerRevealed) return false
    if (questionTimerKeyRef.current !== questionKey || questionTimerStartedAtRef.current === null) {
      questionTimerKeyRef.current = questionKey
      questionTimerStartedAtRef.current = performance.now()
      questionTimerRemainingRef.current = activeQuizTiming.limitSeconds * 1000
      return false
    }
    const deadline = questionTimerStartedAtRef.current + activeQuizTiming.limitSeconds * 1000
    if (performance.now() < deadline) return false
    questionTimerRemainingRef.current = 0
    if (timerExpirationRef.current !== questionKey) {
      timerExpirationRef.current = questionKey
      quiz.timeoutCurrent()
    }
    return true
  }

  const handleCountrySelected = (
    sourceFeatureId: string | number,
    name: string,
    entityId: string | null
  ): boolean => {
    if (rejectLateQuestionAction()) return false
    const question = quiz.session.questionOrder[quiz.session.questionIndex]
    if (
      !isQuizRunning ||
      !activeQuizAnswers.countryOnMap ||
      !question ||
      quiz.session.answerResults.countryOnMap === true ||
      quiz.session.answerRevealed
    ) {
      return false
    }

    if (question.countryAnswerGroup.length > 1) {
      const country = countryCatalog.find(
        (item) => Number(item.sourceFeatureId) === Number(sourceFeatureId)
      )
      if (!country) return false
      const alreadySelected = selectedMapAnswerAlpha2s.includes(country.alpha2)
      const nextSelection = alreadySelected
        ? selectedMapAnswerAlpha2s.filter((alpha2) => alpha2 !== country.alpha2)
        : [...selectedMapAnswerAlpha2s, country.alpha2]
      setSelectedMapAnswerAlpha2s(nextSelection)
      const lastSelected = nextSelection.at(-1)
      const lastSelectedCountry = lastSelected
        ? countryCatalog.find((item) => item.alpha2 === lastSelected)
        : undefined
      setSelectedMapCountry(
        lastSelectedCountry
          ? {
              sourceFeatureId: lastSelectedCountry.sourceFeatureId,
              name:
                new Intl.DisplayNames([language], { type: 'region' }).of(
                  lastSelectedCountry.alpha2
                ) ?? lastSelectedCountry.countryName,
              entityId: null,
              revealed: false
            }
          : null
      )
      setMapProximity(null)
      return question.countryAnswerGroup.some((answer) => answer.alpha2 === country.alpha2)
    }

    setMapProximity(null)
    setSelectedMapCountry({ sourceFeatureId, name, entityId, revealed: false })
    const mapAnswerIsCorrect = Number(sourceFeatureId) === question.sourceFeatureId
    quiz.answerItems(
      { countryOnMap: mapAnswerIsCorrect },
      JSON.stringify({ countryOnMap: sourceFeatureId })
    )
    return mapAnswerIsCorrect
  }

  const handleQuizMapClick = (
    [longitude, latitude]: [number, number],
    clickedSourceFeatureId?: string | number
  ): MapProximityResult | null => {
    if (rejectLateQuestionAction()) return null
    const question = quiz.session.questionOrder[quiz.session.questionIndex]
    if (
      !isQuizRunning ||
      !activeQuizAnswers.countryOnMap ||
      !question ||
      question.countryAnswerGroup.length > 1 ||
      quiz.session.answerResults.countryOnMap === true ||
      quiz.session.answerRevealed
    ) {
      return null
    }

    const proximity =
      clickedSourceFeatureId !== undefined &&
      Number(clickedSourceFeatureId) === question.sourceFeatureId
        ? { score: 100, distanceKm: 0 }
        : getMapProximityResult(question.sourceFeatureId, longitude, latitude)
    if (!mapLayers.borders) {
      borderlessMapPrecisionRef.current.total += proximity.score
      borderlessMapPrecisionRef.current.samples += 1
    }
    setMapProximity(proximity)
    return proximity
  }

  const revealQuizAnswer = (): void => {
    if (!isQuizRunning) return
    if (rejectLateQuestionAction()) return
    const question = quiz.session.questionOrder[quiz.session.questionIndex]
    if (!question) return

    quiz.revealAnswer()
    setMapProximity(null)
    setFullscreenAnswersOpen(false)
    setSelectedMapAnswerAlpha2s(
      question.countryAnswerGroup.length > 1
        ? question.countryAnswerGroup.map(({ alpha2 }) => alpha2)
        : []
    )
    setSelectedMapCountry({
      sourceFeatureId: question.sourceFeatureId,
      name: question.frenchCountryName,
      entityId: null,
      revealed: true
    })
    setShowExpandedQuizCountry(false)
    setShowQuizRevealCard(!isQuizFullscreen)
  }

  const submitCountryQuizAnswers = (outcomes: Record<string, boolean>): void => {
    if (!isQuizRunning) return
    if (rejectLateQuestionAction()) return
    if (Object.keys(outcomes).length === 0) return
    quiz.answerItems(outcomes, JSON.stringify(outcomes))
    const allAnswersCorrect = Object.keys(quiz.session.answerWeights).every(
      (key) => quiz.session.answerResults[key] === true || outcomes[key] === true
    )
    if (isQuizFullscreen && allAnswersCorrect) setFullscreenAnswersOpen(false)
  }

  const submitMultiCountryQuizAnswer = (
    key: string,
    fractionEarned: number,
    outcome: 'progress' | 'correct' | 'incorrect',
    submittedValues: readonly string[],
    foundValues: readonly string[]
  ): void => {
    if (!isQuizRunning) return
    if (rejectLateQuestionAction()) return
    quiz.answerPartial(
      key,
      fractionEarned,
      outcome,
      JSON.stringify({ submittedValues, foundValues })
    )
    const allAnswersCorrect = Object.keys(quiz.session.answerWeights).every((answerKey) =>
      answerKey === key ? outcome === 'correct' : quiz.session.answerResults[answerKey] === true
    )
    if (isQuizFullscreen && allAnswersCorrect) setFullscreenAnswersOpen(false)
    if (key === 'countryOnMap') {
      setSelectedMapAnswerAlpha2s([])
      setSelectedMapCountry(null)
    }
  }

  const nextQuizQuestion = (): void => {
    if (!isQuizRunning) return
    setSelectedMapAnswerAlpha2s([])
    setSelectedMapCountry(null)
    recordCurrentQuestionResult()
    setSelectedMapCountry(null)
    setMapProximity(null)
    setShowQuizRevealCard(false)
    setShowExpandedQuizCountry(false)
    setFullscreenAnswersOpen(isQuizFullscreen)
    quiz.next()
  }

  const recordCurrentQuestionResult = (): void => {
    const current = quiz.session
    if (current.answerCorrect !== true && !current.answerRevealed) return

    const question = current.questionOrder[current.questionIndex]
    if (!question) return

    const questionKey = `${sessionGeneration}:${current.questionIndex}:${question.sourceFeatureId}`
    if (lastRecordedQuestionRef.current === questionKey) return

    lastRecordedQuestionRef.current = questionKey
    const questionResult = getCountryQuizQuestionResult(
      current.answerWeights,
      current.answerResults,
      current.answerPoints
    )
    const updatedStats = updateCountryQuizStats(
      countryQuizStats,
      question.alpha2,
      sessionMode,
      current.answerCorrect === true,
      questionResult
    )
    setCountryQuizStats(updatedStats)
    saveCountryQuizStats(updatedStats)
  }

  const stopQuiz = (): void => {
    timerStartedAtRef.current = null
    timerStoppedAtRef.current = null
    questionTimerStartedAtRef.current = null
    recordCurrentQuestionResult()
    quiz.restart([])
    setSelectedQuizCountry(null)
    lastRecordedQuestionRef.current = null
    setSelectedMapCountry(null)
    setMapProximity(null)
    setShowQuizRevealCard(false)
    setReviewQuizCountryAlpha2(null)
    setShowExpandedQuizCountry(false)
    setFullscreenAnswersOpen(false)
    setIsQuizRunning(false)
    setIsQuizSetupOpen(false)
    setIsPresetQuickMenuOpen(false)
    setActiveQuizClues(idleQuizClues)
    setActiveQuizAnswers(idleQuizAnswers)
    exitQuizFullscreen()
    setAppView('quiz')
  }

  useKeyboardShortcut(
    'quiz.stop',
    stopQuiz,
    appView === 'quiz' && isQuizRunning && quizGameMode === 'base'
  )

  if (appView === 'exploration') {
    return (
      <ExplorationView
        globeMode={globeMode}
        onToggleGlobeMode={toggleGlobeMode}
        isFullscreen={isMapFullscreen}
        onToggleFullscreen={toggleMapFullscreen}
        onOpenStatistics={openStatistics}
        onCompareCountries={openCountryComparator}
        onModeChange={openPrimaryMode}
      />
    )
  }

  if (appView === 'comparator') {
    return (
      <CountryComparatorView
        onModeChange={openPrimaryMode}
        onOpenStatistics={openStatistics}
        initialAlpha2={comparisonInitialAlpha2}
      />
    )
  }

  if (appView === 'statistics') {
    return (
      <StatisticsView
        countryStats={countryQuizStats}
        quizProgress={quizProgress}
        globeMode={globeMode}
        onToggleGlobeMode={toggleGlobeMode}
        onReturn={returnFromStatistics}
        onOpenCountryQuiz={startCountryQuiz}
        onModeChange={openPrimaryMode}
        quizHistory={quizHistory}
        savedPresets={savedQuizPresets}
      />
    )
  }

  if (appView === 'country-quiz' && countryKnowledgeAlpha2) {
    return (
      <CountryKnowledgeQuizView
        alpha2={countryKnowledgeAlpha2}
        globeMode={globeMode}
        onToggleGlobeMode={toggleGlobeMode}
        isFullscreen={isMapFullscreen}
        onToggleFullscreen={toggleMapFullscreen}
        onOpenStatistics={openStatistics}
        onModeChange={openPrimaryMode}
        session={countryKnowledgeQuiz.session}
        onAnswer={answerCountryKnowledgeQuestion}
        onRevealAnswer={revealCountryKnowledgeAnswer}
        onNext={countryKnowledgeQuiz.next}
        onRestart={replayCountryQuiz}
        onStop={stopCountryQuiz}
      />
    )
  }

  if (appView === 'country-select') {
    return (
      <CountryQuizSelectionView
        onStart={startCountryQuiz}
        onModeChange={openPrimaryMode}
        globeMode={globeMode}
        onToggleGlobeMode={toggleGlobeMode}
        isFullscreen={isMapFullscreen}
        onToggleFullscreen={toggleMapFullscreen}
        onOpenStatistics={openStatistics}
      />
    )
  }

  if (appView === 'quiz' && showExpandedQuizCountry && currentQuizQuestion && revealedQuizPlace) {
    return (
      <QuizCountryStudyView
        place={revealedQuizPlace}
        sourceFeatureId={currentQuizQuestion.sourceFeatureId}
        globeMode={globeMode}
        onToggleGlobeMode={toggleGlobeMode}
        isFullscreen={isMapFullscreen}
        onToggleFullscreen={toggleMapFullscreen}
        onOpenStatistics={openStatistics}
        onModeChange={openPrimaryMode}
        onReturnToQuiz={() => setShowExpandedQuizCountry(false)}
      />
    )
  }

  const mapLayerControls = (
    <MapLayerControls
      layers={mapLayerOptions.map((layer) => {
        const densityId =
          layer.id === 'borders' ||
          layer.id === 'mountains' ||
          layer.id === 'marineLabels' ||
          layer.id === 'marineBorders'
            ? null
            : (layer.id as DensityLayerId)
        return {
          id: layer.id,
          label: layer.label,
          enabled: mapLayers[layer.id],
          density: densityId ? mapLayerDensities[densityId] : 0,
          maximum: densityId ? mapLayerDensityMaximums[densityId] : 0,
          fixedCount: layer.id === 'mountains' ? mountainRanges.length : undefined,
          subLayer: layer.subLayer
            ? {
                id: layer.subLayer.id,
                label: layer.subLayer.label,
                enabled: mapLayers[layer.subLayer.id],
                density: mapLayerDensities.mountains,
                maximum: mapLayerDensityMaximums.mountains,
                showDensity: layer.subLayer.showDensity
              }
            : undefined,
          hideSummary: layer.id === 'marineLabels',
          title: layer.title,
          border: layer.id === 'borders',
          disabled: !layer.available
        }
      })}
      onToggle={(id, enabled) => {
        const layerId = id as MapLayerId
        setMapLayers((current) => ({ ...current, [layerId]: enabled }))
        if (enabled && layerId === 'summits' && mapLayerDensities.mountains === 0) {
          setMapLayerDensities((current) => ({ ...current, mountains: 1 }))
        } else if (
          enabled &&
          layerId !== 'borders' &&
          layerId !== 'marineLabels' &&
          layerId !== 'marineBorders' &&
          layerId !== 'mountains' &&
          layerId !== 'summits'
        ) {
          const densityId = layerId as DensityLayerId
          if (mapLayerDensities[densityId] === 0) {
            setMapLayerDensities((current) => ({ ...current, [densityId]: 1 }))
          }
        }
      }}
      onDensityChange={(id, value) => {
        const densityId = (id === 'summits' ? 'mountains' : id) as DensityLayerId
        setMapLayerDensities((current) => ({ ...current, [densityId]: value }))
        const visibilityId: MapLayerId =
          densityId === 'mountains' ? 'summits' : (densityId as MapLayerId)
        setMapLayers((current) => ({ ...current, [visibilityId]: value > 0 }))
      }}
    />
  )

  const canStartQuiz =
    quizGameMode !== 'base' ||
    ((Object.values(quizClues).some(Boolean) ||
      Object.values(supplementalQuizClues).some(Boolean)) &&
      (Object.values(quizAnswers).some(Boolean) ||
        Object.values(supplementalQuizAnswers).some(Boolean)))

  const runningQuizTotal = quiz.session.questionOrder.length
  const runningQuizAnswered = Math.min(
    runningQuizTotal,
    quiz.session.questionIndex +
      (quiz.session.answerCorrect === true || quiz.session.answerRevealed ? 1 : 0)
  )
  const runningQuizProgress = runningQuizTotal ? (runningQuizAnswered / runningQuizTotal) * 100 : 0
  const runningQuestionNumber = Math.min(quiz.session.questionIndex + 1, runningQuizTotal)

  const toggleDrawContinent = (continent: ContinentId): void => {
    setDrawCountryAlpha2(null)
    setDrawCountrySearch('')
    setDrawCountrySearchOpen(false)
    setDrawContinents((current) =>
      current.includes(continent)
        ? current.filter((item) => item !== continent)
        : [...current, continent]
    )
  }

  const filteredDrawCountryOptions = drawCountrySearch.trim()
    ? drawCountryOptions.filter((country) =>
        normalizeCountrySearchText(country.name).startsWith(
          normalizeCountrySearchText(drawCountrySearch)
        )
      )
    : []

  const selectDrawCountry = (alpha2: string): void => {
    setDrawCountryAlpha2(alpha2)
    setDrawContinents([])
    setDrawCountrySearch('')
    setDrawCountrySearchOpen(false)
  }

  const estimationSelectionLabel = estimationAlpha2s.length
    ? (() => {
        const displayNames = new Intl.DisplayNames([language], { type: 'region' })
        const catalog = countryCatalog as { alpha2: string; countryName: string }[]
        const selectedNames = estimationAlpha2s
          .slice(0, 4)
          .map(
            (alpha2) =>
              displayNames.of(alpha2) ??
              catalog.find((country) => country.alpha2 === alpha2)?.countryName ??
              alpha2
          )
        const remaining = estimationAlpha2s.length - selectedNames.length
        return `${estimationAlpha2s.length} ${t(estimationAlpha2s.length === 1 ? 'pays sélectionné' : 'pays sélectionnés')} · ${selectedNames.join(', ')}${remaining > 0 ? ` +${remaining}` : ''}`
      })()
    : t(
        quizRegions.find((region) => region.id === estimationRegion)?.label ?? 'Tous les continents'
      )

  if (appView === 'quiz' && isQuizRunning && quizGameMode === 'estimation') {
    return (
      <EstimationQuizView
        key={specialQuizGeneration}
        questions={estimationQuestions}
        onStop={stopSpecialQuiz}
        onRestart={startNewQuiz}
        onCompleted={(score, outcome) => recordSpecialQuiz('estimation', score, outcome)}
        globeMode={globeMode}
        onToggleGlobeMode={toggleGlobeMode}
        timing={activeQuizTiming}
        timerMilliseconds={activeTimerMilliseconds}
        timeExpired={specialTimerExpired}
      />
    )
  }

  if (appView === 'quiz' && isQuizRunning && quizGameMode === 'draw-borders') {
    return (
      <DrawBordersQuizView
        key={specialQuizGeneration}
        continents={drawContinents}
        countryAlpha2={drawCountryAlpha2}
        onStop={stopSpecialQuiz}
        onRestart={startNewQuiz}
        onCompleted={(score, outcome) => recordSpecialQuiz('draw-borders', score, outcome)}
        globeMode={globeMode}
        onToggleGlobeMode={toggleGlobeMode}
        timing={activeQuizTiming}
        timerMilliseconds={activeTimerMilliseconds}
        timeExpired={specialTimerExpired}
      />
    )
  }

  return (
    <div className={`app-shell${isQuizFullscreen ? ' quiz-fullscreen' : ''}`}>
      <main className="main-content">
        <div className={`quiz-configuration-area${isQuizRunning ? ' is-running' : ''}`}>
          {isQuizRunning ? (
            <header className="quiz-live-topbar">
              <div className="quiz-live-settings">
                <span>{t('PARTIE EN COURS')}</span>
                <strong>
                  {t(
                    quizRegions.find((region) => region.id === activeQuizRegion)?.label ??
                      'Tous les continents'
                  )}{' '}
                  · {activeQuizQuestionCount} {t('pays')}
                </strong>
                <small>
                  {t('Indices')} :{' '}
                  {[
                    getContentLabels(activeQuizClues, t),
                    ...supplementalQuizFactOptions
                      .filter(({ id }) => activeSupplementalQuizClues[id])
                      .map(({ label }) => t(label))
                  ]
                    .filter(Boolean)
                    .join(', ')}{' '}
                  · {t('Réponses')} :{' '}
                  {[
                    getContentLabels(activeQuizAnswers, t),
                    ...supplementalQuizFactOptions
                      .filter(({ id }) => activeSupplementalQuizAnswers[id])
                      .map(({ label }) => t(label))
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </small>
                <small className="quiz-live-progress-copy">
                  {quiz.session.completed
                    ? t('Quiz terminé')
                    : `${t('Question')} ${String(runningQuestionNumber).padStart(2, '0')}/${runningQuizTotal}`}{' '}
                  · {runningQuizAnswered} {t(runningQuizAnswered > 1 ? 'réponses' : 'réponse')}{' '}
                  {t('sur')} {runningQuizTotal} · {t('Score :')}{' '}
                  {formatQuizScore(quiz.session.score, language)} / {runningQuizTotal}
                </small>
                {activeQuizTiming.mode !== 'none' && (
                  <small className="quiz-live-timer" aria-live="off">
                    {t(activeQuizTiming.mode === 'stopwatch' ? 'Chrono' : 'Temps restant')} ·{' '}
                    {formatDuration(activeTimerMilliseconds, language)}
                  </small>
                )}
                <div
                  className="quiz-live-progress-track"
                  role="progressbar"
                  aria-label={t('Progression du quiz')}
                  aria-valuemin={0}
                  aria-valuemax={runningQuizTotal}
                  aria-valuenow={runningQuizAnswered}
                >
                  <span style={{ width: `${runningQuizProgress}%` }} />
                </div>
              </div>
              <div className="quiz-live-actions">
                <SkinSelector compact />
                <button type="button" onClick={enterQuizFullscreen}>
                  {t('Plein écran')}
                </button>
                <button
                  type="button"
                  className="stop"
                  data-shortcut-action="quiz.stop"
                  onClick={stopQuiz}
                >
                  {t('Arrêter')}
                </button>
              </div>
            </header>
          ) : null}

          {!isQuizRunning && (
            <AppModeSwitcher
              active="quiz"
              onChange={openPrimaryMode}
              pageTitle={t('Quizz monde')}
              onOpenStatistics={openStatistics}
            />
          )}

          {!isQuizRunning && (
            <section className="quiz-setup-area" aria-label={t('Réglages de la partie')}>
              <div className="quiz-setup-launcher">
                <button
                  className="quiz-setup-trigger"
                  type="button"
                  aria-expanded={isQuizSetupOpen}
                  aria-controls="quiz-settings-panel"
                  onClick={() => setIsQuizSetupOpen((open) => !open)}
                >
                  <span>
                    {t(isQuizSetupOpen ? 'Masquer les réglages' : 'Paramétrer une partie')}
                  </span>
                  <small>
                    {selectedQuizPresetId
                      ? savedQuizPresets.find((preset) => preset.id === selectedQuizPresetId)?.name
                      : t('Configuration personnalisée')}
                    {defaultQuizPresetId && selectedQuizPresetId === defaultQuizPresetId
                      ? ` · ${t('Preset par défaut')}`
                      : ''}
                  </small>
                </button>
                <div className="quiz-preset-quick-launcher" ref={presetQuickMenuRef}>
                  <button
                    className="quiz-random-button quiz-preset-quick-button"
                    type="button"
                    disabled={!defaultQuizPreset}
                    title={t(
                      defaultQuizPreset ? 'Lancer le preset par défaut' : 'Aucun preset par défaut'
                    )}
                    onClick={() => defaultQuizPreset && startQuizPreset(defaultQuizPreset.id)}
                  >
                    {t('Preset')}
                  </button>
                  <button
                    className="quiz-random-button quiz-preset-menu-toggle"
                    type="button"
                    aria-label={t('Choisir et lancer un preset')}
                    aria-haspopup="menu"
                    aria-expanded={isPresetQuickMenuOpen}
                    aria-controls="quiz-preset-quick-menu"
                    onClick={() => setIsPresetQuickMenuOpen((open) => !open)}
                  >
                    <span aria-hidden="true">⌄</span>
                  </button>
                  {isPresetQuickMenuOpen && (
                    <div className="quiz-preset-quick-menu" id="quiz-preset-quick-menu" role="menu">
                      {savedQuizPresets.length ? (
                        savedQuizPresets.map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            role="menuitem"
                            className="quiz-preset-quick-menu-item"
                            onClick={() => startQuizPreset(preset.id)}
                          >
                            <span>{preset.name}</span>
                            {preset.id === defaultQuizPresetId && <small>{t('Par défaut')}</small>}
                          </button>
                        ))
                      ) : (
                        <div className="quiz-preset-quick-menu-empty">
                          <strong>{t('Aucun preset enregistré')}</strong>
                          <span>
                            {t('Enregistre un preset dans les réglages pour le lancer ici.')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button className="quiz-random-button" type="button" onClick={startRandomQuiz}>
                  {t('Partie aléatoire')}
                </button>
              </div>

              {isQuizSetupOpen && (
                <div className="quiz-settings-panel" id="quiz-settings-panel">
                  <header className="quiz-settings-heading">
                    <div>
                      <span>{t('PARAMÈTRES DE LA PARTIE')}</span>
                      <h2>{t('Choisis comment jouer')}</h2>
                      <p>
                        {t(
                          quizGameMode === 'base'
                            ? 'Choisis une zone géographique, le nombre de pays et les indices ou réponses de la partie.'
                            : quizGameMode === 'estimation'
                              ? 'Choisis une région ou des pays, puis estime les données demandées.'
                              : 'Choisis un ou plusieurs continents pour dessiner leurs frontières.'
                        )}
                      </p>
                    </div>
                    <div className="quiz-settings-heading-actions">
                      <button
                        className="quiz-start-button"
                        type="button"
                        onClick={startNewQuiz}
                        disabled={!canStartQuiz}
                      >
                        {t('Lancer la partie')}
                      </button>
                      <button
                        type="button"
                        className="quiz-settings-close"
                        aria-label={t('Fermer les réglages')}
                        onClick={() => setIsQuizSetupOpen(false)}
                      >
                        ×
                      </button>
                    </div>
                  </header>

                  <div
                    className={`quiz-settings-selectors${quizGameMode === 'draw-borders' ? ' is-single' : ''}`}
                  >
                    <label className="quiz-game-mode-field">
                      <span>{t('MODE DE JEU')}</span>
                      <select
                        value={quizGameMode}
                        onChange={(event) => {
                          const nextMode = event.target.value as QuizGameMode
                          setQuizGameMode(nextMode)
                          if (nextMode === 'draw-borders') {
                            setQuizTiming((current) => ({ ...current, scope: 'session' }))
                          }
                        }}
                      >
                        <option value="base">{t('Base')}</option>
                        <option value="estimation">{t('Estimation')}</option>
                        <option value="draw-borders">{t('Dessine les frontières')}</option>
                      </select>
                    </label>

                    {quizGameMode !== 'draw-borders' && (
                      <label className="quiz-settings-region-field">
                        <span>{t('ZONE GÉOGRAPHIQUE')}</span>
                        <select
                          value={quizGameMode === 'estimation' ? estimationRegion : quizRegion}
                          onChange={(event) => {
                            const region = quizRegions.find(
                              (item) => item.id === event.target.value
                            )
                            if (!region) return
                            if (quizGameMode === 'estimation') {
                              setEstimationRegion(region.id)
                              setEstimationAlpha2s([])
                            } else {
                              handleQuizRegionChange(region.id)
                            }
                          }}
                        >
                          {quizRegions.map((region) => (
                            <option key={region.id} value={region.id}>
                              {t(region.label)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  {
                    <section className="quiz-timing-settings" aria-label={t('Chronométrage')}>
                      <div>
                        <span className="quiz-content-picker-caption">{t('CHRONOMÉTRAGE')}</span>
                        <div
                          className="quiz-timing-mode-options"
                          role="group"
                          aria-label={t('Mode de temps')}
                        >
                          {(['none', 'stopwatch', 'countdown'] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              className={quizTiming.mode === mode ? 'is-active' : ''}
                              aria-pressed={quizTiming.mode === mode}
                              onClick={() =>
                                setQuizTiming((current) => ({
                                  ...current,
                                  mode,
                                  ...(mode === 'stopwatch' ? { scope: 'session' } : {})
                                }))
                              }
                            >
                              {t(
                                mode === 'none'
                                  ? 'Sans chrono'
                                  : mode === 'stopwatch'
                                    ? 'Chrono'
                                    : 'Minuteur'
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                      {quizTiming.mode === 'countdown' && (
                        <div className="quiz-timing-options">
                          <label>
                            <span>{t('Portée')}</span>
                            <select
                              value={quizTiming.scope}
                              onChange={(event) =>
                                setQuizTiming((current) => ({
                                  ...current,
                                  scope: event.target.value as QuizTimingSettings['scope']
                                }))
                              }
                            >
                              <option value="question" disabled={quizGameMode === 'draw-borders'}>
                                {t('Par question')}
                              </option>
                              <option value="session">{t('Partie entière')}</option>
                            </select>
                          </label>
                          <label>
                            <span>{t('Durée en secondes')}</span>
                            <input
                              type="number"
                              min={5}
                              max={7200}
                              step={5}
                              value={quizTiming.limitSeconds}
                              onChange={(event) => {
                                const limitSeconds = Number(event.target.value)
                                if (!Number.isInteger(limitSeconds)) return
                                setQuizTiming((current) => ({
                                  ...current,
                                  limitSeconds: Math.max(5, Math.min(7200, limitSeconds))
                                }))
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </section>
                  }

                  {quizGameMode === 'base' ? (
                    <section
                      className="quiz-toolbar quiz-base-settings"
                      aria-label={t('Réglages de la partie')}
                    >
                      <div className="quiz-content-picker">
                        <span className="quiz-content-picker-caption">{t('CONTENU DU QUIZ')}</span>
                        <span className="quiz-content-picker-value">
                          {t('Choisir indices et réponses')}
                        </span>
                        <div
                          className="quiz-content-settings"
                          role="group"
                          aria-label={t('Choisir les indices et les réponses')}
                        >
                          <div className="quiz-content-settings-columns">
                            <fieldset>
                              <legend>{t('Indices donnés par le jeu')}</legend>
                              {quizContentOptions.map((option) => (
                                <label key={option.id} className="quiz-content-setting">
                                  <input
                                    type="checkbox"
                                    checked={quizClues[option.id]}
                                    onChange={(event) =>
                                      selectQuizContent(option.id, 'clue', event.target.checked)
                                    }
                                  />
                                  <span>{t(option.label)}</span>
                                </label>
                              ))}
                              {supplementalQuizFactOptions
                                .filter(({ id }) => id in supplementalQuizClues)
                                .map((option) => (
                                  <div key={option.id} className="quiz-content-setting-extra">
                                    <label className="quiz-content-setting">
                                      <input
                                        type="checkbox"
                                        checked={supplementalQuizClues[option.id] ?? false}
                                        onChange={(event) =>
                                          selectSupplementalQuizContent(
                                            option.id,
                                            'clue',
                                            event.target.checked
                                          )
                                        }
                                      />
                                      <span>{t(option.label)}</span>
                                    </label>
                                    <button
                                      className="quiz-content-setting-remove"
                                      type="button"
                                      aria-label={`${t('Retirer cet élément')} : ${t(option.label)}`}
                                      title={t('Retirer cet élément')}
                                      onClick={() =>
                                        removeSupplementalQuizContent('clue', option.id)
                                      }
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              <div className="quiz-content-add-control">
                                <button
                                  className="quiz-content-add-button"
                                  type="button"
                                  aria-label={t('Ajouter un indice')}
                                  title={t('Ajouter un indice')}
                                  aria-expanded={supplementalQuizMenuSide === 'clue'}
                                  aria-controls="quiz-supplemental-clue-menu"
                                  onClick={() =>
                                    setSupplementalQuizMenuSide((side) =>
                                      side === 'clue' ? null : 'clue'
                                    )
                                  }
                                >
                                  +
                                </button>
                                {supplementalQuizMenuSide === 'clue' && (
                                  <div
                                    className="quiz-content-add-menu"
                                    id="quiz-supplemental-clue-menu"
                                    role="group"
                                    aria-label={t('Ajouter un indice')}
                                  >
                                    <span className="quiz-content-add-menu-title">
                                      {t('Ajouter un indice')}
                                    </span>
                                    {supplementalQuizFactOptions
                                      .filter(({ id }) => !(id in supplementalQuizClues))
                                      .map((option) => (
                                        <button
                                          key={option.id}
                                          type="button"
                                          onClick={() =>
                                            addSupplementalQuizContent('clue', option.id)
                                          }
                                        >
                                          {t(option.label)}
                                        </button>
                                      ))}
                                    {supplementalQuizFactOptions.every(
                                      ({ id }) => id in supplementalQuizClues
                                    ) && (
                                      <span className="quiz-content-add-menu-empty">
                                        {t('Toutes les données sont déjà ajoutées.')}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </fieldset>
                            <fieldset>
                              <legend>{t('Réponses à donner')}</legend>
                              {quizContentOptions.map((option) => (
                                <label key={option.id} className="quiz-content-setting">
                                  <input
                                    type="checkbox"
                                    checked={quizAnswers[option.id]}
                                    onChange={(event) =>
                                      selectQuizContent(option.id, 'answer', event.target.checked)
                                    }
                                  />
                                  <span>{t(option.label)}</span>
                                </label>
                              ))}
                              {supplementalQuizFactOptions
                                .filter(({ id }) => id in supplementalQuizAnswers)
                                .map((option) => (
                                  <div key={option.id} className="quiz-content-setting-extra">
                                    <label className="quiz-content-setting">
                                      <input
                                        type="checkbox"
                                        checked={supplementalQuizAnswers[option.id] ?? false}
                                        onChange={(event) =>
                                          selectSupplementalQuizContent(
                                            option.id,
                                            'answer',
                                            event.target.checked
                                          )
                                        }
                                      />
                                      <span>{t(option.label)}</span>
                                    </label>
                                    <button
                                      className="quiz-content-setting-remove"
                                      type="button"
                                      aria-label={`${t('Retirer cet élément')} : ${t(option.label)}`}
                                      title={t('Retirer cet élément')}
                                      onClick={() =>
                                        removeSupplementalQuizContent('answer', option.id)
                                      }
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              <div className="quiz-content-add-control">
                                <button
                                  className="quiz-content-add-button"
                                  type="button"
                                  aria-label={t('Ajouter une réponse')}
                                  title={t('Ajouter une réponse')}
                                  aria-expanded={supplementalQuizMenuSide === 'answer'}
                                  aria-controls="quiz-supplemental-answer-menu"
                                  onClick={() =>
                                    setSupplementalQuizMenuSide((side) =>
                                      side === 'answer' ? null : 'answer'
                                    )
                                  }
                                >
                                  +
                                </button>
                                {supplementalQuizMenuSide === 'answer' && (
                                  <div
                                    className="quiz-content-add-menu"
                                    id="quiz-supplemental-answer-menu"
                                    role="group"
                                    aria-label={t('Ajouter une réponse')}
                                  >
                                    <span className="quiz-content-add-menu-title">
                                      {t('Ajouter une réponse')}
                                    </span>
                                    {supplementalQuizFactOptions
                                      .filter(({ id }) => !(id in supplementalQuizAnswers))
                                      .map((option) => (
                                        <button
                                          key={option.id}
                                          type="button"
                                          onClick={() =>
                                            addSupplementalQuizContent('answer', option.id)
                                          }
                                        >
                                          {t(option.label)}
                                        </button>
                                      ))}
                                    {supplementalQuizFactOptions.every(
                                      ({ id }) => id in supplementalQuizAnswers
                                    ) && (
                                      <span className="quiz-content-add-menu-empty">
                                        {t('Toutes les données sont déjà ajoutées.')}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </fieldset>
                          </div>
                        </div>
                      </div>

                      <div className="quiz-count-control">
                        <div className="quiz-count-value">
                          <span>{t('À deviner')}</span>
                          <div className="quiz-count-number-row">
                            <input
                              aria-label={t('Nombre exact de pays à deviner')}
                              type="number"
                              min={1}
                              max={maxQuizQuestionCount}
                              value={quizQuestionCount}
                              inputMode="numeric"
                              onChange={(event) => {
                                if (!event.target.value) return
                                const nextCount = Number(event.target.value)
                                if (Number.isFinite(nextCount)) {
                                  setQuizQuestionCount(
                                    Math.max(
                                      1,
                                      Math.min(maxQuizQuestionCount, Math.round(nextCount))
                                    )
                                  )
                                }
                              }}
                            />
                            <span
                              className="quiz-count-stepper"
                              role="group"
                              aria-label={t('Ajuster le nombre de pays')}
                            >
                              <button
                                className="quiz-count-step-button"
                                type="button"
                                aria-label={t('Augmenter d’un pays')}
                                title={t('Augmenter d’un pays')}
                                disabled={quizQuestionCount >= maxQuizQuestionCount}
                                onClick={() =>
                                  setQuizQuestionCount((current) =>
                                    Math.min(maxQuizQuestionCount, current + 1)
                                  )
                                }
                              >
                                +
                              </button>
                              <button
                                className="quiz-count-step-button"
                                type="button"
                                aria-label={t('Diminuer d’un pays')}
                                title={t('Diminuer d’un pays')}
                                disabled={quizQuestionCount <= 1}
                                onClick={() =>
                                  setQuizQuestionCount((current) => Math.max(1, current - 1))
                                }
                              >
                                −
                              </button>
                            </span>
                            <span>{t('pays')}</span>
                            <button
                              className="quiz-count-max-button"
                              type="button"
                              aria-label={t('Choisir le nombre maximum de pays')}
                              title={`${t('Jouer avec les')} ${maxQuizQuestionCount} ${t('pays disponibles')}`}
                              onClick={() => setQuizQuestionCount(maxQuizQuestionCount)}
                            >
                              Max
                            </button>
                          </div>
                        </div>
                        <div className="quiz-count-slider is-vertical">
                          <input
                            type="range"
                            aria-label={t('Nombre de pays à deviner')}
                            min={1}
                            max={maxQuizQuestionCount}
                            step={1}
                            value={Math.min(quizQuestionCount, maxQuizQuestionCount)}
                            style={
                              { '--quiz-count-progress': `${quizCountProgress}%` } as CSSProperties
                            }
                            onChange={(event) =>
                              setQuizQuestionCount(
                                snapQuestionCountToMark(Number(event.target.value))
                              )
                            }
                            onPointerUp={(event) =>
                              setQuizQuestionCount(
                                snapQuestionCountToMark(Number(event.currentTarget.value))
                              )
                            }
                            onKeyUp={(event) => {
                              if (event.key.startsWith('Arrow')) {
                                setQuizQuestionCount((current) => snapQuestionCountToMark(current))
                              }
                            }}
                          />
                          <div className="quiz-count-marks" aria-hidden="true">
                            {[10, 25, 50, maxQuizQuestionCount]
                              .filter(
                                (mark, index, allMarks) =>
                                  mark <= maxQuizQuestionCount && allMarks.indexOf(mark) === index
                              )
                              .map((mark) => {
                                const position = (mark - 1) / (maxQuizQuestionCount - 1)
                                return (
                                  <span
                                    key={mark}
                                    className={`quiz-count-mark${Math.abs(quizQuestionCount - mark) <= 1 ? ' active' : ''}`}
                                    style={{ top: `${4 + (1 - position) * 92}%` }}
                                  >
                                    <i />
                                    <small>{mark === maxQuizQuestionCount ? 'Max' : mark}</small>
                                  </span>
                                )
                              })}
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : quizGameMode === 'estimation' ? (
                    <section className="special-mode-setup estimation-mode-setup">
                      <div className="special-mode-setup-copy">
                        <div>
                          <span>{t('ESTIMATION')}</span>
                          <h3>{t('Choisis les territoires à estimer')}</h3>
                          <p>
                            {t(
                              'Choisis un monde ou un continent, ou sélectionne des pays sur la carte. Une sélection de pays remplace le filtre de région.'
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="estimation-selection-summary">
                        <span>{estimationSelectionLabel}</span>
                        {estimationAlpha2s.length > 0 && (
                          <button type="button" onClick={() => setEstimationAlpha2s([])}>
                            {t('Effacer la sélection')}
                          </button>
                        )}
                      </div>
                      <div className="quiz-territory-picker-map">
                        <WorldMap
                          showBorders
                          showLabels
                          showFlagTerritories={false}
                          showResources={false}
                          showRivers={false}
                          showMountains={false}
                          globeMode={globeMode}
                          onToggleGlobeMode={toggleGlobeMode}
                          selectedAlpha2s={estimationAlpha2s}
                          territorySelectionMode
                          onCountrySelected={(sourceFeatureId) =>
                            toggleEstimationCountry(sourceFeatureId)
                          }
                        />
                      </div>
                    </section>
                  ) : (
                    <section className="special-mode-setup draw-mode-setup">
                      <div className="special-mode-setup-copy">
                        <div>
                          <span>{t('DESSIN')}</span>
                          <h3>{t('Choisis la zone à dessiner')}</h3>
                          <p>
                            {t(
                              'Sélectionne un pays précis ou un ou plusieurs continents. Sans filtre, le jeu utilise le monde entier.'
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setDrawContinents([])
                            setDrawCountryAlpha2(null)
                            setDrawCountrySearch('')
                            setDrawCountrySearchOpen(false)
                          }}
                        >
                          {t('Monde entier')}
                        </button>
                      </div>
                      <div className="draw-country-picker">
                        <label htmlFor="draw-country-search">{t('OU CHOISIS UN PAYS')}</label>
                        <input
                          id="draw-country-search"
                          type="search"
                          autoComplete="off"
                          aria-autocomplete="list"
                          placeholder={t('Commence à taper le nom d’un pays…')}
                          value={drawCountrySearch}
                          aria-expanded={drawCountrySearchOpen && !!drawCountrySearch.trim()}
                          aria-controls="draw-country-search-results"
                          onFocus={() => setDrawCountrySearchOpen(true)}
                          onChange={(event) => {
                            setDrawCountrySearch(event.target.value)
                            setDrawCountrySearchOpen(true)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') setDrawCountrySearchOpen(false)
                            if (event.key === 'Enter' && filteredDrawCountryOptions[0]) {
                              event.preventDefault()
                              selectDrawCountry(filteredDrawCountryOptions[0].alpha2)
                            }
                          }}
                        />
                        {drawCountrySearchOpen && drawCountrySearch.trim() && (
                          <ul
                            id="draw-country-search-results"
                            className="draw-country-suggestions"
                            role="listbox"
                          >
                            {filteredDrawCountryOptions.length ? (
                              filteredDrawCountryOptions.map((country) => (
                                <li key={country.alpha2}>
                                  <button
                                    type="button"
                                    role="option"
                                    aria-selected={drawCountryAlpha2 === country.alpha2}
                                    onClick={() => selectDrawCountry(country.alpha2)}
                                  >
                                    {country.name}
                                  </button>
                                </li>
                              ))
                            ) : (
                              <li className="draw-country-no-results">{t('Aucun pays trouvé.')}</li>
                            )}
                          </ul>
                        )}
                        {drawCountryAlpha2 && (
                          <div className="draw-country-selection">
                            <span>
                              {drawCountryOptions.find(
                                (country) => country.alpha2 === drawCountryAlpha2
                              )?.name ?? drawCountryAlpha2}
                            </span>
                            <button
                              type="button"
                              aria-label={t('Retirer')}
                              onClick={() => setDrawCountryAlpha2(null)}
                            >
                              ×
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="draw-continent-options">
                        {quizRegions
                          .filter((region) => region.id !== 'world')
                          .map((region) => (
                            <label key={region.id}>
                              <input
                                type="checkbox"
                                checked={drawContinents.includes(region.id as ContinentId)}
                                onChange={() => toggleDrawContinent(region.id as ContinentId)}
                              />
                              <span>{t(region.label)}</span>
                            </label>
                          ))}
                      </div>
                      <p className="draw-continent-summary">
                        {drawCountryAlpha2
                          ? `${t('Pays sélectionné')} · ${drawCountryOptions.find((country) => country.alpha2 === drawCountryAlpha2)?.name ?? drawCountryAlpha2}`
                          : drawContinents.length
                            ? `${drawContinents.length} ${t(drawContinents.length === 1 ? 'continent sélectionné' : 'continents sélectionnés')}`
                            : t('Monde entier')}
                      </p>
                    </section>
                  )}

                  <section className="quiz-preset-toolbar" aria-label={t('Presets de partie')}>
                    <label className="quiz-preset-select">
                      <span>{t('MES PRESETS')}</span>
                      <select
                        value={selectedQuizPresetId}
                        onChange={(event) => applyQuizPreset(event.target.value)}
                      >
                        <option value="">{t('Charger un preset…')}</option>
                        {savedQuizPresets.map((preset) => (
                          <option key={preset.id} value={preset.id}>
                            {preset.name}
                            {preset.id === defaultQuizPresetId
                              ? ` · ${t('Preset par défaut')}`
                              : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="quiz-preset-default-button"
                      disabled={!selectedQuizPresetId}
                      onClick={toggleSelectedPresetDefault}
                    >
                      {t(
                        selectedQuizPresetId === defaultQuizPresetId
                          ? 'Ne plus utiliser par défaut'
                          : 'Définir par défaut'
                      )}
                    </button>
                    {selectedQuizPresetId && (
                      <button
                        type="button"
                        className="quiz-preset-delete"
                        onClick={deleteSelectedQuizPreset}
                        aria-label={t('Supprimer le preset sélectionné')}
                        title={t('Supprimer ce preset')}
                      >
                        {t('Supprimer')}
                      </button>
                    )}
                    {isSavingPreset ? (
                      <form
                        className="quiz-preset-save-form"
                        onSubmit={(event) => {
                          event.preventDefault()
                          saveCurrentQuizPreset()
                        }}
                      >
                        <input
                          autoFocus
                          required
                          maxLength={48}
                          value={presetName}
                          onChange={(event) => setPresetName(event.target.value)}
                          placeholder={t('Nom du preset')}
                          aria-label={t('Nom du preset')}
                        />
                        <button type="submit">{t('Enregistrer')}</button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => {
                            setIsSavingPreset(false)
                            setPresetName('')
                            setPresetFeedback('')
                          }}
                        >
                          {t('Annuler')}
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        className="quiz-preset-save-button"
                        disabled={!canStartQuiz}
                        onClick={() => {
                          const selectedPreset = savedQuizPresets.find(
                            (preset) => preset.id === selectedQuizPresetId
                          )
                          setPresetName(selectedPreset?.name ?? '')
                          setPresetFeedback('')
                          setIsSavingPreset(true)
                        }}
                      >
                        {t('Enregistrer comme preset')}
                      </button>
                    )}
                    {presetFeedback && (
                      <span className="quiz-preset-feedback" role="status">
                        {presetFeedback}
                      </span>
                    )}
                  </section>
                </div>
              )}
            </section>
          )}

          {isQuizFullscreen && isQuizRunning && (
            <QuizFullscreenBar
              session={quiz.session}
              clues={activeQuizClues}
              answers={activeQuizAnswers}
              supplementalClues={activeSupplementalQuizClues}
              supplementalAnswers={activeSupplementalQuizAnswers}
              regionLabel={
                quizRegions.find((region) => region.id === activeQuizRegion)?.label ??
                'Tous les continents'
              }
              onExit={exitQuizFullscreen}
              onStop={stopQuiz}
              onOpenAnswers={() => setFullscreenAnswersOpen(true)}
              onRevealAnswer={revealQuizAnswer}
              onNext={nextQuizQuestion}
              onRestart={startNewQuiz}
              onSelectReviewCountry={selectQuizReviewCountry}
            />
          )}
        </div>

        <div className={`workspace${isQuizSetupOpen ? ' is-quiz-configuring' : ''}`}>
          <section className="map-section">
            <div className={`map-toolbar${isQuizRunning ? ' quiz-map-toolbar-running' : ''}`}>
              {isQuizRunning ? (
                <QuizCluesInline
                  session={quiz.session}
                  clues={activeQuizClues}
                  supplementalClues={activeSupplementalQuizClues}
                />
              ) : (
                <div
                  className="perspective-comparison-toolbar-slot"
                  ref={setPerspectiveComparisonPortal}
                />
              )}
            </div>

            <div className="map-canvas">
              <WorldMap
                showBorders={mapLayers.borders}
                showLabels={mapLayers.labels}
                showMarineLabels={mapLayers.marineLabels}
                showMarineBorders={mapLayers.marineBorders}
                globeMode={globeMode}
                onToggleGlobeMode={toggleGlobeMode}
                showFlagTerritories={mapLayers.flags}
                showRivers={mapLayers.rivers}
                showMountains={mapLayers.mountains}
                showSummits={mapLayers.summits}
                layerDensities={mapLayerDensities}
                perspectiveComparisonPortal={
                  isQuizRunning || isQuizFullscreen ? null : perspectiveComparisonPortal
                }
                showSelectionFeedback={isQuizRunning && activeQuizAnswers.countryOnMap}
                mapProximityAttempts={quiz.session.answerAttempts.countryOnMap ?? 0}
                showWrongAnswerFeedback={
                  isQuizRunning &&
                  activeQuizAnswers.countryOnMap &&
                  quiz.session.answerResults.countryOnMap === false &&
                  !quiz.session.answerRevealed &&
                  Number(selectedMapCountry?.sourceFeatureId) !==
                    quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId
                }
                concealMapSelectionName={Boolean(
                  isQuizRunning &&
                  activeQuizAnswers.countryName &&
                  quiz.session.answerResults.countryName === null &&
                  (quiz.session.answerPoints.countryName ?? 0) === 0 &&
                  !quiz.session.answerRevealed
                )}
                quizTargetFeatureId={
                  reviewQuizCountry?.sourceFeatureId ??
                  (isQuizRunning && (activeQuizClues.countryOnMap || quiz.session.answerRevealed)
                    ? (quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId ??
                      null)
                    : null)
                }
                quizTargetFeatureIds={quizRevealTargetFeatureIds}
                quizBaseRegion={
                  isQuizRunning && !quiz.session.answerRevealed ? activeQuizRegion : null
                }
                quizTargetMaxZoom={
                  reviewQuizCountry
                    ? 4.5
                    : isQuizRunning && activeQuizClues.countryOnMap && !quiz.session.answerRevealed
                      ? 3.5
                      : undefined
                }
                quizTargetViewKey={
                  reviewQuizCountry
                    ? `quiz-review:${reviewQuizCountry.alpha2}`
                    : `${sessionMode}:${sessionGeneration}:${quiz.session.questionIndex}:${quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId ?? ''}${quizRevealTargetFeatureIds.length > 0 ? `:answers:${quizRevealTargetFeatureIds.join('-')}` : ''}`
                }
                interactionResetKey={`${sessionMode}:${sessionGeneration}:${quiz.session.questionIndex}:${quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId ?? ''}:${quiz.session.answerRevealed}`}
                showQuizRevealCard={
                  (Boolean(reviewQuizPlace) || showQuizRevealCard) && !isQuizFullscreen
                }
                quizRevealCard={
                  !isQuizFullscreen && reviewQuizPlace ? (
                    <QuizReviewCountryCard
                      place={reviewQuizPlace}
                      onClose={() => setReviewQuizCountryAlpha2(null)}
                    />
                  ) : showQuizRevealCard && !isQuizFullscreen && revealedQuizPlace ? (
                    <div className="quiz-reveal-country-card">
                      <ExplorationPlaceDetails place={revealedQuizPlace} compact />
                      <div className="quiz-reveal-card-actions">
                        <button
                          className="quiz-reveal-card-close"
                          type="button"
                          onClick={() => setShowQuizRevealCard(false)}
                        >
                          Fermer et continuer
                        </button>
                        <button
                          className="quiz-reveal-card-expand"
                          type="button"
                          onClick={() => {
                            setShowQuizRevealCard(false)
                            setShowExpandedQuizCountry(true)
                          }}
                        >
                          Agrandir la fiche
                        </button>
                      </div>
                    </div>
                  ) : null
                }
                onCountrySelected={handleCountrySelected}
                onMapClick={isQuizRunning ? handleQuizMapClick : undefined}
                onCountryDeselected={() => setSelectedMapCountry(null)}
              />

              <div className="map-legend">
                <span className="legend-dot" />
                <span>{t('Monde entier')}</span>
              </div>
            </div>

            <div className={`map-settings${skin === 'minimal' ? ' uses-minimal-skin' : ''}`}>
              {skin === 'minimal' ? (
                <details className="minimal-layer-disclosure">
                  <summary>{t('AFFICHAGE CARTOGRAPHIQUE')}</summary>
                  <div className="map-settings-items">{mapLayerControls}</div>
                </details>
              ) : (
                <>
                  <div className="settings-heading">{t('AFFICHAGE CARTOGRAPHIQUE')}</div>
                  {mapLayerControls}
                </>
              )}
            </div>
          </section>

          {isQuizRunning && !isQuizFullscreen && (
            <CountryQuizPanel
              session={quiz.session}
              clues={activeQuizClues}
              answers={activeQuizAnswers}
              supplementalAnswers={activeSupplementalQuizAnswers}
              selectedMapAnswerAlpha2s={selectedMapAnswerAlpha2s}
              selectedMapCountry={selectedMapCountry}
              mapProximity={mapProximity}
              onAnswer={submitCountryQuizAnswers}
              onMultiAnswer={submitMultiCountryQuizAnswer}
              onRevealAnswer={revealQuizAnswer}
              onNext={nextQuizQuestion}
              onRestart={startNewQuiz}
              onSelectReviewCountry={selectQuizReviewCountry}
            />
          )}
        </div>

        {isQuizRunning && isQuizFullscreen && fullscreenAnswersOpen && (
          <div className="quiz-fullscreen-answer-popover">
            <div className="quiz-fullscreen-answer-popover-heading">
              <strong>{t('TES RÉPONSES')}</strong>
              <button
                type="button"
                onClick={() => setFullscreenAnswersOpen(false)}
                aria-label={t('Fermer les réponses')}
              >
                ×
              </button>
            </div>
            <CountryQuizPanel
              session={quiz.session}
              clues={activeQuizClues}
              answers={activeQuizAnswers}
              supplementalAnswers={activeSupplementalQuizAnswers}
              selectedMapAnswerAlpha2s={selectedMapAnswerAlpha2s}
              selectedMapCountry={selectedMapCountry}
              mapProximity={mapProximity}
              showPanelActions={false}
              onAnswer={submitCountryQuizAnswers}
              onMultiAnswer={submitMultiCountryQuizAnswer}
              onRevealAnswer={revealQuizAnswer}
              onNext={nextQuizQuestion}
              onRestart={startNewQuiz}
              onSelectReviewCountry={selectQuizReviewCountry}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
