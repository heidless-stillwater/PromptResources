import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date | number) {
    return new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(date));
}

export function truncate(str: string, length: number) {
    if (!str) return '';
    return str.length > length ? `${str.substring(0, length)}...` : str;
}

export function generateSlug(name: string) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
}

export const slugify = generateSlug;

export function extractTokens(text: string): string[] {
    if (!text) return [];
    
    // Split by non-alphanumeric characters and filter out common words
    const stopWords = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'your', 'from']);
    const tokens = new Set<string>();
    
    const rawTokens = text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2 && !stopWords.has(t));
        
    rawTokens.forEach(t => tokens.add(t));
    
    // Add original words to tokens
    text.split(/\s+/).forEach(word => {
        const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanWord.length > 2) tokens.add(cleanWord);
    });

    return Array.from(tokens);
}

/**
 * Generates an array of search keywords for Firestore search.
 * Includes lowercase tokens and prefixes for partial matching.
 */
export function generateSearchKeywords(title: string, categories?: string | string[]): string[] {
    const keywords = new Set<string>();
    
    // Process Title
    if (title) {
        const titleTokens = title.toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(t => t.length > 0);
            
        titleTokens.forEach(token => {
            keywords.add(token);
            // Add prefixes for partial matches
            for (let i = 1; i <= token.length; i++) {
                keywords.add(token.substring(0, i));
            }
        });
        
        // Add whole title tokens without prefixes for exact word match
        titleTokens.forEach(t => keywords.add(t));
    }
    
    // Process Categories
    if (categories) {
        const catArray = Array.isArray(categories) ? categories : [categories];
        catArray.forEach(cat => {
            if (cat) {
                const catLower = cat.toLowerCase();
                keywords.add(catLower);
                catLower.split(/\s+/).forEach(t => {
                    if (t.length > 0) keywords.add(t);
                });
            }
        });
    }
    
    return Array.from(keywords);
}

/**
 * Sanitizes data for client-side consumption by ensuring Firestore Timestamps 
 * are converted to ISO strings and removing any non-serializable content.
 * Handles nested objects and arrays recursively.
 */
export function sanitize<T>(data: T): T {
    if (data === null || data === undefined) return data;

    // Handle Firestore Timestamps
    if (data && typeof (data as any).toDate === 'function') {
        try {
            const d = (data as any).toDate();
            if (isNaN(d.getTime())) return new Date().toISOString() as unknown as T;
            return d.toISOString() as unknown as T;
        } catch (e) {
            console.error('[Sanitize] Failed to convert toDate:', e);
            return new Date().toISOString() as unknown as T;
        }
    }

    // Handle Date objects
    if (data instanceof Date) {
        if (isNaN(data.getTime())) return new Date().toISOString() as unknown as T;
        return data.toISOString() as unknown as T;
    }

    // Handle Arrays
    if (Array.isArray(data)) {
        return data.map(item => sanitize(item)) as unknown as T;
    }

    // Handle Objects (plain objects, not other classes)
    if (typeof data === 'object') {
        // If it's a simple object, sanitize its properties
        const result: any = {};
        for (const [key, value] of Object.entries(data as any)) {
            // Skip non-serializable types like functions
            if (typeof value === 'function') continue;
            result[key] = sanitize(value);
        }
        return result as T;
    }

    return data;
}
