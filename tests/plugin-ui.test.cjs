const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const vm = require('node:vm');
const path = require('node:path');

// Small Obsidian host double: exercises real plugin registration, settings, and dialogs.
class Element {
    constructor(tag = 'div', options = {}) { this.tag = tag; this.text = options.text || ''; this.children = []; this.settings = []; }
    empty() { this.children = []; this.settings = []; }
    createEl(tag, options) { const el = new Element(tag, options); this.children.push(el); return el; }
    createDiv(options) { return this.createEl('div', options); }
    createSpan(options) { return this.createEl('span', options); }
    addClass() {}
    setAttribute() {}
    setText(text) { this.text = text; }
    appendText(text) { this.text += text; }
    append(text) { this.text += text; }
}
class Control {
    constructor() { this.inputEl = new Element('input'); this.options = {}; }
    setValue(value) { this.value = value; return this; }
    setPlaceholder() { return this; }
    then(callback) { callback(this); return this; }
    setButtonText(text) { this.text = text; return this; }
    setIcon() { return this; }
    setTooltip() { return this; }
    setCta() { return this; }
    setDisabled() { return this; }
    setDestructive() { return this; }
    addOption(key, label) { this.options[key] = label; return this; }
    onChange(fn) { this.change = fn; return this; }
    onClick(fn) { this.click = fn; return this; }
}
class Setting {
    constructor(el) { this.controls = []; el.settings.push(this); }
    setName(name) { this.name = name; return this; }
    setDesc(desc) { this.description = desc; return this; }
    setHeading() { this.heading = true; return this; }
    addControl(fn) { const control = new Control(); this.controls.push(control); fn(control); return this; }
    addToggle(fn) { return this.addControl(fn); }
    addText(fn) { return this.addControl(fn); }
    addTextArea(fn) { return this.addControl(fn); }
    addDropdown(fn) { return this.addControl(fn); }
    addButton(fn) { return this.addControl(fn); }
    addExtraButton(fn) { return this.addControl(fn); }
}
class Menu {
    constructor() { this.items = []; }
    addItem(fn) {
        const item = { setTitle(title) { this.title = title; return this; }, setIcon() { return this; },
            setSubmenu() { this.submenu = new Menu(); return this.submenu; }, onClick(fn) { this.click = fn; return this; } };
        this.items.push(item); fn(item); return this;
    }
}
class TFile { constructor(path) { this.path = path; this.name = path.split('/').pop(); this.extension = 'md'; } }
class TFolder { constructor(path) { this.path = path; this.name = path.split('/').pop(); this.children = []; } }
const opened = [];
class Modal {
    constructor(app) { this.app = app; this.contentEl = new Element(); }
    open() { opened.push(this); }
    close() { this.closed = true; }
}
class Plugin {
    constructor(app) { this.app = app; this.commands = []; this.views = []; this.ribbons = []; this.manifest = { version: '0.0.37' }; this.saves = 0; }
    async loadData() { return this.saved; }
    async saveData(data) { this.saved = structuredClone(data); this.saves++; }
    addCommand(command) { this.commands.push(command); }
    addSettingTab(tab) { this.tab = tab; }
    registerEvent() {}
    registerView(...args) { this.views.push(args); }
    addRibbonIcon(...args) { this.ribbons.push(args); }
}
class ItemView { constructor(leaf) { this.leaf = leaf; this.contentEl = new Element(); } }
class PluginSettingTab { constructor(app) { this.app = app; this.containerEl = new Element(); } }
const obsidian = { ItemView, Plugin, PluginSettingTab, Modal, Setting, Menu, TFile, TFolder, Notice: class {}, normalizePath: p => p, requestUrl: async () => ({ json: { models: [] } }) };
const cache = new Map();
function load(file) {
    if (!cache.has(file)) {
        const code = buildSync({ entryPoints: [path.join(__dirname, '..', file)], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['obsidian'] }).outputFiles[0].text;
        const exports = {};
        const context = { module: { exports }, exports, console, AbortController, createFragment: () => new Element(), require: id => id === 'obsidian' ? obsidian : require(id) };
        vm.runInNewContext(code, context); cache.set(file, context.module.exports);
    }
    return cache.get(file);
}
async function fixture(saved) {
    const handlers = {};
    const app = { vault: {}, workspace: { onLayoutReady: () => {}, on: (event, callback) => { handlers[event] = callback; }, getActiveFile: () => new TFile('notes/example.md') } };
    const plugin = new (load('main.ts').default)(app); plugin.saved = saved; await plugin.onload();
    return { plugin, app, handlers };
}

