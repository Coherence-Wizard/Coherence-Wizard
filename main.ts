import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { AtomizerModal } from './src/ui/atomizer-modal';
import { SummarizerModal } from './src/ui/summarizer-modal';
import { WisdomModal } from './src/ui/wisdom-modal';
import { DateFixModal } from './src/ui/date-fix-modal';
import { ConcatonizerModal } from './src/ui/concatonizer-modal';
import { RatingModal } from './src/ui/rating-modal';

import { CategorizerModal } from './src/ui/categorizer-modal';
import { DeduplicationModal } from './src/ui/deduplication-modal';
import { ParseAndMoveModal } from './src/ui/parse-and-move-modal';
import { CensorModal } from './src/ui/censor-modal';
import { GeneralizerModal } from './src/ui/generalizer-modal';

import { MergeModal } from './src/ui/merge-modal';
import { CategorizeHubModal } from './src/ui/categorize-hub-modal';
import { DistillModal } from './src/ui/distill-modal';
import { ChronoMergeModal } from './src/ui/chrono-merge-modal';
import { WizardView, VIEW_TYPE_WIZARD } from './src/ui/wizard-view';
import { YamlTemplateModal } from './src/ui/yaml-template-modal';
import { OllamaService } from './src/modules/ollama';
import { DateFixService } from './src/modules/date-fix';
import { AtomizerService } from './src/modules/atomizer';
import { SummarizerService } from './src/modules/summarizer';
import { WisdomService } from './src/modules/wisdom';
import { RatingService } from './src/modules/rating';
import { YamlTemplateService } from './src/modules/yaml-template';
import { CategorizerService } from './src/modules/categorizer';
import { DeduplicationService } from './src/modules/deduplication';
import { ParseAndMoveService } from './src/modules/parse-and-move';
import { CensorService } from './src/modules/censor';
import { ChronoMergeService } from './src/modules/chrono-merge';
import { ConcatonizerService } from './src/modules/concatonizer';

export interface CoherenceSettings {
    // General
    ollamaUrl: string;

    // Atomizer
    atomizerDivider: string;
    atomizerModel: string;
    atomizerMode: 'heading' | 'date' | 'divider';

    // Summarizer
    summarizerModel: string;
    summarizerRecursive: boolean;
    summarizerOverwrite: boolean;
    summarizerIncludeYaml: boolean;
    summarizerMaxChars: number;
    summarizerPrompt: string;
    summarizerPrompt2: string;
    summarizerPrompt3: string;
    summarizerPrompt4: string;
    summarizerGenerateTitle: boolean;

    // Automatic Rating
    ratingModel: string;
    ratingParams: string;
    ratingSkipIfRated: boolean;

    // YAML Template
    yamlTemplate: string;
    yamlAddDate: boolean;
    yamlRecursive: boolean;


    // Categorizer
    categorizerModel: string;
    categorizerDictionaries: { name: string; content: string }[];
    categorizerActiveDictionary: string;
    categorizerApplyAsTag: boolean;
    categorizerApplyAsBacklink: boolean;
    categorizerMoveToFolder: boolean;
    categorizerMaxCategories: number;

    // Date Fix
    dateFixRecursive: boolean;
    dateFixFallbackToCreationDate: boolean;
    dateFixDateFormat: string;
    dateFixExceptions: string;

    // Chrono Merge
    chronoMergeTimeThreshold: number;
    chronoMergeRecursive: boolean;
    chronoMergeUseCreationTime: boolean;

    // Deduplication
    deduplicationRecursive: boolean;

    // Parse and Move
    parseAndMoveTargetDir: string;
    parseAndMoveRecursive: boolean;

    // Generalizer
    generalizerModel: string;
    generalizerPrompt: string;
    generalizerSystemPrompt: string;
    generalizerWisdomPrompt: string;
    generalizerOutputMode: 'folder' | 'same-folder';
    generalizerSuffix: string;
    generalizerMaxTokens: number;
    generalizerRepeatPenalty: number;
    generalizerMultiStage: boolean;
    generalizerIntermediatePrompt: string;
    generalizerRecursive: boolean;

    // Wisdom
    wisdomModel: string;
    wisdomMode: 'advice' | 'insight';
    wisdomPrompt: string;

    // Censor
    censorDictionaries: { name: string; content: string }[];
    censorActiveDictionary: string;
    censorReplacementChar: string;
    censorRecursive: boolean;
    censorOutputMode: 'folder' | 'same-folder';
    censorSuffix: string;

    // Concatonizer
    concatonizerRecursive: boolean;
    concatonizerSuffix: string;
    concatonizerStripYaml: boolean;

    // Context Menu Visibility
    contextMenuDateFix: boolean;
    contextMenuMerge: boolean;
    contextMenuAtomize: boolean;
    contextMenuYamlTemplate: boolean;
    contextMenuSummarize: boolean;
    contextMenuCategorize: boolean;
    contextMenuParseAndMove: boolean;
    contextMenuDistill: boolean;
    contextMenuRating: boolean;

    // Wizard
    wizardInboxDir: string;
    wizardChronoDir: string;
    wizardLivingDir: string;
}

