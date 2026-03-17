import { describe, it, expect } from 'vitest'
import { isValidUrl, buildErrorResult } from './analyzer'

describe('isValidUrl', () => {
  it('accepts https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true)
  })

  it('accepts http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true)
  })

  it('accepts bare domains and prepends https', () => {
    expect(isValidUrl('example.com')).toBe(true)
  })

  it('rejects empty strings', () => {
    expect(isValidUrl('')).toBe(false)
  })

  it('rejects random garbage', () => {
    expect(isValidUrl('not a url at all')).toBe(false)
  })
})

describe('buildErrorResult', () => {
  it('returns unreachable result with all false/null signals', () => {
    const result = buildErrorResult('https://down.example.com')
    expect(result.reachable).toBe(false)
    expect(result.url).toBe('https://down.example.com')
    expect(result.has_booking).toBe(false)
    expect(result.page_load_ms).toBeNull()
    expect(result.tech_stack).toBeNull()
  })
})
