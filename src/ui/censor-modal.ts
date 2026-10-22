import { App, Modal, Setting, TFile, TFolder, Notice } from 'obsidian';
import { CensorService } from '../modules/censor';
import { CoherenceSettings } from '../types';

export class CensorModal extends Modal {
    private service: CensorService;
    private targetFolder: TFolder | null = null;
    private dictionaryText = '';
    private direction: 'forward' | 'reverse' = 'forward';
    private useMasking = false;
    private sentenceLevel = false;
    private recursive = false;
    private selectedDictionaryName: string;

    constructor(app: App, private settings: CoherenceSettings, private fileOrFolder?: TFile | TFolder) {
        super(app);
        this.service = new CensorService(app);
        this.selectedDictionaryName = settings.censorActiveDictionary;
        this.updateDictionaryText();
        this.recursive = settings.censorRecursive;

        // Force update default replacement char if it's the old default
        if (this.settings.censorReplacementChar === '*') {
            this.settings.censorReplacementChar = '█';
        }
    }

    updateDictionaryText() {
        const dict = this.settings.censorDictionaries.find((d: { name: string, content: string }) => d.name === this.selectedDictionaryName);
        this.dictionaryText = dict ? dict.content : '';
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Censor and alias').setHeading();

        if (this.fileOrFolder) {
            const type = this.fileOrFolder instanceof TFile ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.fileOrFolder.path} (${type})` });
        } else {
            new Setting(contentEl)
                .setName('Target folder')
                .setDesc('Select the folder to process')
                .addText(text => text
                    .setPlaceholder('Example: folder/subfolder')
                    .onChange(value => {
                        const folder = this.app.vault.getAbstractFileByPath(value);
                        if (folder instanceof TFolder) {
                            this.targetFolder = folder;
                        } else {
                            this.targetFolder = null;
                        }
                    }));
        }

        new Setting(contentEl)
            .setName('Direction')
            .setDesc('Forward (censor) or reverse (uncensor)')
            .addDropdown(drop => drop
                .addOption('forward', 'Forward (censor)')
                .addOption('reverse', 'Reverse (uncensor)')
                .setValue(this.direction)
                .onChange((value: 'forward' | 'reverse') => {
                    this.direction = value;
                    this.display();
                }));

        if (this.direction === 'forward') {
            new Setting(contentEl)
                .setName('Use masking')
                .setDesc('Replace with █ instead of alias')
                .addToggle(toggle => toggle
                    .setValue(this.useMasking)
                    .onChange(value => {
                        this.useMasking = value;
                        this.display();
                    }));

            if (this.useMasking) {
                new Setting(contentEl)
                    .setName('Sentence level masking')
                    .setDesc('Block entire sentence containing censored word')
                    .addToggle(toggle => toggle
                        .setValue(this.sentenceLevel)
                        .onChange(value => this.sentenceLevel = value));
            }
        }

        // Recursive option (only relevant if target is a folder or no target yet)
        if (!this.fileOrFolder || this.fileOrFolder instanceof TFolder) {
            new Setting(contentEl)
                .setName('Recursive')
                .setDesc('Process subfolders')
                .addToggle(toggle => toggle
                    .setValue(this.recursive)
                    .onChange(value => this.recursive = value));
        }

        new Setting(contentEl)
            .setName('Dictionary')
            .setDesc('Select dictionary to use')
            .addDropdown(drop => {
                this.settings.censorDictionaries.forEach((d) => { drop.addOption(d.name, d.name); });
                drop.setValue(this.selectedDictionaryName)
                    .onChange(value => {
                        this.selectedDictionaryName = value;
                        this.updateDictionaryText();
                        this.display();
                    });
            });

        new Setting(contentEl)
            .setName('Dictionary content')
            .setDesc('Edit the censored words and aliases (changes here are temporary unless saved in settings)')
            .addTextArea(text => {
                text.setValue(this.dictionaryText)
                    .setPlaceholder('Variant1, variant2 = alias')
                    .onChange(value => this.dictionaryText = value);
                text.inputEl.rows = 10;
                text.inputEl.addClass('coherence-w-100');
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Process')
                .setCta()
                .onClick(() => { void this.process(); }));
    }

    display() {
        this.onOpen();
    }

    async process() {
        const target = this.fileOrFolder || this.targetFolder;

        if (!target) {
            new Notice('Invalid target selected');
            return;
        }

        const dictionary = this.parseDictionary(this.dictionaryText);
        let files: TFile[] = [];

        if (target instanceof TFile) {
            files.push(target);
        } else if (target instanceof TFolder) {
            files = this.getFiles(target, this.recursive);
        }

        if (files.length === 0) {
            const noticeText = 'No markdown files found to process.';
            new Notice(noticeText);
            return;
        }

        new Notice(`Processing ${files.length} files...`);
        this.close();

        let processedCount = 0;
        for (const file of files) {
            const suffix = this.direction === 'reverse' ? '_reversed' : this.settings.censorSuffix;
            await this.service.processFile(
                file,
                dictionary,
                this.direction,
                this.useMasking,
                this.sentenceLevel,
                this.settings.censorOutputMode,
                suffix,
                this.settings.censorReplacementChar
            );
            processedCount++;
        }

        new Notice(`Processed ${processedCount} files.`);
    }

    private getFiles(folder: TFolder, recursive: boolean): TFile[] {
        let files: TFile[] = [];
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            } else if (child instanceof TFolder && recursive) {
                files = files.concat(this.getFiles(child, recursive));
            }
        }
        return files;
    }

    private parseDictionary(text: string): { variants: string[], alias: string }[] {
        const dictionary: { variants: string[], alias: string }[] = [];
        const lines = text.split('\n');
        for (const line of lines) {
            if (line.trim().startsWith('#') || !line.trim()) continue;

            const parts = line.split('=');
            if (parts.length === 2) {
                const variants = parts[0].split(',').map(v => v.trim()).filter(v => v);
                const alias = parts[1].trim();
                if (variants.length > 0 && alias) {
                    dictionary.push({ variants, alias });
                }
            }
        }
        return dictionary;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
