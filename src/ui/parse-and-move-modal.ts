import { App, Modal, Setting, TFile, TFolder, Notice } from 'obsidian';
import { ParseAndMoveService } from '../modules/parse-and-move';
import { CoherenceSettings } from '../types';

export class ParseAndMoveModal extends Modal {
    private service: ParseAndMoveService;
    private targetFolder: TFolder | null = null;
    private outputDir = 'Categorized Content';
    private targetDir = '';
    private categoriesText = '';
    private shouldMove = false;

    private readonly DEFAULT_CATEGORIES = `ADV - Adventure Hikes and Special Areas: #ADV
AI - Artificial Intelligence: #AI
AUT - Automotive and Equipment: #AUT
BOO - Book Media and Travel Suggestions: #BOO
CHE - Checklists: #CHE
CHI - Children and Parenting: #CHI
COH - Coherence: #COH
COM - Comedy: #COM
DAN - Dance: #DAN
DRA - Drawings: #DRA
DRE - Dreams: #DRE
ELE - Elegant Definitions: #ELE
FLWP - Followup: #FLWP
GC - General Contracting: #GC
HEA - Health: #HEA
HHH - Happy Healthy Home: #HHH
OGT - How I Organize Thought: #OGT
IDE - Ideas Meditations Thoughts and Inventions: #IDE
INT - Intuitive Happenings: #INT
LOV - Things I Love: #LOV
MAR - Marketing and Persuasion: #MAR
MED - Medicine Experience: #MED
MEM - Memoir Reflections: #MEM
MUS - Music: #MUS
NAT - Nature Musings and Spirituality: #NAT
NMO - Good Ideas Not My Own: #NMO
NW - New Words: #NW
ORG - Organizing People and Hosting: #ORG
PAR - Parenting and Children: #PAR
WOR - Words: #WOR
Mellisa: #PEO/Mellisa
Zev: #PEO/Zev
Grandma: #PEO/GMA
LuAnn: #PEO/LuAnn
Chenoa: #PEO/Chenoa
Eva: #PEO/Eva
Adrian: #PEO/Adrian
Maitreya: #PEO/Maitreya
Karma: #PEO/Karma
Meriwether: #PEO/Meriwether
Michael: #PEO/Michael
PM - Project Management: #PM
POE - Poetry: #POE
PP - Personal Principles and Constitution: #PP
PRO - Product Research: #PRO
REL - Relationships Romance and Sex: #REL
SCH - School: #SCH
SCU - Sculpture: #SCU
STO - Story Video Article and Book Ideas: #STO
STW - Save The World: #STW
SUC - Success and Creativity: #SUC
TAO - Tao Te Ching: #TAO
TEA - Teaching: #TEA
THE - Therapy: #THE
THR - Three Words: #THR
WRI - Writing Career: #WRI`;

    constructor(app: App, settings: CoherenceSettings, private fileOrFolder?: TFile | TFolder) {
        super(app);
        this.service = new ParseAndMoveService(app);
        this.categoriesText = this.DEFAULT_CATEGORIES;
        this.targetDir = settings.parseAndMoveTargetDir;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Parse and move').setHeading();

        if (this.fileOrFolder) {
            contentEl.createEl('p', { text: `Target: ${this.fileOrFolder.path}` });
        } else {
            // Folder selection if not provided
            new Setting(contentEl)
                .setName('Target folder')
                .setDesc('Select the folder to parse (leave empty for root)')
                .addText(text => text
                    .setPlaceholder('Example: Folder/Subfolder')
                    .onChange(value => {
                        const folder = this.app.vault.getAbstractFileByPath(value);
                        if (folder instanceof TFolder) {
                            this.targetFolder = folder;
                        } else {
                            this.targetFolder = null;
                        }
                    }));
        }

        new Setting(contentEl)
            .setName('Output directory')
            .setDesc('Directory where categorized files will be created')
            .addText(text => text
                .setValue(this.outputDir)
                .onChange(value => this.outputDir = value));

        new Setting(contentEl)
            .setName('Move to target directory')
            .setDesc('If enabled, files will be moved from Output Directory to Target Directory/Category/Resources')
            .addToggle(toggle => toggle
                .setValue(this.shouldMove)
                .onChange(value => {
                    this.shouldMove = value;
                    this.display(); // Refresh to show/hide target dir input
                }));

        if (this.shouldMove) {
            new Setting(contentEl)
                .setName('Target directory')
                .setDesc('Final destination for categorized files')
                .addText(text => text
                    .setValue(this.targetDir)
                    .onChange(value => this.targetDir = value));
        }

        new Setting(contentEl)
            .setName('Categories')
            .setDesc('Format: Category Name: #Tag')
            .addTextArea(text => text
                .setValue(this.categoriesText)
                .setPlaceholder('Category: #TAG')
                .onChange(value => this.categoriesText = value)
                .inputEl.rows = 10);

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Parse')
                .setCta()
                .onClick(() => this.parse()));
    }

    display() {
        this.onOpen();
    }

    async parse() {
        const folder = this.fileOrFolder instanceof TFolder ? this.fileOrFolder :
            (this.fileOrFolder instanceof TFile ? this.fileOrFolder.parent :
                (this.targetFolder || this.app.vault.getRoot()));

        if (!folder) {
            new Notice('Invalid folder selected');
            return;
        }

        const categories = this.parseCategories(this.categoriesText);
        const files = this.getFiles(folder);

        new Notice(`Parsing ${files.length} files...`);
        this.close();

        let processedCount = 0;
        for (const file of files) {
            await this.service.processFile(file, categories, this.outputDir, this.shouldMove, this.targetDir);
            processedCount++;
        }

        new Notice(`Parsed ${processedCount} files.`);
    }

    private getFiles(folder: TFolder): TFile[] {
        let files: TFile[] = [];
        for (const child of folder.children) {
            if (child instanceof TFile && child.extension === 'md') {
                files.push(child);
            } else if (child instanceof TFolder) {
                files = files.concat(this.getFiles(child));
            }
        }
        return files;
    }

    private parseCategories(text: string): { [key: string]: string } {
        const categories: { [key: string]: string } = {};
        const lines = text.split('\n');
        for (const line of lines) {
            const parts = line.split(':');
            if (parts.length >= 2) {
                const key = parts[0].trim();
                const value = parts.slice(1).join(':').trim();
                if (key && value) {
                    categories[key] = value;
                }
            }
        }
        return categories;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
