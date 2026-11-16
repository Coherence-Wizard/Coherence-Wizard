const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const vm = require('node:vm');
const path = require('node:path');
const http = require('node:http');
class TFolder { constructor(path) { this.path = path; this.children = []; } }
class TFile {
    constructor(path, parent) { this.path = path; this.parent = parent; this.name = path.split('/').pop(); this.basename = this.name.replace(/\.md$/, ''); this.extension = 'md'; }
}
class MarkdownView {}
const obsidian = {
    TFile, TFolder, MarkdownView, normalizePath: p => p.replace(/^\/+/, ''),
    parseYaml: text => JSON.parse(text), stringifyYaml: value => JSON.stringify(value) + '\n',
    requestUrl: () => { throw new Error('Cancellable jobs must not use the non-abortable transport'); },
};
const cache = new Map();
function load(name) {
    if (cache.has(name)) return cache.get(name);
    const code = buildSync({ entryPoints: [path.join(__dirname, `../src/modules/${name}.ts`)], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['obsidian'] }).outputFiles[0].text;
    const exports = {};
    const context = { exports, module: { exports }, console, URL, Buffer, AbortController, require: id => id === 'obsidian' ? obsidian : require(id) };
    vm.runInNewContext(code, context);
    cache.set(name, context.module.exports); return context.module.exports;
}
function fixture() {
    const folder = new TFolder('notes'), contents = new Map(), writes = [], renamed = [], entries = new Map([[folder.path, folder]]);
    const add = (name, content = 'Useful ideas from the original note.', parent = folder) => {
        const file = new TFile(`${parent.path}/${name}`, parent); parent.children.push(file); contents.set(file, content); entries.set(file.path, file); return file;
    };
    const app = { workspace: { getLeavesOfType: () => [] }, vault: {
        read: async file => contents.get(file),
        process: async (file, transform) => { const updated = transform(contents.get(file)); contents.set(file, updated); writes.push(file); return updated; },
        getAbstractFileByPath: name => entries.get(name),
        adapter: { exists: async () => false },
    }, fileManager: { renameFile: async (file, name) => renamed.push(name) } };
    return { folder, contents, writes, renamed, app, add };
}
function config(target, extra = {}) { return { target, ollamaUrl: 'http://example.invalid', model: 'test-model', recursive: false, overwrite: false, prompts: ['{text}'], generateTitle: false, oneShot: true, maxChars: 50000, includeYaml: false, ...extra }; }
function deferred() { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }
async function until(predicate) { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setImmediate(resolve)); } throw new Error('Condition not reached'); }
function abortableWait(signal) { return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); }
function summaryOf(f, file) { return JSON.parse(f.contents.get(file).split('\n')[1]).summary; }

test('one-shot makes one request even for untitled notes, removes a preamble, and caps output at 50 words', async () => {
    const f = fixture(), file = f.add('Untitled.md'); const calls = [];
    const ollama = { generate: async (...args) => { calls.push(args); return 'Here is a concise summary: ' + Array.from({ length: 70 }, (_, i) => `word${i}`).join(' '); } };
    await new (load('summarizer').SummarizerService)(f.app, ollama).summarizeFile(file, 'test', false, [load('summarizer').ONE_SHOT_SUMMARY_PROMPT], true, { oneShot: true });
    assert.equal(calls.length, 1); assert.equal(f.renamed.length, 0);
    assert.equal(summaryOf(f, file).split(/\s+/).length, 50);
    assert.ok(summaryOf(f, file).startsWith('word0'));
    assert.ok(calls[0][1].includes('at most 50 words'));
    assert.ok(f.contents.get(file).endsWith('Useful ideas from the original note.'));
});

