import { TFile, Vault, normalizePath } from 'obsidian';

export class AtomizerService {
    constructor(private vault: Vault) { }

    /**
     * Sanitize a string to be safe for filenames
     */
    private sanitize(name: string): string {
        // Remove illegal characters
        let cleaned = name.replace(/[<>:"/\\|?*\n\r\t]/g, '_');
        // Remove duplicate underscores
        cleaned = cleaned.replace(/_{2,}/g, '_');
        // Trim underscores and whitespace
        cleaned = cleaned.replace(/^_+|_+$/g, '').trim();
        return cleaned || 'untitled';
    }

    /**
     * Generate a unique path if file already exists
     */
    private async getUniquePath(folder: string, name: string): Promise<string> {
        const base = normalizePath(`${folder}/${name}.md`);
        if (!(await this.vault.adapter.exists(base))) {
            return base;
        }

        let counter = 2;
        while (counter < 1000) {
            const candidate = normalizePath(`${folder}/${name}-${counter}.md`);
            if (!(await this.vault.adapter.exists(candidate))) {
                return candidate;
            }
            counter++;
        }
    }

    /**
     * Helper to create the output directory
     */
    private async createOutputDirectory(file: TFile): Promise<string> {
        const atomizedDir = normalizePath(`${file.parent.path}/Atomized`);
        if (!(await this.vault.adapter.exists(atomizedDir))) {
            await this.vault.createFolder(atomizedDir);
        }

        const rootDir = normalizePath(`${atomizedDir}/${file.basename}`);
        if (!(await this.vault.adapter.exists(rootDir))) {
            await this.vault.createFolder(rootDir);
        }
        return rootDir;
    }

    /**
     * Helper to extract YAML and Intro content
     */
    private extractPreamble(lines: string[]): { yaml: string[], intro: string[], remainingLines: string[] } {
        const yaml: string[] = [];
        // const intro: string[] = []; // Unused
        const remainingLines: string[] = [];

        let inYaml = false;
        // let yamlEnded = false; // Unused
        let startIndex = 0;

        // Check for YAML start
        if (lines.length > 0 && lines[0].trim() === '---') {
            inYaml = true;
            yaml.push(lines[0]);
            startIndex = 1;
        }

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i];
            if (inYaml) {
                yaml.push(line);
                if (line.trim() === '---') {
                    inYaml = false;
                    // yamlEnded = true; // Unused
                }
            } else {
                remainingLines.push(line);
            }
        }

        // If we never found the end of YAML, treat it all as content (or invalid YAML)
        // But standard behavior is usually to treat it as YAML if it starts with ---
        // For now, if yamlEnded is true, we have separated YAML.
        // If yamlEnded is false but we started with ---, it's technically unclosed YAML, but we'll proceed.

        // The "intro" content is handled by the specific atomizers as they scan for the first trigger.
        // This helper mainly separates the explicit YAML block so it doesn't get scanned.

        return { yaml, intro: [], remainingLines };
    }

    /**
     * Atomize by Heading
     */
    async atomizeByHeading(file: TFile): Promise<void> {
        const content = await this.vault.read(file);
        const lines = content.split('\n');

        const rootDir = await this.createOutputDirectory(file);

        const { yaml, remainingLines } = this.extractPreamble(lines);

        const headingRegex = /^(#{1,6})[ \t]+(.+?)\s*$/;

        const intro: string[] = [];
        const sections: { level: number; title: string; content: string[] }[] = [];
        let current: { level: number; title: string; content: string[] } | null = null;

        for (const line of remainingLines) {
            const match = line.match(headingRegex);
            if (match) {
                if (current) {
                    sections.push(current);
                }
                current = {
                    level: match[1].length,
                    title: match[2].trim(),
                    content: []
                };
            } else {
                if (current) {
                    current.content.push(line);
                } else {
                    intro.push(line);
                }
            }
        }
        if (current) {
            sections.push(current);
        }

        // Write YAML + Intro (Preamble)
        if (yaml.length > 0 || intro.some(l => l.trim())) {
            // If there is intro content, save it. 
            // If there is YAML, we might want to prepend it to the intro file or save separately.
            // User request: "parse out any front matter that occurs after the YAML and before the first divider..."

            const preambleContent = [...yaml, ...intro].join('\n');
            if (preambleContent.trim().length > 0) {
                await this.vault.create(
                    normalizePath(`${rootDir}/preamble.md`),
                    preambleContent
                );
            }
        }

        // Write sections
        const stack: { level: number; path: string }[] = [];

        for (const section of sections) {
            // Pop stack until we find the parent level
            while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
                stack.pop();
            }

            const parentPath = stack.length > 0 ? stack[stack.length - 1].path : rootDir;

            const safeTitle = this.sanitize(section.title);
            const sectionDir = `${parentPath}/${safeTitle}`;

            if (!(await this.vault.adapter.exists(sectionDir))) {
                await this.vault.createFolder(sectionDir);
            }

            const filePath = `${sectionDir}/${safeTitle}.md`;
            await this.vault.create(
                normalizePath(filePath),
                section.content.join('\n').trim()
            );

            stack.push({ level: section.level, path: sectionDir });
        }
    }

