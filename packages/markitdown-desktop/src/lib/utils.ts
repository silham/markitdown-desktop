import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rough token estimate: ~4 characters per token (GPT-4 average). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Format a token count for display, e.g. 12345 → "12.3k" */
export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return count.toString();
}
