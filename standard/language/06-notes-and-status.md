# Indented notes and status indicators

Current notation is consolidated in [the language reference](09-language-reference.md) under the owner's delegation. Its concrete syntax/interpretation choices supersede unresolved notation statements below; confirmed owner requirements and remaining semantic/default-codex work still apply.

## Confirmed owner directions

The owner requires a status icon in addition to the DDN type icon. The four user-set statuses are Draft, In-progress, In-review and Accepted; Accepted replaces the earlier Certified label. The same status setting drives the icon. See [status and acceptance](08-status-and-acceptance.md) for the In-review verification requirement, acceptance date/time/user and authorized return paths. Actual icons remain to be selected.

The owner also specifies an identified multiline notes block with a title on the declaration line and an indented, wrapping text body. Consecutive prose lines form one paragraph; a blank line starts a new paragraph. A following declaration at the outer indentation ends the notes block. These rules apply to notes, not to table cells, which remain on one physical source line per data row.

The example below preserves the owner's compact spelling. Identifier placement and exact lexical rules remain separate grammar work. This chapter is planning, not an implemented parser or interface.

## Notes block

```text
notes : ##this is a multi-line text box title

        this is a multi-line text box line,
        this is a multi-line text box second line single paragraph

        this is a multi-line text box line, new paragraph
next-block
```

Interpretation:

- `notes` identifies the notes declaration; the colon separates it from the displayed title.
- `##` supplies a level-two heading for the title. The owner's no-space spelling `##title` is valid in this title position; `## title` should also be accepted. This is a DDN header convenience, not a global change to Markdown interpretation in every body or literal value.
- The indented text is the note body. Its first two ordinary lines form one paragraph and wrap according to the note's available display width.
- The blank line introduces the next paragraph. Blank lines, even unindented blank lines, do not themselves close the note.
- The first following nonblank line at the declaration's indentation or a shallower level closes the block and belongs to the surrounding DDN structure. `next-block` is the owner's placeholder for that next declaration, not a newly reserved closing keyword.
- EOF can close the block without an explicit terminator. This is the proposed ordinary indentation rule, consistent with the owner's example.

Once inside the note body, text resembling DDN declarations remains text. For example, an indented line containing connect Customer to Order is note content. It is not interpreted as a diagram relationship merely because it contains those words.

## Indentation, wrapping and Markdown

The structural indentation must not turn ordinary prose into a Markdown code block. The proposed parsing rule removes the body's common structural indentation before Markdown interpretation, while preserving additional indentation for lists or code. The first nonblank body line establishes that indentation; exact invalid/intermediate indentation and tab behavior belong to the complete lexical grammar.

Keep the original source indentation and line breaks for faithful editing/saving. Structural indentation removal is the interpretation step, not permission to rewrite the author's source or flatten stored paragraphs. Soft source line breaks within ordinary prose flow as one paragraph. Markdown structures such as headings, lists, quotations and code retain the behavior of the selected text profile; the prose-joining rule does not flatten them.

Blank lines separate paragraphs. Visual wrapping depends on the available text-box width and font; it does not insert or remove paragraph boundaries. Actual line breaks in a note source are permitted under this block form, unlike the single-line table-row contract. No surrounding quotes or closing braces are required merely because the note spans lines.

The type-specific text defaults and file > CSS > standard cascade apply. Title heading level and body text are distinct text roles. The previously discussed Courier 10pt remains an illustrative default, not a newly selected global setting.

## Identifier versus title

The owner requires an identifier, but the example does not separately spell a note name beyond notes. Keep the displayed title distinct from stable identity so that changing a title cannot break references. The proposed named form is:

```text
notes customer_notes : ##Customer design
    A first line of the paragraph,
    followed by another line of that same paragraph.

    This is another paragraph.
```

Here customer_notes is the proposed author-visible reference name and Customer design the editable display title. The shorter `notes : ...` form can use a generated identity when no explicit reference name is needed. This is a proposal for resolving the identifier requirement while retaining the owner's short example; it is not confirmation that the owner selected this exact optional-name syntax. Qualified references continue to use the accepted :: direction; exact note lookup and reference forms still need consolidation.

The binding of a notes block to its owning element/view/document and whether a standalone notes declaration creates a placed text element must be explicit in the enclosing grammar. Indentation defines containment, but titles do not silently create identity or semantic relationships.

## Status icon beside the type icon

Type and status are separate information. Keep the existing DDN type icon and add a status icon for the applicable item or scope. Draft, In-progress, In-review and Accepted are distinct user-set statuses. The icon is derived from the same status setting changed by the designer's context-menu action; it is not independent authored state. A different drawing style or body representation does not change the status.

Candidate icon directions for later visual design are:

| Status | Candidate symbol, not a selected asset |
| --- | --- |
| Draft | Pencil |
| In-progress | Not yet selected; must be distinguishable from In-review |
| In-review | Magnifying glass |
| Accepted | Seal with a check mark |

The artwork, placement, size and colour palette remain open as the owner requested. A proposed requirement is a distinct shape and accessible text label for each state, so colour is supplementary. No icons are generated or selected by this chapter.

A shaded square means the table cannot fit its display area. It is not a lifecycle status and must not replace or change the status record. Likewise, a type icon identifies what the item is, not whether it has passed review.

The status marker reflects the recorded user-set status. In-review requires complete content that passes verification; Accepted requires acceptance date/time/user. Verification evidence is distinct from the status: passing verification does not automatically advance the user-set value. An authorized user can return Accepted to In-review or In-progress. Exact ownership/scope, authority implementation, evidence linkage and editing rules remain to be consolidated. A parent workarea's status does not silently accept unrelated or unfinished content.

The viewer displays type and status information without gaining editing or approval capability. The designer's Draft-to-In-progress context-menu conversion remains one way; this does not prohibit the explicitly authorized return paths from Accepted. Its status value drives the icon, while the verifier's checks remain distinct. This does not alter the standalone/open-source versus commercial collaboration boundary.

## Integration still required

Consolidate the notes header, optional reference-name proposal, body indentation and paragraph rules into the full grammar and source-preservation model. Connect notes to the existing text/document/appearance concepts without creating a second arbitrary identity model. Add the type/status display binding, select the icon set and integrate the four-state/acceptance contract into the canonical schema. Existing property schemas and baseline checks do not yet prove support for these new source/display requirements.
