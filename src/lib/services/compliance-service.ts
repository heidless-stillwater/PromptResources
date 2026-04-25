import { accreditationDb } from '../firebase-admin';

/**
 * Sovereign Compliance Sentinel (PromptResources)
 * Monitors the clinical audit status of the suite to enforce real-time gating for assets.
 */
export class ComplianceService {
    /**
     * Verifies if the suite is in a 'Sovereign Gated' state.
     * Checks critical policies (Online Safety Act) for technical enforcement drifts.
     */
    /**
     * Verifies if the suite is in a 'Sovereign Gated' state.
     * Checks all active policies targeted at PromptResources for compliance breaches.
     */
    static async verifySovereignGate(): Promise<{ 
        gated: boolean; 
        status: 'red' | 'amber' | 'green';
        message?: string; 
        breachedPolicies: any[];
    }> {
        try {
            // 1. Fetch ALL Policies from the central Accreditation Hub
            const snap = await accreditationDb.collection('policies').get();
            const allPolicies = snap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

            // 2. Filter for policies that target this app
            const relevantPolicies = allPolicies.filter(p => 
                !p.targetApps || 
                p.targetApps.includes('promptresources') || 
                p.targetApps.includes('all')
            );

            // 3. Collect RED breaches (Hard Lock)
            const redBreaches = relevantPolicies.filter(p => p.status === 'red');
            if (redBreaches.length > 0) {
                return { 
                    gated: true, 
                    status: 'red',
                    message: `Sovereign Lock Active: ${redBreaches.length} critical breach(es) detected. Access is restricted for regulatory compliance.`,
                    breachedPolicies: redBreaches
                };
            }

            // 4. Collect AMBER drifts (Soft Warning)
            const amberDrifts = relevantPolicies.filter(p => p.status === 'amber');
            if (amberDrifts.length > 0) {
                return {
                    gated: false,
                    status: 'amber',
                    message: `Compliance Warning: ${amberDrifts.length} technical drift(s) detected. Integrity restoration required soon.`,
                    breachedPolicies: amberDrifts
                };
            }

            return { gated: false, status: 'green', breachedPolicies: [] };

        } catch (error: any) {
            console.error('[ComplianceService] Sovereign Probe Failure:', error.message);
            // In case of system failure, we fail-closed for safety.
            return { 
                gated: true, 
                status: 'red', 
                message: 'Security Lock: A connection error occurred while verifying compliance.',
                breachedPolicies: [] 
            };
        }
    }
}
