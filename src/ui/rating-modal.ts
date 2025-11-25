import { App, Modal, Setting, Notice } from 'obsidian';
import { RatingService } from '../modules/rating';
import { OllamaService } from '../modules/ollama';

export class RatingModal extends Modal {
    service: RatingService;
    target: any;
    recursive: boolean = false;
    skipExisting: boolean = true;
    model: string;
    params: string;

    constructor(app: App, settings: any, target?: any) {
        super(app);
        const ollama = new OllamaService(settings.ollamaUrl);
        this.service = new RatingService(app, ollama);
        this.target = target;
        this.model = settings.ratingModel || 'llama3.1';
        this.params = settings.ratingParams || 'coherence, profundity';
        this.skipExisting = settings.ratingSkipIfRated ?? true;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Automatic Rating' });

        if (this.target) {
            const type = this.target.extension ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.target.name} (${type})` });
        } else {
            contentEl.createEl('p', { text: 'No target selected.', cls: 'error-text' });
            return;
        }

        new Setting(contentEl)
            .setName('Model')
            .addText(text => text.setValue(this.model).onChange(v => this.model = v));

        new Setting(contentEl)
            .setName('Quality Parameters')
            .setDesc('Comma separated list')
            .addText(text => text.setValue(this.params).onChange(v => this.params = v));

        if (!this.target.extension) {
            new Setting(contentEl)
                .setName('Recursive')
                .addToggle(t => t.setValue(this.recursive).onChange(v => this.recursive = v));
        }

        new Setting(contentEl)
            .setName('Skip Existing')
            .setDesc('Skip files that already have a rating')
            .addToggle(t => t.setValue(this.skipExisting).onChange(v => this.skipExisting = v));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Start Rating')
                .setCta()
                .onClick(async () => {
                    btn.setButtonText('Processing...').setDisabled(true);
                    const params = this.params.split(',').map(p => p.trim()).filter(p => p);

                    try {
                        if (this.target.extension) {
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
                        btn.setButtonText('Start Rating').setDisabled(false);
                    }
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
