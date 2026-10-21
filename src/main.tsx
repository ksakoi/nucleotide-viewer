import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { locale, t } from './lib/i18n'

// The static HTML is English at /; follow the locale picked from the URL or browser.
document.documentElement.lang = locale
document.title = t.pageTitle

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
