import { App, Modal, Setting, Notice, TFile, TFolder } from 'obsidian';
import { DeduplicationService, DuplicateGroup } from '../modules/deduplication';

export class DeduplicationModal extends Modal {
    service: DeduplicationService;
    target: TFile | TFolder | undefined;

    // State
    searchScope: 'vault' | 'folder' | 'two-folders' = 'folder';
    folderA: string = '';
    folderB: string = '';
    recursive: boolean = true;
    duplicates: DuplicateGroup[] | null = null;

    constructor(app: App, target?: TFile | TFolder) {
        super(app);
        this.service = new DeduplicationService(app);
        this.target = target;

        if (target instanceof TFolder) {
            this.folderA = target.path;
        } else if (target instanceof TFile && target.parent) {
            this.folderA = target.parent.path;
        }
    }

    onOpen() {
        this.display();
    }

    display() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Deduplication' });

        if (!this.duplicates) {
            this.renderSettings(contentEl);
        } else {
            this.renderResults(contentEl);
        }
    }

    renderSettings(contentEl: HTMLElement) {
        // Scope Selection
        new Setting(contentEl)
            .setName('Scope')
            .setDesc('Where to search for duplicates')
            .addDropdown(drop => drop
                .addOption('vault', 'Entire Vault')
                .addOption('folder', 'Single Folder')
                .addOption('two-folders', 'Compare Two Folders')
                .setValue(this.searchScope)
                .onChange(v => {
                    this.searchScope = v as any;
                    this.display();
                }));

        // Folder Inputs
        if (this.searchScope === 'folder') {
            new Setting(contentEl)
                .setName('Folder')
                .addText(text => text
                    .setValue(this.folderA)
                    .setPlaceholder('Example: Folder/Subfolder')
                    .onChange(v => this.folderA = v));
        } else if (this.searchScope === 'two-folders') {
            new Setting(contentEl)
                .setName('Folder A')
                .addText(text => text
                    .setValue(this.folderA)
                    .setPlaceholder('Example: Folder/A')
                    .onChange(v => this.folderA = v));

            new Setting(contentEl)
                .setName('Folder B')
                .addText(text => text
                    .setValue(this.folderB)
                    .setPlaceholder('Example: Folder/B')
                    .onChange(v => this.folderB = v));
        }

        // Recursive Toggle
        new Setting(contentEl)
            .setName('Recursive')
            .setDesc('Search in subfolders')
            .addToggle(t => t.setValue(this.recursive).onChange(v => this.recursive = v));

        // Action Button
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Find Duplicates')
                .setCta()
                .onClick(async () => {
                    btn.setButtonText('Scanning...').setDisabled(true);
                    try {
                        if (this.searchScope === 'vault') {
                            this.duplicates = await this.service.findDuplicatesInFolder('/', this.recursive);
                        } else if (this.searchScope === 'folder') {
                            this.duplicates = await this.service.findDuplicatesInFolder(this.folderA, this.recursive);
                        } else {
                            this.duplicates = await this.service.compareFolders(this.folderA, this.folderB, this.recursive);
                        }
                        this.display();
                    } catch (e) {
                        new Notice('Error finding duplicates');
                        console.error(e);
                        btn.setButtonText('Find Duplicates').setDisabled(false);
                    }
                }));
    }

    renderResults(contentEl: HTMLElement) {
        if (this.duplicates?.length === 0) {
            contentEl.createEl('p', { text: 'No duplicates found.' });
            new Setting(contentEl)
                .addButton(btn => btn.setButtonText('Close').onClick(() => this.close()));
            return;
        }

        contentEl.createEl('p', { text: `Found ${this.duplicates?.length} groups of duplicates.` });

        const container = contentEl.createDiv({ cls: 'dedup-results' });
        // Add some basic styling for the grid
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '20px';

        this.duplicates?.forEach((group, index) => {
            const groupEl = container.createDiv({ cls: 'dedup-group' });
            groupEl.style.border = '1px solid var(--background-modifier-border)';
            groupEl.style.padding = '10px';
            groupEl.style.borderRadius = '5px';

            const header = groupEl.createDiv({ cls: 'dedup-header' });
            header.style.marginBottom = '10px';
            header.createEl('strong', { text: `Group ${index + 1}` });
            header.createSpan({ text: ` (Size: ${this.formatSize(group.size)})`, cls: 'text-muted' });

            const filesContainer = groupEl.createDiv({ cls: 'dedup-files' });
            filesContainer.style.display = 'grid';
            filesContainer.style.gridTemplateColumns = '1fr 1fr'; // Side by side
            filesContainer.style.gap = '10px';

            group.files.forEach(file => {
                const fileCard = filesContainer.createDiv({ cls: 'dedup-file-card' });
                fileCard.style.background = 'var(--background-secondary)';
                fileCard.style.padding = '10px';
                fileCard.style.borderRadius = '5px';

                fileCard.createEl('div', { text: file.name, cls: 'file-name' });
                fileCard.createEl('div', { text: file.parent?.path || '/', cls: 'file-path text-muted' });

                // Content Preview (first 100 chars)
                this.app.vault.read(file).then(content => {
                    fileCard.createEl('div', {
                        text: content.substring(0, 100) + '...',
                        cls: 'file-preview'
                    }).style.fontSize = '0.8em';
                });

                const actions = fileCard.createDiv({ cls: 'file-actions' });
                actions.style.marginTop = '10px';
                actions.style.display = 'flex';
                actions.style.gap = '5px';

                new Setting(actions)
                    .addButton(btn => btn
                        .setButtonText('Delete')
                        .setWarning()
                        .onClick(async () => {
                            await this.service.deleteFile(file);
                            // Remove from UI and data
                            const fileIdx = group.files.indexOf(file);
                            if (fileIdx > -1) group.files.splice(fileIdx, 1);

                            if (group.files.length < 2) {
                                // Group no longer has duplicates
                                const groupIdx = this.duplicates?.indexOf(group);
                                if (groupIdx !== undefined && groupIdx > -1) {
                                    this.duplicates?.splice(groupIdx, 1);
                                }
                            }
                            this.display(); // Refresh
                        }));

                new Setting(actions)
                    .addButton(btn => btn
                        .setButtonText('Open')
                        .onClick(() => {
                            this.app.workspace.getLeaf().openFile(file);
                        }));
            });

            // Skip Button for the whole group
            const groupActions = groupEl.createDiv({ cls: 'group-actions' });
            groupActions.style.marginTop = '10px';
            new Setting(groupActions)
                .addButton(btn => btn
                    .setButtonText('Skip Group')
                    .onClick(() => {
                        const groupIdx = this.duplicates?.indexOf(group);
                        if (groupIdx !== undefined && groupIdx > -1) {
                            this.duplicates?.splice(groupIdx, 1);
                            this.display();
                        }
                    }));
        });
    }

    formatSize(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    onClose() {
        this.contentEl.empty();
    }
}
