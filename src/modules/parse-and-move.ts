import { App, TFile, TFolder, Vault, normalizePath } from 'obsidian';

export class ParseAndMoveService {
    constructor(private app: App) { }

    async parseFile(file: TFile, categories: { [key: string]: string }): Promise<{ [key: string]: string }> {
        const content = await this.app.vault.read(file);
        const lines = content.split('\n');
        const categorizedContent: { [key: string]: string } = {};
        let currentCategories: string[] = [];

        // Initialize categorized content
        for (const category of Object.keys(categories)) {
            categorizedContent[category] = "";
        }

        for (const line of lines) {
            // Remove universal end tag
            const lineWithoutEnd = line.replace('#ABC', '');
            let processedLine = lineWithoutEnd.replace(/\r$/, ''); // Handle CRLF

            // Check for category start tags
            for (const [category, startTag] of Object.entries(categories)) {
                if (processedLine.includes(startTag)) {
                    processedLine = processedLine.replace(startTag, '').trim();
                    if (!currentCategories.includes(category)) {
                        currentCategories.push(category);
                    }
                }
            }

            // Append to active categories
            if (currentCategories.length > 0) {
                for (const cat of currentCategories) {
                    categorizedContent[cat] += processedLine + '\n';
                }
            }

            // Clear categories on end tag
            if (line.includes('#ABC')) {
                currentCategories = [];
            }
        }

        // Strip trailing whitespace
        for (const category of Object.keys(categorizedContent)) {
            categorizedContent[category] = categorizedContent[category].trim();
        }

        return categorizedContent;
    }

    async processFile(
        file: TFile,
        categories: { [key: string]: string },
        outputDir: string,
        shouldMove: boolean,
        targetDir?: string
    ): Promise<void> {
        const categorizedContent = await this.parseFile(file, categories);
        let hasContent = false;

        // Ensure output directory exists
        if (!(await this.app.vault.adapter.exists(outputDir))) {
            await this.app.vault.createFolder(outputDir);
        }

        for (const [category, content] of Object.entries(categorizedContent)) {
            if (content.trim()) {
                hasContent = true;
                const categoryDir = normalizePath(`${outputDir}/${category}`);

                if (!(await this.app.vault.adapter.exists(categoryDir))) {
                    await this.app.vault.createFolder(categoryDir);
                }

                const outputFile = normalizePath(`${categoryDir}/${file.name}`);
                let existingContent = "";
                if (await this.app.vault.adapter.exists(outputFile)) {
                    existingContent = await this.app.vault.adapter.read(outputFile);
                    existingContent += "\n\n";
                }

                await this.app.vault.adapter.write(outputFile, existingContent + content);
            }
        }

        if (shouldMove && targetDir && hasContent) {
            // Logic for moving files to a target structure
            // The original script moves from "Categorized Content" to "Target/Category/Resources"
            // Here we can implement a similar logic if requested, or just move the original file?
            // The original script has two distinct steps: Parse (extract content) and Move (move categorized files).
            // The "Move" step in the python script moves the *generated* categorized files to another location.

            // If we want to replicate the "Move" step:
            for (const category of Object.keys(categorizedContent)) {
                if (categorizedContent[category].trim()) {
                    const sourceFile = normalizePath(`${outputDir}/${category}/${file.name}`);
                    const targetCategoryDir = normalizePath(`${targetDir}/${category}/Resources`);

                    if (!(await this.app.vault.adapter.exists(targetCategoryDir))) {
                        await this.app.vault.createFolder(targetCategoryDir);
                    }

                    const targetFile = normalizePath(`${targetCategoryDir}/${file.name}`);

                    // Move (rename)
                    // We need to use TFile for rename if possible, but we are working with paths here since we just created them.
                    // Let's use adapter.rename
                    if (await this.app.vault.adapter.exists(sourceFile)) {
                        await this.app.vault.adapter.rename(sourceFile, targetFile);
                    }
                }
            }
        }
    }

    async processFolder(
        folderPath: string,
        targetDir: string,
        recursive: boolean
    ): Promise<{ moved: number, errors: number }> {
        const files: TFile[] = [];
        this.collectFiles(folderPath, files, recursive);

        let moved = 0;
        let errors = 0;

        // Default categories for now
        const categories = {
            "Resources": "## Resources",
            "Thoughts": "## Thoughts",
            "Questions": "## Questions"
        };

        for (const file of files) {
            try {
                await this.processFile(file, categories, targetDir, true, targetDir);
                moved++;
            } catch (e) {
                console.error(`Error processing ${file.path}`, e);
                errors++;
            }
        }

        return { moved, errors };
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
}
