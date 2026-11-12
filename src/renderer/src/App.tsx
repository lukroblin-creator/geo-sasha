
import { useEffect, useRef, useState } from 'react'
import WorldMap from './components/WorldMap'
import { ExplorationView } from './components/ExplorationView'
import {
  CountryQuizPanel,
  QuizCluesSidebar,
  QuizFullscreenBar
} from './components/QuizPanels'
import { ExplorationPlaceDetails } from './components/ExplorationPlaceDetails'
import { QuizCountryStudyView } from './components/QuizCountryStudyView'
import { StatisticsView } from './components/StatisticsView'
import { CountryQuizSelectionView } from './components/CountryQuizSelectionView'
import { CountryKnowledgeQuizView } from './components/CountryKnowledgeQuizView'
import { useQuizSession } from './data/quiz/useQuizSession'
import {
  createCountryQuizQuestions,
  normalizeQuizAnswer,
  type QuizAnswers,
  type QuizClues,
  type CountryQuizQuestion
} from './data/quiz/countryQuiz'
import {
  createCountryKnowledgeQuestions,
  type CountryKnowledgeQuestion
} from './data/quiz/countryKnowledge'
import {
  getAvailableQuizQuestionCount,
  getQuizQuestionsForRegion,
  quizRegions,
  type QuizQuestionCount,
  type QuizRegion
} from './data/quiz/countryContinents'
import {
  loadQuizProgress,
  saveCompletedQuiz,
  type QuizMode
} from './data/quiz/progress'
import {
  loadCountryQuizStats,
  saveCountryQuizStats,
  updateCountryQuizStats
} from './data/quiz/countryQuizStats'
import { getMapProximityScore } from './data/quiz/mapProximity'
import { getExplorationDetails } from './data/geography/exploration'
import { activateUndoScope, undoActiveScope } from './data/undo'
import { loadQuizPresets, saveQuizPresets, type QuizPreset } from './data/quiz/presets'
import { useLanguage } from './data/i18n'

type MapLayerId = 'borders' | 'rivers' | 'mountains' | 'labels' | 'flags'
type MapLayerVisibility = Record<MapLayerId, boolean>

