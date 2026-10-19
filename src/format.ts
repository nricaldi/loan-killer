import { addMonths, daysBetween, parseDate } from './domain/dates'

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const compactCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

export function money(cents: number): string {
  return currency.format(cents / 100)
}

export function chartMoney(cents: number): string {
  if (cents >= 100_000) {
    return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(cents / 100_000)}k`
  }
  return compactCurrency.format(cents / 100)
}

export function formatDate(value: string, monthOnly = false): string {
  const date = parseDate(value)
  if (!date) return value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    ...(monthOnly ? {} : { day: 'numeric' as const }),
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export function dateDistance(first: string, second: string): string {
  const [start, end] = first <= second ? [first, second] : [second, first]
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate || !endDate) throw new Error('Use valid calendar dates.')
  let months = (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12
    + endDate.getUTCMonth() - startDate.getUTCMonth()
  if (addMonths(start, months) > end) months--
  const days = daysBetween(addMonths(start, months), end)
  const parts: string[] = []
  for (const [amount, unit] of [[Math.floor(months / 12), 'year'], [months % 12, 'month'], [days, 'day']] as const) {
    if (amount) parts.push(`${amount} ${unit}${amount === 1 ? '' : 's'}`)
  }
  return parts.join(', ') || '0 days'
}
