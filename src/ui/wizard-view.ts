import { App, ItemView, WorkspaceLeaf, Setting, Notice, TFolder, TFile } from 'obsidian';
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
import { CoherenceSettings } from '../types';
import { CategorizerOptions } from '../modules/categorizer';

export const VIEW_TYPE_WIZARD = 'coherence-wizard-view';

export class WizardView extends ItemView {
    step = 0;
    inboxDir: string;
    chronoDir: string;
    livingDir: string;
    ollama: OllamaService;
    settings: CoherenceSettings;
    availableModels: string[] = [];

    constructor(leaf: WorkspaceLeaf, app: App, settings: CoherenceSettings) {
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
        return 'Coherence wizard';
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
        new Setting(container).setName('Coherence wizard').setHeading();
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
            new Notice('Failed to fetch models');
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
                new Notice(`Failed to create folder: ${path}`);
                new Notice(`Failed to create folder: ${path}`);
            }
        }
    }

    renderStep(container: HTMLElement) {
        container.empty();
        new Setting(container).setName('Coherence wizard').setHeading();

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
                container.createEl('p', { text: 'Wizard complete!' });
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
        new Setting(container).setName('Step 1: date fix').setHeading();
        container.createEl('p', { text: `Standardize dates in filenames in '${this.inboxDir}'?` });

        let recursive = this.settings.dateFixRecursive;
        let fallback = this.settings.dateFixFallbackToCreationDate;
        let format = this.settings.dateFixDateFormat;

        new Setting(container)
            .setName('Recursive')
            .addToggle(t => t.setValue(recursive).onChange(v => recursive = v));

        new Setting(container)
            .setName('Fallback to creation date')
            .addToggle(t => t.setValue(fallback).onChange(v => fallback = v));

        new Setting(container)
            .setName('Date format')
            .addText(t => t.setValue(format).onChange(v => format = v));

        new Setting(container)
            .addButton(btn => btn.setButtonText('Run date fix').setCta().onClick(() => {
                void (async () => {
                    const service = new DateFixService(this.app);
                    // Fix: Pass exceptions as string, not array
                    await service.fixDatesInFolder(this.inboxDir, recursive, fallback, format, this.settings.dateFixExceptions);
                    new Notice('Date fix complete');
                    this.next();
                })();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepChronoMerge(container: HTMLElement) {
        new Setting(container).setName('Step 2: chrono merge').setHeading();
        container.createEl('p', { text: `Merge chronological notes in '${this.inboxDir}'?` });

        new Setting(container)
            .addButton(btn => btn.setButtonText('Open chrono merge').setCta().onClick(() => {
                // We can't easily embed ChronoMergeModal in a view without refactoring it to be a view or component.
                // For now, we open the modal and wait for it to close.
                const folder = this.app.vault.getAbstractFileByPath(this.inboxDir);
                if (!(folder instanceof TFolder)) return;
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
        new Setting(container).setName('Step 3: atomize').setHeading();
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
                    mode = v as 'heading' | 'date' | 'divider';
                    // Re-render to show/hide divider input? 
                    // For simplicity, just show divider input always or let it be.
                }));

        new Setting(container)
            .setName('Divider (if mode is divider)')
            .addText(t => t.setValue(divider).onChange(v => divider = v));

        new Setting(container)
            .addButton(btn => btn.setButtonText('Atomize').setCta().onClick(() => {
                void (async () => {
                    const service = new AtomizerService(this.app.vault);
                    const folder = this.app.vault.getAbstractFileByPath(this.inboxDir);
                    if (!(folder instanceof TFolder)) return;
                    new Notice('Atomizing...');

                    // We need to collect files first because atomizing modifies the folder structure
                    const files = folder.children.filter(c => c instanceof TFile && c.extension === 'md') as TFile[];

                    for (const child of files) {
                        if (mode === 'heading') await service.atomizeByHeading(child);
                        else if (mode === 'date') await service.atomizeByDate(child);
                        else await service.atomizeByDivider(child, divider);
                    }
                    new Notice('Atomization complete');
                    this.next();
                })();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepYaml(container: HTMLElement) {
        new Setting(container).setName('Step 4: YAML template').setHeading();
        container.createEl('p', { text: `Apply YAML Template to '${this.inboxDir}'?` });

        let templateStr = this.settings.yamlTemplate;
        let addDate = this.settings.yamlAddDate;

        new Setting(container)
            .setName('Add date')
            .addToggle(t => t.setValue(addDate).onChange(v => addDate = v));

        const templateContainer = container.createDiv();
        templateContainer.createEl('p', { text: 'Template:' });
        const textArea = templateContainer.createEl('textarea');
        textArea.classList.add('coherence-textarea');
        textArea.value = templateStr;
        textArea.onchange = (e: Event) => templateStr = (e.target as HTMLTextAreaElement).value;

        new Setting(container)
            .addButton(btn => btn.setButtonText('Apply template').setCta().onClick(() => {
                void (async () => {
                    const service = new YamlTemplateService(this.app);
                    const template = templateStr.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                    await service.processFolder(this.inboxDir, template, addDate, false);
                    new Notice('YAML template applied');
                    this.next();
                })();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepSummarize(container: HTMLElement) {
        new Setting(container).setName('Step 5: summarize').setHeading();
        container.createEl('p', { text: `Summarize notes in '${this.inboxDir}'?` });

        let model = this.settings.summarizerModel;
        let overwrite = this.settings.summarizerOverwrite;
        let genTitle = this.settings.summarizerGenerateTitle;

        new Setting(container)
            .setName('Model')
            .addDropdown(d => {
                this.availableModels.forEach(m => {d.addOption(m, m)});
                d.setValue(model).onChange(v => model = v);
            });

        new Setting(container)
            .setName('Overwrite existing')
            .addToggle(t => t.setValue(overwrite).onChange(v => overwrite = v));

        new Setting(container)
            .setName('Generate title')
            .addToggle(t => t.setValue(genTitle).onChange(v => genTitle = v));

        new Setting(container)
            .addButton(btn => btn.setButtonText('Summarize').setCta().onClick(() => {
                void (async () => {
                    const service = new SummarizerService(this.app, this.ollama);
                    new Notice('Summarizing this may take a while.');
                    const prompts = [this.settings.summarizerPrompt, this.settings.summarizerPrompt2, this.settings.summarizerPrompt3, this.settings.summarizerPrompt4];
                    await service.summarizeFolder(this.inboxDir, model, false, overwrite, prompts, genTitle);
                    new Notice('Summarization complete');
                    this.next();
                })();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepRate(container: HTMLElement) {
        new Setting(container).setName('Step 6: auto rate').setHeading();
        container.createEl('p', { text: `Rate notes in '${this.inboxDir}'?` });

        let model = this.settings.ratingModel;

        new Setting(container)
            .setName('Model')
            .addDropdown(d => {
                this.availableModels.forEach(m => {d.addOption(m, m)});
                d.setValue(model).onChange(v => model = v);
            });

        new Setting(container)
            .addButton(btn => btn.setButtonText('Rate').setCta().onClick(() => {
                void (async () => {
                    const service = new RatingService(this.app, this.ollama);
                    new Notice('Rating...');
                    const params = this.settings.ratingParams.split(',').map((s: string) => s.trim());
                    await service.rateFolder(this.inboxDir, model, params, false, this.settings.ratingSkipIfRated);
                    new Notice('Rating complete');
                    this.next();
                })();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepCategorize(container: HTMLElement) {
        new Setting(container).setName('Step 7: categorize').setHeading();
        container.createEl('p', { text: `Categorize notes in '${this.inboxDir}'?` });
        container.createEl('p', {cls: 'setting-item-description' }).appendText( 'Note: this will add categories as tags in the yaml frontmatter. The next step will prompt you to move files to their respective living folders based on these tags.');

        let selectedDict = this.settings.categorizerActiveDictionary;
        let maxCats = this.settings.categorizerMaxCategories;
        let model = this.settings.categorizerModel;

        new Setting(container)
            .setName('Model')
            .addDropdown(d => {
                this.availableModels.forEach(m => {d.addOption(m, m)});
                d.setValue(model).onChange(v => model = v);
            });

        new Setting(container)
            .setName('Dictionary')
            .addDropdown(d => {
                this.settings.categorizerDictionaries.forEach((dict: { name: string; content: string }) => { d.addOption(dict.name, dict.name)});
                d.setValue(selectedDict);
                d.onChange(v => selectedDict = v);
            });

        new Setting(container)
            .setName('Max categories')
            .addText(t => t.setValue(maxCats.toString()).onChange(v => maxCats = parseInt(v) || 1));

        new Setting(container)
            .addButton(btn => btn.setButtonText('Categorize').setCta().onClick(() => {
                void (async () => {
                    const service = new CategorizerService(this.app, this.ollama);
                    const dict = this.settings.categorizerDictionaries.find((d: { name: string; content: string }) => d.name === selectedDict);
                    if (!dict) return;

                    new Notice('Categorizing...');

                    const options:  CategorizerOptions = {
                        model: model,
                        categories: dict.content.split('\n').map((line: string) => {
                            const parts = line.split(/[-;]/);
                            return parts[0].trim();
                        }).filter((s: string) => s.length > 0),
                        maxCategories: maxCats,
                        applyAsTag: this.settings.categorizerApplyAsTag,
                        applyAsBacklink: this.settings.categorizerApplyAsBacklink,
                        moveToFolder: false,
                        tagHandlingMode: 'append'
                    };

                    await service.processFolder(this.inboxDir, options, false);
                    new Notice('Categorization complete');
                    this.next();
                })();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepMoveCopy(container: HTMLElement) {
        new Setting(container).setName('Step 8: move & copy').setHeading();
        container.createEl('p', { text: `Move categorized files to '${this.livingDir}' and copy to '${this.chronoDir}'?` });

        new Setting(container)
            .addButton(btn => btn.setButtonText('Execute').setCta().onClick(() => {
                void (async () => {
                    new Notice('Moving and copying...');
                    await this.moveAndCopyLogic();
                    new Notice('Move & copy complete');
                    this.next();
                })();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    async moveAndCopyLogic() {
        const inbox = this.app.vault.getAbstractFileByPath(this.inboxDir)
        if (!(inbox instanceof TFolder)) return;
        const files = inbox.children.filter(f => f instanceof TFile && f.extension === 'md') as TFile[];

        for (const file of files) {
            let category = '';
            await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
                if (fm.tags) {
                    if (Array.isArray(fm.tags) && fm.tags.length > 0) category = fm.tags[0] as string;
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
        new Setting(container).setName('Step 9: combine').setHeading();
        container.createEl('p', { text: `Combine files in '${this.livingDir}' subfolders?` });

        let stripYaml = this.settings.concatonizerStripYaml;

        new Setting(container)
            .setName('Strip YAML')
            .addToggle(t => t.setValue(stripYaml).onChange(v => stripYaml = v));

        new Setting(container)
            .addButton(btn => btn.setButtonText('Combine').setCta().onClick(() => {
                void (async () => {
                    const service = new ConcatonizerService(this.app.vault);
                    const living = this.app.vault.getAbstractFileByPath(this.livingDir);
                    if (!(living instanceof TFolder)) return;
                    new Notice('Combining...');

                    for (const child of living.children) {
                        if (child instanceof TFolder) {
                            const outputName = `${child.name}_Combined.md`;
                            await service.concatonizeFolder(child.path, outputName, false, stripYaml, true);
                        }
                    }
                    new Notice('Combine complete');
                    this.next();
                })();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepWisdom(container: HTMLElement) {
        new Setting(container).setName('Step 10: extract wisdom').setHeading();
        container.createEl('p', { text: `Extract wisdom from combined files in '${this.livingDir}'?` });

        let model = this.settings.generalizerModel;

        new Setting(container)
            .setName('Model')
            .addDropdown(d => {
                this.availableModels.forEach(m => { d.addOption(m, m) });
                d.setValue(model).onChange(v => model = v);
            });

        new Setting(container)
            .addButton(btn => btn.setButtonText('Extract').setCta().onClick(() => {
                void (async () => {
                    const service = new GeneralizerService(this.app, this.settings);
                    const living = this.app.vault.getAbstractFileByPath(this.livingDir);
                    if (!(living instanceof TFolder)) return;
                    new Notice('Extracting wisdom...');

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
                    new Notice('Wisdom extraction complete');
                    this.next();
                })();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.next()));
    }

    stepFinalMerge(container: HTMLElement) {
        new Setting(container).setName('Step 11: final merge').setHeading();
        container.createEl('p', { text: `Merge all wisdom files into a final output?` });

        new Setting(container)
            .addButton(btn => btn.setButtonText('Merge').setCta().onClick(() => {
                void (async () => {
                    // const service = new ConcatonizerService(this.app.vault); // Unused
                    let finalContent = '# Final Wisdom\n\n';
                    const living = this.app.vault.getAbstractFileByPath(this.livingDir);
                    if (!(living instanceof TFolder)) return;

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

                    new Notice('Final merge complete');
                    this.leaf.detach();
                })();
            }))
            .addButton(btn => btn.setButtonText('Skip').onClick(() => this.leaf.detach()));
    }
}
