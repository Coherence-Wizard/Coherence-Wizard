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

test('one-shot makes one request for compliant output, removes a preamble, and preserves all 50 words', async () => {
    const f = fixture(), file = f.add('Untitled.md'); const calls = [];
    const ollama = { generate: async (...args) => { calls.push(args); return 'Here is a concise summary: ' + Array.from({ length: 50 }, (_, i) => `word${i}`).join(' '); } };
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
    await new (load('summarizer').SummarizerService)(f.app, ollama).summarizeFile(file, 'test', false, ['First: {text}', 'Next: {summary} / {filename}'], false, { mainMaxWords: 70 });
    assert.equal(calls.length, 2); assert.equal(calls[0], 'First: Budget is $& and $1. ' + LONG_BODY);
    assert.ok(calls[1].startsWith('Next: First pass / Planning')); assert.match(calls[1], /at most 70 words/);
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

test('short summaries remove dates and timestamp IDs before counting words, preserving source and YAML', async () => {
    for (const oneShot of [false, true]) {
        const f = fixture();
        const words = Array.from({ length: 50 }, (_, i) => `word${i}`).join(' ');
        const body = '**2026-11-16**\n' + words + '\n`2026-11-16_123456` #tag [[backlink]]';
        const file = f.add('Dated.md', '---\n{"date":"2026-11-16","other":"keep"}\n---\n' + body);
        const service = new (load('summarizer').SummarizerService)(f.app, { generate: () => { throw new Error('Short cleaned notes must bypass AI'); } });
        assert.equal(await service.summarizeFile(file, 'test', false, [], false, { oneShot }), true);
        assert.equal(summaryOf(f, file), words);
        assert.equal(JSON.parse(f.contents.get(file).split('\n')[1]).date, '2026-11-16');
        assert.ok(f.contents.get(file).endsWith(body));
        assert.equal(await service.summarizeFile(f.add('Dates only.md', '2026-11-16\n2026-11-16_123456'), 'test'), false);
    }
    const { plainSummaryBody } = load('summary-text');
    assert.equal(plainSummaryBody('Before 2026-11-16 after 2026-11-16_123456 done.'), 'Before after done.');
    assert.equal(plainSummaryBody('id2026-11-16 2026-11-16_1234567 2026-11-16_label'), 'id2026-11-16 2026-11-16_1234567 2026-11-16_label');
});

test('optional short summary adds a second capped field with the same thinking and cancellation options', async () => {
    const f = fixture(), file = f.add('Long.md'), calls = [], signal = new AbortController().signal;
    const normal = 'A clear explanation of how thoughtful planning helps communities make better decisions together.';
    const service = new (load('summarizer').SummarizerService)(f.app, { generate: async (...args) => {
        calls.push(args);
        return calls.length === 1 ? normal : '<think>Hidden reasoning</think>Summary: **Thoughtful** planning|supports resilient communities through shared goals.';
    } });
    await service.summarizeFile(file, 'test', false, [], false, { oneShot: true, addShortSummary: true, disableThinking: true, signal });
    const fm = JSON.parse(f.contents.get(file).split('\n')[1]);
    assert.equal(fm.summary, normal); assert.ok(fm.summary_short.split(/\s+/).length <= 10);
    assert.ok(fm.summary_short.startsWith('Thoughtful planning supports')); assert.ok(!fm.summary_short.includes('think'));
    assert.equal(calls.length, 2); assert.match(calls[1][1], /at most 10 words/); assert.ok(calls[1][1].includes(normal));
    assert.equal(calls[1][2].think, false); assert.equal(calls[1][3], signal);
    assert.equal(f.writes.length, 1); assert.ok(f.contents.get(file).endsWith(LONG_BODY));
});

test('short-summary backfill preserves existing normal summaries, metadata, and existing short fields', async () => {
    const f = fixture(); let calls = 0;
    const original = 'Original summary with more than ten words which must remain exactly unchanged.';
    const file = f.add('Existing.md', '---\n' + JSON.stringify({ summary: original, 'summary model': 'original-model', other: 'keep' }) + '\n---\n' + LONG_BODY);
    const service = new (load('summarizer').SummarizerService)(f.app, { generate: async () => { calls++; return 'Clear shared purpose guides action.'; } });
    assert.equal(await service.summarizeFile(file, 'new-model', false, [], false, { addShortSummary: true, oneShot: true }), true);
    let fm = JSON.parse(f.contents.get(file).split('\n')[1]);
    assert.equal(fm.summary, original); assert.equal(fm['summary model'], 'original-model'); assert.equal(fm.other, 'keep');
    assert.equal(fm.summary_short, 'Clear shared purpose guides action.'); assert.equal(calls, 1);
    assert.equal(await service.summarizeFile(file, 'new-model', false, [], false, { addShortSummary: true }), false);
    assert.equal(calls, 1);
    await service.summarizeFile(file, 'new-model', true, [], false, { addShortSummary: true, oneShot: true });
    fm = JSON.parse(f.contents.get(file).split('\n')[1]);
    assert.equal(fm.summary, 'Clear shared purpose guides action.'); assert.equal(fm.summary_short, fm.summary);
    assert.equal(fm['summary model'], 'new-model'); assert.equal(calls, 2);
    const onlyShort = f.add('Only short.md', '---\n{"summary_short":"Keep existing short"}\n---\nA small note.');
    await service.summarizeFile(onlyShort, 'new-model', false, [], false, { addShortSummary: true });
    assert.equal(JSON.parse(f.contents.get(onlyShort).split('\n')[1]).summary_short, 'Keep existing short');
});

test('short-summary boundary copies up to 10 words and generates at 11; batches unload only after AI use', async () => {
    for (const count of [10, 11]) {
        const f = fixture(), body = Array.from({ length: count }, (_, i) => `word${i}`).join(' '), file = f.add('Short.md', body);
        let calls = 0, unloads = 0;
        const job = new (load('summarization-job').SummarizationJob)(f.app, () => ({
            generate: async () => { calls++; return 'Concise central idea.'; }, unloadModel: async () => { unloads++; },
        }));
        job.start(config(file, { addShortSummary: true })); await job.completion;
        assert.equal(job.state.saved, 1); assert.equal(job.state.errors, 0);
        const fm = JSON.parse(f.contents.get(file).split('\n')[1]);
        assert.equal(fm.summary, body); assert.equal(fm.summary_short, count === 10 ? body : 'Concise central idea.');
        assert.equal(calls, count === 10 ? 0 : 1); assert.equal(unloads, calls);
    }
});

test('short-summary failure, cancellation, or concurrent edits never partially write either field', async () => {
    for (const outcome of ['empty', 'failure', 'cancel', 'edit']) {
        const f = fixture(), file = f.add('Long.md'), controller = new AbortController(); let calls = 0;
        const original = f.contents.get(file);
        const service = new (load('summarizer').SummarizerService)(f.app, { generate: async () => {
            calls++;
            if (calls === 1) return 'This central idea needs more than ten words to be expressed correctly.';
            if (outcome === 'failure') throw new Error('Server failed');
            if (outcome === 'cancel') controller.abort();
            if (outcome === 'edit') f.contents.set(file, 'User changed the note.');
            return outcome === 'empty' ? '<think>Only reasoning</think>' : 'Concise central idea.';
        } });
        await assert.rejects(service.summarizeFile(file, 'test', false, [], false, { addShortSummary: true, oneShot: true, signal: controller.signal }));
        assert.equal(f.writes.length, 0); assert.equal(f.contents.get(file), outcome === 'edit' ? 'User changed the note.' : original);
    }
});

test('short-summary opt-out preserves existing short fields even when replacing the normal summary', async () => {
    const f = fixture(), file = f.add('Short.md', '---\n{"summary":"Old normal","summary_short":"Keep short"}\n---\nNew short body.');
    const service = new (load('summarizer').SummarizerService)(f.app, { generate: () => { throw new Error('No AI'); } });
    await service.summarizeFile(file, '', true, [], false, { addShortSummary: false });
    const fm = JSON.parse(f.contents.get(file).split('\n')[1]);
    assert.equal(fm.summary, 'New short body.'); assert.equal(fm.summary_short, 'Keep short');
});

test('multi-stage mode creates the optional short field from the final summary', async () => {
    const f = fixture(), file = f.add('Stages.md'), prompts = [];
    const final = 'A final summary containing more than ten words describing the central idea clearly.';
    const service = new (load('summarizer').SummarizerService)(f.app, { generate: async (_model, prompt) => {
        prompts.push(prompt); return prompts.length === 1 ? 'First draft' : prompts.length === 2 ? final : 'A clear central idea.';
    } });
    await service.summarizeFile(file, 'test', false, ['First {text}', 'Refine {summary}'], false, { oneShot: false, addShortSummary: true });
    assert.equal(prompts.length, 3); assert.ok(prompts[2].includes(final));
    const fm = JSON.parse(f.contents.get(file).split('\n')[1]);
    assert.equal(fm.summary, final); assert.equal(fm.summary_short, 'A clear central idea.');
});

test('custom word limits reach prompts and control both short-body copy thresholds', async () => {
    const f = fixture(), calls = [];
    const service = new (load('summarizer').SummarizerService)(f.app, { generate: async (_model, prompt) => {
        calls.push(prompt); return calls.length === 1 ? 'Shared purpose creates stronger communities.' : 'Purpose strengthens communities.';
    } });
    const file = f.add('Limits.md', 'one two three four five six seven eight nine');
    await service.summarizeFile(file, 'test', false, [], false, { oneShot: true, addShortSummary: true, mainMaxWords: 8, shortMaxWords: 3 });
    const fm = JSON.parse(f.contents.get(file).split('\n')[1]);
    assert.equal(fm.summary, 'Shared purpose creates stronger communities.'); assert.equal(fm.summary_short, 'Purpose strengthens communities.');
    assert.match(calls[0], /at most 8 words/); assert.match(calls[1], /at most 3 words/);
    const words = Array.from({ length: 60 }, () => 'word').join(' '), copied = f.add('Copy.md', words);
    await service.summarizeFile(copied, '', false, [], false, { oneShot: true, addShortSummary: true, mainMaxWords: 60, shortMaxWords: 60 });
    assert.equal(calls.length, 2); assert.equal(summaryOf(f, copied), words);
    assert.equal(JSON.parse(f.contents.get(copied).split('\n')[1]).summary_short, words);
});

test('overlong summaries are rewritten as complete text instead of sliced at the limit', async () => {
    for (const short of [false, true]) {
        const f = fixture(), file = f.add('Rewrite.md'), calls = [], controller = new AbortController(), stages = [];
        const original = short ? '---\n{"summary":"Thoughtful planning creates stronger communities through shared goals and collective action."}\n---\n' + LONG_BODY : LONG_BODY;
        f.contents.set(file, original);
        const responses = ['Thoughtful planning creates stronger communities through shared goals and collective action.', 'Thoughtful planning strengthens communities.'];
        const service = new (load('summarizer').SummarizerService)(f.app, { generate: async (...args) => { calls.push(args); return responses.shift(); } });
        await service.summarizeFile(file, 'test', false, [], false, { oneShot: true, addShortSummary: short, mainMaxWords: 5, shortMaxWords: 5, disableThinking: true, signal: controller.signal, onStage: stage => stages.push(stage) });
        const fm = JSON.parse(f.contents.get(file).split('\n')[1]);
        assert.equal(fm[short ? 'summary_short' : 'summary'], 'Thoughtful planning strengthens communities.');
        assert.equal(calls.length, 2); assert.match(calls[1][1], /do not truncate a sentence/);
        assert.equal(calls[1][2].think, false); assert.equal(calls[1][3], controller.signal);
        assert.ok(stages.some(stage => stage.includes('Rewriting')));
    }
});

test('repeated overlong responses leave notes unchanged and retain all failure reasons after batch completion', async () => {
    const f = fixture(), first = f.add('Too long.md'), second = f.add('Server error.md'), saved = f.add('Small.md', 'Small note.');
    const originals = new Map(f.contents); let calls = 0, unloads = 0;
    const job = new (load('summarization-job').SummarizationJob)(f.app, () => ({
        generate: async () => { calls++; if (calls <= 3) return 'A response that keeps exceeding the requested word limit.'; throw new Error('Server unavailable'); },
        unloadModel: async () => { unloads++; },
    }));
    job.start(config(f.folder, { mainMaxWords: 3, shortMaxWords: 2 })); await job.completion;
    assert.equal(job.state.status, 'completed'); assert.equal(job.state.errors, 2); assert.equal(job.state.saved, 1);
    assert.equal(job.state.failures.length, 2); assert.equal(job.state.failures[0].path, first.path);
    assert.match(job.state.failures[0].reason, /after 2 rewrite attempts.*maximum 3/);
    assert.equal(job.state.failures[1].path, second.path); assert.match(job.state.failures[1].reason, /Server unavailable/);
    assert.equal(f.contents.get(first), originals.get(first)); assert.equal(f.contents.get(second), originals.get(second));
    assert.equal(unloads, 1); assert.equal(calls, 4);
    job.start(config(saved)); await job.completion; assert.equal(job.state.failures.length, 0);
});

test('stop during a word-limit rewrite aborts and unloads without saving partial results', async () => {
    const f = fixture(), file = f.add('Stop.md'); let calls = 0, unloads = 0;
    const job = new (load('summarization-job').SummarizationJob)(f.app, () => ({
        generate: async (_model, _prompt, _options, signal) => { calls++; return calls === 1 ? 'Too many words for this summary.' : abortableWait(signal); },
        unloadModel: async () => { unloads++; },
    }));
    job.start(config(file, { mainMaxWords: 2 })); await until(() => calls === 2); job.stop(); await job.completion;
    assert.equal(job.state.status, 'stopped'); assert.equal(f.writes.length, 0); assert.equal(unloads, 1); assert.equal(job.state.failures.length, 0);
});

test('invalid limits cannot modify notes or send inference requests', async () => {
    const f = fixture(), file = f.add('Invalid.md');
    const service = new (load('summarizer').SummarizerService)(f.app, { generate: () => { throw new Error('Must not generate'); } });
    for (const value of [0, -1, 1.5, NaN, Infinity, 10001]) {
        await assert.rejects(service.summarizeFile(file, 'test', false, [], false, { mainMaxWords: value }), /whole numbers/);
    }
    assert.equal(f.writes.length, 0);
});
