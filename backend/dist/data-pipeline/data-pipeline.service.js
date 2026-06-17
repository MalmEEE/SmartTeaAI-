"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var DataPipelineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataPipelineService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const PYTHON = process.env.PYTHON_BIN || 'python';
const SCRAPER_DIR = path.resolve(__dirname, '../../../../scraper');
let DataPipelineService = DataPipelineService_1 = class DataPipelineService {
    logger = new common_1.Logger(DataPipelineService_1.name);
    async runWeeklyScrape() {
        this.logger.log('Weekly scrape started');
        const [sltb, weather] = await Promise.all([
            this.runScraper('collect_sltb.py'),
            this.runScraper('collect_weather.py'),
        ]);
        this.logger.log(`SLTB: ${sltb['total_rows_added']} rows added, ${sltb['feature_rows']} feature rows`);
        this.logger.log(`Weather: ${weather['rows_inserted']} rows inserted, ${weather['features_updated']} features updated`);
        return { sltb, weather };
    }
    async runScraper(scriptName) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(SCRAPER_DIR, scriptName);
            const proc = (0, child_process_1.spawn)(PYTHON, [scriptPath], {
                env: { ...process.env },
            });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
            proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
            proc.on('close', (code) => {
                if (stderr)
                    this.logger.debug(`[${scriptName}] ${stderr.trim()}`);
                try {
                    const result = JSON.parse(stdout.trim());
                    if (result.status === 'error') {
                        this.logger.error(`[${scriptName}] ${result.message}`);
                    }
                    resolve(result);
                }
                catch {
                    reject(new Error(`[${scriptName}] bad output (exit ${code}): ${stdout.slice(0, 200)}`));
                }
            });
            proc.on('error', reject);
        });
    }
};
exports.DataPipelineService = DataPipelineService;
__decorate([
    (0, schedule_1.Cron)('0 2 * * 0'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], DataPipelineService.prototype, "runWeeklyScrape", null);
exports.DataPipelineService = DataPipelineService = DataPipelineService_1 = __decorate([
    (0, common_1.Injectable)()
], DataPipelineService);
//# sourceMappingURL=data-pipeline.service.js.map