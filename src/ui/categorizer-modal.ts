import { App, Modal, Setting, Notice, TFile, TFolder } from 'obsidian';
import { CategorizerService, CategorizerOptions } from '../modules/categorizer';
import { OllamaService } from '../modules/ollama';
import { CoherenceSettings } from '../types';

export class CategorizerModal extends Modal {
    service: CategorizerService;
    target: TFile | TFolder | null;
    settings: CoherenceSettings;

    // State
    model: string;
    selectedDictionary: string;
    maxCategories: number;
    applyAsTag: boolean;
    applyAsBacklink: boolean;
    moveToFolder: boolean;
    recursive = false;
    ollamaModels: string[] = [];

    constructor(app: App, settings: CoherenceSettings, target?: TFile | TFolder) {
        super(app);
        this.settings = settings;
        const ollama = new OllamaService(settings.ollamaUrl);
        this.service = new CategorizerService(app, ollama);
        this.target = target || null;

        // Initialize state from settings
        this.model = settings.categorizerModel || 'llama3';
        this.selectedDictionary = settings.categorizerActiveDictionary || 'General';
        this.maxCategories = settings.categorizerMaxCategories || 1;
        this.applyAsTag = settings.categorizerApplyAsTag;
        this.applyAsBacklink = settings.categorizerApplyAsBacklink;
        this.moveToFolder = settings.categorizerMoveToFolder;
    }

    async onOpen() {
        await this.fetchModels();
        this.display();
    }

    async fetchModels() {
        try {
            const ollama = new OllamaService(this.settings.ollamaUrl);
            this.ollamaModels = await ollama.listModels();
            if (this.ollamaModels.length === 0) {
                this.ollamaModels = ['llama3', 'mistral', 'gemma'];
            }
        } catch (e) {
            console.error('Failed to fetch models', e);
            this.ollamaModels = ['llama3', 'mistral', 'gemma'];
        }
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Categorizer').setHeading();

        if (this.target) {
            const type = this.target instanceof TFile ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.target.name} (${type})` });
        } else {
            contentEl.createEl('p', { text: 'No target selected.', cls: 'error-text' });
            return;
        }

        // Model Dropdown
        new Setting(contentEl)
            .setName('Model')
            .addDropdown(drop => {
                this.ollamaModels.forEach(m => drop.addOption(m, m));
                if (!this.ollamaModels.includes(this.model)) {
                    drop.addOption(this.model, this.model);
                }
                drop.setValue(this.model)
                    .onChange(v => this.model = v);
            });

        // Dictionary Dropdown
        new Setting(contentEl)
            .setName('Dictionary')
            .setDesc('Select the category dictionary to use')
            .addDropdown(drop => {
                if (this.settings.categorizerDictionaries) {
                    this.settings.categorizerDictionaries.forEach((d: { name: string }) => drop.addOption(d.name, d.name));
                }
                drop.setValue(this.selectedDictionary)
                    .onChange(v => this.selectedDictionary = v);
            });

        // Max Categories
        new Setting(contentEl)
            .setName('Max categories')
            .setDesc('Maximum number of categories to apply per file')
            .addText(text => text
                .setValue(String(this.maxCategories))
                .onChange(v => {
                    const num = parseInt(v);
                    if (!isNaN(num) && num > 0) this.maxCategories = num;
                }));

        new Setting(contentEl).setName('Application options').setHeading();

        new Setting(contentEl)
            .setName('Apply as tag')
            .addToggle(t => t.setValue(this.applyAsTag).onChange(v => this.applyAsTag = v));

        new Setting(contentEl)
            .setName('Apply as backlink')
            .addToggle(t => t.setValue(this.applyAsBacklink).onChange(v => this.applyAsBacklink = v));

        new Setting(contentEl)
            .setName('Move to folder')
            .setDesc('Move/Copy file to category folder(s)')
            .addToggle(t => t.setValue(this.moveToFolder).onChange(v => this.moveToFolder = v));

        // Recursive (if folder)
        if (!(this.target instanceof TFile)) {
            new Setting(contentEl)
                .setName('Recursive')
                .setDesc('Process subfolders')
                .addToggle(t => t.setValue(this.recursive).onChange(v => this.recursive = v));
        }

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Start categorizing')
                .setCta()
                .onClick(async () => {
                    btn.setButtonText('Processing...').setDisabled(true);

                    // Get categories from selected dictionary
                    // Get categories from selected dictionary
                    const dict = this.settings.categorizerDictionaries.find((d: { name: string }) => d.name === this.selectedDictionary);
                    const categories = dict ? dict.content.split('\n')
                        .map((c: string) => c.split(';')[0].trim()) // Split by ; and take first part
                        .filter((c: string) => c.length > 0) : [];

                    if (categories.length === 0) {
                        new Notice('Selected dictionary is empty!');
                        btn.setButtonText('Start categorizing').setDisabled(false);
                        return;
                    }

                    const options: CategorizerOptions = {
                        model: this.model,
                        categories: categories,
                        maxCategories: this.maxCategories,
                        applyAsTag: this.applyAsTag,
                        applyAsBacklink: this.applyAsBacklink,
                        moveToFolder: this.moveToFolder
                    };

                    try {
                        if (this.target instanceof TFile) {
                            const cats = await this.service.categorizeFile(this.target, options);
                            if (cats.length > 0) {
                                new Notice(`Categorized as: ${cats.join(', ')}`);
                            } else {
                                new Notice('No categories assigned.');
                            }
                        } else {
                            const res = await this.service.processFolder(this.target.path, options, this.recursive);
                            new Notice(`Processed: ${res.processed}, Categorized: ${res.categorized}, Errors: ${res.errors}`);
                        }
                        this.close();
                    } catch (e) {
                        new Notice('Error during categorization');
                        console.error(e);
                        btn.setButtonText('Start categorizing').setDisabled(false);
                    }
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
