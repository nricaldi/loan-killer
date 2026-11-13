<script setup lang="ts">
import { computed } from 'vue'
import { daysBetween } from '../domain/dates'
import type { ExtraScenarioId, PaymentScenarios } from '../domain/paymentScenarios'
import { dateDistance, formatDate, money } from '../format'

const props = defineProps<{ result: PaymentScenarios; selected: ExtraScenarioId }>()
const emit = defineEmits<{ clear: [] }>()
const plan = computed(() => {
  const selected = props.result.scenarios.find(({ id }) => id === props.selected)
  if (!selected) throw new Error('Missing selected scenario.')
  return selected
})
const savings = computed(() => plan.value.savings)
const additionalInterest = computed(() => (savings.value?.interestCents ?? 0) < 0)
const includesOneTime = computed(() => props.selected !== 'monthly' && props.result.request.oneTimeCents > 0)
const monthlyExtraCents = computed(() => props.selected === 'one-time' ? 0 : props.result.request.extraMonthlyCents)
const minimumCents = computed(() => props.result.oneTime.baseline.monthlyPaymentCents)
const projection = computed(() => plan.value.portfolio.projection)
const paidOffProjection = computed(() => projection.value.status === 'paid-off' ? projection.value : null)
const target = computed(() => includesOneTime.value
  ? plan.value.portfolio.loans.find(({ loan }) => loan.id === props.result.request.loanId) : undefined)
const headingParts = computed(() => {
  const parts: { text: string; bold?: boolean }[] = []
  if (includesOneTime.value) parts.push(
    { text: 'With ' }, { text: money(props.result.oneTime.appliedCents), bold: true },
    { text: ' toward ' }, { text: props.result.oneTime.targetBaseline.loan.name, bold: true }, { text: ' today' },
  )
  if (monthlyExtraCents.value > 0) parts.push(
    { text: includesOneTime.value ? ' and ' : 'With ' },
    { text: money(monthlyExtraCents.value), bold: true }, { text: ' extra each month' },
  )
  return parts.length ? parts : [{ text: 'With your saved minimum payments' }]
})
const payoffChange = computed(() => {
  const before = props.result.oneTime.baseline.projection
  const after = projection.value
  if (before.status !== 'paid-off' || after.status !== 'paid-off') return 'Not available'
  const days = daysBetween(after.payoffDate, before.payoffDate)
  return days === 0 ? 'Same payoff date' : `${dateDistance(after.payoffDate, before.payoffDate)} ${days > 0 ? 'sooner' : 'later'}`
})

const targetPayoffChange = computed(() => {
  const before = props.result.oneTime.targetBaseline.projection
  const after = target.value?.projection
  if (before.status !== 'paid-off' || after?.status !== 'paid-off') return null
  const days = daysBetween(after.payoffDate, before.payoffDate)
  return days === 0 ? 'same payoff date' : `${dateDistance(after.payoffDate, before.payoffDate)} ${days > 0 ? 'sooner' : 'later'}`
})
</script>

