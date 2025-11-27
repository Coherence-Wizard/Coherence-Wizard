import { App, TFile, TFolder, parseYaml, stringifyYaml } from 'obsidian';
import { OllamaService } from './ollama';

export class SummarizerService {
    constructor(private app: App, private ollama: OllamaService) { }

    async summarizeFile(file: TFile, model: string, overwrite = false, prompts: string[] = [], generateTitle = false): Promise<boolean> {
        const content = await this.app.vault.read(file);

        // Parse Frontmatter
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);

        let frontmatter: Record<string, unknown> = {};
        let body = content;

        if (match) {
            try {
                frontmatter = parseYaml(match[1]);
                body = content.substring(match[0].length).trim();
            } catch (e) {
                console.error('Failed to parse YAML', e);
            }
        }

        if (frontmatter.summary && !overwrite) {
            return false; // Skip if summary exists
        }

        // Generate Summary
        // Use provided prompts or default
        const defaultPrompt = "Please summarize the following markdown content. Keep it concise and capture the main points.";
        const activePrompts = prompts.filter(p => p && p.trim().length > 0);

        if (activePrompts.length === 0) {
            activePrompts.push(defaultPrompt);
        }

        let currentText = body.substring(0, 50000); // Limit input size
        let summary = "";

        try {
            for (const promptTemplate of activePrompts) {
                // Replace placeholders
                let prompt = promptTemplate
                    .replace(/{filename}/g, file.basename)
                    .replace(/{text}/g, body.substring(0, 50000))
                    .replace(/{summary}/g, currentText); // Use current accumulated text as summary input

                // If prompt doesn't contain placeholders, append content (legacy behavior)
                if (!promptTemplate.includes('{text}') && !promptTemplate.includes('{summary}')) {
                    prompt = `${promptTemplate}\n\n${currentText}`;
                }

                summary = await this.ollama.generate(model, prompt);
                currentText = summary; // Use summary as input for next pass
            }

            // Update Frontmatter
            frontmatter.summary = summary.trim();
            frontmatter['summary model'] = model;

            // Reconstruct file
            const newFrontmatter = `---\n${stringifyYaml(frontmatter)}---\n`;
            const newContent = newFrontmatter + body;

            await this.app.vault.modify(file, newContent);

            // Handle Title Generation
            if (generateTitle) {
                try {
                    const titlePrompt = `Output exactly one 3-12-word title (no digits, punctuation, list markers). Return only the title.\n\nAbstract:\n${summary}`;
                    let newTitle = await this.ollama.generate(model, titlePrompt);

                    // Sanitize title
                    // Strip out illegal characters: . @ # % $ & / \ < > [ ] ( ) : * ? " | and newlines
                    newTitle = newTitle.replace(/[.@#%$&/\\<>[\]():*?"|\n\r]/g, ' ').trim();
                    newTitle = newTitle.replace(/\s+/g, ' '); // Collapse spaces

                    if (newTitle.length > 0) {
                        // Format: {stem} {title} AIG.md
                        const newStem = `${file.basename} ${newTitle} AIG`;
                        const newPath = `${file.parent.path}/${newStem}.md`;

                        // Check if file exists
                        if (!await this.app.vault.adapter.exists(newPath)) {
                            // Use fileManager.renameFile to update links
                            await this.app.fileManager.renameFile(file, newPath);
                        } else {
                            // Append number if exists
                            let i = 1;
                            while (await this.app.vault.adapter.exists(`${file.parent.path}/${newStem} ${i}.md`)) {
                                i++;
                            }
                            await this.app.fileManager.renameFile(file, `${file.parent.path}/${newStem} ${i}.md`);
                        }
                    }
                } catch (e) {
                    console.error('Failed to generate title', e);
                }
            }

            return true;
        } catch (e) {
            console.error(`Failed to summarize ${file.path}`, e);
            throw e;
        }
    }

    async summarizeFolder(folderPath: string, model: string, recursive = true, overwrite = false, prompts: string[] = [], generateTitle = false): Promise<{ processed: number, skipped: number, errors: number }> {
        const files: TFile[] = [];

        const collectFiles = (path: string) => {
            const folder = this.app.vault.getAbstractFileByPath(path);
            if (folder instanceof TFolder) {
                for (const child of folder.children) {
                    if (child instanceof TFile && child.extension === 'md') {
                        files.push(child);
                    } else if (recursive && 'children' in child) {
                        collectFiles(child.path);
                    }
                }
            }
        };

        collectFiles(folderPath);

        let processed = 0;
        let skipped = 0;
        let errors = 0;

        for (const file of files) {
            try {
                const result = await this.summarizeFile(file, model, overwrite, prompts, generateTitle);
                if (result) processed++;
                else skipped++;
            } catch (e) {
                errors++;
            }
        }

        return { processed, skipped, errors };
    }
}
