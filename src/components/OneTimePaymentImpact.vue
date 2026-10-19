<script setup lang="ts">
import { computed } from 'vue'
import { daysBetween } from '../domain/dates'
import type { Projection } from '../domain/loan'
import type { OneTimePaymentComparison } from '../domain/oneTimePayment'
import { dateDistance, money } from '../format'

const props = defineProps<{ comparison: OneTimePaymentComparison }>()
const savings = computed(() => props.comparison.savings)
const additionalInterest = computed(() => (savings.value?.interestCents ?? 0) < 0)

function payoffChange(before: Projection, after: Projection): string {
  if (before.status !== 'paid-off' || after.status !== 'paid-off') return 'Not available'
  const days = daysBetween(after.payoffDate, before.payoffDate)
  return days === 0 ? 'Same payoff date' : `${dateDistance(after.payoffDate, before.payoffDate)} ${days > 0 ? 'sooner' : 'later'}`
}
</script>

<template>
  <section class="one-time-impact" aria-labelledby="one-time-impact-heading" aria-live="polite" aria-atomic="true">
    <h3 id="one-time-impact-heading">With this {{ money(comparison.appliedCents) }} one-time payment</h3>
    <div class="impact-grid">
      <div>
        <p>{{ additionalInterest ? 'Additional interest' : 'You’ll save in interest' }}</p>
        <strong data-testid="one-time-interest-impact">{{ savings ? money(Math.abs(savings.interestCents)) : 'Not available' }}</strong>
      </div>
      <div>
        <p>Debt-free across all loans</p>
        <strong data-testid="one-time-payoff-impact">{{ payoffChange(comparison.baseline.projection, comparison.scenario.projection) }}</strong>
      </div>
    </div>
    <p class="target-payoff-impact">{{ comparison.targetBaseline.loan.name }}: <strong>{{ payoffChange(comparison.targetBaseline.projection, comparison.targetScenario.projection) }}</strong></p>
    <p class="impact-note">Estimated impact of this one-time payment only, compared with saved minimums. Extra monthly payments aren’t included.<template v-if="!savings"> Complete savings need payoff estimates for both plans.</template></p>
    <p v-if="comparison.unusedCents > 0" class="impact-note">{{ money(comparison.unusedCents) }} unused; it isn’t moved to another loan.</p>
  </section>
</template>

<style scoped>
.one-time-impact { margin-top: var(--space-3); padding: var(--space-4); background: var(--highlight-background); color: var(--highlight-text); border-radius: var(--radius-md); }
h3 { margin: 0 0 var(--space-4); font-size: var(--font-sm); font-weight: 600; line-height: 1.6; }
.impact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
.impact-grid p { margin: 0 0 var(--space-2); font-size: var(--font-xs); color: var(--highlight-muted); }
.impact-grid strong { display: block; font-size: clamp(1.2rem, 2vw, 1.65rem); font-weight: 650; line-height: 1.3; letter-spacing: -0.03em; overflow-wrap: anywhere; }
.target-payoff-impact { margin: var(--space-4) 0 0; font-size: var(--font-xs); line-height: 1.7; }
.impact-note { margin: var(--space-2) 0 0; color: var(--highlight-muted); font-size: var(--font-xs); line-height: 1.6; }
@media (max-width: 23rem) { .impact-grid { grid-template-columns: 1fr; } }
</style>
