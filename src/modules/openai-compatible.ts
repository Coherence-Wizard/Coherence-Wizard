import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';

export class OpenAICompatibleService {
    constructor(private baseUrl: string, private apiKey = '', private unsloth = false) { }

    private async request(path: string, body?: Record<string, unknown>, signal?: AbortSignal, timeoutMs = 1800000): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.baseUrl.trim().replace(/\/+$/, '')}/${path}`);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                reject(new Error('API base URL must use HTTP or HTTPS.'));
                return;
            }
            const payload = body ? JSON.stringify(body) : undefined;
            const headers: Record<string, string | number> = { Accept: 'application/json' };
            if (this.apiKey.trim()) headers.Authorization = `Bearer ${this.apiKey.trim()}`;
            if (payload) {
                headers['Content-Type'] = 'application/json';
                headers['Content-Length'] = Buffer.byteLength(payload);
            }
            // No redirects: credentials stay on the explicitly configured server.
            const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
                method: body ? 'POST' : 'GET', headers, signal,
            }, response => {
                let text = '';
                response.setEncoding('utf8');
                response.on('data', (chunk: string) => { text += chunk; });
                response.on('error', reject);
                response.on('end', () => {
                    let data: Record<string, unknown>;
                    try { data = JSON.parse(text) as Record<string, unknown>; }
                    catch { reject(new Error(`Invalid JSON from the API (HTTP ${response.statusCode}).`)); return; }
                    if (!data || typeof data !== 'object' || Array.isArray(data)) {
                        reject(new Error('The API returned an invalid response.')); return;
                    }
                    if (response.statusCode !== 200 || data.error) {
                        const error = data.error;
                        let detail = typeof error === 'string' ? error :
                            error && typeof error === 'object' && 'message' in error && typeof error.message === 'string' ? error.message :
                                typeof data.detail === 'string' ? data.detail : 'Check the provider, base URL, API key, and model ID.';
                        if (this.apiKey.trim()) detail = detail.split(this.apiKey.trim()).join('[redacted]');
                        if (response.statusCode === 401) {
                            detail = this.unsloth
                                ? 'Authentication required. Create an API key in Unsloth, enable model access, paste it into AI connection → API key, then refresh models. A placeholder key will not work.'
                                : 'Authentication failed. Enter a valid API key for this server, then refresh models.';
                        }
                        reject(new Error(`API error (HTTP ${response.statusCode}): ${detail}`));
                    } else resolve(data);
                });
            });
            request.on('error', reject);
            request.setTimeout(timeoutMs, () => request.destroy(new Error('API request timed out.')));
            request.end(payload);
        });
    }

    async listModels(): Promise<string[]> {
        const response = await this.request('models', undefined, undefined, 15000);
        if (!Array.isArray(response.data)) throw new Error('The models endpoint returned no model list.');
        return response.data.flatMap((model: unknown) => {
            return model && typeof model === 'object' && 'id' in model && typeof model.id === 'string' ? [model.id] : [];
        });
    }

    async getModels(): Promise<string[]> { return this.listModels(); }

    async generate(model: string, prompt: string, options: Record<string, unknown> = {}, signal?: AbortSignal): Promise<string> {
        const messages = [{ role: 'user', content: prompt }];
        if (typeof options.system === 'string') messages.unshift({ role: 'system', content: options.system });
        return this.complete(model, messages, undefined, options, signal);
    }

    async chat(model: string, messages: { role: string; content: string }[], format?: Record<string, unknown> | string, options: Record<string, unknown> = {}): Promise<string> {
        return this.complete(model, messages, format, options);
    }

    private async complete(model: string, messages: { role: string; content: string }[], format?: Record<string, unknown> | string, options: Record<string, unknown> = {}, signal?: AbortSignal): Promise<string> {
        const body: Record<string, unknown> = { model, messages, stream: false };
        for (const key of ['temperature', 'top_p', 'stop', 'seed', 'frequency_penalty', 'presence_penalty']) {
            if (options[key] !== undefined) body[key] = options[key];
        }
        // Only add a vendor extension when the caller explicitly requests no thinking.
        // Turning the preference off leaves each server/model's default untouched.
        if (options.think === false) {
            if (this.unsloth) body.enable_thinking = false;
            else body.chat_template_kwargs = { enable_thinking: false };
        }
        if (typeof options.num_predict === 'number') body.max_tokens = options.num_predict;
        if (typeof format === 'object') body.response_format = { type: 'json_schema', json_schema: { name: 'result', strict: true, schema: format } };
        else if (format === 'json') body.response_format = { type: 'json_object' };
        const data = await this.request('chat/completions', body, signal);
        const choice = Array.isArray(data.choices) ? data.choices[0] as { message?: { content?: unknown } } : undefined;
        if (typeof choice?.message?.content !== 'string') throw new Error('The API returned no text completion.');
        return choice.message.content;
    }

    async unloadModel(model: string): Promise<string | void> {
        if (!this.unsloth) return 'This API does not provide model unloading; memory is managed by the server.';
        // Unsloth extends the compatible API with /v1/unload. Do not force-cancel other chats.
        const data = await this.request('unload', { model_path: model, force_cancel_active: false }, undefined, 300000);
        if (data.status !== 'unloaded') throw new Error('Unsloth did not confirm model unloading.');
    }
}
