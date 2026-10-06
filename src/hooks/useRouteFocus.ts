import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * In a single-page app, clicking a link swaps the page without a real page
 * load, so (1) the scroll position carries over from the previous page and
 * (2) keyboard and screen-reader users are left focused on a link that no
 * longer exists, with no sign the page changed. On each navigation to a new
 * path this scrolls to the top and moves focus to the main content, which
 * also makes a screen reader start reading the new page. Query-string-only
 * changes (e.g. filtering a list) are ignored, and so is the first load.
 */
export function useRouteFocus() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)

  useEffect(() => {
    if (previous.current === pathname) return
    previous.current = pathname
    window.scrollTo(0, 0)
    document.getElementById('main-content')?.focus({ preventScroll: true })
  }, [pathname])
}
