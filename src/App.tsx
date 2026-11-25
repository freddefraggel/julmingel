import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AdminGate } from './admin/AdminGate'
import AdminPanel from './admin/AdminPanel'
import PrepareEvening from './admin/PrepareEvening'
import QrWelcome from './admin/QrWelcome'
import SpotifySpike from './admin/SpotifySpike'
import GuestApp from './guest/GuestApp'
import Showcase from './ui/Showcase'

// Hash-routing eftersom GitHub Pages inte skriver om djuplänkar till index.html.
//   #/                gäst
//   #/admin           kontrollpanel (kräver admin-inloggning)
//   #/admin/forbered  förbered kvällen (konfiguration, kräver admin-inloggning)
//   #/admin/qr        välkomstskärm med QR-koden, för en surfplatta vid dörren
//   #/admin/qr/print  samma sak som A4-affisch för utskrift
//   #/admin/spotify   Spotify-test (spiken i #1)
//   #/design          grundkomponenterna, bara i utvecklingsläge (npm run dev)
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<GuestApp />} />
        <Route
          path="/admin"
          element={
            <AdminGate title="Styr kvällen">
              <AdminPanel />
            </AdminGate>
          }
        />
        <Route
          path="/admin/forbered"
          element={
            <AdminGate title="Förbered kvällen">
              <PrepareEvening />
            </AdminGate>
          }
        />
        <Route
          path="/admin/qr"
          element={
            <AdminGate title="Välkomstskärm">
              <QrWelcome />
            </AdminGate>
          }
        />
        <Route
          path="/admin/qr/print"
          element={
            <AdminGate title="Skriv ut QR-kod">
              <QrWelcome print />
            </AdminGate>
          }
        />
        <Route path="/admin/spotify" element={<SpotifySpike />} />
        {import.meta.env.DEV && <Route path="/design" element={<Showcase />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
