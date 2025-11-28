import { App, Modal, Setting, TFile, TFolder, Notice } from 'obsidian';
import { ChronoMergeService } from '../modules/chrono-merge';
import { CoherenceSettings } from '../types';

export class ChronoMergeModal extends Modal {
    private service: ChronoMergeService;
    private targetFolder: TFolder | null = null;
    private recursive = false;
    private threshold = 5;
    private groups: TFile[][] = [];
    private folder?: TFolder;
    private useCreationTime = false;

    onCloseCallback?: () => void;

    constructor(app: App, settings: CoherenceSettings, folder?: TFolder) {
        super(app);
        this.service = new ChronoMergeService(app);
        this.targetFolder = folder || null;
        this.folder = folder;
        this.threshold = settings.chronoMergeTimeThreshold;
        this.useCreationTime = settings.chronoMergeUseCreationTime;
    }

    onOpen() {
        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Chrono merge').setHeading();

        if (!this.groups.length) {
            // Scan View
            if (this.folder) {
                contentEl.createEl('p', { text: `Folder: ${this.folder.path}` });
            } else {
                new Setting(contentEl)
                    .setName('Folder')
                    .setDesc('Select folder to scan')
                    .addText(text => text
                        .setPlaceholder('Example: Folder/Subfolder')
                        .onChange(value => {
                            const f = this.app.vault.getAbstractFileByPath(value);
                            if (f instanceof TFolder) this.targetFolder = f;
                            else this.targetFolder = null;
                        }));
            }

            new Setting(contentEl)
                .setName('Recursive')
                .setDesc('Scan subfolders')
                .addToggle(toggle => toggle
                    .setValue(this.recursive)
                    .onChange(value => this.recursive = value));

            new Setting(contentEl)
                .setName('Time threshold (minutes)')
                .setDesc('Max time difference between files to group them')
                .addText(text => text
                    .setValue(this.threshold.toString())
                    .onChange(value => {
                        const num = parseInt(value);
                        if (!isNaN(num)) this.threshold = num;
                    }));

            new Setting(contentEl)
                .addButton(btn => btn
                    .setButtonText('Scan')
                    .setCta()
                    .onClick(() => { this.scan(); }));
        } else {
            // Results View
            new Setting(contentEl).setName(`Found ${this.groups.length} groups`).setHeading();

            this.groups.forEach((group, index) => {
                const groupEl = contentEl.createDiv({ cls: 'chrono-group coherence-chrono-group' });

                new Setting(groupEl).setName(`Group ${index + 1} (${group.length} files)`).setHeading();

                const fileList = groupEl.createEl('ul');
                group.forEach(file => {
                    fileList.createEl('li', { text: file.name });
                });

                // Use the first file as the base for the name, assuming the group is sorted by time from the service
                const earliestFile = group[0];
                let outputName = earliestFile.basename;
                let mergedContent = "";

                // Output Filename - Full Width
                const nameContainer = groupEl.createDiv({ cls: 'coherence-mb-10' });
                nameContainer.createEl('div', { text: 'Output Filename', cls: 'setting-item-name' });
                const nameInput = nameContainer.createEl('input', { type: 'text' });
                nameInput.addClass('coherence-input-full');
                nameInput.value = outputName;
                nameInput.onchange = (e: Event) => outputName = (e.target as HTMLInputElement).value;

                // Merged Content Preview
                const contentContainer = groupEl.createDiv({ cls: 'coherence-mb-10' });
                contentContainer.createEl('div', { text: 'Merged Content', cls: 'setting-item-name' });
                const contentArea = contentContainer.createEl('textarea');
                contentArea.addClass('coherence-textarea-full');
                contentArea.rows = 10;
                contentArea.value = "Loading content...";
                contentArea.onchange = (e: Event) => mergedContent = (e.target as HTMLTextAreaElement).value;

                // Load content asynchronously
                void this.service.getMergedContent(group, this.useCreationTime).then(content => {
                    mergedContent = content;
                    contentArea.value = content;
                });

                const btnContainer = groupEl.createDiv({ cls: 'coherence-btn-container-right' });

                const skipBtn = btnContainer.createEl('button', { text: 'Skip Group' });
                skipBtn.addClass('coherence-btn-margin-right');
                skipBtn.onclick = () => {
                    groupEl.remove();
                    const idx = this.groups.indexOf(group);
                    if (idx > -1) this.groups.splice(idx, 1);
                    if (this.groups.length === 0) {
                        this.display();
                    }
                };

                const btn = btnContainer.createEl('button', { text: 'Merge Group' });
                btn.addClass('mod-cta');
                btn.onclick = () => {
                    void (async () => {
                        await this.service.mergeGroup(group, outputName, this.useCreationTime, mergedContent);
                        new Notice(`Merged group into ${outputName}.md`);
                        groupEl.remove();
                        // Remove from groups array
                        const idx = this.groups.indexOf(group);
                        if (idx > -1) this.groups.splice(idx, 1);
                        if (this.groups.length === 0) {
                            this.display(); // Go back to scan view
                        }
                    })();
                };
            });

            new Setting(contentEl)
                .addButton(btn => btn
                    .setButtonText('Back to Scan')
                    .onClick(() => {
                        this.groups = [];
                        this.display();
                    }));
        }
    }

    scan() {
        const folder = this.targetFolder || (this.folder ? this.folder : this.app.vault.getRoot());
        if (!folder) {
            new Notice('Invalid folder');
            return;
        }

        new Notice('Scanning...');
        this.groups = this.service.scanFolder(folder, this.threshold, this.recursive, this.useCreationTime);

        if (this.groups.length === 0) {
            new Notice('No groups found matching the criteria.');
        } else {
            this.display();
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
        if (this.onCloseCallback) {
            this.onCloseCallback();
        }
    }
}
