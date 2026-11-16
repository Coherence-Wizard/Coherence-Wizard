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
const LONG_BODY = 'Detailed useful ideas '.repeat(25) + 'Useful ideas from the original note.';
function fixture() {
    const folder = new TFolder('notes'), contents = new Map(), writes = [], renamed = [], entries = new Map([[folder.path, folder]]);
    const add = (name, content = LONG_BODY, parent = folder) => {
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
    const f = fixture(), file = f.add('Planning.md', 'Budget is $& and $1. ' + LONG_BODY); const calls = [];
    const long = Array.from({ length: 65 }, () => 'word').join(' ');
    const ollama = { generate: async (_model, prompt) => { calls.push(prompt); return calls.length === 1 ? 'First pass' : long; } };
    await new (load('summarizer').SummarizerService)(f.app, ollama).summarizeFile(file, 'test', false, ['First: {text}', 'Next: {summary} / {filename}']);
    assert.deepEqual(calls, ['First: Budget is $& and $1. ' + LONG_BODY, 'Next: First pass / Planning']);
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
    const f = fixture(); f.add('Saved.md'); f.add('Skipped.md', '---\n{"summary":"Existing"}\n---\nBody'); f.add('Failed.md', 'Fail this ' + LONG_BODY);
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
    assert.equal(summaryOf(f, first), 'Saved first.'); assert.equal(f.contents.get(second), LONG_BODY);
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
    const f = fixture(); const nested = new TFolder('notes/nested'); f.folder.children.push(nested); f.add('Deep.md', 'Nested ' + LONG_BODY, nested);
    let calls = 0, unloads = 0;
    const fake = { generate: async () => { calls++; return 'Summary.'; }, unloadModel: async () => { unloads++; } };
    const job = new (load('summarization-job').SummarizationJob)(f.app, () => fake);
    job.start(config(f.folder)); await job.completion;
    assert.equal(job.state.total, 0); assert.equal(job.state.status, 'completed'); assert.equal(calls, 0); assert.equal(unloads, 0);
    job.start(config(f.folder, { recursive: true })); await job.completion;
    assert.equal(job.state.total, 1); assert.equal(job.state.saved, 1); assert.equal(calls, 1); assert.equal(unloads, 1);
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

test('short note bodies become plain summaries without any AI or unload calls in either mode', async () => {
    for (const oneShot of [false, true]) {
        const f = fixture();
        const body = '# Heading\n\n**Clear** _ideas_ with `code` and [a resource](https://example.com).\n- [x] Keep this. #topic/subtag [[Related note|alias]] ![[image.png]]\n%%hidden%%';
        const file = f.add('Untitled.md', '---\n{"tags":["yaml-tag"],"other":"keep me"}\n---\n' + body);
        const fake = { generate: () => { throw new Error('must not generate'); }, unloadModel: () => { throw new Error('must not unload'); } };
        const job = new (load('summarization-job').SummarizationJob)(f.app, () => fake);
        job.start(config(file, { model: '', oneShot, generateTitle: true })); await job.completion;
        assert.equal(job.state.saved, 1); assert.equal(job.state.errors, 0);
        assert.equal(summaryOf(f, file), 'Heading Clear ideas with code and a resource. Keep this.');
        const fm = JSON.parse(f.contents.get(file).split('\n')[1]);
        assert.equal(fm.other, 'keep me'); assert.equal(fm['summary model'], 'Note body (no AI)');
        assert.ok(f.contents.get(file).endsWith(body)); assert.equal(f.renamed.length, 0);
        assert.equal(job.state.modelStatus, 'No model was needed for this batch.');
    }
});

test('the 50-word shortcut counts cleaned body words, excludes YAML, and uses AI starting at 51', async () => {
    for (const count of [49, 50, 51]) {
        const f = fixture(), words = Array.from({ length: count }, (_, i) => `word${i}`).join(' ');
        const file = f.add('Boundary.md', '---\n{"description":"' + LONG_BODY + '"}\n---\n' + words + ' #tag [[backlink]]');
        let calls = 0;
        const service = new (load('summarizer').SummarizerService)(f.app, { generate: async () => { calls++; return 'AI summary.'; } });
        await service.summarizeFile(file, 'test', false, [], false, { oneShot: true });
        assert.equal(calls, count > 50 ? 1 : 0);
        assert.equal(summaryOf(f, file), count > 50 ? 'AI summary.' : words);
    }
});

test('empty or backlink-only bodies do not write empty summaries; overwrite still respects existing summaries', async () => {
    const f = fixture(), service = new (load('summarizer').SummarizerService)(f.app, { generate: () => { throw new Error('No AI'); } });
    assert.equal(await service.summarizeFile(f.add('Empty.md', '#tag [[Link]]'), 'test'), false);
    const file = f.add('Existing.md', '---\n{"summary":"Keep this"}\n---\nShort body.');
    assert.equal(await service.summarizeFile(file, 'test'), false); assert.equal(summaryOf(f, file), 'Keep this');
    assert.equal(await service.summarizeFile(file, 'test', true), true); assert.equal(summaryOf(f, file), 'Short body.');
});

test('OpenAI-compatible API supports auth, exact model IDs, prompts, structured output, and Unsloth unload', async () => {
    const requests = [];
    const server = http.createServer((req, res) => {
        let text = ''; req.on('data', chunk => text += chunk); req.on('end', () => {
            const body = text ? JSON.parse(text) : null; requests.push({ url: req.url, auth: req.headers.authorization, body });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(req.url.endsWith('/models') ? { data: [{ id: 'test/model:Q3' }] }
                : req.url.endsWith('/unload') ? { status: 'unloaded', model: body.model_path }
                    : { choices: [{ message: { content: 'Generated result.' } }] }));
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const service = load('ai-service').createAIService({ aiProvider: 'unsloth', openaiBaseUrl: `http://127.0.0.1:${server.address().port}/v1/`, openaiApiKey: 'test-token' });
        assert.equal((await service.listModels())[0], 'test/model:Q3');
        assert.equal(await service.generate('test/model:Q3', 'Source note', { system: 'System prompt', num_predict: 123 }, new AbortController().signal), 'Generated result.');
        await service.chat('test/model:Q3', [{ role: 'user', content: 'Rate this' }], { type: 'object', properties: {} }, { temperature: 0 });
        await service.unloadModel('test/model:Q3');
        assert.ok(requests.every(request => request.auth === 'Bearer test-token'));
        assert.deepEqual(requests.map(request => request.url), ['/v1/models', '/v1/chat/completions', '/v1/chat/completions', '/v1/unload']);
        assert.deepEqual(requests[1].body.messages, [{ role: 'system', content: 'System prompt' }, { role: 'user', content: 'Source note' }]);
        assert.equal(requests[1].body.model, 'test/model:Q3'); assert.equal(requests[1].body.max_tokens, 123); assert.equal(requests[1].body.stream, false);
        assert.equal(requests[2].body.response_format.type, 'json_schema'); assert.equal(requests[2].body.temperature, 0);
        assert.deepEqual(requests[3].body, { model_path: 'test/model:Q3', force_cancel_active: false });
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('generic compatible endpoints report unsupported unloading without pretending success or making a request', async () => {
    const service = new (load('openai-compatible').OpenAICompatibleService)('http://example.invalid/v1', '', false);
    assert.match(await service.unloadModel('model'), /does not provide model unloading/);
});

test('OpenAI-compatible requests abort and authentication errors do not expose the API key', async () => {
    const received = deferred(), closed = deferred(); let deny = false;
    const server = http.createServer((req, res) => {
        req.resume(); req.on('end', () => {
            if (deny) { res.writeHead(401, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { message: 'Rejected secret-test-token' } })); }
            else { received.resolve(); res.on('close', () => closed.resolve()); }
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const service = new (load('openai-compatible').OpenAICompatibleService)(`http://127.0.0.1:${server.address().port}/v1`, 'secret-test-token');
        const controller = new AbortController();
        const result = assert.rejects(service.generate('model', 'body', undefined, controller.signal), { name: 'AbortError' });
        await received.promise; controller.abort(); await result; await closed.promise;
        deny = true;
        await assert.rejects(service.listModels(), error => { assert.match(error.message, /HTTP 401/); assert.ok(!error.message.includes('secret-test-token')); return true; });
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('short-note cleanup handles nested quotes, callouts, link parentheses, tables, and formatting', () => {
    const clean = load('summary-text').plainSummaryBody;
    assert.equal(clean('## Heading ##\n> > [!note] ***Important*** ~~old~~ ==new==\n[Guide](https://example.com/a_(b)) [Reference][ref]\n[ref]: https://example.com\n<https://example.com>'), 'Heading Important old new Guide Reference https://example.com');
    assert.equal(clean('| Item | Value |\n| --- | --- |\n| **A** | `B` |\n#topic [[Note]] ^block'), 'Item Value A B');
});

test('batch thinking preference reaches every provider request and off restores server defaults', async () => {
    const requests = [];
    const server = http.createServer((req, res) => {
        let text = ''; req.on('data', chunk => text += chunk); req.on('end', () => {
            const body = JSON.parse(text); requests.push({ url: req.url, body });
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(req.url.endsWith('/unload') ? { status: 'unloaded' }
                : req.url === '/api/generate' ? { response: 'A short summary.', done: true }
                    : { choices: [{ message: { content: 'A short summary.' } }] }));
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
        const base = `http://127.0.0.1:${server.address().port}`;
        for (const aiProvider of ['ollama', 'unsloth', 'openai-compatible']) {
            for (const disableThinking of [true, false]) {
                const f = fixture(), file = f.add('Long.md'); requests.length = 0;
                const job = new (load('summarization-job').SummarizationJob)(f.app);
                job.start(config(file, { aiProvider, ollamaUrl: base, openaiBaseUrl: base + '/v1', disableThinking }));
                await job.completion;
                assert.equal(job.state.errors, 0); assert.equal(job.state.saved, 1);
                const generation = requests[0].body;
                assert.equal(summaryOf(f, file), 'A short summary.');
                if (disableThinking) {
                    if (aiProvider === 'ollama') assert.equal(generation.think, false);
                    else if (aiProvider === 'unsloth') {
                        assert.equal(generation.enable_thinking, false);
                        assert.equal('think' in generation, false);
                        assert.equal('chat_template_kwargs' in generation, false);
                    } else assert.deepEqual(generation.chat_template_kwargs, { enable_thinking: false });
                } else {
                    for (const key of ['think', 'enable_thinking', 'chat_template_kwargs']) assert.equal(key in generation, false);
                }
                for (const { body } of requests.slice(1)) {
                    for (const key of ['think', 'enable_thinking', 'chat_template_kwargs']) assert.equal(key in body, false, 'Unload must not inherit generation options');
                }
            }
        }
    } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

test('disable thinking also covers multi-stage generation and titles without changing short-note bypass', async () => {
    const f = fixture(), options = [];
    const service = new (load('summarizer').SummarizerService)(f.app, {
        generate: async (_model, _prompt, config) => { options.push(config); return 'Clear useful summary'; },
    });
    await service.summarizeFile(f.add('Untitled.md'), 'model', false, ['First {text}', 'Next {summary}'], true, { disableThinking: true });
    assert.equal(options.length, 3);
    for (const option of options) assert.equal(option.think, false);
    await service.summarizeFile(f.add('Short.md', 'A short note.'), 'model', false, [], true, { disableThinking: true });
    assert.equal(options.length, 3);
});
