import { App, Modal, Setting, Notice } from 'obsidian';
import { WisdomService } from '../modules/wisdom';
import { OllamaService } from '../modules/ollama';

export class WisdomModal extends Modal {
    service: WisdomService;
    ollama: OllamaService;
    target: any = null; // TFile or TFolder

    // Settings
    selectedModel: string;
    mode: 'safe' | 'generalized';
    prompt: string;

    models: string[] = [];

    constructor(app: App, settings: any, target?: any) {
        super(app);
        this.ollama = new OllamaService(settings.ollamaUrl);
        this.service = new WisdomService(app.vault, this.ollama);
        this.target = target ?? this.app.workspace.getActiveFile();

        // Load defaults from settings
        this.selectedModel = settings.wisdomModel;
        this.mode = settings.wisdomMode;
        this.prompt = settings.wisdomPrompt;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Wisdom Extractor' });
        contentEl.createEl('p', { text: 'Loading models...' });

        try {
            this.models = await this.ollama.listModels();
        } catch (e) {
            contentEl.createEl('p', { text: 'Failed to load models.', cls: 'error-text' });
        }

        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Wisdom Extractor' });

        if (this.target) {
            const type = this.target.extension ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.target.name} (${type})` });
        } else {
            contentEl.createEl('p', { text: 'No file or folder selected.', cls: 'error-text' });
            return;
        }

        // Model Selection
        new Setting(contentEl)
            .setName('Ollama Model')
            .addDropdown(drop => {
                this.models.forEach(m => drop.addOption(m, m));
                drop.setValue(this.selectedModel);
                drop.onChange(value => this.selectedModel = value);
            });

        // Mode Selection
        new Setting(contentEl)
            .setName('Mode')
            .setDesc('Generalized (AI Rewrite) or Safe (Copy as-is)')
            .addDropdown(drop => drop
                .addOption('generalized', 'Generalized (AI)')
                .addOption('safe', 'Safe (Copy Only)')
                .setValue(this.mode)
                .onChange(value => this.mode = value as any));

        // Action
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Extract Wisdom')
                .setCta()
                .onClick(async () => {
                    btn.setButtonText('Processing...').setDisabled(true);
                    try {
                        if (this.target.extension) {
                            // Single File
                            const result = await this.service.processFile(
                                this.target,
                                this.selectedModel,
                                this.mode,
                                this.prompt
                            );
                            new Notice(result);
                        } else {
                            // Folder
                            const result = await this.service.processFolder(
                                this.target.path,
                                this.selectedModel,
                                this.mode,
                                this.prompt
                            );
                            new Notice(`Batch Complete: ${result.processed} processed, ${result.skipped} skipped, ${result.errors} errors.`);
                        }
                        this.close();
                    } catch (e) {
                        new Notice('Error during extraction.');
                        console.error(e);
                        btn.setButtonText('Extract Wisdom').setDisabled(false);
                    }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
