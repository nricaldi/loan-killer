# Round 2 independent adjudication

Reviewed HEAD independently: `6110e547c8edf8617e702bc23743e07042514b76`. Read both round-2 reports and round-1 constraints, inspected six actual screenshots and current source. This is a read-only review, not implementation approval for broader redesign.

## Consolidated decisions

| Proposal | Decision | Priority |
|---|---|---|
| Large chart tick labels such as `$20,000k` | MODIFY: compact million-scale formatting first | Medium |
| Large monthly minimum clips cents | ACCEPT: make the complete amount visible | Medium |
| Group money-ruler amounts outside editing | MODIFY: optional display-only grouping | Low |
| Modest loan-list and metric space savings | MODIFY: narrow, conditional refinement | Low |
| Avoid wrapped benefit badge | REJECT: current wrapping is appropriate | No fix required |
| Change shared horizon to later payoff plus margin | REJECT: core behavior already exists; margin worsens compression | No fix required |

### 1. MODIFY — chart tick readability

Terra's large 320px screenshot visibly places `$20,000k` against the starting endpoint. Luna's million-dollar screenshot also shows a long `$1,004.2k` label crowded at the plot edge. This is a real presentation issue, not incorrect balance data. `chartMoney` currently uses thousands for every amount above its threshold; the chart reserves a 3.25rem axis column.

Bounded criteria: introduce clear million-scale labels (for example `$20m`) for large amounts, retaining dollar units, sensible rounding and distinguishable adjacent ticks. Check values around unit transitions and the largest supported aggregate, not only a single loan. Verify labels leave visible clearance from endpoint markers at 320/375/768/1280 widths. Preserve numeric scale calculations, exact financial totals and accessible descriptions. Keep existing plot height and width where possible. Only consider a narrowly adaptive axis gutter if compact formatting still demonstrably fails; do not approve a broad chart layout change or smaller type by default.

Tradeoff: abbreviated ticks sacrifice display precision, appropriate for axis guides while exact amounts remain available elsewhere. A wider gutter consumes the already scarce mobile plotting width and is therefore a fallback, not the first fix.

### 2. ACCEPT — monthly minimum cents clipping

The Terra large screenshot shows `10000000` without `.00`; source initializes this field with two decimals, and its 8rem wrapper plus currency and `/mo` padding explains the restricted visible area. This is evidence of clipping, not evidence that cents were lost from the financial model.

Bounded criteria: show the entire supported monthly minimum, including cents and currency/month association, at rest at 320px and above. Permit the field to grow or occupy its own row when necessary; preserve normal compact cards, complete names, eye/edit/delete actions and distinct coarse-pointer targets. Keep exact editable cents, validation, focus visibility and selection usable. Test maximum and near-maximum values with nonzero cents, ordinary amounts, warning/suggestion and allocation-tag states. Do not reduce text size or touch regions to fit. Grouping alone is not a clipping fix: it increases the string width.

Tradeoff: an occasional additional row is justified to read a payment accurately; globally widening all cards or increasing ordinary card heights is unnecessary. Formatting during editing would introduce caret risk and is not required by this approval.

### 3. MODIFY — money-ruler grouping outside editing

Luna's screenshot establishes the ungrouped string in a focused field; that screenshot alone does not establish a blurred defect. Source resolves the distinction: `inputValue` is raw props text or the moving ruler value, with no grouped idle presentation. Grouped idle values would improve recognition, but this remains polish rather than an accuracy defect.

Bounded criteria: optional grouped presentation only when unfocused and valid; retain raw editable decimals during editing. Preserve cents when present, zero behavior, invalid input feedback, Enter/blur behavior, focus/selection predictability and exact underlying values. Account for separators in width/autosizing rather than just digit count. Verify maximum amounts, fractional values, focus transitions, ruler movement, ± $5 changes and inclusion switches at narrow widths. No extra helper text, duplicate visible amount or loss of accessible field identity. Do not apply integer-only formatting that hides cents.

Tradeoff: easier scanning adds formatting and focus-state complexity and potentially smaller type at large values. If grouping cannot fit comfortably without impairing editing or targets, defer it; this is lower priority than fixing clipped minimum payments.

### 4. MODIFY — bounded space savings

The mobile six-loan evidence is tall but retains clear identities and actions. Full names and allocation tags explain much of the height. Source already has the round-1 suggested 4px payment-row top margin; do not propose the earlier 8-to-4px change again. The strongest remaining opportunity is `.segment-labels b` reserving `2.8em` with `1.4` line-height, including single-line numeric values. Its spare space is conspicuous when metrics form three rows.

Bounded criteria: optionally let metric value blocks use natural content height, preserving label/value association, orderly grid rows and wrapping for unavailable text. Compare one-, two- and three-column states, large currency, unavailable and negative savings before accepting. Loan-list refinements are limited to a small repeated gap or padding trial supported by before/after evidence; no mandatory global reduction is approved. Retain 44px coarse targets, full identities, warning/suggestion and allocation-tag clearance, distinct cards and current reading order.

