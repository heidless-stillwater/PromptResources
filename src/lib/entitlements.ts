import { toolDbAdmin } from './firebase-admin';

export type AppSuiteType = 'resources' | 'studio' | 'prompttool' | 'registry';

export interface UserEntitlement {
    uid: string;
    tier: 'free' | 'standard' | 'pro' | 'admin';
    activeSuites: AppSuiteType[];
    isCanceled: boolean;
    expiresAt?: Date;
}

/**
 * ENTITLEMENT HELPER
 * Checks access against the global Identity Store (database: 'prompttool-db-0').
 * 
 * @param uid User ID
 * @param app The app being accessed
 * @returns boolean access granted
 */
export async function checkAppAccess(uid: string, app: AppSuiteType): Promise<boolean> {
    try {
        // ALWAYS query the 'prompttool-db-0' database for identity across the suite
        const userDoc = await toolDbAdmin.collection('users').doc(uid).get();
        
        if (!userDoc.exists) return false;
        const data = userDoc.data();

        // 1. Admins have access to everything
        if (data?.role === 'admin' || data?.role === 'su') return true;

        // 2. Read activeSuites from unified Firestore fields
        const subscriptionObj =
            data?.suiteSubscription ||
            data?.subscriptionMetadata ||
            (typeof data?.subscription === 'object' ? data?.subscription : null);

        const activeSuites: string[] = subscriptionObj?.activeSuites || [];

        // Direct match
        if (activeSuites.includes(app)) return true;

        // 3. Special case for 'resources' (public discovery is usually free for members)
        if (app === 'resources' && data?.role === 'member') return true;

        // 4. studio ↔ prompttool interchangeable logic (optional here, but keeps parity)
        if (app === 'studio' && activeSuites.includes('prompttool')) return true;
        if (app === 'prompttool' && activeSuites.includes('studio')) return true;

        // 5. Legacy SubscriptionTier fallback
        const tier = typeof data?.subscription === 'string' ? data.subscription : null;
        if ((app === 'studio' || app === 'prompttool' || app === 'resources') &&
            (tier === 'pro' || tier === 'standard')) {
            return true;
        }

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
