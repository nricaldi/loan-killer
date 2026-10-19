import { parseDate } from './domain/dates'

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
