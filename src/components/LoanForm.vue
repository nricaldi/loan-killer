<script setup lang="ts">
import { computed, nextTick, reactive, ref } from 'vue'
import { addMonths, today } from '../domain/dates'
import type { Loan } from '../domain/loan'
import { validateLoanForm, type FormErrors, type LoanFormValues } from '../domain/loanForm'

const props = defineProps<{
  initialLoan?: Loan | null
  sharedBalanceDate?: string
  fromExample?: boolean
}>()
const emit = defineEmits<{ submit: [loan: Loan, fromExample: boolean]; cancel: [] }>()

function emptyValues(): LoanFormValues {
  return {
    name: '',
    type: 'unsubsidized',
    principal: '',
    accruedInterest: '0',
    annualRate: '',
    monthlyPayment: '',
    balanceDate: props.sharedBalanceDate ?? today(),
    nextPaymentDate: addMonths(props.sharedBalanceDate ?? today(), 1),
  }
}

const initialValues: LoanFormValues = props.initialLoan ? {
  name: props.initialLoan.name,
  type: props.initialLoan.type,
  principal: (props.initialLoan.principalCents / 100).toFixed(2),
  accruedInterest: (props.initialLoan.accruedInterestCents / 100).toFixed(2),
  annualRate: String(props.initialLoan.annualRatePercent),
  monthlyPayment: (props.initialLoan.monthlyPaymentCents / 100).toFixed(2),
  balanceDate: props.initialLoan.balanceDate,
  nextPaymentDate: props.initialLoan.nextPaymentDate,
} : emptyValues()
const values = reactive<LoanFormValues>(initialValues)
const errors = ref<FormErrors>({})
const form = ref<HTMLFormElement | null>(null)
const savedValues = ref<string | null>(props.initialLoan ? JSON.stringify(values) : null)
const exampleLoaded = ref(props.fromExample ?? false)
const hasChanges = computed(() => savedValues.value !== null && savedValues.value !== JSON.stringify(values))

async function submit() {
  const result = validateLoanForm(values, props.sharedBalanceDate)
  errors.value = result.errors
  if (!result.loan) {
    await nextTick()
    form.value?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    return
  }
  savedValues.value = JSON.stringify(values)
  emit('submit', result.loan, exampleLoaded.value)
}

function useExample() {
  Object.assign(values, {
    name: 'My federal student loan',
    type: 'unsubsidized',
    principal: '18000',
    accruedInterest: '75',
    annualRate: '5.5',
    monthlyPayment: '200',
    balanceDate: props.sharedBalanceDate ?? today(),
    nextPaymentDate: addMonths(props.sharedBalanceDate ?? today(), 1),
  } satisfies LoanFormValues)
  exampleLoaded.value = true
  void submit()
}
</script>

