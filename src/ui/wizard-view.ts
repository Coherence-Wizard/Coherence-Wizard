import { App, ItemView, WorkspaceLeaf, Setting, Notice, TFolder, TFile, ButtonComponent } from 'obsidian';
import { DateFixService } from '../modules/date-fix';
import { ChronoMergeModal } from './chrono-merge-modal';
import { AtomizerService } from '../modules/atomizer';
import { YamlTemplateService } from '../modules/yaml-template';
import { SummarizerService } from '../modules/summarizer';
import { RatingService } from '../modules/rating';
import { CategorizerService } from '../modules/categorizer';
import { ConcatonizerService } from '../modules/concatonizer';
import { GeneralizerService } from '../modules/generalizer';
import { OllamaService } from '../modules/ollama';

export const VIEW_TYPE_WIZARD = 'coherence-wizard-view';

export class WizardView extends ItemView {
    step: number = 0;
    inboxDir: string;
    chronoDir: string;
    livingDir: string;
    ollama: OllamaService;
    settings: any;
    availableModels: string[] = [];

    constructor(leaf: WorkspaceLeaf, app: App, settings: any) {
        super(leaf);
        this.app = app;
        this.settings = settings;
        this.inboxDir = settings.wizardInboxDir || 'Inbox';
        this.chronoDir = settings.wizardChronoDir || 'Chrono';
        this.livingDir = settings.wizardLivingDir || 'Living';
        this.ollama = new OllamaService(settings.ollamaUrl);
    }

    getViewType() {
        return VIEW_TYPE_WIZARD;
    }

    getDisplayText() {
        return 'Coherence Wizard';
    }

    getIcon() {
        return 'wand';
    }

    async onOpen() {
        await this.display();
    }

    async display() {
        const container = this.contentEl;
        container.empty();
        container.createEl('h2', { text: 'Coherence Wizard' });
        await this.fetchModels();

        // Ensure Folders Exist
        await this.ensureFolder(this.inboxDir);
        await this.ensureFolder(this.chronoDir);
        await this.ensureFolder(this.livingDir);

        // Validate Folders
        const inbox = this.app.vault.getAbstractFileByPath(this.inboxDir);
        const chrono = this.app.vault.getAbstractFileByPath(this.chronoDir);
        const living = this.app.vault.getAbstractFileByPath(this.livingDir);

        if (!inbox || !(inbox instanceof TFolder)) {
            container.createEl('p', { text: `Error: '${this.inboxDir}' exists but is not a folder.`, cls: 'error-text' });
            return;
        }
        if (!chrono || !(chrono instanceof TFolder)) {
            container.createEl('p', { text: `Error: '${this.chronoDir}' exists but is not a folder.`, cls: 'error-text' });
            return;
        }
        if (!living || !(living instanceof TFolder)) {
            container.createEl('p', { text: `Error: '${this.livingDir}' exists but is not a folder.`, cls: 'error-text' });
            return;
        }

        this.renderStep(container);
    }

    async fetchModels() {
        try {
            this.availableModels = await this.ollama.listModels();
            if (this.availableModels.length === 0) {
                this.availableModels = ['llama3', 'mistral', 'gemma'];
            }
        } catch (e) {
            console.error('Failed to fetch models', e);
            this.availableModels = ['llama3', 'mistral', 'gemma'];
        }
    }

    async ensureFolder(path: string) {
        const file = this.app.vault.getAbstractFileByPath(path);
        if (!file) {
            try {
                await this.app.vault.createFolder(path);
                new Notice(`Created folder: ${path}`);
            } catch (e) {
                console.error(`Failed to create folder ${path}`, e);
                new Notice(`Failed to create folder: ${path}`);
            }
        }
    }

    renderStep(container: HTMLElement) {
        container.empty();
        container.createEl('h2', { text: 'Coherence Wizard' });

        switch (this.step) {
            case 0: this.stepDateFix(container); break;
            case 1: this.stepChronoMerge(container); break;
            case 2: this.stepAtomize(container); break;
            case 3: this.stepYaml(container); break;
            case 4: this.stepSummarize(container); break;
            case 5: this.stepRate(container); break;
            case 6: this.stepCategorize(container); break;
            case 7: this.stepMoveCopy(container); break;
            case 8: this.stepCombine(container); break;
            case 9: this.stepWisdom(container); break;
            case 10: this.stepFinalMerge(container); break;
            default:
                container.createEl('p', { text: 'Wizard Complete!' });
                new Setting(container).addButton(btn => btn.setButtonText('Close').onClick(() => {
                    this.leaf.detach();
                }));
        }
    }

