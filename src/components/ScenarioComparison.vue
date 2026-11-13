<script setup lang="ts">
import { computed } from 'vue'
import type { ExtraScenarioId, PaymentScenarios } from '../domain/paymentScenarios'
import { formatDate, money } from '../format'

const props = defineProps<{ result: PaymentScenarios; selected: ExtraScenarioId }>()
const emit = defineEmits<{ select: [scenario: ExtraScenarioId] }>()
const plans = computed(() => props.result.scenarios.filter(({ id }) => id === 'minimum'
  || (id === 'one-time' && props.result.request.oneTimeCents > 0)
  || (id === 'monthly' && props.result.request.extraMonthlyCents > 0)
  || (id === 'combined' && props.result.request.oneTimeCents > 0 && props.result.request.extraMonthlyCents > 0)))
</script>

<template>
  <section class="comparison-results" data-testid="extra-payment-results" aria-labelledby="compare-plans-heading">
    <h3 id="compare-plans-heading">Compare your options</h3>
    <div class="plan-list">
      <article v-for="plan in plans" :key="plan.id" class="plan-row" :class="{ 'selected-plan': selected === plan.id }" :data-scenario-id="plan.id">
        <h4 v-if="plan.id === 'minimum'">Minimum payments</h4>
        <button v-else type="button" :aria-pressed="selected === plan.id" @click="emit('select', plan.id)">{{ plan.label }}</button>
        <dl>
          <div><dt>Debt-free</dt><dd>{{ plan.portfolio.projection.status === 'paid-off' ? formatDate(plan.portfolio.projection.payoffDate) : 'No payoff estimate' }}</dd></div>
          <div><dt>Interest</dt><dd>{{ plan.portfolio.projection.status === 'paid-off' ? money(plan.portfolio.projection.remainingInterestCents) : 'Not available' }}</dd></div>
          <div><dt>Total to repay</dt><dd>{{ plan.portfolio.projection.status === 'paid-off' ? money(plan.portfolio.projection.totalPaymentsCents) : 'Not available' }}</dd></div>
        </dl>
      </article>
    </div>
  </section>
</template>

<style scoped>
h3 { margin: 0 0 var(--space-3); font-size: var(--font-md); font-weight: 600; }
.plan-list { display: grid; gap: var(--space-2); }
.plan-row { display: grid; grid-template-columns: minmax(9rem, 1fr) 3fr; align-items: center; gap: var(--space-4); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); }
.selected-plan { background: var(--blue-light); border-color: var(--blue-border); }
h4 { font-size: var(--font-sm); font-weight: 400; margin: 0; }
button { min-height: var(--size-touch-target); padding: var(--space-2); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-link); font-size: var(--font-sm); text-align: left; }
button[aria-pressed='true'] { border-color: var(--chart-line); font-weight: 650; }
dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); margin: 0; }
dt { color: var(--text-secondary); font-size: var(--font-xs); }
dd { margin: var(--space-1) 0 0; font-size: var(--font-sm); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
@media (max-width: 40rem) { .plan-row { grid-template-columns: 1fr; gap: var(--space-3); } }
</style>
