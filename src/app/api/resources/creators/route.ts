import { NextResponse } from 'next/server';
import { getAllCreators } from '@/lib/creators-server';
import { adminAuth } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam) : 200;

        // Fetch all potential creators (Public, Stubs, or with resources)
        const creators = await getAllCreators({ limit });

        return NextResponse.json({
            success: true,
            data: creators
        });
    } catch (error: any) {
        console.error('Error in creators API:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch creators registry' },
            { status: 500 }
        );
    }
}
