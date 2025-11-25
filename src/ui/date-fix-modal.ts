import { App, Modal, Setting, Notice } from 'obsidian';
import { DateFixService } from '../modules/date-fix';

export class DateFixModal extends Modal {
    service: DateFixService;
    target: any = null; // TFile or TFolder
    recursive: boolean = true;
    fallbackToCreationDate: boolean = false;
    dateFormat: string = 'YYYY-MM-DD';
    exceptions: string = '';

    constructor(app: App, settings: any, target?: any) {
        super(app);
        this.service = new DateFixService(app.vault);
        this.target = target ?? this.app.workspace.getActiveFile();
        this.recursive = settings.dateFixRecursive;
        this.fallbackToCreationDate = settings.dateFixFallbackToCreationDate;
        this.dateFormat = settings.dateFixDateFormat;
        this.exceptions = settings.dateFixExceptions;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Date Fix / Rename' });

        if (this.target) {
            const type = this.target.extension ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.target.name} (${type})` });
        } else {
            contentEl.createEl('p', { text: 'No file or folder selected.', cls: 'error-text' });
            return;
        }

        new Setting(contentEl)
            .setName('Recursive')
            .setDesc('Process subfolders (if target is folder)')
            .addToggle(toggle => toggle
                .setValue(this.recursive)
                .onChange(value => this.recursive = value));

        new Setting(contentEl)
            .setName('Fallback to Creation Date')
            .setDesc('If no date is found in the filename, prepend the file\'s creation date.')
            .addToggle(toggle => toggle
                .setValue(this.fallbackToCreationDate)
                .onChange(value => this.fallbackToCreationDate = value));

        new Setting(contentEl)
            .setName('Preferred Date Format')
            .setDesc('ISO format to use (e.g. YYYY-MM-DD)')
            .addText(text => text
                .setValue(this.dateFormat)
                .onChange(value => this.dateFormat = value));

        new Setting(contentEl)
            .setName('Exceptions')
            .setDesc('Comma separated list of file extensions (e.g. *.py) or words to exclude')
            .addTextArea(text => text
                .setValue(this.exceptions)
                .onChange(value => this.exceptions = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Run Date Fix')
                .setCta()
                .onClick(async () => {
                    btn.setButtonText('Processing...').setDisabled(true);
                    try {
                        if (this.target.extension) {
                            // Single File
                            const result = await this.service.fixDateInFile(this.target, this.fallbackToCreationDate, this.dateFormat, this.exceptions);
                            new Notice(result);
                        } else {
                            // Folder
                            const result = await this.service.fixDatesInFolder(
                                this.target.path,
                                this.recursive,
                                this.fallbackToCreationDate,
                                this.dateFormat,
                                this.exceptions
                            );
                            new Notice(`Complete: ${result.processed} processed, ${result.renamed} renamed, ${result.errors} errors.`);
                        }
                        this.close();
                    } catch (e) {
                        new Notice('Error during date fix.');
                        console.error(e);
                        btn.setButtonText('Run Date Fix').setDisabled(false);
                    }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
