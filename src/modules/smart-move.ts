import { App, TFolder, TFile, normalizePath } from 'obsidian';

export class SmartMoveService {
    constructor(private app: App) { }

    async moveFiles(sourceFolder: TFolder, targetRootPath: string, recursive = true): Promise<void> {
        const targetPath = normalizePath(targetRootPath.trim());
        if (!targetPath || targetPath.split('/').some(part => part === '..' || part === '.')) {
            throw new Error('Choose a folder inside the vault.');
        }
        if (sourceFolder.path === '/' || targetPath === sourceFolder.path || targetPath.startsWith(`${sourceFolder.path}/`)) {
            throw new Error('The destination must be outside the source folder.');
        }
        const target = this.app.vault.getAbstractFileByPath(targetPath);
        if (target && !(target instanceof TFolder)) {
            throw new Error('The destination is a file, not a folder.');
        }
        if (!target) await this.app.vault.createFolder(targetPath);

        // Moving a child mutates the source's live children array.
        for (const child of [...sourceFolder.children]) {
            const destination = normalizePath(`${targetPath}/${child.name}`);
            if (child instanceof TFile) {
                await this.app.fileManager.renameFile(child, this.availablePath(destination));
            } else if (child instanceof TFolder && recursive) {
                const existing = this.app.vault.getAbstractFileByPath(destination);
                if (existing instanceof TFolder) {
                    await this.moveFiles(child, destination, true);
                    if (child.children.length === 0) await this.app.fileManager.trashFile(child);
                } else {
                    await this.app.fileManager.renameFile(child, this.availablePath(destination));
                }
            }
        }
    }

    private availablePath(path: string): string {
        const slash = path.lastIndexOf('/');
        const dot = path.lastIndexOf('.');
        const extension = dot > slash + 1 ? path.slice(dot) : '';
        const stem = extension ? path.slice(0, -extension.length) : path;
        let candidate = path;
        let counter = 1;
        while (this.app.vault.getAbstractFileByPath(candidate)) {
            candidate = `${stem} ${counter++}${extension}`;
        }
        return candidate;
    }
}
