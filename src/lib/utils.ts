import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Replace spaces with -
        .replace(/[^\w-]+/g, '')  // Remove all non-word chars
        .replace(/--+/g, '-');    // Replace multiple - with single -
}

/**
 * Generates an array of unique lowercase tokens for Firestore indexing.
 */
export function generateSearchKeywords(title: string, categories: string[] = []): string[] {
    const tokens = new Set<string>();
    
    // Process Title
    if (title) {
        title.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(t => t.length >= 2)
            .forEach(t => tokens.add(t));
    }

    // Process Categories
    categories.forEach(cat => {
        cat.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .filter(t => t.length >= 2)
            .forEach(t => tokens.add(t));
    });

    return Array.from(tokens);
}
