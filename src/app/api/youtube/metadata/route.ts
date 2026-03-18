import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const url = searchParams.get('url');

    if (!url) {
        return NextResponse.json({ success: false, error: 'Missing url' }, { status: 400 });
    }

    try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
        let response = await fetch(oembedUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            },
        });

        let data = null;

        if (response.ok) {
            data = await response.json();
        } else {
            // Fallback to noembed for Vercel/Cloud environments getting blocked by YouTube
            const noembedUrl = `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
            const noembedResponse = await fetch(noembedUrl);
            if (noembedResponse.ok) {
                const noembedData = await noembedResponse.json();
                if (!noembedData.error) {
                    data = noembedData;
                }
            }
        }

        if (!data) {
            // For channel URLs, oEmbed might fail. Extract handle if possible
            if (url.includes('/@')) {
                const handle = url.split('/@')[1].split('/')[0];
                return NextResponse.json({
                    success: true,
                    data: {
                        title: '',
                        author_name: handle,
                        author_url: url,
                        thumbnail_url: ''
                    }
                });
            }
            return NextResponse.json({ success: false, error: 'Failed to fetch YouTube metadata' }, { status: response.status || 500 });
        }

        return NextResponse.json({
            success: true,
            data: {
                title: data.title || '',
                author_name: data.author_name || '',
                author_url: data.author_url || '',
                thumbnail_url: data.thumbnail_url || ''
            }
        });
    } catch (error) {
        console.error('Error fetching YouTube metadata:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
