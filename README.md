# Loan Killer

A local, web-first student-loan planner built with Vue 3, TypeScript, and Vite. Track **multiple fixed-rate federal loans already in repayment** and compare minimum payments, a one-time payment today, increased monthly payments, or both.

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
6. Select **What if I pay extra?**, choose a one-time target and amount, and set an extra monthly amount using the slider or exact amount field. Use 0 to leave either out, then **Compare payment**. Your saved loan figures and baseline remain unchanged.
7. All four plans show payoff dates, interest, total payments, and savings. Use a plan’s **View** button to inspect its curve against the baseline and its payment schedule. Monthly-only is selected by default when only monthly extra is positive; both positive selects the combined plan.

All balances must come from the **same date**. After adding the first loan, the date is shared and read-only on additional loans. You can change the date while editing the only remaining loan. This avoids combining snapshots from different dates or guessing which payments you already made.

## Features

- Accessible loan entry and field validation.
- Current principal, accrued unpaid interest, fixed rate, monthly minimum, balance date, and next payment date.
- Estimated debt-free date, remaining interest, and total future payments.
- A projected balance chart and payment-by-payment schedule.
- Stable loan identities, editing, confirmed removal, and a loan inventory with individual payoff dates.
- Combined balances, monthly minimums, principal-weighted rate, remaining interest, and an overall debt-free date.
- Combined schedules that respect each loan’s due dates, group payments on the same day, and include interest accruing between due dates on other loans.
- A one-time payment simulator with interest/principal allocation, unused-overpayment handling, payoff and interest comparisons, overlaid balance curves, and a scenario schedule.
- Extra monthly payments with a slider, exact cents entry, a visible starting monthly budget, highest-rate-first allocation, and freed-minimum rollover.
- A four-plan comparison: minimums, one-time only, monthly only, and combined; each has its own complete-or-unavailable payoff estimates.
- Both the selected loan’s payoff change and the whole plan’s payoff change, so an earlier individual payoff isn’t mistaken for an earlier overall debt-free date.
- Explicit handling of insufficient payments and the 1,200-payment projection limit.
- Responsive layouts, keyboard focus, and reduced-motion support.

**No account, backend, analytics, or persistence.** Loan details remain in memory in the current tab; refreshing or closing it clears them. The app does not connect to or send payments to your servicer.

## Extra payment today

- The payment date is your browser’s local date, refreshed when you submit the comparison. It is not backdated to the loan’s balance snapshot.
- A snapshot from an earlier date is supported when every loan’s next payment is still today or later. Interest accrues through today before the extra payment is applied. Future snapshots and past next-payment dates block the scenario; the app does not guess which earlier payments happened.
- The selected loan receives the payment only. Interest already owed, including interest accrued through today, is paid before principal.
- Scheduled minimums and due dates continue unchanged unless the loan is fully paid off. The extra payment happens before scheduled payments on the same day. We do not model paid-ahead status or skipped minimums; check your servicer’s overpayment instructions.
- An oversized payment is capped at the selected loan’s payoff balance. The unused portion is displayed, not paid, not redirected, and not included in total payments. Entering zero produces an unchanged comparison without an extra rounding event.
- Both plans’ total payments include all payments from the shared balance snapshot, including the **applied** one-time payment in the scenario. Interest savings are the difference in complete interest totals, not the lump sum itself. Paying a zero-interest loan sooner may save time without saving interest.
- Time changes use actual calendar dates, with calendar years/months/days rather than assuming 30-day months. If another loan takes longer, the overall date may stay unchanged even when the selected loan finishes earlier.
- If either plan has no complete payoff estimate, full interest and time savings are unavailable. A complete scenario can still be displayed even if the baseline does not pay off within its limit; unknown savings are never presented as infinite or zero.
- Per-payment rounding can create a small additional-interest difference for a tiny extra payment. Negative savings are preserved and explicitly labeled as additional interest.
- Edit the amount or target and select **Update comparison** to refresh results. **Clear scenario** removes it. Adding, updating, or removing a saved loan clears the scenario to prevent stale targets and estimates. Switching between loan views does not clear it.

## Extra monthly payments

