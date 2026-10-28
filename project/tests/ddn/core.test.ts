/** Compile-time assertions only; this file is never executed. */
import type { CommandIntent, DataChange, Ref, Status, ModelSnapshot, SourceFile, Runtime, VersionSet, createRuntime } from '@ddn/types';
import type { ScenePatch } from '@ddn/types/scene';

declare const runtime: Runtime;
declare const snapshot: ModelSnapshot;
declare const scene: ScenePatch;
declare const versions: VersionSet;
const target: Ref = { file: 'main.ddn', id: 'entity-1' };
const statuses: readonly Status[] = ['draft', 'in-progress', 'in-review', 'accepted'];
const connect: CommandIntent = { kind: 'connect', view: target, from: target, to: { file: 'shared.ddn', id: 'entity-2' } };
const typedConnect: CommandIntent = { ...connect, relation: 'references' };
const update: DataChange = { kind: 'keyed', source: 'live', base: 'r1', next: 'r2', operations: [{ op: 'delete', key: 'one' }] };
type RuntimeFactory = typeof createRuntime;
declare const factory: RuntimeFactory;
const declaredRuntime: Runtime = factory({ versions, packs: [] });
void [runtime, scene, statuses, typedConnect, update, declaredRuntime];

// @ts-expect-error References require their physical file identity.
const unqualified: Ref = { id: 'entity-1' };
// @ts-expect-error Certification is not an alternate DDN lifecycle state.
const oldStatus: Status = 'certified';
// @ts-expect-error The new normalized envelope does not accept the PoC dialect version.
const oldContract: ModelSnapshot['contract'] = '0.8.0';
// @ts-expect-error Snapshots are immutable to consumers.
snapshot.rootFile = 'other.ddn';
// @ts-expect-error Keyed updates need their base revision.
const missingBase: DataChange = { kind: 'keyed', source: 'live', next: 'r2', operations: [] };
// @ts-expect-error Source text declares UTF-8 encoding, not an implicit platform encoding.
const invalidEncoding: SourceFile = { id: 'main.ddn', text: '', revision: 'r1', writable: true, encoding: 'utf-16' };
void [unqualified, oldStatus, oldContract, missingBase, invalidEncoding];
