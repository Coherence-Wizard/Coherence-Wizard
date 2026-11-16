import { App, TFile, TFolder } from 'obsidian';
import { AIService, createAIService, AIConnectionSettings } from './ai-service';
import { checkCancelled, SummarizerService } from './summarizer';

export interface SummarizationRequest extends AIConnectionSettings {
    target: TFile | TFolder;
    model: string;
    recursive: boolean;
    overwrite: boolean;
    prompts: string[];
    generateTitle: boolean;
    oneShot: boolean;
    maxChars: number;
    includeYaml: boolean;
}

export interface SummarizationState {
    status: 'idle' | 'running' | 'stopping' | 'completed' | 'stopped' | 'failed';
    model: string;
    target: string;
    total: number;
    completed: number;
    saved: number;
    skipped: number;
    errors: number;
    currentFile: string;
    stage: string;
    lastError: string;
    unloading: boolean;
    modelStatus: string;
}

export class SummarizationJob {
    state: SummarizationState = {
        status: 'idle', model: '', target: '', total: 0, completed: 0, saved: 0, skipped: 0,
        errors: 0, currentFile: '', stage: '', lastError: '', unloading: false, modelStatus: '',
    };
    completion: Promise<void> = Promise.resolve();
    private controller?: AbortController;
    private ollama?: AIService;
    private active = false;
    private modelUsed = false;
    private disposed = false;
    private listeners = new Set<() => void>();

    constructor(private app: App, private createService = createAIService) { }

    get busy(): boolean {
        return this.active;
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        listener();
        return () => { this.listeners.delete(listener); };
    }

    private notify() {
        this.listeners.forEach(listener => {
            try { listener(); }
            catch (error) { console.error('Could not update summarization progress', error); }
        });
    }

    start(request: SummarizationRequest): boolean {
        if (this.busy || this.disposed) return false;
        const snapshot = { ...request, prompts: [...request.prompts] };
        this.ollama = this.createService(snapshot);
        const service = new SummarizerService(this.app, this.ollama);
        const files = service.collectFiles(snapshot.target, snapshot.recursive);
        this.controller = new AbortController();
        this.active = true;
        this.modelUsed = false;
        this.state = {
            status: 'running', model: snapshot.model, target: snapshot.target.path, total: files.length,
            completed: 0, saved: 0, skipped: 0, errors: 0, currentFile: '', stage: 'Starting',
            lastError: '', unloading: false, modelStatus: '',
        };
        this.notify();
        this.completion = this.run(snapshot, files, service, this.controller.signal);
        return true;
    }

    stop(): void {
        if (this.state.status !== 'running' && this.state.status !== 'stopping') return;
        this.state.status = 'stopping';
        this.state.stage = 'Stopping current request';
        this.controller?.abort();
        this.notify();
    }

    private async run(request: SummarizationRequest, files: TFile[], service: SummarizerService, signal: AbortSignal): Promise<void> {
        try {
            for (const file of files) {
                checkCancelled(signal);
                this.state.currentFile = file.path;
                this.state.stage = 'Reading note';
                this.notify();
                try {
                    const saved = await service.summarizeFile(file, request.model, request.overwrite, request.prompts, request.generateTitle, {
                        onModelUse: () => { this.modelUsed = true; },
                        signal, oneShot: request.oneShot, maxChars: request.maxChars, includeYaml: request.includeYaml,
                        onStage: stage => { this.state.stage = stage; this.notify(); },
                    });
                    if (saved) this.state.saved++;
                    else this.state.skipped++;
                    this.state.completed++;
                } catch (error) {
                    checkCancelled(signal);
                    this.state.errors++;
                    this.state.completed++;
                    this.state.lastError = `${file.path}: ${error instanceof Error ? error.message : String(error)}`;
                }
                this.notify();
            }
            this.state.status = signal.aborted ? 'stopped' : 'completed';
        } catch (error) {
            this.state.status = signal.aborted ? 'stopped' : 'failed';
            if (!signal.aborted) this.state.lastError = error instanceof Error ? error.message : String(error);
        } finally {
            this.state.stage = '';
            this.state.currentFile = '';
            this.notify();
            await this.unloadModel();
            this.active = false;
            this.notify();
        }
    }

    private async unloadModel(): Promise<void> {
        if (!this.modelUsed) {
            this.state.modelStatus = 'No model was needed for this batch.';
            return;
        }
        if (!this.ollama || !this.state.model) return;
        this.state.unloading = true;
        this.state.modelStatus = 'Unloading model…';
        this.notify();
        try {
            const message = await this.ollama.unloadModel(this.state.model);
            this.state.modelStatus = message || 'Model unloaded.';
        } catch (error) {
            this.state.modelStatus = `Unload failed: ${error instanceof Error ? error.message : String(error)}`;
        } finally {
            this.state.unloading = false;
            this.notify();
        }
    }

    dispose(): void {
        this.disposed = true;
        this.stop();
        this.listeners.clear();
    }
}
