// YouTube utility functions

/**
 * Extract YouTube video ID from various URL formats
 */
export function extractYouTubeId(url: string): string | null {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/, // Direct ID
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

/**
 * Get YouTube thumbnail URL
 */
export function getYouTubeThumbnail(videoId: string, quality: 'default' | 'medium' | 'high' | 'maxres' = 'high'): string {
    const qualityMap = {
        default: 'default',
        medium: 'mqdefault',
        high: 'hqdefault',
        maxres: 'maxresdefault',
    };
    return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Get optimized YouTube embed URL with recommended parameters
 */
export function getYouTubeEmbedUrl(videoId: string): string {
    const params = new URLSearchParams({
        rel: '0',           // Don't show related videos from other channels
        modestbranding: '1', // Minimal YouTube branding
        playsinline: '1',   // Play inline on mobile
    });
    return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Check if a URL is a YouTube URL
 */
export function isYouTubeUrl(url: string): boolean {
    return /(?:youtube\.com|youtu\.be)/.test(url);
}

/**
 * Fetch YouTube video metadata from server-side (for use in API routes)
 */
export async function getYouTubeMetadataServer(url: string) {
    if (!isYouTubeUrl(url)) return null;

    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        const response = await fetch(oembedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });

        if (!response.ok) return null;
        const data = await response.json();
        return {
            title: data.title,
            author_name: data.author_name,
            author_url: data.author_url,
            thumbnail_url: data.thumbnail_url
        };
    } catch (err) {
        console.error('Error in getYouTubeMetadataServer:', err);
        return null;
    }
}

/**
 * Fetch YouTube video metadata via server-side proxy (for use in client-side)
 */
export async function fetchYouTubeMetadata(url: string) {
    if (!isYouTubeUrl(url)) return null;

    try {
        const urlObj = new URL(url);
        if (urlObj.pathname === '/' || urlObj.pathname === '') return null;

        const response = await fetch(`/api/youtube/metadata?url=${encodeURIComponent(url)}`);
        if (!response.ok) return null;

        const result = await response.json();
        return result.success ? result.data : null;
    } catch (err) {
        console.error('Error fetching YouTube metadata:', err);
        return null;
    }
}

/**
 * Common generic names for YouTube resources that should be replaced with actual channel names
 */
export const GENERIC_YOUTUBE_NAMES = [
    'youtube',
    'youtube creator',
    'youtube video',
    'unknown creator',
    'creator/provider name',
    'creator name',
    'link',
    'unknown',
    'community'
];

/**
 * Check if a name is a generic placeholder that should be updated
 */
export function isGenericYouTubeName(name: string | null | undefined): boolean {
    if (!name) return true;
    const normalized = name.toLowerCase().trim();
    return GENERIC_YOUTUBE_NAMES.some(generic => normalized.includes(generic)) || normalized === '';
}

/**
 * Deduplicate credits based on name and URL
 */
export function deduplicateCredits<T extends { name: string; url: string }>(credits: T[]): T[] {
    const seen = new Set<string>();
    return credits.filter(credit => {
        const key = `${credit.name.trim().toLowerCase()}|${credit.url.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
