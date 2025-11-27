import { App, Modal, Setting, TFolder, Notice, TFile } from 'obsidian';
import { SummarizerService } from '../modules/summarizer';
import { OllamaService } from '../modules/ollama';
import { CoherenceSettings } from '../types';

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

    constructor(app: App, settings: CoherenceSettings, target?: TFile | TFolder) {
        super(app);
        this.ollama = new OllamaService(settings.ollamaUrl);
        this.service = new SummarizerService(app, this.ollama);
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
        new Setting(contentEl).setName('Summarize files').setHeading();
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
        new Setting(contentEl).setName('Summarize files').setHeading();

        // Target Path (Read Only)


        // Model Selection
        new Setting(contentEl)
            .setName('Ollama model')
            .addDropdown(drop => {
                this.models.forEach(m => drop.addOption(m, m));
                drop.setValue(this.selectedModel);
                drop.onChange(value => this.selectedModel = value);
            });

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
            .setDesc('Automatically rename "Untitled" files using AI generated title')
            .addToggle(toggle => toggle
                .setValue(this.generateTitle)
                .onChange(value => this.generateTitle = value));



        // Action
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Start summarization')
                .setCta()
                .onClick(async () => {
                    btn.setButtonText('Processing...').setDisabled(true);
                    try {
                        const prompts = [this.prompt, this.prompt2, this.prompt3, this.prompt4];

                        // Check if path is file or folder
                        const abstractFile = this.app.vault.getAbstractFileByPath(this.targetPath);
                        if (abstractFile) {
                            if ('extension' in abstractFile) {
                                // File
                                const result = await this.service.summarizeFile(
                                    abstractFile as TFile,
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
                                    this.generateTitle
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
                    }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}


