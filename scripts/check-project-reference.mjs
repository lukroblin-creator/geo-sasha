import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const referenceFiles = [
  {
    path: 'AGENTS.md',
    requiredText: [
      'docs/GUIDE-DU-PROJET.md',
      'docs/DECISIONS.md',
      'docs/ARCHITECTURE.md',
      'IDEES-POUR-PLUS-TARD.txt'
    ]
  },
  {
    path: 'docs/GUIDE-DU-PROJET.md',
    requiredText: [
      '## 0. Utilisation de cette référence',
      '## 6. Protocole pour une nouvelle discussion'
    ]
  },
  {
    path: 'docs/DECISIONS.md',
    requiredText: ['## Navigation, clavier et panneaux', '## Quiz']
  },
  {
    path: 'docs/ARCHITECTURE.md',
    requiredText: ['## Persistance locale', '## Vérification locale']
  },
  {
    path: 'IDEES-POUR-PLUS-TARD.txt',
    requiredText: ['backlog exploratoire', 'n’est pas une exigence']
  }
]

const errors = []

for (const reference of referenceFiles) {
  let content = ''
  try {
    content = readFileSync(reference.path, 'utf8')
  } catch {
    errors.push(`${reference.path} est introuvable.`)
    continue
  }

  for (const requiredText of reference.requiredText) {
    if (!content.includes(requiredText)) {
      errors.push(`${reference.path} ne contient plus le repère « ${requiredText} ».`)
    }
  }
}

if (errors.length > 0) {
  console.error('Référence projet invalide :')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

function getGitFiles(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
      .split('\n')
      .map((file) => file.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

const changedFiles = new Set([
  ...getGitFiles(['diff', '--name-only', 'HEAD', '--']),
  ...getGitFiles(['ls-files', '--others', '--exclude-standard']),
  ...getGitFiles(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'])
])

const referencePaths = new Set(referenceFiles.map((reference) => reference.path))
referencePaths.add('README.md')

const hasProductCodeChanges = [...changedFiles].some(
  (file) => file.startsWith('src/') || file === 'package.json' || file === 'electron.vite.config.ts'
)
const hasReferenceChanges = [...changedFiles].some((file) => referencePaths.has(file))

if (hasProductCodeChanges && !hasReferenceChanges) {
  console.warn(
    'Référence projet : du code produit a changé sans modification des documents de référence.\n' +
      'C’est normal pour un correctif interne. Pour une décision durable, une nouvelle règle de jeu, une priorité ou un changement de structure, mets à jour le document concerné.'
  )
} else {
  console.log('Référence projet : structure valide.')
}