const DEFAULT_SETTINGS: CoherenceSettings = {
    // General
    ollamaUrl: 'http://localhost:11434',

    // Wizard
    wizardInboxDir: 'Inbox',
    wizardChronoDir: 'Chrono',
    wizardLivingDir: 'Living',

    // Atomizer
    atomizerDivider: '---',
    atomizerModel: 'llama3',
    atomizerMode: 'heading',

    // Summarizer
    summarizerModel: 'llama3',
    summarizerRecursive: false,
    summarizerOverwrite: false,
    summarizerIncludeYaml: false,
    summarizerMaxChars: 50000,
    summarizerPrompt: "Please summarise the following Markdown content from the file titled '{filename}':\n\n{text}",
    summarizerPrompt2: "You are a summarization assistant. Condense the following note into 50 words or fewer. Start directly with the main point and avoid phrases like 'This note', 'Key takeaways', 'It emphasizes', or any similar preamble. Use plain sentences only—no headings, quotes, markdown, dates, filenames, or filler.\n\nTitle: {filename}\n\nLonger summary:\n{summary}",
    summarizerPrompt3: "Rewrite the following text keeping it at 50 words or fewer. Remove any filler, preambles (e.g., 'This note...', 'Key takeaways...'), dates, filenames, headings, markdown, or meta-language. Return only the cleaned summary text.\n\nText:\n{summary}",
    summarizerPrompt4: "Rewrite the following summary text, capitalizing the most important words, subjects, and key concepts. Keep all other text unchanged. Return only the rewritten text with capitalized important words.\n\nSummary:\n{summary}",
    summarizerGenerateTitle: true,

    // Automatic Rating
    ratingModel: 'llama3',
    ratingParams: 'coherence, profundity',
    ratingSkipIfRated: true,

    // YAML Template
    yamlTemplate: "date\nsummary\nsummary model\naudited\nrating",
    yamlAddDate: true,
    yamlRecursive: true,

    // Categorizer
    categorizerModel: 'llama3',
    categorizerDictionaries: [
        {
            name: 'Demo Dictionary',
            content: `Personal; Notes related to personal life
Work; Notes related to work
School; Notes related to school
Recipes; Cooking recipes`
        }
    ],
    categorizerActiveDictionary: 'Demo Dictionary',
    categorizerApplyAsTag: true,
    categorizerApplyAsBacklink: false,
    categorizerMoveToFolder: false,
    categorizerMaxCategories: 1,

    // Date Fix
    dateFixRecursive: false,
    dateFixFallbackToCreationDate: false,
    dateFixDateFormat: 'YYYY-MM-DD',
    dateFixExceptions: '*.py',

    // Chrono Merge
    chronoMergeTimeThreshold: 5,
    chronoMergeRecursive: false,
    chronoMergeUseCreationTime: false,

    // Deduplication
    deduplicationRecursive: true,

    // Parse and Move
    parseAndMoveTargetDir: 'Parsed',
    parseAndMoveRecursive: false,

    // Generalizer
    generalizerModel: 'llama3',
    generalizerPrompt: `You are a professional editor and wisdom extractor. Your task is to rewrite the following personal text into a piece of universal wisdom suitable for a general audience.
1. **Extract Wisdom**: Identify the core insights, lessons, and universal truths in the text.
2. **Generalize**: Remove all specific names, places, dates, and personally identifiable details. Replace them with general terms (e.g., replace "John" with "a friend", "Paris" with "a city").
3. **Relatability**: Ensure the tone is relatable and engaging for a public audience.
4. **Format**: Return ONLY the rewritten text. Do not include any preamble, explanations, or markdown code blocks.

Here is the text:
{text}`,
    generalizerSystemPrompt: 'You are a strict text-processing AI. Return ONLY the rewritten text. Do not include any preamble, introduction, explanation, or conclusion. Do not say "Here is the text". Do not summarize. Maintain the original language.',
    generalizerWisdomPrompt: `You are a world-renowned self-help author and philosopher. Your task is to rewrite the provided personal text into profound, universal wisdom.

### GUIDELINES:
1. **TRANSFORM**: Turn personal struggles into universal lessons on self-actualization and growth. Find the "silver lining".
2. **GENERALIZE**: STRICTLY REMOVE all specific names, dates, locations, and personally identifiable details. Replace them with general terms (e.g., "a friend", "a city").
3. **TONE**: Compassionate, insightful, and empowering.
4. **LANGUAGE**: Output must be in the same language as the input text.
5. **NO SUMMARIES**: Do not summarize. Rewrite the content as advice.

### INPUT TEXT:
{text}

### FINAL INSTRUCTION:
Rewrite the text above into universal wisdom.
- REMOVE ALL NAMES and specific details.
- Return ONLY the rewritten text.
- NO PREAMBLE.`,
    generalizerOutputMode: 'folder',
    generalizerSuffix: '_generalized',
    generalizerMaxTokens: 8192,
    generalizerRepeatPenalty: 1.1,
    generalizerMultiStage: false,
    generalizerIntermediatePrompt: `You are a detailed summarizer. Your task is to create a comprehensive summary of the following text that retains ALL key details, emotional nuances, and specific events.
1. **Detail**: Do not make it brief. Capture the full essence of the narrative.
2. **Tone**: Maintain the original tone and perspective (first-person if applicable).
3. **Format**: Return ONLY the summary text. No preamble.

Here is the text:
{text}`,
    generalizerRecursive: false,

    // Wisdom
    wisdomModel: 'llama3',
    wisdomMode: 'advice',
    wisdomPrompt: 'Extract wisdom from this text.',

    censorDictionaries: [
        {
            name: 'Demo Dictionary',
            content: `John, Jon, Johnathon = Fernando
Jane = Mary
Bob, Robert = Ed`
        }
    ],
    censorActiveDictionary: 'Demo Dictionary',
    censorReplacementChar: "█",
    censorRecursive: false,
    censorOutputMode: 'folder',
    censorSuffix: '_censored',

    // Concatonizer
    concatonizerRecursive: false,
    concatonizerSuffix: '_combined',
    concatonizerStripYaml: false,

    // Context Menu Visibility
    contextMenuDateFix: true,
    contextMenuMerge: true,
    contextMenuAtomize: true,
    contextMenuYamlTemplate: true,
    contextMenuSummarize: true,
    contextMenuCategorize: true,
    contextMenuParseAndMove: true,

    contextMenuDistill: true,
    contextMenuRating: true,
};

export default class CoherencePlugin extends Plugin {
    settings: CoherenceSettings;

