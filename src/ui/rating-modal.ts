import { App, Modal, Setting, Notice, TextComponent, ToggleComponent, DropdownComponent, TFile, TFolder } from 'obsidian';
import { RatingService } from '../modules/rating';
import { OllamaService } from '../modules/ollama';
import { CoherenceSettings } from '../../main';

export class RatingModal extends Modal {
    service: RatingService;
    target: any;
    recursive = false;
    skipExisting = true;
    model: string;
    params: string;

    ollama: OllamaService;
    models: string[] = [];
    saveSettings: (key: string, value: any) => Promise<void>;

    constructor(app: App, settings: CoherenceSettings, saveSettings: (key: string, value: any) => Promise<void>, target?: any) {
        super(app);
        this.ollama = new OllamaService(settings.ollamaUrl);
        this.service = new RatingService(app, this.ollama);
        this.saveSettings = saveSettings;
        this.target = target || app.workspace.getActiveFile();
        this.model = settings.ratingModel || 'llama3.1';
        this.params = settings.ratingParams || 'coherence, profundity';
        this.skipExisting = settings.ratingSkipIfRated ?? true;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Automatic Rating' });
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
        contentEl.createEl('h2', { text: 'Automatic Rating' });

        if (this.target) {
            const type = this.target.extension ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.target.name} (${type})` });
        } else {
            contentEl.createEl('p', { text: `No target selected. (Target is ${this.target})`, cls: 'error-text' });
            return;
        }

        new Setting(contentEl)
            .setName('Model')
            .addDropdown((drop: DropdownComponent) => {
                drop.addOption('', 'Select a model');
                this.models.forEach(m => drop.addOption(m, m));
                if (!this.models.includes(this.model)) {
                    drop.addOption(this.model, this.model);
                }
                drop.setValue(this.model);
                drop.onChange(async (value: string) => {
                    this.model = value;
                    await this.saveSettings('ratingModel', value);
                });
            });

        new Setting(contentEl)
            .setName('Quality Parameters')
            .setDesc('Comma separated list')
            .addText((text: TextComponent) => text.setValue(this.params).onChange((v: string) => this.params = v));

        if (!this.target.extension) {
            new Setting(contentEl)
                .setName('Recursive')
                .addToggle((t: ToggleComponent) => t.setValue(this.recursive).onChange((v: boolean) => this.recursive = v));
        }

        new Setting(contentEl)
            .setName('Skip Existing')
            .setDesc('Skip files that already have a rating')
            .addToggle((t: ToggleComponent) => t.setValue(this.skipExisting).onChange((v: boolean) => this.skipExisting = v));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Start Rating')
                .setCta()
                .onClick(async () => {
                    btn.setButtonText('Processing...').setDisabled(true);
                    const params = this.params.split(',').map(p => p.trim()).filter(p => p);

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

                    try {
                        if (this.target.extension) {
                            const rating = await this.service.rateFile(this.target, this.model, params, this.skipExisting);
                            new Notice(rating ? `Rated: ${rating}` : 'Failed to rate');
                        } else {
                            const res = await this.service.rateFolder(this.target.path, this.model, params, this.recursive, this.skipExisting, onProgress);
                            new Notice(`Processed: ${res.processed}, Rated: ${res.rated}, Errors: ${res.errors}`);
                        }
                        this.close();
                    } catch (e) {
                        new Notice('Error during rating');
                        console.error(e);
                        btn.setButtonText('Start Rating').setDisabled(false);
                        progressText.setText('Error occurred.');
                    }
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
