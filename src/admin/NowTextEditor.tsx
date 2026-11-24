import { useId, useState, type FormEvent } from 'react'
import { Button } from '../ui'

const MAX_LENGTH = 120

type Props = {
  /** Texten som ligger i live/nowText just nu. */
  value: string
  disabled: boolean
  /** Ger true om texten sparades. */
  onSave: (text: string) => Promise<boolean>
}

/** Redigerar ”Just nu: …” som gästerna ser överst på startsidan. */
export function NowTextEditor({ value, disabled, onSave }: Props) {
  const inputId = useId()
  // Utkastet finns bara medan admin skriver; annars visas texten i databasen.
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? value

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (await onSave(text)) setDraft(null)
  }

  const changed = text.trim() !== value.trim()

  return (
    <form className="now-text" onSubmit={onSubmit}>
      <label htmlFor={inputId} className="eyebrow">
        Just nu-text till gästerna
      </label>
      <div className="now-text__row">
        <input
          id={inputId}
          className="input input--large"
          type="text"
          maxLength={MAX_LENGTH}
          placeholder="T.ex. Glögg nummer 3 serveras i köket"
          value={text}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" disabled={disabled || !changed}>
          Spara
        </Button>
      </div>
    </form>
  )
}
