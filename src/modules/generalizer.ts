import { App, TFile, TFolder, normalizePath } from 'obsidian';
import { OllamaService } from './ollama';

export class GeneralizerService {
    private ollama: OllamaService;

    constructor(private app: App, settings: { ollamaUrl: string }) {
        this.ollama = new OllamaService(settings.ollamaUrl);
    }

    async processFile(
        file: TFile,
        model: string,
        promptTemplate: string,
        outputMode: 'folder' | 'same-folder',
        suffix: string,
        systemPrompt: string,
        maxTokens: number,
        repeatPenalty: number,
        multiStage: boolean,
        intermediatePrompt: string
    ): Promise<void> {
        const content = await this.app.vault.read(file);
        const { yaml, body } = this.parseYaml(content);

        if (!body.trim()) {
            return; // Skip empty files
        }

        let inputBody = body;

        // Step 1: Intermediate Summarization (if enabled)
        if (multiStage) {
            let summaryPrompt = '';
            if (intermediatePrompt.includes('{text}')) {
                summaryPrompt = intermediatePrompt.replace('{text}', body);
            } else {
                summaryPrompt = `${intermediatePrompt}\n\n${body}`;
            }

            const summary = await this.ollama.generate(model, summaryPrompt, {
                system: systemPrompt, // Use the same system prompt to enforce "no preamble"
                num_predict: maxTokens,
                repeat_penalty: repeatPenalty
            });

            inputBody = summary.replace(/<\/end_of_turn>/g, '').trim();
        }

        // Step 2: Final Generalization/Wisdom
        let prompt = '';
        if (promptTemplate.includes('{text}')) {
            prompt = promptTemplate.replace('{text}', inputBody);
        } else {
            prompt = `${promptTemplate}\n\n${inputBody}`;
        }

        let generalizedText = await this.ollama.generate(model, prompt, {
            system: systemPrompt,
            num_predict: maxTokens,
            repeat_penalty: repeatPenalty
        });
        generalizedText = generalizedText.replace(/<\/end_of_turn>/g, '').trim();

        const newContent = yaml ? `${yaml}\n${generalizedText}` : generalizedText;
        await this.saveOutput(file, newContent, outputMode, suffix);
    }

    async processFolder(
        folderPath: string,
        model: string,
        promptTemplate: string,
        outputMode: 'folder' | 'same-folder',
        suffix: string,
        recursive: boolean,
        systemPrompt: string,
        maxTokens: number,
        repeatPenalty: number,
        multiStage: boolean,
        intermediatePrompt: string
    ): Promise<{ processed: number, errors: number }> {
        const files: TFile[] = [];
        this.collectFiles(folderPath, files, recursive);

        let processed = 0;
        let errors = 0;

        for (const file of files) {
            try {
                await this.processFile(file, model, promptTemplate, outputMode, suffix, systemPrompt, maxTokens, repeatPenalty, multiStage, intermediatePrompt);
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

    private parseYaml(content: string): { yaml: string, body: string } {
        const match = content.match(/^(---\n[\s\S]*?\n---)\n([\s\S]*)$/);
        if (match) {
            return { yaml: match[1], body: match[2] };
        }
        return { yaml: '', body: content };
    }

    private async saveOutput(file: TFile, content: string, outputMode: 'folder' | 'same-folder', suffix: string) {
        let targetPath: string;

        if (outputMode === 'folder') {
            const parentPath = file.parent ? file.parent.path : '/';
            const parentDir = parentPath === '/' ? '' : parentPath;
            const outputDir = normalizePath(`${parentDir}/Generalized`);

            if (!(await this.app.vault.adapter.exists(outputDir))) {
                await this.app.vault.createFolder(outputDir);
            }
            targetPath = normalizePath(`${outputDir}/${file.basename}${suffix}.${file.extension}`);
        } else {
            const parentPath = file.parent ? file.parent.path : '/';
            const parentDir = parentPath === '/' ? '' : parentPath;
            targetPath = normalizePath(`${parentDir}/${file.basename}${suffix}.${file.extension}`);
        }

        if (await this.app.vault.adapter.exists(targetPath)) {
            const existing = this.app.vault.getAbstractFileByPath(targetPath);
            if (existing instanceof TFile) {
                await this.app.vault.modify(existing, content);
            }
        } else {
            await this.app.vault.create(targetPath, content);
        }
    }
}
