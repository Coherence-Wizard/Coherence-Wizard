import { App, Modal, Setting, TFile, TFolder, Notice } from 'obsidian';
import { ParseAndMoveService } from '../modules/parse-and-move';
import { CoherenceSettings } from '../types';

export class ParseAndMoveModal extends Modal {
    private service: ParseAndMoveService;
    private targetFolder: TFolder | null = null;
    private outputDir = 'Categorized Content';
    private categoriesText = '';
    private recursive = false;
    private useYamlTags = false;

    private readonly DEFAULT_CATEGORIES = `Work: #work
Ideas: #ideas
Resources: #resources`;

    constructor(app: App, settings: CoherenceSettings, private fileOrFolder?: TFile | TFolder) {
        super(app);
        this.service = new ParseAndMoveService(app);
        this.categoriesText = this.DEFAULT_CATEGORIES;


        // Set default outputDir based on target
        this.outputDir = settings.parseAndMoveTargetDir || 'Categorized Content';
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        const headerSetting = new Setting(contentEl).setName('Parse and copy').setHeading();
        headerSetting.descEl.setText('This tool parses files for specific category tags and copies the entire file (or extracted sections) into the corresponding category folder within the target output directory.');

        if (this.fileOrFolder) {
            contentEl.createEl('p', { text: `Target: ${this.fileOrFolder.path}` });
        } else {
            // Folder selection if not provided
            new Setting(contentEl)
                .setName('Target folder')
                .setDesc('Select the folder to parse (leave empty for root)')
                .addText(text => text
                    .setPlaceholder('Example: folder/subfolder')
                    .onChange(value => {
                        const folder = this.app.vault.getAbstractFileByPath(value);
                        if (folder instanceof TFolder) {
                            this.targetFolder = folder;
                            // Update outputDir if it hasn't been manually changed by user yet?
                            // For simplicity, let's keep the manual input below.
                        } else {
                            this.targetFolder = null;
                        }
                    }));
        }

        new Setting(contentEl)
            .setName('Recursive')
            .setDesc('Include subfolders')
            .addToggle(toggle => toggle
                .setValue(this.recursive)
                .onChange(value => this.recursive = value));

        new Setting(contentEl)
            .setName('Parse entire note')
            .setDesc('Use YAML tags to organize entire notes instead of extracting sections')
            .addToggle(toggle => toggle
                .setValue(this.useYamlTags)
                .onChange(value => this.useYamlTags = value));

        new Setting(contentEl)
            .setName('Target output directory')
            .setDesc('Base directory where category folders will be created (for example, archive)')
            .addText(text => text
                .setValue(this.outputDir)
                .onChange(value => this.outputDir = value));



        new Setting(contentEl)
            .setName('Categories')
            .setDesc('Format: category name: #tag')
            .addTextArea(text => {
                text.setValue(this.categoriesText)
                    .setPlaceholder('Category: #tag')
                    .onChange(value => this.categoriesText = value);
                text.inputEl.rows = 10;
                text.inputEl.addClass('coherence-w-100');
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Parse')
                .setCta()
                .onClick(() => { void this.parse(); }));
    }

    display() {
        this.onOpen();
    }

    async parse() {
        const folder = this.fileOrFolder instanceof TFolder ? this.fileOrFolder :
            (this.fileOrFolder instanceof TFile ? this.fileOrFolder.parent :
                (this.targetFolder || this.app.vault.getRoot()));

        if (!folder) {
            new Notice('Invalid folder selected');
            return;
        }

        const categories = this.parseCategories(this.categoriesText);
        const files = this.getFiles(folder);

        new Notice(`Parsing ${files.length} files...`);
        this.close();

        let processedCount = 0;
        for (const file of files) {
            await this.service.processFile(file, categories, this.outputDir, this.useYamlTags);
            processedCount++;
        }

        new Notice(`Parsed ${processedCount} files.`);
    }

    private getFiles(folder: TFolder): TFile[] {
        let files: TFile[] = [];
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            } else if (child instanceof TFolder && this.recursive) {
                files = files.concat(this.getFiles(child));
            }
        }
        return files;
    }

    private parseCategories(text: string): { [key: string]: string } {
        const categories: { [key: string]: string } = {};
        const lines = text.split('\n');
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(':').trim();
                if (key && value) {
                    categories[key] = value;
                }
            }
        }
        return categories;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
