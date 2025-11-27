import { App, Modal, Setting, Notice, TFile, TFolder } from 'obsidian';
import { RatingService } from '../modules/rating';
import { OllamaService } from '../modules/ollama';
import { CoherenceSettings } from '../types';

export class RatingModal extends Modal {
    service: RatingService;
    target: TFile | TFolder | null;
    recursive = false;
    skipExisting = true;
    model: string;
    params: string;
    private ollama: OllamaService;

    constructor(app: App, settings: CoherenceSettings, target?: TFile | TFolder) {
        super(app);
        this.ollama = new OllamaService(settings.ollamaUrl);
        this.service = new RatingService(app, this.ollama);
        this.target = target || null;
        this.model = settings.ratingModel || 'llama3.1';
        this.params = settings.ratingParams || 'coherence, profundity';
        this.skipExisting = settings.ratingSkipIfRated ?? true;
    }

    async onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Automatic rating').setHeading();

        if (this.target) {
            const type = this.target instanceof TFile ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.target.name} (${type})` });
        } else {
            contentEl.createEl('p', { text: 'No target selected.', cls: 'error-text' });
            return;
        }

        let models: string[] = [];
        try {
            models = await this.ollama.listModels();
        } catch (e) {
            console.error('Failed to fetch models', e);
        }

        if (models.length === 0) {
            models = ['llama3', 'mistral', 'gemma'];
        }

        new Setting(contentEl)
            .setName('Model')
            .addDropdown(drop => {
                models.forEach(m => drop.addOption(m, m));
                if (!models.includes(this.model)) {
                    drop.addOption(this.model, this.model);
                }
                drop.setValue(this.model)
                    .onChange(v => this.model = v);
            });

        new Setting(contentEl)
            .setName('Quality parameters')
            .setDesc('Comma separated list')
            .addText(text => text.setValue(this.params).onChange(v => this.params = v));

        if (!(this.target instanceof TFile)) {
            new Setting(contentEl)
                .setName('Recursive')
                .addToggle(t => t.setValue(this.recursive).onChange(v => this.recursive = v));
        }

        new Setting(contentEl)
            .setName('Skip existing')
            .setDesc('Skip files that already have a rating')
            .addToggle(t => t.setValue(this.skipExisting).onChange(v => this.skipExisting = v));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Start rating')
                .setCta()
                .onClick(async () => {
                    btn.setButtonText('Processing...').setDisabled(true);
                    const params = this.params.split(',').map(p => p.trim()).filter(p => p);

                    try {
                        if (this.target instanceof TFile) {
                            const rating = await this.service.rateFile(this.target, this.model, params);
                            new Notice(rating ? `Rated: ${rating}` : 'Failed to rate');
                        } else {
                            const res = await this.service.rateFolder(this.target.path, this.model, params, this.recursive, this.skipExisting);
                            new Notice(`Processed: ${res.processed}, Rated: ${res.rated}, Errors: ${res.errors}`);
                        }
                        this.close();
                    } catch (e) {
                        new Notice('Error during rating');
                        console.error(e);
                        btn.setButtonText('Start rating').setDisabled(false);
                    }
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
