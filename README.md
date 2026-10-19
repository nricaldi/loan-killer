# Loan Killer

A local, web-first student-loan planner built with Vue 3, TypeScript, and Vite. This first feature slice turns **one fixed-rate federal loan already in repayment** into a minimum-payment payoff estimate.

## Run locally

```sh
npm ci
npm run dev
```

Use Node.js 22.13+ or 24+ (a current LTS release is recommended). Enter figures from your servicer, or select **Try an example**. Update the estimate after editing a field.

## This slice includes

- Accessible loan entry and field validation.
- Current principal, accrued unpaid interest, fixed rate, monthly minimum, balance date, and next payment date.
- Estimated debt-free date, remaining interest, and total future payments.
- A projected balance chart and payment-by-payment schedule.
- Explicit handling of insufficient payments and the 1,200-payment projection limit.
- Responsive layouts, keyboard focus, and reduced-motion support.

**No account, backend, analytics, or persistence.** Loan details remain in memory in the current tab; refreshing or closing it clears them. The app does not connect to or send payments to your servicer.

## Calculation assumptions

- USD amounts are represented as integer cents.
- Simple interest accrues on principal using `principal × annual rate × actual days / 365`, rounded to cents at each payment. Unpaid interest does not itself accrue interest or automatically become principal.
- Payments cover unpaid accrued interest before principal. The final payment is capped at the balance owed.
- The monthly payment remains fixed until payoff. Due dates stay anchored to the initial next-payment day, clamped for shorter months (January 31 → February 28 → March 31).
- **Remaining interest** includes unpaid interest at the balance date plus newly projected interest. **Total future payments** includes both principal and all remaining interest. Neither includes previously paid amounts.
- Subsidized and unsubsidized loans are modeled identically during normal repayment. Subsidy eligibility outside repayment is not modeled.
- No fees, variable rates, capitalization events, deferment, grace periods, income-driven repayment, or forgiveness. This is an estimate, not financial advice or a replacement for a servicer statement. Servicer day-count and rounding rules can differ.
- The projection stops after 1,200 monthly payments. If unpaid, it does not claim a payoff date or complete interest total. An insufficient-payment warning means payments do not cover newly accrued interest over the final 12 simulated payments; other unpaid cases receive a projection-limit warning.

## Validate

```sh
npm run check      # typecheck, lint, tests, and production build
npm run test:watch
npm run preview    # serve the production build after npm run build
```

Tests cover the financial engine, dates, form validation, and the complete single-loan flow. The calculation engine in `src/domain/loan.ts` is independent of Vue. The chart uses SVG without a charting dependency.

## Next independently shippable features

1. Multiple loans and combined dashboard.
2. A hypothetical one-time payment today, targeting a chosen loan.
3. Extra monthly payments, including comparison with a combined one-time payment.
4. Highest-rate-first versus smallest-balance-first strategies and payoff milestones.

Persistence and actual balance history are intentionally deferred.
