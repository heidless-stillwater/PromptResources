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

/**
 * Sanitize data for Server-to-Client serialization (Next.js 15 App Router).
 * Converts Dates/Timestamps to ISO strings and ensures plain objects.
 */
export function sanitize<T>(data: T): T {
    if (data === null || data === undefined) return data;
    
    // Handle Firestore Timestamps and native Dates
    if (typeof (data as any).toDate === 'function') {
        return (data as any).toDate().toISOString() as unknown as T;
    }
    if (data instanceof Date) {
        return data.toISOString() as unknown as T;
    }
    
    // Handle Arrays
    if (Array.isArray(data)) {
        return data.map(sanitize) as unknown as T;
    }
    
    // Handle Objects
    if (typeof data === 'object') {
        // Create a truly plain object to strip null prototypes or class prototypes
        const plainObj: any = {};
        for (const [key, value] of Object.entries(data as any)) {
            // Skip non-serializable types like functions
            if (typeof value === 'function') continue;
            plainObj[key] = sanitize(value);
        }
        return plainObj as T;
    }
    
    return data;
}
