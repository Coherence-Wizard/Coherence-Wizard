import { OllamaService } from './ollama';
import { OpenAICompatibleService } from './openai-compatible';

export interface AIConnectionSettings {
    aiProvider: 'ollama' | 'unsloth' | 'openai-compatible';
    ollamaUrl: string;
    openaiBaseUrl: string;
    openaiApiKey: string;
}

export interface AIService {
    listModels(): Promise<string[]>;
    getModels(): Promise<string[]>;
    generate(model: string, prompt: string, options?: Record<string, unknown>, signal?: AbortSignal): Promise<string>;
    chat(model: string, messages: { role: string; content: string }[], format?: Record<string, unknown> | string, options?: Record<string, unknown>): Promise<string>;
    unloadModel(model: string): Promise<string | void>;
}

export function createAIService(settings: AIConnectionSettings): AIService {
    return settings.aiProvider === 'unsloth' || settings.aiProvider === 'openai-compatible'
        ? new OpenAICompatibleService(settings.openaiBaseUrl, settings.openaiApiKey, settings.aiProvider === 'unsloth')
        : new OllamaService(settings.ollamaUrl);
}