const mapLayerOptions: {
  id: MapLayerId
  label: string
  available: boolean
  title?: string
}[] = [
  { id: 'rivers', label: 'Fleuves · bientôt', available: false },
  { id: 'mountains', label: 'Montagnes · bientôt', available: false },
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

function App(): React.JSX.Element {
  const { language, setLanguage, t } = useLanguage()
  const [appView, setAppView] = useState<
    'home' | 'quiz' | 'exploration' | 'statistics' | 'country-select' | 'country-quiz'
  >('home')
  const [contentSettingsOpen, setContentSettingsOpen] = useState(false)
  const [isQuizFullscreen, setIsQuizFullscreen] = useState(false)
  const [fullscreenAnswersOpen, setFullscreenAnswersOpen] = useState(false)
  const [mapLayers, setMapLayers] = useState<MapLayerVisibility>({
    borders: true,
    rivers: false,
    mountains: false,
    labels: false,
    flags: false
  })
  const [quizRegion, setQuizRegion] = useState<QuizRegion>('world')
  const [quizQuestionCount, setQuizQuestionCount] = useState<QuizQuestionCount>(10)
  const [activeQuizRegion, setActiveQuizRegion] = useState<QuizRegion>('world')
  const [activeQuizQuestionCount, setActiveQuizQuestionCount] = useState<QuizQuestionCount>(10)
  const [isQuizRunning, setIsQuizRunning] = useState(false)
  const [isQuizSetupOpen, setIsQuizSetupOpen] = useState(false)
  const [quizClues, setQuizClues] = useState<QuizClues>(flagPresetClues)
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswers>(flagPresetAnswers)
  const [activeQuizClues, setActiveQuizClues] = useState<QuizClues>(flagPresetClues)
  const [activeQuizAnswers, setActiveQuizAnswers] = useState<QuizAnswers>(flagPresetAnswers)
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
  } | null>(null)
  const [mapProximityScore, setMapProximityScore] = useState<number | null>(null)
  const [quizProgress, setQuizProgress] = useState(loadQuizProgress)
  const [countryQuizStats, setCountryQuizStats] = useState(loadCountryQuizStats)
  const [savedQuizPresets, setSavedQuizPresets] = useState<QuizPreset[]>(loadQuizPresets)
  const [selectedQuizPresetId, setSelectedQuizPresetId] = useState('')
  const [isSavingPreset, setIsSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetFeedback, setPresetFeedback] = useState('')
  const lastRecordedQuestionRef = useRef<string | null>(null)
  const countryKnowledgeRecordedQuestionRef = useRef<string | null>(null)

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
    setContentSettingsOpen(false)
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
        setFullscreenAnswersOpen(false)
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const maxQuizQuestionCount = selectedQuizCountry
    ? 1
    : getAvailableQuizQuestionCount(quizRegion)

  const getCurrentQuestionBank = (): CountryQuizQuestion[] => {
    const allQuestions = createCountryQuizQuestions()
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
      getCurrentQuestionBank(),
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
    if (!question || current.answerCorrect !== null || current.answerRevealed) return
    const questionKey = `${question.alpha2}:${current.questionIndex}:${question.id}`
    if (countryKnowledgeRecordedQuestionRef.current === questionKey) return
    countryKnowledgeRecordedQuestionRef.current = questionKey

    const isCorrect = answer === question.answer
    countryKnowledgeQuiz.answer(isCorrect, answer)
    const updatedStats = updateCountryQuizStats(
      countryQuizStats,
      question.alpha2,
      'knowledge',
      isCorrect
    )
    setCountryQuizStats(updatedStats)
    saveCountryQuizStats(updatedStats)
  }

  const revealCountryKnowledgeAnswer = (): void => {
    const current = countryKnowledgeQuiz.session
    const question = current.questionOrder[current.questionIndex]
    if (!question || current.answerCorrect === true || current.answerRevealed) return

    countryKnowledgeQuiz.revealAnswer()
    if (current.answerCorrect !== null) return
    const questionKey = `${question.alpha2}:${current.questionIndex}:${question.id}`
    if (countryKnowledgeRecordedQuestionRef.current === questionKey) return
    countryKnowledgeRecordedQuestionRef.current = questionKey

    const updatedStats = updateCountryQuizStats(
      countryQuizStats,
      question.alpha2,
      'knowledge',
      false
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

  const startNewQuiz = (): void => {
    if (!Object.values(quizClues).some(Boolean) || !Object.values(quizAnswers).some(Boolean)) {
      return
    }

    setContentSettingsOpen(false)
    const nextMode = getQuizModeForContent(quizClues, quizAnswers)
    setSessionMode(nextMode)
    setActiveQuizClues(quizClues)
    setActiveQuizAnswers(quizAnswers)
    setActiveQuizRegion(quizRegion)
    setActiveQuizQuestionCount(quizQuestionCount)
    setSessionGeneration((current) => current + 1)
    lastRecordedQuestionRef.current = null
    setSelectedMapCountry(null)
    setMapProximityScore(null)
    setShowQuizRevealCard(false)
    setShowExpandedQuizCountry(false)
    setFullscreenAnswersOpen(false)
    setIsQuizRunning(true)
    setIsQuizSetupOpen(false)
    quiz.restart(getCurrentQuestionBank())
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
    setContentSettingsOpen(false)
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
      answers: { ...quizAnswers }
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
      !activeQuizAnswers.countryOnMap ||
      !question ||
      quiz.session.answerCorrect === true ||
      quiz.session.answerRevealed
    ) {
      return false
    }

    const isCorrect = Number(sourceFeatureId) === question.sourceFeatureId
    if (!isCorrect) return false

    setMapProximityScore(null)
    setSelectedMapCountry({ sourceFeatureId, name, entityId })

    if (
      !activeQuizAnswers.countryName &&
      !activeQuizAnswers.capital &&
      !activeQuizAnswers.flag
    ) {
      quiz.answer(true, name)
    }

    return true
  }

  const handleQuizMapClick = ([longitude, latitude]: [number, number]): number | null => {
    const question = quiz.session.questionOrder[quiz.session.questionIndex]
    if (
      !activeQuizAnswers.countryOnMap ||
      !question ||
      quiz.session.answerCorrect !== null ||
      quiz.session.answerRevealed
    ) {
      return null
    }

    const score = getMapProximityScore(question.sourceFeatureId, longitude, latitude)
    setMapProximityScore(score)
    return score
  }

  const revealQuizAnswer = (): void => {
    const question = quiz.session.questionOrder[quiz.session.questionIndex]
    if (!question) return

    quiz.revealAnswer()
    setMapProximityScore(null)
    setFullscreenAnswersOpen(false)
    setSelectedMapCountry({
      sourceFeatureId: question.sourceFeatureId,
      name: question.frenchCountryName,
      entityId: null
    })
    setShowExpandedQuizCountry(false)
    setShowQuizRevealCard(!isQuizFullscreen)
  }

  const submitCountryQuizAnswers = (answers: {
    countryName: string
    capital: string
    flagAlpha2: string | null
  }): void => {
    const question = quiz.session.questionOrder[quiz.session.questionIndex]
    if (!question) return

    const correct =
      (!activeQuizAnswers.countryOnMap ||
        Number(selectedMapCountry?.sourceFeatureId) === question.sourceFeatureId) &&
      (!activeQuizAnswers.countryName ||
        [question.countryName, question.frenchCountryName].some(
          (name) => normalizeQuizAnswer(answers.countryName) === normalizeQuizAnswer(name)
        )) &&
      (!activeQuizAnswers.capital ||
        normalizeQuizAnswer(answers.capital) === normalizeQuizAnswer(question.capitalName)) &&
      (!activeQuizAnswers.flag || answers.flagAlpha2 === question.alpha2)

    quiz.answer(correct, JSON.stringify(answers))
    if (correct) setFullscreenAnswersOpen(false)
  }

  const nextQuizQuestion = (): void => {
    recordCurrentQuestionResult()
    setSelectedMapCountry(null)
    setMapProximityScore(null)
    setShowQuizRevealCard(false)
    setShowExpandedQuizCountry(false)
    setFullscreenAnswersOpen(false)
    quiz.next()
  }

  const recordCurrentQuestionResult = (): void => {
    const current = quiz.session
    if (current.answerCorrect === null && !current.answerRevealed) return

    const question = current.questionOrder[current.questionIndex]
    if (!question) return

    const questionKey = `${sessionGeneration}:${current.questionIndex}:${question.sourceFeatureId}`
    if (lastRecordedQuestionRef.current === questionKey) return

    lastRecordedQuestionRef.current = questionKey
    const updatedStats = updateCountryQuizStats(
      countryQuizStats,
      question.alpha2,
      sessionMode,
      current.answerCorrect === true
    )
    setCountryQuizStats(updatedStats)
    saveCountryQuizStats(updatedStats)
  }

  const stopQuiz = (): void => {
    recordCurrentQuestionResult()
    const nextQuestionBank = getQuizQuestionsForRegion(
      createCountryQuizQuestions(),
      quizRegion,
      quizQuestionCount
    )
    quiz.restart(nextQuestionBank)
    setSelectedQuizCountry(null)
    lastRecordedQuestionRef.current = null
    setSelectedMapCountry(null)
    setMapProximityScore(null)
    setShowQuizRevealCard(false)
    setShowExpandedQuizCountry(false)
    setFullscreenAnswersOpen(false)
    setIsQuizRunning(false)
    setIsQuizSetupOpen(false)
    exitQuizFullscreen()
    setAppView('home')
  }

if (appView === 'home') {
  return (
    <div className="home-screen">
      <label className="home-language-selector">
        <span>{t('Langue')}</span>
        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value as typeof language)}
          aria-label={t('Modifier la langue du logiciel')}
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </label>
      <div className="home-brand">
        <div className="brand-icon">W</div>
        <div>
          <div className="brand-name">WORLD ATLAS</div>
          <div className="brand-subtitle">{t('GEOGRAPHY TRAINER')}</div>
        </div>
      </div>

      <div className="home-content">
        <div className="home-eyebrow">{t('VOTRE ATLAS DU MONDE')}</div>
        <h1>{t('Explorez. Apprenez. Découvrez.')}</h1>
        <p className="home-description">
          {t('Parcourez le monde à votre rythme ou mettez vos connaissances géographiques à l’épreuve.')}
        </p>

        <div className="home-mode-grid">
          <button
            className="home-mode-card"
            type="button"
            onClick={() => setAppView('quiz')}
          >
            <span className="home-mode-icon">⌖</span>
            <span className="home-mode-title">{t('Quiz')}</span>
            <span className="home-mode-description">
              {t('Testez vos connaissances avec les drapeaux, les capitales et des questionnaires personnalisés.')}
            </span>
            <span className="home-mode-action">{t('Choisir un quiz →')}</span>
          </button>

          <button
            className="home-mode-card"
            type="button"
            onClick={() => setAppView('exploration')}
          >
            <span className="home-mode-icon">◎</span>
            <span className="home-mode-title">{t('Exploration')}</span>
            <span className="home-mode-description">
              {t('Parcourez librement la carte et découvrez les informations détaillées de chaque pays.')}
            </span>
            <span className="home-mode-action">{t('Explorer le monde →')}</span>
          </button>

          <button
            className="home-mode-card"
            type="button"
            onClick={() => setAppView('country-select')}
          >
            <span className="home-mode-icon">◎</span>
            <span className="home-mode-title">{t('Quiz pays')}</span>
            <span className="home-mode-description">
              {t('Choisissez un pays et répondez à des questions sur ses villes, ses montagnes, sa capitale et sa géographie.')}
            </span>
            <span className="home-mode-action">{t('Choisir un pays →')}</span>
          </button>

          <button
            className="home-mode-card"
            type="button"
            onClick={() => setAppView('statistics')}
          >
            <span className="home-mode-icon">▥</span>
            <span className="home-mode-title">{t('Statistiques')}</span>
            <span className="home-mode-description">
              {t('Suivez votre progression pays par pays et repérez les sujets à réviser.')}
            </span>
            <span className="home-mode-action">{t('Voir ma progression →')}</span>
          </button>
        </div>
      </div>

      <div className="home-footer">{t('WORLD ATLAS · APPLICATION LOCALE · V0.1')}</div>
    </div>
  )
}

