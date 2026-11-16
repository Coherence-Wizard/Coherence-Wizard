import { ItemView, Setting, WorkspaceLeaf } from 'obsidian';
import { SummarizationJob } from '../modules/summarization-job';

export const VIEW_TYPE_SUMMARIZATION = 'coherence-summarization-progress';

export class SummarizationView extends ItemView {
    private unsubscribe?: () => void;

    constructor(leaf: WorkspaceLeaf, private job: SummarizationJob) { super(leaf); }

    getViewType(): string { return VIEW_TYPE_SUMMARIZATION; }
    getDisplayText(): string { return 'Summarization'; }
    getIcon(): string { return 'lines-of-text'; }

    onOpen(): Promise<void> {
        this.unsubscribe = this.job.subscribe(() => this.render());
        return Promise.resolve();
    }

    onClose(): Promise<void> {
        this.unsubscribe?.();
        return Promise.resolve();
    }

    private render(): void {
        const { contentEl } = this;
        const state = this.job.state;
        contentEl.empty();
        contentEl.addClass('coherence-summary-panel');
        new Setting(contentEl).setName('Summarization').setHeading();
        if (state.status === 'idle') {
            contentEl.createEl('p', { text: 'Start a summary from a note or folder’s context menu, or the command palette. Progress appears here while you keep using your notes.' });
            return;
        }
        const labels = { running: 'Summarizing', stopping: 'Stopping', completed: 'Complete', stopped: 'Stopped', failed: 'Failed' };
        const status = contentEl.createDiv({ cls: 'coherence-summary-status', text: labels[state.status] });
        status.setAttribute('role', 'status');
        contentEl.createEl('p', { text: `Model: ${state.model}` });
        contentEl.createEl('p', { text: `Target: ${state.target}`, cls: 'coherence-summary-path' });
        const progress = contentEl.createEl('progress', { cls: 'coherence-summary-progress' });
        progress.max = state.total || 1;
        progress.value = state.total ? state.completed : state.status === 'completed' ? 1 : 0;
        progress.setAttribute('aria-label', 'Notes processed');
        contentEl.createEl('p', { text: `${state.completed} / ${state.total} notes processed` });
        contentEl.createEl('p', { text: `Saved: ${state.saved} · Skipped: ${state.skipped} · Failed: ${state.errors}` });
        if (state.currentFile) contentEl.createEl('p', { text: state.currentFile, cls: 'coherence-summary-path' });
        if (state.stage) contentEl.createEl('p', { text: state.stage });
        if (state.total === 0 && state.status === 'completed') contentEl.createEl('p', { text: 'No Markdown notes found in the selected scope.' });
        if (state.lastError) contentEl.createEl('p', { text: state.lastError, cls: 'coherence-text-error' });
        if (state.modelStatus) contentEl.createEl('p', { text: state.modelStatus });

        if (state.status === 'running' || state.status === 'stopping') {
            new Setting(contentEl).addButton(button => button
                .setButtonText('Stop')
                .setTooltip('Stop the batch and unload its model')
                .setDisabled(state.status === 'stopping')
                .onClick(() => this.job.stop()));
        }
        contentEl.createEl('p', { text: 'Stop cancels the batch and unloads its model. The model also unloads automatically after completion. Completed summaries are kept. Closing this pane leaves the job running; the command palette can reopen it.', cls: 'setting-item-description' });
    }
}
