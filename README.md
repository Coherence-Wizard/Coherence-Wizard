# Coherence Wizard

Organize, summarize, split, merge, and refine notes in Obsidian. Coherence Wizard combines bulk file tools with optional AI processing through Ollama, Unsloth, and OpenAI-compatible servers.

## Install

Requires **Obsidian desktop 1.13.0 or later**. Mobile is not supported.

Install from [the Obsidian community directory](https://community.obsidian.md/plugins/coherence-wizard), or search for **Coherence Wizard** in **Settings → Community plugins → Browse**.

For manual installation:

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Coherence-Wizard/Coherence-Wizard/releases/latest), or download and extract `coherence-wizard-0.0.39.zip`.
2. Put those three files in `<your vault>/.obsidian/plugins/coherence-wizard/` (use your configured settings folder if it differs from `.obsidian`).
3. Restart Obsidian, open **Settings → Community plugins**, and enable **Coherence Wizard**.

Back up your vault and try the tools on copied notes before running bulk operations.

## Get started

Open **Settings → Coherence Wizard** to configure the tools. Use the command palette or the **Coherence Wizard** submenu in a note, folder, or editor’s right-click menu to open a tool. Review each dialog's options before running it.

Configure **Settings → Coherence Wizard → AI connection**. This connection is shared by Summarizer, Categorizer, Rating, Generalizer, and Wisdom:

