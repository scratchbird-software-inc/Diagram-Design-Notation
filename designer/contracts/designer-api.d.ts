/** Proposed future Designer command service. Not currently exported by DDNLive. */
export type Scope = "model" | "view" | "session";
export interface CommandRequest { commandId: string; expectedRevision: number; intent: string; policy: "design"|"review"; type: string; payload: Readonly<Record<string, unknown>>; }
export interface Diagnostic { code: string; severity: "error"|"warning"|"incomplete"|"information"; message: string; subjectId?: string; }
export interface SourceEdit { file: string; start: number; end: number; text: string; oldTextHash: string; }
export interface ChangePlan { format: "ddn-change-plan@1"; commandId: string; baseRevision: number; planHash: string; edits: readonly SourceEdit[]; impact: { changedDefinitionIds: readonly string[]; affectedViewIds: readonly string[]; requiresConfirmation: boolean }; diagnostics: readonly Diagnostic[]; }
export interface CommandService {
  prepare(request: CommandRequest, options?: {signal?: AbortSignal}): Promise<ChangePlan>;
  commit(plan: ChangePlan, confirmation?: {planHash: string}): Promise<{revision:number; diagnostics:readonly Diagnostic[]}>;
  cancel(commandId:string): void;
  undo(): Promise<{revision:number}>;
  redo(): Promise<{revision:number}>;
}
export interface DesignerMountOptions { workspace: unknown; entry:string; view:string; commands:CommandService; permissions:{editSource:boolean; exportSource:boolean; installProfiles:false}; }
/** Abort signals are only valid cancellation claims once the production worker protocol is implemented. */
export declare function mountDesigner(container:HTMLElement, options:DesignerMountOptions): {destroy():void};
