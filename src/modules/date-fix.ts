import { TFile, Vault, normalizePath, Notice } from 'obsidian';


export class DateFixService {
    constructor(private vault: Vault) { }

    async fixDatesInFolder(folderPath: string, recursive: boolean, fallbackToCreationDate: boolean, dateFormat: string, exceptions: string): Promise<{ processed: number, renamed: number, errors: number }> {
        const files: TFile[] = [];
        this.collectFiles(folderPath, files, recursive);

        let processed = 0;
        let renamed = 0;
        let errors = 0;

        const exceptionList = exceptions.split(',').map(e => e.trim()).filter(e => e.length > 0);

        for (const file of files) {
            processed++;
            try {
                if (this.isException(file, exceptionList)) {
                    continue;
                }

                const newName = await this.getNewFilename(file, fallbackToCreationDate, dateFormat);
                if (newName && newName !== file.name) {
                    const newPath = normalizePath(`${file.parent.path}/${newName}`);
                    await this.vault.rename(file, newPath);
                    renamed++;
                }
            } catch (e) {
                console.error(`Failed to process ${file.path}`, e);
                errors++;
            }
        }

        return { processed, renamed, errors };
    }

    async fixDateInFile(file: TFile, fallbackToCreationDate: boolean, dateFormat: string, exceptions: string): Promise<string> {
        try {
            const exceptionList = exceptions.split(',').map(e => e.trim()).filter(e => e.length > 0);
            if (this.isException(file, exceptionList)) {
                return 'Skipped (Exception)';
            }

            const newName = await this.getNewFilename(file, fallbackToCreationDate, dateFormat);
            if (newName && newName !== file.name) {
                const newPath = normalizePath(`${file.parent.path}/${newName}`);
                await this.vault.rename(file, newPath);
                return `Renamed to ${newName}`;
            }
            return 'No change needed';
        } catch (e) {
            console.error(`Failed to process ${file.path}`, e);
            throw e;
        }
    }

    private collectFiles(path: string, files: TFile[], recursive: boolean) {
        const folder = this.vault.getAbstractFileByPath(path);
        if (folder && 'children' in folder) {
            for (const child of (folder as any).children) {
                if (child instanceof TFile) {
                    files.push(child);
                } else if (recursive && 'children' in child) {
                    this.collectFiles(child.path, files, recursive);
                }
            }
        }
    }

    private isException(file: TFile, exceptions: string[]): boolean {
        for (const exception of exceptions) {
            if (exception.startsWith('*.')) {
                // Extension check
                const ext = exception.substring(2);
                if (file.extension === ext) return true;
            } else {
                // Word check
                if (file.name.includes(exception)) return true;
            }
        }
        return false;
    }

    private async getNewFilename(file: TFile, fallbackToCreationDate: boolean, dateFormat: string): Promise<string> {
        let name = file.name;
        let originalName = name;

        // 1. Check if it already starts with a date (roughly)
        // We can't easily check against dynamic format, but we can check if it starts with 4 digits.
        if (/^\d{4}[-_]\d{2}[-_]\d{2}/.test(name)) {
            // Already has a date at start, likely.
            // TODO: Maybe validate if it matches dateFormat?
            // For now, assume if it starts with YYYY-MM-DD or similar, it's good.
            return name;
        }

        // 2. Try to extract date from filename
        // Patterns to look for:
        // 20220221 (8 digits)
        // 20220707_000345 (8 digits _ 6 digits)
        // 20240403-010134 (8 digits - 6 digits)
        // 20240206-0145 (8 digits - 4 digits)

        const datePattern = /(\d{4})(\d{2})(\d{2})([-_]\d{4,6})?/;
        // We want to find this anywhere in the string, but if it's at the start we might have already caught it above.
        // But the above check was for YYYY-MM-DD (with separators). This regex catches YYYYMMDD (no separators).

        const match = name.match(datePattern);

        if (match) {
            const year = match[1];
            const month = match[2];
            const day = match[3];
            // Validate date
            const date = window.moment(`${year}-${month}-${day}`, 'YYYY-MM-DD');
            if (date.isValid()) {
                const formattedDate = date.format(dateFormat);

                // Remove the matched part from the original name
                // We need to be careful not to destroy the extension if the match is near the end.

                // Separate extension
                const extIndex = name.lastIndexOf('.');
                let baseName = name;
                let ext = '';
                if (extIndex > 0) {
                    baseName = name.substring(0, extIndex);
                    ext = name.substring(extIndex);
                }

                const matchBase = baseName.match(datePattern);
                if (matchBase) {
                    // Re-verify date from base match (should be same)
                    const year = matchBase[1];
                    const month = matchBase[2];
                    const day = matchBase[3];
                    const date = window.moment(`${year}-${month}-${day}`, 'YYYY-MM-DD');

                    if (date.isValid()) {
                        const formattedDate = date.format(dateFormat);
                        let newBase = baseName.replace(matchBase[0], '').trim();
                        newBase = newBase.replace(/^[-_ ]+|[-_ ]+$/g, '');
                        newBase = newBase.replace(/[-_ ]{2,}/g, '_');

                        if (newBase) {
                            name = `${formattedDate}_${newBase}${ext}`;
                        } else {
                            name = `${formattedDate}${ext}`;
                        }
                        return name;
                    }
                }
            }
        }

        // 3. Fallback to creation date
        if (fallbackToCreationDate) {
            const ctime = file.stat.ctime;
            const dateStr = window.moment(ctime).format(dateFormat);
            name = `${dateStr}_${name}`;
        }

        return name;
    }
}