<template>
  <section class="payment-summary" aria-labelledby="payment-summary-heading" aria-live="polite" aria-atomic="true">
    <div class="impact-highlight">
      <h3 id="payment-summary-heading"><template v-for="(part, index) in headingParts" :key="index"><strong v-if="part.bold">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template></h3>
      <div v-if="savings" class="impact-grid has-savings">
        <div>
          <p>{{ additionalInterest ? 'Additional interest' : 'Interest saved' }}</p>
          <strong data-testid="plan-interest-saved">{{ savings ? money(Math.abs(savings.interestCents)) : 'Not available' }}</strong>
        </div>
        <div>
          <p>Time saved</p>
          <strong data-testid="plan-time-saved">{{ payoffChange }}</strong>
        </div>
        <div>
          <p>Debt-free by</p>
          <strong data-testid="plan-payoff-date">{{ projection.status === 'paid-off' ? formatDate(projection.payoffDate) : 'Not available' }}</strong>
        </div>
      </div>
      <div v-else-if="paidOffProjection" class="impact-grid unavailable-baseline">
        <div>
          <p>Debt-free by</p>
          <strong data-testid="plan-payoff-date">{{ formatDate(paidOffProjection.payoffDate) }}</strong>
        </div>
        <div>
          <p>Interest with this plan</p>
          <strong data-testid="plan-interest-total">{{ money(paidOffProjection.remainingInterestCents) }}</strong>
        </div>
        <div>
          <p>Total to repay</p>
          <strong data-testid="plan-total-payments">{{ money(paidOffProjection.totalPaymentsCents) }}</strong>
        </div>
      </div>
      <p v-else class="plan-status">No payoff date yet with this plan. Try increasing your extra monthly payment or one-time payment.</p>
      <p v-if="!savings && paidOffProjection" class="savings-status">Savings aren’t available without a baseline payoff estimate.</p>
    </div>
    <p v-if="includesOneTime && result.oneTime.unusedCents > 0" class="impact-note">{{ money(result.oneTime.unusedCents) }} unused; it isn’t moved to another loan.</p>
    <p v-if="selected === 'one-time' && result.request.extraMonthlyCents > 0" class="impact-note">This preview excludes your extra monthly budget.</p>
    <p v-if="selected === 'monthly' && result.request.oneTimeCents > 0" class="impact-note">This preview excludes your one-time payment.</p>
    <details class="impact-details">
      <summary>{{ $slots.default ? 'Why this plan?' : 'Payment details' }}</summary>
      <p v-if="monthlyExtraCents > 0" class="monthly-budget" data-testid="monthly-budget">{{ money(minimumCents) }} minimums + {{ money(monthlyExtraCents) }} extra = <strong>{{ money(minimumCents + monthlyExtraCents) }} starting monthly budget</strong></p>
      <p v-if="includesOneTime" class="impact-note">{{ money(result.oneTime.appliedCents) }} applied to {{ result.oneTime.targetBaseline.loan.name }}.<template v-if="targetPayoffChange && result.oneTime.baseline.loans.length > 1"> This loan’s payoff: <strong>{{ targetPayoffChange }}</strong>.</template></p>
      <p v-if="!savings && paidOffProjection" class="impact-note">Minimum payments don’t produce a complete payoff estimate, so savings aren’t available. The totals above are for this plan.</p>
      <slot />
    </details>
    <button class="reset-button" type="button" @click="emit('clear')">Reset extra payments</button>
  </section>
</template>

<style scoped>
.payment-summary { color: var(--text); }
.impact-highlight { padding: var(--space-5); background: var(--highlight-background); color: var(--highlight-text); border-radius: var(--radius-md); }
h3 { margin: 0 0 var(--space-5); color: var(--highlight-muted); font-size: var(--font-sm); font-weight: 400; line-height: 1.5; }
h3 strong { color: var(--highlight-text); font-weight: 700; }
.impact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-5); }
.impact-grid > :last-child { grid-column: 1 / -1; }
.impact-grid p { margin: 0 0 var(--space-2); font-size: var(--font-sm); color: var(--highlight-muted); }
.impact-grid strong { display: block; font-size: clamp(1.6rem, 3vw, 2.3rem); font-weight: 700; line-height: 1.2; letter-spacing: -0.04em; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.has-savings > :first-child strong { font-size: clamp(2rem, 4vw, 3rem); }
.impact-grid > :last-child strong { font-size: var(--font-lg); letter-spacing: -0.02em; }
.unavailable-baseline > :first-child { grid-column: 1 / -1; }
.unavailable-baseline > :last-child { grid-column: auto; }
.unavailable-baseline > :not(:first-child) strong { font-size: var(--font-lg); }
.impact-details { margin-top: var(--space-3); }
summary { cursor: pointer; min-height: var(--size-touch-target); padding-block: var(--space-3); color: var(--text-link); font-size: var(--font-sm); }
.monthly-budget, .impact-note { margin: var(--space-2) 0 0; color: var(--text-secondary); font-size: var(--font-sm); line-height: 1.5; }
.plan-status, .savings-status { margin: var(--space-3) 0 0; font-size: var(--font-sm); line-height: 1.5; color: var(--highlight-muted); }
.reset-button { min-height: var(--size-touch-target); padding: var(--space-2) 0; border: 0; background: transparent; color: var(--text-link); font-size: var(--font-sm); text-decoration: underline; text-underline-offset: 0.2em; }
@media (max-width: 30rem) { .impact-grid { grid-template-columns: 1fr; } .impact-grid > :last-child { grid-column: auto; } }
</style>
