import { App, Modal, Setting, Notice, TFile, DropdownComponent } from 'obsidian';
import { CategorizerService, CategorizerOptions } from '../modules/categorizer';
import { OllamaService } from '../modules/ollama';
import { CoherenceSettings } from '../../main';

export class CategorizerModal extends Modal {
    service: CategorizerService;
    target: any;
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

    constructor(app: App, settings: CoherenceSettings, target?: any) {
        super(app);
        this.settings = settings;
        const ollama = new OllamaService(settings.ollamaUrl);
        this.service = new CategorizerService(app, ollama);
        this.target = target;

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
        contentEl.createEl('h2', { text: 'Categorizer' });

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
            .addDropdown((drop: DropdownComponent) => {
                this.ollamaModels.forEach(m => drop.addOption(m, m));
                if (!this.ollamaModels.includes(this.model)) {
                    drop.addOption(this.model, this.model);
                }
                drop.setValue(this.model)
                    .onChange((v: string) => this.model = v);
            });

        // Dictionary Dropdown
        new Setting(contentEl)
            .setName('Dictionary')
            .setDesc('Select the category dictionary to use')
            .addDropdown((drop: DropdownComponent) => {
                if (this.settings.categorizerDictionaries) {
                    this.settings.categorizerDictionaries.forEach((d: any) => drop.addOption(d.name, d.name));
                }
                drop.setValue(this.selectedDictionary)
                    .onChange((v: string) => this.selectedDictionary = v);
            });

        // Max Categories
        new Setting(contentEl)
            .setName('Max Categories')
            .setDesc('Maximum number of categories to apply per file')
            .addText(text => text
                .setValue(String(this.maxCategories))
                .onChange(v => {
                    const num = parseInt(v);
                    if (!isNaN(num) && num > 0) this.maxCategories = num;
                }));

        contentEl.createEl('h3', { text: 'Application Options' });

        new Setting(contentEl)
            .setName('Apply as Tag')
            .addToggle(t => t.setValue(this.applyAsTag).onChange(v => this.applyAsTag = v));

        new Setting(contentEl)
            .setName('Apply as Backlink')
            .addToggle(t => t.setValue(this.applyAsBacklink).onChange(v => this.applyAsBacklink = v));

        new Setting(contentEl)
            .setName('Move to Folder')
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
                .setButtonText('Start Categorizing')
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
                    progressText.setText('Starting...');

                    const onProgress = (processed: number, total: number, currentFile: string) => {
                        const percent = Math.floor((processed / total) * 100);
                        progressBar.style.width = `${percent}%`;
                        progressText.setText(`Processing ${processed}/${total}: ${currentFile}`);
                    };

                    // Get categories from selected dictionary
                    const dict = this.settings.categorizerDictionaries.find((d: any) => d.name === this.selectedDictionary);
                    const categories = dict ? dict.content.split('\n')
                        .map((c: string) => c.split(';')[0].trim()) // Split by ; and take first part
                        .filter((c: string) => c.length > 0) : [];

                    if (categories.length === 0) {
                        new Notice('Selected dictionary is empty!');
                        btn.setButtonText('Start Categorizing').setDisabled(false);
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
                            const res = await this.service.processFolder(this.target.path, options, this.recursive, onProgress);
                            new Notice(`Processed: ${res.processed}, Categorized: ${res.categorized}, Errors: ${res.errors}`);
                        }
                        this.close();
                    } catch (e) {
                        new Notice('Error during categorization');
                        console.error(e);
                        btn.setButtonText('Start Categorizing').setDisabled(false);
                        progressText.setText('Error occurred.');
                    }
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
