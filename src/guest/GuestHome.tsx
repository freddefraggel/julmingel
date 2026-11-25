import type { ReactNode } from 'react'
import { phaseOf, type Phase } from '../live'
import type { EventConfig, Guest, GuestRatings, LiveState } from '../types'
import { Chip, Garland, Snow } from '../ui'

/** Undersidorna som Hem länkar till. */
export type HomeTarget = 'ranka' | 'glogger' | 'gissa'

type Props = {
  guest: Guest
  /** null tills första beskedet från `live/` har kommit. */
  live: LiveState | null
  config: EventConfig | null
  ratings: GuestRatings
  onOpen?: (target: HomeTarget) => void
  /** Undersidorna som går att öppna. Standard: alla, när onOpen finns. */
  openable?: readonly HomeTarget[]
}

const ORDER: Phase[] = ['registration', 'tasting', 'quiz', 'review', 'guess', 'reveal', 'done']

/** Visas under Just nu, efter kvällens läge. */
const NOW_TEXT: Record<Phase, string> = {
  registration: 'Kvällen börjar snart',
  tasting: 'Glöggprovning pågår',
  quiz: 'Musikquiz pågår',
  review: 'Rättning pågår',
  guess: 'Gissa glöggen är öppen',
  reveal: 'Topplistan avslöjas',
  done: 'Tack för i kväll!',
}

/** 2. Hem: Just nu, Ranka glögg, Musikquiz, Kvällens glögger, Gissa glöggen. Korten följer kvällens läge i `live/`. */
export function GuestHome({ guest, live, config, ratings, onOpen, openable }: Props) {
  const opener = (target: HomeTarget) =>
    onOpen && (!openable || openable.includes(target)) ? () => onOpen(target) : undefined
  const phase = phaseOf(live) ?? 'registration'
  const at = ORDER.indexOf(phase)
  const before = (p: Phase) => at < ORDER.indexOf(p)

  const total = Object.values(config?.gloggs ?? {}).filter((g) => g.class === guest.class).length
  const tried = Object.values(ratings).filter((byCriterion) => Object.keys(byCriterion ?? {}).length > 0).length
  const progress = total > 0 ? `${Math.min(tried, total)} av ${total} provade` : 'Inga glögger än'

  return (
    <main className="page guest-page home">
      <Garland />
      <Snow />
      <header className="home__header">
        <div className="home__greeting">
          <span className="home__hello">God kväll</span>
          <h1>Hej {guest.name}!</h1>
        </div>
        <Mistletoe />
      </header>

      <section className="home-now" aria-live="polite">
        <BellIcon />
        <div className="home-now__text">
          <span className="eyebrow">Just nu</span>
          <span className="home-now__value">{NOW_TEXT[phase]}</span>
        </div>
      </section>

      {before('tasting') ? (
        <LockedRow>Ranka glögg öppnar när provningen börjar</LockedRow>
      ) : (
        <BigCard
          title="Ranka glögg"
          icon={<MugIcon />}
          active={phase === 'tasting'}
          onOpen={opener('ranka')}
          badge={phase === 'tasting' ? <ChevronIcon size={28} /> : <Chip tone="green">Klart</Chip>}
        >
          <span className="home-card__sub">{progress}</span>
          <div className="home-card__bar" aria-hidden="true">
            <div style={{ width: `${total > 0 ? Math.min(100, (tried / total) * 100) : 0}%` }} />
          </div>
        </BigCard>
      )}

      <BigCard title="Musikquiz" icon={<NoteIcon />} active={false} badge={<QuizChip phase={phase} />}>
        <span className="home-card__sub">{quizText(phase)}</span>
      </BigCard>

      {before('tasting') ? (
        <LockedRow>Kvällens glögger visas när provningen börjar</LockedRow>
      ) : (
        <Row
          title="Kvällens glögger"
          sub="Se vad du provar"
          icon={<ImageIcon />}
          onOpen={opener('glogger')}
        />
      )}

      <div className="home__spacer" />

      {before('guess') ? (
        <LockedRow>Gissa glöggen öppnar i slutet av kvällen</LockedRow>
      ) : (
        <Row
          title="Gissa glöggen"
          sub={phase === 'guess' ? 'Vilket nummer är vilken glögg?' : 'Gissningarna är låsta'}
          icon={<QuestionIcon />}
          accent={phase === 'guess'}
          onOpen={opener('gissa')}
        />
      )}
    </main>
  )
}

function quizText(phase: Phase): string {
  switch (phase) {
    case 'registration':
    case 'tasting':
      return 'Frågorna dyker upp här automatiskt när quizledaren startar.'
    case 'quiz':
      return 'Quizet är i gång. Frågorna dyker upp här automatiskt.'
    case 'review':
      return 'Quizledaren går igenom svaren.'
    default:
      return 'Quizet är klart. Topplistan visas i slutet av kvällen.'
  }
}

