import { App, TFile, TFolder } from 'obsidian';

export class YamlTemplateService {
    constructor(private app: App) { }

    async processFile(file: TFile, templateOrder: string[], addDate: boolean): Promise<void> {
        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                // 1. Sanitize existing keys (Obsidian's processFrontMatter gives us an object, 
                // we can't easily rename keys in-place without creating a new object, 
                // but processFrontMatter expects us to mutate the passed object or return a new one? 
                // Actually, we modify 'frontmatter' directly.

                // To reorder, we need to delete all keys and add them back in order.
                const existingData = { ...frontmatter };

                // Clear frontmatter
                for (const key in frontmatter) delete frontmatter[key];

                // 2. Add Date if requested
                if (addDate) {
                    const isoDateRegex = /^(\d{4}-\d{2}-\d{2})/;
                    const match = file.name.match(isoDateRegex);
                    if (match) {
                        existingData['date'] = match[1];
                    }
                }

                // 3. Add template keys in order
                for (const key of templateOrder) {
                    const sanitizedKey = this.sanitizeKey(key);
                    if (sanitizedKey) {
                        frontmatter[sanitizedKey] = existingData[sanitizedKey] !== undefined ? existingData[sanitizedKey] : "";
                        delete existingData[sanitizedKey]; // Remove from existing so we don't duplicate
                    }
                }

                // 4. Add remaining keys
                for (const key in existingData) {
                    const sanitizedKey = this.sanitizeKey(key);
                    if (sanitizedKey) {
                        frontmatter[sanitizedKey] = existingData[key];
                    }
                }
            });
        } catch (e) {
            console.error(`Failed to process YAML for ${file.path}`, e);
            throw e;
        }
    }

    async processFolder(folderPath: string, templateOrder: string[], addDate: boolean, recursive: boolean): Promise<{ processed: number, errors: number }> {
        const files: TFile[] = [];
        this.collectFiles(folderPath, files, recursive);

        let processed = 0;
        let errors = 0;

        for (const file of files) {
            try {
                await this.processFile(file, templateOrder, addDate);
                processed++;
            } catch (e) {
                errors++;
            }
        }

        return { processed, errors };
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

    private sanitizeKey(key: string): string {
        // Remove illegal characters: # @ & * ! | > % { } [ ] ? , :
        return key.replace(/[#@&*!|>%{}[\]?,:]/g, '').trim();
    }
}
