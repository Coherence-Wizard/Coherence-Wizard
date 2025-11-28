import { App, TFile, normalizePath, Notice } from 'obsidian';
import { OllamaService } from './ollama';

export interface CategorizerOptions {
    model: string;
    categories: string[];
    maxCategories: number;
    applyAsTag: boolean;
    applyAsBacklink: boolean;
    moveToFolder: boolean;
    tagHandlingMode: 'overwrite' | 'append' | 'skip';
}

export class CategorizerService {
    constructor(private app: App, private ollama: OllamaService) { }

    async categorizeFile(file: TFile, options: CategorizerOptions): Promise<string[]> {
        try {
            // Check for skip mode first
            if (options.tagHandlingMode === 'skip') {
                const cache = this.app.metadataCache.getFileCache(file);
                const tags = cache?.frontmatter?.['tags'];
                if (tags && (Array.isArray(tags) ? tags.length > 0 : String(tags).trim().length > 0)) {
                    return []; // Skip
                }
            }

            const content = await this.app.vault.read(file);
            const assignedCategories = await this.getCategoriesFromAI(content, options.model, options.categories, options.maxCategories);

            if (assignedCategories.length > 0) {
                await this.processFile(file, assignedCategories, options);
                return assignedCategories;
            }
            return [];
        } catch (e) {
            console.error(`Failed to categorize file ${file.path}`, e);
            return [];
        }
    }

    async processFile(
        file: TFile,
        assignedCategories: string[],
        options: CategorizerOptions
    ): Promise<void> {
        // 1. Apply as Tag (YAML)
        if (options.applyAsTag) {
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                let currentTags = frontmatter['tags'];

                if (options.tagHandlingMode === 'overwrite') {
                    currentTags = [];
                } else {
                    // Normalize current tags to array
                    if (!currentTags) {
                        currentTags = [];
                    } else if (!Array.isArray(currentTags)) {
                        // Handle comma-separated string or single string
                        if (typeof currentTags === 'string') {
                            currentTags = currentTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
                        } else {
                            currentTags = [String(currentTags)];
                        }
                    }
                }

                assignedCategories.forEach(c => {
                    // Remove # if present
                    let cleanCategory = c.startsWith('#') ? c.substring(1) : c;

                    // Replace spaces with underscores
                    cleanCategory = cleanCategory.replace(/\s+/g, '_');

                    // Remove old versions (hashed or with spaces)
                    // We want to remove:
                    // 1. The exact original category string 'c'
                    // 2. The hashed version of 'c' (if 'c' didn't have hash)
                    // 3. The version with spaces (if 'cleanCategory' has underscores)

                    const variantsToRemove = [
                        c,
                        `#${c}`,
                        c.replace(/^#/, ''),
                        cleanCategory.replace(/_/g, ' ') // version with spaces
                    ];

                    variantsToRemove.forEach(variant => {
                        const idx = currentTags.indexOf(variant);
                        if (idx > -1) currentTags.splice(idx, 1);
                    });

                    // Add cleaned version if not present
                    if (!currentTags.includes(cleanCategory)) {
                        currentTags.push(cleanCategory);
                    }
                });

                frontmatter['tags'] = currentTags;
            });
        }

        // 2. Apply as Backlink
        if (options.applyAsBacklink) {
            const backlinks = assignedCategories.map(c => `[[${c}]]`).join(' ');
            // Append to end of file
            const content = await this.app.vault.read(file);
            // Check if already exists to avoid spamming? 
            // Simple check: if the exact backlink string is not at the end.
            // But for now, just append.
            await this.app.vault.modify(file, content + `\n\n${backlinks}`);
        }

