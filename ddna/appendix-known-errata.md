# Appendix — Known errata in upstream standards

**Status:** appendix (informative). Two upstream errors the corpus verified
and every DDNA/DDN implementer must know. Stated in English, not in the
standards' formal languages.

## E1. CMMN 1.1 Clause 2 — conformance-clause numbering is off by one

The CMMN 1.1 conformance clauses in Clause 2 misnumber their own
subsections: the numbering used by the conformance points is shifted by
one relative to the actual clause structure (cmmn.md §5a, verified against
the published text). **Rule for DDNA:** conformance-point references to
CMMN Clause 2 must be checked against the text of the clause, never
against its printed number alone. DDN's CMMN profile claims "based on CMMN
1.1" (never conformance of any tier), so this erratum is documentation-
level for us — but any future conformance language in DDNA must cite the
corrected numbering.

## E2. SysML 1.6 §11.3.2.7 — probability constraint 4 is a copy-paste error

In SysML 1.6, §11.3.2.7 (the probability distributions library), the OCL of
**constraint 4** is a copy-paste of a neighboring constraint's body and
does not express the constraint its name and description state
(sysml.md §10, verified against the published text). **Rule for DDNA:** the
constraint is to be understood by its stated intent in English; the broken
formal body must not be implemented literally. DDN's SysML profiles make no
execution claims (constraint evaluation is explicitly out of scope), so
this is documentation-level for us — DDNA's SysML parametric work
(chapters 5, 6) must cite the erratum wherever the probability library is
referenced.

---

*Both errata follow the corpus' citation posture: the upstream documents
permit implementation but not redistribution, so the errors are described,
not quoted at length. UNVERIFIED-PDF drafting note: both statements were
verified against the published texts in the analysis corpus; page-level
citations will be added when the acquisition queue (chapter 12 §4) is
complete.*