<template>
  <section class="panel loan-panel" aria-labelledby="loan-details-heading">
    <div class="panel-heading">
      <div>
        <p class="eyebrow">LOAN DETAILS</p>
        <h2 id="loan-details-heading">{{ initialLoan ? 'Edit loan' : 'Add a loan' }}</h2>
      </div>
    </div>
    <p class="intro">A few numbers from your servicer. A much clearer picture.</p>
    <button v-if="!initialLoan" class="example-button" type="button" @click="useExample">Just exploring? Try an example <span aria-hidden="true">↗</span></button>
    <p v-if="exampleLoaded" class="example-notice" role="status">Example figures loaded. Replace them with your own for a personal estimate.</p>

    <form ref="form" novalidate @submit.prevent="submit">
      <div class="field">
        <label for="loan-name">Loan name</label>
        <input
          id="loan-name"
          v-model="values.name"
          name="name"
          type="text"
          placeholder="e.g. Direct Loan 01"
          maxlength="80"
          required
          :aria-invalid="!!errors.name"
          :aria-describedby="errors.name ? 'name-error' : undefined"
        />
        <p v-if="errors.name" id="name-error" class="field-error">{{ errors.name }}</p>
      </div>

      <div class="field">
        <label for="loan-type">Federal loan type</label>
        <select
          id="loan-type"
          v-model="values.type"
          name="type"
          :aria-invalid="!!errors.type"
          aria-describedby="type-help"
        >
          <option value="unsubsidized">Direct Unsubsidized</option>
          <option value="subsidized">Direct Subsidized</option>
        </select>
        <p id="type-help" class="field-hint">Both accrue interest during normal repayment.</p>
        <p v-if="errors.type" class="field-error">{{ errors.type }}</p>
      </div>

      <div class="field-row">
        <div class="field">
          <label for="principal">Current principal</label>
          <div class="input-affix">
            <span aria-hidden="true">$</span>
            <input
              id="principal"
              v-model="values.principal"
              name="principal"
              type="text"
              inputmode="decimal"
              placeholder="18000.00"
              required
              :aria-invalid="!!errors.principal"
              :aria-describedby="errors.principal ? 'principal-error principal-help' : 'principal-help'"
            />
          </div>
          <p v-if="errors.principal" id="principal-error" class="field-error">{{ errors.principal }}</p>
        </div>
        <div class="field">
          <label for="accrued-interest">Unpaid interest</label>
          <div class="input-affix">
            <span aria-hidden="true">$</span>
            <input
              id="accrued-interest"
              v-model="values.accruedInterest"
              name="accruedInterest"
              type="text"
              inputmode="decimal"
              required
              :aria-invalid="!!errors.accruedInterest"
              :aria-describedby="errors.accruedInterest ? 'interest-error principal-help' : 'principal-help'"
            />
          </div>
          <p v-if="errors.accruedInterest" id="interest-error" class="field-error">{{ errors.accruedInterest }}</p>
        </div>
      </div>
      <p id="principal-help" class="field-hint balance-help">Enter principal and accrued interest separately, not the combined balance. Use numbers without commas.</p>

      <div class="field-row">
        <div class="field">
          <label for="annual-rate">Fixed interest rate</label>
          <div class="input-affix suffix">
            <input
              id="annual-rate"
              v-model="values.annualRate"
              name="annualRate"
              type="text"
              inputmode="decimal"
              placeholder="5.5"
              required
              :aria-invalid="!!errors.annualRate"
              :aria-describedby="errors.annualRate ? 'rate-error' : undefined"
            />
            <span aria-hidden="true">%</span>
          </div>
          <p v-if="errors.annualRate" id="rate-error" class="field-error">{{ errors.annualRate }}</p>
        </div>
        <div class="field">
          <label for="monthly-payment">Monthly minimum</label>
          <div class="input-affix">
            <span aria-hidden="true">$</span>
            <input
              id="monthly-payment"
              v-model="values.monthlyPayment"
              name="monthlyPayment"
              type="text"
              inputmode="decimal"
              placeholder="200.00"
              required
              :aria-invalid="!!errors.monthlyPayment"
              :aria-describedby="errors.monthlyPayment ? 'payment-error payment-help' : 'payment-help'"
            />
          </div>
          <p v-if="errors.monthlyPayment" id="payment-error" class="field-error">{{ errors.monthlyPayment }}</p>
          <p id="payment-help" class="field-hint">Enter $0 if nothing is currently required. Estimates assume this minimum stays the same until you update it; interest may still accrue.</p>
        </div>
      </div>

      <div class="field-row date-row">
        <div class="field">
          <label for="balance-date">Balance as of</label>
          <input
            id="balance-date"
            v-model="values.balanceDate"
            name="balanceDate"
            type="date"
            min="1900-01-01"
            max="2100-12-31"
            required
            :readonly="!!sharedBalanceDate"
            :aria-invalid="!!errors.balanceDate"
            :aria-describedby="errors.balanceDate ? 'balance-date-error balance-date-help' : 'balance-date-help'"
          />
          <p id="balance-date-help" class="field-hint">{{ sharedBalanceDate ? 'Matches your other loans. Use balances from this same date.' : 'Use this date for all loan balances.' }}</p>
          <p v-if="errors.balanceDate" id="balance-date-error" class="field-error">{{ errors.balanceDate }}</p>
        </div>
        <div class="field">
          <label for="next-payment-date">Next payment</label>
          <input
            id="next-payment-date"
            v-model="values.nextPaymentDate"
            name="nextPaymentDate"
            type="date"
            :min="values.balanceDate || '1900-01-01'"
            max="2100-12-31"
            required
            :aria-invalid="!!errors.nextPaymentDate"
            :aria-describedby="errors.nextPaymentDate ? 'next-date-error' : undefined"
          />
          <p v-if="errors.nextPaymentDate" id="next-date-error" class="field-error">{{ errors.nextPaymentDate }}</p>
        </div>
      </div>

      <p v-if="Object.keys(errors).length" class="form-message field-error" role="alert">Check the highlighted fields to calculate your estimate.</p>
      <p v-else-if="hasChanges" class="form-message" role="status">You have changes. Update to refresh your estimate.</p>
      <div class="form-actions">
        <button class="primary-button" type="submit">{{ initialLoan ? 'Update loan' : 'Add loan' }} <span aria-hidden="true">→</span></button>
        <button class="text-button" type="button" @click="emit('cancel')">Cancel</button>
      </div>
      <p class="form-footnote">Fixed-rate loans already in repayment. Changes apply only when saved.</p>
    </form>
  </section>
