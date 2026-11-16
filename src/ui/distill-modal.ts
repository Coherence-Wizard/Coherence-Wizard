import { App, Modal, Setting, TFile, TFolder } from 'obsidian';
import { WisdomModal } from './wisdom-modal';
import { GeneralizerModal } from './generalizer-modal';
import { CoherenceSettings } from '../types';

export class DistillModal extends Modal {
    private mode: 'generalize' | 'wisdom' = 'generalize';

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
            .setDesc('Generalize rewrites personal text with AI. Wisdom extraction can rewrite with AI or copy the body unchanged. Censor / alias is a separate tool.')
            .addDropdown(drop => drop
                .addOption('wisdom', 'Extract wisdom')
                .addOption('generalize', 'Generalize (AI)')
                .setValue(this.mode)
                .onChange((value: string) => {
                    this.mode = value as 'generalize' | 'wisdom';
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Continue')
                .setCta()
                .onClick(() => {
                    this.close();
                    if (this.mode === 'wisdom') {
                        new WisdomModal(this.app, this.settings, this.fileOrFolder).open();
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