    next() {
        this.step++;
        this.renderStep(this.contentEl);
    }

    // --- Steps ---

    stepDateFix(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 1: Date Fix' });
        container.createEl('p', { text: `Standardize dates in filenames in '${this.inboxDir}'?` });

        let recursive = this.settings.dateFixRecursive;
        let fallback = this.settings.dateFixFallbackToCreationDate;
        let format = this.settings.dateFixDateFormat;

        new Setting(container)
            .setName('Recursive')
            .addToggle(t => t.setValue(recursive).onChange(v => recursive = v));

        new Setting(container)
            .setName('Fallback to Creation Date')
            .addToggle(t => t.setValue(fallback).onChange(v => fallback = v));

        new Setting(container)
            .setName('Date Format')
            .addText(t => t.setValue(format).onChange(v => format = v));

        new Setting(container)
            .addButton(btn => btn.setButtonText('Run Date Fix').setCta().onClick(async () => {
                const service = new DateFixService(this.app.vault);
                // Fix: Pass exceptions as string, not array
                await service.fixDatesInFolder(this.inboxDir, recursive, fallback, format, this.settings.dateFixExceptions);
                new Notice('Date Fix Complete');
                this.next();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepChronoMerge(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 2: Chrono Merge' });
        container.createEl('p', { text: `Merge chronological notes in '${this.inboxDir}'?` });

        new Setting(container)
            .addButton(btn => btn.setButtonText('Open Chrono Merge').setCta().onClick(() => {
                // We can't easily embed ChronoMergeModal in a view without refactoring it to be a view or component.
                // For now, we open the modal and wait for it to close.
                const folder = this.app.vault.getAbstractFileByPath(this.inboxDir) as TFolder;
                const modal = new ChronoMergeModal(this.app, this.settings, folder);
                // @ts-ignore
                modal.onCloseCallback = () => {
                    this.next();
                };
                modal.open();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepAtomize(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 3: Atomize' });
        container.createEl('p', { text: `Atomize notes in '${this.inboxDir}'?` });

        let mode: 'heading' | 'date' | 'divider' = 'heading';
        let divider = this.settings.atomizerDivider || '---';

        new Setting(container)
            .setName('Mode')
            .addDropdown(d => d
                .addOption('heading', 'Heading')
                .addOption('date', 'Date')
                .addOption('divider', 'Divider')
                .setValue(mode)
                .onChange(v => {
                    mode = v as any;
                    // Re-render to show/hide divider input? 
                    // For simplicity, just show divider input always or let it be.
                }));

        new Setting(container)
            .setName('Divider (if mode is Divider)')
            .addText(t => t.setValue(divider).onChange(v => divider = v));

        new Setting(container)
            .addButton(btn => btn.setButtonText('Atomize').setCta().onClick(async () => {
                const service = new AtomizerService(this.app.vault);
                const folder = this.app.vault.getAbstractFileByPath(this.inboxDir) as TFolder;
                new Notice('Atomizing...');

                // We need to collect files first because atomizing modifies the folder structure
                const files = folder.children.filter(c => c instanceof TFile && c.extension === 'md') as TFile[];

                for (const child of files) {
                    if (mode === 'heading') await service.atomizeByHeading(child);
                    else if (mode === 'date') await service.atomizeByDate(child);
                    else await service.atomizeByDivider(child, divider);
                }
                new Notice('Atomization Complete');
                this.next();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepYaml(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 4: YAML Template' });
        container.createEl('p', { text: `Apply YAML Template to '${this.inboxDir}'?` });

        let templateStr = this.settings.yamlTemplate;
        let addDate = this.settings.yamlAddDate;

        new Setting(container)
            .setName('Add Date')
            .addToggle(t => t.setValue(addDate).onChange(v => addDate = v));

        const templateContainer = container.createDiv();
        templateContainer.createEl('p', { text: 'Template:' });
        const textArea = templateContainer.createEl('textarea');
        textArea.style.width = '100%';
        textArea.style.height = '100px';
        textArea.value = templateStr;
        textArea.onchange = (e: any) => templateStr = e.target.value;

        new Setting(container)
            .addButton(btn => btn.setButtonText('Apply Template').setCta().onClick(async () => {
                const service = new YamlTemplateService(this.app);
                const template = templateStr.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                await service.processFolder(this.inboxDir, template, addDate, false);
                new Notice('YAML Template Applied');
                this.next();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepSummarize(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 5: Summarize' });
        container.createEl('p', { text: `Summarize notes in '${this.inboxDir}'?` });

        let model = this.settings.summarizerModel;
        let overwrite = this.settings.summarizerOverwrite;
        let genTitle = this.settings.summarizerGenerateTitle;

        new Setting(container)
            .setName('Model')
            .addDropdown(d => {
                this.availableModels.forEach(m => d.addOption(m, m));
                d.setValue(model).onChange(v => model = v);
            });

        new Setting(container)
            .setName('Overwrite Existing')
            .addToggle(t => t.setValue(overwrite).onChange(v => overwrite = v));

        new Setting(container)
            .setName('Generate Title')
            .addToggle(t => t.setValue(genTitle).onChange(v => genTitle = v));

        new Setting(container)
            .addButton(btn => btn.setButtonText('Summarize').setCta().onClick(async () => {
                const service = new SummarizerService(this.app, this.ollama);
                new Notice('Summarizing... this may take a while.');
                const prompts = [this.settings.summarizerPrompt, this.settings.summarizerPrompt2, this.settings.summarizerPrompt3, this.settings.summarizerPrompt4];
                await service.summarizeFolder(this.inboxDir, model, false, overwrite, prompts, genTitle);
                new Notice('Summarization Complete');
                this.next();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepRate(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 6: Auto Rate' });
        container.createEl('p', { text: `Rate notes in '${this.inboxDir}'?` });

        let model = this.settings.ratingModel;

        new Setting(container)
            .setName('Model')
            .addDropdown(d => {
                this.availableModels.forEach(m => d.addOption(m, m));
                d.setValue(model).onChange(v => model = v);
            });

        new Setting(container)
            .addButton(btn => btn.setButtonText('Rate').setCta().onClick(async () => {
                const service = new RatingService(this.app, this.ollama);
                new Notice('Rating...');
                const params = this.settings.ratingParams.split(',').map((s: string) => s.trim());
                await service.rateFolder(this.inboxDir, model, params, false, this.settings.ratingSkipIfRated);
                new Notice('Rating Complete');
                this.next();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepCategorize(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 7: Categorize' });
        container.createEl('p', { text: `Categorize notes in '${this.inboxDir}'?` });
        container.createEl('p', { text: 'Note: This will add categories as tags in the YAML frontmatter. The next step will prompt you to move files to their respective Living folders based on these tags.', cls: 'setting-item-description' });

        let selectedDict = this.settings.categorizerActiveDictionary;
        let maxCats = this.settings.categorizerMaxCategories;
        let model = this.settings.categorizerModel;

        new Setting(container)
            .setName('Model')
            .addDropdown(d => {
                this.availableModels.forEach(m => d.addOption(m, m));
                d.setValue(model).onChange(v => model = v);
            });

        new Setting(container)
            .setName('Dictionary')
            .addDropdown(d => {
                this.settings.categorizerDictionaries.forEach((dict: any) => d.addOption(dict.name, dict.name));
                d.setValue(selectedDict);
                d.onChange(v => selectedDict = v);
            });

        new Setting(container)
            .setName('Max Categories')
            .addText(t => t.setValue(maxCats.toString()).onChange(v => maxCats = parseInt(v) || 1));

        new Setting(container)
            .addButton(btn => btn.setButtonText('Categorize').setCta().onClick(async () => {
                const service = new CategorizerService(this.app, this.ollama);
                const dict = this.settings.categorizerDictionaries.find((d: any) => d.name === selectedDict);
                if (!dict) return;

                new Notice('Categorizing...');

                const options = {
                    model: model,
                    categories: dict.content.split('\n').map((line: string) => {
                        const parts = line.split(/[-;]/);
                        return parts[0].trim();
                    }).filter((s: string) => s.length > 0),
                    maxCategories: maxCats,
                    applyAsTag: this.settings.categorizerApplyAsTag,
                    applyAsBacklink: this.settings.categorizerApplyAsBacklink,
                    moveToFolder: false
                };

                await service.processFolder(this.inboxDir, options, false);
                new Notice('Categorization Complete');
                this.next();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepMoveCopy(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 8: Move & Copy' });
        container.createEl('p', { text: `Move categorized files to '${this.livingDir}' and copy to '${this.chronoDir}'?` });

        new Setting(container)
            .addButton(btn => btn.setButtonText('Execute').setCta().onClick(async () => {
                new Notice('Moving and Copying...');
                await this.moveAndCopyLogic();
                new Notice('Move & Copy Complete');
                this.next();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    async moveAndCopyLogic() {
        const inbox = this.app.vault.getAbstractFileByPath(this.inboxDir) as TFolder;
        const files = inbox.children.filter(f => f instanceof TFile && f.extension === 'md') as TFile[];

        for (const file of files) {
            let category = '';
            await this.app.fileManager.processFrontMatter(file, (fm) => {
                if (fm.tags) {
                    if (Array.isArray(fm.tags) && fm.tags.length > 0) category = fm.tags[0];
                    else if (typeof fm.tags === 'string') category = fm.tags;
                }
            });

            if (category) {
                category = category.replace(/^#/, '');

                // 1. Copy to Chrono
                const chronoPath = `${this.chronoDir}/${file.name}`;
                if (!await this.app.vault.adapter.exists(chronoPath)) {
                    await this.app.vault.copy(file, chronoPath);
                }

                // 2. Move to Living/{Category}
                const categoryDir = `${this.livingDir}/${category}`;
                if (!await this.app.vault.adapter.exists(categoryDir)) {
                    await this.app.vault.createFolder(categoryDir);
                }
                const livingPath = `${categoryDir}/${file.name}`;
                if (!await this.app.vault.adapter.exists(livingPath)) {
                    await this.app.fileManager.renameFile(file, livingPath);
                }
            }
        }
    }

    stepCombine(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 9: Combine' });
        container.createEl('p', { text: `Combine files in '${this.livingDir}' subfolders?` });

        let stripYaml = this.settings.concatonizerStripYaml;

        new Setting(container)
            .setName('Strip YAML')
            .addToggle(t => t.setValue(stripYaml).onChange(v => stripYaml = v));

        new Setting(container)
            .addButton(btn => btn.setButtonText('Combine').setCta().onClick(async () => {
                const service = new ConcatonizerService(this.app.vault);
                const living = this.app.vault.getAbstractFileByPath(this.livingDir) as TFolder;
                new Notice('Combining...');

                for (const child of living.children) {
                    if (child instanceof TFolder) {
                        const outputName = `${child.name}_Combined.md`;
                        await service.concatonizeFolder(child.path, outputName, false, stripYaml, true);
                    }
                }
                new Notice('Combine Complete');
                this.next();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepWisdom(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 10: Extract Wisdom' });
        container.createEl('p', { text: `Extract wisdom from combined files in '${this.livingDir}'?` });

        let model = this.settings.generalizerModel;

        new Setting(container)
            .setName('Model')
            .addDropdown(d => {
                this.availableModels.forEach(m => d.addOption(m, m));
                d.setValue(model).onChange(v => model = v);
            });

        new Setting(container)
            .addButton(btn => btn.setButtonText('Extract').setCta().onClick(async () => {
                const service = new GeneralizerService(this.app, this.settings);
                const living = this.app.vault.getAbstractFileByPath(this.livingDir) as TFolder;
                new Notice('Extracting Wisdom...');

                for (const child of living.children) {
                    if (child instanceof TFolder) {
                        const combinedPath = `${child.path}/${child.name}_Combined.md`;
                        const file = this.app.vault.getAbstractFileByPath(combinedPath);
                        if (file instanceof TFile) {
                            await service.processFile(
                                file,
                                model,
                                this.settings.generalizerPrompt,
                                'same-folder',
                                '_Wisdom',
                                this.settings.generalizerSystemPrompt,
                                this.settings.generalizerMaxTokens,
                                this.settings.generalizerRepeatPenalty,
                                this.settings.generalizerMultiStage,
                                this.settings.generalizerIntermediatePrompt
                            );
                        }
                    }
                }
                new Notice('Wisdom Extraction Complete');
                this.next();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepFinalMerge(container: HTMLElement) {
        container.createEl('h3', { text: 'Step 11: Final Merge' });
        container.createEl('p', { text: `Merge all Wisdom files into a final output?` });

        new Setting(container)
            .addButton(btn => btn.setButtonText('Merge').setCta().onClick(async () => {
                const service = new ConcatonizerService(this.app.vault);
                let finalContent = '# Final Wisdom\n\n';
                const living = this.app.vault.getAbstractFileByPath(this.livingDir) as TFolder;

                for (const child of living.children) {
                    if (child instanceof TFolder) {
                        const wisdomPath = `${child.path}/${child.name}_Combined_Wisdom.md`;
                        const file = this.app.vault.getAbstractFileByPath(wisdomPath);
                        if (file instanceof TFile) {
                            const content = await this.app.vault.read(file);
                            finalContent += `## ${child.name}\n\n${content}\n\n`;
                        }
                    }
                }

                await this.app.vault.create(`${this.livingDir}/Final_Wisdom.md`, finalContent);

                new Notice('Final Merge Complete');
                this.leaf.detach();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.leaf.detach()));
    }
}
