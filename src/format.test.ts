import { describe, expect, it } from 'vitest'
import { dateDistance } from './format'

describe('calendar date distance', () => {
  it.each([
    ['2025-01-01', '2025-01-01', '0 days'],
    ['2025-01-01', '2025-01-02', '1 day'],
    ['2025-01-31', '2025-02-28', '1 month'],
    ['2025-02-28', '2025-03-31', '1 month, 3 days'],
    ['2024-02-29', '2025-02-28', '1 year'],
    ['2024-01-01', '2025-03-03', '1 year, 2 months, 2 days'],
  ])('formats %s to %s', (start, end, expected) => {
    expect(dateDistance(start, end)).toBe(expected)
    expect(dateDistance(end, start)).toBe(expected)
  })

  it('does not silently format invalid calendar dates', () => {
    expect(() => dateDistance('2025-02-29', '2025-03-01')).toThrow()
  })
})
