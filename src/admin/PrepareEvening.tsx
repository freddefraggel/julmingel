import { Link } from 'react-router-dom'

// Förbered kvällen: glögger, kriterier, låtar och frågor byggs i #9–#11.
export default function PrepareEvening() {
  return (
    <main className="page page--admin">
      <h1>Förbered kvällen</h1>
      <p>
        <Link to="/admin">Till kontrollpanelen</Link>
      </p>
    </main>
  )
}
