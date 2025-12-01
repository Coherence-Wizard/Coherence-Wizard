import { App, TFile, TFolder, normalizePath } from 'obsidian';

export class ChronoMergeService {
    constructor(private app: App) { }

    scanFolder(folder: TFolder, minutesThreshold: number, recursive: boolean, useCreationTime: boolean): TFile[][] {
        const files = this.getFiles(folder, recursive);
        const filesWithTime: { file: TFile, time: number }[] = [];

        for (const file of files) {
            let time: number = null;
            if (useCreationTime) {
                time = file.stat.ctime;
            } else {
                time = this.parseTimestamp(file.name);
            }

            if (time) {
                filesWithTime.push({ file, time });
            }
        }

        filesWithTime.sort((a, b) => a.time - b.time);

        const groups: TFile[][] = [];
        if (filesWithTime.length === 0) return groups;

        let currentGroup: TFile[] = [filesWithTime[0].file];
        let currentTime = filesWithTime[0].time;

        for (let i = 1; i < filesWithTime.length; i++) {
            const { file, time } = filesWithTime[i];
            const diffMinutes = (time - currentTime) / (1000 * 60);

            if (diffMinutes <= minutesThreshold) {
                currentGroup.push(file);
            } else {
                if (currentGroup.length > 1) {
                    groups.push(currentGroup);
                }
                currentGroup = [file];
                currentTime = time;
            }
        }

        if (currentGroup.length > 1) {
            groups.push(currentGroup);
        }

        return groups;
    }

    async getMergedContent(group: TFile[], useCreationTime: boolean): Promise<string> {
        const sortedGroup = group.sort((a, b) => {
            const timeA = useCreationTime ? a.stat.ctime : (this.parseTimestamp(a.name) || 0);
            const timeB = useCreationTime ? b.stat.ctime : (this.parseTimestamp(b.name) || 0);
            return timeA - timeB;
        });

        let mergedContent = "";
        for (let i = 0; i < sortedGroup.length; i++) {
            const file = sortedGroup[i];
            let content = await this.app.vault.read(file);

            if (i > 0) {
                // Strip YAML front matter for subsequent files
                // YAML front matter is enclosed in --- at the start of the file
                const yamlMatch = content.match(/^---\n[\s\S]*?\n---\n/);
                if (yamlMatch) {
                    content = content.replace(yamlMatch[0], "");
                }
            }

            mergedContent += content.trim() + "\n\n";
        }
        return mergedContent;
    }

    async mergeGroup(group: TFile[], outputName: string, useCreationTime: boolean, contentOverride?: string): Promise<void> {
        if (group.length === 0) return;

        // Sort by timestamp
        const sortedGroup = group.sort((a, b) => {
            const timeA = useCreationTime ? a.stat.ctime : (this.parseTimestamp(a.name) || 0);
            const timeB = useCreationTime ? b.stat.ctime : (this.parseTimestamp(b.name) || 0);
            return timeA - timeB;
        });

        const earliestFile = sortedGroup[0];
        const parent = earliestFile.parent;
        if (!parent) return;

        let mergedContent = contentOverride;
        if (mergedContent === undefined) {
            mergedContent = await this.getMergedContent(group, useCreationTime);
        }

        const newFileName = outputName.endsWith('.md') ? outputName : `${outputName}.md`;
        const newFilePath = normalizePath(`${parent.path}/${newFileName}`);

        // Identify if the target file is one of the group files
        const baseFile = group.find(f => f.path === newFilePath);

        // 1. Trash all files in the group EXCEPT the baseFile (if it exists)
        for (const file of sortedGroup) {
            if (file !== baseFile) {
                await this.app.fileManager.trashFile(file); // Move to trash
            }
        }

        // 2. Create or Modify the target file
        if (baseFile) {
            // The target file was part of the group, so we modify it
            await this.app.vault.modify(baseFile, mergedContent);
        } else {
            // The target file is new (or at least not part of the group)
            // Check if it already exists (name collision with unrelated file)
            const existingFile = this.app.vault.getAbstractFileByPath(newFilePath);
            if (existingFile) {
                // Collision! For safety, let's append a counter
                let counter = 1;
                let safeName = newFileName;
                while (this.app.vault.getAbstractFileByPath(normalizePath(`${parent.path}/${safeName}`))) {
                    safeName = `${outputName.replace('.md', '')}_${counter}.md`;
                    counter++;
                }
                const safePath = normalizePath(`${parent.path}/${safeName}`);
                await this.app.vault.create(safePath, mergedContent);
            } else {
                await this.app.vault.create(newFilePath, mergedContent);
            }
        }

        // Rename associated files (e.g. images) logic remains...
        // Note: The original logic for renaming associated files relied on the files still being there or having a reference.
        // Since we trashed them, we might have issues if we needed them for reference.
        // However, the original code iterated `sortedGroup` which we still have in memory.
        // But `child.basename` checks against files in `folderFiles`.
        // Since we trashed the files, `folderFiles` (live list) might not contain them anymore?
        // Actually `parent.children` is a live array.
        // But we are looking for *associated* files (e.g. `image.png` for `note.md`).
        // Those associated files were NOT trashed. So they should still be there.
        // The logic iterates `sortedGroup` (the MD files) and looks for siblings with same basename.
        // This should still work even if the MD files are gone.

        const folderFiles = parent.children;
        const usedNames = new Set<string>();
        usedNames.add(newFileName);

        let counter = 1;

        for (const file of sortedGroup) {
            const baseName = file.basename;
            // Find files in parent that start with baseName but are NOT the md file itself
            // And also check that it's not one of the group files (though they are MD files, so extension check covers it usually)
            for (const child of folderFiles) {
                if (child instanceof TFile && child.basename === baseName && child.extension !== 'md') {
                    // Rename
                    let newAssocName = "";
                    if (counter === 1) {
                        newAssocName = `${outputName.replace('.md', '')}.${child.extension}`;
                    } else {
                        newAssocName = `${outputName.replace('.md', '')}_${counter}.${child.extension}`;
                    }

                    // Check collision
                    let tempCounter = counter;
                    while (usedNames.has(newAssocName)) {
                        tempCounter++;
                        newAssocName = `${outputName.replace('.md', '')}_${tempCounter}.${child.extension}`;
                    }

                    const newAssocPath = normalizePath(`${parent.path}/${newAssocName}`);
                    // Check if destination exists to avoid error
                    if (!this.app.vault.getAbstractFileByPath(newAssocPath)) {
                        await this.app.fileManager.renameFile(child, newAssocPath);
                        usedNames.add(newAssocName);
                    }
                    counter++;
                }
            }
        }
    }

    private getFiles(folder: TFolder, recursive: boolean): TFile[] {
        let files: TFile[] = [];
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            } else if (recursive && child instanceof TFolder) {
                files = files.concat(this.getFiles(child, recursive));
            }
        }
        return files;
    }

    private parseTimestamp(filename: string): number {
        // Pattern: YYYY-MM-DD_HHMMSS
        const match = filename.match(/(\d{4}-\d{2}-\d{2}_\d{6})/);
        if (match) {
            const dateStr = match[1]; // YYYY-MM-DD_HHMMSS
            // Convert to standard format for parsing: YYYY-MM-DDTHH:MM:SS
            const formatted = dateStr.replace('_', 'T').replace(/(\d{2})(\d{2})(\d{2})$/, '$1:$2:$3');
            return new Date(formatted).getTime();
        }
        return null;
    }
}
