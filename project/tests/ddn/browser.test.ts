/** Compile-time capability boundaries only; this file is never executed. */
import type { Runtime, RuntimeOptions, AuthorityProvider, CommandService } from '@ddn/types/core';
import type { Viewer, Designer, ViewerOptions, DesignerOptions, CaptureRequest } from '@ddn/types/browser';

declare const runtime: Runtime;
declare const runtimeOptions: RuntimeOptions;
declare const viewer: Viewer;
declare const designer: Designer;
declare const authority: AuthorityProvider;
const existing: ViewerOptions = { runtime };
const owned: ViewerOptions = { runtimeOptions };
const editing: DesignerOptions = { authority };
const commands: CommandService = designer.commands;
const capture: CaptureRequest = { scope: { kind: 'workarea' }, format: 'svg', extent: 'content', includePreview: false, partial: 'label', stale: 'reject' };
void [existing, owned, editing, commands, capture];

// @ts-expect-error A viewer receives either a runtime or its construction options, never both.
const ambiguous: ViewerOptions = { runtime, runtimeOptions };
// @ts-expect-error The viewer is not an editing command surface.
viewer.commands;
// @ts-expect-error Supplied live updates use the host runtime, not a viewer editing route.
viewer.ingest;
// @ts-expect-error Editing requires an authority provider.
const unauthorized: DesignerOptions = { controls: 'standard' };
// @ts-expect-error Captures must state partial/stale handling rather than assume success.
const incompleteCapture: CaptureRequest = { scope: { kind: 'workarea' }, format: 'svg', extent: 'content', includePreview: false };
void [ambiguous, unauthorized, incompleteCapture];
