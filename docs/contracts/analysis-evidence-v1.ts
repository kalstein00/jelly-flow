/** Proposed external contract. Not imported by Jelly or a production collector. */
export type Location = {
    file: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
};

export type Relation =
    | {kind: "may-call"; callsite: Location; target: Location; attribution: "unclassified"}
    | {kind: "return-transfer"; model: string; version: string; callsite: Location; argument: number}
    | {kind: "registration"; callsite: Location; target: Location; evidence: string}
    | {kind: "unresolved"; callsite: Location; reason: "no-static-target"};

type BaseEvidence = {
    schemaVersion: "jelly-flow-evidence/1";
    coverage: "bounded";
    selection: "DART closeViewInstance call and React return transfers";
    source: {head: string; entry: string; basedir: string; dependencyRoot: string; lockSha256: string};
    analyzer: {reference: string; cliSha256: string; node: string; options: Array<string>};
    budget: {heapMB: 4096; analysisSeconds: 90; deadlineSeconds: 120};
    registrationCoverage: "unavailable";
    limitations: Array<string>;
};

export type AnalysisEvidence = BaseEvidence & (
    | {termination: "failed"; relations: null; graphSha256: null; diagnostics: null;
       failure: {code: number | null; killed: boolean; heapOutOfMemory: boolean}}
    | {termination: "completed" | "partial"; relations: Array<Relation>; graphSha256: string;
       diagnostics: {errors: number; warnings: number; timeout: boolean; aborted: boolean; unprocessedTokens: number;
           memoryLimitReached?: boolean; terminationPhase?: string; finalizationStatus?: string; statisticsStatus?: string}}
);
