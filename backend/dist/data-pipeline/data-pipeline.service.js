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
var DataPipelineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataPipelineService = void 0;
const common_1 = require("@nestjs/common");
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const PYTHON = process.env.PYTHON_BIN || 'python';
const ML_ENGINE = path.resolve(__dirname, '../../../ml-engine');
let DataPipelineService = DataPipelineService_1 = class DataPipelineService {
    logger = new common_1.Logger(DataPipelineService_1.name);
    lastRun = null;
    async runWeeklyPipeline() {
        return this.runPipeline();
    }
    async runPipeline() {
        const startedAt = new Date().toISOString();
        this.logger.log('Data pipeline started');
        const steps = [];
        const [sltb, weather] = await Promise.all([
            this.runScript('collect_sltb.py'),
            this.runScript('collect_weather.py'),
        ]);
        steps.push(sltb, weather);
        if (sltb.status === 'error' || weather.status === 'error') {
            this.logger.error('SLTB or weather collection failed — aborting pipeline');
            const summary = this.buildSummary(startedAt, steps, false);
            this.lastRun = summary;
            return summary;
        }
        const [oil, fx, sentiment] = await Promise.all([
            this.runScript('collect_oil.py'),
            this.runScript('process_fx.py'),
            this.runScript('collect_sentiment.py'),
        ]);
        steps.push(oil, fx, sentiment);
        if (oil.status === 'error' || fx.status === 'error') {
            this.logger.error('Oil or FX collection failed — aborting pipeline');
            const summary = this.buildSummary(startedAt, steps, false);
            this.lastRun = summary;
            return summary;
        }
        if (sentiment.status === 'error') {
            this.logger.warn(`Sentiment collection failed (non-blocking, supplementary feature): ${sentiment.message}. ` +
                `Continuing pipeline — affected months keep neutral placeholder (0.0).`);
        }
        const preprocess = await this.runScript('preprocess_features.py');
        steps.push(preprocess);
        const success = preprocess.status === 'ok';
        const summary = this.buildSummary(startedAt, steps, success);
        this.lastRun = summary;
        if (success) {
            this.logger.log('Pipeline complete — feature matrix updated');
        }
        else {
            this.logger.error('Preprocessing failed');
        }
        return summary;
    }
    getLastRun() {
        return this.lastRun;
    }
    buildSummary(startedAt, steps, success) {
        return { startedAt, finishedAt: new Date().toISOString(), steps, success };
    }
    runScript(scriptName) {
        const scriptPath = path.join(ML_ENGINE, scriptName);
        const start = Date.now();
        return new Promise((resolve) => {
            const proc = (0, child_process_1.spawn)(PYTHON, [scriptPath], { env: { ...process.env } });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
            proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
            proc.on('close', (code) => {
                const durationMs = Date.now() - start;
                if (stderr)
                    this.logger.debug(`[${scriptName}] ${stderr.trim()}`);
                try {
                    const data = JSON.parse(stdout.trim());
                    if (data.status === 'error') {
                        this.logger.error(`[${scriptName}] ${data.message}`);
                        resolve({ script: scriptName, status: 'error', durationMs, message: data.message });
                    }
                    else {
                        resolve({ script: scriptName, status: 'ok', durationMs, data });
                    }
                }
                catch {
                    const message = `bad JSON output (exit ${code}): ${stdout.slice(0, 200)}`;
                    this.logger.error(`[${scriptName}] ${message}`);
                    resolve({ script: scriptName, status: 'error', durationMs, message });
                }
            });
            proc.on('error', (err) => {
                resolve({ script: scriptName, status: 'error', durationMs: Date.now() - start, message: err.message });
            });
        });
    }
};
exports.DataPipelineService = DataPipelineService;
exports.DataPipelineService = DataPipelineService = DataPipelineService_1 = __decorate([
    (0, common_1.Injectable)()
], DataPipelineService);
//# sourceMappingURL=data-pipeline.service.js.map