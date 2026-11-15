import type { Projection } from './loan'

// A valid servicer minimum can still be insufficient. Warn without rejecting the saved figure.
export function paymentWarning(projection: Projection): { title: string; detail: string } | null {
  if (projection.status === 'paid-off') return null
  return projection.status === 'insufficient-payment'
    ? { title: 'Too low to pay off', detail: 'This payment does not cover ongoing interest, or leaves the balance unchanged. Increase it or try extra payments.' }
    : { title: 'Payoff beyond estimate', detail: 'A balance remains after 1,200 monthly payments. Try a higher payment to bring the payoff within the estimate.' }
}
