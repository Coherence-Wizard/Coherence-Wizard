import { App, Modal, Setting, Notice, TFile, TFolder } from 'obsidian';
import { WisdomService } from '../modules/wisdom';
import { OllamaService } from '../modules/ollama';
import { CoherenceSettings } from '../types';

export class WisdomModal extends Modal {
    service: WisdomService;
    ollama: OllamaService;
    target: TFile | TFolder | null = null;

    // Settings
    selectedModel: string;
    mode: 'safe' | 'generalized';
    prompt: string;

    models: string[] = [];

    constructor(app: App, settings: CoherenceSettings, target?: TFile | TFolder) {
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
        new Setting(contentEl).setName('Wisdom extractor').setHeading();
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
        new Setting(contentEl).setName('Wisdom extractor').setHeading();

        if (this.target) {
            const type = this.target instanceof TFile ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.target.name} (${type})` });
        } else {
            contentEl.createEl('p', { text: 'No file or folder selected.', cls: 'error-text' });
            return;
        }

        // Model Selection
        new Setting(contentEl)
            .setName('Ollama model')
            .addDropdown(drop => {
                this.models.forEach(m => {drop.addOption(m, m)});
                drop.setValue(this.selectedModel);
                drop.onChange(value => this.selectedModel = value);
            });

        // Mode Selection#

        const desc = 'Generalized (AI rewrite) or safe (copy as-is)';
    
        new Setting(contentEl)
            .setName('Mode')
            .setDesc(desc)
            .addDropdown(drop => drop
                .addOption('generalized', 'Generalized (AI)')
                .addOption('safe', 'Safe (copy only)')
                .setValue(this.mode)
                .onChange(value => this.mode = value as 'safe' | 'generalized'));

        // Action
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Extract wisdom')
                .setCta()
                .onClick(() => {
                    void (async () => {
                        btn.setButtonText('Processing...').setDisabled(true);
                        try {
                            if (this.target instanceof TFile) {
                                // Single File
                                const result = await this.service.processFile(
                                    this.target,
                                    this.selectedModel,
                                    this.mode,
                                    this.prompt
                                );
                                new Notice(result);
                            } else if (this.target instanceof TFolder) {
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
                            btn.setButtonText('Extract wisdom').setDisabled(false);
                        }
                    })();
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
