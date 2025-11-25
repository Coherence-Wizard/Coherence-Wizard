import { requestUrl, RequestUrlParam } from 'obsidian';

export class OllamaService {
    constructor(private baseUrl: string) { }

    async listModels(): Promise<string[]> {
        try {
            const response = await requestUrl({
                url: `${this.baseUrl}/api/tags`,
                method: 'GET'
            });

            if (response.status === 200) {
                const data = response.json;
                return data.models.map((m: any) => m.name);
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

    async generate(model: string, prompt: string, options?: any): Promise<string> {
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
                return response.json.response;
            }
            throw new Error(`Ollama API Error: ${response.status}`);
        } catch (e) {
            console.error('Ollama generation failed', e);
            throw e;
        }
    }

    async chat(model: string, messages: { role: string, content: string }[], format?: any, options?: any): Promise<string> {
        try {
            const body: any = {
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
                return response.json.message.content;
            }
            throw new Error(`Ollama API Error: ${response.status}`);
        } catch (e) {
            console.error('Ollama chat failed', e);
            throw e;
        }
    }
}
