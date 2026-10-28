# Appearance controls and presets

Open the [review page](../../website/features/appearance.html) to compare the
Light, Dark, Midnight and Warm interfaces and four texture families. Select a note and
choose **Appearance & presets**. Background, Font and Presets use a shared
movable floating form; **Properties** and **Paper & attachments** use the same
shell. Drag the title to move a form, or focus its Move control and use the arrow
keys. The diagram remains available for selection, pan and zoom. Forms name
the item they are editing and retain that target until closed.

Numeric appearance settings use sliders alongside precise number fields. These
include texture scale/opacity, font size, shadow softness/lift/opacity and
attachment size/rotation/opacity. Seeds and very large numeric ranges retain
number fields. Colours use the shared picker; enumerated settings use choices.

The fixed inspection drawer is removed. **Item details** opens a floating
read-only inspection form; complete values and inheritance are collapsed under
**All properties and inheritance**. **Properties** provides typed editable
controls, with raw path/JSON editing available under **Advanced property**.

The source scope selector distinguishes one appearance, a shared element, a
view/placement and the workarea. Changes remain staged until Apply. Apply is
one undoable source edit, and Cancel leaves the document unchanged. Workarea
controls edit its background; element and view controls also expose typography.
Textures preserve the original geometry and use repeatable vector tiles in the
viewer and SVG/PNG captures.

Save a user preset in the browser, export its JSON, or import a company pack.
Company entries are read-only library entries; use **Save user preset** for a
customised copy. Export remains available when browser storage is blocked.
The [example company pack](../../website/examples/appearance/company-presets.json)
contains a warm note and a dotted workarea.

Presets are appearance data, not a new defaults tier. Applying one copies its
settings into the selected source scope. Explicit file settings still override
CSS, and CSS overrides standard defaults. The exact selected owner must support
every supplied property; invalid or incompatible settings commit nothing.

**Interface** and **UI colours** in the application header control the tools
separately. A Dark interface can display and export a warm paper diagram.
Preferences are remembered locally when browser storage permits. The standalone
tools and review website start in Dark when no saved preference exists. They
use the existing DDN marks, local interface glyphs and bundled typography.
**Hide source** gives the canvas more space without discarding source edits;
**Show source** restores the same editor. On narrow screens, viewer/designer
source starts collapsed and **Document tools** reveals file/export controls;
editing toolbars scroll horizontally to keep the diagram visible. A neutral canvas backing keeps
transparent diagrams readable independently of the interface theme. The generated
web page resources include the [optional local font pack](FONTS.md); font
resources can also be exported/imported from the Font tab. Loading a custom
font stays on the client. Keep its resources with the documents that use it.

Hosts can reuse the modules directly:

```js
import { setUITheme } from './modules/viewer/src/ui-theme.js';
import { createStandardDialog, colourField }
  from './modules/designer/src/dialogs.js';

setUITheme(container, 'warm', { '--ddn-ui-accent': '#8b4c32' });
let colour;
const dialog = createStandardDialog(container, {
  title: 'Choose a colour',
  onApply: () => saveColour(colour.value),
});
colour = colourField(dialog.body, 'Colour', '#f5e9d4');
```

The [adopted extension](../../standard/codex/APPEARANCE-PRESETS-AND-DIALOGS.md)
defines the compact metrics, portable format and source/authority boundaries.
Central company administration and policy enforcement remain Weaver service
work; importing a file labelled company does not authenticate its publisher.
