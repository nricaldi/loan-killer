# Round 1 adjudication — current HEAD 1071e30

Read-only adjudication of Terra and Luna reports; no implementation approved beyond the criteria below. Git HEAD independently verified as 1071e30. Decisions consolidate duplicate proposals. Severity describes the current usability issue, not effort.

| Proposal / report finding | Decision | Severity | Material improvement? |
|---|---|---|---|
| Currency wrapping — Terra 1, Luna 2 | ACCEPT | High | Yes: prevents splitting financial values |
| Coarse-pointer targets — Terra 2 | ACCEPT | Medium | Yes: improves acquisition and reduces adjacent-action errors |
| Full loan names — Terra 3, Luna 3 | MODIFY | Medium | Yes, especially similarly prefixed loans |
| Chart title width — Terra 4 | ACCEPT | Low | Modest but demonstrable responsive improvement |
| Reduce repeated card whitespace — Terra 5 | MODIFY | Low | Optional density refinement; largely preference |
| Change chart horizon — Luna 1 | REJECT | Not a scale defect | Proposed behavior already exists |
| Neutral unavailable savings — Luna 4 | ACCEPT | Low | Yes: restores color semantics |

## Decisions and implementation criteria

### 1. ACCEPT: keep financial amounts intact
Evidence: terra-six-320.png visibly breaks $46,560.00 and $15,408.18 within their cents. LoanTrajectory.vue combines three minmax(0, 1fr) columns with overflow-wrap:anywhere on amounts. Luna independently reports the same defect with different data.

Criteria: keep currency values on one line and reflow whole label/value groups when space is insufficient. Two columns at narrow widths are a reasonable starting point, but use one column when a longer supported total cannot fit. Preserve the owed/interest/saved reading order and label association. Check 320/375/768/1280 widths, large supported balances, incomplete values and negative savings; no clipping or document overflow. Allow textual unavailable values to wrap normally.

Pitfalls / compression objection: nowrap alone creates overflow; a fixed 22rem breakpoint alone does not prove large amounts fit. Reject the alternative of shrinking monetary values to 12px to retain three columns. Extra height here is justified by accurate reading.

### 2. ACCEPT: preserve compact artwork with adequate touch hit areas
Source confirms LoanList.vue's final <=22rem rule overrides its earlier coarse-pointer 44px sizing with 32px. DateRuler and MoneyRuler buttons are 36px, and PaymentControls switches are 44×36. Luna's general statement that coarse-pointer CSS enlarges controls misses this narrow override.

Criteria: on coarse pointers provide at least 44×44 distinct hit regions for these controls, including at 320px. Keep icon artwork compact. Verify bounding boxes, spacing and actual hit testing with touch emulation; expanding invisible hit areas must not cover adjacent controls, editable values or swipe regions. Preserve focus indication and switch state labels.

Pitfalls / compression objection: this is a practical target-size improvement, not a claim that every sub-44px control violates an accessibility standard. Fine-pointer 32px icons alone do not establish a defect. Do not squeeze names or shrink payment fields simply to absorb enlarged targets; allow layout growth where necessary.

### 3. MODIFY: provide reliable access to complete loan identity
Evidence: both reports' long names truncate; desktop screenshot also truncates. Correction: LoanPaymentChip.vue already provides title=loan.name, and action accessible names contain the name. Thus there is a hover fallback, but no equivalent dependable touch/keyboard reveal in the card. Editing also exposes the name, at greater interaction cost.

Criteria: prefer a modest two-line name treatment if useful, but two lines alone cannot guarantee identification for all 80-character names. Provide a keyboard- and touch-operable full-name reveal if text remains clipped, with visible focus and sensible dismissal. Test two names sharing a long prefix; both must be distinguishable without editing. Retain eye toggles and compact cards.

Pitfalls / compression objection: do not claim native title is an adequate touch solution; do not turn the entire editable card into an ambiguous click target. Avoid expanding every card to the maximum name height or adding permanent helper copy. Extra height for actual long names is preferable to shrinking their type.

### 4. ACCEPT: let the chart heading use available width
Evidence: terra-insufficient-320.png and terra-six-320.png wrap “Balance over time” despite having no time-benefit badge. BalanceChart.vue reserves two equal columns and fixes header height at 44px.

Criteria: let the title use the available row when no badge exists; with a badge, allow the badge to move to another row when needed. Use minimum rather than fixed height where wrapping requires it. Verify no overlap for long sooner/later text at 320px and larger text settings.

Pitfalls / compression objection: nonshrinking title plus an unbreakable badge can introduce overflow. Do not reduce title font size or chart height to compensate. This is a header layout correction, not a chart-scale change.

### 5. MODIFY: optional, tightly bounded spacing refinement
Evidence: six mobile cards create substantial scrolling, but the cards remain readable and the desktop grid is efficient. LoanPaymentChip has 14px padding, a 44px name block, an 8px payment-row top margin and grid gap. These are not obviously excessive in isolation.

