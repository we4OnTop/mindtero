import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initAutoSave } from './lib/autosave'
import './index.css'
import App from './App.tsx'

void initAutoSave()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
