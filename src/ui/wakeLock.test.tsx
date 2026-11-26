import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useWakeLock } from './wakeLock'

function Probe({ active }: { active: boolean }) {
  useWakeLock(active)
  return null
}

type FakeSentinel = { released: boolean; release: ReturnType<typeof vi.fn> }
let sentinels: FakeSentinel[]
let request: ReturnType<typeof vi.fn>
let visibility: DocumentVisibilityState

const flush = () => act(async () => {})

beforeEach(() => {
  sentinels = []
  visibility = 'visible'
  request = vi.fn(async () => {
    const s: FakeSentinel = {
      released: false,
      release: vi.fn(async () => {
        s.released = true
      }),
    }
    sentinels.push(s)
    return s
  })
  Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true })
  Object.defineProperty(document, 'visibilityState', { get: () => visibility, configurable: true })
})

afterEach(() => {
  cleanup()
  delete (navigator as { wakeLock?: unknown }).wakeLock
  delete (document as { visibilityState?: unknown }).visibilityState
})

describe('useWakeLock', () => {
  it('håller skärmen vaken när den är aktiv och släpper när den slutar vara det', async () => {
    const { rerender } = render(<Probe active />)
    await flush()
    expect(request).toHaveBeenCalledWith('screen')
    expect(sentinels).toHaveLength(1)
    rerender(<Probe active={false} />)
    await flush()
    expect(sentinels[0]!.release).toHaveBeenCalled()
  })

  it('begär inget när den inte är aktiv', async () => {
    render(<Probe active={false} />)
    await flush()
    expect(request).not.toHaveBeenCalled()
  })

  it('begär låset igen när sidan syns efter att ha varit dold', async () => {
    render(<Probe active />)
    await flush()
    // Webbläsaren släpper låset när sidan döljs.
    visibility = 'hidden'
    sentinels[0]!.released = true
    fireEvent(document, new Event('visibilitychange'))
    await flush()
    expect(request).toHaveBeenCalledTimes(1)
    visibility = 'visible'
    fireEvent(document, new Event('visibilitychange'))
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('försöker igen vid ett tryck om låset nekades, men inte när det redan finns', async () => {
    request.mockRejectedValueOnce(new DOMException('Kräver användarhandling', 'NotAllowedError'))
    render(<Probe active />)
    await flush()
    expect(sentinels).toHaveLength(0)
    fireEvent.pointerDown(document)
    await flush()
    expect(sentinels).toHaveLength(1)
    fireEvent.pointerDown(document)
    await flush()
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('gör inget utan stöd i webbläsaren', async () => {
    delete (navigator as { wakeLock?: unknown }).wakeLock
    render(<Probe active />)
    await flush()
    expect(request).not.toHaveBeenCalled()
  })
})