test('editor, file, and folder menus use one submenu; censor precedes distill', async () => {
    const { plugin, handlers } = await fixture();
    for (const target of [new TFile('note.md'), new TFolder('notes')]) {
        const menu = new Menu(); handlers['file-menu'](menu, target);
        assert.equal(menu.items.length, 1); assert.equal(menu.items[0].title, 'Coherence Wizard');
        const items = menu.items[0].submenu.items, titles = items.map(item => item.title);
        assert.ok(titles.indexOf('Censor / alias') < titles.indexOf('Distill'));
        assert.equal(titles.includes('Smart move'), target instanceof TFolder);
        for (const item of items) { item.click(); const modal = opened.at(-1); assert.ok(Object.values(modal).includes(target), item.title + ' must retain its target'); }
    }
    const editorMenu = new Menu(); handlers['editor-menu'](editorMenu, {}, { file: new TFile('note.md') });
    assert.equal(editorMenu.items.length, 1);
    const emptyMenu = new Menu(); handlers['editor-menu'](emptyMenu, {}, { file: null }); assert.equal(emptyMenu.items.length, 0);
    for (const key of Object.keys(plugin.settings).filter(key => key.startsWith('contextMenu'))) plugin.settings[key] = false;
    const hidden = new Menu(); handlers['file-menu'](hidden, new TFolder('notes')); assert.equal(hidden.items.length, 0);
});

test('upgrade resets recursive settings once, preserving dictionaries and subsequent opt-ins', async () => {
    const { plugin } = await fixture();
    const recursiveKeys = Object.keys(plugin.settings).filter(key => key.endsWith('Recursive'));
    assert.ok(recursiveKeys.length >= 10);
    for (const key of recursiveKeys) assert.equal(plugin.settings[key], false, key);
    const old = { ...plugin.settings, recursiveDefaultsVersion: undefined, censorDictionaries: [{ name: 'Personal', content: 'Example = Alias' }] };
    for (const key of recursiveKeys) old[key] = true;
    const upgraded = (await fixture(old)).plugin;
    for (const key of recursiveKeys) assert.equal(upgraded.settings[key], false, key);
    assert.deepEqual(upgraded.saved.censorDictionaries, old.censorDictionaries);
    upgraded.settings.yamlRecursive = true; await upgraded.saveSettings();
    const reloaded = (await fixture(upgraded.saved)).plugin;
    assert.equal(reloaded.settings.yamlRecursive, true); assert.equal(reloaded.saves, 0);
});

test('one-click dashboard is not registered; individual commands remain', async () => {
    const { plugin } = await fixture();
    assert.deepEqual(plugin.views.map(view => view[0]), ['coherence-summarization-progress']); assert.equal(plugin.ribbons.length, 0);
    assert.ok(plugin.commands.length > 8);
    assert.ok(!plugin.commands.some(command => /wizard|dashboard/.test(command.id)));
});

