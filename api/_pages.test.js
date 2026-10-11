import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PAGES } from './_pages.js'
import { renderHtml } from './prerender.js'

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8')

describe('share-preview page metadata', () => {
  for (const [key, page] of Object.entries(PAGES)) {
    it(`${key}: matches the <SEO> tag in src/pages/public/${page.file}`, () => {
      const source = read(`../src/pages/public/${page.file}`)
      expect(source).toContain(`title="${page.title}"`)
      expect(source).toContain(`description="${page.description}"`)
      expect(source).toMatch(new RegExp(`path="${page.path}"`))
    })
  }
})

describe('renderHtml', () => {
  it('uses an absolute image URL and includes og:url', () => {
    const html = renderHtml({ title: 'About Us', description: 'Hi', url: 'https://natakaholidays.co.ke/about' })
    expect(html).toMatch(/og:image" content="https:\/\/[^"]+\/og-default\.jpg"/)
    expect(html).toContain('og:url" content="https://natakaholidays.co.ke/about"')
    expect(html).toContain('og:image:width')
  })

  it("keeps a property's own photo and omits the default image size", () => {
    const html = renderHtml({
      title: 'Villa',
      description: 'Nice',
      image: 'https://x.supabase.co/storage/v1/object/public/property-images/a.jpg',
      url: 'https://natakaholidays.co.ke/stays/villa',
    })
    expect(html).toContain('property-images/a.jpg')
    expect(html).not.toContain('og:image:width')
  })
})

describe('index.html defaults', () => {
  it('points og:image and twitter:image at absolute URLs', () => {
    const html = read('../index.html')
    expect(html).toMatch(/og:image" content="https:\/\//)
    expect(html).toMatch(/twitter:image" content="https:\/\//)
    expect(html).not.toMatch(/image" content="\//)
  })
})
