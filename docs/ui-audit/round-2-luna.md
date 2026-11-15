# Loan Killer UI audit — round 2

**Reviewed commit:** `6110e547c8edf8617e702bc23743e07042514b76`  
**Overall: 8/10** — the interface now handles the target widths and the requested loan states cleanly. Cards stay compact, 80-character identities remain readable, large summary amounts do not split, and the previously misleading unavailable-savings value is neutral. The main remaining compromise is chart interpretation when a selected payoff is much earlier than the baseline on their shared long time axis. Large editable money-ruler values also lose thousands separators.

## Scores

| Exact category | Score | Evidence |
|---|---:|---|
| Visual hierarchy and scannability | 8/10 | Loan count/cards, repayment total, metrics, date ruler, separate money cards, and balance chart read in a sensible order. The 320px long-name view remains scannable. In a 52-year comparison, the selected line drops almost vertically at the left edge because both projections share the baseline’s long horizon. |
| Typography | 8/10 | Labels, values, chart ticks and card text remain legible at 320px; large totals such as `$1,000,000.00` stay on one line. The editable money ruler renders large values as ungrouped digits (`$1000000`), making them slower to parse. The small eyebrow and tertiary chart labels remain secondary but readable. |
| Spacing and alignment | 8/10 | No horizontal overflow at 320, 375, 768, or 1280. Loan actions align consistently and their 44px coarse-pointer regions do not overlap. The date card stays above two distinct money cards. Six-card desktop layout has ample gutters and some visibly unused card height where neighboring names wrap differently. |
| Density and breathing room | 8/10 | Six compact cards fit the narrow layout without shrinking text or controls. The complete mobile page is tall by nature, but its spacing is orderly. Keep savings focused on small repeated gaps; do not compress the separate rulers or target areas. |
| Component consistency | 8/10 | Neutral surfaces and card treatments are consistent; interest stays red and actual savings green. In the unpaid-baseline capture the unavailable savings metric and value are neutral, fixing the round-1 false-positive green. Large currency grouping in the ruler input is the main polish inconsistency against formatted totals elsewhere. |
| Responsive and accessible interaction | 8/10 | At all four CSS widths there was no horizontal overflow. Coarse emulation measured loan action buttons at 44×44px, date arrows at 44×44px, switches at 44×44px and money ± buttons at 44×44px; inclusion switches did not intersect adjacent value-navigation buttons or inputs. Add/edit modal screenshots show labeled fields, a close action, and the edit warning. Keyboard behavior was exercised for Escape; native phones/tablets, screen readers, zoom, and actual swipe gestures were not tested. |

## Remaining findings, ordered by impact

1. **Medium — early selected payoff is difficult to distinguish on a long shared time axis.** In the 320px large-total comparison, the baseline payoff is roughly 52 years away while the selected plan pays off immediately. The common scale is honest, the title and `52y 3mo sooner` badge remain clear, and the selected solid line remains visible, but it collapses to a near-vertical segment and then runs along zero for nearly the entire plot. This is the same underlying concern raised in round 1 and it remains. **Fix:** when both lines have paid-off endpoints, derive one shared x-axis end from the later of the two payoff dates plus a small right margin. Preserve that same date scale for both series and show the start/end dates on the axis. When either series is unpaid, retain the current bounded 50-year view and above-zero endpoint. This improves short-plan comparisons while keeping time truthful; widely separated payoff dates will still compress the earlier line, and the scale will vary between scenarios.

2. **Low — large editable ruler values omit grouping separators.** At 320px the supported `$1,000,000` one-time value is displayed as `$1000000`, while summary metrics and labels use `$1,000,000.00`. It fits between the ± controls, but takes longer to scan and has a dense focus outline. **Fix:** preserve the raw editable value while focused, then display a grouped currency string when blurred (with reliable caret handling when focus returns). Keep the current font auto-sizing and 44px controls. This improves recognition but adds formatting/caret logic and could make exact edits more error-prone if formatting is applied during typing.

