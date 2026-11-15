# Round 3 independent adjudication

Reviewed HEAD f1c886b45a2d00dc8e92cd0f0b63ca6701a78234. Overall **8/10**. Read-only review; no implementation or commit. The app server was left running.

## Decisions

| Proposal | Decision | Boundaries and evidence |
|---|---|---|
| Terra 1: shorten the mobile journey by compression or summary/navigation | **MODIFY** | Accept only a small navigation improvement: a single “View results” anchor after the loan-list heading and before the cards, on narrow single-column layouts with at least four loans. Target the repayment summary, before payment controls. Keep a 44px-high activation area, visible keyboard focus, and move focus to a meaningful summary heading on activation (programmatically focusable if needed). Prefer ordinary anchor scrolling; no mandatory animation. Do not add a sticky toolbar, duplicate summary, collapse state, truncated names, or shrink existing targets/padding. Test at 320/375 with six long names and keyboard navigation. Fresh summary heading position is y=1113px on both phones; navigation addresses access directly. |
| Terra 2: two-column extreme metrics, or accept current fallback | **MODIFY** | Accept the current fallback; reject a new forced two-column rule for the extreme case. Terra's existing large-320 screenshot, independently visually inspected here, shows intact $20,000,000.00 and $20,067,076.41 values, with the latter beside a wrapped label. Three metric rows are a reasonable rare-value accommodation. Preserve amount font size, unbroken numeric strings, accurate proportional bars, and the shared financial scales. No implementation warranted. |
| Terra 3: secondary typography/contrast review | **ACCEPT** (verification only) | A focused contrast and native-device readability check is useful, but evidence does not justify blanket enlargement. Fresh loan names measure 14px; rates and chart labels visually recede. Measure actual foreground/background combinations, including hidden states, before specifying a fix. If a failure is established, adjust the affected token or label only and recheck chart margins/320px wrapping. This is not an assertion of a contrast failure. |
| Luna 1: earlier-payoff inset or second view | **REJECT** for current scope | Fresh one-loan test: $6,115.16 owed, $30 minimum, $6,000 once produces March 2027 versus May 2055, with an explicit “28y 2mo sooner” badge. The early series is compressed, but the date, badge and large savings already communicate the outcome. A second scale would add interpretation and vertical space to the narrowest layout. This is a tradeoff, not a medium-severity defect. Keep the shared horizon, exact payoff annotation and proportional balances. Do not rescale or exaggerate the early series. Revisit an optional detail view only with evidence that users need month-by-month early balance inspection. |
| Luna 2: preserve names and spacing; possible collapsed details | **MODIFY** | Accept preserving full names and present card spacing. Reject a collapse/details mode for this round: it hides comparison information and adds state. Use the bounded navigation improvement above instead. |

## Independent ratings

| Category | Score | Rationale |
|---|---:|---|
| Visual hierarchy and scannability | 8 | Clear loans → total → controls → chart sequence; long mobile lists delay access. |
| Typography | 8 | Amounts and full names remain legible; secondary labels are small enough to merit verification. |
| Spacing and alignment | 8 | Consistent cards and control alignment across four widths; wrapped long names consume real space without colliding. |
| Density and breathing room | 8 | Cards already combine names, balance/rate and minimum/action rows efficiently. Page length is primarily an access issue, not excess internal whitespace. |
| Component consistency | 8 | Coherent surfaces, typography, semantic colors and repeated controls. Strong consistency, but sampled coverage does not support an exceptional 9. |
| Responsive and accessible interaction | 8 | No horizontal document overflow at four widths; all 26 sampled icon/toggle/navigation targets were 44×44px. This is a provisional UI assessment, not accessibility certification. |
| Overall | 8 | No major visual defect established. One small navigation improvement is preferable to broad compression or another chart. |

Terra's density 7 correctly identifies a cost, but assigns the mobile travel distance to density. Luna's 8 better reflects the local layout quality. At 320px the six cards take most of the first 1100px, yet each retains distinguishable suffixes and usable actions. Removing a few pixels from every card would save little relative to the journey and would reduce breathing room. A direct link helps returning users without weakening the list.

## Evidence and limits

Fresh isolated Chromium inspection at 320/375/768/1280 CSS pixels, height 850, with touch/mobile emulation. Document scroll widths exactly matched those widths. Six approximately 80-character shared-prefix names (77 characters in this generated fixture) remained distinguishable. Summary heading document y positions: 1113, 1113, 680, 501px respectively; Explore payments: 1308, 1308, 822, 643px; chart heading: 1801, 1801, 1123, 944px. These include DOM heading coordinates, not claimed fold visibility for visually hidden headings. Screenshots were independently viewed at all four widths. The script's `.loan-card` selector matched nothing: its empty card-height arrays provide no evidence; card appearance was assessed from screenshots and `.loan-chip` source instead.

Fresh artifacts: `/tmp/loan-killer-audit/astra-r3-{320,375,768,1280}.png`, `astra-r3-early.png`, scripts `astra-r3.cjs` and `astra-r3-early-proof.cjs`, and `astra-r3-measurements.txt`. The second script repeats the width measurements then creates the genuinely widely separated payoff fixture. The first six-loan one-time test only accelerated payoff by six months because unused payment was not transferred; it is not evidence for the early-payoff disagreement.

Prior evidence: both requested reports were read; Terra's large-320 screenshot was visually inspected. Their form, hidden/excluded, maximum-entry and warning claims were not freshly revalidated here. No financial-calculation correctness claim follows from visual inspection. Native phone rendering, physical gestures, screen readers, browser zoom and measured contrast remain unverified. Shared preview failed due missing browser libraries; the supplied isolated browser was used and closed. Initial git status was clean. Only audit artifacts outside the repository were written.
