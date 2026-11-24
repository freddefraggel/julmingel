import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { completeLogin } from './spotify'
import './styles/fonts'
import './styles/tokens.css'
import './styles/base.css'

// Spotify skickar tillbaka till /julmingel/?code=… utan hash; ta hand om det före routingen.
void completeLogin().finally(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
