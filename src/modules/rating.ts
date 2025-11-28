import { App, TFile, Notice } from 'obsidian';
import { OllamaService } from './ollama';

export class RatingService {
    constructor(private app: App, private ollama: OllamaService) { }

    async rateFile(file: TFile, model: string, qualityParams: string[]): Promise<number | null> {
        try {
            const content = await this.app.vault.read(file);

            // Check if already rated
            const cache = this.app.metadataCache.getFileCache(file);
            if (cache?.frontmatter && 'auto rating' in cache.frontmatter) {
                return cache.frontmatter['auto rating'];
            }

            const rating = await this.getRatingFromAI(content, model, qualityParams);

            if (rating) {
                await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                    frontmatter['auto rating'] = rating;
                });
                return rating;
            }
            return null;
        } catch (e) {
            console.error(`Failed to rate file ${file.path}`, e);
            return null;
        }
    }

    async rateFolder(
        folderPath: string,
        model: string,
        qualityParams: string[],
        recursive: boolean,
        skipExisting: boolean,
        onProgress?: (processed: number, total: number, currentFile: string) => void
    ): Promise<{ processed: number, rated: number, errors: number }> {
        const files: TFile[] = [];
        this.collectFiles(folderPath, files, recursive);

        let processed = 0;
        let rated = 0;
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
                // Check skip existing
                if (skipExisting) {
                    const cache = this.app.metadataCache.getFileCache(file);
                    if (cache?.frontmatter && 'auto rating' in cache.frontmatter) {
                        continue;
                    }
                }

                const rating = await this.rateFile(file, model, qualityParams);
                if (rating) rated++;
            } catch (e) {
                errors++;
            }
        }

        return { processed, rated, errors };
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

    private async getRatingFromAI(text: string, model: string, qualityParams: string[]): Promise<number | null> {
        const paramsText = qualityParams.join(", ");
        const systemPrompt = `You are a writing quality evaluator.
Rate the quality of writing based on: ${paramsText}.

Rating scale:
1 - Very poor quality (lacks coherence, shallow, poorly written)
2 - Poor quality (some coherence issues, limited depth, needs improvement)
3 - Average quality (adequate coherence, moderate depth, acceptable writing)
4 - Good quality (strong coherence, good depth, well-written)
5 - Excellent quality (exceptional coherence, profound depth, outstanding writing)

Consider all specified quality parameters when assigning the rating.
Return JSON only, matching the given schema, with a single integer rating from 1-5.`;

        const schema = {
            "type": "object",
            "properties": {
                "rating": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 5,
                    "description": "Rating from 1 (lowest) to 5 (highest)"
                }
            },
            "required": ["rating"],
            "additionalProperties": false,
        };

        try {
            const response = await this.ollama.chat(model, [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: text }
            ], schema, { temperature: 0 });

            const data = JSON.parse(response);
            return data.rating;
        } catch (e) {
            console.error('AI Rating failed', e);
            return null;
        }
    }
}
