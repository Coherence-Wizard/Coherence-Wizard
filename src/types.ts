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
    summarizerPrompt1Enabled: boolean;
    summarizerPrompt2Enabled: boolean;
    summarizerPrompt3Enabled: boolean;
    summarizerPrompt4Enabled: boolean;

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
