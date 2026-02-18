import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ success: false, error: 'Missing url parameter' }, { status: 400 });
    }

    // Validate URL
    try {
        new URL(url);
    } catch {
        return NextResponse.json({ success: false, error: 'Invalid URL' }, { status: 400 });
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

            // Skip empty hrefs, javascript:, mailto:, tel:, and anchors
            if (!linkUrl ||
                linkUrl.startsWith('javascript:') ||
                linkUrl.startsWith('mailto:') ||
                linkUrl.startsWith('tel:') ||
                linkUrl.startsWith('#')) {
                continue;
            }

            // Resolve relative URLs
            try {
                const resolved = new URL(linkUrl, url);
                linkUrl = resolved.href;
            } catch {
                continue;
            }

            // Skip duplicates
            if (seenUrls.has(linkUrl)) continue;

            // Generate title
            let title = linkText;
            if (!title || title.length < 2) {
                // Try to get title from URL path
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

            // Limit title length
            if (title.length > 80) {
                title = title.substring(0, 77) + '...';
            }

            extractedLinks.push({ url: linkUrl, title });
            seenUrls.add(linkUrl);
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
            { success: false, error: 'Failed to fetch the page. Please check the URL and try again.' },
            { status: 500 }
        );
    }
}
