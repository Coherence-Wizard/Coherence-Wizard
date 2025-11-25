import { TFile, Vault, normalizePath, TFolder } from 'obsidian';

export class ConcatonizerService {
    constructor(private vault: Vault) { }

    async concatonizeFolder(folderPath: string, outputName: string, recursive: boolean, stripYaml: boolean, includeFilename: boolean): Promise<string> {
        const files: TFile[] = [];
        this.collectFiles(folderPath, files, recursive);

        if (files.length === 0) {
            return 'No markdown files found.';
        }

        let content = '';

        // Sort files by path to have a deterministic order
        files.sort((a, b) => a.path.localeCompare(b.path));

        for (const file of files) {
            let fileContent = await this.vault.read(file);

            if (stripYaml) {
                // Remove YAML frontmatter
                // Regex looks for --- at start of file, followed by content, followed by ---
                fileContent = fileContent.replace(/^---\n[\s\S]*?\n---\n/, '');
            }

            const relPath = file.path.startsWith(folderPath) ? file.path.substring(folderPath.length + 1) : file.path;

            if (includeFilename) {
                content += `\n# ${relPath}\n\n`;
            }
            content += fileContent;
            content += `\n\n`;
        }

        const outputPath = normalizePath(`${folderPath}/${outputName}`);

        // Check if output file exists
        if (await this.vault.adapter.exists(outputPath)) {
            // Overwrite or create new? Let's overwrite for now as per "Combine All MD" script usually implies
            // But safer to modify if exists
            const file = this.vault.getAbstractFileByPath(outputPath);
            if (file instanceof TFile) {
                await this.vault.modify(file, content);
            }
        } else {
            await this.vault.create(outputPath, content);
        }

        return `Combined ${files.length} files into ${outputName}`;
    }

    private collectFiles(path: string, files: TFile[], recursive: boolean) {
        const folder = this.vault.getAbstractFileByPath(path);
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
