<script setup lang="ts">
import { computed } from 'vue'
import { buildPayoffTimeline, type MilestoneLoan } from '../domain/payoffMilestones'
import type { PortfolioProjection } from '../domain/portfolio'
import { dateDistance, formatDate, money } from '../format'

const props = defineProps<{ portfolio: PortfolioProjection; baseline: PortfolioProjection; planLabel: string }>()
const timeline = computed(() => buildPayoffTimeline(props.portfolio, props.baseline))

function timing(loan: MilestoneLoan, date: string): string {
  if (loan.daysSaved === null || !loan.baselinePayoffDate) return 'Baseline payoff unavailable'
  if (loan.daysSaved === 0) return 'Same payoff date as baseline'
  return `${dateDistance(date, loan.baselinePayoffDate)} ${loan.daysSaved > 0 ? 'sooner' : 'later'} than baseline`
}
</script>

<template>
  <section class="milestones" aria-labelledby="milestones-heading" data-testid="payoff-milestones">
    <div class="milestone-heading">
      <div><p class="eyebrow">ONE LOAN AT A TIME</p><h3 id="milestones-heading">Your projected payoff milestones</h3></div>
      <span class="projection-label">PROJECTED · NOT ACTUAL PROGRESS</span>
    </div>
    <p class="milestone-intro">{{ planLabel }}. This is the order loans are projected to reach zero, not necessarily the order extra money targets them. Loans paid off on the same date share a milestone.</p>

    <ol v-if="timeline.milestones.length" class="milestone-list">
      <li v-for="(milestone, index) in timeline.milestones" :key="milestone.date" class="milestone" :class="{ 'finish-milestone': milestone.remainingLoans === 0 }" :data-milestone-date="milestone.date">
        <span class="milestone-number" aria-hidden="true">{{ index + 1 }}</span>
        <div class="milestone-body">
          <div class="milestone-topline">
            <h4><time :datetime="milestone.date">{{ formatDate(milestone.date) }}</time></h4>
            <span class="remaining-label">{{ milestone.remainingLoans === 0 ? 'Projected debt-free' : `${milestone.remainingLoans} ${milestone.remainingLoans === 1 ? 'loan' : 'loans'} remaining` }}</span>
          </div>
          <p class="milestone-summary">{{ milestone.loans.length }} {{ milestone.loans.length === 1 ? 'loan reaches' : 'loans reach' }} zero.</p>
          <ul class="milestone-loans">
            <li v-for="loan in milestone.loans" :key="loan.id" :data-milestone-loan-id="loan.id">
              <strong>{{ loan.name }}</strong>
              <p>{{ timing(loan, milestone.date) }}<span v-if="loan.baselinePayoffDate"> · Baseline {{ formatDate(loan.baselinePayoffDate) }}</span></p>
              <p>Original minimum: {{ money(loan.originalMinimumCents) }} / month</p>
            </li>
          </ul>
        </div>
      </li>
    </ol>
    <p v-else class="unresolved-note">None of these loans reaches zero within the projection window at these payments.</p>

    <div v-if="timeline.unresolved.length" class="unresolved-note" data-testid="unresolved-milestones">
      <h4>Still beyond the projection limit</h4>
      <p>No payoff date or completed milestone is invented for these loans:</p>
      <ul><li v-for="loan in timeline.unresolved" :key="loan.id">{{ loan.name }}</li></ul>
    </div>
    <p class="milestone-footnote">These dates are estimates, not payments you’ve made. Original minimums are shown for reference; in monthly plans, freed minimums roll over on their original due dates, not necessarily on the payoff date itself.</p>
  </section>
</template>

<style scoped>
.milestones { margin-top: var(--space-7); border-top: 1px solid var(--border); padding-top: var(--space-6); }
.milestone-heading, .milestone-topline { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--space-3); }
h3, h4 { margin: 0; font-size: var(--font-md); font-weight: 600; line-height: 1.6; }
.projection-label { border: 1px solid var(--blue-border); border-radius: var(--radius-full); padding: var(--space-2) var(--space-3); color: var(--text-link); font-size: 0.6rem; letter-spacing: 0.05em; background: var(--blue-light); }
.milestone-intro, .milestone-footnote, .milestone-summary, .milestone-loans p, .unresolved-note { font-size: var(--font-xs); color: var(--text-muted); line-height: 1.8; }
.milestone-intro { margin: var(--space-3) 0 var(--space-5); }
.milestone-list, .milestone-loans { list-style: none; margin: 0; padding: 0; }
.milestone { display: grid; grid-template-columns: 2rem minmax(0, 1fr); gap: var(--space-4); position: relative; padding-bottom: var(--space-5); }
.milestone:not(:last-child)::before { content: ''; position: absolute; left: 0.95rem; top: 2rem; bottom: 0; border-left: 1px dashed var(--blue-border); }
.milestone-number { display: grid; place-items: center; width: 2rem; height: 2rem; border: 1px solid var(--blue-border); border-radius: 50%; background: var(--blue-light); color: var(--text-link); font-size: var(--font-xs); }
.milestone-body { min-width: 0; border: 1px solid var(--border); border-radius: var(--radius-md); padding: var(--space-4); }
.finish-milestone .milestone-body { background: var(--blue-light); border-color: var(--blue-border); }
.remaining-label { color: var(--text-link); font-size: var(--font-xs); font-weight: 600; }
.milestone-summary { margin: var(--space-2) 0 var(--space-3); }
.milestone-loans > li + li { border-top: 1px solid var(--border); margin-top: var(--space-3); padding-top: var(--space-3); }
.milestone-loans strong { font-size: var(--font-sm); font-weight: 600; overflow-wrap: anywhere; }
.milestone-loans p { margin: var(--space-1) 0 0; }
.milestone-footnote { margin: var(--space-3) 0 0; }
.unresolved-note { border: 1px solid var(--border); background: var(--surface-muted); border-radius: var(--radius-md); padding: var(--space-4); }
.unresolved-note h4 { font-size: var(--font-sm); }
.unresolved-note p { margin-bottom: var(--space-2); }
.unresolved-note ul { padding-left: var(--space-5); margin: 0; overflow-wrap: anywhere; }
@media (max-width: 35rem) { .milestone { gap: var(--space-2); grid-template-columns: 1.75rem minmax(0, 1fr); } .milestone-number { width: 1.75rem; height: 1.75rem; } .milestone:not(:last-child)::before { left: 0.8rem; top: 1.75rem; } }
</style>
