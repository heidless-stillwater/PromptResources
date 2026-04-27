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

        let data = null;

        if (response.ok) {
            data = await response.json();
        } else {
            const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
            const noembedResponse = await fetch(noembedUrl);
            if (noembedResponse.ok) {
                const noembedData = await noembedResponse.json();
                if (!noembedData.error) {
                    data = noembedData;
                }
            }
        }

        if (!data) return null;

        return {
            title: data.title || '',
            author_name: data.author_name || '',
            author_url: data.author_url || '',
            thumbnail_url: data.thumbnail_url || ''
        };
    } catch (err) {
        console.error('Error in getYouTubeMetadataServer:', err);
        return null;
    }
}

/**
 * Attempt to get the creator's avatar (profile picture) from a YouTube channel or video
 */
export async function getYouTubeAvatar(url: string): Promise<string | null> {
    if (!isYouTubeUrl(url)) return null;

    try {
        console.log(`[getYouTubeAvatar] START: ${url}`);
        // 1. Try to get metadata first (gives us the author_url)
        const metadata = await getYouTubeMetadataServer(url);
        if (!metadata || !metadata.author_url) {
            console.log(`[getYouTubeAvatar] WARN: No metadata or author_url found for ${url}`);
            return null;
        }

        console.log(`[getYouTubeAvatar] FETCHING_CHANNEL: ${metadata.author_url}`);
        // 2. Fetch the author's page to scrape the profile image
        const channelResponse = await fetch(metadata.author_url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        if (!channelResponse.ok) {
            console.log(`[getYouTubeAvatar] ERROR: Channel fetch failed with status ${channelResponse.status}`);
            return null;
        }

        const html = await channelResponse.text();
        
        // Match <meta property="og:image" content="...">
        const ogImageMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);
        if (ogImageMatch && ogImageMatch[1]) {
            console.log(`[getYouTubeAvatar] SUCCESS (og:image): ${ogImageMatch[1]}`);
            return ogImageMatch[1];
        }

        // Fallback: look for twitter:image
        const twitterImageMatch = html.match(/<meta\s+name="twitter:image"\s+content="([^"]+)"/i);
        if (twitterImageMatch && twitterImageMatch[1]) {
            console.log(`[getYouTubeAvatar] SUCCESS (twitter:image): ${twitterImageMatch[1]}`);
            return twitterImageMatch[1];
        }

        console.log(`[getYouTubeAvatar] FAIL: No avatar image found in HTML`);
        return null;
    } catch (err) {
        console.error('[getYouTubeAvatar] CRASH:', err);
        return null;
    }
}

/**
 * Fetch YouTube video metadata via server-side proxy (for use in client-side)
 */
export async function fetchYouTubeMetadata(url: string) {
    if (!isYouTubeUrl(url)) return null;

    try {
        const response = await fetch(`/api/youtube/metadata?url=${encodeURIComponent(url)}`);
        if (!response.ok) return null;

        const result = await response.json();
        return result.success ? result.data : null;
    } catch (error) {
        console.error('Error fetching YouTube metadata:', error);
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
 * Deduplicate attributions based on name and URL
 */
export function deduplicateAttributions<T extends { name: string; url: string }>(attributions: T[]): T[] {
    const seen = new Set<string>();
    return attributions.filter(attribution => {
        const key = `${attribution.name.trim().toLowerCase()}|${attribution.url.trim().toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}