test('multi-stage prompts retain their ordering, placeholders, and output length', async () => {
    const f = fixture(), file = f.add('Planning.md', 'Budget is $& and $1.'); const calls = [];
    const long = Array.from({ length: 65 }, () => 'word').join(' ');
    const ollama = { generate: async (_model, prompt) => { calls.push(prompt); return calls.length === 1 ? 'First pass' : long; } };
    await new (load('summarizer').SummarizerService)(f.app, ollama).summarizeFile(file, 'test', false, ['First: {text}', 'Next: {summary} / {filename}']);
    assert.deepEqual(calls, ['First: Budget is $& and $1.', 'Next: First pass / Planning']);
    assert.equal(summaryOf(f, file), long);
});

test('background generation never overwrites edits made while a request is running', async () => {
    const f = fixture(), file = f.add('Editing.md'); const pending = deferred();
    const service = new (load('summarizer').SummarizerService)(f.app, { generate: () => pending.promise });
    const task = service.summarizeFile(file, 'test');
    f.contents.set(file, 'New user edits.'); pending.resolve('Summary of stale text.');
    await assert.rejects(task, /Note changed during summarization/);
    assert.equal(f.contents.get(file), 'New user edits.'); assert.equal(f.writes.length, 0);
});

test('cancellation after generation and before saving leaves the current note unchanged', async () => {
    const f = fixture(), file = f.add('Keep.md'), controller = new AbortController();
    const service = new (load('summarizer').SummarizerService)(f.app, { generate: async () => { controller.abort(); return 'Not saved'; } });
    await assert.rejects(service.summarizeFile(file, 'test', false, [], false, { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(f.writes.length, 0);
});

test('completed batch counts saved, skipped, and failed notes, and automatically unloads exactly once', async () => {
    const f = fixture(); f.add('Saved.md'); f.add('Skipped.md', '---\n{"summary":"Existing"}\n---\nBody'); f.add('Failed.md', 'Fail this');
    let unloads = 0;
    const fake = { generate: async (_model, prompt) => { if (prompt.includes('Fail this')) throw new Error('model failure'); return 'Useful summary.'; }, unloadModel: async () => { unloads++; } };
    const job = new (load('summarization-job').SummarizationJob)(f.app, () => fake), states = [];
    job.subscribe(() => states.push({ ...job.state }));
    assert.equal(job.start(config(f.folder)), true); await job.completion;
    assert.equal(job.state.total, 3); assert.equal(job.state.completed, 3);
    assert.equal(job.state.saved, 1); assert.equal(job.state.skipped, 1); assert.equal(job.state.errors, 1);
    assert.equal(job.state.status, 'completed'); assert.equal(unloads, 1); assert.equal(job.state.modelStatus, 'Model unloaded.'); assert.equal(job.busy, false);
    assert.ok(states.some(state => state.completed === 0 && state.currentFile));
});

test('single stop aborts the current note, keeps completed summaries, skips remaining notes, and unloads', async () => {
    const f = fixture(); const first = f.add('First.md'); const second = f.add('Second.md'); f.add('Third.md'); let calls = 0, unloads = 0;
    const fake = { generate: async (_model, _prompt, _options, signal) => { calls++; return calls === 1 ? 'Saved first.' : abortableWait(signal); }, unloadModel: async () => { unloads++; } };
    const job = new (load('summarization-job').SummarizationJob)(f.app, () => fake);
    job.start(config(f.folder)); await until(() => calls === 2);
    assert.equal(job.state.completed, 1); assert.equal(job.start(config(f.folder)), false);
    job.stop(); job.stop(); await job.completion;
    assert.equal(job.state.status, 'stopped'); assert.equal(job.state.saved, 1); assert.equal(job.state.completed, 1);
    assert.equal(summaryOf(f, first), 'Saved first.'); assert.equal(f.contents.get(second), 'Useful ideas from the original note.');
    assert.equal(calls, 2); assert.equal(unloads, 1); assert.equal(job.state.errors, 0);
});

test('a new batch waits for automatic unloading; unload errors are shown without losing results', async () => {
    const f = fixture(); f.add('One.md'); const unloading = deferred();
    const fake = { generate: async () => 'Summary.', unloadModel: () => unloading.promise };
    const job = new (load('summarization-job').SummarizationJob)(f.app, () => fake);
    job.start(config(f.folder)); await until(() => job.state.unloading);
    assert.equal(job.busy, true); assert.equal(job.start(config(f.folder)), false);
    unloading.reject(new Error('server unavailable')); await job.completion;
    assert.match(job.state.modelStatus, /Unload failed.*server unavailable/); assert.equal(job.state.saved, 1); assert.equal(job.busy, false);
});

test('closing a sidebar subscription does not stop the job, but disabling the plugin does and unloads', async () => {
    const f = fixture(); f.add('One.md'); let calls = 0, unloads = 0;
    const fake = { generate: async (_m, _p, _o, signal) => { calls++; return abortableWait(signal); }, unloadModel: async () => { unloads++; } };
    const job = new (load('summarization-job').SummarizationJob)(f.app, () => fake);
    const unsubscribe = job.subscribe(() => {}); job.start(config(f.folder)); await until(() => calls === 1);
    unsubscribe(); assert.equal(job.state.status, 'running');
    job.dispose(); await job.completion;
    assert.equal(job.state.status, 'stopped'); assert.equal(unloads, 1); assert.equal(job.start(config(f.folder)), false);
});

test('empty folders and nonrecursive runs finish accurately and unload automatically', async () => {
    const f = fixture(); const nested = new TFolder('notes/nested'); f.folder.children.push(nested); f.add('Deep.md', 'Nested', nested);
    let calls = 0, unloads = 0;
    const fake = { generate: async () => { calls++; return 'Summary.'; }, unloadModel: async () => { unloads++; } };
    const job = new (load('summarization-job').SummarizationJob)(f.app, () => fake);
    job.start(config(f.folder)); await job.completion;
    assert.equal(job.state.total, 0); assert.equal(job.state.status, 'completed'); assert.equal(calls, 0); assert.equal(unloads, 1);
    job.start(config(f.folder, { recursive: true })); await job.completion;
    assert.equal(job.state.total, 1); assert.equal(job.state.saved, 1); assert.equal(calls, 1); assert.equal(unloads, 2);
});

test('desktop Ollama transport cancels a real pending HTTP request and sends the unload protocol', async () => {
    const received = [], generationReceived = deferred(), disconnected = deferred();
    const server = http.createServer((req, res) => {
        let body = ''; req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const json = JSON.parse(body); received.push(json);
            if (json.keep_alive === 0) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ done: true, done_reason: 'unload' })); }
            else { res.on('close', () => disconnected.resolve()); generationReceived.resolve(); }
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const ollama = new (load('ollama').OllamaService)(`http://127.0.0.1:${server.address().port}`);
        const controller = new AbortController();
        const task = ollama.generate('test-model', 'Note', undefined, controller.signal);
        const rejected = assert.rejects(task, { name: 'AbortError' });
        await generationReceived.promise; controller.abort(); await rejected; await disconnected.promise;
        await ollama.unloadModel('test-model');
        assert.equal(received.length, 2); assert.equal(received[0].stream, false);
        assert.deepEqual(received[1], { model: 'test-model', stream: false, keep_alive: 0 });
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});


test('unsaved editor changes are protected even before Obsidian writes them to disk', async () => {
    const f = fixture(), file = f.add('Unsaved.md');
    const view = new MarkdownView(); view.file = file; view.getMode = () => 'source'; view.editor = { getValue: () => 'Still typing unsaved changes' };
    f.app.workspace.getLeavesOfType = () => [{ view }];
    const service = new (load('summarizer').SummarizerService)(f.app, { generate: async () => 'Stale summary.' });
    await assert.rejects(service.summarizeFile(file, 'test'), /Note changed during summarization/);
    assert.equal(f.writes.length, 0);
});
