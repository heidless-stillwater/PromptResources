
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const videoId = searchParams.get('videoId');

    if (!videoId) {
        return NextResponse.json({ success: false, error: 'Missing videoId' }, { status: 400 });
    }

    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9',
            },
        });

        const html = await response.text();

        // Extract description from ytInitialPlayerResponse
        const jsonMatch = html.match(/var ytInitialPlayerResponse = ({.+?});/);
        let description = '';

        if (jsonMatch && jsonMatch[1]) {
            try {
                const data = JSON.parse(jsonMatch[1]);
                description = data?.videoDetails?.shortDescription || '';
            } catch (e) {
                console.error('Failed to parse ytInitialPlayerResponse', e);
            }
        }

        // Fallback: Try meta tag
        if (!description) {
            const metaMatch = html.match(/<meta name="description" content="([^"]*)"/);
            if (metaMatch) {
                description = metaMatch[1];
            }
        }

        if (!description) {
            return NextResponse.json({ success: false, error: 'Could not extract description' }, { status: 404 });
        }

        // Extract links and context from description
        const lines = description.split('\n');
        const extractedLinks: { url: string; title: string }[] = [];
        const seenUrls = new Set<string>();

        const urlRegex = /(https?:\/\/[^\s]+)/g;

        lines.forEach(line => {
            const matches = line.match(urlRegex);
            if (matches) {
                matches.forEach(url => {
                    if (seenUrls.has(url)) return;

                    // Attempt to get title from text before the URL
                    let title = line.replace(url, '').trim();

                    // Cleanup title
                    // Remove leading/trailing special chars commonly used as separators
                    title = title.replace(/^[:\-\s\u2022]+|[:\-\s\u2022]+$/g, '');

                    // Try to generate a title if empty
                    if (!title) {
                        try {
                            const urlObj = new URL(url);
                            title = urlObj.hostname.replace('www.', '');
                        } catch {
                            title = 'Link';
                        }
                    } else {
                        // limit title length
                        if (title.length > 50) title = title.substring(0, 47) + '...';
                    }

                    extractedLinks.push({ url, title });
                    seenUrls.add(url);
                });
            }
        });

        return NextResponse.json({
            success: true,
            data: {
                description,
                links: extractedLinks
            }
        });

    } catch (error) {
        console.error('Error fetching YouTube page:', error);
        return NextResponse.json({ success: false, error: 'Failed to fetch YouTube page' }, { status: 500 });
    }
}
