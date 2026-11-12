<script setup lang="ts">
import { vZeroOnFocus } from '../directives/zeroOnFocus'
import { computed, ref, useId, watch } from 'vue'
import { parseMoney } from '../domain/loanForm'
import type { LoanRecord } from '../domain/portfolio'
import { money } from '../format'
import { projectLoan } from '../domain/loan'
import { paymentWarning } from '../domain/paymentWarning'

const props = defineProps<{ loan: LoanRecord; selected: boolean }>()
const emit = defineEmits<{ select: []; payment: [cents: number] }>()
const id = useId()
const amount = ref((props.loan.monthlyPaymentCents / 100).toFixed(2))
const cents = computed(() => parseMoney(amount.value))
const invalid = computed(() => cents.value === null)

const minimumWarning = computed(() => cents.value === null ? null
  : paymentWarning(projectLoan({ ...props.loan, monthlyPaymentCents: cents.value })))

watch(() => props.loan.monthlyPaymentCents, (value) => {
  if (parseMoney(amount.value) !== value) amount.value = (value / 100).toFixed(2)
})

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
    <div class="chip-header">
      <button class="chip-name" type="button" :aria-label="`View ${loan.name}`" :aria-pressed="selected" @click="emit('select')">{{ loan.name }}</button>
      <slot name="actions" />
    </div>
    <p class="chip-balance"><strong>{{ money(loan.principalCents + loan.accruedInterestCents) }}</strong></p>
    <p class="chip-rate">{{ loan.annualRatePercent }}% fixed<span v-if="loan.fromExample"> · From example</span></p>
    <div class="chip-payment">
      <label :for="`${id}-payment`">Min. / month</label>
      <div class="payment-input"><span aria-hidden="true">$</span><input :id="`${id}-payment`" v-zero-on-focus :value="amount" type="text" inputmode="decimal" :aria-label="`Monthly minimum for ${loan.name}`" :class="{ 'payment-warning': minimumWarning }" :aria-invalid="invalid" :aria-describedby="invalid ? `${id}-error` : minimumWarning ? `${id}-warning` : 'loan-payment-help'" @input="updatePayment" /></div>
    </div>
    <p v-if="invalid" :id="`${id}-error`" class="field-error" role="status">Use $0–$10,000,000, up to 2 decimals. Estimate uses the last valid minimum.</p>
    <details v-if="minimumWarning" :id="`${id}-warning`" class="minimum-warning">
      <summary>{{ minimumWarning.title }}</summary>
      <p>{{ minimumWarning.detail }}</p>
    </details>
    <slot />
  </div>
</template>

<style scoped>
.loan-chip { display: grid; grid-template-columns: minmax(0, 1fr) minmax(7rem, auto) 11rem; gap: var(--space-1) var(--space-4); align-items: center; height: 100%; min-width: 0; padding: var(--space-3); background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-md); }
.loan-chip.selected { border-color: var(--chart-line); background: var(--blue-light); }
.chip-header { grid-column: 1; grid-row: 1; display: flex; align-items: center; justify-content: space-between; gap: var(--space-1); }
.chip-name { flex: 1; min-width: 0; padding: 0; min-height: var(--size-icon-button); border: 0; background: transparent; color: var(--text-link); text-align: left; font-size: var(--font-sm); font-weight: 650; overflow-wrap: anywhere; }
.chip-name[aria-pressed='true'] { text-decoration: underline; text-underline-offset: 0.25em; }
.chip-balance { grid-column: 2; grid-row: 1 / span 2; margin: var(--space-1) 0; }
.chip-balance strong { font-size: var(--font-lg); font-variant-numeric: tabular-nums; letter-spacing: -0.03em; overflow-wrap: anywhere; }
.chip-rate { font-size: var(--font-xs); color: var(--text-secondary); line-height: 1.6; }
.chip-rate { grid-column: 1; grid-row: 2; margin: 0; }
.chip-payment { grid-column: 3; grid-row: 1 / span 2; display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-1); }
label { font-size: var(--font-xs); color: var(--text-secondary); white-space: nowrap; flex-shrink: 0; }
.payment-input { position: relative; flex: 1; min-width: 0; }
.payment-input span { position: absolute; left: var(--space-2); top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-size: var(--font-xs); pointer-events: none; }
input { width: 100%; min-height: 2.75rem; padding: var(--space-2) var(--space-2) var(--space-2) 1.3rem; background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font-size: var(--font-sm); font-variant-numeric: tabular-nums; }
input.payment-warning, input[aria-invalid='true'] { border-color: var(--danger); }
.field-error { margin: var(--space-2) 0 0; font-size: var(--font-xs); color: var(--danger); line-height: 1.5; }
@media (max-width: 60rem) {
  /* iOS Safari zooms focused fields when their text is smaller than 16px. */
  input { font-size: var(--font-md); }
}
.loan-chip :slotted(.remove-confirmation) { grid-column: 1 / -1; }
.minimum-warning, .field-error { grid-column: 1 / -1; }
.minimum-warning { color: var(--danger); font-size: var(--font-sm); }
.minimum-warning summary { cursor: pointer; }
.minimum-warning p { margin: var(--space-2) 0 0; line-height: 1.5; }
@media (max-width: 45rem) {
  .loan-chip { grid-template-columns: minmax(0, 1fr) 9rem; gap: var(--space-1) var(--space-3); }
  .chip-header { grid-column: 1 / -1; }
  .chip-balance { grid-column: 1; grid-row: 2; }
  .chip-rate { grid-column: 1; grid-row: 3; }
  .chip-payment { grid-column: 2; grid-row: 2 / span 2; flex-direction: column; align-items: stretch; gap: var(--space-1); }
}
</style>
