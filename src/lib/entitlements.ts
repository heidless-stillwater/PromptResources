import { adminDb } from './firebase-admin';

export type AppSuiteType = 'resources' | 'studio' | 'registry';

export interface UserEntitlement {
    uid: string;
    tier: 'free' | 'standard' | 'pro' | 'admin';
    activeSuites: AppSuiteType[];
    isCanceled: boolean;
    expiresAt?: Date;
}

/**
 * ENTITLEMENT HELPER
 * Checks if a user has access to a specific application in the suite.
 * This function can be copied to PromptTool and PromptMaster.
 * 
 * @param uid User ID
 * @param app The app being accessed
 * @returns boolean access granted
 */
export async function checkAppAccess(uid: string, app: AppSuiteType): Promise<boolean> {
    try {
        // ALWAYS query the '(default)' database for identity
        // This ensures consistent state even if the app uses a different DB instance locally
        const userDoc = await adminDb.collection('users').doc(uid).get();
        
        if (!userDoc.exists) return false;
        const data = userDoc.data();

        // 1. Admins have access to everything
        if (data?.role === 'admin' || data?.role === 'su') return true;

        // 2. Check suite array
        const activeSuites = data?.subscription?.activeSuites || [];
        if (activeSuites.includes(app)) return true;

        // 3. Special case for 'resources' (public discovery is usually free)
        if (app === 'resources' && data?.role === 'member') return true;

        return false;
    } catch (error) {
        console.error(`Entitlement check failed for ${uid} on app ${app}:`, error);
        return false;
    }
}

/**
 * Formats user plan metadata for consistent UI display across the suite.
 */
export function getPlanDisplay(tier: string, suites: string[]) {
    if (tier === 'admin') return 'Nexus Administrator';
    if (suites.length >= 3) return 'Full Suite Professional';
    if (suites.length === 0) return 'Community Explorer';
    return `${tier.charAt(0).toUpperCase() + tier.slice(1)} Plan`;
}
