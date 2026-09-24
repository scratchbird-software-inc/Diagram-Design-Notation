# DDN known gaps and deferrals

This file records scope decisions that were consciously deferred, with the
reason and the revisiting hook. Entries are dated and reference the work item.

## Parameterized model fragments (B1-041, 2026-09-24)

Phase 5 of compact authoring ships UNPARAMETERIZED include-by-reference
fragments (`fragment name { … }` + `use: @name;`) plus the full preset family
(named field/port groups, relation property sets, generic/motion property
presets). Parameterized fragments — `fragment staged_process(name, stages)
{…}` with substitution into identifiers and labels — were judged
disproportionate for this phase: identifier substitution interacts with
source-span authoring edits (D8 edit scope), identity predictability, and the
token-precise normalizer in ways a textual-substitution rule cannot settle
cheaply.

Chosen scope (per the B1-041 D6 scope rule): minimum viable = unparameterized
fragments + all other preset types, implemented and equivalence-gated.

Revisiting: a parameterization proposal needs (a) one documented substitution
rule covering identifiers and strings, (b) an answer for inspector edit scope
on substituted instances, and (c) equivalence-gate fixtures against the
handwritten expansion. Related deferral inside phase 5: definitions are
closed templates (`use:` inside a definition body is DDN-E017); nested
presets/fragments can be reconsidered together with parameterization.
