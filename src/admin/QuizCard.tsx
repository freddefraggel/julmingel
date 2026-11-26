import { useState, type ReactNode } from 'react'
import { getTrackInfo, parseTrackLink } from '../spotify'
import type { Choice } from '../types'
import { Button, Card } from '../ui'
import { ImageField } from './ImageField'
import {
  CHOICES,
  move,
  newQuestion,
  newSong,
  parseSeconds,
  parseStart,
  questionNumber,
  quizSummary,
  type Draft,
  type DraftQuestion,
  type DraftSong,
} from './preparation'
import { RowActions } from './RowActions'

type Props = {
  eventId: string
  draft: Draft
  assets: Record<string, string>
  onEdit: (change: (d: Draft) => Draft) => void
  /** Ny bild på ett bildsvar. Sparas direkt om frågan redan finns som bildfråga. */
  onAnswerImage: (qId: string, choice: Choice, imageId: string) => Promise<void>
  newId: (kind: 'songs' | 'questions') => string
}

/** Musikquizet på Förbered kvällen: låtar i spelordning och frågor per låt. Låten spelar vidare mellan frågorna. */
export function QuizCard({ eventId, draft, assets, onEdit, onAnswerImage, newId }: Props) {
  const [songId, setSongId] = useState<string | null>(draft.songs[0]?.songId ?? null)
  const [qId, setQId] = useState<string | null>(draft.songs[0]?.questions[0]?.qId ?? null)

  const songIndex = draft.songs.findIndex((s) => s.songId === songId)
  const song = draft.songs[songIndex]
  const questionIndex = song ? song.questions.findIndex((q) => q.qId === qId) : -1
  const question = song?.questions[questionIndex]

  function setSongs(change: (songs: DraftSong[]) => DraftSong[]) {
    onEdit((d) => ({ ...d, songs: change(d.songs) }))
  }
  function setSong(id: string, change: (s: DraftSong) => DraftSong) {
    setSongs((songs) => songs.map((s) => (s.songId === id ? change(s) : s)))
  }
  // Låtar vars titel och artist hämtas från Spotify just nu.
  const [looking, setLooking] = useState<Record<string, boolean>>({})

  /**
   * En ny giltig Spotify-länk: hämta titel och artist och fyll i de fält som
   * är tomma. Det admin har skrivit skrivs aldrig över, och svaret används bara
   * om länken fortfarande är densamma.
   */
  function changeLink(sId: string, link: string) {
    const before = draft.songs.find((s) => s.songId === sId)
    setSong(sId, (s) => ({ ...s, link }))
    const uri = parseTrackLink(link)
    if (!uri || uri === parseTrackLink(before?.link ?? '')) return
    if (before && before.title.trim() && before.artist.trim()) return
    setLooking((l) => ({ ...l, [sId]: true }))
    void getTrackInfo(uri).then((info) => {
      setLooking((l) => ({ ...l, [sId]: false }))
      if (!info) return
      setSong(sId, (s) =>
        parseTrackLink(s.link) !== uri
          ? s
          : {
              ...s,
              title: s.title.trim() ? s.title : info.title,
              artist: s.artist.trim() || !info.artist ? s.artist : info.artist,
            },
      )
    })
  }

  function setQuestion(sId: string, id: string, change: (q: DraftQuestion) => DraftQuestion) {
    setSong(sId, (s) => ({ ...s, questions: s.questions.map((q) => (q.qId === id ? change(q) : q)) }))
  }

  function addSong() {
    const s = { ...newSong(newId('songs')) }
    const q = newQuestion(newId('questions'))
    s.questions = [q]
    setSongs((songs) => [...songs, s])
    setSongId(s.songId)
    setQId(q.qId)
  }

  function removeSong(id: string) {
    const rest = draft.songs.filter((s) => s.songId !== id)
    setSongs((songs) => songs.filter((s) => s.songId !== id))
    const next = rest[Math.min(songIndex, rest.length - 1)]
    setSongId(next?.songId ?? null)
    setQId(next?.questions[0]?.qId ?? null)
  }

  function addQuestion(sId: string) {
    const q = newQuestion(newId('questions'))
    setSong(sId, (s) => ({ ...s, questions: [...s.questions, q] }))
    setQId(q.qId)
  }

  function removeQuestion(s: DraftSong, id: string) {
    const index = s.questions.findIndex((q) => q.qId === id)
    const rest = s.questions.filter((q) => q.qId !== id)
    setSong(s.songId, (x) => ({ ...x, questions: x.questions.filter((q) => q.qId !== id) }))
    setQId(rest[Math.min(index, rest.length - 1)]?.qId ?? null)
  }

  return (
    <Card className="prepare__card quiz-card">
      <div className="prepare__card-head">
        <h2>{quizSummary(draft.songs)}</h2>
        <Button variant="secondary" size="small" onClick={addSong}>
          + Ny låt
        </Button>
      </div>

      {draft.songs.length === 0 ? (
        <p className="muted">Inga låtar än. Varje låt får en eller flera frågor, och låten spelar vidare mellan dem.</p>
      ) : (
        <ol className="song-list" aria-label="Låtar i spelordning">
          {draft.songs.map((s, i) => (
            <li key={s.songId} className="song-list__item">
              <button
                type="button"
                className="song-list__pick"
                aria-current={s.songId === songId ? 'true' : undefined}
                onClick={() => {
                  setSongId(s.songId)
                  setQId(s.questions[0]?.qId ?? null)
                }}
              >
                <span className="song-list__name">{s.title.trim() || `Låt ${i + 1}`}</span>
                <span className="song-list__count">
                  {s.questions.length === 1 ? '1 fråga' : `${s.questions.length} frågor`}
                </span>
              </button>
              <RowActions
                label={`låt ${i + 1}`}
                index={i}
                count={draft.songs.length}
                onMove={(step) => setSongs((songs) => move(songs, i, step))}
                onRemove={() => removeSong(s.songId)}
              />
            </li>
          ))}
        </ol>
      )}

      {song && (
        <section className="song-editor" aria-label={`Låt ${songIndex + 1}`}>
          <div className="song-editor__head">
            <span className="song-editor__title">
              Låt {songIndex + 1} · {song.questions.length === 1 ? '1 fråga' : `${song.questions.length} frågor`}
            </span>
            <span className="prepare__hint" role="status">
              {looking[song.songId] ? 'Hämtar låtinfo …' : 'Låten spelar vidare mellan frågorna'}
            </span>
          </div>
          <div className="song-editor__fields">
            <Field label="Spotify-länk" className="song-editor__link" invalid={song.link.trim() !== '' && !parseTrackLink(song.link)}>
              {(props) => (
                <input
                  {...props}
                  className="input"
                  placeholder="https://open.spotify.com/track/…"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={song.link}
                  onChange={(e) => changeLink(song.songId, e.target.value)}
                />
              )}
            </Field>
            <Field label="Starta vid" invalid={parseStart(song.start) === null}>
              {(props) => (
                <input
                  {...props}
                  className="input"
                  inputMode="numeric"
                  placeholder="0:30"
                  value={song.start}
                  onChange={(e) => setSong(song.songId, (s) => ({ ...s, start: e.target.value }))}
                />
              )}
            </Field>
            <Field label="Tid per fråga (s)" invalid={parseSeconds(song.seconds) === null}>
              {(props) => (
                <input
                  {...props}
                  className="input"
                  inputMode="numeric"
                  value={song.seconds}
                  onChange={(e) => setSong(song.songId, (s) => ({ ...s, seconds: e.target.value }))}
                />
              )}
            </Field>
            <Field label="Titel (för reservläget)">
              {(props) => (
                <input
                  {...props}
                  className="input"
                  placeholder="Last Christmas"
                  value={song.title}
                  onChange={(e) => setSong(song.songId, (s) => ({ ...s, title: e.target.value }))}
                />
              )}
            </Field>
            <Field label="Artist">
              {(props) => (
                <input
                  {...props}
                  className="input"
                  placeholder="Wham!"
                  value={song.artist}
                  onChange={(e) => setSong(song.songId, (s) => ({ ...s, artist: e.target.value }))}
                />
              )}
            </Field>
          </div>

          <div className="question-tabs" role="tablist" aria-label={`Frågor till låt ${songIndex + 1}`}>
            {song.questions.map((q, j) => (
              <button
                key={q.qId}
                type="button"
                role="tab"
                aria-selected={q.qId === qId}
                className="question-tabs__tab"
                onClick={() => setQId(q.qId)}
              >
                Fråga {questionNumber(draft.songs, songIndex, j)}
                {q.text.trim() && <span className="question-tabs__text"> · {q.text.trim()}</span>}
              </button>
            ))}
            <button type="button" className="question-tabs__add" onClick={() => addQuestion(song.songId)}>
              + Fråga till låten
            </button>
          </div>

          {question && (
            <QuestionEditor
              key={question.qId}
              eventId={eventId}
              number={questionNumber(draft.songs, songIndex, questionIndex)}
              index={questionIndex}
              count={song.questions.length}
              question={question}
              assets={assets}
              onChange={(change) => setQuestion(song.songId, question.qId, change)}
              onMove={(step) => setSong(song.songId, (s) => ({ ...s, questions: move(s.questions, questionIndex, step) }))}
              onRemove={() => removeQuestion(song, question.qId)}
              onImage={(choice, imageId) => onAnswerImage(question.qId, choice, imageId)}
            />
          )}
        </section>
      )}
    </Card>
  )
}

