import { App, TFile, normalizePath } from 'obsidian';

export class CensorService {
    constructor(private app: App) { }

    async processFile(
        file: TFile,
        dictionary: { variants: string[], alias: string }[],
        direction: 'forward' | 'reverse',
        useMasking: boolean,
        sentenceLevel: boolean,
        outputMode: 'folder' | 'same-folder',
        suffix: string,
        replacementChar: string = '█'
    ): Promise<void> {
        const content = await this.app.vault.read(file);
        const { text: newContent, count } = this.applyPatterns(content, dictionary, direction, useMasking, sentenceLevel, replacementChar);

        if (count > 0) {
            let targetPath: string;

            if (outputMode === 'folder') {
                const parentPath = file.parent ? file.parent.path : '/';
                // Ensure parent path is not root '/' when constructing path
                const parentDir = parentPath === '/' ? '' : parentPath;
                const outputDir = normalizePath(`${parentDir}/Censored`);

                await this.ensureFolderExists(outputDir);
                targetPath = normalizePath(`${outputDir}/${file.basename}${suffix}.${file.extension}`);
            } else {
                // Same folder
                const parentPath = file.parent ? file.parent.path : '/';
                const parentDir = parentPath === '/' ? '' : parentPath;
                targetPath = normalizePath(`${parentDir}/${file.basename}${suffix}.${file.extension}`);
            }

            // Handle existing file
            if (await this.app.vault.adapter.exists(targetPath)) {
                const existing = this.app.vault.getAbstractFileByPath(targetPath);
                if (existing instanceof TFile) {
                    await this.app.vault.modify(existing, newContent);
                }
            } else {
                await this.app.vault.create(targetPath, newContent);
            }
        }
    }

    async censorFolder(
        folderPath: string,
        keys: string,
        replacementChar: string,
        recursive: boolean,
        outputMode: 'folder' | 'same-folder',
        suffix: string
    ): Promise<{ processed: number, errors: number }> {
        const files: TFile[] = [];
        this.collectFiles(folderPath, files, recursive);

        let processed = 0;
        let errors = 0;

        const dictionary = keys.split('\n').filter(k => k.trim()).map(k => ({
            variants: [k.trim()],
            alias: 'CENSORED'
        }));

        const useMasking = true;

        for (const file of files) {
            try {
                await this.processFile(
                    file,
                    dictionary,
                    'forward',
                    useMasking,
                    false,
                    outputMode,
                    suffix,
                    replacementChar
                );
                processed++;
            } catch (e) {
                console.error(`Error censoring ${file.path}`, e);
                errors++;
            }
        }

        return { processed, errors };
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

    private async ensureFolderExists(path: string) {
        const folders = path.split('/');
        let currentPath = '';
        for (const folder of folders) {
            if (!folder) continue;
            currentPath = currentPath === '' ? folder : `${currentPath}/${folder}`;
            if (!(await this.app.vault.adapter.exists(currentPath))) {
                await this.app.vault.createFolder(currentPath);
            }
        }
    }

    private applyPatterns(
        text: string,
        dictionary: { variants: string[], alias: string }[],
        direction: 'forward' | 'reverse',
        useMasking: boolean,
        sentenceLevel: boolean,
        replacementChar: string = '█'
    ): { text: string, count: number } {
        let totalCount = 0;

        if (direction === 'reverse') {
            let processedText = text;
            for (const { variants, alias } of dictionary) {
                if (variants.length > 0) {
                    const canonical = variants[0];
                    const regex = this.termToRegex(alias);
                    processedText = processedText.replace(regex, () => {
                        totalCount++;
                        return canonical;
                    });
                }
            }
            return { text: processedText, count: totalCount };
        }

        // Forward direction
        if (sentenceLevel && useMasking) {
            const matches: { start: number, end: number }[] = [];

            for (const { variants } of dictionary) {
                for (const variant of variants) {
                    const regex = this.termToRegex(variant);
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        totalCount++;
                        const sentRange = this.findSentenceRange(text, match.index);
                        matches.push(sentRange);
                    }
                }
            }

            if (matches.length === 0) return { text, count: 0 };

            // Merge ranges
            matches.sort((a, b) => a.start - b.start);
            const merged: { start: number, end: number }[] = [];
            if (matches.length > 0) {
                let current = matches[0];
                for (let i = 1; i < matches.length; i++) {
                    const next = matches[i];
                    if (next.start <= current.end) {
                        current.end = Math.max(current.end, next.end);
                    } else {
                        merged.push(current);
                        current = next;
                    }
                }
                merged.push(current);
            }

            // Apply masking
            let result = '';
            let lastIndex = 0;
            for (const range of merged) {
                result += text.substring(lastIndex, range.start);
                const len = range.end - range.start;
                result += replacementChar.repeat(len);
                lastIndex = range.end;
            }
            result += text.substring(lastIndex);

            return { text: result, count: totalCount };

        } else {
            let processedText = text;
            const allVariants = dictionary.flatMap(d => d.variants.map(v => ({ v, alias: d.alias })));
            allVariants.sort((a, b) => b.v.length - a.v.length);

            for (const { v, alias } of allVariants) {
                const regex = this.termToRegex(v);
                processedText = processedText.replace(regex, (match) => {
                    totalCount++;
                    return useMasking ? replacementChar.repeat(match.length) : alias;
                });
            }
            return { text: processedText, count: totalCount };
        }
    }

    private termToRegex(term: string): RegExp {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
        return new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'gi');
    }

    private findSentenceRange(text: string, matchIndex: number): { start: number, end: number } {
        const prefix = text.substring(0, matchIndex);
        const suffix = text.substring(matchIndex);

        // Find start: last [.?!] followed by whitespace, OR last \n
        let sentStart = 0;
        const boundaryRegex = /([.?!])(\s+)|(\n)/g;
        let m;
        while ((m = boundaryRegex.exec(prefix)) !== null) {
            sentStart = m.index + m[0].length;
        }

        // Find end: first [.?!] followed by whitespace/EOF, OR \n
        const endRegex = /([.?!])(?=\s|$)|(\n)/;
        const endMatch = suffix.match(endRegex);

        let sentEnd = text.length;
        if (endMatch) {
            if (endMatch[0] === '\n') {
                sentEnd = matchIndex + endMatch.index!;
            } else {
                sentEnd = matchIndex + endMatch.index! + 1; // Include punctuation
            }
        }

        return { start: sentStart, end: sentEnd };
    }
}