Criteria: if pursuing space savings, trial reducing the payment-row margin from 8px to 4px first; assess before/after for one and six loans, long names, allocation tags, warning and removal states. Retain 44px payment fields, appropriate hit areas, clear card separation and existing content order. Reject any trial that crowds these states. No mandatory global padding reduction is justified by these reports.

Pitfalls / compression objection: tall content from six distinct loans is expected. Do not collapse loans, combine date and money cards, shrink rulers, move metrics after exploration, or reduce type to chase a screenshot height. This is mostly taste unless the trial demonstrably improves scanning without reducing comfort; prioritize the other fixes first.

### 6. REJECT: chart horizon correction; retain truthful comparison
The parent's observation is verified directly, not assumed. LoanTrajectory.vue sets a 600-month horizon only when baseline or comparison is not paid off. Otherwise balanceWindow receives undefined and returns the actual projection. BalanceChart.vue chooses the latest endpoint from both series for its common endDate and maps both against the same totalDays and maxBalance.

Luna's combined screenshot shows the personal loan at $5,000, 12%, $25/month, flagged “Too low to pay off.” Its baseline is incomplete; the chart explicitly says it shows the first 50 years and displays a nonzero baseline endpoint in 2076. The selected plan pays off in April 2031. A steep selected line over this shared long range is correct. This is not evidence of an erroneous 50-year window on two completed plans. The selected line's explicit continuation at zero is also truthful.

Acceptance criteria for retaining behavior: completed comparisons end at their later actual payoff; incomplete comparisons keep the disclosed horizon and outstanding balance; payoff dates only come from paid-off projections. Preserve shared linear time/balance scales, true endpoint markers, horizon disclosure and beyond-chart payoff handling. No fabricated dates, silently truncated unpaid baseline or independent per-series scaling.

A separate, low-severity presentation concern is visible: the payoff label overlays part of the steep early selected line. If addressed later, a collision-aware repositioning of the existing label, with a clear association to its true endpoint, is a narrower candidate. It must be demonstrated on early, late, equal and beyond-horizon payoffs before approval; no blanket chart redesign is warranted. The endpoint itself is already visibly marked. Do not change chart height, crop to the selected payoff, remove the unpaid baseline or add helper paragraphs to make the selected line appear gentler. A fixed right margin is optional taste and would compress the meaningful data further, so is not approved as a fix here.

### 7. ACCEPT: neutral unavailable savings
Evidence: Luna combined screenshot and Terra insufficient screenshot both show green “Not available.” LoanTrajectory.vue colors the last value green unconditionally except negative savings.

Criteria: when interestSaved is null, render its value and key in neutral colors; retain green for actual savings and red for extra cost. Existing “Not available” wording is adequate. Verify incomplete baseline with completed comparison as well as both incomplete. Preserve accessible textual meaning and avoid conflating null with $0.00.

Pitfalls / compression objection: changing the label alone will not fix the unconditional green value. Do not shorten text solely to force the current three-column layout or remove the metric group; fix responsive grouping separately.

## Independent ratings of the CURRENT UI

These are judgments of the present UI, not projected scores after fixes and not averages of the reports.

| Category | Score / 10 | Evidence and qualification |
|---|---:|---|
| Visual hierarchy and scannability | 7 | Clear loans → repayment metrics → exploration → chart sequence. Prominent totals and restrained color help. Broken narrow totals interrupt scanning; six mobile cards necessarily push outcomes down. |
| Typography | 6 | Amount weights and label hierarchy generally work, but splitting cents is a serious local failure and long identities truncate. Screenshot fonts reflect the capture host; this is not a native-font rendering assessment. |
| Spacing and alignment | 7 | Desktop card grid and separate exploration surfaces align well. Narrow chart header wastes available width. Most card padding looks intentional rather than excessive. |
| Density and breathing room | 8 | Comfortable fields and clear card separation; compact desktop layout. Long mobile stacks are expected for six loans. Only modest repeated spacing savings are justified. |
| Component consistency | 8 | Coherent white/gray/charcoal surfaces, red interest and green savings; date and money controls follow established design. Green unavailable savings weakens semantic consistency. |
| Responsive and accessible interaction | 6 | Responsive composition is credible, but narrow touch-target override and full-name access need attention. Source supplies meaningful labels; complete keyboard, assistive-technology and touch behavior were not independently exercised. |

## Evidence and limits

Read both complete reports and inspected their actual screenshots with view_image: terra-six-320.png, terra-insufficient-320.png, luna-scenario-combined-375.png and luna-6loans-1280.png. Read current LoanTrajectory.vue, BalanceChart.vue, LoanList.vue, LoanPaymentChip.vue and domain/balanceWindow.ts; inspected target sizing in DateRuler.vue, MoneyRuler.vue and PaymentControls.vue. Other captures and reported interaction results are supporting auditor claims, not fresh independent observations. No browser session was needed or opened; no native-device, screen-reader, contrast-compliance or exhaustive data correctness claims are made. No app, docs, Git or PR changes were made. Only this requested report was written.