function QuizChip({ phase }: { phase: Phase }) {
  if (phase === 'registration' || phase === 'tasting') return <Chip>Startar snart</Chip>
  if (phase === 'quiz') return <Chip tone="gold">Pågår</Chip>
  if (phase === 'review') return <Chip tone="rose">Rättning</Chip>
  return <Chip tone="green">Klart</Chip>
}

type BigCardProps = {
  title: string
  icon: ReactNode
  badge: ReactNode
  active: boolean
  onOpen?: () => void
  children: ReactNode
}

/** Stort kort. Guld och klickbart när det är det gästen ska göra nu. */
function BigCard({ title, icon, badge, active, onOpen, children }: BigCardProps) {
  const className = `card home-card${active ? ' card--accent' : ''}`
  const content = (
    <>
      <span className="home-card__top">
        {icon}
        {badge}
      </span>
      <span className="home-card__body">
        <span className="home-card__title">{title}</span>
        {children}
      </span>
    </>
  )
  if (active && onOpen) {
    return (
      <button type="button" className={`${className} home-card--link`} onClick={onOpen}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}

type RowProps = {
  title: string
  sub: string
  icon: ReactNode
  accent?: boolean
  onOpen?: () => void
}

/** Lägre rad, t.ex. Kvällens glögger. */
function Row({ title, sub, icon, accent = false, onOpen }: RowProps) {
  const className = `home-row${accent ? ' home-row--accent' : ''}`
  const content = (
    <>
      {icon}
      <span className="home-row__text">
        <span className="home-row__title">{title}</span>
        <span className="home-row__sub">{sub}</span>
      </span>
      {onOpen && <ChevronIcon size={22} />}
    </>
  )
  if (onOpen) {
    return (
      <button type="button" className={`${className} home-row--link`} onClick={onOpen}>
        {content}
      </button>
    )
  }
  return <div className={className}>{content}</div>
}

/** Låst eller kommande: streckad ram och hänglås. */
function LockedRow({ children }: { children: ReactNode }) {
  return (
    <div className="home-locked">
      <LockIcon />
      <span>{children}</span>
    </div>
  )
}

// ── Ikoner från designcanvasen (Hem.dc.html) ────────────────────────────────

type IconProps = { size?: number }

function Svg({ size = 24, strokeWidth = 1.8, children }: IconProps & { strokeWidth?: number; children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

function BellIcon() {
  return (
    <span className="home-now__icon">
      <Svg size={22}>
        <path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" />
        <path d="M10 20a2 2 0 0 0 4 0" />
        <path d="M12 3v2" />
      </Svg>
    </span>
  )
}

function MugIcon() {
  return (
    <span className="home-card__icon">
      <Svg size={40}>
      <path d="M6 8h10v6a5 5 0 0 1-10 0z" />
      <path d="M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16" />
      <path d="M9 2.5c-.6 1 .6 1.8 0 3M12.5 2.5c-.6 1 .6 1.8 0 3" />
      <path d="M5 22h12" />
      </Svg>
    </span>
  )
}

function NoteIcon() {
  return (
    <span className="home-card__icon">
      <Svg size={40}>
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </Svg>
    </span>
  )
}

function ImageIcon() {
  return (
    <span className="home-row__icon">
      <Svg>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="10" r="2" />
        <path d="M21 16l-5-5-9 9" />
      </Svg>
    </span>
  )
}

function QuestionIcon() {
  return (
    <span className="home-row__icon">
      <Svg>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9.5a2.5 2.5 0 0 1 4.8 1c0 1.7-2.3 2-2.3 3.5" />
        <path d="M12 17.5h.01" />
      </Svg>
    </span>
  )
}

function LockIcon() {
  return (
    <span className="home-locked__icon">
      <Svg>
        <rect x="5" y="11" width="14" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </Svg>
    </span>
  )
}

function ChevronIcon({ size }: IconProps) {
  return (
    <Svg size={size} strokeWidth={2.2}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  )
}

/** Mistel och pepparkakshjärta bredvid hälsningen. Bara utsmyckning. */
function Mistletoe() {
  return (
    <svg className="home__mistletoe" aria-hidden="true" width="76" height="58" viewBox="0 0 76 58">
      <path d="M4 46Q36 32 72 14" fill="none" stroke="var(--color-green-dark)" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M12 42l-5-9M12 42l7-4M22 38l-4-10M22 38l8-3M32 33l-3-10M32 33l8-2M42 28l-2-10M42 28l8-1M52 23l-1-9M52 23l8 0M62 18l0-8M62 18l7 1"
        fill="none"
        stroke="var(--color-green)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="27" cy="41" r="3" fill="var(--color-red)" />
      <circle cx="32" cy="44" r="3" fill="var(--color-red)" />
      <path d="M56 56C42 46 44 34 51 35C54 35 56 38 56 40C56 38 58 35 61 35C68 34 70 46 56 56z" fill="var(--color-rose)" />
      <path d="M50 41q3 3 6 0t6 0" fill="none" stroke="var(--color-text)" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}
