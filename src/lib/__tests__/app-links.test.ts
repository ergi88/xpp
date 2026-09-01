import { describe, it, expect } from 'vitest'
import { normalizeAppHost, schemeOf, buildAppLink } from '@/lib/app-links'

describe('normalizeAppHost', () => {
  it.each([
    ['ergi88.github.io/xpp', 'ergi88.github.io/xpp'],
    ['https://ergi88.github.io/xpp', 'ergi88.github.io/xpp'],
    ['https://ergi88.github.io/xpp/', 'ergi88.github.io/xpp'],
    ['webapp://ergi88.github.io/xpp', 'ergi88.github.io/xpp'],
    ['  localhost:5178/xpp/  ', 'localhost:5178/xpp'],
  ])('normalizes %s', (raw, expected) => {
    expect(normalizeAppHost(raw)).toBe(expected)
  })
})

describe('schemeOf', () => {
  it('reads an explicit scheme', () => {
    expect(schemeOf('https://ergi88.github.io/xpp')).toBe('https')
    expect(schemeOf('http://localhost:5178/xpp')).toBe('http')
  })
  it('returns null when the host carries none', () => {
    expect(schemeOf('ergi88.github.io/xpp')).toBeNull()
  })
})

describe('buildAppLink', () => {
  const host = 'ergi88.github.io/xpp'

  it('builds a web link', () => {
    expect(buildAppLink(host, '/transactions/new?amount=222', 'web')).toBe(
      'https://ergi88.github.io/xpp/transactions/new?amount=222',
    )
  })

  it('builds an installed-app link', () => {
    expect(buildAppLink(host, '/transactions/new?amount=222', 'webapp')).toBe(
      'webapp://ergi88.github.io/xpp/transactions/new?amount=222',
    )
  })

  it('keeps http for a local host', () => {
    expect(buildAppLink('localhost:5178/xpp', '/settings', 'web', 'http')).toBe(
      'http://localhost:5178/xpp/settings',
    )
  })

  it('tolerates a host with a scheme and a path without a leading slash', () => {
    expect(buildAppLink('https://ergi88.github.io/xpp/', 'transactions/new', 'webapp')).toBe(
      'webapp://ergi88.github.io/xpp/transactions/new',
    )
  })
})
