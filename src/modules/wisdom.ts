import { TFile, Vault, parseYaml, stringifyYaml, normalizePath } from 'obsidian';
import { OllamaService } from './ollama';

export class WisdomService {
    constructor(private vault: Vault, private ollama: OllamaService) { }

    private async getUniquePath(folder: string, name: string): Promise<string> {
        let base = normalizePath(`${folder}/${name}.md`);
        if (!(await this.vault.adapter.exists(base))) {
            return base;
        }
        let counter = 2;
        while (true) {
            const candidate = normalizePath(`${folder}/${name}-${counter}.md`);
            if (!(await this.vault.adapter.exists(candidate))) {
                return candidate;
            }
            counter++;
        }
    }

    async processFile(file: TFile, model: string, mode: 'safe' | 'generalized' = 'generalized', promptTemplate?: string): Promise<string> {
        const content = await this.vault.read(file);

        // Parse Frontmatter
        const frontmatterRegex = /^---\n([\s\S]*?)\n---/;
        const match = content.match(frontmatterRegex);
        let frontmatter: any = {};
        let body = content;

        if (match) {
            try {
                frontmatter = parseYaml(match[1]);
                body = content.substring(match[0].length).trim();
            } catch (e) {
                console.error('Failed to parse YAML', e);
            }
        }

        // Check if already processed
        if (file.basename.endsWith('_generalized') || file.basename.endsWith('_safe')) {
            return 'Skipped (already processed)';
        }

        // Define Output Folder
        const outputFolder = normalizePath(`${file.parent.path}/Generalized`);
        if (!(await this.vault.adapter.exists(outputFolder))) {
            await this.vault.createFolder(outputFolder);
        }

        let newContent = body;
        let suffix = mode === 'safe' ? '_safe' : '_generalized';

        if (mode === 'generalized') {
            // AI Transformation
            const defaultPrompt = `
            You are a wisdom extractor. Rewrite the following personal text into general wisdom and insights.
            Rules:
            1. Remove all names, places, and identifying details.
            2. Focus on the lessons, insights, and universal truths.
            3. Maintain the emotional core but make it applicable to anyone.
            4. Return ONLY the rewritten text.
            `;

            const template = promptTemplate || defaultPrompt;
            const prompt = `${template}\n\nText:\n${body.substring(0, 15000)}`;

            try {
                newContent = await this.ollama.generate(model, prompt);
            } catch (e) {
                console.error('Wisdom extraction failed', e);
                throw e;
            }
        }

        // Add original file link to frontmatter
        frontmatter.original_file = `[[${file.basename}]]`;

        // Construct new file
        const newFileContent = `---\n${stringifyYaml(frontmatter)}---\n\n${newContent}`;

        const newFilename = `${file.basename}${suffix}`;
        const newPath = await this.getUniquePath(outputFolder, newFilename);

        await this.vault.create(newPath, newFileContent);

        return `Created ${newPath}`;
    }

    async processFolder(folderPath: string, model: string, mode: 'safe' | 'generalized' = 'generalized', promptTemplate?: string): Promise<{ processed: number, skipped: number, errors: number }> {
        const files: TFile[] = [];

        const collectFiles = (path: string) => {
            const folder = this.vault.getAbstractFileByPath(path);
            if (folder && 'children' in folder) {
                for (const child of (folder as any).children) {
                    if (child instanceof TFile && child.extension === 'md') {
                        files.push(child);
                    } else if ('children' in child) {
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
                const result = await this.processFile(file, model, mode, promptTemplate);
                if (result.startsWith('Created')) processed++;
                else skipped++;
            } catch (e) {
                errors++;
            }
        }

        return { processed, skipped, errors };
    }
}
