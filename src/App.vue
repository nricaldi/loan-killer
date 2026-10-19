<script setup lang="ts">
import { computed, ref } from 'vue'
import LoanForm from './components/LoanForm.vue'
import LoanOverview from './components/LoanOverview.vue'
import { projectLoan, type Loan } from './domain/loan'

const loan = ref<Loan | null>(null)
const projection = computed(() => loan.value ? projectLoan(loan.value) : null)
const announcement = computed(() => {
  if (!loan.value || !projection.value) return 'Enter a loan to see your estimate.'
  return projection.value.status === 'paid-off'
    ? `Estimate updated for ${loan.value.name}. ${projection.value.paymentCount} payments remaining.`
    : `Estimate updated for ${loan.value.name}. No payoff within 1,200 monthly payments.`
})
</script>

<template>
  <a class="skip-link" href="#main">Skip to content</a>
  <div class="app-shell">
    <header class="site-header">
      <a class="brand" href="./" aria-label="loankiller. home">
        <span class="brand-icon" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M8 8v17h17M12 12l6 6 8-9" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
        <span>loan<span class="brand-light">killer</span><span class="brand-period">.</span></span>
      </a>
      <div class="header-meta">
        <span class="privacy-dot" aria-hidden="true" /> Personal, not connected to your servicer
      </div>
    </header>

    <main id="main">
      <section class="page-intro" aria-labelledby="page-heading">
        <div>
          <p class="eyebrow">LESS GUESSWORK. MORE CLARITY.</p>
          <h1 id="page-heading">A little clarity.<br class="mobile-break" /> A path to <span>zero.</span></h1>
          <p class="page-description">Understand what you owe, what interest adds, and when you’ll be done.</p>
        </div>
        <div class="chapter-label">
          <span>01</span>
          <div>Your baseline<small>One loan. The full picture.</small></div>
        </div>
      </section>

      <aside class="storage-notice" aria-label="Data storage notice">
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M10 2 3.5 5v4.5c0 4.2 6.5 7.5 6.5 7.5s6.5-3.3 6.5-7.5V5L10 2Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
          <path d="m7 9.5 2 2 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <p><strong>Just in this tab.</strong> Your loan details aren’t uploaded or saved. Refreshing or closing the page clears them.</p>
      </aside>

      <div class="workspace">
        <LoanForm @submit="loan = $event" @reset="loan = null" />
        <LoanOverview v-if="loan && projection" :loan="loan" :projection="projection" />
        <section v-else class="panel empty-state" aria-labelledby="empty-heading">
          <div class="empty-topline">
            <span class="eyebrow">YOUR NEXT CHAPTER</span>
            <span class="empty-tag">START HERE</span>
          </div>
          <div class="empty-art" aria-hidden="true">
            <svg viewBox="0 0 420 200" fill="none">
              <path d="M30 40h360M30 90h360M30 140h360M30 190h360" stroke="currentColor" stroke-opacity="0.15" stroke-dasharray="3 6" />
              <path d="M35 45c40 0 65 20 95 35s50 18 85 43 66 35 95 48 56 18 76 18V190H35V45Z" fill="url(#empty-fill)" />
              <path d="M35 45c40 0 65 20 95 35s50 18 85 43 66 35 95 48 56 18 76 18" stroke="currentColor" stroke-width="3" stroke-dasharray="7 6" stroke-linecap="round" />
              <circle cx="386" cy="189" r="7" fill="var(--surface)" stroke="currentColor" stroke-width="2" />
              <defs>
                <linearGradient id="empty-fill" x1="210" y1="45" x2="210" y2="190" gradientUnits="userSpaceOnUse">
                  <stop stop-color="#c5e4fc" stop-opacity="0.65" />
                  <stop offset="1" stop-color="#c5e4fc" stop-opacity="0.05" />
                </linearGradient>
              </defs>
            </svg>
            <span class="zero-label">$0</span>
          </div>
          <h2 id="empty-heading">There’s a finish line.<br />Let’s find yours.</h2>
          <p>Add your current loan details to see the journey ahead. No accounts, no connecting banks. Just your numbers, made understandable.</p>
          <div class="empty-features">
            <span><i aria-hidden="true">01</i> Your payoff date</span>
            <span><i aria-hidden="true">02</i> The interest ahead</span>
            <span><i aria-hidden="true">03</i> A visible way forward</span>
          </div>
          <div class="empty-bottom"><span aria-hidden="true">←</span> Start with your loan details, or try the example.</div>
        </section>
      </div>

      <section class="assumptions" aria-labelledby="assumptions-heading">
        <div class="assumptions-icon" aria-hidden="true">i</div>
        <div>
          <h2 id="assumptions-heading">A useful estimate, not a servicer statement.</h2>
          <p>
            We model fixed-rate U.S. federal loans already in repayment, with daily simple interest
            (annual rate ÷ 365), rounded to cents at each payment. Payments go to unpaid interest,
            then principal. Your monthly minimum stays fixed; dates follow the next payment’s day
            of the month, adjusted for shorter months. No fees, capitalization, deferment,
            income-driven plans, or forgiveness are modeled. Servicer calculations may differ.
          </p>
          <details>
            <summary>What’s the difference between subsidized and unsubsidized?</summary>
            <p>
              For subsidized loans, the government generally covers interest while you’re enrolled
              at least half-time and during certain other eligible periods. Unsubsidized loans
              generally accrue interest from disbursement. During normal repayment, you’re
              generally responsible for interest on both, so this baseline models them the same way.
            </p>
            <a href="https://studentaid.gov/understand-aid/types/loans/subsidized-unsubsidized" target="_blank" rel="noopener noreferrer">
              Read the federal student aid explanation <span aria-hidden="true">↗</span>
              <span class="sr-only"> (opens in a new tab)</span>
            </a>
          </details>
        </div>
      </section>
      <p class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
    </main>

    <footer class="site-footer">
      <span>loan<span class="brand-light">killer</span>.</span>
      <p>Small steps. A smaller balance. You’ve got this.</p>
      <span class="footer-version">THE BASELINE · V0.1</span>
    </footer>
  </div>
