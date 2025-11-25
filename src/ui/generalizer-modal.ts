import { App, Modal, Setting, TFile, TFolder, Notice } from 'obsidian';
import { GeneralizerService } from '../modules/generalizer';
import { OllamaService } from '../modules/ollama';

export class GeneralizerModal extends Modal {
    private service: GeneralizerService;
    private ollamaService: OllamaService;
    private targetFolder: TFolder | null = null;
    private recursive: boolean = false;
    private outputMode: 'folder' | 'same-folder' = 'folder';
    private suffix: string = '_generalized';
    private model: string = 'llama3';
    private models: string[] = [];
    private mode: 'generalize' | 'wisdom' = 'generalize';
    private multiStage: boolean = false;

    constructor(app: App, private settings: any, private fileOrFolder?: TFile | TFolder) {
        super(app);
        this.service = new GeneralizerService(app, settings);
        this.ollamaService = new OllamaService(settings.ollamaUrl);
        this.recursive = settings.generalizerRecursive || false;
        this.outputMode = settings.generalizerOutputMode || 'folder';
        this.suffix = settings.generalizerSuffix || '_generalized';
        this.model = settings.generalizerModel || 'llama3';
        this.multiStage = settings.generalizerMultiStage || false;
    }

    async onOpen() {
        this.models = await this.ollamaService.getModels();
        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Generalizer (Wisdom Extractor)' });

        if (this.fileOrFolder) {
            const type = this.fileOrFolder instanceof TFile ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.fileOrFolder.path} (${type})` });
        } else {
            new Setting(contentEl)
                .setName('Target Folder')
                .setDesc('Select the folder to process')
                .addText(text => text
                    .setPlaceholder('Example: Folder/Subfolder')
                    .onChange(value => {
                        const folder = this.app.vault.getAbstractFileByPath(value);
                        if (folder instanceof TFolder) {
                            this.targetFolder = folder;
                        } else {
                            this.targetFolder = null;
                        }
                    }));
        }

        new Setting(contentEl)
            .setName('Mode')
            .setDesc('Select the generalization strategy')
            .addDropdown(drop => drop
                .addOption('generalize', 'Standard Generalization')
                .addOption('wisdom', 'Wisdom Extractor (Self-Help)')
                .setValue(this.mode)
                .onChange((value: any) => {
                    this.mode = value;
                    if (this.mode === 'wisdom') {
                        this.suffix = '_wisdom';
                    } else {
                        this.suffix = this.settings.generalizerSuffix || '_generalized';
                    }
                    this.display();
                }));

        new Setting(contentEl)
            .setName('Model')
            .setDesc('Select Ollama model')
            .addDropdown(drop => {
                this.models.forEach(m => drop.addOption(m, m));
                drop.setValue(this.model)
                    .onChange(value => this.model = value);
            });

        new Setting(contentEl)
            .setName('Multi-Stage Processing')
            .setDesc('Summarize text before generalizing (improves compliance for large files)')
            .addToggle(toggle => toggle
                .setValue(this.multiStage)
                .onChange(value => this.multiStage = value));

        // Recursive option (only relevant if target is a folder or no target yet)
        if (!this.fileOrFolder || this.fileOrFolder instanceof TFolder) {
            new Setting(contentEl)
                .setName('Recursive')
                .setDesc('Process subfolders')
                .addToggle(toggle => toggle
                    .setValue(this.recursive)
                    .onChange(value => this.recursive = value));
        }

        new Setting(contentEl)
            .setName('Output Mode')
            .setDesc('Where to save generalized files')
            .addDropdown(drop => drop
                .addOption('folder', 'New "Generalized" Folder')
                .addOption('same-folder', 'Same Folder (Next to original)')
                .setValue(this.outputMode)
                .onChange((value: any) => this.outputMode = value));

        new Setting(contentEl)
            .setName('Filename Suffix')
            .setDesc('Suffix to append to generalized files')
            .addText(text => text
                .setValue(this.suffix)
                .onChange(value => this.suffix = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Generalize')
                .setCta()
                .onClick(() => this.process()));
    }

    async process() {
        const target = this.fileOrFolder || this.targetFolder;

        if (!target) {
            new Notice('Invalid target selected');
            return;
        }

        this.close();
        new Notice('Generalizing...');

        const prompt = this.mode === 'wisdom'
            ? this.settings.generalizerWisdomPrompt
            : this.settings.generalizerPrompt;

        if (target instanceof TFile) {
            try {
                await this.service.processFile(
                    target,
                    this.model,
                    prompt,
                    this.outputMode,
                    this.suffix,
                    this.settings.generalizerSystemPrompt,
                    this.settings.generalizerMaxTokens,
                    this.settings.generalizerRepeatPenalty,
                    this.multiStage,
                    this.settings.generalizerIntermediatePrompt
                );
                new Notice(`Generalized ${target.basename}`);
            } catch (e) {
                new Notice(`Error generalizing ${target.basename}`);
            }
        } else if (target instanceof TFolder) {
            const result = await this.service.processFolder(
                target.path,
                this.model,
                prompt,
                this.outputMode,
                this.suffix,
                this.recursive,
                this.settings.generalizerSystemPrompt,
                this.settings.generalizerMaxTokens,
                this.settings.generalizerRepeatPenalty,
                this.multiStage,
                this.settings.generalizerIntermediatePrompt
            );
            new Notice(`Processed ${result.processed} files. Errors: ${result.errors}`);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
