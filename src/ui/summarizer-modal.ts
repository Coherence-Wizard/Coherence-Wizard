import { App, Modal, Setting, TFolder } from 'obsidian';
import { SummarizerService } from '../modules/summarizer';
import { OllamaService } from '../modules/ollama';

export class SummarizerModal extends Modal {
    service: SummarizerService;
    ollama: OllamaService;
    target: any = null; // TFile or TFolder
    targetPath: string = '/';

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

    constructor(app: App, settings: any, target?: any) {
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

        // Target Path (Read Only)


        // Model Selection
        new Setting(contentEl)
            .setName('Ollama Model')
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

// Helper for Notice since we can't import it inside class definition easily if not exported
import { Notice } from 'obsidian';
