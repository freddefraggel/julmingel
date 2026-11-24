import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminPanel from './admin/AdminPanel'
import PrepareEvening from './admin/PrepareEvening'
import GuestApp from './guest/GuestApp'
import Showcase from './ui/Showcase'

// Hash-routing eftersom GitHub Pages inte skriver om djuplänkar till index.html.
//   #/                gäst
//   #/admin           kontrollpanel
//   #/admin/forbered  förbered kvällen (konfiguration)
//   #/design          grundkomponenterna, bara i utvecklingsläge (npm run dev)
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GuestApp />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/admin/forbered" element={<PrepareEvening />} />
        {import.meta.env.DEV && <Route path="/design" element={<Showcase />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
