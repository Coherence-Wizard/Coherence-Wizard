
import { App, Modal, Setting, TFolder, Notice } from 'obsidian';
import { SmartMoveService } from '../modules/smart-move';

export class SmartMoveModal extends Modal {
    private service: SmartMoveService;
    private targetFolder: string = '';

    constructor(app: App, private sourceFolder: TFolder) {
        super(app);
        this.service = new SmartMoveService(app);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Smart move').setHeading();

        contentEl.createEl('p', { text: `Moving content from: ${this.sourceFolder.path}` });

        new Setting(contentEl)
            .setName('Target root folder')
            .setDesc('Select the root folder to move files to (for example, archive)')
            .addText(text => text
                .setPlaceholder('Archive')
                .onChange(value => {
                    this.targetFolder = value;
                }));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Move')
                .setCta()
                .onClick(() => { void this.runMove(); }));
    }

    async runMove() {
        if (!this.targetFolder) {
            new Notice('Please specify a target folder.');
            return;
        }

        const targetFolder = this.app.vault.getAbstractFileByPath(this.targetFolder);
        if (!targetFolder || !(targetFolder instanceof TFolder)) {
            new Notice('Target folder does not exist.');
            return;
        }

        this.close();
        new Notice('Starting move...');
        try {
            await this.service.moveFiles(this.sourceFolder, this.targetFolder);
            new Notice('Move completed.');
        } catch (error) {
            new Notice(error instanceof Error ? error.message : 'Move failed.');
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