        // 3. Move to Folder
        if (options.moveToFolder && assignedCategories.length > 0) {
            const parentPath = file.parent ? file.parent.path : '';

            // Move to the first category folder
            const firstCategory = assignedCategories[0];
            const firstDestFolder = normalizePath(`${parentPath}/${this.sanitizeFileName(firstCategory)}`);
            const firstDestPath = normalizePath(`${firstDestFolder}/${file.name}`);

            if (!await this.app.vault.adapter.exists(firstDestFolder)) {
                await this.app.vault.createFolder(firstDestFolder);
            }

            // Check if file already exists at destination
            if (await this.app.vault.adapter.exists(firstDestPath)) {
                new Notice(`File ${file.name} already exists in ${firstCategory}. Skipping move.`);
            } else {
                await this.app.fileManager.renameFile(file, firstDestPath);
            }

            // Copy to subsequent category folders
            for (let i = 1; i < assignedCategories.length; i++) {
                const category = assignedCategories[i];
                const destFolder = normalizePath(`${parentPath}/${this.sanitizeFileName(category)}`);
                const destPath = normalizePath(`${destFolder}/${file.name}`);

                if (!await this.app.vault.adapter.exists(destFolder)) {
                    await this.app.vault.createFolder(destFolder);
                }

                if (!await this.app.vault.adapter.exists(destPath)) {
                    // Copy the file (which is now at firstDestPath)
                    // We need to get the TFile of the moved file. 
                    // Since we renamed 'file', the 'file' object should point to the new location.
                    await this.app.vault.copy(file, destPath);
                }
            }
        }
    }

    async processFolder(
        folderPath: string,
        options: CategorizerOptions,
        recursive: boolean,
        onProgress?: (processed: number, total: number, currentFile: string) => void
    ): Promise<{ processed: number, categorized: number, errors: number }> {
        const files: TFile[] = [];
        this.collectFiles(folderPath, files, recursive);

        let processed = 0;
        let categorized = 0;
        let errors = 0;
        const total = files.length;

        for (let i = 0; i < total; i++) {
            const file = files[i];

            if (onProgress) {
                onProgress(i + 1, total, file.name);
            }

            // Yield to event loop
            await new Promise(resolve => setTimeout(resolve, 10));

            processed++;
            try {
                const cats = await this.categorizeFile(file, options);
                if (cats.length > 0) {
                    categorized++;
                }
            } catch (e) {
                console.error(`Error processing ${file.path}`, e);
                errors++;
            }
        }

        return { processed, categorized, errors };
    }

    private collectFiles(path: string, files: TFile[], recursive: boolean) {
        const folder = this.app.vault.getAbstractFileByPath(path);
        if (folder && 'children' in folder) {
            for (const child of (folder as any).children) {
                if (child instanceof TFile && child.extension === 'md') {
                    files.push(child);
                } else if (recursive && 'children' in child) {
                    this.collectFiles(child.path, files, recursive);
                }
            }
        }
    }

    private async getCategoriesFromAI(text: string, model: string, categories: string[], maxCategories: number): Promise<string[]> {
        const categoriesList = categories.join("\n- ");
        const systemPrompt = `You are a strict classifier.
Select up to ${maxCategories} categories from the provided list that best fit the note.
Return JSON only, matching the given schema.

Categories:
- ${categoriesList}

If multiple categories are plausible, pick the most relevant ones, up to the limit of ${maxCategories}.`;

        const schema = {
            "type": "object",
            "properties": {
                "categories": {
                    "type": "array",
                    "items": { "type": "string", "enum": categories },
                    "maxItems": maxCategories
                }
            },
            "required": ["categories"],
            "additionalProperties": false,
        };

        try {
            const response = await this.ollama.chat(model, [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ], schema, { temperature: 0 });

            const data = JSON.parse(response);
            let result = data.categories || [];

            // Strictly enforce limit
            if (result.length > maxCategories) {
                result = result.slice(0, maxCategories);
            }

            return result;
        } catch (e) {
            console.error('AI Classification failed', e);
            return [];
        }
    }

    private sanitizeFileName(name: string): string {
        return name.replace(/[<>:"/\\|?*]/g, '_').trim();
    }
}