</template>

<style scoped>
.app-shell { max-width: 78rem; margin: 0 auto; padding: 0 var(--space-8); }
.site-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); padding: var(--space-6) 0; border-bottom: 1px solid var(--border); }
.brand { display: flex; align-items: center; gap: var(--space-3); color: var(--text); text-decoration: none; font-size: 1.5rem; letter-spacing: -0.055em; font-weight: 700; }
.brand-icon { width: 2.5rem; height: 2.5rem; display: grid; place-items: center; background: var(--blue-primary); border: 1px solid var(--blue-border); border-radius: var(--radius-md); }
.brand-icon svg { width: 1.75rem; height: 1.75rem; }
.brand-light { font-weight: 400; }
.brand-period { color: var(--chart-line); }
.header-meta { display: flex; align-items: center; gap: var(--space-2); font-size: var(--font-xs); color: var(--text-muted); }
.privacy-dot { width: 0.4rem; height: 0.4rem; border-radius: 50%; background: var(--text-link); }
.page-intro { display: flex; align-items: center; justify-content: space-between; gap: var(--space-6); padding: var(--space-9) 0 var(--space-7); }
h1 { font-size: clamp(2rem, 4.5vw, 3.1rem); font-weight: 550; line-height: 1.2; letter-spacing: -0.05em; margin: var(--space-3) 0 var(--space-4); }
h1 > span { position: relative; white-space: nowrap; z-index: 0; }
h1 > span::after { position: absolute; content: ''; height: 0.32em; bottom: 0.05em; left: -0.02em; right: -0.08em; background: var(--blue-primary); z-index: -1; transform: rotate(-2deg); }
.page-description { color: var(--text-muted); font-size: var(--font-sm); line-height: 1.75; margin: 0; }
.mobile-break { display: none; }
.chapter-label { display: flex; gap: var(--space-4); align-items: center; flex-shrink: 0; padding-left: var(--space-6); border-left: 1px solid var(--border-strong); }
.chapter-label > span { font-size: 2.25rem; color: var(--text-placeholder); font-weight: 300; letter-spacing: -0.05em; }
.chapter-label > div { font-size: var(--font-sm); font-weight: 600; }
.chapter-label small { display: block; margin-top: var(--space-2); color: var(--text-muted); font-weight: 400; font-size: var(--font-xs); }
.storage-notice { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-6); padding: var(--space-3) var(--space-4); background: var(--blue-light); border: 1px solid var(--blue-border); border-radius: var(--radius-sm); }
.storage-notice svg { width: 1.15rem; height: 1.15rem; flex-shrink: 0; color: var(--text-link); }
.storage-notice p { margin: 0; color: var(--text-secondary); font-size: var(--font-xs); line-height: 1.7; }
.storage-notice strong { font-weight: 600; }
.workspace { display: grid; grid-template-columns: minmax(20rem, 0.85fr) minmax(0, 1.6fr); align-items: start; gap: var(--space-6); }
.empty-state { padding: var(--space-7); min-height: 44rem; display: flex; flex-direction: column; align-items: center; text-align: center; overflow: hidden; }
.empty-topline { align-self: stretch; display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); }
.empty-tag { font-size: 0.6rem; color: var(--text-muted); border: 1px solid var(--border); padding: 0.35rem var(--space-2); border-radius: var(--radius-sm); letter-spacing: 0.08em; }
.empty-art { position: relative; color: var(--chart-line); width: 100%; max-width: 26rem; margin: var(--space-8) 0 var(--space-6); padding-right: var(--space-4); }
.empty-art svg { display: block; width: 100%; height: auto; }
.zero-label { position: absolute; right: 0; bottom: -0.25rem; background: var(--blue-light); border: 1px solid var(--blue-border); border-radius: var(--radius-full); padding: 0.4rem 0.6rem; color: var(--text-link); font-size: var(--font-xs); font-weight: 600; }
.empty-state h2 { font-size: clamp(1.75rem, 3vw, 2.3rem); font-weight: 500; line-height: 1.3; letter-spacing: -0.045em; }
.empty-state > p { max-width: 24rem; color: var(--text-muted); font-size: var(--font-sm); line-height: 1.9; margin: var(--space-4) 0 var(--space-6); }
.empty-features { display: flex; flex-direction: column; gap: var(--space-4); text-align: left; font-size: var(--font-sm); }
.empty-features > span { display: flex; align-items: center; gap: var(--space-3); }
.empty-features i { font-style: normal; font-size: var(--font-xs); color: var(--text-link); background: var(--blue-light); border: 1px solid var(--blue-border); width: 1.8rem; height: 1.8rem; display: grid; place-items: center; border-radius: 50%; }
.empty-bottom { margin-top: auto; padding-top: var(--space-7); color: var(--text-muted); font-size: var(--font-xs); line-height: 1.7; }
.empty-bottom > span { margin-right: var(--space-2); }
.assumptions { display: flex; gap: var(--space-3); max-width: 60rem; margin: var(--space-8) 0; }
.assumptions-icon { display: grid; place-items: center; flex-shrink: 0; width: 1.1rem; height: 1.1rem; margin-top: 0.1rem; border-radius: 50%; border: 1px solid var(--text-muted); color: var(--text-muted); font-size: var(--font-xs); }
.assumptions h2 { font-size: var(--font-xs); font-weight: 600; }
.assumptions p { color: var(--text-muted); font-size: var(--font-xs); line-height: 1.8; margin: var(--space-2) 0 0; }
.assumptions details { margin-top: var(--space-3); font-size: var(--font-xs); line-height: 1.8; }
.assumptions summary { cursor: pointer; color: var(--text-secondary); }
.assumptions a { display: inline-block; margin-top: var(--space-2); color: var(--text-link); }
.site-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-4); border-top: 1px solid var(--border); padding: var(--space-6) 0; color: var(--text-muted); }
.site-footer > span:first-child { font-weight: 600; font-size: var(--font-md); letter-spacing: -0.04em; }
.site-footer p { font-size: var(--font-xs); margin: 0; }
.footer-version { font-size: 0.6rem; letter-spacing: 0.1em; }
@media (max-width: 65rem) { .app-shell { padding-inline: var(--space-6); } .workspace { grid-template-columns: minmax(19rem, 0.9fr) minmax(0, 1.3fr); gap: var(--space-4); } .chapter-label { display: none; } }
@media (max-width: 52rem) { .workspace { grid-template-columns: 1fr; } .empty-state { min-height: auto; padding-block: var(--space-6); } .empty-art { margin-block: var(--space-5); max-width: 20rem; } .empty-bottom { padding-top: var(--space-6); } .empty-features { flex-direction: row; flex-wrap: wrap; justify-content: center; font-size: var(--font-xs); } }
@media (max-width: 35rem) { .app-shell { padding-inline: var(--space-4); } .site-header { padding-block: var(--space-4); } .header-meta { display: none; } .page-intro { padding-block: var(--space-7) var(--space-6); } .mobile-break { display: block; } .empty-state { padding-inline: var(--space-4); } .footer-version { display: none; } .site-footer { justify-content: center; } }
</style>
