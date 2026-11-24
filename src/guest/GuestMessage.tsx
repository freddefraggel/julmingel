import { Garland } from '../ui'

type Props = { title: string; text: string; busy?: boolean }

/** Enkel helsida för lägen utan formulär: saknad länk, laddning. */
export function GuestMessage({ title, text, busy = false }: Props) {
  return (
    <main className="page guest-page" aria-busy={busy || undefined}>
      <Garland />
      <span className="brand">Glöggmingel</span>
      <div className="guest-message">
        <h1>{title}</h1>
        <p className="muted">{text}</p>
      </div>
    </main>
  )
}
