/** Checked separately with ES2022 only, no DOM or Node ambient libraries. */
import type { Runtime, ModelSnapshot, Ref, ScenePatch } from '@ddn/types';
declare const runtime: Runtime;
declare const snapshot: ModelSnapshot;
declare const ref: Ref;
declare const patch: ScenePatch;
void [runtime, snapshot, ref, patch];
// @ts-expect-error Headless consumers do not require a browser document.
declare const documentType: typeof document;
// @ts-expect-error Headless consumers do not require the Node Buffer type.
declare const nodeBuffer: Buffer;
void [documentType, nodeBuffer];
