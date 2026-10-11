import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/react'
import { HelmetProvider } from 'react-helmet-async'
import indexHtml from '../../../index.html?raw'
import { SEO } from '@/components/shared/SEO'

// The real <head> from index.html, so this test sees exactly what a browser
// (or a share-preview extension that reads the first matching tag) sees.
const indexHead = indexHtml.match(/<head>([\s\S]*)<\/head>/)![1]

const metas = (selector: string) =>
  Array.from(document.head.querySelectorAll<HTMLMetaElement>(selector)).map((m) => m.content)

beforeEach(() => {
  document.head.innerHTML = indexHead
})
afterEach(cleanup)

describe('SEO over the index.html defaults', () => {
  it('leaves exactly one title/description tag per page, with the page values first', async () => {
    render(
      <HelmetProvider>
        <SEO title="Holiday Homes on the Kenyan Coast" description="Browse villas." path="/holiday-homes" />
      </HelmetProvider>,
    )
    await waitFor(() => expect(document.title).toContain('Holiday Homes'))

    expect(metas('meta[property="og:title"]')).toEqual(['Holiday Homes on the Kenyan Coast | Nataka Holidays'])
    expect(metas('meta[name="twitter:title"]')).toEqual(['Holiday Homes on the Kenyan Coast | Nataka Holidays'])
    expect(metas('meta[property="og:description"]')).toEqual(['Browse villas.'])
    expect(metas('meta[name="description"]')).toEqual(['Browse villas.'])
    expect(metas('meta[property="og:url"]')).toHaveLength(1)
    expect(metas('meta[property="og:image"]')).toHaveLength(1)
  })
})