test('all settings tabs render; censor is separate and before distill', async () => {
    const { plugin } = await fixture(); const tab = plugin.tab;
    tab.render();
    const tabs = tab.containerEl.children[0].children.map(el => el.text);
    assert.equal(tabs[tabs.indexOf('Distill') - 1], 'Censor');
    assert.ok(!tabs.includes('Coherence wizard'));
    for (const activeTab of ['about', 'connection', 'contextmenu', 'datefix', 'merge', 'atomizer', 'yaml', 'summarizer', 'categorizer', 'parsemove', 'censor', 'distill', 'rating']) {
        tab.activeTab = activeTab; tab.render();
        assert.ok(!tab.containerEl.children.some(el => el.text.includes('Error rendering')), activeTab);
        assert.ok(tab.containerEl.children.some(el => el.tag === 'p' || el.children.length > 0), activeTab);
    }
    tab.activeTab = 'censor'; tab.render();
    assert.ok(tab.containerEl.settings.some(setting => setting.name === 'Active dictionary'));
    assert.ok(!tab.containerEl.settings.some(setting => setting.name === 'System prompt'));
    tab.activeTab = 'distill'; tab.render();
    assert.ok(tab.containerEl.settings.some(setting => setting.name === 'System prompt'));
    assert.ok(!tab.containerEl.settings.some(setting => setting.name === 'Active dictionary'));
});

test('recursive dialog defaults are off and saved opt-ins reach every configurable dialog', async () => {
    const { plugin, app } = await fixture(); const folder = new TFolder('notes');
    const cases = [
        ['yaml-template', 'YamlTemplateModal', 'yamlRecursive'], ['date-fix', 'DateFixModal', 'dateFixRecursive'],
        ['chrono-merge', 'ChronoMergeModal', 'chronoMergeRecursive'], ['parse-and-move', 'ParseAndMoveModal', 'parseAndMoveRecursive'],
        ['censor', 'CensorModal', 'censorRecursive'], ['generalizer', 'GeneralizerModal', 'generalizerRecursive'],
        ['concatonizer', 'ConcatonizerModal', 'concatonizerRecursive'], ['wisdom', 'WisdomModal', 'wisdomRecursive'],
    ];
    for (const [name, cls, key] of cases) {
        const ModalClass = load(`src/ui/${name}-modal.ts`)[cls];
        assert.equal(new ModalClass(app, plugin.settings, folder).recursive, false, name);
        assert.equal(new ModalClass(app, { ...plugin.settings, [key]: true }, folder).recursive, true, name);
    }
    const { SummarizerModal } = load('src/ui/summarizer-modal.ts');
    assert.equal(new SummarizerModal(app, plugin.settings, async () => {}, folder).recursive, false);
    assert.equal(new SummarizerModal(app, { ...plugin.settings, summarizerRecursive: true }, async () => {}, folder).recursive, true);
    const { DeduplicationModal } = load('src/ui/deduplication-modal.ts');
    assert.equal(new DeduplicationModal(app, folder).recursive, false);
    assert.equal(new DeduplicationModal(app, folder, true).recursive, true);
    for (const [name, cls, args] of [['smart-move', 'SmartMoveModal', [app, folder]], ['categorizer', 'CategorizerModal', [app, plugin.settings, folder]], ['rating', 'RatingModal', [app, plugin.settings, async () => {}, folder]]]) {
        assert.equal(new (load(`src/ui/${name}-modal.ts`)[cls])(...args).recursive, false, name);
    }
});

test('distill offers generalize and wisdom without censor; each launches the selected tool', async () => {
    const { plugin, app } = await fixture(); const folder = new TFolder('notes');
    const { DistillModal } = load('src/ui/distill-modal.ts');
    const modal = new DistillModal(app, plugin.settings, folder); modal.display();
    const dropdown = modal.contentEl.settings.find(setting => setting.name === 'Select tool').controls[0];
    assert.deepEqual(Object.keys(dropdown.options).sort(), ['generalize', 'wisdom']);
    assert.equal(dropdown.value, 'generalize');
    const button = modal.contentEl.settings.at(-1).controls[0];
    button.click(); assert.equal(opened.at(-1).constructor.name, 'GeneralizerModal');
    dropdown.change('wisdom'); button.click(); assert.equal(opened.at(-1).constructor.name, 'WisdomModal');
});

