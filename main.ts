import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, TFolder, Menu } from 'obsidian';
import { AtomizerModal } from './src/ui/atomizer-modal';
import { SummarizerModal } from './src/ui/summarizer-modal';
import { ONE_SHOT_SUMMARY_PROMPT } from './src/modules/summarizer';
import { validSummaryWordLimit } from './src/modules/summary-limits';
import { SummarizationJob, SummarizationRequest } from './src/modules/summarization-job';
import { SummarizationView, VIEW_TYPE_SUMMARIZATION } from './src/ui/summarization-view';
import { WisdomModal } from './src/ui/wisdom-modal';
import { DateFixModal } from './src/ui/date-fix-modal';
import { ConcatonizerModal } from './src/ui/concatonizer-modal';
import { RatingModal } from './src/ui/rating-modal';

import { DeduplicationModal } from './src/ui/deduplication-modal';
import { ParseAndMoveModal } from './src/ui/parse-and-move-modal';
import { SmartMoveModal } from './src/ui/smart-move-modal';
import { CensorModal } from './src/ui/censor-modal';

import { MergeModal } from './src/ui/merge-modal';
import { CategorizeHubModal } from './src/ui/categorize-hub-modal';
import { DistillModal } from './src/ui/distill-modal';
import { ChronoMergeModal } from './src/ui/chrono-merge-modal';
import { YamlTemplateModal } from './src/ui/yaml-template-modal';
import { createAIService } from './src/modules/ai-service';


import { CoherenceSettings } from './src/types';
export type { CoherenceSettings } from './src/types';

const DEFAULT_SETTINGS: CoherenceSettings = {
    // General
    ollamaUrl: 'http://localhost:11434',
    aiProvider: 'ollama',
    openaiBaseUrl: 'http://127.0.0.1:8888/v1',
    openaiApiKey: '',
    summaryDefaultsVersion: 1,

    recursiveDefaultsVersion: 1,

    // Atomizer
    atomizerDivider: '---',
    atomizerModel: 'llama3',
    atomizerMode: 'heading',

    // Summarizer
    summarizerModel: 'llama3',
    summarizerMode: 'one-shot',
    summarizerDisableThinking: true,
    summarizerAddShortSummary: false,
    summarizerMainMaxWords: 50,
    summarizerShortMaxWords: 10,
    summarizerOneShotPrompt: ONE_SHOT_SUMMARY_PROMPT,
    summarizerRecursive: false,
    summarizerOverwrite: false,
    summarizerIncludeYaml: false,
    summarizerMaxChars: 50000,
    summarizerPrompt: "Please summarise the following Markdown content from the file titled '{filename}':\n\n{text}",
    summarizerPrompt2: "You are a summarization assistant. Condense the following note into {max_words} words or fewer. Start directly with the main point and avoid phrases like 'This note', 'Key takeaways', 'It emphasizes', or any similar preamble. Use plain sentences only—no headings, quotes, markdown, dates, filenames, or filler.\n\nTitle: {filename}\n\nLonger summary:\n{summary}",
    summarizerPrompt3: "Rewrite the following text keeping it at {max_words} words or fewer. Remove any filler, preambles (e.g., 'This note...', 'Key takeaways...'), dates, filenames, headings, markdown, or meta-language. Return only the cleaned summary text.\n\nText:\n{summary}",
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
    yamlRecursive: false,

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
    deduplicationRecursive: false,

    // Parse and Move
    parseAndMoveTargetDir: 'Categorized Content',
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
    wisdomRecursive: false,
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

    contextMenuCensor: true,
    contextMenuSmartMove: true,
    contextMenuDistill: true,
    contextMenuRating: true,
};

export default class CoherencePlugin extends Plugin {
    settings: CoherenceSettings;
    summarizationJob: SummarizationJob;

