import { App, Modal, Setting, Notice, TFile, TFolder } from 'obsidian';
import { YamlTemplateService } from '../modules/yaml-template';
import { CoherenceSettings } from '../types';

export class YamlTemplateModal extends Modal {
    service: YamlTemplateService;
    target: TFile | TFolder | null;
    recursive = true;
    addDate = true;
    template: string;

    constructor(app: App, settings: CoherenceSettings, target?: TFile | TFolder) {
        super(app);
        this.service = new YamlTemplateService(app);
        this.target = target || null;
        this.template = settings.yamlTemplate || "date\nsummary\nsummary model\naudited\nrating";
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        new Setting(contentEl).setName('Apply YAML template').setHeading();

        if (this.target) {
            const type = this.target instanceof TFile ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.target.name} (${type})` });
        } else {
            contentEl.createEl('p', { text: 'No target selected.', cls: 'error-text' });
            return;
        }

        new Setting(contentEl)
            .setName('Template fields')
            .setDesc('One field per line. These will be ordered first.')
            .addTextArea(text => text
                .setValue(this.template)
                .setPlaceholder('date\nsummary\ntags')
                .onChange(v => this.template = v));

        new Setting(contentEl)
            .setName('Add date from filename')
            .setDesc('If filename starts with YYYY-MM-DD, add it to "date" field')
            .addToggle(t => t.setValue(this.addDate).onChange(v => this.addDate = v));

        if (!(this.target instanceof TFile)) {
            new Setting(contentEl)
                .setName('Recursive')
                .addToggle(t => t.setValue(this.recursive).onChange(v => this.recursive = v));
        }

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Apply template')
                .setCta()
                .onClick(() => {
                    void (async () => {
                        btn.setButtonText('Processing...').setDisabled(true);
                        const order = this.template.split('\n').map(s => s.trim()).filter(s => s);

                        try {
                            if (this.target instanceof TFile) {
                                await this.service.processFile(this.target, order, this.addDate);
                                new Notice('YAML Updated');
                            } else if (this.target instanceof TFolder) {
                                const res = await this.service.processFolder(this.target.path, order, this.addDate, this.recursive);
                                new Notice(`Processed: ${res.processed}, Errors: ${res.errors}`);
                            }
                            this.close();
                        } catch (e) {
                            new Notice('Error applying template');
                            btn.setButtonText('Apply template').setDisabled(false);
                        }
                    })();
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
