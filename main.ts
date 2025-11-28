import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { AtomizerModal } from './src/ui/atomizer-modal';
import { SummarizerModal } from './src/ui/summarizer-modal';
import { WisdomModal } from './src/ui/wisdom-modal';
import { DateFixModal } from './src/ui/date-fix-modal';
import { ConcatonizerModal } from './src/ui/concatonizer-modal';
import { RatingModal } from './src/ui/rating-modal';

import { DeduplicationModal } from './src/ui/deduplication-modal';
import { ParseAndMoveModal } from './src/ui/parse-and-move-modal';
import { CensorModal } from './src/ui/censor-modal';

import { MergeModal } from './src/ui/merge-modal';
import { CategorizeHubModal } from './src/ui/categorize-hub-modal';
import { DistillModal } from './src/ui/distill-modal';
import { ChronoMergeModal } from './src/ui/chrono-merge-modal';
import { WizardView, VIEW_TYPE_WIZARD } from './src/ui/wizard-view';
import { YamlTemplateModal } from './src/ui/yaml-template-modal';
import { OllamaService } from './src/modules/ollama';


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
    summarizerPrompt1Enabled: boolean;
    summarizerPrompt2Enabled: boolean;
    summarizerPrompt3Enabled: boolean;
    summarizerPrompt4Enabled: boolean;
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
    wisdomMode: 'generalized' | 'safe';
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
    summarizerPrompt1Enabled: true,
    summarizerPrompt2Enabled: true,
    summarizerPrompt3Enabled: true,
    summarizerPrompt4Enabled: true,
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
    wisdomMode: 'generalized',
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

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (workspace as any).revealLeaf(leaf);
    }

    async onload() {
        await this.loadSettings();

        this.registerView(
            VIEW_TYPE_WIZARD,
            (leaf) => new WizardView(leaf, this.app, this.settings)
        );

        // Add Ribbon Icon
        this.addRibbonIcon('wand-2', 'Coherence Wizard', () => {
            void (async () => {
                await this.activateWizardView();
            })();
        });

        this.addSettingTab(new CoherenceSettingTab(this.app, this));

        // Add Status Bar Item
        const statusBarItemEl = this.addStatusBarItem();
        statusBarItemEl.setText('Coherence Wizard Active');

        // Atomizer Command
        this.addCommand({
            id: 'open-atomizer-modal',
            name: 'Open atomizer',
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
            name: 'Open summarizer',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new SummarizerModal(this.app, this.settings, async (key, value) => {
                        (this.settings as unknown as Record<string, unknown>)[key] = value;
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
            name: 'Open wisdom extractor',
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
            name: 'Open date fix',
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
            name: 'Open concatonizer',
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
            name: 'Open rating',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new RatingModal(this.app, this.settings, async (key, value) => {
                        (this.settings as unknown as Record<string, unknown>)[key] = value;
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
            name: 'Open categorizer',
            callback: () => {
                const file = this.app.workspace.getActiveFile();
                if (file) {
                    new CategorizeHubModal(this.app, this.settings, async (key, value) => {
                        (this.settings as unknown as Record<string, unknown>)[key] = value;
                        await this.saveSettings();
                    }, file).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Deduplication Command
        this.addCommand({
            id: 'open-deduplication-modal',
            name: 'Open deduplication',
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
            name: 'Open parse and move',
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
            name: 'Open censor and alias',
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
            name: 'Open chrono merge',
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
            name: 'Open dashboard',
            callback: () => {
                void (async () => {
                    await this.activateWizardView();
                })();
            }
        });

        // Context Menu: Editor
        this.registerEvent(
            this.app.workspace.on('editor-menu', (menu, editor, view) => {
                // 1. Date Fix
                if (this.settings.contextMenuDateFix) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Date fix')
                            .setIcon('calendar')
                            .onClick(() => {
                                new DateFixModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 2. Merge
                if (this.settings.contextMenuMerge) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Merge')
                            .setIcon('merge')
                            .onClick(() => {
                                new MergeModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 3. Atomize
                if (this.settings.contextMenuAtomize) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Atomize')
                            .setIcon('scissors')
                            .onClick(() => {
                                new AtomizerModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 4. YAML Template
                if (this.settings.contextMenuYamlTemplate) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Apply YAML template')
                            .setIcon('layout-template')
                            .onClick(() => {
                                new YamlTemplateModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 5. Summarize
                if (this.settings.contextMenuSummarize) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Summarize')
                            .setIcon('lines-of-text')
                            .onClick(() => {
                                new SummarizerModal(this.app, this.settings, async (key, value) => {
                                    (this.settings as unknown as Record<string, unknown>)[key] = value;
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
                            .onClick(() => {
                                new CategorizeHubModal(this.app, this.settings, async (key, value) => {
                                    (this.settings as unknown as Record<string, unknown>)[key] = value;
                                    await this.saveSettings();
                                }, view.file).open();
                            });
                    });
                }
                // 7. Parse and Move
                if (this.settings.contextMenuParseAndMove) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Parse and move')
                            .setIcon('folder-input')
                            .onClick(() => {
                                new ParseAndMoveModal(this.app, this.settings, view.file).open();
                            });
                    });
                }
                // 8. Distill
                if (this.settings.contextMenuDistill) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Distill')
                            .setIcon('flask-conical')
                            .onClick(() => {
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
                        item.setTitle('Coherence: Date fix')
                            .setIcon('calendar')
                            .onClick(() => {
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
                            .onClick(() => {
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
                            .onClick(() => {
                                if (file instanceof TFile || file instanceof TFolder) {
                                    new AtomizerModal(this.app, this.settings, file).open();
                                }
                            });
                    });
                }
                // 4. YAML Template
                if (this.settings.contextMenuYamlTemplate) {
                    menu.addItem((item) => {
                        item.setTitle('Coherence: Apply YAML template')
                            .setIcon('layout-template')
                            .onClick(() => {
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
                                .onClick(() => {
                                    new SummarizerModal(this.app, this.settings, async (key, value) => {
                                        (this.settings as unknown as Record<string, unknown>)[key] = value;
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
                                .onClick(() => {
                                    new CategorizeHubModal(this.app, this.settings, async (key, value) => {
                                        (this.settings as unknown as Record<string, unknown>)[key] = value;
                                        await this.saveSettings();
                                    }, file).open();
                                });
                        });
                    }
                    // 7. Parse and Move
                    if (this.settings.contextMenuParseAndMove) {
                        menu.addItem((item) => {
                            item.setTitle('Coherence: Parse and move')
                                .setIcon('folder-input')
                                .onClick(() => {
                                    new ParseAndMoveModal(this.app, this.settings, file).open();
                                });
                        });
                    }
                    // 8. Distill
                    if (this.settings.contextMenuDistill) {
                        menu.addItem((item) => {
                            item.setTitle('Coherence: Distill')
                                .setIcon('flask-conical')
                                .onClick(() => {
                                    new DistillModal(this.app, this.settings, file).open();
                                });
                        });
                    }
                    // 9. Rating

                }
            })
        );
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        // Cleanup if needed
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

    display(): void {
        void (async () => {
            await this.fetchModels();
            this.render();
        })();
    }

    render() {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl).setName('General').setHeading();

        // Create Tab Navigation
        const navContainer = containerEl.createDiv({ cls: 'settings-nav-container coherence-settings-nav' });

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
                new Setting(containerEl).setName('Context menu').setHeading();
                containerEl.createEl('p', { text: 'Select which features should appear in the right-click context menu.' });

                new Setting(containerEl)
                    .setName('Date fix')
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
                    .setName('YAML template')
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
                    .setName('Parse and move')
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
        new Setting(containerEl).setName('About Coherence wizard').setHeading();
        containerEl.createEl('p', { text: 'Version: 0.0.27', cls: 'version-text' });

        containerEl.createEl('p', { text: 'The intention is to streamline coherence by using tools to convert chaos into order.' });
        containerEl.createEl('p', { text: 'The included tools have significantly enhanced my PKM workflows and I want to help others passionate about self-development using Obsidian.' });

        containerEl.createEl('p', { text: 'Many of these tools rely on private local AI via Ollama. (Future iterations of this plugin will allow for the use of large cloud AI via API). This is a privacy first plugin.' });

        const warning = containerEl.createEl('p');
        warning.createEl('strong', { text: 'Many people without GPUs or large CPUs will struggle to use local models large enough to generate quality output. Without GPU, local AI models will be slow and potentially laggy. So use this beta plugin at your own risk. I recommend testing on a test vault or a test folder to see how all the tools work.' });

        containerEl.createEl('p', { text: 'You will need to install Ollama on your computer and pull your favorite local AI models. I recommend gemma3:12b-it-qat if your computer can handle it. Otherwise gemma3:4b-it-qat for constrained resources.' });

        const bmcContainer = containerEl.createDiv({ cls: 'coherence-bmc-container' });

        const bmcLink = bmcContainer.createEl('a', { href: 'https://www.buymeacoffee.com/rastovich' });
        bmcLink.createEl('img', {
            attr: {
                src: 'https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=rastovich&button_colour=FFDD00&font_colour=000000&font_family=Cookie&outline_colour=000000&coffee_colour=ffffff',
                alt: 'Buy me a coffee'
            },
            cls: 'coherence-bmc-img'
        });

        new Setting(containerEl).setName('Configuration').setHeading();

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

        new Setting(containerEl).setName('Support').setHeading();
        containerEl.createEl('p', { text: 'If this app benefits you and want to encourage me to develop these and other tools. Please consider "Buying Me A Coffee" which would go a long way in encouraging me!' });
        containerEl.createEl('p', { text: 'If this tool saves you just one hour of time per month, please consider donating or subscribing!' });
    }

    renderContextMenuSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Context menu').setHeading();
        containerEl.createEl('p', { text: 'Select which features should appear in the right-click context menu.' });

        new Setting(containerEl)
            .setName('Date fix')
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
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.contextMenuRating = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }

    renderAtomizerSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Atomizer').setHeading();

        const desc = containerEl.createDiv({ cls: 'setting-item-description coherence-mb-20' });
        desc.createEl('p').createEl('strong', { text: 'Atomization Modes:' });
        const ul = desc.createEl('ul');
        ul.createEl('li').setText('By Heading: Splits the file based on markdown headings (H1, H2, etc.). Each section becomes a new file.');
        ul.createEl('li').setText('By ISO Date: Splits the file based on ISO 8601 date patterns found in the text (e.g. YYYY-MM-DD). Useful for splitting daily logs.');
        ul.createEl('li').setText('By Divider: Splits the file using a custom divider string (e.g. \'---\').');

        new Setting(containerEl)
            .setName('Default divider')
            .setDesc('The default divider string for "By Divider" mode')
            .addText(text => text
                .setPlaceholder('---')
                .setValue(this.plugin.settings.atomizerDivider)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.atomizerDivider = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }

    renderSummarizerSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Summarizer').setHeading();
        new Setting(containerEl)
            .setName('Default model')
            .setDesc('Ollama model to use for summarization')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.summarizerModel)) {
                    drop.addOption(this.plugin.settings.summarizerModel, this.plugin.settings.summarizerModel);
                }
                drop.setValue(this.plugin.settings.summarizerModel)
                    .onChange((value) => {
                        void (async () => {
                            this.plugin.settings.summarizerModel = value;
                            await this.plugin.saveSettings();
                        })();
                    });
            });

        new Setting(containerEl)
            .setName('Recursive processing')
            .setDesc('Process subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.summarizerRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerRecursive = value;
                        this.plugin.settings.summarizerGenerateTitle = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl).setName('Progressive Sequential Summarization Prompts').setHeading();

        new Setting(containerEl)
            .setName('Prompt 1 (General Summary)')
            .setDesc('Initial comprehensive summary. Placeholders: {filename}, {text}')
            .addTextArea(text => text
                .setValue(this.plugin.settings.summarizerPrompt)
                .setPlaceholder('Enter prompt...')
                .then(t => t.inputEl.rows = 6)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt = value;
                        await this.plugin.saveSettings();
                    })();
                }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.summarizerPrompt1Enabled)
                .setTooltip('Enable Prompt 1')
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt1Enabled = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Prompt 2 (Concise Summary)')
            .setDesc('Condense the summary. Placeholders: {filename}, {summary}')
            .addTextArea(text => text
                .setValue(this.plugin.settings.summarizerPrompt2)
                .setPlaceholder('Enter prompt...')
                .then(t => t.inputEl.rows = 6)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt2 = value;
                        await this.plugin.saveSettings();
                    })();
                }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.summarizerPrompt2Enabled)
                .setTooltip('Enable Prompt 2')
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt2Enabled = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Prompt 3 (De-fluff)')
            .setDesc('Remove filler. Placeholders: {summary}')
            .addTextArea(text => text
                .setValue(this.plugin.settings.summarizerPrompt3)
                .setPlaceholder('Enter prompt...')
                .then(t => t.inputEl.rows = 6)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt3 = value;
                        await this.plugin.saveSettings();
                    })();
                }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.summarizerPrompt3Enabled)
                .setTooltip('Enable Prompt 3')
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt3Enabled = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Prompt 4 (Capitalize)')
            .setDesc('Capitalize important words. Placeholders: {summary}')
            .addTextArea(text => text
                .setValue(this.plugin.settings.summarizerPrompt4)
                .setPlaceholder('Enter prompt...')
                .then(t => t.inputEl.rows = 6)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt4 = value;
                        await this.plugin.saveSettings();
                    })();
                }))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.summarizerPrompt4Enabled)
                .setTooltip('Enable Prompt 4')
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt4Enabled = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }

    renderYamlSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('YAML template').setHeading();

        const desc = containerEl.createDiv({ cls: 'setting-item-description coherence-mb-20' });
        desc.createEl('p').createEl('strong', { text: 'Note:' });
        const ul = desc.createEl('ul');
        ul.createEl('li', { text: 'Any YAML keys that are not in the template will be preserved and added after the main template keys.' });
        ul.createEl('li', { text: 'Existing values for keys in the template will be preserved but reordered.' });

        new Setting(containerEl)
            .setName('Default template')
            .setDesc('Default fields for YAML template (one per line)')
            .addTextArea(text => {
                text.inputEl.rows = 10;
                text.inputEl.addClass('coherence-w-100');
                text.setValue(this.plugin.settings.yamlTemplate)
                    .onChange((value) => {
                        void (async () => {
                            this.plugin.settings.yamlTemplate = value;
                            await this.plugin.saveSettings();
                        })();
                    });
            });

        new Setting(containerEl)
            .setName('Add date from filename')
            .setDesc('If filename starts with YYYY-MM-DD, add it to "date" field')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.yamlAddDate)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.yamlAddDate = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders when running on a folder')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.yamlRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.yamlRecursive = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }

    renderMergeSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Merge').setHeading();

        // Chrono Merge Settings
        new Setting(containerEl).setName('Chrono merge').setHeading();
        new Setting(containerEl)
            .setName('Time threshold (minutes)')
            .setDesc('Files created within this time window will be merged')
            .addText(text => text
                .setValue(String(this.plugin.settings.chronoMergeTimeThreshold))
                .onChange((value) => {
                    void (async () => {
                        const num = parseFloat(value);
                        if (!isNaN(num)) {
                            this.plugin.settings.chronoMergeTimeThreshold = num;
                            await this.plugin.saveSettings();
                        }
                    })();
                }));

        new Setting(containerEl)
            .setName('Use file creation time')
            .setDesc('If enabled, uses the file\'s creation date property instead of the date in the filename.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.chronoMergeUseCreationTime)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.chronoMergeUseCreationTime = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.chronoMergeRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.chronoMergeRecursive = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        // Concatonizer Settings
        new Setting(containerEl).setName('Concatonizer').setHeading();
        new Setting(containerEl)
            .setName('Filename suffix')
            .setDesc('Suffix to append to the folder name for the combined file (default: _combined)')
            .addText(text => text
                .setValue(this.plugin.settings.concatonizerSuffix)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.concatonizerSuffix = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Include subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.concatonizerRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.concatonizerRecursive = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Strip YAML')
            .setDesc('Remove YAML frontmatter from combined files')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.concatonizerStripYaml)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.concatonizerStripYaml = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        // Deduplication Settings
        new Setting(containerEl).setName('Deduplication').setHeading();
        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.deduplicationRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.deduplicationRecursive = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }
    renderRatingSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Automatic rating').setHeading();
        new Setting(containerEl)
            .setName('Default model')
            .setDesc('Ollama model to use for rating')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.ratingModel)) {
                    drop.addOption(this.plugin.settings.ratingModel, this.plugin.settings.ratingModel);
                }
                drop.setValue(this.plugin.settings.ratingModel)
                    .onChange((value) => {
                        void (async () => {
                            this.plugin.settings.ratingModel = value;
                            await this.plugin.saveSettings();
                        })();
                    });
            });

        new Setting(containerEl)
            .setName('Quality parameters')
            .setDesc('Comma separated list of parameters to rate (e.g. coherence, profundity)')
            .addText(text => text
                .setValue(this.plugin.settings.ratingParams)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.ratingParams = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Skip rated')
            .setDesc('Skip files that already have a rating in frontmatter')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.ratingSkipIfRated)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.ratingSkipIfRated = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }

    renderWizardSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Coherence wizard').setHeading();
        containerEl.createEl('p', { text: 'Configure the folders used by the One Click Coherence Wizard.' });

        new Setting(containerEl)
            .setName('Inbox folder')
            .setDesc('Folder containing new notes to process')
            .addText(text => text
                .setValue(this.plugin.settings.wizardInboxDir)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.wizardInboxDir = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Chrono folder')
            .setDesc('Folder for chronological storage (archive)')
            .addText(text => text
                .setValue(this.plugin.settings.wizardChronoDir)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.wizardChronoDir = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Living folder')
            .setDesc('Folder for living documents (categorized)')
            .addText(text => text
                .setValue(this.plugin.settings.wizardLivingDir)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.wizardLivingDir = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }

    renderDateFixSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Date fix').setHeading();
        containerEl.createDiv({ cls: 'setting-item-description' }).setText('This tool standardizes filenames by ensuring they start with a date in the preferred format. It automatically detects and converts existing dates or date-like number strings (e.g. 20220221) found in the filename.');

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dateFixRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.dateFixRecursive = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Fallback to creation date')
            .setDesc('If no date is found in the filename, prepend the file\'s creation date.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.dateFixFallbackToCreationDate)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.dateFixFallbackToCreationDate = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Preferred date format')
            .setDesc('ISO format to use (e.g. YYYY-MM-DD)')
            .addText(text => text
                .setValue(this.plugin.settings.dateFixDateFormat)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.dateFixDateFormat = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Exceptions')
            .setDesc('Comma separated list of file extensions (e.g. *.py) or words to exclude')
            .addTextArea(text => text
                .setValue(this.plugin.settings.dateFixExceptions)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.dateFixExceptions = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }

    renderCategorizerSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Categorizer').setHeading();
        new Setting(containerEl)
            .setName('Categorizer model')
            .setDesc('The Ollama model to use for categorization')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.categorizerModel)) {
                    drop.addOption(this.plugin.settings.categorizerModel, this.plugin.settings.categorizerModel);
                }
                drop.setValue(this.plugin.settings.categorizerModel)
                    .onChange((value) => {
                        void (async () => {
                            this.plugin.settings.categorizerModel = value;
                            await this.plugin.saveSettings();
                        })();
                    });
            });

        new Setting(containerEl).setName('Dictionaries').setHeading();

        const dictDesc = containerEl.createDiv({ cls: 'setting-item-description coherence-mb-10' });
        dictDesc.createEl('p').createEl('strong', { text: 'Dictionary Syntax:' });
        dictDesc.createEl('p', { text: 'Each line represents a category. You can optionally provide a description after a semicolon.' });
        dictDesc.createEl('pre', { text: 'Category Name; Description of the category' });
        dictDesc.createEl('p', { text: 'Example:' });
        dictDesc.createEl('pre', { text: 'Personal; Notes related to personal life\nWork; Job related tasks and projects' });

        // Dictionary Selector & Management
        new Setting(containerEl)
            .setName('Active dictionary')
            .setDesc('Select, rename, or delete dictionaries')
            .addDropdown(drop => {
                this.plugin.settings.categorizerDictionaries.forEach(d => drop.addOption(d.name, d.name));
                drop.setValue(this.plugin.settings.categorizerActiveDictionary)
                    .onChange((value) => {
                        void (async () => {
                            this.plugin.settings.categorizerActiveDictionary = value;
                            await this.plugin.saveSettings();
                            this.display(); // Refresh to show content of selected dictionary
                        })();
                    });
            })
            .addExtraButton(btn => btn
                .setIcon('plus')
                .setTooltip('Add new dictionary')
                .onClick(() => {
                    void (async () => {
                        let name = 'New Dictionary';
                        let i = 1;
                        while (this.plugin.settings.categorizerDictionaries.some(d => d.name === name)) {
                            name = `New Dictionary ${i++}`;
                        }
                        this.plugin.settings.categorizerDictionaries.push({ name, content: '' });
                        this.plugin.settings.categorizerActiveDictionary = name;
                        await this.plugin.saveSettings();
                        this.display();
                    })();
                }))
            .addExtraButton(btn => btn
                .setIcon('trash')
                .setTooltip('Delete dictionary')
                .onClick(() => {
                    void (async () => {
                        if (this.plugin.settings.categorizerDictionaries.length <= 1) {
                            new Notice('Cannot delete the last dictionary.');
                            return;
                        }
                        this.plugin.settings.categorizerDictionaries = this.plugin.settings.categorizerDictionaries.filter(d => d.name !== this.plugin.settings.categorizerActiveDictionary);
                        this.plugin.settings.categorizerActiveDictionary = this.plugin.settings.categorizerDictionaries[0].name;
                        await this.plugin.saveSettings();
                        this.display();
                    })();
                }));

        // Rename Dictionary
        const activeDict = this.plugin.settings.categorizerDictionaries.find(d => d.name === this.plugin.settings.categorizerActiveDictionary);
        if (activeDict) {
            new Setting(containerEl)
                .setName('Rename dictionary')
                .addText(text => text
                    .setValue(activeDict.name)
                    .onChange((value) => {
                        void (async () => {
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
                        })();
                    }))
                .addExtraButton(btn => btn
                    .setIcon('check')
                    .setTooltip('Apply rename (refresh)')
                    .onClick(() => this.display()));

            new Setting(containerEl)
                .setName('Dictionary content')
                .setDesc('Edit the categories for the selected dictionary')
                .addTextArea(text => {
                    text.inputEl.rows = 15;
                    text.inputEl.addClass('coherence-w-100');
                    text.setValue(activeDict.content)
                        .onChange((value) => {
                            void (async () => {
                                activeDict.content = value;
                                await this.plugin.saveSettings();
                            })();
                        });
                });
        }

        // Default Options
        new Setting(containerEl).setName('Default options').setHeading();

        new Setting(containerEl)
            .setName('Apply as tag')
            .setDesc('Add category as #tag in YAML')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.categorizerApplyAsTag)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.categorizerApplyAsTag = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Apply as backlink')
            .setDesc('Append category as [[backlink]] at end of file')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.categorizerApplyAsBacklink)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.categorizerApplyAsBacklink = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Move to folder')
            .setDesc('Move file to a subfolder named after the category')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.categorizerMoveToFolder)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.categorizerMoveToFolder = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Max categories')
            .setDesc('Maximum number of categories to apply (default 1)')
            .addText(text => text
                .setValue(String(this.plugin.settings.categorizerMaxCategories))
                .onChange((value) => {
                    void (async () => {
                        const num = parseInt(value);
                        if (!isNaN(num) && num > 0) {
                            this.plugin.settings.categorizerMaxCategories = num;
                            await this.plugin.saveSettings();
                        }
                    })();
                }));
    }

    renderParseAndMoveSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Parse and move').setHeading();
        new Setting(containerEl)
            .setName('Target directory')
            .setDesc('Directory to move parsed files to')
            .addText(text => text
                .setValue(this.plugin.settings.parseAndMoveTargetDir)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.parseAndMoveTargetDir = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders by default')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.parseAndMoveRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.parseAndMoveRecursive = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }

    renderDistillSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Distill').setHeading();

        // Censor / Alias Settings
        new Setting(containerEl).setName('Censor / alias').setHeading();

        const dictDesc = containerEl.createDiv({ cls: 'setting-item-description coherence-mb-10' });
        dictDesc.createEl('p').createEl('strong', { text: 'Dictionary Syntax:' });
        dictDesc.createEl('p', { text: 'Each line represents a word/phrase to censor.' });

        new Setting(containerEl)
            .setName('Active dictionary')
            .setDesc('Select dictionary for censorship')
            .addDropdown(drop => {
                this.plugin.settings.censorDictionaries.forEach(d => drop.addOption(d.name, d.name));
                drop.setValue(this.plugin.settings.censorActiveDictionary)
                    .onChange((value) => {
                        void (async () => {
                            this.plugin.settings.censorActiveDictionary = value;
                            await this.plugin.saveSettings();
                            this.display();
                        })();
                    });
            })
            .addExtraButton(btn => btn
                .setIcon('plus')
                .setTooltip('Add new dictionary')
                .onClick(() => {
                    void (async () => {
                        let name = 'New Dictionary';
                        let i = 1;
                        while (this.plugin.settings.censorDictionaries.some(d => d.name === name)) {
                            name = `New Dictionary ${i++}`;
                        }
                        this.plugin.settings.censorDictionaries.push({ name, content: '' });
                        this.plugin.settings.censorActiveDictionary = name;
                        await this.plugin.saveSettings();
                        this.display();
                    })();
                }))
            .addExtraButton(btn => btn
                .setIcon('trash')
                .setTooltip('Delete dictionary')
                .onClick(() => {
                    void (async () => {
                        if (this.plugin.settings.censorDictionaries.length <= 1) {
                            new Notice('Cannot delete the last dictionary.');
                            return;
                        }
                        this.plugin.settings.censorDictionaries = this.plugin.settings.censorDictionaries.filter(d => d.name !== this.plugin.settings.censorActiveDictionary);
                        this.plugin.settings.censorActiveDictionary = this.plugin.settings.censorDictionaries[0].name;
                        await this.plugin.saveSettings();
                        this.display();
                    })();
                }));

        const activeDict = this.plugin.settings.censorDictionaries.find(d => d.name === this.plugin.settings.censorActiveDictionary);
        if (activeDict) {
            new Setting(containerEl)
                .setName('Rename dictionary')
                .addText(text => text
                    .setValue(activeDict.name)
                    .onChange((value) => {
                        void (async () => {
                            if (value && value !== activeDict.name) {
                                if (this.plugin.settings.censorDictionaries.some(d => d.name === value)) {
                                    new Notice('Dictionary name already exists.');
                                    return;
                                }
                                activeDict.name = value;
                                this.plugin.settings.censorActiveDictionary = value;
                                await this.plugin.saveSettings();
                            }
                        })();
                    }))
                .addExtraButton(btn => btn
                    .setIcon('check')
                    .setTooltip('Apply rename (refresh)')
                    .onClick(() => this.display()));

            new Setting(containerEl)
                .setName('Dictionary content')
                .setDesc('Edit the censored words (one per line)')
                .addTextArea(text => {
                    text.inputEl.rows = 10;
                    text.inputEl.addClass('coherence-w-100');
                    text.setValue(activeDict.content)
                        .onChange((value) => {
                            void (async () => {
                                activeDict.content = value;
                                await this.plugin.saveSettings();
                            })();
                        });
                });
        }

        new Setting(containerEl)
            .setName('Replacement character')
            .setDesc('Character to replace censored words with')
            .addText(text => text
                .setValue(this.plugin.settings.censorReplacementChar)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.censorReplacementChar = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Process subfolders')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.censorRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.censorRecursive = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        // Generalizer Settings
        new Setting(containerEl).setName('Generalize').setHeading();
        new Setting(containerEl)
            .setName('Model')
            .setDesc('Ollama model to use')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.generalizerModel)) {
                    drop.addOption(this.plugin.settings.generalizerModel, this.plugin.settings.generalizerModel);
                }
                drop.setValue(this.plugin.settings.generalizerModel)
                    .onChange((value) => {
                        void (async () => {
                            this.plugin.settings.generalizerModel = value;
                            await this.plugin.saveSettings();
                        })();
                    });
            });

        new Setting(containerEl)
            .setName('System prompt')
            .setDesc('System prompt for the model')
            .addTextArea(text => text
                .setValue(this.plugin.settings.generalizerSystemPrompt)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.generalizerSystemPrompt = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Prompt')
            .setDesc('Prompt template. Use {text} as placeholder.')
            .addTextArea(text => text
                .setValue(this.plugin.settings.generalizerPrompt)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.generalizerPrompt = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        // Wisdom Settings
        new Setting(containerEl).setName('Wisdom Extractor').setHeading();
        new Setting(containerEl)
            .setName('Default model')
            .setDesc('Ollama model to use for wisdom extraction')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => drop.addOption(model, model));
                if (!this.ollamaModels.includes(this.plugin.settings.wisdomModel)) {
                    drop.addOption(this.plugin.settings.wisdomModel, this.plugin.settings.wisdomModel);
                }
                drop.setValue(this.plugin.settings.wisdomModel)
                    .onChange((value) => {
                        void (async () => {
                            this.plugin.settings.wisdomModel = value;
                            await this.plugin.saveSettings();
                        })();
                    });
            });

        new Setting(containerEl)
            .setName('Default mode')
            .setDesc('Default processing mode')
            .addDropdown(drop => drop
                .addOption('generalized', 'Generalized (AI)')
                .addOption('safe', 'Safe (Copy Only)')
                .setValue(this.plugin.settings.wisdomMode)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.wisdomMode = value as 'generalized' | 'safe';
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Wisdom prompt')
            .setDesc('The prompt template used for wisdom extraction')
            .addTextArea(text => text
                .setValue(this.plugin.settings.wisdomPrompt)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.wisdomPrompt = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }
}
