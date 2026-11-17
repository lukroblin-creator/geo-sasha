
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import WorldMap from './components/WorldMap'
import { ExplorationView } from './components/ExplorationView'
import {
  CountryQuizPanel,
  QuizCluesInline,
  QuizFullscreenBar
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
  type QuizAnswers,
  type QuizClues,
  type CountryQuizQuestion
} from './data/quiz/countryQuiz'
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
import {
  loadQuizProgress,
  saveCompletedQuiz,
  type QuizMode
} from './data/quiz/progress'
import {
  loadCountryQuizStats,
  saveCountryQuizStats,
  updateCountryQuizStats,
  type CountryQuizQuestionResult
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
import { useSkin } from './data/skin'
import { fullMapLayerDensities, mapLayerDensityMaximums, type DensityLayerId, type MapLayerDensities } from './data/geography/mapLayerDensity'
import { mountainRanges } from './data/geography/physical/mountainRanges'

type MapLayerId = 'borders' | 'rivers' | 'mountains' | 'labels' | 'flags' | 'summits'
type MapLayerVisibility = Record<MapLayerId, boolean>
type QuizSetup = {
  region: QuizRegion
  questionCount: QuizQuestionCount
  clues: QuizClues
  answers: QuizAnswers
}
type QuizGameMode = 'base' | 'estimation' | 'draw-borders'

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
  subLayer?: { id: MapLayerId; label: string }
}[] = [
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
  { id: 'labels', label: 'Noms des pays', available: true },
  {
    id: 'flags',
    label: 'Drapeaux',
    available: true,
    title: 'Intégrer le drapeau dans le contour des pays et territoires'
  },
  {
    id: 'borders',
    label: 'Frontières',
    available: true,
    title: 'Afficher ou masquer les frontières des pays et territoires'
  }
]

const flagPresetClues: QuizClues = {
  countryOnMap: false,
  flag: true,
  countryName: false,
  capital: false
}
const flagPresetAnswers: QuizAnswers = {
  countryOnMap: true,
  countryName: false,
  capital: false,
  flag: false
}
const idleQuizClues: QuizClues = {
  countryOnMap: false,
  flag: false,
  countryName: false,
  capital: false
}
const idleQuizAnswers: QuizAnswers = {
  countryOnMap: false,
  countryName: false,
  capital: false,
  flag: false
}
const capitalPresetClues: QuizClues = {
  countryOnMap: false,
  flag: false,
  countryName: true,
  capital: false
}
const capitalPresetAnswers: QuizAnswers = {
  countryOnMap: false,
  countryName: false,
  capital: true,
  flag: false
}

const quizContentOptions: { id: keyof QuizClues; label: string }[] = [
  { id: 'flag', label: 'Drapeau' },
  { id: 'countryName', label: 'Nom du pays' },
  { id: 'capital', label: 'Capitale' },
  { id: 'countryOnMap', label: 'Territoire sur la carte' }
]

function matchesQuizConfiguration(
  clues: QuizClues,
  answers: QuizAnswers,
  expectedClues: QuizClues,
  expectedAnswers: QuizAnswers
): boolean {
  return quizContentOptions.every(
    ({ id }) => clues[id] === expectedClues[id] && answers[id] === expectedAnswers[id]
  )
}

function getQuizModeForContent(clues: QuizClues, answers: QuizAnswers): QuizMode {
  if (matchesQuizConfiguration(clues, answers, flagPresetClues, flagPresetAnswers)) {
    return 'flags'
  }
  if (matchesQuizConfiguration(clues, answers, capitalPresetClues, capitalPresetAnswers)) {
    return 'capitals'
  }
  return 'custom'
}

function getQuizAnswerWeights(answers: QuizAnswers): Record<string, number> {
  const enabledAnswers = Object.entries(answers).filter(([, enabled]) => enabled)
  const weight = enabledAnswers.length > 0 ? 1 / enabledAnswers.length : 1
  return Object.fromEntries(enabledAnswers.map(([id]) => [id, weight]))
}

function getCountryQuizQuestionResult(
  answerWeights: Record<string, number>,
  answerResults: Record<string, boolean | null>,
  answerPoints: Record<string, number>
): CountryQuizQuestionResult {
  const answers = Object.entries(answerWeights).map(([id]) => ({
    id,
    correct: answerResults[id] === true,
    pointsEarned: answerResults[id] === true ? answerPoints[id] ?? 0 : 0
  }))
  const pointsEarned = answers.reduce(
    (sum, answer) => sum + (answerWeights[answer.id] ?? 0) * answer.pointsEarned,
    0
  )
  return { pointsEarned, answers }
}

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

function getContentLabels(
  settings: QuizClues | QuizAnswers,
  translate: (text: string) => string
): string {
  return quizContentOptions
    .filter(({ id }) => settings[id])
    .map(({ label }) => translate(label))
    .join(', ')
}

