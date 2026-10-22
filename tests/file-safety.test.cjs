const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSync } = require('esbuild');
const vm = require('node:vm');
const path = require('node:path');
class TFile { constructor(path) { this.path = path; this.name = path.split('/').pop(); this.basename = this.name.replace(/\.[^.]+$/, ''); this.extension = 'md'; this.stat = { ctime: 1 }; } }
class TFolder { constructor(path) { this.path = path; this.name = path.split('/').pop(); this.children = []; } }
function load(name) {
 const code = buildSync({ entryPoints: [path.join(__dirname, `../src/modules/${name}.ts`)], bundle: true, write: false, platform: 'node', format: 'cjs', external: ['obsidian'] }).outputFiles[0].text;
 const exports = {};
 const context = { module: { exports }, exports, require: id => { assert.equal(id, 'obsidian'); return { TFile, TFolder, normalizePath: p => p.replace(/^\/+|\/+$/g, ''), Notice: class {} }; } };
 vm.runInNewContext(code, context);
 return context.module.exports;
}
function fixture() {
 const source = new TFolder('source'), target = new TFolder('target');
 const entries = new Map([[source.path, source], [target.path, target]]), moves = [], trashed = [];
 function add(parent, name) { const f = new TFile(`${parent.path}/${name}`); f.parent = parent; parent.children.push(f); entries.set(f.path, f); return f; }
 const app = { vault: { getAbstractFileByPath: p => entries.get(p), createFolder: async p => entries.set(p, new TFolder(p)) }, fileManager: { renameFile: async (f,p) => { assert.ok(!entries.has(p)); entries.delete(f.path); f.parent.children.splice(f.parent.children.indexOf(f),1); f.path=p; entries.set(p,f); moves.push(p); }, trashFile: async f => { trashed.push(f.path); entries.delete(f.path); } } };
 return {source,target,entries,moves,trashed,add,app};
}
test('smart move preserves collisions and moves every member of a live children array', async () => {
 const f=fixture(); f.add(f.source,'one.md'); f.add(f.source,'two.md'); const original=f.add(f.target,'one.md');
 await new (load('smart-move').SmartMoveService)(f.app).moveFiles(f.source,'target');
 assert.deepEqual(f.moves,['target/one 1.md','target/two.md']); assert.equal(f.entries.get('target/one.md'),original); assert.equal(f.trashed.length,0);
});
test('smart move rejects self and nested destinations before mutations', async () => {
 for (const dest of ['source','source/subfolder']) { const f=fixture(); await assert.rejects(new (load('smart-move').SmartMoveService)(f.app).moveFiles(f.source,dest),/outside/); assert.equal(f.moves.length,0); }
});
test('failed merged output leaves all source notes untrashed', async () => {
 const f=fixture(), files=[f.add(f.source,'one.md'),f.add(f.source,'two.md')];
 f.app.vault.create=async()=>{throw new Error('disk full');};
 await assert.rejects(new (load('chrono-merge').ChronoMergeService)(f.app).mergeGroup(files,'merged',true,'content'),/disk full/); assert.deepEqual(f.trashed,[]);
});
test('successful merge saves output before trashing source notes', async () => {
 const f=fixture(), files=[f.add(f.source,'one.md'),f.add(f.source,'two.md')], events=[];
 f.app.vault.create=async()=>{events.push('save');}; f.app.fileManager.trashFile=async()=>{events.push('trash');};
 await new (load('chrono-merge').ChronoMergeService)(f.app).mergeGroup(files,'merged',true,'content');
 assert.deepEqual(events,['save','trash','trash']);
});
