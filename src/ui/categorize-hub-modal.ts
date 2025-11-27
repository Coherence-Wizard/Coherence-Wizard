import { App, Modal, Setting, TFile, TFolder } from 'obsidian';
import { CategorizerModal } from './categorizer-modal';
import { RatingModal } from './rating-modal';
import { CoherenceSettings } from '../types';

export class CategorizeHubModal extends Modal {
    private mode: 'categorize' | 'rate' = 'categorize';

    constructor(app: App, private settings: CoherenceSettings, private fileOrFolder?: TFile | TFolder) {
        super(app);
    }

    onOpen() {
        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Categorize tools').setHeading();

        if (this.fileOrFolder) {
            const type = this.fileOrFolder instanceof TFile ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.fileOrFolder.path} (${type})` });
        }

        new Setting(contentEl)
            .setName('Select tool')
            .setDesc('Choose the categorization or rating tool to use.')
            .addDropdown(drop => drop
                .addOption('categorize', 'Categorize (Assign Categories)')
                .addOption('rate', 'Auto Rate (Assign Quality Score)')
                .setValue(this.mode)
                .onChange((value: string) => {
                    this.mode = value as 'categorize' | 'rate';
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Continue')
                .setCta()
                .onClick(() => {
                    this.close();
                    if (this.mode === 'categorize') {
                        new CategorizerModal(this.app, this.settings, this.fileOrFolder).open();
                    } else if (this.mode === 'rate') {
                        new RatingModal(this.app, this.settings, this.fileOrFolder).open();
                    }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
