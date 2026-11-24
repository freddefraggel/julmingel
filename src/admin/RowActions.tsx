type Props = {
  /** Vad raden är, t.ex. ”glögg 2”, till knapparnas etiketter. */
  label: string
  index: number
  count: number
  onMove: (step: -1 | 1) => void
  onRemove: () => void
}

/** Flytta upp, flytta ned och ta bort, för en rad i en ordnad lista på Förbered kvällen. */
export function RowActions({ label, index, count, onMove, onRemove }: Props) {
  return (
    <span className="row-actions">
      <button type="button" className="icon-button" aria-label={`Flytta upp ${label}`} disabled={index === 0} onClick={() => onMove(-1)}>
        <Icon d="M6 15l6-6 6 6" />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Flytta ned ${label}`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <Icon d="M6 9l6 6 6-6" />
      </button>
      <button type="button" className="icon-button icon-button--danger" aria-label={`Ta bort ${label}`} onClick={onRemove}>
        <Icon d="M6 6l12 12M18 6L6 18" />
      </button>
    </span>
  )
}

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  )
}
