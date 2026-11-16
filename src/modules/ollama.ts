import { requestUrl } from 'obsidian';
import { request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';

export class OllamaService {
    constructor(private baseUrl: string) { }

    async listModels(): Promise<string[]> {
        try {
            const response = await requestUrl({
                url: `${this.baseUrl}/api/tags`,
                method: 'GET'
            });

            if (response.status === 200) {
                const data = response.json as { models: { name: string }[] };
                return data.models.map((m: { name: string }) => m.name);
            }
            return [];
        } catch (e) {
            console.error('Failed to list models', e);
            return [];
        }
    }

    async getModels(): Promise<string[]> {
        return this.listModels();
    }

    async generate(model: string, prompt: string, options?: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
        // requestUrl cannot abort a running request. This desktop-only plugin uses
        // Node's transport for cancellable jobs, avoiding browser CORS restrictions.
        if (signal) {
            const data = await this.postCancellable({ model, prompt, stream: false, ...options }, signal);
            if (typeof data.response !== 'string') throw new Error('Ollama returned no response text.');
            return data.response;
        }
        try {
            const response = await requestUrl({
                url: `${this.baseUrl}/api/generate`,
                method: 'POST',
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: false,
                    ...options
                })
            });

            if (response.status === 200) {
                const data = response.json as { response: string };
                return data.response;
            }
            throw new Error(`Ollama API Error: ${response.status}`);
        } catch (e) {
            console.error('Ollama generation failed', e);
            throw e;
        }
    }

    async unloadModel(model: string): Promise<void> {
        const data = await this.postCancellable({ model, stream: false, keep_alive: 0 }, undefined, 30000);
        if (data.done !== true) throw new Error('Ollama did not confirm the unload request.');
    }

    private postCancellable(body: Record<string, unknown>, signal?: AbortSignal, timeoutMs = 1800000): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            const url = new URL(`${this.baseUrl.replace(/\/$/, '')}/api/generate`);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                reject(new Error('Ollama URL must use HTTP or HTTPS.'));
                return;
            }
            const payload = JSON.stringify(body);
            const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
                method: 'POST', signal,
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
            }, response => {
                let text = '';
                response.setEncoding('utf8');
                response.on('data', (chunk: string) => { text += chunk; });
                response.on('error', reject);
                response.on('end', () => {
                    try {
                        const data = JSON.parse(text) as Record<string, unknown>;
                        if (response.statusCode !== 200 || data.error) {
                            reject(new Error(`Ollama error: ${typeof data.error === 'string' ? data.error : response.statusCode}`));
                        } else resolve(data);
                    } catch { reject(new Error(`Invalid response from Ollama (HTTP ${response.statusCode}).`)); }
                });
            });
            request.on('error', reject);
            request.setTimeout(timeoutMs, () => request.destroy(new Error('Ollama request timed out.')));
            request.end(payload);
        });
    }

    async chat(model: string, messages: { role: string, content: string }[], format?: Record<string, unknown> | string, options?: Record<string, unknown>): Promise<string> {
        try {
            const body: Record<string, unknown> = {
                model: model,
                messages: messages,
                stream: false,
                ...options
            };

            if (format) {
                body.format = format;
            }

            const response = await requestUrl({
                url: `${this.baseUrl}/api/chat`,
                method: 'POST',
                body: JSON.stringify(body)
            });

            if (response.status === 200) {
                const data = response.json as { message: { role: string; content: string } };
                return data.message.content;
            }
            throw new Error(`Ollama API Error: ${response.status}`);
        } catch (e) {
            console.error('Ollama chat failed', e);
            throw e;
        }
    }
}
