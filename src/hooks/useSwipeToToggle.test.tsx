import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup, act } from '@testing-library/react'
import { useState } from 'react'
import { useSwipeToToggle } from './useSwipeToToggle'

afterEach(() => cleanup())

function fireTouch(type: string, x: number, y: number) {
  const event = new window.TouchEvent(type, {
    touches: [{ clientX: x, clientY: y } as Touch],
    bubbles: true,
    cancelable: true,
  })
  // act() because these are raw document.dispatchEvent calls, not React
  // synthetic events — React doesn't know to flush state updates
  // triggered from a native document-level listener unless told to.
  act(() => {
    document.dispatchEvent(event)
  })
}

function swipe(fromX: number, fromY: number, toX: number, toY: number) {
  fireTouch('touchstart', fromX, fromY)
  fireTouch('touchmove', toX, toY)
  fireTouch('touchend', toX, toY)
}

// jsdom's default viewport is 1024px wide.
const VIEWPORT_WIDTH = window.innerWidth

interface TestDrawerProps {
  edge: 'left' | 'right'
  onOpenSpy?: () => void
  onCloseSpy?: () => void
}

function TestDrawer({ edge, onOpenSpy, onCloseSpy }: TestDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)

  useSwipeToToggle({
    edge,
    isOpen,
    onOpen: () => {
      setIsOpen(true)
      onOpenSpy?.()
    },
    onClose: () => {
      setIsOpen(false)
      onCloseSpy?.()
    },
  })

  return <span data-testid="state">{isOpen ? 'open' : 'closed'}</span>
}

describe('useSwipeToToggle', () => {
  it('right-anchored drawer opens on a leftward swipe from the right edge', () => {
    const onOpenSpy = vi.fn()
    render(<TestDrawer edge="right" onOpenSpy={onOpenSpy} />)
    swipe(VIEWPORT_WIDTH - 5, 200, VIEWPORT_WIDTH - 100, 200)
    expect(onOpenSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('state').textContent).toBe('open')
  })

  it('right-anchored drawer does NOT open on a leftward swipe starting far from the edge', () => {
    const onOpenSpy = vi.fn()
    render(<TestDrawer edge="right" onOpenSpy={onOpenSpy} />)
    // Starts in the middle of the viewport, not within the edge zone.
    swipe(VIEWPORT_WIDTH / 2, 200, VIEWPORT_WIDTH / 2 - 100, 200)
    expect(onOpenSpy).not.toHaveBeenCalled()
    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('right-anchored drawer does NOT open on a swipe in the wrong direction (rightward)', () => {
    const onOpenSpy = vi.fn()
    render(<TestDrawer edge="right" onOpenSpy={onOpenSpy} />)
    // Starts near the right edge but swipes further right (impossible in
    // practice near a screen edge, but confirms direction is checked,
    // not just edge-zone + distance).
    swipe(VIEWPORT_WIDTH - 5, 200, VIEWPORT_WIDTH + 50, 200)
    expect(onOpenSpy).not.toHaveBeenCalled()
  })

  it('ignores a swipe that is more vertical than horizontal (a scroll, not a drawer gesture)', () => {
    const onOpenSpy = vi.fn()
    render(<TestDrawer edge="right" onOpenSpy={onOpenSpy} />)
    swipe(VIEWPORT_WIDTH - 5, 100, VIEWPORT_WIDTH - 40, 400) // mostly vertical
    expect(onOpenSpy).not.toHaveBeenCalled()
  })

  it('ignores a swipe shorter than the threshold', () => {
    const onOpenSpy = vi.fn()
    render(<TestDrawer edge="right" onOpenSpy={onOpenSpy} />)
    swipe(VIEWPORT_WIDTH - 5, 200, VIEWPORT_WIDTH - 20, 200) // only 15px
    expect(onOpenSpy).not.toHaveBeenCalled()
  })

  it('left-anchored drawer opens on a rightward swipe from the left edge', () => {
    const onOpenSpy = vi.fn()
    render(<TestDrawer edge="left" onOpenSpy={onOpenSpy} />)
    swipe(5, 200, 100, 200)
    expect(onOpenSpy).toHaveBeenCalledTimes(1)
  })

  it('left-anchored drawer does NOT open on a leftward swipe (wrong direction)', () => {
    const onOpenSpy = vi.fn()
    render(<TestDrawer edge="left" onOpenSpy={onOpenSpy} />)
    swipe(50, 200, -50, 200)
    expect(onOpenSpy).not.toHaveBeenCalled()
  })

  it('closes an open right-anchored drawer on a rightward swipe from anywhere (not edge-restricted)', () => {
    const onCloseSpy = vi.fn()
    function OpenDrawer() {
      const [isOpen, setIsOpen] = useState(true) // starts open
      useSwipeToToggle({
        edge: 'right',
        isOpen,
        onOpen: () => setIsOpen(true),
        onClose: () => {
          setIsOpen(false)
          onCloseSpy()
        },
      })
      return <span data-testid="state">{isOpen ? 'open' : 'closed'}</span>
    }
    render(<OpenDrawer />)
    expect(screen.getByTestId('state').textContent).toBe('open')
    // Closing swipe doesn't need to start in the edge zone — the whole
    // open drawer is a valid area to swipe it shut from.
    swipe(200, 200, 300, 200)
    expect(onCloseSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('state').textContent).toBe('closed')
  })

  it('THE STALE-CLOSURE SCENARIO: after opening via swipe, a second swipe correctly closes it (not stuck thinking it is still closed)', () => {
    const onOpenSpy = vi.fn()
    const onCloseSpy = vi.fn()
    function ToggleDrawer() {
      const [isOpen, setIsOpen] = useState(false)
      useSwipeToToggle({
        edge: 'right',
        isOpen,
        onOpen: () => {
          setIsOpen(true)
          onOpenSpy()
        },
        onClose: () => {
          setIsOpen(false)
          onCloseSpy()
        },
      })
      return <span data-testid="state">{isOpen ? 'open' : 'closed'}</span>
    }
    render(<ToggleDrawer />)

    // Open it — this is the drawer's ONE effect run (deps are only
    // edge/edgeZonePx/thresholdPx, none of which change), so a stale,
    // directly-captured `isOpen` would be frozen at `false` from this
    // point forward regardless of what actually happens next.
    swipe(VIEWPORT_WIDTH - 5, 200, VIEWPORT_WIDTH - 100, 200)
    expect(onOpenSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('state').textContent).toBe('open')

    // Now swipe to close it. With a stale closure still thinking
    // isOpen=false, this would incorrectly fall into the "opening"
    // branch (already open, edge-zone swipe in the closing direction
    // doesn't match the opening direction either) and neither open nor
    // close would fire — the drawer would be stuck open. With the ref
    // pattern, this correctly reads isOpen=true and fires onClose.
    swipe(200, 200, 300, 200)
    expect(onCloseSpy).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('state').textContent).toBe('closed')
  })
})
