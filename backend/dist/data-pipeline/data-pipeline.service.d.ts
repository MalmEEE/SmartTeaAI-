export interface PipelineResult {
    script: string;
    status: 'ok' | 'error';
    durationMs: number;
    data?: Record<string, unknown>;
    message?: string;
}
export interface RunSummary {
    startedAt: string;
    finishedAt: string;
    steps: PipelineResult[];
    success: boolean;
}
export declare class DataPipelineService {
    private readonly logger;
    private lastRun;
    runWeeklyPipeline(): Promise<RunSummary>;
    runPipeline(): Promise<RunSummary>;
    getLastRun(): RunSummary | null;
    private buildSummary;
    private runScript;
}
