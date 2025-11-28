# Coherence Wizard 🧙‍♂️

**Convert Chaos into Order.**

> *Streamline your Personal Knowledge Management (PKM) workflow by harnessing the power of local AI to organize, refine, and extract wisdom from your notes.*

---

## ✨ What is Coherence Wizard?

Coherence Wizard is a unified toolkit designed for Obsidian users who are passionate about self-development and efficient knowledge management. It provides a suite of 14+ powerful tools to automate the tedious parts of maintaining a digital garden, allowing you to focus on connecting ideas and generating insights.

**Privacy First**: This plugin is built to run entirely offline using **Local AI** (via [Ollama](https://ollama.com/)). Your data never leaves your machine.

## 🚀 Key Features

### 🧠 Content Enhancement & Wisdom
*   **Summarizer**: Instantly generate concise summaries of your notes using AI.
*   **Wisdom Extractor**: Transform raw notes into profound, universal insights.
*   **Generalizer**: Rewrite personal texts into relatable, general advice suitable for a public audience.
*   **Atomizer**: Split long, monolithic documents into atomic notes based on headings, dates, or dividers.

### 🗂️ Organization & Structure
*   **Categorizer**: Automatically analyze note content and assign relevant categories (tags or folders) based on your custom dictionary.
*   **Chrono Merge**: Intelligently merge fragmented notes created within a specific time window (e.g., "Audio Note 1", "Audio Note 2").
*   **Parse and Move**: Automatically move files to specific folders based on their content or metadata.
*   **Concatonizer**: Combine multiple files into a single master document.

### 🛡️ Privacy & Publishing
*   **Censor & Alias**: Prepare your personal notes for public sharing by automatically finding and replacing sensitive names, places, or terms with aliases (e.g., "John" → "Bob").
*   **Distill**: A dedicated workflow to refine and sanitize notes for publication.

### 🧹 Maintenance & Metadata
*   **Date Fix**: Standardize date formats in your filenames and metadata.
*   **YAML Template**: Enforce consistent YAML frontmatter across your vault.
*   **Deduplication**: Identify and remove duplicate files to keep your vault clean.
*   **Auto-Rating**: Use AI to rate the quality and coherence of your notes.

## 🛠️ Prerequisites

To use the AI-powered features of this plugin, you must have **Ollama** installed and running on your computer.

1.  Download and install [Ollama](https://ollama.com/).
2.  Pull a model suitable for your hardware. We recommend:
    *   **High Performance**: `gemma3:12b`
    *   **Lower Resources**: `gemma3:4b`
3.  Ensure Ollama is running (default URL: `http://localhost:11434`).

> **⚠️ Hardware Note**: Local AI models require decent hardware. A dedicated GPU is highly recommended for speed. CPU-only mode may be slow.

## 📦 Installation

### From Community Plugins (Coming Soon)
1.  Open Obsidian Settings > Community Plugins.
2.  Search for "Coherence Wizard".
3.  Install and Enable.

### Manual Installation
1.  Download the latest release from the [GitHub Releases](https://github.com/Coherence-Wizard/Coherence-Wizard/releases) page.
2.  Extract the `main.js`, `manifest.json`, and `styles.css` files into your vault's `.obsidian/plugins/coherence-wizard/` folder.
3.  Reload Obsidian.

## ⚙️ Configuration

After installing, go to **Settings > Coherence Wizard**.

*   **Ollama URL**: Ensure this matches your local instance (default is correct for most).
*   **Dictionaries**: **Crucial Step!** You must configure your **Categorization** and **Censor** dictionaries to match your personal workflow.
    *   *Categorize*: Define your topics (e.g., Work, Personal, Ideas).
    *   *Censor*: Define name mappings (e.g., `John, Jon = Bob`).
*   **YAML Template**: Define the standard frontmatter keys you want to enforce.

## ☕ Support

If this tool saves you time or helps you bring order to your chaos, please consider supporting its development!

<a href="https://www.buymeacoffee.com/rastovich" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me A Coffee" style="height: 60px !important;width: 217px !important;" ></a>

## 📄 License

MIT License. See [license](D%20-%20PROCESS/Python%20Scripts/Text%20and%20Folders/Popular%20Scripts%20GUI%20For%20Testing%20Antigravity/Coherence%20Wizard%200.0.17/node_modules/ms/license.md) for details.

---

*Disclaimer: This is a beta plugin relying on probabilistic AI models. Always backup your vault before running bulk operations.*
