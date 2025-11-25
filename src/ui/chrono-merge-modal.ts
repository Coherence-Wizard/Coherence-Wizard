import { App, Modal, Setting, TFile, TFolder, Notice } from 'obsidian';
import { ChronoMergeService } from '../modules/chrono-merge';

export class ChronoMergeModal extends Modal {
    private service: ChronoMergeService;
    private targetFolder: TFolder | null = null;
    private recursive: boolean = false;
    private threshold: number = 5;
    private groups: TFile[][] = [];
    private folder?: TFolder;
    private useCreationTime: boolean = false;

    onCloseCallback?: () => void;

    constructor(app: App, settings: any, folder?: TFolder) {
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
        contentEl.createEl('h2', { text: 'Chrono Merge' });

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
                .setName('Time Threshold (Minutes)')
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
                    .onClick(() => this.scan()));
        } else {
            // Results View
            contentEl.createEl('h3', { text: `Found ${this.groups.length} groups` });

            this.groups.forEach((group, index) => {
                const groupEl = contentEl.createDiv({ cls: 'chrono-group' });
                groupEl.style.marginBottom = '20px';
                groupEl.style.padding = '15px';
                groupEl.style.border = '1px solid var(--background-modifier-border)';
                groupEl.style.borderRadius = '5px';

                groupEl.createEl('h4', { text: `Group ${index + 1} (${group.length} files)` });

                const fileList = groupEl.createEl('ul');
                group.forEach(file => {
                    fileList.createEl('li', { text: file.name });
                });

                // Use the first file as the base for the name, assuming the group is sorted by time from the service
                const earliestFile = group[0];
                let outputName = earliestFile.basename;
                let mergedContent = "";

                // Output Filename - Full Width
                const nameContainer = groupEl.createDiv();
                nameContainer.style.marginBottom = '10px';
                nameContainer.createEl('div', { text: 'Output Filename', cls: 'setting-item-name' });
                const nameInput = nameContainer.createEl('input', { type: 'text' });
                nameInput.style.width = '100%';
                nameInput.value = outputName;
                nameInput.onchange = (e: any) => outputName = e.target.value;

                // Merged Content Preview
                const contentContainer = groupEl.createDiv();
                contentContainer.style.marginBottom = '10px';
                contentContainer.createEl('div', { text: 'Merged Content', cls: 'setting-item-name' });
                const contentArea = contentContainer.createEl('textarea');
                contentArea.style.width = '100%';
                contentArea.style.height = '200px';
                contentArea.style.resize = 'vertical';
                contentArea.value = "Loading content...";
                contentArea.onchange = (e: any) => mergedContent = e.target.value;

                // Load content asynchronously
                this.service.getMergedContent(group, this.useCreationTime).then(content => {
                    mergedContent = content;
                    contentArea.value = content;
                });

                const btnContainer = groupEl.createDiv();
                btnContainer.style.display = 'flex';
                btnContainer.style.justifyContent = 'flex-end';

                const skipBtn = btnContainer.createEl('button', { text: 'Skip Group' });
                skipBtn.style.marginRight = '10px';
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
                btn.onclick = async () => {
                    await this.service.mergeGroup(group, outputName, this.useCreationTime, mergedContent);
                    new Notice(`Merged group into ${outputName}.md`);
                    groupEl.remove();
                    // Remove from groups array
                    const idx = this.groups.indexOf(group);
                    if (idx > -1) this.groups.splice(idx, 1);
                    if (this.groups.length === 0) {
                        this.display(); // Go back to scan view
                    }
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

    async scan() {
        const folder = this.targetFolder || (this.folder ? this.folder : this.app.vault.getRoot());
        if (!folder) {
            new Notice('Invalid folder');
            return;
        }

        new Notice('Scanning...');
        this.groups = await this.service.scanFolder(folder, this.threshold, this.recursive, this.useCreationTime);

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
