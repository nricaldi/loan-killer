# UI audit — November 15, 2026

Reviewed application head: `a197801`. Independent reviewers assessed hierarchy, typography, spacing, density, consistency, and responsive interaction. Ratings are qualitative judgments, not accessibility certification.

| Category | Terra round 4 | Luna round 4 | Fresh Astra final |
|---|---:|---:|---:|
| Visual hierarchy and scannability | 8 | 8 | 9 |
| Typography | 8 | 8 | 9 |
| Spacing and alignment | 8 | 8 | 9 |
| Density and breathing room | 8 | 8 | 9 |
| Component consistency | 8 | 9 | 9 |
| Responsive and accessible interaction | 8 | 8 | 9 |
| Overall | 8 | 8 | 9 |

## Changes made

- Keep currency values intact; let metric columns wrap based on actual amount length. Use million-scale chart labels for large amounts.
- Preserve full loan names and 44px coarse-pointer targets; give long monthly minimums their own wider row.
- Group idle ruler values while retaining raw exact editing, including cents.
- Remove unused metric height without crowding the loan controls.
- Add a mobile “View results” shortcut for four or more loans, with native anchor scrolling and keyboard focus on the summary.
- Preserve readable text on hidden loans; improve off-switch contrast and keep inactive legend text readable.
- Render unavailable savings neutrally.

Astra rejected more compression, collapsed loan modes, extra chart views and distorted financial scales. The common chart horizon, full names and current spacing remain intentional tradeoffs.

## Validation and limits

`npm run check` passed typecheck, lint, **386 tests**, and production build. Headless Chromium checks covered 320/375/768/1280px, six long names, large amounts including cents, hidden/excluded states, warnings, keyboard navigation, switch operation, target geometry and horizontal overflow. Additional interaction scripts exercised momentum, exact editing and date settlement.

The original standalone momentum script has a known strict chart-height assertion failure: 347.59px before comparison versus 340px after. Its diagnostic variant logs that difference and passes subsequent gesture checks. This is separate from the passing automated suite; it was not silently treated as a pass. The final judge did not approve a source change for that small content-dependent difference.

Physical devices, native screen readers, full zoom coverage and every browser engine remain untested. UI scores do not certify calculation correctness. Screenshots/scripts referenced in individual reports were generated under `/tmp/loan-killer-audit` and are session artifacts; the written reports are preserved here.

## Reports

- [Terra round 4](docs/ui-audit/round-4-terra.md)
- [Luna round 4](docs/ui-audit/round-4-luna.md)
- [Final Astra judgment](docs/ui-audit/final-2-astra.md)
- [Initial final judgment and accepted improvements](docs/ui-audit/final-1-astra.md)
- [Round 3 adjudication](docs/ui-audit/round-3-astra-decisions.md)

Earlier independent reports and adjudications are archived alongside these reports.