test('starting a summary reveals the right pane and closes setup without waiting for the batch', async () => {
    const { plugin, app, handlers } = await fixture();
    const target = new TFolder('notes'), states = [], revealed = [];
    const leaf = { setViewState: async state => states.push(state) };
    app.vault.getAbstractFileByPath = () => target;
    app.workspace.getLeavesOfType = () => [];
    app.workspace.getRightLeaf = split => { assert.equal(split, false); return leaf; };
    app.workspace.revealLeaf = async item => revealed.push(item);
    let request;
    plugin.summarizationJob = { start: value => { request = value; return true; }, completion: new Promise(() => {}) };
    const menu = new Menu(); handlers['file-menu'](menu, target);
    menu.items[0].submenu.items.find(item => item.title === 'Summarize').click();
    const modal = opened.at(-1); modal.display();
    const mode = modal.contentEl.settings.find(setting => setting.name === 'Summary mode').controls[0];
    mode.change('one-shot');
    const thinking = modal.contentEl.settings.find(setting => setting.name === 'Disable thinking').controls[0];
    assert.equal(thinking.value, true); thinking.change(false);
    const start = modal.contentEl.settings.at(-1).controls[0];
    await start.click();
    assert.equal(request.disableThinking, false);
    assert.equal(plugin.settings.summarizerDisableThinking, true);
    assert.equal(modal.closed, true); assert.equal(request.oneShot, true); assert.equal(request.prompts.length, 1);
    assert.equal(states[0].type, 'coherence-summarization-progress'); assert.equal(states[0].active, false);
    assert.equal(revealed[0], leaf);
});

test('sidebar displays completed batch progress and exactly one stop action', async () => {
    const { plugin } = await fixture();
    let stops = 0, unsubscribed = false;
    plugin.summarizationJob = {
        state: { ...plugin.summarizationJob.state, status: 'running', total: 8, completed: 3, saved: 2, skipped: 1, model: 'test-model' },
        stop: () => { stops++; },
        subscribe: callback => { callback(); return () => { unsubscribed = true; }; },
    };
    const view = plugin.views[0][1]({}); await view.onOpen();
    const progress = view.contentEl.children.find(element => element.tag === 'progress');
    assert.equal(progress.max, 8); assert.equal(progress.value, 3);
    const buttons = view.contentEl.settings.flatMap(setting => setting.controls).filter(control => control.text);
    assert.deepEqual(buttons.map(button => button.text), ['Stop']); buttons[0].click(); assert.equal(stops, 1);
    await view.onClose(); assert.equal(unsubscribed, true); assert.equal(stops, 1);
});

test('recursive settings no longer change the independent title-generation setting', async () => {
    const { plugin } = await fixture();
    plugin.settings.summarizerGenerateTitle = false;
    plugin.tab.activeTab = 'summarizer'; plugin.tab.render();
    const toggle = plugin.tab.containerEl.settings.find(setting => setting.name === 'Recursive processing').controls[0];
    await toggle.change(true);
    assert.equal(plugin.settings.summarizerRecursive, true);
    assert.equal(plugin.settings.summarizerGenerateTitle, false);
});

test('one-shot becomes the default on upgrade, then later mode choices are retained', async () => {
    const { plugin } = await fixture({ summarizerMode: 'multi-stage' });
    assert.equal(plugin.settings.summarizerMode, 'one-shot');
    plugin.settings.summarizerMode = 'multi-stage'; await plugin.saveSettings();
    const again = (await fixture(plugin.saved)).plugin;
    assert.equal(again.settings.summarizerMode, 'multi-stage'); assert.equal(again.saves, 0);
});