- **Ollama:** run [Ollama](https://ollama.com/) with a downloaded model. The default URL is `http://localhost:11434`.
- **Unsloth · OpenAI compatible:** start Unsloth, enter its API base URL (normally `http://127.0.0.1:8888/v1`) and API key, then click **Refresh models** and select an exact model ID. This preset supports Unsloth’s model-unload endpoint.
- **OpenAI compatible:** enter a server’s API base URL including its prefix (usually `/v1`), plus an API key if required. The plugin uses `/models` and `/chat/completions`, with bearer authentication and cancellable summarization requests.

You can enter a **Model ID** manually if model listing is unavailable. Shared model selection updates all AI tools; individual tool tabs can override it. The plugin does not install servers or models. API keys are masked in settings but saved in the local plugin `data.json`, which should not be shared. File operations and short-note summary copies do not need an AI server.

The example dictionaries and folder names are generic. Replace them with your own categories and aliases in settings. In Parse and Copy, enter lines such as `Work: #work` or `Ideas: #ideas` and select a destination folder. In the censor dictionary, use `Example Name, Example Variant = Alias`.

## Tools

- **Summarizer:** runs in the background with batch progress in the right sidebar. One-shot is the default, with multi-stage prompts still available. Cleaned bodies of 50 words or fewer are copied directly. Stop cancels the batch; Ollama and Unsloth models used by the batch unload automatically.
- **Wisdom and Generalizer:** create rewritten notes using the selected AI provider.
- **Atomizer:** splits notes by headings, dates, or dividers.
- **Categorizer:** adds categories as tags or backlinks, with optional moves and copies.
- **Chrono Merge:** merges related notes, then sends source notes to the configured trash after saving the result.
- **Concatonizer:** combines files into a single document.
- **Parse and Copy:** copies matching content into category folders; repeated runs can append content again.
- **Smart Move:** merges folder contents into a destination. Conflicting file names get a numeric suffix; existing destination files are preserved.
- **Date Fix:** changes filenames to a configured date format.
- **YAML Template:** applies frontmatter keys and ordering.
- **Deduplication:** finds matching files and lets you send selected duplicates to trash.
- **Rating:** writes an AI-generated rating to frontmatter.
- **Censor / Alias:** a separate settings tab and context-menu entry before Distill. Replace dictionary terms with aliases or masking without AI.
- **Distill:** generalize personal notes or extract wisdom using the selected AI provider; wisdom also offers copy-only mode. These tools do not guarantee anonymization; inspect their output before sharing.

**Recursive processing is off by default for every tool.** Only immediate files in the selected folder are processed unless you enable recursion. Upgrading to 0.0.37 resets older saved recursive defaults to off once; later opt-ins are preserved. Smart Move and Wisdom now have explicit recursive toggles. The one-click dashboard, ribbon icon, command, and settings tab have been removed; individual tools remain available.

Some tools modify existing notes or previously generated output. There is no plugin-wide undo or automatic backup. Trash follows Obsidian's configured deletion preference; a failed batch can leave some operations completed.

## Background summarization

Open **Coherence Wizard → Summarize** from a note or folder’s context menu. Choose the model and summary mode, then start. The setup dialog closes and the right sidebar reveals a progress bar showing completed notes out of the batch total, saved/skipped/failed counts, the current note, and the current prompt stage. Obsidian remains usable throughout the run.

- **Stop** cancels the current model request and skips the remaining notes. Ollama and Unsloth models used by the batch are unloaded automatically. Completed summaries are kept; an interrupted summary is not saved.
- Finishing an AI batch automatically unloads its Ollama or Unsloth model without asking. Unload failures appear in the sidebar. Unsloth can refuse unloading when another chat is using the model or the API key lacks permission. Generic OpenAI-compatible APIs have no standard unload operation; the sidebar reports that memory is managed by the server. A batch that only copies short bodies never loads or unloads a model.
- Closing the progress pane does not stop the batch. Reopen it with **Coherence Wizard: Show summarization progress** in the command palette. Only one summarization batch runs at a time.
- Notes changed while generation is running, including unsaved edits in an open editor, are left untouched and reported in the sidebar. Run those notes again when ready.
- **One-shot · 50 words or fewer** is the default for new installations and is set once on upgrading to 0.0.39; later mode choices are preserved. It makes one generation request for each note requiring AI. Its editable prompt asks for direct, elegant prose without introductory phrases. Common preambles are removed and output is capped at 50 words. This mode keeps filenames unchanged to avoid an extra title-generation request.
- Before either mode, the body after YAML is converted to plain text: Markdown formatting, tags, wikilinks/backlinks, embeds, and comments are removed. If the cleaned body has **50 words or fewer**, it is copied into the YAML summary without AI or title generation. Ordinary Markdown links retain their visible text; wikilinks and backlinks are removed entirely. Whitespace is collapsed, the original body and other YAML fields are preserved, and empty bodies are skipped. The existing overwrite setting still applies.
- **Multi-stage prompts** keeps your existing prompts and enabled stages. Set the preferred default mode and edit either prompt approach under **Settings → Coherence Wizard → Summarize**.

The desktop summarizer uses an abortable HTTP connection to the selected provider. Progress views restored outside the right sidebar are recreated on the right without interrupting the plugin-owned batch.

## Privacy and network use

AI requests send note content, filenames included in prompts, instructions, and applicable dictionary text to the **provider endpoint you configure**. Model lists are requested from that endpoint when you refresh models or open a tool’s model chooser. With a local server and local models, processing stays on that computer. A remote server or cloud-backed model can send this data elsewhere; its operator controls handling and retention.

The plugin has no analytics, telemetry, advertising, remote images, account requirement, or paid features. It does not access files outside the vault. Settings and user dictionaries are saved locally in the plugin's `data.json`; do not include that file when sharing the plugin. The release contains generic examples only.

## Build and check

Use Node.js 22 or later:

```sh
npm ci
npm run lint
npm run build
npm test
```

`build` includes TypeScript checking and produces `main.js`. Tests exercise file safety, background batch lifecycle, sidebar controls, edit protection, one-shot output, and cancellation/unloading using a simulated vault and a local HTTP test server. Lint uses Obsidian's recommended rules; one advisory remains for the existing tabbed settings interface, which does not expose individual settings to Obsidian's newer settings search.

GitHub Actions checks pushes and pull requests. To release a future version, update `manifest.json`, `package.json`, the lockfile, and `versions.json`; push a tag matching the version exactly, without a `v` prefix. The release workflow checks version consistency and attaches the three installable files and a ZIP.

## Support and license

If you find the plugin useful, you can [support development](https://www.buymeacoffee.com/rastovich). Donations are optional.

Report reproducible problems through [GitHub issues](https://github.com/Coherence-Wizard/Coherence-Wizard/issues). Use example notes and remove personal information from reports.

[MIT license](LICENSE). Coherence Wizard is an independent community project.
