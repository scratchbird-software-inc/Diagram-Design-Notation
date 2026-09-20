# Endpoint-order correction — verification record

Runtime **0.6.0-beta.1**, patched directly from `ddn-0.5-field-guide-complete.zip`.
Source syntax remains DDN 0.5. The runtime is the same in the public distribution
and every updated self-contained page.

## Reported accounting witness

The predecessor library was rendered again in the same browser/font environment as
the patched library. The model, view selection, source and measured nodes were
held constant. The live controls selected automatic placement and curved routing.

| Measurement | Before | After |
|---|---:|---:|
| Crossing between relations 11 and 12 | 1 | 0 |
| Total sampled relation crossings | 9 | 4 |
| Sum of all route lengths (native units) | 11449.652 | 10355.878 |
| Box position/dimension changes | — | 0 |
| Source model fingerprint change | — | none |
| Published legend-key change | — | none |

The four remaining crossings are reported, not labeled globally unavoidable or
hidden. The pass is a bounded heuristic. It must not exchange `journal` and
`account` field identities in order to get a superficially clean picture.

## Executed checks

| Suite | Result |
|---|---:|
| New endpoint ordering, field/port/guide/pin and public-API regressions | 44 / 44 |
| Existing core | 150 / 150 |
| Existing remediation / curve suites | 70 / 70; 46 / 46 |
| Existing SDK / pin-pattern suites | 44 / 44; 45 / 45 |
| Existing profile/projection suite | 123 / 123 |
| Existing quality/lifecycle suite | 155 / 155 |
| Existing short-route regression | 37 / 37 |
| Entire original field-guide catalogue | 391 / 391 views rendered |
| Guided edits, changed renders, byte-exact undo | 119 / 119 |
| Field-guide corpus/coverage assertions | 12 / 12 |
| Focused browser comparison, actual controls and SVG download | 17 / 17 |
| Full field-guide browser interactions | 32 / 32 |
| Field-guide documentation/source/link integrity | 12 / 12 |
| TypeScript public-option consumer | compile-only passed |

The suites overlap and must not be summed as independent evidence. The catalogue
run retained 395 estimated-font warnings, 70 residual-routing warnings and six
experimental-interaction warnings. Every view still carries at least one warning;
successful SVG generation is not a quality, accessibility or security certificate.
The paired-slot pass actually accepted slot permutations in 52 authored views;
other views used the geometric seed order, legal side changes or no change.

## Browser boundary

The browser was **144.0.7559.96**. Actual runtime code, controls, source preservation,
field visibility and SVG downloads were exercised. Normal localhost navigation
was attempted and blocked with `ERR_BLOCKED_BY_ADMINISTRATOR`; the harness then
injected the complete portable guide. Firefox/current Chrome, normal file/HTTP
navigation, strict CSP and assistive technology were not newly certified.

## Source and distribution identity

All **323 pre-existing `.ddn` files** remain byte-identical to the input archive.
All **12 self-contained HTML copies** inside the project contain the exact
patched library bytes. Existing static SVG exports are not automatically updated;
regenerate them from source when needed. This patch does not claim to have rerun
all ERP business/operational exercises or rebuilt every static historical export.

Original runtime SHA-256: `4b4fc865aa29759c10250933b242e6dd66226b722b224a04532bd3dfe5b87561`

Patched runtime SHA-256: `05ba94e1a9add994e16523f2b0f862b0b5dc3c733e293987aa287f1c6cc1585d`

## Reproduce

```sh
npm run test:endpoint-ordering
npm run test:routing-efficiency
npm run test:field-guide
npm run test:field-guide-browser
```

For the explicit predecessor comparison, retain the old public library separately:

```sh
DDN_PREDECESSOR_RUNTIME=/path/to/old/ddn.global.js npm run test:endpoint-browser
```

Earlier reports are retained as historical evidence. Independent approval and the
previous external ERP assurance gates remain pending.
