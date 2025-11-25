import { App, Modal, Notice, Setting, TFile, TFolder } from 'obsidian';
import { AtomizerService } from '../modules/atomizer';

export class AtomizerModal extends Modal {
    service: AtomizerService;
    target: TFile | TFolder | null = null;
    mode: 'heading' | 'date' | 'divider' = 'heading';
    divider: string = '---';

    constructor(app: App, settings: any, target?: TFile | TFolder) {
        super(app);
        this.service = new AtomizerService(app.vault);
        this.target = target ?? this.app.workspace.getActiveFile();
        this.divider = settings.atomizerDivider || '---';
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        const isFolder = this.target instanceof TFolder;
        contentEl.createEl('h2', { text: isFolder ? `Atomize Folder: ${this.target?.name}` : 'Atomize File' });

        // Mode Selection
        new Setting(contentEl)
            .setName('Atomization Mode')
            .setDesc('How to split the content')
            .addDropdown(drop => drop
                .addOption('heading', 'By Heading')
                .addOption('date', 'By ISO Date')
                .addOption('divider', 'By Divider')
                .setValue(this.mode)
                .onChange(value => {
                    this.mode = value as any;
                    this.display(); // Refresh UI
                }));

        // Divider Input (only for divider mode)
        if (this.mode === 'divider') {
            new Setting(contentEl)
                .setName('Divider String')
                .setDesc('String to split on (e.g. ---)')
                .addText(text => text
                    .setValue(this.divider)
                    .onChange(value => this.divider = value));
        }

        // Action Button
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText(isFolder ? 'Atomize All Files' : 'Atomize')
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
                                    } catch (e) {
                                        console.error(`Failed to atomize ${child.name}`, e);
                                    }
                                }
                            }
                            new Notice(`Atomization complete. Processed ${count} files.`);
                        } else if (this.target instanceof TFile) {
                            new Notice('Atomizing...');
                            try {
                                await this.runAtomizer(this.target);
                                new Notice('Atomization complete.');
                            } catch (e) {
                                new Notice('Error during atomization.');
                                console.error(e);
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