test('restored progress outside the right sidebar is replaced there without stopping the job', async () => {
    const { plugin, app } = await fixture(); const rightRoot = {}, leftRoot = {};
    let detached = 0, created = 0, revealed;
    const old = { getRoot: () => leftRoot, detach: () => detached++ };
    const right = { getRoot: () => rightRoot, setViewState: async state => assert.equal(state.type, 'coherence-summarization-progress') };
    app.workspace.rightSplit = rightRoot;
    app.workspace.getLeavesOfType = () => [old];
    app.workspace.getRightLeaf = () => { created++; return right; };
    app.workspace.revealLeaf = async leaf => revealed = leaf;
    const job = plugin.summarizationJob;
    await plugin.showSummarizationProgress();
    assert.equal(detached, 1); assert.equal(created, 1); assert.equal(revealed, right); assert.equal(plugin.summarizationJob, job);
    app.workspace.getLeavesOfType = () => [right];
    await plugin.showSummarizationProgress(); assert.equal(created, 1);
});

test('Unsloth provider reaches all AI tool dialogs and shared model selection', async () => {
    const { plugin, app } = await fixture({ aiProvider: 'unsloth', openaiBaseUrl: 'http://localhost:8888/v1', openaiApiKey: 'test-key' });
    const folder = new TFolder('notes');
    for (const [file, cls, args, access] of [
        ['summarizer', 'SummarizerModal', [app, plugin.settings, async () => {}, folder, async () => true], modal => modal.ollama],
        ['wisdom', 'WisdomModal', [app, plugin.settings, folder], modal => modal.ollama],
        ['rating', 'RatingModal', [app, plugin.settings, async () => {}, folder], modal => modal.ollama],
        ['categorizer', 'CategorizerModal', [app, plugin.settings, folder], modal => modal.service.ollama],
        ['generalizer', 'GeneralizerModal', [app, plugin.settings, folder], modal => modal.service.ollama],
    ]) {
        const modal = new (load(`src/ui/${file}-modal.ts`)[cls])(...args);
        assert.equal(access(modal).constructor.name, 'OpenAICompatibleService', file);
    }
    plugin.tab.activeTab = 'connection'; plugin.tab.render();
    const key = plugin.tab.containerEl.settings.find(setting => setting.name === 'API key').controls[0];
    assert.equal(key.inputEl.type, 'password');
    await plugin.tab.setSharedModel('example/model:quant');
    for (const name of ['summarizerModel', 'wisdomModel', 'ratingModel', 'categorizerModel', 'generalizerModel']) assert.equal(plugin.settings[name], 'example/model:quant');
});

test('disable-thinking default is visible, saved, and preserved on reload', async () => {
    const { plugin } = await fixture();
    assert.equal(plugin.settings.summarizerDisableThinking, true);
    plugin.tab.activeTab = 'summarizer'; plugin.tab.render();
    const control = plugin.tab.containerEl.settings.find(setting => setting.name === 'Disable thinking').controls[0];
    assert.equal(control.value, true);
    await control.change(false);
    const reloaded = await fixture(plugin.saved);
    assert.equal(reloaded.plugin.settings.summarizerDisableThinking, false);
});

test('optional short summary defaults off, persists in settings, and supports a batch override', async () => {
    const { plugin, app } = await fixture();
    assert.equal(plugin.settings.summarizerAddShortSummary, false);
    plugin.tab.activeTab = 'summarizer'; plugin.tab.render();
    const control = plugin.tab.containerEl.settings.find(setting => setting.name === 'Add short summary').controls[0];
    assert.equal(control.value, false); await control.change(true);
    const reloaded = await fixture(plugin.saved); assert.equal(reloaded.plugin.settings.summarizerAddShortSummary, true);
    const target = new TFolder('notes'); app.vault.getAbstractFileByPath = () => target;
    let request;
    const modal = new (load('src/ui/summarizer-modal.ts').SummarizerModal)(app, plugin.settings, async () => {}, target, async value => { request = value; return true; });
    modal.display();
    const toggle = modal.contentEl.settings.find(setting => setting.name === 'Add short summary').controls[0];
    assert.equal(toggle.value, true); toggle.change(false);
    await modal.contentEl.settings.at(-1).controls[0].click();
    assert.equal(request.addShortSummary, false); assert.equal(plugin.settings.summarizerAddShortSummary, true);
});

