import { App, Modal, Setting, TFile, TFolder } from 'obsidian';
import { ChronoMergeModal } from './chrono-merge-modal';
import { ConcatonizerModal } from './concatonizer-modal';
import { DeduplicationModal } from './deduplication-modal';
import { CoherenceSettings } from '../types';

export class MergeModal extends Modal {
    private mode: 'chrono' | 'concat' | 'dedup' = 'chrono';

    constructor(app: App, private settings: CoherenceSettings, private fileOrFolder?: TFile | TFolder) {
        super(app);
    }

    onOpen() {
        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Merge tools').setHeading();

        if (this.fileOrFolder) {
            const type = this.fileOrFolder instanceof TFile ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.fileOrFolder.path} (${type})` });
        }

        new Setting(contentEl)
            .setName('Select merge tool')
            .setDesc('Choose the merge strategy to use.')
            .addDropdown(drop => drop
                .addOption('chrono', 'Chrono merge (time-based)')
                .addOption('concat', 'Combine (append files)')
                .addOption('dedup', 'Find duplicates')
                .setValue(this.mode)
                .onChange((value: string) => {
                    this.mode = value as 'chrono' | 'concat' | 'dedup';
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Continue')
                .setCta()
                .onClick(() => {
                    this.close();
                    if (this.mode === 'chrono') {
                        // Chrono Merge expects a folder, if file is passed it uses parent
                        const folder = this.fileOrFolder instanceof TFolder ? this.fileOrFolder : (this.fileOrFolder?.parent);
                        new ChronoMergeModal(this.app, this.settings, folder).open();
                    } else if (this.mode === 'concat') {
                        new ConcatonizerModal(this.app, this.settings, this.fileOrFolder).open();
                    } else if (this.mode === 'dedup') {
                        new DeduplicationModal(this.app, this.fileOrFolder).open();
                    }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
