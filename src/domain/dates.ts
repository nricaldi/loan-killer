const DAY_IN_MS = 86_400_000

export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? date
    : null
}

export function today(): string {
  const date = new Date()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function daysBetween(start: string, end: string): number {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate || !endDate) throw new Error('Use valid dates in YYYY-MM-DD format.')
  return (endDate.getTime() - startDate.getTime()) / DAY_IN_MS
}

export function addMonths(value: string, months: number): string {
  const date = parseDate(value)
  if (!date) throw new Error('Use a valid date in YYYY-MM-DD format.')
  const target = new Date(date)
  target.setUTCDate(1)
  target.setUTCMonth(target.getUTCMonth() + months)
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay))
  return target.toISOString().slice(0, 10)
}
