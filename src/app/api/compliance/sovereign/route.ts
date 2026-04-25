import { NextResponse } from 'next/server';
import { ComplianceService } from '@/lib/services/compliance-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/compliance/sovereign
 * Returns the current suite-wide sovereign lock status.
 * Used by the SovereignSentinel to enforce GATT (Gated Access & Technical Telemetry).
 */
export async function GET() {
    try {
        const { gated, status, message, breachedPolicies } = await ComplianceService.verifySovereignGate();
        
        return NextResponse.json({ 
            gated, 
            status,
            message: message || (status === 'green' ? 'Sovereign Status: Nominal' : 'Sovereign Compliance Breach Detected.'),
            breachedPolicies,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('[SovereignAPI] Unexpected failure:', error.message);
        return NextResponse.json({
            success: false,
            gated: true,
            message: 'Internal Sovereign Failure: Access restricted for safety.'
        }, { status: 500 });
    }
}
