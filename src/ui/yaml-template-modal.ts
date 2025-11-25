import { App, Modal, Setting, Notice } from 'obsidian';
import { YamlTemplateService } from '../modules/yaml-template';

export class YamlTemplateModal extends Modal {
    service: YamlTemplateService;
    target: any;
    recursive: boolean = true;
    addDate: boolean = true;
    template: string;

    constructor(app: App, settings: any, target?: any) {
        super(app);
        this.service = new YamlTemplateService(app);
        this.target = target;
        this.template = settings.yamlTemplate || "date\nsummary\nsummary model\naudited\nrating";
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl('h2', { text: 'Apply YAML Template' });

        if (this.target) {
            const type = this.target.extension ? 'File' : 'Folder';
            contentEl.createEl('p', { text: `Target: ${this.target.name} (${type})` });
        } else {
            contentEl.createEl('p', { text: 'No target selected.', cls: 'error-text' });
            return;
        }

        new Setting(contentEl)
            .setName('Template Fields')
            .setDesc('One field per line. These will be ordered first.')
            .addTextArea(text => text
                .setValue(this.template)
                .setPlaceholder('date\nsummary\ntags')
                .onChange(v => this.template = v));

        new Setting(contentEl)
            .setName('Add Date from Filename')
            .setDesc('If filename starts with YYYY-MM-DD, add it to "date" field')
            .addToggle(t => t.setValue(this.addDate).onChange(v => this.addDate = v));

        if (!this.target.extension) {
            new Setting(contentEl)
                .setName('Recursive')
                .addToggle(t => t.setValue(this.recursive).onChange(v => this.recursive = v));
        }

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Apply Template')
                .setCta()
                .onClick(async () => {
                    btn.setButtonText('Processing...').setDisabled(true);
                    const order = this.template.split('\n').map(s => s.trim()).filter(s => s);

                    try {
                        if (this.target.extension) {
                            await this.service.processFile(this.target, order, this.addDate);
                            new Notice('YAML Updated');
                        } else {
                            const res = await this.service.processFolder(this.target.path, order, this.addDate, this.recursive);
                            new Notice(`Processed: ${res.processed}, Errors: ${res.errors}`);
                        }
                        this.close();
                    } catch (e) {
                        new Notice('Error applying template');
                        console.error(e);
                        btn.setButtonText('Apply Template').setDisabled(false);
                    }
                }));
    }

    onClose() {
        this.contentEl.empty();
    }
}
