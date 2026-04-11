import { NextRequest, NextResponse } from 'next/server';
import { enrichResourceMetadata } from '@/lib/ai-enrichment';
import { adminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    try {
        // Auth check (Optional: Limit to logged-in users or admins)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        try {
            await adminAuth.verifyIdToken(token);
        } catch (authError) {
            return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
        }

        const body = await req.json();
        const { url, title, description } = body;

        if (!url) {
            return NextResponse.json({ success: false, error: 'URL is required' }, { status: 400 });
        }

        // Pre-flight check: Is the URL reachable?
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout
            
            const checkRes = await fetch(url, { 
                method: 'HEAD', 
                signal: controller.signal,
                headers: { 'User-Agent': 'Stillwater-Resource-Bot/1.0' }
            });
            
            clearTimeout(timeoutId);
            
            if (!checkRes.ok && checkRes.status !== 405) { // 405 Method Not Allowed is common for HEAD, so we allow it
                 // If HEAD fails, try a GET with range
                 const getRes = await fetch(url, { method: 'GET', headers: { 'Range': 'bytes=0-0' } });
                 if (!getRes.ok) {
                     return NextResponse.json({ success: false, error: 'The provided URL is unreachable or invalid.' }, { status: 400 });
                 }
            }
        } catch (e) {
            return NextResponse.json({ success: false, error: 'Could not reach the provided URL. Please check for typos.' }, { status: 400 });
        }

        const enrichedData = await enrichResourceMetadata(url, { title, description });

        return NextResponse.json({
            success: true,
            data: enrichedData
        });
    } catch (error: any) {
        console.error('[AI Enrichment API] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'AI Enrichment failed'
        }, { status: 500 });
    }
}