    /**
     * Atomize by ISO Date
     */
    async atomizeByDate(file: TFile): Promise<void> {
        const content = await this.vault.read(file);
        const lines = content.split('\n');

        const rootDir = await this.createOutputDirectory(file);

        // 1. Extract YAML to ignore it during scanning
        const { yaml, remainingLines } = this.extractPreamble(lines);

        const dateRegex = /\d{4}-\d{2}-\d{2}/;

        const intro: string[] = [];
        const sections: { title: string; content: string[] }[] = [];
        let currentTitle: string | null = null;
        let currentBlock: string[] = [];

        for (const line of remainingLines) {
            if (dateRegex.test(line)) {
                // Found a date trigger
                if (currentTitle) {
                    // Push previous section
                    sections.push({ title: currentTitle, content: currentBlock });
                } else if (currentBlock.length > 0) {
                    // This was intro content before the first date
                    intro.push(...currentBlock);
                }

                currentTitle = line.trim();
                currentBlock = [];
                currentBlock.push(line); // Include the date line in the section
            } else {
                if (currentTitle) {
                    currentBlock.push(line);
                } else {
                    intro.push(line); // Still in intro/preamble
                }
            }
        }
        // Flush last block
        if (currentTitle) {
            sections.push({ title: currentTitle, content: currentBlock });
        } else if (currentBlock.length > 0) {
            intro.push(...currentBlock);
        }

        // Write Preamble (YAML + Intro)
        if (yaml.length > 0 || intro.some(l => l.trim())) {
            const preambleContent = [...yaml, ...intro].join('\n');
            if (preambleContent.trim().length > 0) {
                await this.vault.create(
                    normalizePath(`${rootDir}/preamble.md`),
                    preambleContent
                );
            }
        }

        // Write sections
        for (const section of sections) {
            const safeTitle = this.sanitize(section.title).substring(0, 80);
            const filePath = await this.getUniquePath(rootDir, safeTitle);
            await this.vault.create(filePath, section.content.join('\n').trim());
        }
    }

    /**
     * Atomize by Character (Divider)
     */
    async atomizeByDivider(file: TFile, divider = '---'): Promise<void> {
        const content = await this.vault.read(file);
        const lines = content.split('\n');

        const rootDir = await this.createOutputDirectory(file);

        const { yaml, remainingLines } = this.extractPreamble(lines);

        const dividerRegex = new RegExp(`^\\s*${divider.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`);

        const intro: string[] = [];
        const sections: { title: string; content: string[] }[] = [];
        let currentBlock: string[] = [];
        let currentTitle: string | null = null;
        let needTitle = false;

        for (const line of remainingLines) {
            if (dividerRegex.test(line)) {
                // Found divider
                if (currentTitle) {
                    sections.push({ title: currentTitle, content: currentBlock });
                } else if (currentBlock.length > 0) {
                    // Content before first divider is intro
                    intro.push(...currentBlock);
                }

                currentTitle = null;
                currentBlock = [];
                needTitle = true;
                // We don't add the divider line to the content usually, but maybe we should? 
                // The previous implementation didn't seem to explicitly exclude it, but logic was slightly different.
                // Let's exclude the divider line itself from the content.
            } else {
                if (needTitle && line.trim()) {
                    currentTitle = line.trim();
                    needTitle = false;
                    // Don't add title line to content? Or do we?
                    // Previous logic: "currentBlock.push(line)" happened after setting title.
                    currentBlock.push(line);
                } else if (currentTitle || needTitle) {
                    currentBlock.push(line);
                } else {
                    intro.push(line);
                }
            }
        }
        // Flush last block
        if (currentTitle || (needTitle && currentBlock.length > 0)) {
            sections.push({ title: currentTitle || 'untitled', content: currentBlock });
        } else if (currentBlock.length > 0) {
            intro.push(...currentBlock);
        }

        // Write Preamble
        if (yaml.length > 0 || intro.some(l => l.trim())) {
            const preambleContent = [...yaml, ...intro].join('\n');
            if (preambleContent.trim().length > 0) {
                await this.vault.create(
                    normalizePath(`${rootDir}/preamble.md`),
                    preambleContent
                );
            }
        }

        // Write sections
        for (const section of sections) {
            // Generate title from content if null
            let title = section.title;
            if (!title || title === 'untitled') {
                // Try to find first non-empty line
                const firstLine = section.content.find(l => l.trim().length > 0);
                title = firstLine ? firstLine.substring(0, 50) : 'untitled';
            }

            const safeTitle = this.sanitize(title);
            const filePath = await this.getUniquePath(rootDir, safeTitle);
            await this.vault.create(filePath, section.content.join('\n').trim());
        }
    }
}