function createRandomQuizSetup(): QuizSetup {
  const region = quizRegions[Math.floor(Math.random() * quizRegions.length)].id
  const maximumQuestionCount = getAvailableQuizQuestionCount(region)
  const questionCount = Math.floor(Math.random() * maximumQuestionCount) + 1
  const contentRoles = quizContentOptions.map(({ id }) => ({
    id,
    role: Math.floor(Math.random() * 3) as 0 | 1 | 2
  }))

  if (!contentRoles.some(({ role }) => role === 0)) {
    contentRoles[Math.floor(Math.random() * contentRoles.length)].role = 0
  }
  if (!contentRoles.some(({ role }) => role === 1)) {
    const eligible = contentRoles.filter(({ role }) => role !== 0)
    const chosen = eligible.length
      ? eligible[Math.floor(Math.random() * eligible.length)]
      : contentRoles[Math.floor(Math.random() * contentRoles.length)]
    chosen.role = 1
  }

  const clues = Object.fromEntries(
    contentRoles.map(({ id, role }) => [id, role === 0])
  ) as QuizClues
  const answers = Object.fromEntries(
    contentRoles.map(({ id, role }) => [id, role === 1])
  ) as QuizAnswers

  return { region, questionCount, clues, answers }
}

function App(): React.JSX.Element {
  const { language, t } = useLanguage()
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
  type AppView = 'quiz' | 'exploration' | 'statistics' | 'country-select' | 'country-quiz' | 'comparator'
  const [appView, setAppView] = useState<AppView>('quiz')
  const [statisticsReturnView, setStatisticsReturnView] = useState<Exclude<AppView, 'statistics'>>('quiz')
  const [comparisonInitialAlpha2, setComparisonInitialAlpha2] = useState<string[]>([])
  const [savedQuizPresets, setSavedQuizPresets] = useState<QuizPreset[]>(loadQuizPresets)
  const [defaultQuizPresetId, setDefaultQuizPresetId] = useState(loadDefaultQuizPresetId)
  const initialDefaultQuizPreset = savedQuizPresets.find(
    (preset) => preset.id === defaultQuizPresetId
  )
  const [isQuizFullscreen, setIsQuizFullscreen] = useState(false)
  const [isMapFullscreen, setIsMapFullscreen] = useState(false)
  const [perspectiveComparisonPortal, setPerspectiveComparisonPortal] = useState<HTMLDivElement | null>(null)
  const [fullscreenAnswersOpen, setFullscreenAnswersOpen] = useState(false)
  const [mapLayers, setMapLayers] = useState<MapLayerVisibility>({
    borders: true,
    rivers: false,
    mountains: false,
    summits: false,
    labels: false,
    flags: false
  })
  const [mapLayerDensities, setMapLayerDensities] = useState<MapLayerDensities>(fullMapLayerDensities)
  const [globeMode, setGlobeMode] = useState(false)
  const [quizRegion, setQuizRegion] = useState<QuizRegion>(initialDefaultQuizPreset?.region ?? 'world')
  const [quizGameMode, setQuizGameMode] = useState<QuizGameMode>(initialDefaultQuizPreset?.gameMode ?? 'base')
  const [estimationRegion, setEstimationRegion] = useState<QuizRegion>(initialDefaultQuizPreset?.estimationRegion ?? 'world')
  const [estimationAlpha2s, setEstimationAlpha2s] = useState<string[]>(initialDefaultQuizPreset?.estimationAlpha2s ?? [])
  const [drawContinents, setDrawContinents] = useState<ContinentId[]>(initialDefaultQuizPreset?.drawContinents ?? [])
  const [drawCountryAlpha2, setDrawCountryAlpha2] = useState<string | null>(initialDefaultQuizPreset?.drawCountryAlpha2 ?? null)
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
  const [activeQuizRegion, setActiveQuizRegion] = useState<QuizRegion>(initialDefaultQuizPreset?.region ?? 'world')
  const [activeQuizQuestionCount, setActiveQuizQuestionCount] = useState<QuizQuestionCount>(
    initialDefaultQuizPreset?.questionCount ?? 10
  )
  const [isQuizRunning, setIsQuizRunning] = useState(false)
  const [isQuizSetupOpen, setIsQuizSetupOpen] = useState(false)
  const [isPresetQuickMenuOpen, setIsPresetQuickMenuOpen] = useState(false)
  const [quizClues, setQuizClues] = useState<QuizClues>(initialDefaultQuizPreset?.clues ?? flagPresetClues)
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>(initialDefaultQuizPreset?.answers ?? flagPresetAnswers)
  const [activeQuizClues, setActiveQuizClues] = useState<QuizClues>(idleQuizClues)
  const [activeQuizAnswers, setActiveQuizAnswers] = useState<QuizAnswers>(idleQuizAnswers)
  const [sessionMode, setSessionMode] = useState<QuizMode>('flags')
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [showQuizRevealCard, setShowQuizRevealCard] = useState(false)
  const [showExpandedQuizCountry, setShowExpandedQuizCountry] = useState(false)
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
  const [mapProximity, setMapProximity] = useState<MapProximityResult | null>(null)
  const [quizProgress, setQuizProgress] = useState(loadQuizProgress)
  const [countryQuizStats, setCountryQuizStats] = useState(loadCountryQuizStats)
  const [selectedQuizPresetId, setSelectedQuizPresetId] = useState(initialDefaultQuizPreset?.id ?? '')
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetFeedback, setPresetFeedback] = useState('')
  const presetQuickMenuRef = useRef<HTMLDivElement>(null)
  const defaultQuizPreset = savedQuizPresets.find((preset) => preset.id === defaultQuizPresetId)
  const lastRecordedQuestionRef = useRef<string | null>(null)
  const countryKnowledgeRecordedQuestionRef = useRef<string | null>(null)

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

  useEffect(() => {
    if (!selectedQuizPresetId) return

    const selectedPreset = savedQuizPresets.find((preset) => preset.id === selectedQuizPresetId)
    if (!selectedPreset) {
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
    const baseSettingsMatch = quizGameMode !== 'base' || (
      quizRegion === selectedPreset.region &&
      quizQuestionCount === expectedQuestionCount &&
      matchesQuizConfiguration(quizClues, quizAnswers, selectedPreset.clues, selectedPreset.answers)
    )
    const modeSettingsMatch = quizGameMode === presetMode && (
      quizGameMode === 'base' || (
        quizGameMode === 'estimation' &&
        estimationRegion === (selectedPreset.estimationRegion ?? 'world') &&
        sameList(estimationAlpha2s, selectedPreset.estimationAlpha2s ?? [])
      ) || (
        quizGameMode === 'draw-borders' &&
        sameList(drawContinents, selectedPreset.drawContinents ?? []) &&
        drawCountryAlpha2 === (selectedPreset.drawCountryAlpha2 ?? null)
      )
    )
    const stillMatchesPreset = baseSettingsMatch && modeSettingsMatch

    if (!stillMatchesPreset) setSelectedQuizPresetId('')
  }, [
    quizAnswers,
    quizClues,
    quizGameMode,
    quizQuestionCount,
    quizRegion,
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
        isTextEditingTarget(event.target)
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

    let activeButton: HTMLButtonElement | null = null
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

    const showTooltip = (button: HTMLButtonElement): void => {
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

        tooltip.textContent = label
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

    const getButton = (target: EventTarget | null): HTMLButtonElement | null => {
      if (!(target instanceof Element)) return null
      const button = target.closest('button')
      if (!(button instanceof HTMLButtonElement)) return null
      if (button.matches('.country-flag-choices .country-flag-choice')) return null
      return button
    }

    const handlePointerOver = (event: PointerEvent): void => {
      const button = getButton(event.target)
      if (!button || (event.relatedTarget instanceof Node && button.contains(event.relatedTarget))) {
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
  }, [])

  const maxQuizQuestionCount = selectedQuizCountry
    ? 1
    : getAvailableQuizQuestionCount(quizRegion)
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

  const recordCompletedQuiz = (mode: QuizMode, score: number): void => {
    setQuizProgress(saveCompletedQuiz(mode, score))
  }

  const quiz = useQuizSession<CountryQuizQuestion>({
    mode: sessionMode,
    questionBank: () =>
      isQuizRunning ? getCurrentQuestionBank() : [],
    onCompleted: recordCompletedQuiz
  })
  const countryKnowledgeQuiz = useQuizSession<CountryKnowledgeQuestion>({
    mode: 'knowledge',
    questionBank: () => [],
    onCompleted: recordCompletedQuiz
  })
  const currentQuizQuestion = quiz.session.questionOrder[quiz.session.questionIndex]
  const revealedQuizPlace = currentQuizQuestion
    ? getExplorationDetails(
        currentQuizQuestion.sourceFeatureId,
        currentQuizQuestion.frenchCountryName,
        null
      )
    : null

  const handleQuizRegionChange = (region: QuizRegion): void => {
    setQuizRegion(region)
    setQuizQuestionCount((current) =>
      Math.min(current, getAvailableQuizQuestionCount(region))
    )
  }

  const startCountryQuiz = (alpha2: string): void => {
    const countryQuestions = createCountryKnowledgeQuestions(alpha2, language)
    if (!countryQuestions.length) return

    setCountryQuizReturnView(appView === 'statistics' ? 'statistics' : 'country-select')
    setCountryKnowledgeAlpha2(alpha2.toUpperCase())
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
        answers: [{
          id: getKnowledgeStatId(question.kind),
          correct: true,
          pointsEarned: attemptPoints
        }]
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
        answers: [{
          id: getKnowledgeStatId(question.kind),
          correct: false,
          pointsEarned: 0
        }]
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
    setAppView(countryQuizReturnView)
  }

  const startQuizWithSetup = (setup: QuizSetup, clearSelectedPreset = false): void => {
    if (!Object.values(setup.clues).some(Boolean) || !Object.values(setup.answers).some(Boolean)) {
      return
    }

    const questionCount = Math.min(
      setup.questionCount,
      getAvailableQuizQuestionCount(setup.region)
    )
    setQuizRegion(setup.region)
    setQuizGameMode('base')
    setQuizQuestionCount(questionCount)
    setQuizClues(setup.clues)
    setQuizAnswers(setup.answers)
    if (clearSelectedPreset) setSelectedQuizPresetId('')

    const nextMode = getQuizModeForContent(setup.clues, setup.answers)
    setSessionMode(nextMode)
    setActiveQuizClues(setup.clues)
    setActiveQuizAnswers(setup.answers)
    setActiveQuizRegion(setup.region)
    setActiveQuizQuestionCount(questionCount)
    setSessionGeneration((current) => current + 1)
    lastRecordedQuestionRef.current = null
    setSelectedMapCountry(null)
    setMapProximity(null)
    setShowQuizRevealCard(false)
    setShowExpandedQuizCountry(false)
    setFullscreenAnswersOpen(false)
    setIsQuizRunning(true)
    setIsQuizSetupOpen(false)
    setIsPresetQuickMenuOpen(false)
    quiz.restart(
      getQuizQuestionsForRegion(
        createCountryQuizQuestions(language),
        setup.region,
        questionCount
      ),
      getQuizAnswerWeights(setup.answers)
    )
  }

  const startNewQuiz = (): void => {
    if (quizGameMode === 'estimation') {
      const questions = createEstimationQuestions(estimationRegion, estimationAlpha2s, language)
      setEstimationQuestions(questions)
      setIsQuizRunning(true)
      setIsQuizSetupOpen(false)
      setIsPresetQuickMenuOpen(false)
      setSpecialQuizGeneration((current) => current + 1)
      return
    }
    if (quizGameMode === 'draw-borders') {
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
      answers: quizAnswers
    })
  }

  const startRandomQuiz = (): void => {
    setQuizGameMode('base')
    startQuizWithSetup(createRandomQuizSetup(), true)
  }

  const startQuizPreset = (presetId: string): void => {
    const preset = savedQuizPresets.find((item) => item.id === presetId)
    if (!preset) return

    setSelectedQuizPresetId(preset.id)
    setPresetFeedback('')
    setIsPresetQuickMenuOpen(false)
    const questionCount = Math.min(
      preset.questionCount,
      getAvailableQuizQuestionCount(preset.region)
    )
    const gameMode = preset.gameMode ?? 'base'

    if (gameMode === 'base') {
      startQuizWithSetup({
        region: preset.region,
        questionCount,
        clues: preset.clues,
        answers: preset.answers
      })
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
    setActiveQuizRegion(preset.region)
    setActiveQuizQuestionCount(questionCount)
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
    setSpecialQuizGeneration((current) => current + 1)
  }

  const toggleEstimationCountry = (sourceFeatureId: string | number): boolean => {
    const normalizedSourceFeatureId = normalizeCountrySourceFeatureId(sourceFeatureId)
    const country = (countryCatalog as { sourceFeatureId: number; alpha2: string }[])
      .find((item) => normalizeCountrySourceFeatureId(item.sourceFeatureId) === normalizedSourceFeatureId)
    if (!country) return false
    setEstimationAlpha2s((current) => current.includes(country.alpha2)
      ? current.filter((alpha2) => alpha2 !== country.alpha2)
      : [...current, country.alpha2])
    return true
  }

  const stopSpecialQuiz = (): void => {
    setIsQuizRunning(false)
    setIsQuizSetupOpen(true)
    setFullscreenAnswersOpen(false)
    setActiveQuizClues(idleQuizClues)
    setActiveQuizAnswers(idleQuizAnswers)
    setIsPresetQuickMenuOpen(false)
    setAppView('quiz')
  }

  const recordSpecialQuiz = (mode: 'estimation' | 'draw-borders', score: number): void => {
    setQuizProgress(saveCompletedQuiz(mode, score))
  }

  const applyQuizPreset = (presetId: string): void => {
    const preset = savedQuizPresets.find((item) => item.id === presetId)
    setSelectedQuizPresetId(presetId)
    setPresetFeedback('')
    if (!preset) return

    setQuizRegion(preset.region)
    setQuizQuestionCount(
      Math.min(preset.questionCount, getAvailableQuizQuestionCount(preset.region))
    )
    setQuizClues(preset.clues)
    setQuizAnswers(preset.answers)
    setQuizGameMode(preset.gameMode ?? 'base')
    setEstimationRegion(preset.estimationRegion ?? 'world')
    setEstimationAlpha2s(preset.estimationAlpha2s ?? [])
    setDrawContinents(preset.drawContinents ?? [])
    setDrawCountryAlpha2(preset.drawCountryAlpha2 ?? null)
    setDrawCountrySearch('')
    setDrawCountrySearchOpen(false)
  }

  const applyDefaultQuizPreset = (): void => {
    const preset = savedQuizPresets.find((item) => item.id === defaultQuizPresetId)
    if (preset) applyQuizPreset(preset.id)
  }

  const toggleSelectedPresetDefault = (): void => {
    if (!selectedQuizPresetId) return
    const nextDefaultPresetId = selectedQuizPresetId === defaultQuizPresetId
      ? ''
      : selectedQuizPresetId
    if (!saveDefaultQuizPresetId(nextDefaultPresetId)) {
      setPresetFeedback(t('Enregistrement impossible sur cet appareil.'))
      return
    }

    setDefaultQuizPresetId(nextDefaultPresetId)
    setPresetFeedback(t(nextDefaultPresetId ? 'Preset défini par défaut.' : 'Preset par défaut désactivé.'))
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
      gameMode: quizGameMode,
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

  const snapQuestionCountToMark = (value: number): number => {
    const marks = [10, 25, 50, maxQuizQuestionCount].filter(
      (mark, index, allMarks) => mark <= maxQuizQuestionCount && allMarks.indexOf(mark) === index
    )
    return marks.find((mark) => Math.abs(value - mark) <= 1) ?? value
  }

  const handleCountrySelected = (
    sourceFeatureId: string | number,
    name: string,
    entityId: string | null
  ): boolean => {
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

    const isCorrect = Number(sourceFeatureId) === question.sourceFeatureId
    if (!isCorrect) {
      setSelectedMapCountry(null)
      quiz.answerItems({ countryOnMap: false }, name)
      return false
    }

    setMapProximity(null)
    setSelectedMapCountry({ sourceFeatureId, name, entityId, revealed: false })
    quiz.answerItems({ countryOnMap: true }, name)

    return true
  }

  const handleQuizMapClick = ([longitude, latitude]: [number, number]): MapProximityResult | null => {
    const question = quiz.session.questionOrder[quiz.session.questionIndex]
    if (
      !isQuizRunning ||
      !activeQuizAnswers.countryOnMap ||
      !question ||
      quiz.session.answerResults.countryOnMap === true ||
      quiz.session.answerRevealed
    ) {
      return null
    }

    const proximity = getMapProximityResult(question.sourceFeatureId, longitude, latitude)
    setMapProximity(proximity)
    return proximity
  }

  const revealQuizAnswer = (): void => {
    if (!isQuizRunning) return
    const question = quiz.session.questionOrder[quiz.session.questionIndex]
    if (!question) return

    quiz.revealAnswer()
    setMapProximity(null)
    setFullscreenAnswersOpen(false)
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
    quiz.answerItems(outcomes, JSON.stringify(outcomes))
    if (Object.values(outcomes).every(Boolean)) setFullscreenAnswersOpen(false)
  }

  const nextQuizQuestion = (): void => {
    if (!isQuizRunning) return
    recordCurrentQuestionResult()
    setSelectedMapCountry(null)
    setMapProximity(null)
    setShowQuizRevealCard(false)
    setShowExpandedQuizCountry(false)
    setFullscreenAnswersOpen(false)
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
    recordCurrentQuestionResult()
    quiz.restart([])
    setSelectedQuizCountry(null)
    lastRecordedQuestionRef.current = null
    setSelectedMapCountry(null)
    setMapProximity(null)
    setShowQuizRevealCard(false)
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
      onReturnToQuiz={() => setShowExpandedQuizCountry(false)}
    />
  )
}

const mapLayerControls = (
  <MapLayerControls
    layers={mapLayerOptions.map((layer) => {
      const densityId = layer.id === 'borders' || layer.id === 'mountains'
        ? null
        : layer.id as DensityLayerId
      return {
        id: layer.id,
        label: layer.label,
        enabled: mapLayers[layer.id],
        density: densityId ? mapLayerDensities[densityId] : 0,
        maximum: densityId ? mapLayerDensityMaximums[densityId] : 0,
        fixedCount: layer.id === 'mountains' ? mountainRanges.length : undefined,
        subLayer: layer.subLayer ? {
          id: layer.subLayer.id,
          label: layer.subLayer.label,
          enabled: mapLayers[layer.subLayer.id],
          density: mapLayerDensities.mountains,
          maximum: mapLayerDensityMaximums.mountains
        } : undefined,
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
      } else if (enabled && layerId !== 'borders' && layerId !== 'mountains' && layerId !== 'summits') {
        const densityId = layerId as DensityLayerId
        if (mapLayerDensities[densityId] === 0) {
          setMapLayerDensities((current) => ({ ...current, [densityId]: 1 }))
        }
      }
    }}
    onDensityChange={(id, value) => {
      const densityId = (id === 'summits' ? 'mountains' : id) as DensityLayerId
      setMapLayerDensities((current) => ({ ...current, [densityId]: value }))
      const visibilityId: MapLayerId = densityId === 'mountains'
        ? 'summits'
        : densityId as MapLayerId
      setMapLayers((current) => ({ ...current, [visibilityId]: value > 0 }))
    }}
  />
)

const canStartQuiz = quizGameMode !== 'base' ||
  (Object.values(quizClues).some(Boolean) && Object.values(quizAnswers).some(Boolean))

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
  setDrawContinents((current) => current.includes(continent)
    ? current.filter((item) => item !== continent)
    : [...current, continent])
}

const filteredDrawCountryOptions = drawCountrySearch.trim()
  ? drawCountryOptions.filter((country) =>
      normalizeCountrySearchText(country.name).startsWith(normalizeCountrySearchText(drawCountrySearch))
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
      const selectedNames = estimationAlpha2s.slice(0, 4).map((alpha2) =>
        displayNames.of(alpha2) ?? catalog.find((country) => country.alpha2 === alpha2)?.countryName ?? alpha2
      )
      const remaining = estimationAlpha2s.length - selectedNames.length
      return `${estimationAlpha2s.length} ${t(estimationAlpha2s.length === 1 ? 'pays sélectionné' : 'pays sélectionnés')} · ${selectedNames.join(', ')}${remaining > 0 ? ` +${remaining}` : ''}`
    })()
  : t(quizRegions.find((region) => region.id === estimationRegion)?.label ?? 'Tous les continents')

if (appView === 'quiz' && isQuizRunning && quizGameMode === 'estimation') {
  return (
    <EstimationQuizView
      key={specialQuizGeneration}
      questions={estimationQuestions}
      onStop={stopSpecialQuiz}
      onRestart={startNewQuiz}
      onCompleted={(score) => recordSpecialQuiz('estimation', score)}
      globeMode={globeMode}
      onToggleGlobeMode={toggleGlobeMode}
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
      onCompleted={(score) => recordSpecialQuiz('draw-borders', score)}
      globeMode={globeMode}
      onToggleGlobeMode={toggleGlobeMode}
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
                {t(quizRegions.find((region) => region.id === activeQuizRegion)?.label ?? 'Tous les continents')}{' '}
                · {activeQuizQuestionCount} {t('pays')}
              </strong>
              <small>
                {t('Indices')} : {getContentLabels(activeQuizClues, t)} · {t('Réponses')} :{' '}
                {getContentLabels(activeQuizAnswers, t)}
              </small>
              <small className="quiz-live-progress-copy">
                {quiz.session.completed
                  ? t('Quiz terminé')
                  : `${t('Question')} ${String(runningQuestionNumber).padStart(2, '0')}/${runningQuizTotal}`}{' '}
                · {runningQuizAnswered} {t(runningQuizAnswered > 1 ? 'réponses' : 'réponse')}{' '}
                {t('sur')} {runningQuizTotal} · {t('Score :')} {formatQuizScore(quiz.session.score, language)} /{' '}
                {runningQuizTotal}
              </small>
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
              <button type="button" className="stop" onClick={stopQuiz}>
                {t('Arrêter')}
              </button>
            </div>
          </header>
        ) : (
          <header className="topbar">
            <div>
              <div className="breadcrumb">{t('APPRENTISSAGE / MONDE')}</div>
              <h1>{t('Quizz monde')}</h1>
            </div>

            <div className="topbar-right">
              <button
                className="home-back-button"
                type="button"
                onClick={openStatistics}
              >
                {t('Statistiques')}
              </button>
            </div>
          </header>
        )}

        {!isQuizRunning && <AppModeSwitcher active="quiz" onChange={openPrimaryMode} />}

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
                <span>{t(isQuizSetupOpen ? 'Masquer les réglages' : 'Paramétrer une partie')}</span>
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
                  title={t(defaultQuizPreset ? 'Lancer le preset par défaut' : 'Aucun preset par défaut')}
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
                        <span>{t('Enregistre un preset dans les réglages pour le lancer ici.')}</span>
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
                    <p>{t(quizGameMode === 'base'
                      ? 'Choisis une zone géographique, le nombre de pays et les indices ou réponses de la partie.'
                      : quizGameMode === 'estimation'
                        ? 'Choisis une région ou des pays, puis estime les données demandées.'
                        : 'Choisis un ou plusieurs continents pour dessiner leurs frontières.')}</p>
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

                <div className={`quiz-settings-selectors${quizGameMode === 'draw-borders' ? ' is-single' : ''}`}>
                  <label className="quiz-game-mode-field">
                    <span>{t('MODE DE JEU')}</span>
                    <select
                      value={quizGameMode}
                      onChange={(event) => setQuizGameMode(event.target.value as QuizGameMode)}
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
                        const region = quizRegions.find((item) => item.id === event.target.value)
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
                        <option key={region.id} value={region.id}>{t(region.label)}</option>
                      ))}
                    </select>
                  </label>
                  )}
                </div>

                {quizGameMode === 'base' ? (
                  <section className="quiz-toolbar quiz-base-settings" aria-label={t('Réglages de la partie')}>
                    <div className="quiz-content-picker">
                      <span className="quiz-content-picker-caption">{t('CONTENU DU QUIZ')}</span>
                      <span className="quiz-content-picker-value">{t('Choisir indices et réponses')}</span>
                      <div className="quiz-content-settings" role="group" aria-label={t('Choisir les indices et les réponses')}>
                        <div className="quiz-content-settings-columns">
                          <fieldset>
                            <legend>{t('Indices donnés par le jeu')}</legend>
                            {quizContentOptions.map((option) => (
                              <label key={option.id} className="quiz-content-setting">
                                <input
                                  type="checkbox"
                                  checked={quizClues[option.id]}
                                  onChange={(event) => selectQuizContent(option.id, 'clue', event.target.checked)}
                                />
                                <span>{t(option.label)}</span>
                              </label>
                            ))}
                          </fieldset>
                          <fieldset>
                            <legend>{t('Réponses à donner')}</legend>
                            {quizContentOptions.map((option) => (
                              <label key={option.id} className="quiz-content-setting">
                                <input
                                  type="checkbox"
                                  checked={quizAnswers[option.id]}
                                  onChange={(event) => selectQuizContent(option.id, 'answer', event.target.checked)}
                                />
                                <span>{t(option.label)}</span>
                              </label>
                            ))}
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
                                  Math.max(1, Math.min(maxQuizQuestionCount, Math.round(nextCount)))
                                )
                              }
                            }}
                          />
                          <span className="quiz-count-stepper" role="group" aria-label={t('Ajuster le nombre de pays')}>
                            <button
                              className="quiz-count-step-button"
                              type="button"
                              aria-label={t('Augmenter d’un pays')}
                              title={t('Augmenter d’un pays')}
                              disabled={quizQuestionCount >= maxQuizQuestionCount}
                              onClick={() =>
                                setQuizQuestionCount((current) => Math.min(maxQuizQuestionCount, current + 1))
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
                              onClick={() => setQuizQuestionCount((current) => Math.max(1, current - 1))}
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
                          style={{ '--quiz-count-progress': `${quizCountProgress}%` } as CSSProperties}
                          onChange={(event) =>
                            setQuizQuestionCount(snapQuestionCountToMark(Number(event.target.value)))
                          }
                          onPointerUp={(event) =>
                            setQuizQuestionCount(snapQuestionCountToMark(Number(event.currentTarget.value)))
                          }
                          onKeyUp={(event) => {
                            if (event.key.startsWith('Arrow')) {
                              setQuizQuestionCount((current) => snapQuestionCountToMark(current))
                            }
                          }}
                        />
                        <div className="quiz-count-marks" aria-hidden="true">
                          {[10, 25, 50, maxQuizQuestionCount]
                            .filter((mark, index, allMarks) =>
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
                        <p>{t('Choisis un monde ou un continent, ou sélectionne des pays sur la carte. Une sélection de pays remplace le filtre de région.')}</p>
                      </div>
                    </div>
                    <div className="estimation-selection-summary">
                      <span>{estimationSelectionLabel}</span>
                      {estimationAlpha2s.length > 0 && (
                        <button type="button" onClick={() => setEstimationAlpha2s([])}>{t('Effacer la sélection')}</button>
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
                        onCountrySelected={(sourceFeatureId) => toggleEstimationCountry(sourceFeatureId)}
                      />
                    </div>
                  </section>
                ) : (
                  <section className="special-mode-setup draw-mode-setup">
                    <div className="special-mode-setup-copy">
                      <div>
                        <span>{t('DESSIN')}</span>
                        <h3>{t('Choisis la zone à dessiner')}</h3>
                        <p>{t('Sélectionne un pays précis ou un ou plusieurs continents. Sans filtre, le jeu utilise le monde entier.')}</p>
                      </div>
                      <button type="button" onClick={() => {
                        setDrawContinents([])
                        setDrawCountryAlpha2(null)
                        setDrawCountrySearch('')
                        setDrawCountrySearchOpen(false)
                      }}>{t('Monde entier')}</button>
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
                        <ul id="draw-country-search-results" className="draw-country-suggestions" role="listbox">
                          {filteredDrawCountryOptions.length ? filteredDrawCountryOptions.map((country) => (
                            <li key={country.alpha2}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={drawCountryAlpha2 === country.alpha2}
                                onClick={() => selectDrawCountry(country.alpha2)}
                              >{country.name}</button>
                            </li>
                          )) : (
                            <li className="draw-country-no-results">{t('Aucun pays trouvé.')}</li>
                          )}
                        </ul>
                      )}
                      {drawCountryAlpha2 && (
                        <div className="draw-country-selection">
                          <span>{drawCountryOptions.find((country) => country.alpha2 === drawCountryAlpha2)?.name ?? drawCountryAlpha2}</span>
                          <button type="button" aria-label={t('Retirer')} onClick={() => setDrawCountryAlpha2(null)}>×</button>
                        </div>
                      )}
                    </div>
                    <div className="draw-continent-options">
                      {quizRegions.filter((region) => region.id !== 'world').map((region) => (
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
                    <p className="draw-continent-summary">{drawCountryAlpha2
                      ? `${t('Pays sélectionné')} · ${drawCountryOptions.find((country) => country.alpha2 === drawCountryAlpha2)?.name ?? drawCountryAlpha2}`
                      : drawContinents.length
                      ? `${drawContinents.length} ${t(drawContinents.length === 1 ? 'continent sélectionné' : 'continents sélectionnés')}`
                      : t('Monde entier')}</p>
                  </section>
                )}

                <section className="quiz-preset-toolbar" aria-label={t('Presets de partie')}>
                  <label className="quiz-preset-select">
                    <span>{t('MES PRESETS')}</span>
                    <select value={selectedQuizPresetId} onChange={(event) => applyQuizPreset(event.target.value)}>
                      <option value="">{t('Charger un preset…')}</option>
                      {savedQuizPresets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.name}{preset.id === defaultQuizPresetId ? ` · ${t('Preset par défaut')}` : ''}
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
                    {t(selectedQuizPresetId === defaultQuizPresetId
                      ? 'Ne plus utiliser par défaut'
                      : 'Définir par défaut')}
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
                        const selectedPreset = savedQuizPresets.find((preset) => preset.id === selectedQuizPresetId)
                        setPresetName(selectedPreset?.name ?? '')
                        setPresetFeedback('')
                        setIsSavingPreset(true)
                      }}
                    >
                      {t('Enregistrer comme preset')}
                    </button>
                  )}
                  {presetFeedback && <span className="quiz-preset-feedback" role="status">{presetFeedback}</span>}
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
            regionLabel={quizRegions.find((region) => region.id === activeQuizRegion)?.label ?? 'Tous les continents'}
            onExit={exitQuizFullscreen}
            onStop={stopQuiz}
            onOpenAnswers={() => setFullscreenAnswersOpen(true)}
            onRevealAnswer={revealQuizAnswer}
            onNext={nextQuizQuestion}
            onRestart={startNewQuiz}
          />
        )}

        </div>

        <div className={`workspace${isQuizSetupOpen ? ' is-quiz-configuring' : ''}`}>
          <section className="map-section">
            <div className={`map-toolbar${isQuizRunning ? ' quiz-map-toolbar-running' : ''}`}>
              {isQuizRunning ? (
                <QuizCluesInline session={quiz.session} clues={activeQuizClues} />
              ) : (
                <>
                  <div>
                    <div className="map-title">{t('Carte mondiale')}</div>
                    <div className="map-subtitle">
                      {t('Explorez le monde et apprenez à le reconnaître')}
                    </div>
                  </div>
                  <div
                    className="perspective-comparison-toolbar-slot"
                    ref={setPerspectiveComparisonPortal}
                  />
                </>
              )}
            </div>

            <div className="map-canvas">
              <WorldMap
                showBorders={mapLayers.borders}
                showLabels={mapLayers.labels}
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
                showWrongAnswerFeedback={
                  isQuizRunning && activeQuizAnswers.countryOnMap &&
                  quiz.session.answerResults.countryOnMap === false &&
                  !quiz.session.answerRevealed &&
                  Number(selectedMapCountry?.sourceFeatureId) !==
                    quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId
                }
                quizTargetFeatureId={isQuizRunning && (activeQuizClues.countryOnMap || quiz.session.answerRevealed)
                  ? quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId ?? null
                  : null}
                quizBaseRegion={
                  isQuizRunning && !quiz.session.answerRevealed ? activeQuizRegion : null
                }
                quizTargetMaxZoom={
                  isQuizRunning && activeQuizClues.countryOnMap && !quiz.session.answerRevealed
                    ? 3.5
                    : undefined
                }
                quizTargetViewKey={`${sessionMode}:${sessionGeneration}:${quiz.session.questionIndex}:${quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId ?? ''}`}
                interactionResetKey={`${sessionMode}:${sessionGeneration}:${quiz.session.questionIndex}:${quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId ?? ''}:${quiz.session.answerRevealed}`}
                showQuizRevealCard={showQuizRevealCard && !isQuizFullscreen}
                quizRevealCard={showQuizRevealCard && !isQuizFullscreen && revealedQuizPlace ? (
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
                ) : null}
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
              selectedMapCountry={selectedMapCountry}
              mapProximity={mapProximity}
              onAnswer={submitCountryQuizAnswers}
              onRevealAnswer={revealQuizAnswer}
              onNext={nextQuizQuestion}
              onRestart={startNewQuiz}
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
              selectedMapCountry={selectedMapCountry}
              mapProximity={mapProximity}
              showPanelActions={false}
              onAnswer={submitCountryQuizAnswers}
              onRevealAnswer={revealQuizAnswer}
              onNext={nextQuizQuestion}
              onRestart={startNewQuiz}
            />
          </div>
        )}
      </main>
    </div>
  )
}

export default App
