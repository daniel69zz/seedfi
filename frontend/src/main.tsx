import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './app/styles/variables.css'
import './app/styles/globals.css'
import App from './App.tsx'
import { preloadLoadingSprite } from './shared/lib/loadingSprite'

void preloadLoadingSprite()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
