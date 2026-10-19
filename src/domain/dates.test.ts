import { afterEach, describe, expect, it, vi } from 'vitest'
import { addMonths, daysBetween, parseDate, today } from './dates'

afterEach(() => vi.useRealTimers())

describe('calendar dates', () => {
  it.each(['2025-02-29', '2025-04-31', '2025-13-01', '2025-1-01', '', 'not a date'])('rejects %s', (value) => {
    expect(parseDate(value)).toBeNull()
  })

  it('accepts leap days', () => {
    expect(parseDate('2024-02-29')?.toISOString()).toBe('2024-02-29T00:00:00.000Z')
  })

  it('counts actual days, independent of daylight saving time', () => {
    expect(daysBetween('2025-03-01', '2025-04-01')).toBe(31)
    expect(daysBetween('2024-02-01', '2024-03-01')).toBe(29)
    expect(daysBetween('2025-02-01', '2025-03-01')).toBe(28)
  })

  it('clamps short months without shifting the original due day', () => {
    expect(addMonths('2025-01-31', 1)).toBe('2025-02-28')
    expect(addMonths('2025-01-31', 2)).toBe('2025-03-31')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2025-12-31', 1)).toBe('2026-01-31')
  })

  it('uses the local calendar date for today', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 31, 23, 30))
    expect(today()).toBe('2025-01-31')
  })

  it('does not silently calculate with invalid dates', () => {
    expect(() => addMonths('2025-02-30', 1)).toThrow()
    expect(() => daysBetween('invalid', '2025-01-01')).toThrow()
  })
})