if (appView === 'exploration') {
  return <ExplorationView onBack={() => setAppView('home')} />
}

if (appView === 'statistics') {
  return (
    <StatisticsView
      countryStats={countryQuizStats}
      quizProgress={quizProgress}
      onBack={() => setAppView('home')}
      onOpenQuiz={() => setAppView('quiz')}
      onOpenCountryQuiz={startCountryQuiz}
    />
  )
}

if (appView === 'country-quiz' && countryKnowledgeAlpha2) {
  return (
    <CountryKnowledgeQuizView
      alpha2={countryKnowledgeAlpha2}
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
      onBack={() => setAppView('home')}
      onStart={startCountryQuiz}
    />
  )
}

if (appView === 'quiz' && showExpandedQuizCountry && currentQuizQuestion && revealedQuizPlace) {
  return (
    <QuizCountryStudyView
      place={revealedQuizPlace}
      sourceFeatureId={currentQuizQuestion.sourceFeatureId}
      onReturnToQuiz={() => setShowExpandedQuizCountry(false)}
    />
  )
}

return (
    <div className={`app-shell${isQuizFullscreen ? ' quiz-fullscreen' : ''}`}>
      <QuizCluesSidebar session={quiz.session} clues={activeQuizClues} />

      <main className="main-content">
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
            </div>
            <div className="quiz-live-actions">
              <button
                type="button"
                onClick={() => setIsQuizSetupOpen((open) => !open)}
                aria-expanded={isQuizSetupOpen}
              >
                {t(isQuizSetupOpen ? 'Masquer les réglages' : 'Modifier les réglages')}
              </button>
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
              <h1>{t('Quiz du monde')}</h1>
            </div>

            <div className="topbar-right">
              <button
                className="home-back-button"
                type="button"
                onClick={() => setAppView('statistics')}
              >
                {t('Statistiques')}
              </button>
              <button className="home-back-button" type="button" onClick={stopQuiz}>
                {t('← Accueil')}
              </button>
              <button
                className="home-back-button quiz-fullscreen-toggle"
                type="button"
                onClick={enterQuizFullscreen}
              >
                {t('Plein écran')}
              </button>

              <span className="status-dot" />
              <span className="status-text">{t('Application locale')}</span>
            </div>
          </header>
        )}

        {(!isQuizRunning || isQuizSetupOpen) && (
          <>
          <section className="quiz-toolbar" aria-label={t('Réglages de la partie')}>
          <label className="quiz-region-field">
            <span>{t('RÉGION')}</span>
            <select
              value={quizRegion}
              onChange={(event) => {
                const region = quizRegions.find((item) => item.id === event.target.value)
                if (region) handleQuizRegionChange(region.id)
              }}
            >
              {quizRegions.map((region) => (
                <option key={region.id} value={region.id}>{t(region.label)}</option>
              ))}
            </select>
          </label>

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
            <div className="quiz-count-slider">
              <input
                type="range"
                aria-label={t('Nombre de pays à deviner')}
                min={1}
                max={maxQuizQuestionCount}
                step={1}
                value={Math.min(quizQuestionCount, maxQuizQuestionCount)}
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
                  .filter((mark, index, allMarks) =>
                    mark <= maxQuizQuestionCount && allMarks.indexOf(mark) === index
                  )
                  .map((mark) => (
                    <span
                      key={mark}
                      className={`quiz-count-mark${Math.abs(quizQuestionCount - mark) <= 1 ? ' active' : ''}`}
                      style={{ left: `${((mark - 1) / (maxQuizQuestionCount - 1)) * 100}%` }}
                    >
                      <i />
                      <small>{mark === maxQuizQuestionCount ? 'Max' : mark}</small>
                    </span>
                  ))}
              </div>
            </div>
          </div>

          <div className="quiz-content-picker">
            <button
              className="quiz-content-picker-button"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={contentSettingsOpen}
              onClick={() => setContentSettingsOpen((open) => !open)}
            >
              <span className="quiz-content-picker-caption">{t('CONTENU DU QUIZ')}</span>
              <span className="quiz-content-picker-value">
                {t('Choisir indices et réponses')} <span aria-hidden="true">⌄</span>
              </span>
            </button>
            {contentSettingsOpen && (
              <div className="quiz-content-settings" role="dialog" aria-label={t('Choisir les indices et les réponses')}>
                <div className="quiz-content-settings-columns">
                  <fieldset>
                    <legend>{t('Indices donnés par le jeu')}</legend>
                    {quizContentOptions.map((option) => {
                      return (
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
                      )
                    })}
                  </fieldset>
                  <fieldset>
                    <legend>{t('Réponses à donner')}</legend>
                    {quizContentOptions.map((option) => {
                      return (
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
                      )
                    })}
                  </fieldset>
                </div>
                <p className="quiz-content-settings-help">
                  {t('Cocher un élément dans une colonne le retire automatiquement de l’autre. Choisis au moins un indice et une réponse, puis démarre une nouvelle partie.')}
                </p>
              </div>
            )}
          </div>

          <button
            className="quiz-start-button"
            type="button"
            onClick={startNewQuiz}
            disabled={
              !Object.values(quizClues).some(Boolean) ||
              !Object.values(quizAnswers).some(Boolean)
            }
          >
            {t('Nouvelle partie')}
          </button>
          </section>

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
                  </option>
                ))}
              </select>
            </label>
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
                disabled={
                  !Object.values(quizClues).some(Boolean) ||
                  !Object.values(quizAnswers).some(Boolean)
                }
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
          </>
        )}

        {isQuizFullscreen && (
          <QuizFullscreenBar
            session={quiz.session}
            clues={activeQuizClues}
            answers={activeQuizAnswers}
            onExit={exitQuizFullscreen}
            onStop={stopQuiz}
            onOpenAnswers={() => setFullscreenAnswersOpen(true)}
            onRevealAnswer={revealQuizAnswer}
            onNext={nextQuizQuestion}
            onRestart={startNewQuiz}
          />
        )}

        <div className="workspace">
          <section className="map-section">
            <div className="map-toolbar">
              <div>
                <div className="map-title">{t('Carte mondiale')}</div>
                <div className="map-subtitle">
                  {t('Explorez le monde et apprenez à le reconnaître')}
                </div>
              </div>

            </div>

            <div className="map-canvas">
              <WorldMap
                showBorders={mapLayers.borders}
                showLabels={mapLayers.labels}
                showFlagTerritories={mapLayers.flags}
                showSelectionFeedback={activeQuizAnswers.countryOnMap}
                quizTargetFeatureId={activeQuizClues.countryOnMap || quiz.session.answerRevealed
                  ? quiz.session.questionOrder[quiz.session.questionIndex]?.sourceFeatureId ?? null
                  : null}
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
                onMapClick={handleQuizMapClick}
                onCountryDeselected={() => setSelectedMapCountry(null)}
              />

              <div className="map-legend">
                <span className="legend-dot" />
                <span>{t('Monde entier')}</span>
              </div>
            </div>

            <div className="map-settings">
              <div className="settings-heading">{t('AFFICHAGE CARTOGRAPHIQUE')}</div>

              {mapLayerOptions.map((layer) => (
                <label
                  key={layer.id}
                  className={`setting-item${layer.available ? '' : ' setting-item-disabled'}`}
                  title={layer.title ? t(layer.title) : layer.available ? undefined : t('Cette couche sera ajoutée plus tard')}
                >
                  <input
                    type="checkbox"
                    checked={mapLayers[layer.id]}
                    disabled={!layer.available}
                    onChange={(event) =>
                      setMapLayers((current) => ({
                        ...current,
                        [layer.id]: event.target.checked
                      }))
                    }
                  />
                  <span>{t(layer.label)}</span>
                </label>
              ))}
            </div>
          </section>

          {!isQuizFullscreen && (
            <CountryQuizPanel
              session={quiz.session}
              clues={activeQuizClues}
              answers={activeQuizAnswers}
              selectedMapCountry={selectedMapCountry}
              mapProximityScore={mapProximityScore}
              onAnswer={submitCountryQuizAnswers}
              onRevealAnswer={revealQuizAnswer}
              onNext={nextQuizQuestion}
              onRestart={startNewQuiz}
            />
          )}
        </div>

        {isQuizFullscreen && fullscreenAnswersOpen && (
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
              mapProximityScore={mapProximityScore}
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
