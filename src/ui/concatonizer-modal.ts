import { App, Modal, Setting, Notice, TFolder } from 'obsidian';
import { ConcatonizerService } from '../modules/concatonizer';

export class ConcatonizerModal extends Modal {
    service: ConcatonizerService;
    target: any = null; // TFolder
    recursive: boolean = false;
    stripYaml: boolean = false;
    outputName: string = 'combined.md';
    separator: string = '\n\n---\n\n';
    includeFilename: boolean = true;

    constructor(app: App, settings: any, target?: any) {
        super(app);
        this.service = new ConcatonizerService(app.vault);
        this.target = target;
        this.recursive = settings.concatonizerRecursive;
        this.stripYaml = settings.concatonizerStripYaml;

        // Set default output name based on folder name if available
        const suffix = settings.concatonizerSuffix || '_combined';
        if (this.target instanceof TFolder) {
            this.outputName = `${this.target.name}${suffix}.md`;
        } else if (this.target && this.target.parent) {
            this.outputName = `${this.target.parent.name}${suffix}.md`;
        }
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Concatonizer' });

        if (!this.target || this.target.extension) {
            contentEl.createEl('p', { text: 'Please select a folder to concatonize.', cls: 'error-text' });
            // If target is a file, maybe use its parent?
            if (this.target && this.target.extension) {
                this.target = this.target.parent;
                contentEl.createEl('p', { text: `Using parent folder: ${this.target.path}` });
            } else {
                return;
            }
        } else {
            contentEl.createEl('p', { text: `Target Folder: ${this.target.path}` });
        }

        new Setting(contentEl)
            .setName('Output Filename')
            .setDesc('Name of the combined file')
            .addText(text => text
                .setValue(this.outputName)
                .onChange(value => this.outputName = value));

        new Setting(contentEl)
            .setName('Recursive')
            .setDesc('Include subfolders')
            .addToggle(toggle => toggle
                .setValue(this.recursive)
                .onChange(value => this.recursive = value));

        new Setting(contentEl)
            .setName('Strip YAML')
            .setDesc('Remove YAML frontmatter from combined files')
            .addToggle(toggle => toggle
                .setValue(this.stripYaml)
                .onChange(value => this.stripYaml = value));

        new Setting(contentEl)
            .setName('Include Filename')
            .setDesc('Add filename as header for each file content')
            .addToggle(toggle => toggle
                .setValue(this.includeFilename)
                .onChange(value => this.includeFilename = value));

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Concatonize')
                .setCta()
                .onClick(async () => {
                    btn.setButtonText('Processing...').setDisabled(true);
                    try {
                        const result = await this.service.concatonizeFolder(
                            this.target.path,
                            this.outputName,
                            this.recursive,
                            this.stripYaml,
                            this.includeFilename
                        );
                        new Notice(result);
                        this.close();
                    } catch (e) {
                        new Notice('Error during concatenation.');
                        console.error(e);
                        btn.setButtonText('Concatonize').setDisabled(false);
                    }
                }));
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