## Round-1 comparison

- **Resolved:** `$49,650.00` and `$11,605.16` now remain intact at 320px; no cents are orphaned onto another line. This held in the six-loan capture and in the large supported-total capture.
- **Resolved:** the round-1 clipping concern for long names is resolved. Two similar 80-character names were fully visible on separate wrapped lines at 320px; their unique endings remained distinguishable. The app's 80-character limit bounds card growth.
- **Resolved:** unavailable savings is now neutral in the unpaid-baseline screenshot rather than green. The metric reads `Not available` in neutral text.
- **Remaining:** the shared long-horizon plot still compresses a much earlier selected payoff against a decades-long baseline, as described above. The common scale is truthful and the unpaid chart remains bounded.
- **Improved:** control sizing and separation were measured rather than inferred from CSS. All tested coarse-pointer targets were 44px and nonoverlapping in the checked adjacent-control regions.

## Coverage and evidence

- Empty, one-loan, and six-loan states were rendered at 320, 375, 768, and 1280 CSS pixels using isolated Playwright contexts against the provided production build. `documentElement.scrollWidth` matched `innerWidth` at every tested width.
- Captured add and edit modals at 375px; exercised opening, Escape close, and add/edit entry points. The edit capture includes the low-payment warning and ten-year suggestion.
- Captured unpaid baseline, active combined and monthly-only extra scenarios, excluded-extra state, normal repayment, and large savings/time-benefit state. The chart header was checked with no time badge and with a long `52y 3mo sooner` badge.
- Two same-prefix names of exactly 80 characters were visible without text overflow at 320px. The large-total capture showed `$1,000,000.00` labels and values intact; it also exposed the ungrouped editable ruler value.
- Coarse-pointer geometry checks: three loan actions each 44×44px at 320px; date arrows 44×44px; each payment switch 44×44px; money decrement/increment controls 44×44px. Switch rectangles were checked against adjacent money navigation buttons and inputs; no overlap was found. This does not establish comfort for every real hand size, platform accessibility, or gesture/swipe behavior.
- No page errors were recorded in the fresh capture run. The supplied parent proof script passed its four-width overflow, metric integrity, target-size, overlap, and name checks.
- Headless Chrome screenshots are viewport emulation, not native-device captures. I did not verify VoiceOver/TalkBack, browser zoom, actual coarse-pointer swiping, or a full keyboard-only session.

## Artifacts

- [Empty, 320px](/tmp/loan-killer-audit/luna-round2-empty-320.png)
- [One loan, 375px](/tmp/loan-killer-audit/luna-round2-1loans-375.png)
- [Six loans, 320px](/tmp/loan-killer-audit/luna-round2-6loans-320.png)
- [Six loans, 1280px](/tmp/loan-killer-audit/luna-round2-6loans-1280.png)
- [80-character names, 320px](/tmp/loan-killer-audit/luna-round2-80char-320.png)
- [Unpaid baseline, 375px](/tmp/loan-killer-audit/luna-round2-unpaid-baseline-375.png)
- [Combined extra scenario, 375px](/tmp/loan-killer-audit/luna-round2-combined-375.png)
- [Monthly-only scenario, 375px](/tmp/loan-killer-audit/luna-round2-monthly-only-375.png)
- [Excluded extras, 375px](/tmp/loan-killer-audit/luna-round2-excluded-375.png)
- [Add modal, 375px](/tmp/loan-killer-audit/luna-round2-add-modal-375.png)
- [Edit modal, 375px](/tmp/loan-killer-audit/luna-round2-edit-modal-375.png)
- [Large totals and long time badge, 320px](/tmp/loan-killer-audit/luna-round2-large-total-320.png)

Capture scripts are uniquely prefixed `luna-round2-` in `/tmp/loan-killer-audit`. The repository was not modified.
