// AI suggestion utilities for categories and credits
import { Credit } from '@/lib/types';

// Common AI prompt-related categories
const CATEGORY_KEYWORDS: Record<string, string[]> = {
    'Prompt Engineering': ['prompt', 'engineering', 'design', 'craft', 'write', 'create'],
    'Image Generation': ['image', 'picture', 'visual', 'art', 'illustration', 'dalle', 'midjourney', 'stable diffusion'],
    'Text Generation': ['text', 'writing', 'content', 'copy', 'article', 'blog'],
    'Code Generation': ['code', 'programming', 'developer', 'coding', 'software', 'github'],
    'Video Generation': ['video', 'animation', 'motion', 'film'],
    'Audio Generation': ['audio', 'music', 'sound', 'voice', 'speech'],
    'Chatbot Development': ['chatbot', 'chat', 'conversational', 'assistant', 'dialog'],
    'API Integration': ['api', 'integration', 'endpoint', 'rest', 'sdk'],
    'Best Practices': ['best practice', 'tip', 'trick', 'guide', 'tutorial', 'how to'],
    'Advanced Techniques': ['advanced', 'technique', 'pro', 'expert', 'master'],
    'Beginner Guide': ['beginner', 'start', 'intro', 'basic', 'fundamental', 'learn'],
    'Use Cases': ['case study', 'use case', 'example', 'real world', 'practical'],
    'Comparison': ['compare', 'comparison', 'vs', 'versus', 'difference'],
    'News & Updates': ['news', 'update', 'release', 'announcement', 'new feature'],
    'Research': ['research', 'paper', 'study', 'academic', 'scientific'],
    'Tools & Plugins': ['tool', 'plugin', 'extension', 'addon', 'utility'],
    'Templates': ['template', 'preset', 'library', 'collection', 'pack'],
    'Workflow': ['workflow', 'automation', 'pipeline', 'process'],
    'Gemini': ['gemini', 'google ai', 'bard'],
    'NanoBanana': ['nanobanana', 'nano banana'],
    'ChatGPT': ['chatgpt', 'openai', 'gpt'],
    'Claude': ['claude', 'anthropic'],
    'Midjourney': ['midjourney'],
};

// Known resource providers
const KNOWN_PROVIDERS: Record<string, { name: string; url: string }> = {
    'youtube.com': { name: 'YouTube', url: 'https://youtube.com' },
    'medium.com': { name: 'Medium', url: 'https://medium.com' },
    'github.com': { name: 'GitHub', url: 'https://github.com' },
    'openai.com': { name: 'OpenAI', url: 'https://openai.com' },
    'google.com': { name: 'Google', url: 'https://google.com' },
    'ai.google': { name: 'Google AI', url: 'https://ai.google' },
    'anthropic.com': { name: 'Anthropic', url: 'https://anthropic.com' },
    'huggingface.co': { name: 'Hugging Face', url: 'https://huggingface.co' },
    'udemy.com': { name: 'Udemy', url: 'https://udemy.com' },
    'coursera.org': { name: 'Coursera', url: 'https://coursera.org' },
    'arxiv.org': { name: 'arXiv', url: 'https://arxiv.org' },
    'dev.to': { name: 'DEV Community', url: 'https://dev.to' },
    'hashnode.com': { name: 'Hashnode', url: 'https://hashnode.com' },
    'prompthero.com': { name: 'PromptHero', url: 'https://prompthero.com' },
};

/**
 * Suggest categories based on title, description, and URL
 */
export function suggestCategories(title: string, description: string = '', url: string = ''): string[] {
    const text = `${title} ${description} ${url}`.toLowerCase();
    const suggestions: { category: string; score: number }[] = [];

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        let score = 0;
        for (const keyword of keywords) {
            if (text.includes(keyword)) {
                score += 1;
                // Boost score for title matches
                if (title.toLowerCase().includes(keyword)) {
                    score += 2;
                }
            }
        }
        if (score > 0) {
            suggestions.push({ category, score });
        }
    }

    // Sort by score descending, return top 5
    return suggestions
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((s) => s.category);
}

/**
 * Suggest credits based on URL and title
 */
export function suggestCredits(url: string, title: string = ''): Credit[] {
    const credits: Credit[] = [];

    // Check URL domain against known providers
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname.replace('www.', '');

        for (const [providerDomain, provider] of Object.entries(KNOWN_PROVIDERS)) {
            if (domain.includes(providerDomain)) {
                credits.push(provider);
                break;
            }
        }

        // For YouTube, try to extract channel info from URL
        if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
            // Add a placeholder for YouTube channel
            credits.push({
                name: 'YouTube Creator',
                url: url,
            });
        }
    } catch {
        // Invalid URL, skip domain checking
    }

    // If no credits found, suggest based on title keywords
    if (credits.length === 0 && title) {
        const titleLower = title.toLowerCase();
        for (const [, provider] of Object.entries(KNOWN_PROVIDERS)) {
            if (titleLower.includes(provider.name.toLowerCase())) {
                credits.push(provider);
            }
        }
    }

    return credits;
}

/**
 * Get all available categories (for dropdown)
 */
export function getDefaultCategories(): string[] {
    return Object.keys(CATEGORY_KEYWORDS).sort();
}
