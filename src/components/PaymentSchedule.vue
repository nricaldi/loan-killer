<script setup lang="ts">
import type { Payment } from '../domain/loan'
import { formatDate, money } from '../format'

defineProps<{ payments: Payment[]; combined?: boolean }>()
</script>

<template>
  <details class="schedule">
    <summary>See the payment-by-payment breakdown <span class="payment-count">{{ payments.length }} {{ combined ? 'payment dates' : 'payments' }}</span></summary>
    <div class="table-scroll" role="region" aria-label="Payment schedule, scroll horizontally if needed" tabindex="0">
      <table>
        <caption>Projected payments. {{ combined ? 'Payments on the same date are grouped. ' : '' }}Remaining balance includes unpaid interest{{ combined ? ' on every loan, including between due dates' : '' }}.</caption>
        <thead>
          <tr><th scope="col">Date</th><th scope="col">Payment</th><th scope="col">To interest</th><th scope="col">To principal</th><th scope="col">Balance</th></tr>
        </thead>
        <tbody>
          <tr v-for="(payment, index) in payments" :key="`${payment.date}-${index}`">
            <th scope="row">{{ formatDate(payment.date) }} <span v-if="payment.kind !== 'scheduled'" class="extra-tag">{{ payment.kind === 'extra' ? 'Extra payment' : payment.kind === 'monthly-extra' ? 'Monthly extra / rollover' : 'Includes extra' }}</span></th>
            <td>{{ money(payment.paymentCents) }}</td>
            <td>{{ money(payment.interestPaidCents) }}</td>
            <td>{{ money(payment.principalPaidCents) }}</td>
            <td>{{ money(payment.balanceCents) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </details>
</template>

<style scoped>
.schedule { border-top: 1px solid var(--border); margin-top: var(--space-6); }
summary { padding-top: var(--space-5); font-size: var(--font-sm); font-weight: 600; cursor: pointer; line-height: 1.7; }
.payment-count { margin-left: var(--space-2); font-size: var(--font-xs); color: var(--text-muted); font-weight: 400; white-space: nowrap; }
.table-scroll { overflow: auto; max-height: 26rem; margin-top: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-sm); }
table { width: 100%; border-collapse: collapse; font-size: var(--font-xs); font-variant-numeric: tabular-nums; }
caption { text-align: left; padding: var(--space-3); color: var(--text-muted); line-height: 1.5; }
th, td { padding: var(--space-3); text-align: right; white-space: nowrap; border-top: 1px solid var(--border); }
th:first-child { text-align: left; }
thead th { background: var(--surface-muted); position: sticky; top: 0; }
tbody th { font-weight: 400; }
tbody tr:last-child { background: var(--blue-light); }
.extra-tag { display: inline-block; margin-left: var(--space-2); padding: var(--space-1) var(--space-2); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); background: var(--blue-light); color: var(--text-link); font-size: 0.65rem; }
</style>
