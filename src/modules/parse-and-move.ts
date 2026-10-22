import { App, TFile, TFolder, normalizePath } from 'obsidian';

export class ParseAndMoveService {
    constructor(private app: App) { }

    async parseFile(file: TFile, categories: { [key: string]: string }, useYamlTags: boolean = false): Promise<{ [key: string]: string }> {
        const content = await this.app.vault.read(file);
        const categorizedContent: { [key: string]: string } = {};

        // Initialize categorized content
        for (const category of Object.keys(categories)) {
            categorizedContent[category] = "";
        }

        if (useYamlTags) {
            const cache = this.app.metadataCache.getFileCache(file);
            const tags: unknown = cache?.frontmatter?.tags;
            const tagList: string[] = [];

            if (Array.isArray(tags)) {
                tagList.push(...tags.filter((tag): tag is string => typeof tag === 'string'));
            } else if (typeof tags === 'string') {
                // Handle comma separated tags if that occurs, though Obsidian usually gives array
                tagList.push(...tags.split(',').map(t => t.trim()));
            }

            // Also check for 'tag' field just in case
            const singleTag: unknown = cache?.frontmatter?.tag;
            if (Array.isArray(singleTag)) {
                tagList.push(...singleTag.filter((tag): tag is string => typeof tag === 'string'));
            } else if (typeof singleTag === 'string') {
                tagList.push(...singleTag.split(',').map(t => t.trim()));
            }

            // Normalize tags to include # if missing for comparison, or handle raw comparison
            // The 'categories' values are like '#work' or '#ideas'.
            // Frontmatter tags usually come without # in the cache object? Let's verify.
            // Actually metadataCache.frontmatter.tags are usually without # strings.
            // BUT getAllTags returns with #.
            // Let's use FrontMatterCache directly which usually stores as strings.

            for (const [category, startTag] of Object.entries(categories)) {
                // startTag is like "#AI"
                const cleanTag = startTag.replace(/^#/, '');

                // Check if any of the file's tags match this category's tag
                const hasMatch = tagList.some(t => {
                    const tClean = t.replace(/^#/, '');
                    return tClean === cleanTag;
                });

                if (hasMatch) {
                    categorizedContent[category] = content;
                }
            }

            return categorizedContent;
        }

        const lines = content.split('\n');
        let currentCategories: string[] = [];

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
        useYamlTags: boolean = false
    ): Promise<void> {
        const categorizedContent = await this.parseFile(file, categories, useYamlTags);

        // Ensure output directory exists
        if (!(await this.app.vault.adapter.exists(outputDir))) {
            await this.app.vault.createFolder(outputDir);
        }

        for (const [category, content] of Object.entries(categorizedContent)) {
            if (content.trim()) {
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
                await this.processFile(file, categories, targetDir, false);
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
        if (folder instanceof TFolder) {
            for (const child of folder.children) {
                if (child instanceof TFile && child.extension === 'md') {
                    files.push(child);
                } else if (recursive && 'children' in child) {
                    this.collectFiles(child.path, files, recursive);
                }
            }
        }
    }
}
