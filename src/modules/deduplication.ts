import { App, TFile, TFolder } from 'obsidian';
import * as crypto from 'crypto';

export interface DuplicateGroup {
    hash: string;
    size: number;
    files: TFile[];
}

export class DeduplicationService {
    constructor(private app: App) { }

    async findDuplicatesInFolder(folderPath: string, recursive: boolean): Promise<DuplicateGroup[]> {
        const files: TFile[] = [];
        this.collectFiles(folderPath, files, recursive);
        return this.processFiles(files);
    }

    async compareFolders(folderA: string, folderB: string, recursive: boolean): Promise<DuplicateGroup[]> {
        const filesA: TFile[] = [];
        const filesB: TFile[] = [];
        this.collectFiles(folderA, filesA, recursive);
        this.collectFiles(folderB, filesB, recursive);

        const mapA = await this.hashFiles(filesA);
        const mapB = await this.hashFiles(filesB);

        const duplicates: DuplicateGroup[] = [];

        for (const [hash, groupA] of mapA.entries()) {
            const groupB = mapB.get(hash);
            if (groupB) {
                // Combine files from both sides
                duplicates.push({
                    hash: hash,
                    size: groupA[0].stat.size,
                    files: [...groupA, ...groupB]
                });
            }
        }

        return duplicates;
    }

    private async processFiles(files: TFile[]): Promise<DuplicateGroup[]> {
        const hashMap = await this.hashFiles(files);
        const duplicates: DuplicateGroup[] = [];

        for (const [hash, group] of hashMap.entries()) {
            if (group.length > 1) {
                duplicates.push({
                    hash: hash,
                    size: group[0].stat.size,
                    files: group
                });
            }
        }

        return duplicates;
    }

    private async hashFiles(files: TFile[]): Promise<Map<string, TFile[]>> {
        const hashMap = new Map<string, TFile[]>();

        for (const file of files) {
            try {
                const content = await this.app.vault.readBinary(file);
                const hash = this.calculateHash(content);

                if (!hashMap.has(hash)) {
                    hashMap.set(hash, []);
                }
                hashMap.get(hash)?.push(file);
            } catch (e) {
                console.error(`Failed to hash file ${file.path}`, e);
            }
        }
        return hashMap;
    }

    private collectFiles(path: string, files: TFile[], recursive: boolean) {
        const folder = this.app.vault.getAbstractFileByPath(path);
        if (folder instanceof TFolder) {
            for (const child of folder.children) {
                if (child instanceof TFile) {
                    files.push(child);
                } else if (recursive && 'children' in child) {
                    this.collectFiles(child.path, files, recursive);
                }
            }
        }
    }

    private calculateHash(content: ArrayBuffer): string {
        const hash = crypto.createHash('md5');
        hash.update(Buffer.from(content));
        return hash.digest('hex');
    }

    async deleteFile(file: TFile): Promise<void> {
        await this.app.fileManager.trashFile(file);
    }
}
