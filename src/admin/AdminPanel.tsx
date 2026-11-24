import { Link } from 'react-router-dom'

// Kontrollpanelen. Inloggning, faser och gäster byggs i #8.
export default function AdminPanel() {
  return (
    <main>
      <h1>Styr kvällen</h1>
      <p>
        <Link to="/admin/forbered">Förbered kvällen</Link>
      </p>
    </main>
  )
}