    async activateWizardView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_WIZARD);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_WIZARD, active: true });
        }

        workspace.revealLeaf(leaf);
    }

    async onload() {
        console.log('Coherence Plugin: Loaded version 0.0.22');
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE_WIZARD,
            (leaf) => new WizardView(leaf, this.app, this.settings)
        );

        // Add Ribbon Icon
        this.addRibbonIcon('wand-2', 'Coherence Wizard', (evt: MouseEvent) => {
            this.activateWizardView();
        });

        // Add Status Bar Item
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Coherence Wizard Active');

        // Atomizer Command
        this.addCommand({
            id: 'open-atomizer-modal',
            name: 'Open Atomizer',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new AtomizerModal(this.app, this.settings, file).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Summarizer Command
        this.addCommand({
            id: 'open-summarizer-modal',
            name: 'Open Summarizer',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new SummarizerModal(this.app, this.settings, async (key, value) => {
                        (this.settings as any)[key] = value;
                        await this.saveSettings();
                    }, file).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Wisdom Command
        this.addCommand({
            id: 'open-wisdom-modal',
            name: 'Open Wisdom Extractor',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new WisdomModal(this.app, this.settings, file).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Date Fix Command
        this.addCommand({
            id: 'open-date-fix-modal',
            name: 'Open Date Fix',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new DateFixModal(this.app, this.settings, file).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Concatonizer Command
        this.addCommand({
            id: 'open-concatonizer-modal',
            name: 'Open Concatonizer',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    if (file.parent) {
                        new ConcatonizerModal(this.app, this.settings, file.parent).open();
                    }
                } else {
                    new Notice('No active file to determine folder.');
                }
            }
        });

        // Rating Command
        this.addCommand({
            id: 'open-rating-modal',
            name: 'Open Rating',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new RatingModal(this.app, this.settings, async (key, value) => {
                        (this.settings as any)[key] = value;
                        await this.saveSettings();
                    }, file).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Categorizer Command
        this.addCommand({
            id: 'open-categorizer-modal',
            name: 'Open Categorizer',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new CategorizeHubModal(this.app, this.settings, file).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Deduplication Command
        this.addCommand({
            id: 'open-deduplication-modal',
            name: 'Open Deduplication',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file && file.parent) {
                    new DeduplicationModal(this.app, file.parent).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Parse and Move Command
        this.addCommand({
            id: 'open-parse-and-move-modal',
            name: 'Open Parse and Move',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new ParseAndMoveModal(this.app, this.settings, file).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Censor Command
        this.addCommand({
            id: 'open-censor-modal',
            name: 'Open Censor and Alias',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new CensorModal(this.app, this.settings, file).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Chrono Merge Command
        this.addCommand({
            id: 'open-chrono-merge-modal',
            name: 'Open Chrono Merge',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file && file.parent) {
                    new ChronoMergeModal(this.app, this.settings, file.parent).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Coherence Wizard Command
        this.addCommand({
            id: 'open-coherence-wizard',
            name: 'Open Coherence Wizard',
            callback: () => {
                this.activateWizardView();
            }
        });

        // Context Menu: Editor
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                // 1. Date Fix
                if (this.settings.contextMenuDateFix) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Date Fix')
                            .setIcon('calendar')
                            .onClick(async () => {
                                new DateFixModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 2. Merge
                if (this.settings.contextMenuMerge) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Merge')
                            .setIcon('merge')
                            .onClick(async () => {
                                new MergeModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 3. Atomize
                if (this.settings.contextMenuAtomize) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Atomize')
                            .setIcon('scissors')
                            .onClick(async () => {
                                new AtomizerModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 4. YAML Template
                if (this.settings.contextMenuYamlTemplate) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Apply YAML Template')
                            .setIcon('layout-template')
                            .onClick(async () => {
                                new YamlTemplateModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 5. Summarize
                if (this.settings.contextMenuSummarize) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Summarize')
                            .setIcon('lines-of-text')
                            .onClick(async () => {
                                new SummarizerModal(this.app, this.settings, async (key, value) => {
                                    (this.settings as any)[key] = value;
                                    await this.saveSettings();
                                }, view.file).open();
                            });
                    });
                }
                // 6. Categorize
                if (this.settings.contextMenuCategorize) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Categorize')
                            .setIcon('folder')
                            .onClick(async () => {
                                new CategorizeHubModal(this.app, this.settings, async (key, value) => {
                                    (this.settings as any)[key] = value;
                                    await this.saveSettings();
                                }, view.file).open();
                            });
                    });
                }
                // 7. Parse and Move
                if (this.settings.contextMenuParseAndMove) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Parse and Move')
                            .setIcon('folder-input')
                            .onClick(async () => {
                                new ParseAndMoveModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 8. Distill
                if (this.settings.contextMenuDistill) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Distill')
                            .setIcon('flask-conical')
                            .onClick(async () => {
                                new DistillModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 9. Rating

            })
        );

        // Context Menu: File Explorer
        this.registerEvent(
            this.app.workspace.on('file-menu', (menu, file) => {
                // 1. Date Fix
                if (this.settings.contextMenuDateFix) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Date Fix')
                            .setIcon('calendar')
                            .onClick(async () => {
                                if (file instanceof TFile || file instanceof TFolder) {
                                    new DateFixModal(this.app, this.settings, file).open();
                                }
                            });
                    });
                }
                // 2. Merge
                if (this.settings.contextMenuMerge) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Merge')
                            .setIcon('merge')
                            .onClick(async () => {
                                if (file instanceof TFile || file instanceof TFolder) {
                                    new MergeModal(this.app, this.settings, file).open();
                                }
                            });
                    });
                }

                // 3. Atomize
                if (this.settings.contextMenuAtomize) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Atomize')
                            .setIcon('scissors')
                            .onClick(async () => {
                                if (file instanceof TFile || file instanceof TFolder) {
                                    new AtomizerModal(this.app, this.settings, file).open();
                                }
                            });
                    });
                }
                // 4. YAML Template
                if (this.settings.contextMenuYamlTemplate) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Apply YAML Template')
                            .setIcon('layout-template')
                            .onClick(async () => {
                                if (file instanceof TFile || file instanceof TFolder) {
                                    new YamlTemplateModal(this.app, this.settings, file).open();
                                }
                            });
                    });
                }

                if (file instanceof TFile || file instanceof TFolder) {
                    // 5. Summarize
                    if (this.settings.contextMenuSummarize) {
                        menu.addItem((item) => {
                            item.setTitle('Coherence: Summarize')
                                .setIcon('lines-of-text')
                                .onClick(async () => {
                                    new SummarizerModal(this.app, this.settings, async (key, value) => {
                                        (this.settings as any)[key] = value;
                                        await this.saveSettings();
                                    }, file).open();
                                });
                        });
                    }
                    // 6. Categorize
                    if (this.settings.contextMenuCategorize) {
                        menu.addItem((item) => {
                            item.setTitle('Coherence: Categorize')
                                .setIcon('folder')
                                .onClick(async () => {
                                    new CategorizeHubModal(this.app, this.settings, async (key, value) => {
                                        (this.settings as any)[key] = value;
                                        await this.saveSettings();
                                    }, file).open();
                                });
                        });
                    }
                    // 7. Parse and Move
                    if (this.settings.contextMenuParseAndMove) {
                        menu.addItem((item) => {
                            item.setTitle('Coherence: Parse and Move')
                                .setIcon('folder-input')
                                .onClick(async () => {
                                    new ParseAndMoveModal(this.app, this.settings, file).open();
                                });
                        });
                    }
                    // 8. Distill
                    if (this.settings.contextMenuDistill) {
                        menu.addItem((item) => {
                            item.setTitle('Coherence: Distill')
                                .setIcon('flask-conical')
                                .onClick(async () => {
                                    new DistillModal(this.app, this.settings, file).open();
                                });
                        });
                    }
                    // 9. Rating

                }
            })
        );

        this.addSettingTab(new CoherenceSettingTab(this.app, this));
    }

    onunload() {

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

class CoherenceSettingTab extends PluginSettingTab {
    plugin: CoherencePlugin;
    activeTab = 'about';
    ollamaModels: string[] = [];

    constructor(app: App, plugin: CoherencePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async fetchModels() {
        try {
            const ollama = new OllamaService(this.plugin.settings.ollamaUrl);
            this.ollamaModels = await ollama.listModels();
            if (this.ollamaModels.length === 0) {
                this.ollamaModels = ['llama3', 'mistral', 'gemma']; // Fallback
            }
        } catch (e) {
            console.error('Failed to fetch models', e);
            this.ollamaModels = ['llama3', 'mistral', 'gemma']; // Fallback
        }
    }

    async display(): Promise<void> {
        console.log('Coherence Settings: Displaying tab', this.activeTab);
        await this.fetchModels();
        const { containerEl } = this;

        containerEl.empty();

        containerEl.createEl('h1', { text: 'Coherence Wizard Settings' });

        // Create Tab Navigation
        const navContainer = containerEl.createDiv({ cls: 'settings-nav-container' });
        navContainer.style.display = 'flex';
        navContainer.style.flexWrap = 'wrap';
        navContainer.style.marginBottom = '20px';
        navContainer.style.gap = '10px';

        const tabs = [
            { id: 'about', name: 'About' },
            { id: 'contextmenu', name: 'Context Menu' },
            { id: 'datefix', name: 'Date Fix' },
            { id: 'merge', name: 'Merge' },
            { id: 'atomizer', name: 'Atomization' },
            { id: 'yaml', name: 'YAML Template' },
            { id: 'summarizer', name: 'Summarize' },
            { id: 'categorizer', name: 'Categorize' },
            { id: 'parsemove', name: 'Parse & Move' },
            { id: 'parsemove', name: 'Parse & Move' },
            { id: 'distill', name: 'Distill' },
            { id: 'rating', name: 'Rating' },
            { id: 'wizard', name: 'Coherence Wizard' }
        ];

        tabs.forEach(tab => {
            const btn = navContainer.createEl('button', { text: tab.name });
            if (this.activeTab === tab.id) {
                btn.addClass('mod-cta');
            }
            btn.onclick = () => {
                this.activeTab = tab.id;
                this.display();
            };
        });

        // Render Content based on Active Tab
        try {
            if (this.activeTab === 'about') {
                this.renderAboutSettings(containerEl);
            } else if (this.activeTab === 'wizard') {
                this.renderWizardSettings(containerEl);
            } else if (this.activeTab === 'rating') {
                this.renderRatingSettings(containerEl);
            } else if (this.activeTab === 'contextmenu') {
                // Inline renderContextMenuSettings
                console.log('Rendering Context Menu Settings (Inlined)');
                containerEl.createEl('h2', { text: 'Context Menu Settings' });
                containerEl.createEl('p', { text: 'Select which features should appear in the right-click context menu.' });

                new Setting(containerEl)
                    .setName('Date Fix')
                    .setDesc('Available in: File, Folder')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.contextMenuDateFix)
                        .onChange(async (value) => {
                            this.plugin.settings.contextMenuDateFix = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Merge')
                    .setDesc('Available in: File, Folder')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.contextMenuMerge)
                        .onChange(async (value) => {
                            this.plugin.settings.contextMenuMerge = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Atomize')
                    .setDesc('Available in: File, Folder')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.contextMenuAtomize)
                        .onChange(async (value) => {
                            this.plugin.settings.contextMenuAtomize = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('YAML Template')
                    .setDesc('Available in: File, Folder')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.contextMenuYamlTemplate)
                        .onChange(async (value) => {
                            this.plugin.settings.contextMenuYamlTemplate = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Summarize')
                    .setDesc('Available in: File')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.contextMenuSummarize)
                        .onChange(async (value) => {
                            this.plugin.settings.contextMenuSummarize = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Categorize')
                    .setDesc('Available in: File')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.contextMenuCategorize)
                        .onChange(async (value) => {
                            this.plugin.settings.contextMenuCategorize = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Parse and Move')
                    .setDesc('Available in: File')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.contextMenuParseAndMove)
                        .onChange(async (value) => {
                            this.plugin.settings.contextMenuParseAndMove = value;
                            await this.plugin.saveSettings();
                        }));

                new Setting(containerEl)
                    .setName('Distill')
                    .setDesc('Available in: File')
                    .addToggle(toggle => toggle
                        .setValue(this.plugin.settings.contextMenuDistill)
                        .onChange(async (value) => {
                            this.plugin.settings.contextMenuDistill = value;
                            await this.plugin.saveSettings();
                        }));
            } else if (this.activeTab === 'datefix') {
                this.renderDateFixSettings(containerEl);
            } else if (this.activeTab === 'merge') {
                this.renderMergeSettings(containerEl);
            } else if (this.activeTab === 'atomizer') {
                this.renderAtomizerSettings(containerEl);
            } else if (this.activeTab === 'yaml') {
                this.renderYamlSettings(containerEl);
            } else if (this.activeTab === 'summarizer') {
                this.renderSummarizerSettings(containerEl);
            } else if (this.activeTab === 'categorizer') {
                this.renderCategorizerSettings(containerEl);
            } else if (this.activeTab === 'parsemove') {
                this.renderParseAndMoveSettings(containerEl);
            } else if (this.activeTab === 'distill') {
                this.renderDistillSettings(containerEl);
            }
        } catch (e) {
            console.error('Error rendering settings tab:', e);
            containerEl.createEl('p', { text: 'Error rendering settings. Please check console.' });
        }
    }

    renderAboutSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'About Coherence Wizard' });
        containerEl.createEl('p', { text: 'Version: 0.0.22', cls: 'version-text' });

        containerEl.createEl('p', { text: 'The intention is to streamline coherence by using tools to convert chaos into order.' });
        containerEl.createEl('p', { text: 'The included tools have significantly enhanced my PKM workflows and I want to help others passionate about self-development using Obsidian.' });

        containerEl.createEl('p', { text: 'Many of these tools rely on private local AI via Ollama. (Future iterations of this plugin will allow for the use of large cloud AI via API). This is a privacy first plugin.' });

        const warning = containerEl.createEl('p');
        warning.createEl('strong', { text: 'Many people without GPUs or large CPUs will struggle to use local models large enough to generate quality output. Without GPU, local AI models will be slow and potentially laggy. So use this beta plugin at your own risk. I recommend testing on a test vault or a test folder to see how all the tools work.' });

        containerEl.createEl('p', { text: 'You will need to install Ollama on your computer and pull your favorite local AI models. I recommend gemma3:12b-it-qat if your computer can handle it. Otherwise gemma3:4b-it-qat for constrained resources.' });

        const bmcContainer = containerEl.createDiv();
        bmcContainer.style.marginTop = '20px';
        bmcContainer.style.marginBottom = '20px';

        const bmcLink = bmcContainer.createEl('a', { href: 'https://www.buymeacoffee.com/rastovich' });
        const bmcImg = bmcLink.createEl('img', {
            attr: {
                src: 'https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=rastovich&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff',
                alt: 'Buy me a coffee'
            }
        });
        bmcImg.style.height = '40px';

        containerEl.createEl('h3', { text: 'Configuration' });

        new Setting(containerEl)
            .setName('Ollama URL')
            .setDesc('URL of your local Ollama instance')
            .addText(text => text
                .setPlaceholder('http://localhost:11434')
                .setValue(this.plugin.settings.ollamaUrl)
                .onChange(async (value) => {
                    this.plugin.settings.ollamaUrl = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('p', { text: 'Next go through each of the settings tabs to review settings.' });

        containerEl.createEl('p', { text: 'Settings which particularly need your attention are the ones for YAML Template, Categorize and Distill.' });
        containerEl.createEl('p', { text: 'These require dictionaries you need to create that match your workflow.' });

        containerEl.createEl('p', { text: 'What YAML keys do you want to include? What order are these keys?' });

        containerEl.createEl('p', { text: 'How do you want to categorize your notes? What topics do you cover? Beware that the more categories you include in your dictionary, the less accurate category selection will be. Perhaps start with something like:' });
        const catList = containerEl.createEl('ul');
        catList.createEl('li', { text: 'Work' });
        catList.createEl('li', { text: 'Personal' });

        containerEl.createEl('p', { text: 'There are several tools under "Distill" which prepare your notes for expression with a general audience. This also includes a way to convert names and places to aliases. You need to create a dictionary that includes the names and places you want to obscure (along with their mispellings and abbreviations) along with the replacement word. For example:' });
        const aliasList = containerEl.createEl('ul');
        aliasList.createEl('li', { text: 'John, Jon, Joan, Johnathon, Johnny = Bob' });

        containerEl.createEl('p', { text: 'Each settings tab will explain what each function does.' });

        containerEl.createEl('h3', { text: 'Support' });
        containerEl.createEl('p', { text: 'If this app benefits you and want to encourage me to develop these and other tools. Please consider "Buying Me A Coffee" which would go a long way in encouraging me!' });
        containerEl.createEl('p', { text: 'If this tool saves you just one hour of time per month, please consider donating or subscribing!' });
    }

    renderContextMenuSettings(containerEl: HTMLElement) {
        console.log('Rendering Context Menu Settings');
        containerEl.createEl('h2', { text: 'Context Menu Settings' });
        containerEl.createEl('p', { text: 'Select which features should appear in the right-click context menu.' });

        new Setting(containerEl)
            .setName('Date Fix')
            .setDesc('Available in: File, Folder')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenuDateFix)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenuDateFix = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Merge')
            .setDesc('Available in: File, Folder')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenuMerge)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenuMerge = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Atomize')
            .setDesc('Available in: File, Folder')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenuAtomize)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenuAtomize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('YAML Template')
            .setDesc('Available in: File, Folder')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenuYamlTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenuYamlTemplate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Summarize')
            .setDesc('Available in: File')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenuSummarize)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenuSummarize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Categorize')
            .setDesc('Available in: File')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenuCategorize)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenuCategorize = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Parse and Move')
            .setDesc('Available in: File')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenuParseAndMove)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenuParseAndMove = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Distill')
            .setDesc('Available in: File')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenuDistill)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenuDistill = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Rating')
            .setDesc('Available in: File, Folder')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.contextMenuRating)
                .onChange(async (value) => {
                    this.plugin.settings.contextMenuRating = value;
                    await this.plugin.saveSettings();
                }));
    }

    renderAtomizerSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'Atomizer Settings' });

        const desc = containerEl.createDiv({ cls: 'setting-item-description' });
        desc.style.marginBottom = '20px';
        desc.innerHTML = `
            <p><strong>Atomization Modes:</strong></p>
            <ul>
                <li><strong>By Heading:</strong> Splits the file based on markdown headings (H1, H2, etc.). Each section becomes a new file.</li>
                <li><strong>By ISO Date:</strong> Splits the file based on ISO 8601 date patterns found in the text (e.g. YYYY-MM-DD). Useful for splitting daily logs.</li>
                <li><strong>By Divider:</strong> Splits the file using a custom divider string (e.g. '---').</li>
            </ul>
        `;

        new Setting(containerEl)
            .setName('Default Divider')
            .setDesc('The default divider string for "By Divider" mode')
            .addText(text => text
                .setPlaceholder('---')
                .setValue(this.plugin.settings.atomizerDivider)
                .onChange(async (value) => {
                    this.plugin.settings.atomizerDivider = value;
                    await this.plugin.saveSettings();
                }));
    }

    renderSummarizerSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'Summarizer Settings' });
        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Ollama model to use for summarization')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.summarizerModel)) {
                    drop.addOption(this.plugin.settings.summarizerModel, this.plugin.settings.summarizerModel);
                }
                drop.setValue(this.plugin.settings.summarizerModel)
                    .onChange(async (value) => {
                        this.plugin.settings.summarizerModel = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Recursive Processing')
            .setDesc('Process subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.summarizerRecursive)
                .onChange(async (value) => {
                    this.plugin.settings.summarizerRecursive = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Overwrite Existing')
            .setDesc('Overwrite existing summaries by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.summarizerOverwrite)
                .onChange(async (value) => {
                    this.plugin.settings.summarizerOverwrite = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Include YAML')
            .setDesc('Include YAML frontmatter in the input sent to the model')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.summarizerIncludeYaml)
                .onChange(async (value) => {
                    this.plugin.settings.summarizerIncludeYaml = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max Characters')
            .setDesc('Maximum characters to process per file')
            .addText(text => text
                .setValue(String(this.plugin.settings.summarizerMaxChars))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num)) {
                        this.plugin.settings.summarizerMaxChars = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Auto-Generate Title')
            .setDesc('Append AI-generated title to filename (useful for Untitled or Daily Notes)')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.summarizerGenerateTitle)
                .onChange(async (value) => {
                    this.plugin.settings.summarizerGenerateTitle = value;
                    await this.plugin.saveSettings();
                }));

        containerEl.createEl('h3', { text: 'Progressive Sequential Summarization Prompts' });

        new Setting(containerEl)
            .setName('Prompt 1 (General Summary)')
            .setDesc('Initial comprehensive summary. Placeholders: {filename}, {text}')
            .addTextArea(text => text
                .setValue(this.plugin.settings.summarizerPrompt)
                .setPlaceholder('Enter prompt...')
                .then(t => t.inputEl.rows = 6)
                .onChange(async (value) => {
                    this.plugin.settings.summarizerPrompt = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Prompt 2 (Concise Summary)')
            .setDesc('Condense the summary. Placeholders: {filename}, {summary}')
            .addTextArea(text => text
                .setValue(this.plugin.settings.summarizerPrompt2)
                .setPlaceholder('Enter prompt...')
                .then(t => t.inputEl.rows = 6)
                .onChange(async (value) => {
                    this.plugin.settings.summarizerPrompt2 = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Prompt 3 (De-fluff)')
            .setDesc('Remove filler. Placeholders: {summary}')
            .addTextArea(text => text
                .setValue(this.plugin.settings.summarizerPrompt3)
                .setPlaceholder('Enter prompt...')
                .then(t => t.inputEl.rows = 6)
                .onChange(async (value) => {
                    this.plugin.settings.summarizerPrompt3 = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Prompt 4 (Capitalize)')
            .setDesc('Capitalize important words. Placeholders: {summary}')
            .addTextArea(text => text
                .setValue(this.plugin.settings.summarizerPrompt4)
                .setPlaceholder('Enter prompt...')
                .then(t => t.inputEl.rows = 6)
                .onChange(async (value) => {
                    this.plugin.settings.summarizerPrompt4 = value;
                    await this.plugin.saveSettings();
                }));
    }

    renderYamlSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'YAML Template Settings' });

        const desc = containerEl.createDiv({ cls: 'setting-item-description' });
        desc.style.marginBottom = '20px';
        desc.innerHTML = `
            <p><strong>Note:</strong></p>
            <ul>
                <li>Any YAML keys that are not in the template will be preserved and added after the main template keys.</li>
                <li>Existing values for keys in the template will be preserved but reordered.</li>
            </ul>
        `;

        new Setting(containerEl)
            .setName('Default Template')
            .setDesc('Default fields for YAML template (one per line)')
            .addTextArea(text => {
                text.inputEl.rows = 10;
                text.inputEl.style.width = '100%';
                text.setValue(this.plugin.settings.yamlTemplate)
                    .onChange(async (value) => {
                        this.plugin.settings.yamlTemplate = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Add Date From Filename')
            .setDesc('If filename starts with YYYY-MM-DD, add it to "date" field')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.yamlAddDate)
                .onChange(async (value) => {
                    this.plugin.settings.yamlAddDate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders when running on a folder')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.yamlRecursive)
                .onChange(async (value) => {
                    this.plugin.settings.yamlRecursive = value;
                    await this.plugin.saveSettings();
                }));
    }

    renderCategorizerSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'Categorizer Settings' });
        new Setting(containerEl)
            .setName('Categorizer Model')
            .setDesc('The Ollama model to use for categorization')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.categorizerModel)) {
                    drop.addOption(this.plugin.settings.categorizerModel, this.plugin.settings.categorizerModel);
                }
                drop.setValue(this.plugin.settings.categorizerModel)
                    .onChange(async (value) => {
                        this.plugin.settings.categorizerModel = value;
                        await this.plugin.saveSettings();
                    });
            });

        containerEl.createEl('h3', { text: 'Dictionaries' });

        const dictDesc = containerEl.createDiv({ cls: 'setting-item-description' });
        dictDesc.style.marginBottom = '10px';
        dictDesc.innerHTML = `
            <p><strong>Dictionary Syntax:</strong></p>
            <p>Each line represents a category. You can optionally provide a description after a semicolon.</p>
            <pre>Category Name; Description of the category</pre>
            <p>Example:</p>
            <pre>Personal; Notes related to personal life
Work; Job related tasks and projects</pre>
        `;

        // Dictionary Selector & Management
        const dictSetting = new Setting(containerEl)
            .setName('Active Dictionary')
            .setDesc('Select, rename, or delete dictionaries')
            .addDropdown(drop => {
                this.plugin.settings.categorizerDictionaries.forEach(d => drop.addOption(d.name, d.name));
                drop.setValue(this.plugin.settings.categorizerActiveDictionary)
                    .onChange(async (value) => {
                        this.plugin.settings.categorizerActiveDictionary = value;
                        await this.plugin.saveSettings();
                        this.display(); // Refresh to show content of selected dictionary
                    });
            })
            .addExtraButton(btn => btn
                .setIcon('plus')
                .setTooltip('Add New Dictionary')
                .onClick(async () => {
                    let name = 'New Dictionary';
                    let i = 1;
                    while (this.plugin.settings.categorizerDictionaries.some(d => d.name === name)) {
                        name = `New Dictionary ${i++}`;
                    }
                    this.plugin.settings.categorizerDictionaries.push({ name, content: '' });
                    this.plugin.settings.categorizerActiveDictionary = name;
                    await this.plugin.saveSettings();
                    this.display();
                }))
            .addExtraButton(btn => btn
                .setIcon('trash')
                .setTooltip('Delete Dictionary')
                .onClick(async () => {
                    if (this.plugin.settings.categorizerDictionaries.length <= 1) {
                        new Notice('Cannot delete the last dictionary.');
                        return;
                    }
                    this.plugin.settings.categorizerDictionaries = this.plugin.settings.categorizerDictionaries.filter(d => d.name !== this.plugin.settings.categorizerActiveDictionary);
                    this.plugin.settings.categorizerActiveDictionary = this.plugin.settings.categorizerDictionaries[0].name;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        // Rename Dictionary
        const activeDict = this.plugin.settings.categorizerDictionaries.find(d => d.name === this.plugin.settings.categorizerActiveDictionary);
        if (activeDict) {
            new Setting(containerEl)
                .setName('Rename Dictionary')
                .addText(text => text
                    .setValue(activeDict.name)
                    .onChange(async (value) => {
                        if (value && value !== activeDict.name) {
                            // Check for duplicates
                            if (this.plugin.settings.categorizerDictionaries.some(d => d.name === value)) {
                                new Notice('Dictionary name already exists.');
                                return;
                            }
                            activeDict.name = value;
                            this.plugin.settings.categorizerActiveDictionary = value;
                            await this.plugin.saveSettings();
                        }
                    }))
                .addExtraButton(btn => btn
                    .setIcon('check')
                    .setTooltip('Apply Rename (Refresh)')
                    .onClick(() => this.display()));

            new Setting(containerEl)
                .setName('Dictionary Content')
                .setDesc('Edit the categories for the selected dictionary')
                .addTextArea(text => {
                    text.inputEl.rows = 15;
                    text.inputEl.style.width = '100%';
                    text.setValue(activeDict.content)
                        .onChange(async (value) => {
                            activeDict.content = value;
                            await this.plugin.saveSettings();
                        });
                });
        }

        // Default Options
        containerEl.createEl('h3', { text: 'Default Options' });

        new Setting(containerEl)
            .setName('Apply as Tag')
            .setDesc('Add category as #tag in YAML')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.categorizerApplyAsTag)
                .onChange(async (value) => {
                    this.plugin.settings.categorizerApplyAsTag = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Apply as Backlink')
            .setDesc('Append category as [[backlink]] at end of file')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.categorizerApplyAsBacklink)
                .onChange(async (value) => {
                    this.plugin.settings.categorizerApplyAsBacklink = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Move to Folder')
            .setDesc('Move file to a subfolder named after the category')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.categorizerMoveToFolder)
                .onChange(async (value) => {
                    this.plugin.settings.categorizerMoveToFolder = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Max Categories')
            .setDesc('Maximum number of categories to apply (default 1)')
            .addText(text => text
                .setValue(String(this.plugin.settings.categorizerMaxCategories))
                .onChange(async (value) => {
                    const num = parseInt(value);
                    if (!isNaN(num) && num > 0) {
                        this.plugin.settings.categorizerMaxCategories = num;
                        await this.plugin.saveSettings();
                    }
                }));

        containerEl.createEl('h2', { text: 'Automatic Rating Settings' });
        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Ollama model to use for rating')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.ratingModel)) {
                    drop.addOption(this.plugin.settings.ratingModel, this.plugin.settings.ratingModel);
                }
                drop.setValue(this.plugin.settings.ratingModel)
                    .onChange(async (value) => {
                        this.plugin.settings.ratingModel = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Quality Parameters')
            .setDesc('Comma separated list of quality parameters')
            .addText(text => text
                .setValue(this.plugin.settings.ratingParams)
                .onChange(async (value) => {
                    this.plugin.settings.ratingParams = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Skip Existing')
            .setDesc('Skip files that already have a rating in YAML')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ratingSkipIfRated)
                .onChange(async (value) => {
                    this.plugin.settings.ratingSkipIfRated = value;
                    await this.plugin.saveSettings();
                }));
    }

    renderWizardSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'Coherence Wizard Settings' });
        containerEl.createEl('p', { text: 'Configure the folders used by the One Click Coherence Wizard.' });

        new Setting(containerEl)
            .setName('Inbox Folder')
            .setDesc('Folder containing new notes to process')
            .addText(text => text
                .setValue(this.plugin.settings.wizardInboxDir)
                .onChange(async (value) => {
                    this.plugin.settings.wizardInboxDir = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Chrono Folder')
            .setDesc('Folder for chronological storage (archive)')
            .addText(text => text
                .setValue(this.plugin.settings.wizardChronoDir)
                .onChange(async (value) => {
                    this.plugin.settings.wizardChronoDir = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Living Folder')
            .setDesc('Folder for living documents (categorized)')
            .addText(text => text
                .setValue(this.plugin.settings.wizardLivingDir)
                .onChange(async (value) => {
                    this.plugin.settings.wizardLivingDir = value;
                    await this.plugin.saveSettings();
                }));
    }

    renderDateFixSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'Date Fix Settings' });
        containerEl.createEl('p', { text: 'This tool standardizes filenames by ensuring they start with a date in the preferred format. It automatically detects and converts existing dates or date-like number strings (e.g. 20220221) found in the filename.', cls: 'setting-item-description' });

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dateFixRecursive)
                .onChange(async (value) => {
                    this.plugin.settings.dateFixRecursive = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Fallback to Creation Date')
            .setDesc('If no date is found in the filename, prepend the file\'s creation date.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dateFixFallbackToCreationDate)
                .onChange(async (value) => {
                    this.plugin.settings.dateFixFallbackToCreationDate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Preferred Date Format')
            .setDesc('ISO format to use (e.g. YYYY-MM-DD)')
            .addText(text => text
                .setValue(this.plugin.settings.dateFixDateFormat)
                .onChange(async (value) => {
                    this.plugin.settings.dateFixDateFormat = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Exceptions')
            .setDesc('Comma separated list of file extensions (e.g. *.py) or words to exclude')
            .addTextArea(text => text
                .setValue(this.plugin.settings.dateFixExceptions)
                .onChange(async (value) => {
                    this.plugin.settings.dateFixExceptions = value;
                    await this.plugin.saveSettings();
                }));
    }

    renderParseAndMoveSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'Parse and Move Settings' });
        new Setting(containerEl)
            .setName('Target Directory')
            .setDesc('Directory to move parsed files to')
            .addText(text => text
                .setValue(this.plugin.settings.parseAndMoveTargetDir)
                .onChange(async (value) => {
                    this.plugin.settings.parseAndMoveTargetDir = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.parseAndMoveRecursive)
                .onChange(async (value) => {
                    this.plugin.settings.parseAndMoveRecursive = value;
                    await this.plugin.saveSettings();
                }));
    }

    renderDistillSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'Distill Settings' });

        // Censor / Alias Settings
        containerEl.createEl('h3', { text: 'Censor / Alias' });

        const dictDesc = containerEl.createDiv({ cls: 'setting-item-description' });
        dictDesc.style.marginBottom = '10px';
        dictDesc.innerHTML = `
            <p><strong>Dictionary Syntax:</strong></p>
            <p>Each line represents a word/phrase to censor.</p>
        `;

        new Setting(containerEl)
            .setName('Active Dictionary')
            .setDesc('Select dictionary for censorship')
            .addDropdown(drop => {
                this.plugin.settings.censorDictionaries.forEach(d => drop.addOption(d.name, d.name));
                drop.setValue(this.plugin.settings.censorActiveDictionary)
                    .onChange(async (value) => {
                        this.plugin.settings.censorActiveDictionary = value;
                        await this.plugin.saveSettings();
                        this.display();
                    });
            })
            .addExtraButton(btn => btn
                .setIcon('plus')
                .setTooltip('Add New Dictionary')
                .onClick(async () => {
                    let name = 'New Dictionary';
                    let i = 1;
                    while (this.plugin.settings.censorDictionaries.some(d => d.name === name)) {
                        name = `New Dictionary ${i++}`;
                    }
                    this.plugin.settings.censorDictionaries.push({ name, content: '' });
                    this.plugin.settings.censorActiveDictionary = name;
                    await this.plugin.saveSettings();
                    this.display();
                }))
            .addExtraButton(btn => btn
                .setIcon('trash')
                .setTooltip('Delete Dictionary')
                .onClick(async () => {
                    if (this.plugin.settings.censorDictionaries.length <= 1) {
                        new Notice('Cannot delete the last dictionary.');
                        return;
                    }
                    this.plugin.settings.censorDictionaries = this.plugin.settings.censorDictionaries.filter(d => d.name !== this.plugin.settings.censorActiveDictionary);
                    this.plugin.settings.censorActiveDictionary = this.plugin.settings.censorDictionaries[0].name;
                    await this.plugin.saveSettings();
                    this.display();
                }));

        const activeDict = this.plugin.settings.censorDictionaries.find(d => d.name === this.plugin.settings.censorActiveDictionary);
        if (activeDict) {
            new Setting(containerEl)
                .setName('Rename Dictionary')
                .addText(text => text
                    .setValue(activeDict.name)
                    .onChange(async (value) => {
                        if (value && value !== activeDict.name) {
                            if (this.plugin.settings.censorDictionaries.some(d => d.name === value)) {
                                new Notice('Dictionary name already exists.');
                                return;
                            }
                            activeDict.name = value;
                            this.plugin.settings.censorActiveDictionary = value;
                            await this.plugin.saveSettings();
                        }
                    }))
                .addExtraButton(btn => btn
                    .setIcon('check')
                    .setTooltip('Apply Rename (Refresh)')
                    .onClick(() => this.display()));

            new Setting(containerEl)
                .setName('Dictionary Content')
                .setDesc('Edit the censored words (one per line)')
                .addTextArea(text => {
                    text.inputEl.rows = 10;
                    text.inputEl.style.width = '100%';
                    text.setValue(activeDict.content)
                        .onChange(async (value) => {
                            activeDict.content = value;
                            await this.plugin.saveSettings();
                        });
                });
        }

        new Setting(containerEl)
            .setName('Replacement Character')
            .setDesc('Character to replace censored words with')
            .addText(text => text
                .setValue(this.plugin.settings.censorReplacementChar)
                .onChange(async (value) => {
                    this.plugin.settings.censorReplacementChar = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.censorRecursive)
                .onChange(async (value) => {
                    this.plugin.settings.censorRecursive = value;
                    await this.plugin.saveSettings();
                }));

        // Generalizer Settings
        containerEl.createEl('h3', { text: 'Generalize' });
        new Setting(containerEl)
            .setName('Model')
            .setDesc('Ollama model to use')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.generalizerModel)) {
                    drop.addOption(this.plugin.settings.generalizerModel, this.plugin.settings.generalizerModel);
                }
                drop.setValue(this.plugin.settings.generalizerModel)
                    .onChange(async (value) => {
                        this.plugin.settings.generalizerModel = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('System Prompt')
            .setDesc('System prompt for the model')
            .addTextArea(text => text
                .setValue(this.plugin.settings.generalizerSystemPrompt)
                .onChange(async (value) => {
                    this.plugin.settings.generalizerSystemPrompt = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Prompt')
            .setDesc('Prompt template. Use {text} as placeholder.')
            .addTextArea(text => text
                .setValue(this.plugin.settings.generalizerPrompt)
                .onChange(async (value) => {
                    this.plugin.settings.generalizerPrompt = value;
                    await this.plugin.saveSettings();
                }));

        // Wisdom Settings
        containerEl.createEl('h3', { text: 'Wisdom Extractor' });
        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Ollama model to use for wisdom extraction')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.wisdomModel)) {
                    drop.addOption(this.plugin.settings.wisdomModel, this.plugin.settings.wisdomModel);
                }
                drop.setValue(this.plugin.settings.wisdomModel)
                    .onChange(async (value) => {
                        this.plugin.settings.wisdomModel = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Default Mode')
            .setDesc('Default processing mode')
            .addDropdown(drop => drop
                .addOption('generalized', 'Generalized (AI)')
                .addOption('safe', 'Safe (Copy Only)')
                .setValue(this.plugin.settings.wisdomMode)
                .onChange(async (value) => {
                    this.plugin.settings.wisdomMode = value as any;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Wisdom Prompt')
            .setDesc('The prompt template used for wisdom extraction')
            .addTextArea(text => text
                .setValue(this.plugin.settings.wisdomPrompt)
                .onChange(async (value) => {
                    this.plugin.settings.wisdomPrompt = value;
                    await this.plugin.saveSettings();
                }));
    }

    renderMergeSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'Merge Settings' });

        // Chrono Merge Settings
        containerEl.createEl('h3', { text: 'Chrono Merge' });
        new Setting(containerEl)
            .setName('Time Threshold (Minutes)')
            .setDesc('Files created within this time window will be merged')
            .addText(text => text
                .setValue(String(this.plugin.settings.chronoMergeTimeThreshold))
                .onChange(async (value) => {
                    const num = parseFloat(value);
                    if (!isNaN(num)) {
                        this.plugin.settings.chronoMergeTimeThreshold = num;
                        await this.plugin.saveSettings();
                    }
                }));

        new Setting(containerEl)
            .setName('Use File Creation Time')
            .setDesc('If enabled, uses the file\'s creation date property instead of the date in the filename.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.chronoMergeUseCreationTime)
                .onChange(async (value) => {
                    this.plugin.settings.chronoMergeUseCreationTime = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.chronoMergeRecursive)
                .onChange(async (value) => {
                    this.plugin.settings.chronoMergeRecursive = value;
                    await this.plugin.saveSettings();
                }));

        // Concatonizer Settings
        containerEl.createEl('h3', { text: 'Concatonizer' });
        new Setting(containerEl)
            .setName('Filename Suffix')
            .setDesc('Suffix to append to the folder name for the combined file (default: _combined)')
            .addText(text => text
                .setValue(this.plugin.settings.concatonizerSuffix)
                .onChange(async (value) => {
                    this.plugin.settings.concatonizerSuffix = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Include subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.concatonizerRecursive)
                .onChange(async (value) => {
                    this.plugin.settings.concatonizerRecursive = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Strip YAML')
            .setDesc('Remove YAML frontmatter from combined files')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.concatonizerStripYaml)
                .onChange(async (value) => {
                    this.plugin.settings.concatonizerStripYaml = value;
                    await this.plugin.saveSettings();
                }));

        // Deduplication Settings
        containerEl.createEl('h3', { text: 'Deduplication' });
        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.deduplicationRecursive)
                .onChange(async (value) => {
                    this.plugin.settings.deduplicationRecursive = value;
                    await this.plugin.saveSettings();
                }));
    }
    renderRatingSettings(containerEl: HTMLElement) {
        containerEl.createEl('h2', { text: 'Automatic Rating Settings' });
        new Setting(containerEl)
            .setName('Default Model')
            .setDesc('Ollama model to use for rating')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.ratingModel)) {
                    drop.addOption(this.plugin.settings.ratingModel, this.plugin.settings.ratingModel);
                }
                drop.setValue(this.plugin.settings.ratingModel)
                    .onChange(async (value) => {
                        this.plugin.settings.ratingModel = value;
                        await this.plugin.saveSettings();
                    });
            });

        new Setting(containerEl)
            .setName('Quality Parameters')
            .setDesc('Comma separated list of parameters to rate (e.g. coherence, profundity)')
            .addText(text => text
                .setValue(this.plugin.settings.ratingParams)
                .onChange(async (value) => {
                    this.plugin.settings.ratingParams = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Skip Rated')
            .setDesc('Skip files that already have a rating in frontmatter')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ratingSkipIfRated)
                .onChange(async (value) => {
                    this.plugin.settings.ratingSkipIfRated = value;
                    await this.plugin.saveSettings();
                }));
    }
}