</template>

<style scoped>
.loan-panel { padding: var(--space-6); border: 0; box-shadow: none; }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.panel-heading { padding-right: var(--space-9); }
.intro { margin: var(--space-3) 0 var(--space-4); color: var(--text-muted); font-size: var(--font-sm); line-height: 1.65; }
.example-button { color: var(--text-link); background: var(--blue-light); width: 100%; padding: var(--space-3); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); font-size: var(--font-sm); font-weight: 600; text-align: left; display: flex; justify-content: space-between; gap: var(--space-2); }
.example-button:hover { background: var(--blue-primary); }
.example-notice { margin-top: var(--space-3); font-size: var(--font-xs); color: var(--text-muted); line-height: 1.6; }
form { margin-top: var(--space-6); }
.field { min-width: 0; margin-bottom: var(--space-4); }
.field-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); }
label { display: block; margin-bottom: var(--space-2); font-size: var(--font-xs); font-weight: 650; }
input, select { width: 100%; min-width: 0; min-height: 2.75rem; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text); padding: 0.7rem var(--space-3); font: inherit; font-size: var(--font-sm); }
select { padding-right: var(--space-5); }
input::placeholder { color: var(--text-placeholder); opacity: 1; }
input[aria-invalid='true'], select[aria-invalid='true'] { border-color: var(--danger); }
.input-affix { position: relative; }
.input-affix > span { position: absolute; top: 50%; left: var(--space-3); transform: translateY(-50%); color: var(--text-muted); font-size: var(--font-sm); pointer-events: none; }
.input-affix input { padding-left: 1.7rem; }
.suffix input { padding-left: var(--space-3); padding-right: 1.8rem; }
.suffix > span { left: auto; right: var(--space-3); }
.field-hint { margin: var(--space-2) 0 0; color: var(--text-muted); font-size: var(--font-xs); line-height: 1.6; }
.balance-help { margin-top: calc(-1 * var(--space-2)); margin-bottom: var(--space-5); }
.field-error { color: var(--danger); font-size: var(--font-xs); line-height: 1.6; margin: var(--space-2) 0 0; }
.date-row input { padding-inline: var(--space-2); font-size: var(--font-xs); }
.form-message { margin: 0 0 var(--space-3); font-size: var(--font-xs); line-height: 1.6; }
.form-actions { display: flex; align-items: center; gap: var(--space-4); }
.primary-button { flex: 1; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.form-footnote { margin: var(--space-3) 0 0; text-align: center; color: var(--text-muted); font-size: var(--font-xs); }
@media (max-width: 25rem) { .loan-panel { padding: var(--space-4); } .field-row { grid-template-columns: 1fr; gap: 0; } }
</style>
