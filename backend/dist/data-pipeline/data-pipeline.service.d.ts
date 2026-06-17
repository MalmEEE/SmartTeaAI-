export declare class DataPipelineService {
    private readonly logger;
    runWeeklyScrape(): Promise<{
        sltb: Record<string, unknown>;
        weather: Record<string, unknown>;
    }>;
    runScraper(scriptName: string): Promise<Record<string, unknown>>;
}
