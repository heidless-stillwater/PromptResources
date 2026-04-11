import { NextRequest, NextResponse } from 'next/server';
import { checkFeatureUsage, incrementFeatureUsage } from '@/lib/usage';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');
    const uid = searchParams.get('uid');

    if (!url) {
        return NextResponse.json({ success: false, error: 'Missing url parameter' }, { status: 400 });
    }

    // Validate URL
    try {
        new URL(url);
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 });
    }

    // 1. Gating Check
    if (uid) {
        const { allowed, usageCount, limit } = await checkFeatureUsage(uid, 'extraction');
        if (!allowed) {
            return NextResponse.json({ 
                success: false, 
                error: `Usage limit reached (${usageCount}/${limit}). Upgrade to Pro for unlimited Magic AI extraction.`,
                code: 'LIMIT_REACHED'
            }, { status: 403 });
        }
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            },
            redirect: 'follow',
        });

        if (!response.ok) {
            return NextResponse.json(
                { success: false, error: `Failed to fetch page (HTTP ${response.status})` },
                { status: 502 }
            );
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
            return NextResponse.json(
                { success: false, error: 'URL does not point to an HTML page' },
                { status: 400 }
            );
        }

        const html = await response.text();

        // Extract page title
        const pageTitleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        const pageTitle = pageTitleMatch ? pageTitleMatch[1].trim() : '';

        // Extract all <a> tags with href and text
        const linkRegex = /<a\s+[^>]*href\s*=\s*["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
        const extractedLinks: { url: string; title: string }[] = [];
        const seenUrls = new Set<string>();

        let match;
        while ((match = linkRegex.exec(html)) !== null) {
            let linkUrl = match[1].trim();
            let linkText = match[2]
                .replace(/<[^>]*>/g, '') // strip inner HTML tags
                .replace(/\s+/g, ' ')     // collapse whitespace
                .trim();

            if (!linkUrl ||
                linkUrl.startsWith('javascript:') ||
                linkUrl.startsWith('mailto:') ||
                linkUrl.startsWith('tel:') ||
                linkUrl.startsWith('#')) {
                continue;
            }

            try {
                const resolved = new URL(linkUrl, url);
                linkUrl = resolved.href;
            } catch {
                continue;
            }

            if (seenUrls.has(linkUrl)) continue;

            let title = linkText;
            if (!title || title.length < 2) {
                try {
                    const urlObj = new URL(linkUrl);
                    const path = urlObj.pathname.split('/').filter(Boolean).pop();
                    title = path
                        ? decodeURIComponent(path).replace(/[-_]/g, ' ').replace(/\.\w+$/, '')
                        : urlObj.hostname.replace('www.', '');
                } catch {
                    title = 'Link';
                }
            }

            if (title.length > 80) {
                title = title.substring(0, 77) + '...';
            }

            extractedLinks.push({ url: linkUrl, title });
            seenUrls.add(linkUrl);
        }

        // 2. Increment usage if successful
        if (uid) {
            await incrementFeatureUsage(uid, 'extraction');
        }

        return NextResponse.json({
            success: true,
            data: {
                pageTitle,
                sourceUrl: url,
                links: extractedLinks
            }
        });

    } catch (error) {
        console.error('Error fetching page:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch the page' },
            { status: 500 }
        );
    }
}