type QuestionEditorProps = {
  eventId: string
  number: number
  index: number
  count: number
  question: DraftQuestion
  assets: Record<string, string>
  onChange: (change: (q: DraftQuestion) => DraftQuestion) => void
  onMove: (step: -1 | 1) => void
  onRemove: () => void
  onImage: (choice: Choice, imageId: string) => Promise<void>
}

function QuestionEditor({ eventId, number, index, count, question, assets, onChange, onMove, onRemove, onImage }: QuestionEditorProps) {
  const image = question.answerType === 'image'
  return (
    <div className="question-editor">
      <div className="question-editor__head">
        <Field label="Fråga" className="question-editor__text">
          {(props) => (
            <input
              {...props}
              className="input"
              placeholder="Vilken film är låten från?"
              value={question.text}
              onChange={(e) => onChange((q) => ({ ...q, text: e.target.value }))}
            />
          )}
        </Field>
        <div className="question-editor__type">
          <span className="question-editor__label">Svarstyp</span>
          <div role="group" aria-label="Svarstyp" className="toggle">
            {(['text', 'image'] as const).map((type) => (
              <button
                key={type}
                type="button"
                className="toggle__option"
                aria-pressed={question.answerType === type}
                onClick={() => onChange((q) => ({ ...q, answerType: type }))}
              >
                {type === 'text' ? 'Text' : 'Bild'}
              </button>
            ))}
          </div>
        </div>
        <RowActions label={`fråga ${number}`} index={index} count={count} onMove={onMove} onRemove={onRemove} />
      </div>

      <fieldset className="answers">
        <legend className="question-editor__label">Svar · markera det rätta</legend>
        {CHOICES.map((choice) => {
          const correct = question.correct === choice
          return (
            <div key={choice} className={`answer${correct ? ' answer--correct' : ''}${image ? ' answer--image' : ''}`}>
              <label className="answer__mark">
                <input
                  type="radio"
                  name={`rätt-${question.qId}`}
                  checked={correct}
                  aria-label={`Svar ${choice} är rätt`}
                  onChange={() => onChange((q) => ({ ...q, correct: choice }))}
                />
                <span className="answer__letter" aria-hidden="true">
                  {choice}
                </span>
                {correct && <span className="answer__right">Rätt</span>}
              </label>
              {image ? (
                <ImageField
                  eventId={eventId}
                  variant="answer"
                  label={`svar ${choice}`}
                  imageId={question.images[choice] || undefined}
                  src={question.images[choice] ? assets[question.images[choice]] : undefined}
                  onChange={(imageId) => onImage(choice, imageId)}
                />
              ) : (
                <input
                  className="input"
                  aria-label={`Svar ${choice}`}
                  value={question.texts[choice]}
                  onChange={(e) => onChange((q) => ({ ...q, texts: { ...q.texts, [choice]: e.target.value } }))}
                />
              )}
            </div>
          )
        })}
      </fieldset>
      <span className="prepare__hint">
        {image ? 'Länk eller uppladdning per svar. ' : ''}Rätt svar sparas bara där gästerna inte kan läsa det.
      </span>
    </div>
  )
}

type FieldProps = {
  label: string
  className?: string
  invalid?: boolean
  children: (props: { 'aria-invalid'?: true }) => ReactNode
}

/** Etikett ovanför ett fält. Ett ogiltigt värde får röd ram. */
function Field({ label, className, invalid = false, children }: FieldProps) {
  return (
    <label className={`prepare__field${className ? ` ${className}` : ''}`}>
      <span>{label}</span>
      {children(invalid ? { 'aria-invalid': true } : {})}
    </label>
  )
}