test('one-shot hides multi-stage prompts and title controls, retaining them when switched back', async () => {
    const { plugin, app } = await fixture();
    plugin.tab.activeTab = 'summarizer'; plugin.tab.render();
    const names = () => plugin.tab.containerEl.settings.map(setting => setting.name);
    assert.ok(!names().includes('Prompt 1 (general summary)')); assert.ok(!names().includes('Generate titles in multi-stage mode'));
    const original = plugin.settings.summarizerPrompt2;
    await plugin.tab.containerEl.settings.find(setting => setting.name === 'Default summary mode').controls[0].change('multi-stage');
    assert.ok(names().includes('Prompt 1 (general summary)')); assert.ok(names().includes('Generate titles in multi-stage mode'));
    assert.equal(plugin.settings.summarizerPrompt2, original);
    const modal = new (load('src/ui/summarizer-modal.ts').SummarizerModal)(app, plugin.settings, async () => {}, new TFolder('notes'), async () => true);
    modal.display(); assert.ok(modal.contentEl.settings.some(setting => setting.name === 'Generate title for untitled'));
    modal.contentEl.settings.find(setting => setting.name === 'Summary mode').controls[0].change('one-shot');
    assert.ok(!modal.contentEl.settings.some(setting => setting.name === 'Generate title for untitled'));
    modal.contentEl.settings.find(setting => setting.name === 'Summary mode').controls[0].change('multi-stage');
    assert.ok(modal.contentEl.settings.some(setting => setting.name === 'Generate title for untitled'));
});

test('word limits persist, invalid input cannot start, and batch overrides reach the job', async () => {
    const { plugin, app } = await fixture(); plugin.tab.activeTab = 'summarizer'; plugin.tab.render();
    const main = plugin.tab.containerEl.settings.find(setting => setting.name === 'Main summary maximum words').controls[0];
    const short = plugin.tab.containerEl.settings.find(setting => setting.name === 'Short summary maximum words').controls[0];
    assert.equal(main.value, '50'); assert.equal(short.value, '10');
    await main.change('75'); await short.change('15'); await main.change('0');
    const reloaded = await fixture(plugin.saved); assert.equal(reloaded.plugin.settings.summarizerMainMaxWords, 75); assert.equal(reloaded.plugin.settings.summarizerShortMaxWords, 15);
    const target = new TFolder('notes'); app.vault.getAbstractFileByPath = () => target; let request;
    const modal = new (load('src/ui/summarizer-modal.ts').SummarizerModal)(app, plugin.settings, async () => {}, target, async value => { request = value; return true; });
    modal.display(); const input = modal.contentEl.settings.find(setting => setting.name === 'Main summary maximum words').controls[0];
    input.change('1.5'); await modal.contentEl.settings.at(-1).controls[0].click(); assert.equal(request, undefined);
    input.change('25'); await modal.contentEl.settings.at(-1).controls[0].click();
    assert.equal(request.mainMaxWords, 25); assert.equal(request.shortMaxWords, 15); assert.equal(request.generateTitle, false); assert.equal(plugin.settings.summarizerMainMaxWords, 75);
});

test('completed right-pane batches list every failed note and reason after reopening', async () => {
    const { plugin } = await fixture();
    plugin.summarizationJob.state = { ...plugin.summarizationJob.state, status: 'completed', total: 3, completed: 3, errors: 2, failures: [
        { path: 'notes/First.md', reason: 'Server unavailable' }, { path: 'notes/Second.md', reason: 'summary_short exceeds limit' },
    ] };
    for (let i = 0; i < 2; i++) {
        const view = plugin.views[0][1]({}); await view.onOpen();
        const list = view.contentEl.children.find(element => element.tag === 'ul');
        assert.equal(list.children.length, 2);
        assert.equal(list.children[0].children[0].text, 'notes/First.md'); assert.equal(list.children[0].children[1].text, 'Server unavailable');
        assert.equal(list.children[1].children[0].text, 'notes/Second.md'); assert.equal(list.children[1].children[1].text, 'summary_short exceeds limit');
        await view.onClose();
    }
});
