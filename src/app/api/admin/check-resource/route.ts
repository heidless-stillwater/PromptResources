import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ message: 'Debug utility deactivated.' });
}