Tradeoff: natural metric height can introduce height changes between available and unavailable states; modest layout movement is preferable to clipping but must be assessed. Tighter card spacing reduces visual separation and hand comfort. Six loans necessarily require scrolling; a shorter page alone is not a success criterion.

### 5. REJECT — eliminating wrapped badges

The long `52y 3mo sooner` badge in Luna's 320px capture fits on a second header row, stays associated with the chart and does not obscure data. Terra's ordinary benefit fits inline at 375px. The source already uses flex wrapping and a minimum header height, exactly the appropriate fallback established in round 1.

Retention criteria: keep the complete title and benefit, wrapping when needed, with no truncation, font reduction, overlap or fixed-height clipping. Preserve the fixed plot height independently of header height. A later demonstrated overflow under larger text would justify a targeted correction; these screenshots do not justify one. Forcing a single row would trade readability for negligible vertical savings.

### 6. REJECT — changing the shared time horizon

Verified afresh in source, not accepted on the authority of round 1: `LoanTrajectory.vue` supplies a 600-month horizon only when either projection is unpaid. With both paid off, `balanceWindow` returns the actual projections without truncation. `BalanceChart.vue` chooses the latest endpoint date across both series, computes one `totalDays`, and maps both against that denominator and one balance maximum. Start/end date labels already exist. The paid comparison continues at zero to the shared end.

Luna's new screenshot is a completed comparison ending in February 2079, more than 50 years after the start. This independently supports the absence of a blanket 50-year cap on completed plans. Its immediate selected payoff is represented by an essentially vertical fall at the left edge; an instantaneous payment should be vertical even on a shorter scale. Other much-earlier payoffs necessarily occupy a small fraction of a truthful shared decades-long axis.

The proposed later-payoff endpoint already exists. Adding a small right margin would increase the denominator and compress the early trajectory further; it cannot solve widely separated payoff times. It might provide cosmetic endpoint space, but no new evidence establishes that need here.

Retention criteria: completed comparisons end at the later actual endpoint; unpaid comparisons retain the disclosed bounded horizon and actual outstanding endpoint balance. Preserve common linear time and balance scales, fixed plot height, true payoff markers/dates and beyond-chart payoff handling. No independent scales, selected-plan crop, fabricated dates, nonlinear compression or chart redesign is approved. The tradeoff is honest but compressed early trajectories; current explicit date and benefit badge help interpret them. Revisit a specific label collision only with evidence and a bounded positioning proposal.

## Independent current UI ratings

These are my judgments of the current interface, not adopted reviewer scores or forecasts after fixes.

| Exact category | Score / 10 | Rationale |
|---|---:|---|
| Visual hierarchy and scannability | 8 | Clear loans, totals, exploration and chart sequence; long mobile lists require scrolling but identities remain understandable. |
| Typography | 7 | Strong ordinary currency hierarchy and readable names; extreme axis labels and clipped minimum cents weaken precision and scanning. |
| Spacing and alignment | 7 | Consistent surfaces and columns; large tick crowding and reserved metric height are visible local weaknesses. |
| Density and breathing room | 8 | Comfortable separate controls and compact desktop cards; mobile length largely follows actual content. Small metric savings are plausible. |
| Component consistency | 8 | Coherent neutral cards and red interest/green actual savings; unavailable summary metrics are neutral. Raw money-ruler digits differ from surrounding grouped amounts. |
| Responsive and accessible interaction | 7 | Responsive arrangements and full identities look sound; reported target measurements support them, but interaction accessibility is incompletely established and payment clipping remains. |

**Overall: 7.5/10.** A coherent interface with localized extreme-value readability defects. No evidence here warrants replacing its chart or compact loan design.

## Preserved design and evidence limits

All criteria preserve neutral cards; semantic red interest and green actual savings; compact loans with eye switches and full identities; date ABOVE two separate money cards; tick-free sliding date; $5 money rulers with ± controls and inclusion switches; and no helper-copy clutter. Existing necessary unpaid-horizon disclosure remains.

Personally inspected with `view_image`: `terra-round2-large-320.png`, `luna-round2-large-total-320.png`, `terra-round2-six-320.png`, `luna-round2-6loans-1280.png`, `terra-round2-active-375.png`, and `luna-round2-unpaid-baseline-375.png`, all under `/tmp/loan-killer-audit`. Read relevant current source in BalanceChart, LoanTrajectory, LoanPaymentChip, MoneyRuler, balanceWindow and format, and verified HEAD. Other viewport measurements and interactions are supporting reviewer reports, not independently repeated observations.

No browser session was opened, no interaction was independently performed, and no native-device, assistive-technology, zoom, contrast-compliance, full keyboard or gesture claims are made. Screenshots are synthetic headless evidence and cannot establish every supported data state. No app, docs, Git, PR, server or installation changes were made. Only this requested report was written; its explicitly requested filename is the exception to the astra-round2 artifact prefix.
