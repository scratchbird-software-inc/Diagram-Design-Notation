# Chapter 11 — Alien-format import policy

**Status:** stub (scope approved, prose pending the per-family work item).

## Outline

Binding owner decisions (2026-09-29):

1. DDN and DDNA are the ONLY formats tools display, render, or execute.
   Alien formats (BPMN XML/DI, XMI, DMN XML, CMMN XML, SysML XMI, PNML,
   FEEL/OCL/ALF text, MSC/Z.120 PR forms, vendor stencils…) may be
   imported — read and converted into DDN/DDNA — but are never displayed
   or used natively.
2. Alien expression languages: import/convert into DDNA's own expression
   form where possible; unconvertible constructs are carried as opaque
   host references (KEEL), never parsed or evaluated in alien dialect.
3. Product tiers: open designer = simple import, no export (a deliberate
   tier limit, not a technical ceiling); commercial = full import and
   full export.
4. Export from the *standard* side remains out of scope unless separately
   decided; the spec does not preclude export mappings.
5. The corpus' "interchange policy" standing exclusions re-read as "no
   NATIVE support"; import converters are a separate, permitted feature
   class living in a shared converter core (ratified D9).

Synthesis additions (design constraints on importers): preserve rule order
losslessly (DMN F/R hit policies make order normative); preserve vertical
event order exactly (MSC geometry is semantics); attach semantics to the
post-transformation abstract model (SDL shorthand transformations), with
trace references resolving against the unparameterized transformed model;
map onto each standard's own extension mechanism and keep the
semantic/layout split that BPMN20/BPMNDI and DMM/UAFML exemplify; resolve
classifier context and stereotype/instance-specification mappings.
