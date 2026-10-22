import { App, Modal, Notice, Setting, TFile, TFolder } from 'obsidian';
import { AtomizerService } from '../modules/atomizer';
import { CoherenceSettings } from '../types';

export class AtomizerModal extends Modal {
    service: AtomizerService;
    target: TFile | TFolder | null = null;
    mode: 'heading' | 'date' | 'divider' = 'heading';
    divider = '---';

    constructor(app: App, settings: CoherenceSettings, target?: TFile | TFolder) {
        super(app);
        this.service = new AtomizerService(app.vault);
        this.target = target ?? this.app.workspace.getActiveFile();
        this.divider = settings.atomizerDivider || '---';
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        const isFolder = this.target instanceof TFolder;
        new Setting(contentEl).setName(isFolder ? `Atomize folder: ${this.target?.name}` : 'Atomize file').setHeading();

        // Mode Selection
        new Setting(contentEl)
            .setName('Atomization mode')
            .setDesc('How to split the content')
            .addDropdown(drop => drop
                .addOption('heading', 'By heading')
                .addOption('date', 'By iso date')
                .addOption('divider', 'By divider')
                .setValue(this.mode)
                .onChange(value => {
                    this.mode = value as 'heading' | 'date' | 'divider';
                    this.display(); // Refresh UI
                }));

        // Divider Input (only for divider mode)
        if (this.mode === 'divider') {
            new Setting(contentEl)
                .setName('Divider string')
                .setDesc('String to split on (e.g. ---)')
                .addText(text => text
                    .setValue(this.divider)
                    .onChange(value => this.divider = value));
        }

        // Action Button
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(isFolder ? 'Atomize all files' : 'Atomize')
                .setCta()
                .setDisabled(!this.target)
                .onClick(async () => {
                    if (this.target) {
                        this.close();
                        if (this.target instanceof TFolder) {
                            new Notice(`Atomizing files in ${this.target.name}...`);
                            let count = 0;
                            for (const child of this.target.children) {
                                if (child instanceof TFile && child.extension === 'md') {
                                    try {
                                        await this.runAtomizer(child);
                                        count++;
                                    } catch {
                                        new Notice(`Failed to atomize ${child.name}`);
                                    }
                                }
                            }
                            new Notice(`Atomization complete. Processed ${count} files.`);
                        } else if (this.target instanceof TFile) {
                            new Notice('Atomizing...');
                            try {
                                await this.runAtomizer(this.target);
                                new Notice('Atomization complete.');
                            } catch {
                                new Notice('Error during atomization.');
                            }
                        }
                    }
                }));
    }

    async runAtomizer(file: TFile) {
        if (this.mode === 'heading') {
            await this.service.atomizeByHeading(file);
        } else if (this.mode === 'date') {
            await this.service.atomizeByDate(file);
        } else if (this.mode === 'divider') {
            await this.service.atomizeByDivider(file, this.divider);
        }
    }

    display() {
        this.onOpen();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
