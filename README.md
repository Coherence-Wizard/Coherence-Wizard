# Coherence Wizard

Organize, summarize, split, merge, and refine notes in Obsidian. Coherence Wizard combines bulk file tools with optional AI processing through Ollama.

## Install

Requires **Obsidian desktop 1.13.0 or later**. Mobile is not supported. The plugin is not yet approved for the community directory.

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/Coherence-Wizard/Coherence-Wizard/releases/latest), or download and extract `coherence-wizard-0.0.36.zip`.
2. Put those three files in `<your vault>/.obsidian/plugins/coherence-wizard/` (use your configured settings folder if it differs from `.obsidian`).
3. Restart Obsidian, open **Settings → Community plugins**, and enable **Coherence Wizard**.

Back up your vault and try the tools on copied notes before running bulk operations.

## Get started

Open **Settings → Coherence Wizard** to configure the tools. Use the command palette, a file or folder's context menu, or the **Open dashboard** command to start a workflow. Review each dialog's options before running it.

For AI tools, install [Ollama](https://ollama.com/), download a model appropriate for your hardware, and run the server. Set the Ollama URL (default `http://localhost:11434`) and select an installed model in each tool. Ollama and models are installed separately; the plugin never installs them. File operations do not require Ollama.

The example dictionaries and folder names are generic. Replace them with your own categories and aliases in settings. In Parse and Copy, enter lines such as `Work: #work` or `Ideas: #ideas` and select a destination folder. In the censor dictionary, use `Example Name, Example Variant = Alias`.

## Tools

- **Summarizer:** adds or replaces summaries and can generate filenames. Review overwrite and rename options.
- **Wisdom and Generalizer:** create rewritten notes using Ollama prompts.
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
- **Censor and Distill:** replace configured terms or produce revised text for review. These tools do not guarantee anonymization; inspect their output before sharing.

Some tools modify existing notes or previously generated output. There is no plugin-wide undo or automatic backup. Trash follows Obsidian's configured deletion preference; a failed batch can leave some operations completed.

## Privacy and network use

AI requests send note content, filenames included in prompts, instructions, and applicable dictionary text to the **Ollama URL you configure**. Model lists are also requested from that endpoint when relevant settings or dialogs are opened. With a local server and local models, processing stays on that computer. A remote server or cloud-backed model can send this data elsewhere; its operator controls handling and retention.

The plugin has no analytics, telemetry, advertising, remote images, account requirement, or paid features. It does not access files outside the vault. Settings and user dictionaries are saved locally in the plugin's `data.json`; do not include that file when sharing the plugin. The release contains generic examples only.

## Build and check

Use Node.js 22 or later:

```sh
npm ci
npm run lint
npm run build
npm test
```

`build` includes TypeScript checking and produces `main.js`. Tests exercise collision handling and save-before-trash ordering using a simulated vault. Lint uses Obsidian's recommended rules; one advisory remains for the existing tabbed settings interface, which does not expose individual settings to Obsidian's newer settings search.

GitHub Actions checks pushes and pull requests. To release a future version, update `manifest.json`, `package.json`, the lockfile, and `versions.json`; push a tag matching the version exactly, without a `v` prefix. The release workflow checks version consistency and attaches the three installable files and a ZIP.

## Support and license

If you find the plugin useful, you can [support development](https://www.buymeacoffee.com/rastovich). Donations are optional.

Report reproducible problems through [GitHub issues](https://github.com/Coherence-Wizard/Coherence-Wizard/issues). Use example notes and remove personal information from reports.

[MIT license](LICENSE). Coherence Wizard is an independent community project.
