import { useEffect, useRef } from 'react'

interface SwipeOptions {
  /** Which screen edge this drawer is anchored to and opens from. A
   * right-anchored drawer (like PublicLayout's mobile menu) opens on a
   * leftward swipe starting near the right edge, and closes on a
   * rightward swipe. A left-anchored drawer (AdminLayout's nav) is the
   * mirror image. */
  edge: 'left' | 'right'
  isOpen: boolean
  onOpen: () => void
  onClose: () => void
  /** How close to the edge (in px) a touch must start for it to count as
   * an "open" gesture. Kept fairly narrow so ordinary swipes/scrolls
   * elsewhere on the page — most pages are far wider than this — aren't
   * mistaken for someone trying to open the drawer. */
  edgeZonePx?: number
  /** How far (in px) a swipe must travel before it counts as a
   * deliberate gesture rather than an incidental touch/scroll wobble. */
  thresholdPx?: number
}

/**
 * Attaches document-level touch listeners (not React's synthetic touch
 * props) so the gesture works regardless of what's under the user's
 * finger, the same reasoning as useDialogA11y's document-level keydown
 * listener. Listeners stay passive throughout (no preventDefault) — this
 * only ever calls onOpen/onClose once per gesture and never blocks the
 * browser's own scroll/back-gesture handling, since fighting the
 * platform's native touch handling is a common source of janky scroll
 * bugs and this doesn't need to prevent anything to do its job.
 */
export function useSwipeToToggle({
  edge,
  isOpen,
  onOpen,
  onClose,
  edgeZonePx = 24,
  thresholdPx = 50,
}: SwipeOptions) {
  // Latest isOpen/onOpen/onClose available to the listener without
  // re-attaching it on every render — same ref pattern as
  // useDialogA11y.onCloseRef, for the same reason: onOpen/onClose are
  // inline closures at the call site, a new identity every render.
  const stateRef = useRef({ isOpen, onOpen, onClose })
  useEffect(() => {
    stateRef.current = { isOpen, onOpen, onClose }
  })

  useEffect(() => {
    let startX: number | null = null
    let startY: number | null = null
    let startedInEdgeZone = false
    let handled = false

    function handleTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      if (!touch) return
      startX = touch.clientX
      startY = touch.clientY
      handled = false
      startedInEdgeZone =
        edge === 'right'
          ? startX >= window.innerWidth - edgeZonePx
          : startX <= edgeZonePx
    }

    function handleTouchMove(e: TouchEvent) {
      if (startX === null || startY === null || handled) return
      const touch = e.touches[0]
      if (!touch) return

      const deltaX = touch.clientX - startX
      const deltaY = touch.clientY - startY

      // More vertical than horizontal — this is a scroll, not a swipe
      // for the drawer. Bail out for the rest of this gesture.
      if (Math.abs(deltaY) > Math.abs(deltaX)) return
      if (Math.abs(deltaX) < thresholdPx) return

      const { isOpen: currentlyOpen, onOpen: open, onClose: close } = stateRef.current

      if (!currentlyOpen && startedInEdgeZone) {
        // Opening: right-anchored drawer opens on a leftward swipe
        // (negative deltaX) from the right edge; left-anchored opens on
        // a rightward swipe (positive deltaX) from the left edge.
        const isOpeningDirection = edge === 'right' ? deltaX < 0 : deltaX > 0
        if (isOpeningDirection) {
          open()
          handled = true
        }
      } else if (currentlyOpen) {
        // Closing: the mirror image — push the drawer back toward
        // whichever edge it's anchored to.
        const isClosingDirection = edge === 'right' ? deltaX > 0 : deltaX < 0
        if (isClosingDirection) {
          close()
          handled = true
        }
      }
    }

    function handleTouchEnd() {
      startX = null
      startY = null
      startedInEdgeZone = false
      handled = false
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
    // Deliberately only re-attaches if edge/edgeZonePx/thresholdPx change
    // — isOpen/onOpen/onClose are read from stateRef instead, so this
    // doesn't tear down and rebuild the listeners (and reset in-progress
    // gesture tracking) on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edge, edgeZonePx, thresholdPx])
}
