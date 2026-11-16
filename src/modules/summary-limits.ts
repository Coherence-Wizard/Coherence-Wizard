/** Counts and limits use whitespace-separated words, consistently across both fields. */
export function summaryWordCount(text: string): number {
    return text.trim() ? text.trim().split(/\s+/).length : 0;
}

export function validSummaryWordLimit(value: number): boolean {
    return Number.isSafeInteger(value) && value >= 1 && value <= 10000;
}

export function summaryWordLimit(value: number | undefined, fallback: number): number {
    if (value === undefined) return fallback;
    if (!validSummaryWordLimit(value)) throw new Error('Summary word limits must be whole numbers from 1 to 10000.');
    return value;
}
