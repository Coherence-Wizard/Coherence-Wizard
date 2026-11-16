import { App, Modal, Setting, DropdownComponent, Notice, TFile, TFolder } from 'obsidian';
import { ONE_SHOT_SUMMARY_PROMPT } from '../modules/summarizer';
import { validSummaryWordLimit } from '../modules/summary-limits';
import { SummarizationRequest } from '../modules/summarization-job';
import { AIService, createAIService, AIConnectionSettings } from '../modules/ai-service';
import { CoherenceSettings } from '../../main';

export class SummarizerModal extends Modal {
    mode: 'multi-stage' | 'one-shot';
    oneShotPrompt: string;
    disableThinking: boolean;
    addShortSummary: boolean;
    mainMaxWords: number;
    shortMaxWords: number;
    private connection: AIConnectionSettings;
    private modelError = '';
    ollama: AIService;
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
        this.ollama = createAIService(settings);
        this.connection = { aiProvider: settings.aiProvider, ollamaUrl: settings.ollamaUrl, openaiBaseUrl: settings.openaiBaseUrl, openaiApiKey: settings.openaiApiKey };
        this.mode = settings.summarizerMode;
        this.disableThinking = settings.summarizerDisableThinking;
        this.addShortSummary = settings.summarizerAddShortSummary;
        this.mainMaxWords = settings.summarizerMainMaxWords;
        this.shortMaxWords = settings.summarizerShortMaxWords;
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
        } catch (error) {
            this.modelError = error instanceof Error ? error.message : String(error);
        }

        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Summarize files').setHeading();

        // Model Selection
        new Setting(contentEl)
            .setName('Model')
            .addDropdown((drop: DropdownComponent) => {
                drop.addOption('', 'Select a model');
                if (this.selectedModel && !this.models.includes(this.selectedModel)) drop.addOption(this.selectedModel, this.selectedModel);
                this.models.forEach(m => {drop.addOption(m, m)});
                drop.setValue(this.selectedModel);
                drop.onChange(async (value: string) => {
                    this.selectedModel = value;
                    await this.saveSettings('summarizerModel', value);
                });
            });

        if (this.modelError) contentEl.createEl('p', { text: this.modelError, cls: 'coherence-text-error' });
        new Setting(contentEl).setName('Model ID')
            .setDesc('Enter the exact ID if it is not in the list. Configure the provider and API key in the AI connection settings tab.')
            .addText(text => text.setValue(this.selectedModel).onChange(async value => {
                this.selectedModel = value.trim();
                await this.saveSettings('summarizerModel', this.selectedModel);
            }));
        contentEl.createEl('p', { text: 'Markdown formatting, tags, backlinks, and dates (such as 2026-11-16 or 2026-11-16_123456) are removed before counting words. A body within the main word limit is copied directly into the normal summary without AI, in either mode. The optional short summary may still need AI.' });

        new Setting(contentEl)
            .setName('Summary mode')
            .setDesc('One-shot creates the normal summary in one pass, without an introduction. Overlong responses get up to two rewrite attempts. Multi-stage uses your enabled prompts in sequence.')
            .addDropdown(drop => drop
                .addOption('multi-stage', 'Multi-stage prompts')
                .addOption('one-shot', 'One-shot')
                .setValue(this.mode)
                .onChange(value => {
                    this.mode = value as 'multi-stage' | 'one-shot';
                    this.display();
                }));

        for (const [key, name] of [
            ['mainMaxWords', 'Main summary maximum words'],
            ['shortMaxWords', 'Short summary maximum words'],
        ] as const) {
            new Setting(contentEl).setName(name)
                .setDesc('Whole number from 1 to 10000 for this batch. Defaults: 50 main, 10 short. Short limit applies only when adding a short summary.')
                .addText(text => {
                    text.inputEl.type = 'number';
                    text.inputEl.setAttribute('min', '1'); text.inputEl.setAttribute('max', '10000'); text.inputEl.setAttribute('step', '1');
                    text.setValue(String(this[key])).onChange(value => {
                        this[key] = Number(value);
                        text.inputEl.setAttribute('aria-invalid', String(!validSummaryWordLimit(this[key])));
                    });
                });
        }

        new Setting(contentEl)
            .setName('Add short summary')
            .setDesc('Also add summary_short to YAML using the short word limit. Uses an extra AI request when the cleaned normal summary exceeds that limit, even for a short note. Fills missing fields; enable overwrite to replace existing values.')
            .addToggle(toggle => toggle.setValue(this.addShortSummary).onChange(value => this.addShortSummary = value));

        new Setting(contentEl)
            .setName('Disable thinking')
            .setDesc('Request faster summaries without reasoning, when supported by the model and server. Applies to this batch, including multi-stage prompts and optional titles. Turn off to use the server default. Compatible servers must support the enable_thinking chat-template option.')
            .addToggle(toggle => toggle.setValue(this.disableThinking).onChange(value => this.disableThinking = value));

        // Options
        new Setting(contentEl)
            .setName('Recursive')
            .setDesc('Process subfolders (if target is folder)')
            .addToggle(toggle => toggle
                .setValue(this.recursive)
                .onChange(value => this.recursive = value));

        new Setting(contentEl)
            .setName('Overwrite existing')
            .setDesc('Replace existing summary values. When off, only missing requested fields are added.')
            .addToggle(toggle => toggle
                .setValue(this.overwrite)
                .onChange(value => this.overwrite = value));

        if (this.mode === 'multi-stage') {
            new Setting(contentEl)
                .setName('Generate title for untitled')
                .setDesc('Automatically rename untitled files using an additional AI-generated title')
                .addToggle(toggle => toggle.setValue(this.generateTitle).onChange(value => this.generateTitle = value));
        }

        contentEl.createEl('p', { text: 'Starting closes this dialog. The batch progress bar and a stop button appear in the right sidebar while you continue using Obsidian. Stopping or finishing an AI batch automatically unloads its model on Ollama and Unsloth. Other compatible servers manage their own model memory.' });
        new Setting(contentEl)
            .addButton(button => button
                .setButtonText('Start summarization')
                .setCta()
                .onClick(async () => {
                    if (!validSummaryWordLimit(this.mainMaxWords) || !validSummaryWordLimit(this.shortMaxWords)) {
                        new Notice('Enter whole-number summary word limits from 1 to 10000.');
                        return;
                    }
                    const target = this.app.vault.getAbstractFileByPath(this.targetPath);
                    if (!(target instanceof TFile || target instanceof TFolder) || (target instanceof TFile && target.extension !== 'md')) {
                        new Notice('Choose a Markdown note or folder.');
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
                            target, ...this.connection, model: this.selectedModel,
                            recursive: this.recursive, overwrite: this.overwrite, prompts,
                            generateTitle: this.mode === 'multi-stage' && this.generateTitle, mainMaxWords: this.mainMaxWords, shortMaxWords: this.shortMaxWords, oneShot: this.mode === 'one-shot',
                            maxChars: this.maxChars, includeYaml: this.includeYaml, disableThinking: this.disableThinking, addShortSummary: this.addShortSummary,
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
