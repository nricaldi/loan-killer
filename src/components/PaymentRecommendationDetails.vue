<script setup lang="ts">
import type { ExtraScenarioId } from '../domain/paymentScenarios'
import type { PaymentRecommendation, RecommendedOption } from '../domain/paymentRecommendations'
import { strategyNames } from '../domain/recurringPayments'
import { dateDistance, formatDate, money } from '../format'

defineProps<{ recommendation: PaymentRecommendation; selected: ExtraScenarioId; embedded?: boolean }>()
function label(option: RecommendedOption, selected: ExtraScenarioId) {
  if (selected === 'monthly') return strategyNames[option.strategy]
  return selected === 'one-time' ? option.loanName : `${option.loanName} today · ${strategyNames[option.strategy]} monthly`
}
</script>

<template>
  <div class="recommendation-details">
    <p v-if="!embedded && recommendation.fastestAlternative" class="tradeoff">An alternative finishes {{ dateDistance(recommendation.option.payoffDate!, recommendation.fastestAlternative.payoffDate!) }} sooner for {{ money(recommendation.fastestAlternative.interestCents! - recommendation.option.interestCents!) }} more interest.</p>
    <component :is="embedded ? 'div' : 'details'">
      <summary v-if="!embedded">Why this recommendation?</summary>
      <p v-if="recommendation.option.payoffDate === null">None of the compared options has a complete payoff estimate. The chart is a preview, not a lowest-cost recommendation. Try a larger payment.</p>
      <p v-else-if="recommendation.alternatives.length === 1">There’s one loan in this view, so your extra payment has only one destination. Payments cover unpaid interest before principal.</p>
      <p v-else-if="recommendation.tied">More than one option ties for the lowest projected interest and the same overall payoff date. The tied options give the same modeled outcome.</p>
      <p v-else>We compared {{ recommendation.alternatives.length }} options using these amounts and payment dates. This has the lowest projected total interest among options with a complete payoff estimate; an earlier overall payoff breaks an interest tie.</p>
      <p v-if="selected !== 'monthly'">The one-time payment goes to one loan. Excess above that loan’s payoff amount stays unused.</p>
      <div v-if="recommendation.alternatives.length > 1" class="alternatives-scroll" role="region" aria-label="Compared payment allocations" tabindex="0">
        <table>
          <caption>Same entered amounts · {{ selected === 'one-time' ? 'one-time targets' : selected === 'monthly' ? 'two monthly allocation methods' : 'one-time targets and two monthly allocation methods' }}</caption>
          <thead><tr><th scope="col">Allocation</th><th scope="col">Total interest</th><th scope="col">Debt-free</th></tr></thead>
          <tbody><tr v-for="option in recommendation.alternatives" :key="`${option.loanId}-${option.strategy}`" :class="{ recommended: option === recommendation.option }"><th scope="row">{{ label(option, selected) }}<span v-if="option === recommendation.option"> · {{ option.payoffDate ? recommendation.tied ? 'Tied best' : 'Recommended' : 'Preview' }}</span></th><td>{{ option.interestCents === null ? 'Not available' : money(option.interestCents) }}</td><td>{{ option.payoffDate ? formatDate(option.payoffDate) : 'No payoff estimate' }}</td></tr></tbody>
        </table>
      </div>
    </component>
  </div>
</template>

<style scoped>
.recommendation-details { margin-top: var(--space-3); font-size: var(--font-sm); }
summary { cursor: pointer; color: var(--text-link); min-height: var(--size-touch-target); padding-block: var(--space-3); }
p { margin: var(--space-2) 0; color: var(--text-secondary); line-height: 1.5; }
.tradeoff { color: var(--text); }
.alternatives-scroll { overflow: auto; max-height: 18rem; margin-top: var(--space-3); }
table { width: 100%; border-collapse: collapse; font-size: var(--font-sm); }
caption { text-align: left; color: var(--text-secondary); margin-bottom: var(--space-2); }
th, td { padding: var(--space-3); text-align: left; border-bottom: 1px solid var(--border-strong); vertical-align: top; }
tbody th { font-weight: 400; }
td { white-space: nowrap; font-variant-numeric: tabular-nums; }
.recommended { background: var(--blue-light); }
.recommended th { font-weight: 600; }
</style>
