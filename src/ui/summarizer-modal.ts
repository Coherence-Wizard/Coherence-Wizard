import { App, Modal, Setting, DropdownComponent } from 'obsidian';
import { SummarizerService } from '../modules/summarizer';
import { OllamaService } from '../modules/ollama';
import { CoherenceSettings } from '../../main';

export class SummarizerModal extends Modal {
    service: SummarizerService;
    ollama: OllamaService;
    target: any = null; // TFile or TFolder
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

    constructor(app: App, settings: CoherenceSettings, saveSettings: (key: string, value: any) => Promise<void>, target?: any) {
        super(app);
        this.ollama = new OllamaService(settings.ollamaUrl);
        this.service = new SummarizerService(app, this.ollama);
        this.service = new SummarizerService(app, this.ollama);
        this.saveSettings = saveSettings;
        this.target = target;

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
            this.targetPath = active ? active.parent.path : '/';
        }
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Summarize Files' });
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
        contentEl.createEl('h2', { text: 'Summarize Files' });

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
                .onClick(async () => {
                    btn.setButtonText('Processing...').setDisabled(true);

                    // Create Progress Bar
                    const progressContainer = contentEl.createDiv();
                    progressContainer.style.marginTop = '20px';
                    const progressBarBg = progressContainer.createDiv();
                    progressBarBg.style.width = '100%';
                    progressBarBg.style.height = '10px';
                    progressBarBg.style.backgroundColor = 'var(--background-modifier-border)';
                    progressBarBg.style.borderRadius = '5px';

                    const progressBar = progressBarBg.createDiv();
                    progressBar.style.width = '0%';
                    progressBar.style.height = '100%';
                    progressBar.style.backgroundColor = 'var(--interactive-accent)';
                    progressBar.style.borderRadius = '5px';
                    progressBar.style.transition = 'width 0.1s';

                    const progressText = progressContainer.createDiv();
                    progressText.style.marginTop = '5px';
                    progressText.style.fontSize = '0.8em';
                    progressText.style.color = 'var(--text-muted)';
                    progressText.setText(`Starting with model: ${this.selectedModel}...`);
                    console.log('Summarizer using model:', this.selectedModel);

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
                            if ('extension' in abstractFile) {
                                // File
                                const result = await this.service.summarizeFile(
                                    abstractFile as any,
                                    this.selectedModel,
                                    this.overwrite,
                                    prompts,
                                    this.generateTitle
                                );
                                new Notice(result ? 'Summary added.' : 'Skipped (exists).');
                            } else {
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
                        new Notice('Error during summarization. Check console.');
                        console.error(e);
                        btn.setButtonText('Start Summarization').setDisabled(false);
                        progressText.setText('Error occurred.');
                    }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// Helper for Notice since we can't import it inside class definition easily if not exported
import { Notice } from 'obsidian';
