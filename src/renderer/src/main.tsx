import './maplibre-setup'
import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LanguageProvider } from './data/i18n'
import { SkinProvider } from './data/skin'
import { MatrixAmbientLayer } from './components/MatrixAmbientLayer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <SkinProvider>
        <MatrixAmbientLayer />
        <App />
      </SkinProvider>
    </LanguageProvider>
  </StrictMode>
)
