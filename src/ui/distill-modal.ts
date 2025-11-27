import { App, Modal, Setting, TFile, TFolder } from 'obsidian';
import { CensorModal } from './censor-modal';
import { GeneralizerModal } from './generalizer-modal';
import { CoherenceSettings } from '../types';

export class DistillModal extends Modal {
    private mode: 'censor' | 'generalize' = 'censor';

    constructor(app: App, private settings: CoherenceSettings, private fileOrFolder?: TFile | TFolder) {
        super(app);
    }

    onOpen() {
        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Distill tools').setHeading();

        if (this.fileOrFolder) {
            const type = this.fileOrFolder instanceof TFile ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.fileOrFolder.path} (${type})` });
        }

        new Setting(contentEl)
            .setName('Select tool')
            .setDesc('Choose the distillation tool to use.')
            .addDropdown(drop => drop
                .addOption('censor', 'Censor / Alias')
                .addOption('generalize', 'Generalize (AI)')
                .setValue(this.mode)
                .onChange((value: string) => {
                    this.mode = value as 'censor' | 'generalize';
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Continue')
                .setCta()
                .onClick(() => {
                    this.close();
                    if (this.mode === 'censor') {
                        new CensorModal(this.app, this.settings, this.fileOrFolder).open();
                    } else if (this.mode === 'generalize') {
                        new GeneralizerModal(this.app, this.settings, this.fileOrFolder).open();
                    }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