- The monthly amount is **one additional budget across the plan**, not an extra payment for every loan. It begins on the earliest entered next-payment date and recurs on that original day, clamped for shorter months (January 31 → February 28 → March 31).
- Every loan still gets its minimum on its own entered due dates, unless already paid off. On a shared payment date the order is: one-time payment, all minimums due that day, then the extra/rollover pool.
- Extra and freed budget goes to the active loan with the highest nominal interest rate, covering interest before principal. Equal rates use stable loan IDs as the tie-breaker. A paid-off target passes the remainder to the next active loan on the same day.
- A positive monthly increase enables rollover: the original minimum for a paid-off loan becomes available on each of that loan’s original monthly due dates. The unused portion of a final minimum also becomes available that same day. Minimums due on other dates are not spent early or skipped.
- This maintains the starting minimum-payment budget plus the extra monthly amount as loans finish. Available cash follows the entered due dates; initial and final partial cycles can spend less. All actual payments are capped at amounts owed, with no unused final budget counted as spending or carried forward after all loans are paid off.
- **Minimum-only and one-time-only plans do not roll over payments.** With $0 extra monthly, the monthly plan exactly matches the baseline and the combined plan exactly matches one-time only; zero does not silently enable a rollover-only strategy.
- The one-time target dropdown only affects the lump sum. It does not override monthly highest-rate allocation. Unused one-time overpayment is never redirected, including in the combined plan; recycling future minimums is a separate part of the monthly budget.
- The comparison includes all applied payments in every total, not just the future scheduled minimums. A plan that never pays off within the model’s limit has no complete interest or payment total. Savings require both it and the baseline to have a complete payoff estimate.
- Monthly/combined schedules are capped at 1,200 original monthly due slots per loan and 1,200 monthly-extra slots. If unpaid, they report the projection limit rather than infer an interest-coverage classification from irregular extra-payment rows.
- These remain fixed-rate, simple-interest estimates, not servicer transactions. Smallest-balance-first strategy comparisons and payoff milestones are the next feature chunk.

## Calculation assumptions

- USD amounts are represented as integer cents.
- Simple interest accrues on principal using `principal × annual rate × actual days / 365`, rounded to cents at each payment. Unpaid interest does not itself accrue interest or automatically become principal.
- Payments cover unpaid accrued interest before principal. The final payment is capped at the balance owed.
- The monthly payment remains fixed until payoff. Due dates stay anchored to the initial next-payment day, clamped for shorter months (January 31 → February 28 → March 31).
- Minimum-only and one-time-only loans are simulated independently. Their combined monthly minimum falls as loans are paid off. Monthly/combined plans allocate a shared extra budget and roll freed minimums forward as described above.
- Overall payoff is the last loan’s payoff date. Combined remaining interest and future payments are sums of complete individual projections, not an estimate based on an averaged rate. The displayed principal-weighted rate is informational only; if no principal remains, no combined rate is shown.
- Combined schedules group actual payment dates. Between a loan’s due dates, its displayed balance includes simple interest since its previous payment or the common balance date, rounded consistently with the individual calculation.
- **Remaining interest** includes unpaid interest at the balance date plus newly projected interest. **Total future payments** includes both principal and all remaining interest. Neither includes previously paid amounts.
- Subsidized and unsubsidized loans are modeled identically during normal repayment. Subsidy eligibility outside repayment is not modeled.
- No fees, variable rates, capitalization events, deferment, grace periods, income-driven repayment, or forgiveness. This is an estimate, not financial advice or a replacement for a servicer statement. Servicer day-count and rounding rules can differ.
- The independent-loan projection stops after 1,200 monthly payments. If unpaid, it does not claim a payoff date or complete interest total. An insufficient-payment warning means payments do not cover newly accrued interest over the final 12 simulated payments; other unpaid cases receive a projection-limit warning.
- A one-time payment is additional to the 1,200 scheduled-payment limit. Payment counts include it, and same-day grouped rows are marked when they include an extra payment.
- If any loan fails to pay off within its limit, combined balances and minimums are still shown, but overall payoff, complete interest totals, and the combined chart are withheld. Complete projections for other loans remain available individually.

## Validate

```sh
npm run check      # typecheck, lint, tests, and production build
npm run test:watch
npm run preview    # serve the production build after npm run build
```

Tests cover single-loan and portfolio engines, all four scenarios, monthly budget allocation, rollover, dates, caps, rounding, form validation, the slider, loan management, and baseline/scenario isolation. The calculation engines in `src/domain/` are independent of Vue. The chart uses SVG without a charting dependency.

## Feature chunks

1. ✅ Single-loan minimum-payment baseline.
2. ✅ Multiple loans and combined dashboard.
3. ✅ A hypothetical one-time payment today, targeting a chosen loan.
4. ✅ Extra monthly payments, including comparison with a combined one-time payment.
5. ⬜ Highest-rate-first versus smallest-balance-first strategies and payoff milestones.

Persistence and actual balance history are intentionally deferred.
