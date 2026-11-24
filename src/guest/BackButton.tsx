/** ”‹ Tillbaka” överst på gästens undersidor. */
export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="guest-back" onClick={onClick}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 6l-6 6 6 6" />
      </svg>
      Tillbaka
    </button>
  )
}