    async onload() {
        await this.loadSettings();
        this.summarizationJob = new SummarizationJob(this.app);
        this.registerView(VIEW_TYPE_SUMMARIZATION, leaf => new SummarizationView(leaf, this.summarizationJob));
        this.addCommand({
            id: 'show-summarization-progress',
            name: 'Show summarization progress',
            callback: () => { void this.showSummarizationProgress().catch(error => new Notice(String(error))); },
        });

        this.app.workspace.onLayoutReady(() => {
            if (this.app.workspace.getLeavesOfType(VIEW_TYPE_SUMMARIZATION).length) {
                void this.showSummarizationProgress().catch(error => console.error('Could not restore progress pane', error));
            }
        });
        this.addSettingTab(new CoherenceSettingTab(this.app, this));



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
                    }, file, request => this.startSummarization(request)).open();
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
                    new DeduplicationModal(this.app, file.parent, this.settings.deduplicationRecursive).open();
                } else {
                    new Notice('No active file.');
                }
            }
        });

        // Parse and Copy Command
        this.addCommand({
            id: 'open-parse-and-move-modal',
            name: 'Open parse and copy',
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

        // Use the same submenu in the editor and file explorer.
        this.registerEvent(this.app.workspace.on('editor-menu', (menu, _editor, view) => {
            if (view.file) this.addContextMenu(menu, view.file);
        }));
        this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
            if (file instanceof TFile || file instanceof TFolder) this.addContextMenu(menu, file);
        }));
    }

    async showSummarizationProgress(): Promise<void> {
        const workspace = this.app.workspace;
        const existing = workspace.getLeavesOfType(VIEW_TYPE_SUMMARIZATION);
        let leaf = existing.find(item => item.getRoot() === workspace.rightSplit);
        if (!leaf) {
            leaf = workspace.getRightLeaf(false);
            if (!leaf) throw new Error('Could not open the right sidebar.');
            await leaf.setViewState({ type: VIEW_TYPE_SUMMARIZATION, active: false });
        }
        // Replace old left-side/restored progress views without stopping the plugin-owned job.
        for (const previous of existing) if (previous !== leaf) previous.detach();
        await workspace.revealLeaf(leaf);
    }

    private async startSummarization(request: SummarizationRequest): Promise<boolean> {
        await this.showSummarizationProgress();
        const started = this.summarizationJob.start(request);
        if (!started) new Notice('A batch or model unload is already running. Wait for it to finish, or stop the active batch in the sidebar.');
        return started;
    }

    private addContextMenu(menu: Menu, target: TFile | TFolder) {
        const saveSetting = async (key: string, value: unknown) => {
            (this.settings as unknown as Record<string, unknown>)[key] = value;
            await this.saveSettings();
        };
        const actions = [
            { enabled: this.settings.contextMenuDateFix, title: 'Date fix', icon: 'calendar', open: () => new DateFixModal(this.app, this.settings, target).open() },
            { enabled: this.settings.contextMenuSmartMove && target instanceof TFolder, title: 'Smart move', icon: 'folder-output', open: () => {
                if (target instanceof TFolder) new SmartMoveModal(this.app, target).open();
            } },
            { enabled: this.settings.contextMenuMerge, title: 'Merge', icon: 'merge', open: () => new MergeModal(this.app, this.settings, target).open() },
            { enabled: this.settings.contextMenuAtomize, title: 'Atomize', icon: 'scissors', open: () => new AtomizerModal(this.app, this.settings, target).open() },
            { enabled: this.settings.contextMenuYamlTemplate, title: 'Apply YAML template', icon: 'layout-template', open: () => new YamlTemplateModal(this.app, this.settings, target).open() },
            { enabled: this.settings.contextMenuSummarize, title: 'Summarize', icon: 'lines-of-text', open: () => new SummarizerModal(this.app, this.settings, saveSetting, target, request => this.startSummarization(request)).open() },
            { enabled: this.settings.contextMenuCategorize, title: 'Categorize', icon: 'folder', open: () => new CategorizeHubModal(this.app, this.settings, saveSetting, target).open() },
            { enabled: this.settings.contextMenuParseAndMove, title: 'Parse and copy', icon: 'folder-input', open: () => new ParseAndMoveModal(this.app, this.settings, target).open() },
            { enabled: this.settings.contextMenuCensor, title: 'Censor / alias', icon: 'eye-off', open: () => new CensorModal(this.app, this.settings, target).open() },
            { enabled: this.settings.contextMenuDistill, title: 'Distill', icon: 'flask-conical', open: () => new DistillModal(this.app, this.settings, target).open() },
            { enabled: this.settings.contextMenuRating, title: 'Rating', icon: 'star', open: () => new RatingModal(this.app, this.settings, saveSetting, target).open() },
        ].filter(action => action.enabled);
        if (actions.length === 0) return;

        menu.addItem(item => {
            item.setTitle('Coherence Wizard').setIcon('wand-2');
            // Obsidian provides native submenus at runtime, but omits this method from its public typings.
            const submenu = (item as unknown as { setSubmenu(): Menu }).setSubmenu();
            for (const action of actions) {
                submenu.addItem(child => child.setTitle(action.title).setIcon(action.icon).onClick(action.open));
            }
        });
    }

    async loadSettings() {
        const data = (await this.loadData()) as unknown;
        const partial = (typeof data === 'object' && data !== null) ? (data as Partial<CoherenceSettings>) : {};
        this.settings = { ...DEFAULT_SETTINGS, ...partial };
        for (const key of ['summarizerMainMaxWords', 'summarizerShortMaxWords'] as const) {
            if (!validSummaryWordLimit(this.settings[key])) this.settings[key] = DEFAULT_SETTINGS[key];
        }
        // Upgrade only untouched default prompts; preserve custom wording.
        for (const key of ['summarizerOneShotPrompt', 'summarizerPrompt2', 'summarizerPrompt3'] as const) {
            if (this.settings[key] === DEFAULT_SETTINGS[key].replace('{max_words}', '50')) this.settings[key] = DEFAULT_SETTINGS[key];
        }
        if ((partial.summaryDefaultsVersion ?? 0) < 1) {
            this.settings.summarizerMode = 'one-shot';
            this.settings.summaryDefaultsVersion = 1;
            await this.saveSettings();
        }
        // Reset older saved defaults once; later opt-ins survive reloads.
        if ((partial.recursiveDefaultsVersion ?? 0) < 1) {
            for (const key of Object.keys(DEFAULT_SETTINGS)) {
                if (key.endsWith('Recursive')) {
                    (this.settings as unknown as Record<string, unknown>)[key] = false;
                }
            }
            this.settings.recursiveDefaultsVersion = 1;
            await this.saveSettings();
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    onunload() {
        this.summarizationJob?.dispose();
    }
}

class CoherenceSettingTab extends PluginSettingTab {
    plugin: CoherencePlugin;
    activeTab = 'about';
    ollamaModels: string[] = [];
    modelError = '';

    constructor(app: App, plugin: CoherencePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async fetchModels() {
        try {
            this.ollamaModels = await createAIService(this.plugin.settings).listModels();
            this.modelError = this.ollamaModels.length ? '' : 'No models returned. Enter the exact model ID or check your server.';
        } catch (error) {
            this.ollamaModels = [];
            this.modelError = error instanceof Error ? error.message : String(error);
        }
    }

    display(): void {
        this.render();
    }

    render() {
        const { containerEl } = this;

        containerEl.empty();

        ;

        // Create Tab Navigation
        const navContainer = containerEl.createDiv({ cls: 'settings-nav-container coherence-settings-nav' });

        const tabs = [
            { id: 'about', name: 'About' },
            { id: 'connection', name: 'AI connection' },
            { id: 'contextmenu', name: 'Context Menu' },
            { id: 'datefix', name: 'Date Fix' },
            { id: 'merge', name: 'Merge' },
            { id: 'atomizer', name: 'Atomization' },
            { id: 'yaml', name: 'YAML Template' },
            { id: 'summarizer', name: 'Summarize' },
            { id: 'categorizer', name: 'Categorize' },
            { id: 'parsemove', name: 'Parse & Copy' },
            { id: 'censor', name: 'Censor' },
            { id: 'distill', name: 'Distill' },
            { id: 'rating', name: 'Rating' }
        ];

        tabs.forEach(tab => {
            const btn = navContainer.createEl('button', { text: tab.name });
            if (this.activeTab === tab.id) {
                btn.addClass('mod-cta');
            }
            btn.onclick = () => {
                this.activeTab = tab.id;
                this.render();
            };
        });

        // Render Content based on Active Tab
        try {
            if (this.activeTab === 'about') {
                this.renderAboutSettings(containerEl);

            } else if (this.activeTab === 'connection') {
                this.renderConnectionSettings(containerEl);
            } else if (this.activeTab === 'rating') {
                this.renderRatingSettings(containerEl);
            } else if (this.activeTab === 'contextmenu') {
                this.renderContextMenuSettings(containerEl);
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
            } else if (this.activeTab === 'censor') {
                this.renderCensorSettings(containerEl);
            } else if (this.activeTab === 'distill') {
                this.renderDistillSettings(containerEl);
            }
        } catch (e) {
            console.error('Error rendering settings tab:', e);
            containerEl.createEl('p', { text: 'Error rendering settings. Please check console.' });
        }
    }

    renderAboutSettings(containerEl: HTMLElement) {
        ;
        containerEl.createEl('p', { text: `Version: ${this.plugin.manifest.version}`, cls: 'version-text' });

        containerEl.createEl('p', { text: 'The intention is to streamline coherence by using tools to convert chaos into order.' });
        containerEl.createEl('p',).appendText('The included tools have significantly enhanced my PKM workflows and I want to help others passionate about self-development using Obsidian.')

        containerEl.createEl('p',).appendText('AI tools use the provider selected in the AI connection tab: Ollama, Unsloth, or an OpenAI-compatible server. Note content is sent to that server. Local processing requires a local endpoint and local model.');

        const warning = containerEl.createEl('p');
        warning.createEl('strong').appendText('Many people without GPUs or large CPUs will struggle to use local models large enough to generate quality output. Without GPU, local AI models will be slow and potentially laggy. So use this beta plugin at your own risk. I recommend testing on a test vault or a test folder to see how all the tools work.');

        containerEl.createEl('p',).appendText('For local AI, start Ollama or Unsloth and select an installed model. You can also configure another OpenAI-compatible endpoint. Model availability and authentication depend on your server.')

        containerEl.createEl('a', { href: 'https://www.buymeacoffee.com/rastovich', text: 'Support development' });

        new Setting(containerEl).setName('Configuration').setHeading();

        containerEl.createEl('p', { text: 'Set your provider, endpoint, API key, and model in the AI connection tab.' });

        containerEl.createEl('p', { text: 'Next go through each of the settings tabs to review settings.' });

        containerEl.createEl('p',).appendText('Start by configuring the YAML template, category dictionary, and censor dictionary to match your notes.');
        containerEl.createEl('p', { text: 'These require dictionaries you need to create that match your workflow.' });

        containerEl.createEl('p', { text: 'What YAML keys do you want to include? What order are these keys?' });

        containerEl.createEl('p', { text: 'How do you want to categorize your notes? What topics do you cover? Beware that the more categories you include in your dictionary, the less accurate category selection will be. Perhaps start with something like:' });
        const catList = containerEl.createEl('ul');
        catList.createEl('li', { text: 'Work' });
        catList.createEl('li', { text: 'Personal' });

        containerEl.createEl('p',).appendText('Distill uses AI to rewrite notes for a general audience. The separate Censor tab configures dictionary replacements for names and places, including spelling variants. For example:');
        const aliasList = containerEl.createEl('ul');
        aliasList.createEl('li',).appendText('John, Jon, Joan, Johnathon, Johnny = Bob');

        containerEl.createEl('p', { text: 'Open tools from the command palette or the Coherence Wizard right-click submenu. Recursive processing means including subfolders: it is off by default for every tool and reset to off once when upgrading to 0.0.37. You can opt in afterward in settings or a tool dialog.' });

        new Setting(containerEl).setName('Support').setHeading();
        containerEl.createEl('p',).appendText('If this app benefits you and want to encourage me to develop these and other tools. Please consider "Buying Me A Coffee" which would go a long way in encouraging me!')
        containerEl.createEl('p', { text: 'If this tool saves you just one hour of time per month, please consider donating or subscribing!' });
    }

    renderConnectionSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('AI connection').setHeading();
        containerEl.createEl('p', { text: 'This connection is used by all AI tools. Notes and prompts go to the selected server. Individual feature tabs can override the shared model selection.' });
        new Setting(containerEl)
            .setName('Provider')
            .addDropdown(drop => drop
                .addOption('ollama', 'Ollama')
                .addOption('unsloth', 'Unsloth · OpenAI compatible')
                .addOption('openai-compatible', 'OpenAI compatible')
                .setValue(this.plugin.settings.aiProvider)
                .onChange(async value => {
                    this.plugin.settings.aiProvider = value as CoherenceSettings['aiProvider'];
                    this.ollamaModels = [];
                    this.modelError = '';
                    await this.plugin.saveSettings();
                    this.render();
                }));
        if (this.plugin.settings.aiProvider === 'ollama') {
            new Setting(containerEl).setName('Ollama URL')
                .setDesc('Server address for Ollama. The default uses port 11434.')
                .addText(text => text.setValue(this.plugin.settings.ollamaUrl).onChange(async value => {
                    this.plugin.settings.ollamaUrl = value.trim();
                    this.ollamaModels = [];
                    await this.plugin.saveSettings();
                }));
        } else {
            new Setting(containerEl).setName('API base URL')
                .setDesc('Include the API prefix, ending in /v1 for Unsloth. Use the server URL, not a chat page URL.')
                .addText(text => text.setValue(this.plugin.settings.openaiBaseUrl).onChange(async value => {
                    this.plugin.settings.openaiBaseUrl = value.trim();
                    this.ollamaModels = [];
                    await this.plugin.saveSettings();
                }));
            new Setting(containerEl).setName('API key')
                .setDesc('Sent as a bearer token. Leave blank only if your server allows it. Saved locally in plugin settings; do not share data.json.')
                .addText(text => {
                    text.inputEl.type = 'password';
                    text.setValue(this.plugin.settings.openaiApiKey).onChange(async value => {
                        this.plugin.settings.openaiApiKey = value.trim();
                        this.ollamaModels = [];
                        await this.plugin.saveSettings();
                    });
                });
            containerEl.createEl('p', { text: this.plugin.settings.aiProvider === 'unsloth'
                ? 'Unsloth supports automatic model unloading after AI summarization or stop. An API key with model access is required. If the server refuses to unload a model that is in use elsewhere, the sidebar reports it.'
                : 'OpenAI-compatible APIs do not define a model-unload operation. Stop cancels the request; the server manages model memory. Choose the Unsloth preset when using Unsloth to enable its unload operation.' });
        }
        new Setting(containerEl).setName('Refresh models')
            .setDesc('Fetch available model IDs from the configured server.')
            .addButton(button => button.setButtonText('Refresh models').onClick(async () => {
                button.setDisabled(true);
                await this.fetchModels();
                this.render();
            }));
        if (this.modelError) containerEl.createEl('p', { text: this.modelError, cls: 'coherence-text-error' });
        {
            new Setting(containerEl).setName('Available models')
                .setDesc('Selecting a model sets it for all AI tools. You can change individual tools afterward.')
                .addDropdown(drop => {
                    drop.addOption('', this.ollamaModels.length ? 'Select a model' : 'Refresh models to load available models');
                    drop.setDisabled(!this.ollamaModels.length);
                    this.ollamaModels.forEach(model => { drop.addOption(model, model); });
                    drop.setValue(this.ollamaModels.includes(this.plugin.settings.summarizerModel) ? this.plugin.settings.summarizerModel : '');
                    drop.onChange(async value => { if (value) { await this.setSharedModel(value); this.render(); } });
                });
        }
        new Setting(containerEl).setName('Model ID')
            .setDesc('Exact model ID from your server. Sets the model for every AI tool, including summarization. You can enter an ID even when model listing is unavailable.')
            .addText(text => text.setValue(this.plugin.settings.summarizerModel).onChange(value => this.setSharedModel(value.trim())));
    }

    async setSharedModel(value: string): Promise<void> {
        for (const key of ['summarizerModel', 'categorizerModel', 'ratingModel', 'generalizerModel', 'wisdomModel'] as const) {
            this.plugin.settings[key] = value;
        }
        await this.plugin.saveSettings();
    }

    renderContextMenuSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Context menu').setHeading();
        containerEl.createEl('p', { text: 'Choose the tools shown inside the Coherence Wizard submenu when you right-click a note, folder, or editor. Turning a tool off here does not remove its command-palette command.' });
        const features: { key: keyof CoherenceSettings; name: string; description: string }[] = [
            { key: 'contextMenuDateFix', name: 'Date fix', description: 'Standardize date prefixes in filenames. Available for files and folders.' },
            { key: 'contextMenuSmartMove', name: 'Smart move', description: 'Move a folder’s files into another folder, preserving conflicting destination files. Available for folders only; subfolders are excluded unless you enable recursive processing in the dialog.' },
            { key: 'contextMenuMerge', name: 'Merge', description: 'Open chronological merging, file combining, or duplicate detection. Available for files and folders.' },
            { key: 'contextMenuAtomize', name: 'Atomize', description: 'Split Markdown notes into smaller notes. Available for files and folders.' },
            { key: 'contextMenuYamlTemplate', name: 'YAML template', description: 'Apply frontmatter fields and ordering. Available for files and folders.' },
            { key: 'contextMenuSummarize', name: 'Summarize', description: 'Generate summaries using the selected AI provider. Available for files and folders.' },
            { key: 'contextMenuCategorize', name: 'Categorize', description: 'Assign dictionary categories or rate notes using the selected AI provider. Available for files and folders.' },
            { key: 'contextMenuParseAndMove', name: 'Parse and copy', description: 'Copy matching content into category folders. Available for files and folders.' },
            { key: 'contextMenuCensor', name: 'Censor / alias', description: 'Replace dictionary terms with aliases or masking characters, without AI. Available for files and folders.' },
            { key: 'contextMenuDistill', name: 'Distill', description: 'Rewrite personal text or extract wisdom with the selected AI provider. Available for files and folders.' },
            { key: 'contextMenuRating', name: 'Rating', description: 'Write AI-generated ratings to frontmatter. Available for files and folders.' },
        ];
        for (const feature of features) {
            new Setting(containerEl)
                .setName(feature.name)
                .setDesc(feature.description)
                .addToggle(toggle => toggle
                    .setValue(Boolean(this.plugin.settings[feature.key]))
                    .onChange(async value => {
                        (this.plugin.settings as unknown as Record<string, unknown>)[feature.key] = value;
                        await this.plugin.saveSettings();
                    }));
        }
    }

    renderAtomizerSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Atomizer').setHeading();
        containerEl.createEl('p', { text: "Splits a Markdown note into new files by headings, dates, or a divider, keeping the source note. Folder runs process only immediate Markdown files; subfolders are not included. No AI is needed." });

        const desc = containerEl.createDiv({ cls: 'setting-item-description coherence-mb-20' });
        desc.createEl('p').createEl('strong', { text: 'Atomization modes:' });
        const ul = desc.createEl('ul');
        ul.createEl('li').appendText('By heading: splits the file based on markdown headings (H1, H2, etc.). Each section becomes a new file.');
        ul.createEl('li').appendText('By ISO date: splits the file based on ISO 8601 date patterns found in the text (e.g. YYYY-MM-DD). Useful for splitting daily logs.');
        ul.createEl('li').appendText('By divider: splits the file using a custom divider string (e.g. \'---\').');

        new Setting(containerEl)
            .setName('Default divider')
            .setDesc('The default divider string for "by divider" mode')
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
        containerEl.createEl('p', { text: "Writes summaries to note frontmatter using the selected AI provider. After removing Markdown formatting, tags, backlinks, and dates, bodies within the main word limit are copied directly into the normal summary without AI. The optional short summary may still need AI. Runs in the background with progress and stop controls in the right sidebar. Notes edited during generation are left unchanged. Choose a single concise pass or your existing sequence of prompts." });
        new Setting(containerEl)
            .setName('Default model')
            .setDesc('Model to use for summarization')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => { drop.addOption(model, model); });
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
            .setDesc('Include notes in subfolders when processing a folder. Off by default; when off, only files directly in the selected folder are processed.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.summarizerRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerRecursive = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Default summary mode')
            .setDesc('Choose the default for new runs. You can switch modes in the start dialog without changing your saved multi-stage prompts.')
            .addDropdown(drop => drop
                .addOption('multi-stage', 'Multi-stage prompts')
                .addOption('one-shot', 'One-shot')
                .setValue(this.plugin.settings.summarizerMode)
                .onChange(async value => {
                    this.plugin.settings.summarizerMode = value as 'multi-stage' | 'one-shot';
                    await this.plugin.saveSettings();
                    this.render();
                }));

        for (const [key, name] of [
            ['summarizerMainMaxWords', 'Main summary maximum words'],
            ['summarizerShortMaxWords', 'Short summary maximum words'],
        ] as const) {
            new Setting(containerEl).setName(name)
                .setDesc('Enter a whole number from 1 to 10000. Defaults are 50 for the main summary and 10 for the optional short summary. Overlong model responses are rewritten, never cut off; persistent failures are listed in the sidebar.')
                .addText(text => {
                    text.inputEl.type = 'number';
                    text.inputEl.setAttribute('min', '1'); text.inputEl.setAttribute('max', '10000'); text.inputEl.setAttribute('step', '1');
                    text.setValue(String(this.plugin.settings[key])).onChange(async value => {
                        const limit = Number(value);
                        text.inputEl.setAttribute('aria-invalid', String(!validSummaryWordLimit(limit)));
                        if (!validSummaryWordLimit(limit)) return;
                        this.plugin.settings[key] = limit;
                        await this.plugin.saveSettings();
                    });
                });
        }

        new Setting(containerEl)
            .setName('Add short summary')
            .setDesc('Also write summary_short in YAML using the short word limit. Off by default. Condenses the normal summary with an extra AI request when it exceeds that limit; shorter text is copied directly. Can fill a missing short summary without replacing an existing normal summary. Overwrite applies to each field separately.')
            .addToggle(toggle => toggle.setValue(this.plugin.settings.summarizerAddShortSummary).onChange(async value => {
                this.plugin.settings.summarizerAddShortSummary = value;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName('Disable thinking')
            .setDesc('On by default for faster summaries. Requests no reasoning from supported Ollama and Unsloth models. Compatible servers use the enable_thinking chat-template option; support varies. Models that require reasoning may still think. Applies to all summary stages and optional titles. Turn off to use the server default, or override for a single batch in the start dialog.')
            .addToggle(toggle => toggle.setValue(this.plugin.settings.summarizerDisableThinking).onChange(async value => {
                this.plugin.settings.summarizerDisableThinking = value;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl)
            .setName('One-shot prompt')
            .setDesc('One pass for the normal summary, with up to two rewrites if it exceeds the word limit. The optional short summary may add requests. Placeholders: {filename}, {text}, {max_words}. Multi-stage prompts are preserved and shown when you switch modes.')
            .addTextArea(text => text
                .setValue(this.plugin.settings.summarizerOneShotPrompt)
                .then(control => control.inputEl.rows = 8)
                .onChange(async value => {
                    this.plugin.settings.summarizerOneShotPrompt = value;
                    await this.plugin.saveSettings();
                }));

        if (this.plugin.settings.summarizerMode === 'one-shot') return;

        new Setting(containerEl)
            .setName('Generate titles in multi-stage mode')
            .setDesc('Optionally make an additional request to rename untitled notes. One-shot mode always keeps filenames unchanged.')
            .addToggle(toggle => toggle.setValue(this.plugin.settings.summarizerGenerateTitle).onChange(async value => {
                this.plugin.settings.summarizerGenerateTitle = value;
                await this.plugin.saveSettings();
            }));

        new Setting(containerEl).setName('Progressive sequential summarization prompts').setHeading();

        new Setting(containerEl)
            .setName('Prompt 1 (general summary)')
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
                .setTooltip('Enable prompt 1')
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt1Enabled = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Prompt 2 (concise summary)')
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
                .setTooltip('Enable prompt 2')
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt2Enabled = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Prompt 3 (de-fluff)')
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
                .setTooltip('Enable prompt 3')
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt3Enabled = value;
                        await this.plugin.saveSettings();
                    })();
                }));

        new Setting(containerEl)
            .setName('Prompt 4 (capitalize)')
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
                .setTooltip('Enable prompt 4')
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.summarizerPrompt4Enabled = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }

    renderYamlSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('YAML template').setHeading();
        containerEl.createEl('p', { text: "Adds missing frontmatter fields and puts them in your chosen order in existing notes. Existing field values are kept, except when you choose to set the date from the filename. No AI is needed." });

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
            .setDesc('If filename starts with yyyy-mm-dd, add it to "date" field')
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
            .setDesc('Include notes in subfolders when processing a folder. Off by default; when off, only files directly in the selected folder are processed.')
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
        containerEl.createEl('p', { text: "Choose a merge tool in the action dialog. When launched from a file, folder-based tools use its containing folder." });

        // Chrono Merge Settings
        new Setting(containerEl).setName('Chrono merge').setHeading();
        containerEl.createEl('p', { text: "Groups notes with nearby timestamps for review. You can edit each proposed filename and merged text before saving. Source notes are sent to trash only after the merged output is saved." });
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
            .setDesc('Include notes in subfolders when processing a folder. Off by default; when off, only files directly in the selected folder are processed.')
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
        containerEl.createEl('p', { text: "Combines Markdown files from a folder into one document while retaining the source notes. The dialog lets you include filenames and strip frontmatter from the combined output." });
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
            .setDesc('Include notes in subfolders when processing a folder. Off by default; when off, only files directly in the selected folder are processed.')
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
        containerEl.createEl('p', { text: "Finds files with identical content in one folder, two folders, or the vault root. Review the results and choose individual duplicates to send to trash; scanning does not delete anything." });
        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Include notes in subfolders when processing a folder. Off by default; when off, only files directly in the selected folder are processed.')
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
        containerEl.createEl('p', { text: "Uses the selected AI provider to assess notes against your comma-separated criteria and writes the resulting rating to frontmatter. Choose criteria such as clarity or usefulness; these scores are subjective AI judgments." });
        new Setting(containerEl)
            .setName('Default model')
            .setDesc('Model to use for rating')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => { drop.addOption(model, model) });
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
            .setDesc('Comma separated list of parameters to rate (coherence, profundity,...)')
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

    renderDateFixSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Date fix').setHeading();
        containerEl.createDiv({ cls: 'setting-item-description' }).setText('This tool standardizes filenames by ensuring they start with a date in the preferred format. It automatically detects and converts existing dates or date-like number strings (e.g. 20220221) found in the filename.');

        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Include notes in subfolders when processing a folder. Off by default; when off, only files directly in the selected folder are processed.')
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

        const desc0 = createFragment();
        desc0.append('ISO');
        desc0.append(' format to use (e.g. yyyy-mm-dd)')

        new Setting(containerEl)
            .setName('Preferred date format')
            .setDesc(desc0)
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
        containerEl.createEl('p', { text: "Uses the selected AI provider and the selected dictionary to choose categories for each note. Categories can become YAML tags, appended backlinks, or destination folders. Review move and copy options in the dialog because they can change where notes are stored." });
        new Setting(containerEl)
            .setName('Categorizer model')
            .setDesc('The model to use for categorization')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => { drop.addOption(model, model) });
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
        dictDesc.createEl('p').createEl('strong', { text: 'Dictionary syntax:' });
        dictDesc.createEl('p', { text: 'Each line represents a category. You can optionally provide a description after a semicolon.' });
        dictDesc.createEl('pre', { text: 'Category name; description of the category' });
        dictDesc.createEl('p', { text: 'Example:' });
        dictDesc.createEl('pre', { text: 'Personal; notes related to personal life\nwork; job related tasks and projects' });

        // Dictionary Selector & Management
        new Setting(containerEl)
            .setName('Active dictionary')
            .setDesc('Select, rename, or delete dictionaries')
            .addDropdown(drop => {
                this.plugin.settings.categorizerDictionaries.forEach(d => { drop.addOption(d.name, d.name) });
                drop.setValue(this.plugin.settings.categorizerActiveDictionary)
                    .onChange((value) => {
                        void (async () => {
                            this.plugin.settings.categorizerActiveDictionary = value;
                            await this.plugin.saveSettings();
                            this.render(); // Refresh to show content of selected dictionary
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
                        this.render();
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
                        this.render();
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
                    .onClick(() => this.update()));

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
        new Setting(containerEl)
            .setName('Default options')

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
        new Setting(containerEl).setName('Parse and copy').setHeading();
        containerEl.createEl('p', { text: 'Copies content matching your category and tag rules into category folders under the target directory. Source notes stay in place. Define rules such as Work: #work in the dialog; repeated runs can append the same content again. No AI is needed.' });
        new Setting(containerEl)
            .setName('Target directory')
            .setDesc('Base folder where category folders and copied content are created')
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
            .setDesc('Include notes in subfolders when processing a folder. Off by default; when off, only files directly in the selected folder are processed.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.parseAndMoveRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.parseAndMoveRecursive = value;
                        await this.plugin.saveSettings();
                    })();
                }));
    }

    renderCensorSettings(containerEl: HTMLElement) {
        // Censor / Alias Settings
        new Setting(containerEl).setName('Censor / alias').setHeading();
        containerEl.createEl('p', { text: "Replaces matching dictionary terms with aliases or masks them without AI. Use one mapping per line, for example: John, Jon = Alex. The dialog offers masking, whole-sentence masking, and reverse alias replacement. Results go to a Censored subfolder by default; rerunning can replace earlier output. Review the result before sharing." });

        const dictDesc = containerEl.createDiv({ cls: 'setting-item-description coherence-mb-10' });
        dictDesc.createEl('p').createEl('strong', { text: 'Dictionary syntax:' });
        dictDesc.createEl('p', { text: 'Each line represents a word/phrase to censor.' });

        new Setting(containerEl)
            .setName('Active dictionary')
            .setDesc('Select dictionary for censorship')
            .addDropdown(drop => {
                this.plugin.settings.censorDictionaries.forEach(d => { drop.addOption(d.name, d.name) });
                drop.setValue(this.plugin.settings.censorActiveDictionary)
                    .onChange((value) => {
                        void (async () => {
                            this.plugin.settings.censorActiveDictionary = value;
                            await this.plugin.saveSettings();
                            this.render();
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
                        this.render();
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
                        this.render();
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
                    .onClick(() => this.update()));

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
            .setDesc('Include notes in subfolders when processing a folder. Off by default; when off, only files directly in the selected folder are processed.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.censorRecursive)
                .onChange((value) => {
                    void (async () => {
                        this.plugin.settings.censorRecursive = value;
                        await this.plugin.saveSettings();
                    })();
                }));

    }

    renderRecursiveSetting(containerEl: HTMLElement, key: 'generalizerRecursive' | 'wisdomRecursive') {
        new Setting(containerEl)
            .setName('Recursive')
            .setDesc('Include notes in subfolders when processing a folder. Off by default; when off, only files directly in the selected folder are processed.')
            .addToggle(toggle => toggle.setValue(this.plugin.settings[key]).onChange(async value => {
                this.plugin.settings[key] = value;
                await this.plugin.saveSettings();
            }));
    }

    renderDistillSettings(containerEl: HTMLElement) {
        new Setting(containerEl).setName('Distill').setHeading();
        containerEl.createEl('p', { text: 'Use the selected AI provider to rewrite personal notes as general insights. Generalize creates revised copies using your prompts; wisdom extraction offers an AI rewrite or a copy-only mode. Censor / alias has its own tab for dictionary-based replacements.' });
        new Setting(containerEl).setName('Rewrite personal text').setHeading();
        this.renderRecursiveSetting(containerEl, 'generalizerRecursive');
        new Setting(containerEl)
            .setName('Model')
            .setDesc('Model to use')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => { drop.addOption(model, model) });
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
        new Setting(containerEl).setName('Wisdom extractor').setHeading();
        containerEl.createEl('p', { text: 'Creates a new note in a Generalized subfolder and links it to the original in frontmatter. Generalized mode rewrites the text with AI. Safe mode copies the body without AI; it does not remove identifying details.' });
        this.renderRecursiveSetting(containerEl, 'wisdomRecursive');
        new Setting(containerEl)
            .setName('Default model')
            .setDesc('Model to use for wisdom extraction')
            .addDropdown(drop => {
                this.ollamaModels.forEach(model => { drop.addOption(model, model) });
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
                .addOption('safe', 'Safe (copy only)')
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
