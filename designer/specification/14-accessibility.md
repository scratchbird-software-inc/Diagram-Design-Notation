# Accessibility, keyboard and pointer operation

**DDN Designer specification 0.2.0 — proposed; baseline audited 0.7.0.**

## Baseline
Target WCAG 2.2 AA for the finished visual application, then test it with users and assistive technology. This document and its prototype are not certification. Dragging alternatives and pointer target requirements are design inputs, not optional polish. WCAG 2.5.7 requires an alternative single-pointer operation for nonessential dragging; keyboard support alone is not the entire requirement. [R22]

## Equivalent input paths
Each drag action must have click and keyboard equivalents. Insert: palette click then canvas click, or Add automatically. Connect: click source, click target, choose meaning, confirm. Move: position/relative controls plus arrow keys. Resize: width/height or fit contents. Reorder fields: Move up/down or choose parent. Route guide: Add waypoint command and coordinate/relative controls. Drag is never the only way to create a valid diagram.

## Focus and navigation
The canvas has a named region and a model outline alternative. Use a roving focus strategy for manageable object navigation, with search for large views; do not make thousands of cells an unstructured tab sequence. The outline follows WAI tree patterns, with explicit selection versus focus. Toolbar navigation follows its established pattern. Enter opens meaningful actions; Escape cancels a gesture then closes overlays then clears selection in predictable stages. [R24,R25]

A focused object is brought into view without changing model coordinates. Focus targets survive rerender through stable identity. Removing an object moves focus to the next logical neighbor or outline entry, not the page body. Connection descriptions include source field, relation meaning, destination field and constraints. Remaining crossings are not required for understanding if the user follows the relation list.

## Targets and colour
Use transparent hit areas of at least 24×24 CSS pixels or compliant spacing where the WCAG criterion permits; prioritize 32–44px for touch actions. Visual endpoint marks may remain precise and small while hit regions are larger. Avoid overlapping hit targets on dense field rows; use a field-picker alternative. [R23]

Selection, invalid targets and diagnostics use text/icons/patterns in addition to colour. Preserve current light/dark/night semantic palette variants. Respect reduced motion; layout previews can crossfade or move minimally rather than animate large graph rearrangements. Text scales with browser zoom; inspector content reflows at 200%. Tables have header semantics and screen-reader source summaries.

## Keyboard proposal
V Select, H Pan, C Connect, N Add item, F Edit fields, Enter Edit selected label, Escape cancel, Delete Remove from view, Shift+Delete explicit model-delete dialog, Ctrl/Cmd+Z undo, Shift+Ctrl/Cmd+Z redo, Ctrl/Cmd+F search, Ctrl/Cmd+S open save/download flow. These apply only when the canvas is focused, not while typing. Browser-reserved shortcuts are not intercepted unnecessarily. All commands appear in a visible menu with the effective platform binding.

## Pointer robustness
Use pointer capture for committed gestures; handle pointercancel, lost capture, multitouch, window blur and Escape as cancellation. Touch panning and selection have distinct affordances, not long-press timing alone. Transform input coordinates through actual rendered matrices. A pointer release outside the canvas does not create a distant object. Research references show the available pointer-capture/cancellation primitives, not an assurance that an application uses them correctly. [R26]

## Testing
Include mouse, keyboard-only, touch emulation, 200% zoom, high contrast, reduced motion, narrow viewport, long Unicode names, RTL text and screen-reader review. Reference framework accessibility features can inform the design but do not transfer compliance automatically. [R08]
