# world-atlas

An Electron application with React and TypeScript

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

### Tests

Run the offline quiz data and session checks with:

```bash
npm test
```

The test command uses Node's built-in TypeScript support and requires Node.js 22.6 or newer.

Before opening a pull request, run the shared quality checks and production build:

```bash
npm run verify
npm run build
```

GitHub Actions runs both commands on pushes and pull requests.

## Architecture and behavior rules

- [Project direction and working rules](docs/GUIDE-DU-PROJET.md)
- [Architecture overview](docs/ARCHITECTURE.md)
- [Functional rules to preserve](docs/DECISIONS.md)
