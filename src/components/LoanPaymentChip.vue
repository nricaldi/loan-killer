<script setup lang="ts">
import { vZeroOnFocus } from '../directives/zeroOnFocus'
import { computed, ref, useId, watch } from 'vue'
import { parseMoney } from '../domain/loanForm'
import type { LoanRecord } from '../domain/portfolio'
import { money } from '../format'
import { projectLoan } from '../domain/loan'
import { suggestMonthlyPayment } from '../domain/paymentSuggestion'
import { paymentWarning } from '../domain/paymentWarning'

const props = defineProps<{ loan: LoanRecord; selected: boolean }>()
const emit = defineEmits<{ select: []; payment: [cents: number] }>()
const id = useId()
const amount = ref((props.loan.monthlyPaymentCents / 100).toFixed(2))
const cents = computed(() => parseMoney(amount.value))
const invalid = computed(() => cents.value === null)

const minimumWarning = computed(() => cents.value === null ? null
  : paymentWarning(projectLoan({ ...props.loan, monthlyPaymentCents: cents.value })))

const suggestion = computed(() => minimumWarning.value ? suggestMonthlyPayment(props.loan) : null)

watch(() => props.loan.monthlyPaymentCents, (value) => {
  if (parseMoney(amount.value) !== value) amount.value = (value / 100).toFixed(2)
})

function useSuggestion() {
  const amountCents = suggestion.value?.amountCents
  if (amountCents === undefined) return
  amount.value = (amountCents / 100).toFixed(2)
  emit('payment', amountCents)
}

function updatePayment(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  amount.value = event.target.value
  if (!invalid.value && cents.value !== null && cents.value !== props.loan.monthlyPaymentCents) {
    emit('payment', cents.value)
  }
}
</script>

<template>
  <div class="loan-chip" :class="{ selected }" :data-chip-id="loan.id">
    <button class="chip-name" type="button" :title="loan.name" :aria-label="`View ${loan.name}`" :aria-pressed="selected" @click="emit('select')">
      <span class="loan-name">{{ loan.name }}</span>
      <span class="chip-facts"><span class="chip-balance"><strong>{{ money(loan.principalCents + loan.accruedInterestCents) }}</strong></span><span class="chip-rate">{{ loan.annualRatePercent }}%</span></span>
      <span v-if="loan.fromExample" class="sr-only">From example</span>
    </button>
    <slot name="actions" />
    <div class="chip-payment">
      <label class="sr-only" :for="`${id}-payment`">Min. / month</label>
      <div class="payment-input"><span aria-hidden="true">$</span><input :id="`${id}-payment`" v-zero-on-focus :value="amount" type="text" inputmode="decimal" :aria-label="`Monthly minimum for ${loan.name}`" :class="{ 'payment-warning': minimumWarning }" :aria-invalid="invalid" :aria-describedby="invalid ? `${id}-error` : minimumWarning ? `${id}-warning` : 'loan-payment-help'" @input="updatePayment" /><span class="per-month" aria-hidden="true">/mo</span></div>
    </div>
    <p v-if="invalid" :id="`${id}-error`" class="field-error" role="status">Use $0–$10,000,000, up to 2 decimals. Estimate uses the last valid minimum.</p>
    <div v-if="minimumWarning" :id="`${id}-warning`" class="minimum-warning">
      <span>{{ minimumWarning.title }}</span>
      <button v-if="suggestion" class="suggest-payment" type="button" :aria-label="`Use ${money(suggestion.amountCents)} per month for ${loan.name}${suggestion.tenYear ? ', a 10-year payoff estimate' : ''}`" @click="useSuggestion">{{ suggestion.tenYear ? '10-year plan:' : 'Try' }} {{ money(suggestion.amountCents) }}/mo</button>
      <span v-else>Check the balance and payment dates.</span>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.loan-chip { display: grid; grid-template-columns: minmax(0, 1fr) 6.5rem auto; gap: var(--space-1) var(--space-2); align-items: center; min-width: 0; padding: var(--space-2); background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-md); }
.loan-chip.selected { border-color: var(--chart-line); background: var(--blue-light); }
.chip-name { grid-column: 1; grid-row: 1; min-width: 0; min-height: var(--size-touch-target); padding: 0; border: 0; background: transparent; color: var(--text); text-align: left; }
.loan-name { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--font-sm); font-weight: 600; color: var(--text-link); }
.chip-name[aria-pressed='true'] .loan-name { text-decoration: underline; text-underline-offset: 0.2em; }
.chip-facts { display: flex; align-items: baseline; flex-wrap: wrap; gap: 0 var(--space-2); margin-top: var(--space-1); }
.chip-balance strong { font-size: var(--font-sm); font-weight: 600; font-variant-numeric: tabular-nums; }
.chip-rate { font-size: var(--font-xs); color: var(--text-secondary); }
.chip-payment { grid-column: 2; grid-row: 1; min-width: 0; }
label { display: block; font-size: var(--font-xs); color: var(--text-secondary); margin-bottom: var(--space-1); }
.payment-input { position: relative; }
.payment-input span { position: absolute; left: var(--space-2); top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-size: var(--font-xs); pointer-events: none; }
input { width: 100%; min-height: var(--size-touch-target); padding: var(--space-2) 1.65rem var(--space-2) 1.25rem; background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font-size: var(--font-md); font-variant-numeric: tabular-nums; }
.payment-input .per-month { left: auto; right: var(--space-1); font-size: 0.65rem; }
input.payment-warning, input[aria-invalid='true'] { border-color: var(--danger); }
.loan-chip :slotted(.loan-actions) { grid-column: 3; grid-row: 1; }
.loan-chip :slotted(.remove-confirmation), .minimum-warning, .field-error { grid-column: 1 / -1; }
.minimum-warning { display: flex; align-items: center; flex-wrap: wrap; gap: 0 var(--space-2); color: var(--danger); font-size: var(--font-xs); }
.suggest-payment { min-height: 2rem; padding: var(--space-1) 0; border: 0; background: transparent; color: var(--text-link); font-size: var(--font-xs); text-decoration: underline; text-underline-offset: 0.2em; }
.field-error { margin: 0; color: var(--danger); font-size: var(--font-xs); line-height: 1.5; }
</style>
