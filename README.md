# Loan Killer

A local, web-first student-loan planner built with Vue 3, TypeScript, and Vite. Track **multiple fixed-rate federal loans already in repayment**, with individual and combined minimum-payment payoff estimates.

## Run locally

```sh
npm ci
npm run dev
```

Use Node.js 22.13+ or 24+ (a current LTS release is recommended). Enter figures from your servicer, or select **Try an example**.

1. Choose the balance date and add your first loan.
2. Select **Add another loan** or **+ Add loan** to enter another without replacing existing loans.
3. Use **All loans** for combined totals, or a loan’s name for its individual chart and schedule. **Edit** selects that loan and focuses the form.
4. Select **Update loan** to apply edits. Save before switching loans; unapplied edits are discarded when switching or canceling.
5. **Remove** asks for confirmation and only removes the selected loan from this planner, not your servicer account.

All balances must come from the **same date**. After adding the first loan, the date is shared and read-only on additional loans. You can change the date while editing the only remaining loan. This avoids combining snapshots from different dates or guessing which payments you already made.

## Features

- Accessible loan entry and field validation.
- Current principal, accrued unpaid interest, fixed rate, monthly minimum, balance date, and next payment date.
- Estimated debt-free date, remaining interest, and total future payments.
- A projected balance chart and payment-by-payment schedule.
- Stable loan identities, editing, confirmed removal, and a loan inventory with individual payoff dates.
- Combined balances, monthly minimums, principal-weighted rate, remaining interest, and an overall debt-free date.
- Combined schedules that respect each loan’s due dates, group payments on the same day, and include interest accruing between due dates on other loans.
- Explicit handling of insufficient payments and the 1,200-payment projection limit.
- Responsive layouts, keyboard focus, and reduced-motion support.

**No account, backend, analytics, or persistence.** Loan details remain in memory in the current tab; refreshing or closing it clears them. The app does not connect to or send payments to your servicer.

## Calculation assumptions

- USD amounts are represented as integer cents.
- Simple interest accrues on principal using `principal × annual rate × actual days / 365`, rounded to cents at each payment. Unpaid interest does not itself accrue interest or automatically become principal.
- Payments cover unpaid accrued interest before principal. The final payment is capped at the balance owed.
- The monthly payment remains fixed until payoff. Due dates stay anchored to the initial next-payment day, clamped for shorter months (January 31 → February 28 → March 31).
- Each loan is simulated independently. No freed payments are rolled into other loans in this minimum-only baseline, so the combined monthly minimum falls as loans are paid off. Allocation and rollover strategies are a later feature.
- Overall payoff is the last loan’s payoff date. Combined remaining interest and future payments are sums of complete individual projections, not an estimate based on an averaged rate. The displayed principal-weighted rate is informational only; if no principal remains, no combined rate is shown.
- Combined schedules group actual payment dates. Between a loan’s due dates, its displayed balance includes simple interest since its previous payment or the common balance date, rounded consistently with the individual calculation.
- **Remaining interest** includes unpaid interest at the balance date plus newly projected interest. **Total future payments** includes both principal and all remaining interest. Neither includes previously paid amounts.
- Subsidized and unsubsidized loans are modeled identically during normal repayment. Subsidy eligibility outside repayment is not modeled.
- No fees, variable rates, capitalization events, deferment, grace periods, income-driven repayment, or forgiveness. This is an estimate, not financial advice or a replacement for a servicer statement. Servicer day-count and rounding rules can differ.
- The projection stops after 1,200 monthly payments. If unpaid, it does not claim a payoff date or complete interest total. An insufficient-payment warning means payments do not cover newly accrued interest over the final 12 simulated payments; other unpaid cases receive a projection-limit warning.
- If any loan fails to pay off within its limit, combined balances and minimums are still shown, but overall payoff, complete interest totals, and the combined chart are withheld. Complete projections for other loans remain available individually.

## Validate

```sh
npm run check      # typecheck, lint, tests, and production build
npm run test:watch
npm run preview    # serve the production build after npm run build
```

Tests cover the single-loan and portfolio engines, dates, form validation, loan creation/editing/removal, and combined/individual views. The calculation engines in `src/domain/loan.ts` and `src/domain/portfolio.ts` are independent of Vue. The chart uses SVG without a charting dependency.

## Feature chunks

1. ✅ Single-loan minimum-payment baseline.
2. ✅ Multiple loans and combined dashboard.
3. ⬜ A hypothetical one-time payment today, targeting a chosen loan.
4. ⬜ Extra monthly payments, including comparison with a combined one-time payment.
5. ⬜ Highest-rate-first versus smallest-balance-first strategies and payoff milestones.

Persistence and actual balance history are intentionally deferred.
