import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Migração: forçar dark mode como padrão (executa uma única vez)
if (!localStorage.getItem('theme-dark-v2-migrated')) {
  localStorage.setItem('theme-dark', JSON.stringify(true));
  localStorage.setItem('theme-dark-v2-migrated', 'true');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
