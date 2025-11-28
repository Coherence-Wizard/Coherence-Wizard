import { App, Modal, Setting, DropdownComponent, Notice, TFile, TFolder } from 'obsidian';
import { SummarizerService } from '../modules/summarizer';
import { OllamaService } from '../modules/ollama';
import { CoherenceSettings } from '../../main';

export class SummarizerModal extends Modal {
    service: SummarizerService;
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
    generateTitle: boolean;

    models: string[] = [];

    saveSettings: (key: string, value: any) => Promise<void>;

    constructor(app: App, settings: CoherenceSettings, saveSettings: (key: string, value: any) => Promise<void>, target?: TFile | TFolder) {
        super(app);
        this.ollama = new OllamaService(settings.ollamaUrl);
        this.service = new SummarizerService(app, this.ollama);
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
        new Setting(contentEl).setName('Summarize Files').setHeading();
        contentEl.createEl('p', { text: 'Loading models...' });

        try {
            this.models = await this.ollama.listModels();
        } catch (e) {
            contentEl.createEl('p', { text: 'Failed to load models. Is Ollama running?', cls: 'error-text' });
        }

        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Summarize Files').setHeading();

        // Model Selection
        new Setting(contentEl)
            .setName('Ollama Model')
            .addDropdown((drop: DropdownComponent) => {
                drop.addOption('', 'Select a model');
                this.models.forEach(m => drop.addOption(m, m));
                drop.setValue(this.selectedModel);
                drop.onChange(async (value: string) => {
                    this.selectedModel = value;
                    await this.saveSettings('summarizerModel', value);
                });
            });

        // Options
        new Setting(contentEl)
            .setName('Recursive')
            .setDesc('Process subfolders (if target is folder)')
            .addToggle(toggle => toggle
                .setValue(this.recursive)
                .onChange(value => this.recursive = value));

        new Setting(contentEl)
            .setName('Overwrite Existing')
            .setDesc('Re-summarize files that already have a summary')
            .addToggle(toggle => toggle
                .setValue(this.overwrite)
                .onChange(value => this.overwrite = value));

        new Setting(contentEl)
            .setName('Generate Title for Untitled')
            .setDesc('Automatically rename "Untitled" files using AI generated title')
            .addToggle(toggle => toggle
                .setValue(this.generateTitle)
                .onChange(value => this.generateTitle = value));

        // Action
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Start Summarization')
                .setCta()
                .onClick(() => {
                    void (async () => {
                        btn.setButtonText('Processing...').setDisabled(true);

                        // Create Progress Bar
                        const progressContainer = contentEl.createDiv({ cls: 'coherence-progress-container' });
                        const progressBarBg = progressContainer.createDiv({ cls: 'coherence-progress-bar-bg' });
                        const progressBar = progressBarBg.createDiv({ cls: 'coherence-progress-bar-fill' });
                        const progressText = progressContainer.createDiv({ cls: 'coherence-progress-text' });
                        progressText.setText(`Starting with model: ${this.selectedModel}...`);

                        const onProgress = (processed: number, total: number, currentFile: string) => {
                            const percent = Math.floor((processed / total) * 100);
                            progressBar.style.width = `${percent}%`;
                            progressText.setText(`Processing ${processed}/${total}: ${currentFile}`);
                        };

                        try {
                            const prompts = [this.prompt, this.prompt2, this.prompt3, this.prompt4];

                            // Check if path is file or folder
                            const abstractFile = this.app.vault.getAbstractFileByPath(this.targetPath);
                            if (abstractFile) {
                                if (abstractFile instanceof TFile) {
                                    // File
                                    const result = await this.service.summarizeFile(
                                        abstractFile,
                                        this.selectedModel,
                                        this.overwrite,
                                        prompts,
                                        this.generateTitle
                                    );
                                    new Notice(result ? 'Summary added.' : 'Skipped (exists).');
                                } else if (abstractFile instanceof TFolder) {
                                    // Folder
                                    const result = await this.service.summarizeFolder(
                                        this.targetPath,
                                        this.selectedModel,
                                        this.recursive,
                                        this.overwrite,
                                        prompts,
                                        this.generateTitle,
                                        onProgress
                                    );
                                    new Notice(`Complete: ${result.processed} processed, ${result.skipped} skipped, ${result.errors} errors.`);
                                }
                            } else {
                                new Notice('Invalid path.');
                            }
                            this.close();
                        } catch (e) {
                            new Notice('Error during summarization.');
                            btn.setButtonText('Start Summarization').setDisabled(false);
                            progressText.setText('Error occurred.');
                        }
                    })();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
