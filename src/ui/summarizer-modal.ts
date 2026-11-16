import { App, Modal, Setting, DropdownComponent, Notice, TFile, TFolder } from 'obsidian';
import { ONE_SHOT_SUMMARY_PROMPT } from '../modules/summarizer';
import { SummarizationRequest } from '../modules/summarization-job';
import { OllamaService } from '../modules/ollama';
import { CoherenceSettings } from '../../main';

export class SummarizerModal extends Modal {
    mode: 'multi-stage' | 'one-shot';
    oneShotPrompt: string;
    private ollamaUrl: string;
    ollama: OllamaService;
    target: TFile | TFolder | null = null;
    targetPath = '/';

    // Settings
    selectedModel: string;
    recursive: boolean;
    overwrite: boolean;
    includeYaml: boolean;
    maxChars: number;
    prompt: string;
    prompt2: string;
    prompt3: string;
    prompt4: string;

    prompt1Enabled: boolean;
    prompt2Enabled: boolean;
    prompt3Enabled: boolean;
    prompt4Enabled: boolean;
    generateTitle: boolean;

    models: string[] = [];

    saveSettings: (key: string, value: unknown) => Promise<void>;

    constructor(app: App, settings: CoherenceSettings, saveSettings: (key: string, value: unknown) => Promise<void>, target: TFile | TFolder | undefined, private startRun: (request: SummarizationRequest) => Promise<boolean>) {
        super(app);
        this.ollama = new OllamaService(settings.ollamaUrl);
        this.ollamaUrl = settings.ollamaUrl;
        this.mode = settings.summarizerMode;
        this.oneShotPrompt = settings.summarizerOneShotPrompt || ONE_SHOT_SUMMARY_PROMPT;
        this.saveSettings = saveSettings;
        this.target = target || null;

        // Load defaults from settings
        this.selectedModel = settings.summarizerModel;
        this.recursive = settings.summarizerRecursive;
        this.overwrite = settings.summarizerOverwrite;
        this.includeYaml = settings.summarizerIncludeYaml;
        this.maxChars = settings.summarizerMaxChars;
        this.prompt = settings.summarizerPrompt;
        this.prompt2 = settings.summarizerPrompt2;
        this.prompt3 = settings.summarizerPrompt3;
        this.prompt4 = settings.summarizerPrompt4;
        this.prompt1Enabled = settings.summarizerPrompt1Enabled;
        this.prompt2Enabled = settings.summarizerPrompt2Enabled;
        this.prompt3Enabled = settings.summarizerPrompt3Enabled;
        this.prompt4Enabled = settings.summarizerPrompt4Enabled;
        this.generateTitle = settings.summarizerGenerateTitle;

        if (this.target) {
            this.targetPath = this.target.path;
        } else {
            // Default to active file's parent folder or root
            const active = this.app.workspace.getActiveFile();
            this.targetPath = active ? active.parent?.path || '/' : '/';
        }
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Summarize files').setHeading();
        contentEl.createEl('p', { text: 'Loading models...' });

        try {
            this.models = await this.ollama.listModels();
        } catch {
            contentEl.createEl('p', { text: 'Failed to load models. Is Ollama running?', cls: 'error-text' });
        }

        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Summarize files').setHeading();

        // Model Selection
        new Setting(contentEl)
            .setName('Ollama model')
            .addDropdown((drop: DropdownComponent) => {
                drop.addOption('', 'Select a model');
                this.models.forEach(m => {drop.addOption(m, m)});
                drop.setValue(this.selectedModel);
                drop.onChange(async (value: string) => {
                    this.selectedModel = value;
                    await this.saveSettings('summarizerModel', value);
                });
            });

        new Setting(contentEl)
            .setName('Summary mode')
            .setDesc('One-shot creates a summary of at most 50 words in one request, without an introduction. Multi-stage uses your enabled prompts in sequence.')
            .addDropdown(drop => drop
                .addOption('multi-stage', 'Multi-stage prompts')
                .addOption('one-shot', 'One-shot · 50 words or fewer')
                .setValue(this.mode)
                .onChange(value => {
                    this.mode = value as 'multi-stage' | 'one-shot';
                    this.display();
                }));

        // Options
        new Setting(contentEl)
            .setName('Recursive')
            .setDesc('Process subfolders (if target is folder)')
            .addToggle(toggle => toggle
                .setValue(this.recursive)
                .onChange(value => this.recursive = value));

        new Setting(contentEl)
            .setName('Overwrite existing')
            .setDesc('Re-summarize files that already have a summary')
            .addToggle(toggle => toggle
                .setValue(this.overwrite)
                .onChange(value => this.overwrite = value));

        new Setting(contentEl)
            .setName('Generate title for untitled')
            .setDesc(this.mode === 'one-shot' ? 'One-shot keeps filenames unchanged to use exactly one generation request per note.' : 'Automatically rename untitled files using an additional AI-generated title')
            .addToggle(toggle => toggle
                .setValue(this.mode === 'one-shot' ? false : this.generateTitle)
                .setDisabled(this.mode === 'one-shot')
                .onChange(value => this.generateTitle = value));

        contentEl.createEl('p', { text: 'Starting closes this dialog. The batch progress bar and a stop button appear in the left sidebar while you continue using Obsidian. Stopping or finishing the batch automatically unloads its model.' });
        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Start summarization')
                .setCta()
                .onClick(async () => {
                    const target = this.app.vault.getAbstractFileByPath(this.targetPath);
                    if (!(target instanceof TFile || target instanceof TFolder) || (target instanceof TFile && target.extension !== 'md')) {
                        new Notice('Choose a Markdown note or folder.');
                        return;
                    }
                    if (!this.selectedModel.trim()) {
                        new Notice('Choose an Ollama model first.');
                        return;
                    }
                    const prompts: string[] = [];
                    if (this.mode === 'one-shot') prompts.push(this.oneShotPrompt);
                    else {
                        if (this.prompt1Enabled) prompts.push(this.prompt);
                        if (this.prompt2Enabled) prompts.push(this.prompt2);
                        if (this.prompt3Enabled) prompts.push(this.prompt3);
                        if (this.prompt4Enabled) prompts.push(this.prompt4);
                        if (!prompts.some(prompt => prompt.trim())) {
                            new Notice('Enable at least one nonempty prompt in settings, or choose one-shot mode.');
                            return;
                        }
                    }
                    button.setDisabled(true);
                    try {
                        const started = await this.startRun({
                            target, ollamaUrl: this.ollamaUrl, model: this.selectedModel,
                            recursive: this.recursive, overwrite: this.overwrite, prompts,
                            generateTitle: this.generateTitle, oneShot: this.mode === 'one-shot',
                            maxChars: this.maxChars, includeYaml: this.includeYaml,
                        });
                        if (started) this.close();
                    } catch (error) {
                        new Notice(`Could not start summarization: ${error instanceof Error ? error.message : String(error)}`);
                    } finally { button.setDisabled(false); }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
