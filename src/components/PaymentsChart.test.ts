import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { projectLoan, type Loan } from '../domain/loan'
import { projectPortfolio } from '../domain/portfolio'
import { money } from '../format'
import PaymentsChart from './PaymentsChart.vue'

const loan: Loan = {
  name: 'Direct loan', type: 'unsubsidized', principalCents: 100_000,
  accruedInterestCents: 2_500, annualRatePercent: 5.5, monthlyPaymentCents: 30_000,
  balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}

function render(overrides: Partial<Loan> = {}) {
  const input = { ...loan, ...overrides }
  const projection = projectLoan(input)
  if (projection.status !== 'paid-off') throw new Error('Expected payoff')
  return { projection, wrapper: mount(PaymentsChart, { props: { balanceDate: input.balanceDate, projection } }) }
}

describe('cumulative payments chart', () => {
  it('splits cumulative payments into principal, accrued interest and future interest without double-counting', () => {
    const { projection, wrapper } = render()
    const description = wrapper.get('desc').text()
    expect(description).toContain(money(projection.totalPaymentsCents))
    expect(description).toContain('$1,000.00 toward principal')
    expect(description).toContain(`${money(projection.remainingInterestCents)} toward interest`)
    expect(projection.totalPaymentsCents).toBe(loan.principalCents + projection.remainingInterestCents)
    expect(wrapper.get('.principal-area').attributes('d')).not.toBe(wrapper.get('.interest-area').attributes('d'))
    expect(wrapper.get('.total-line').attributes('d')).toMatch(/L720\.00,0\.00$/)
    wrapper.unmount()
  })

  it('shows payments as steps on payment dates rather than paying gradually beforehand', () => {
    const { wrapper } = render({ annualRatePercent: 0 })
    const path = wrapper.get('.total-line').attributes('d') ?? ''
    const coordinates = [...path.matchAll(/[ML]([\d.]+),([\d.]+)/g)].map((match) => [match[1], match[2]])
    expect(coordinates[0]).toEqual(['0.00', '220.00'])
    for (let index = 1; index < coordinates.length; index += 2) {
      expect(coordinates[index]?.[1]).toBe(coordinates[index - 1]?.[1])
      expect(coordinates[index]?.[0]).toBe(coordinates[index + 1]?.[0])
    }
    wrapper.unmount()
  })

  it.each([
    { principalCents: 0, accruedInterestCents: 2_500 },
    { annualRatePercent: 0, accruedInterestCents: 0 },
    { nextPaymentDate: loan.balanceDate, monthlyPaymentCents: 102_500 },
  ])('handles interest-only, zero-interest and same-day payoffs: %j', (overrides) => {
    const { wrapper } = render(overrides)
    expect(wrapper.html()).not.toMatch(/NaN|Infinity/)
    expect(wrapper.get('desc').text()).toContain('This is a projection, not actual payment history.')
    wrapper.unmount()
  })

  it('uses the combined schedule for loans with different due dates and updates when the projection changes', async () => {
    const portfolio = projectPortfolio([
      { ...loan, id: 'first', fromExample: false },
      { ...loan, id: 'second', nextPaymentDate: '2025-02-15', fromExample: false },
    ])
    if (portfolio?.projection.status !== 'paid-off') throw new Error('Expected payoff')
    const { wrapper } = render()
    const originalPath = wrapper.get('.total-line').attributes('d')
    await wrapper.setProps({ projection: portfolio.projection })
    expect(wrapper.get('desc').text()).toContain('$2,000.00 toward principal')
    expect(wrapper.get('desc').text()).toContain(money(portfolio.projection.totalPaymentsCents))
    expect(wrapper.get('.total-line').attributes('d')).not.toBe(originalPath)
    expect(wrapper.html()).not.toMatch(/NaN|Infinity/)
    wrapper.unmount()
  })
})
