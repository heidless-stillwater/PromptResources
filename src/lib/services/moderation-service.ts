import { adminDb, accreditationDb } from '../firebase-admin';
import { Flag, FlagReason } from '../types';
import { AuditService } from './audit-service';

/**
 * Sovereign Moderation Service
 * Handles content flagging and safety screening in PromptResources.
 */
export const ModerationService = {
    /**
     * Submit a flag for a specific resource.
     */
    async flagResource(params: {
        resourceId: string;
        userId: string;
        userName?: string;
        reason: FlagReason;
        details?: string;
        userEmail: string;
        userRole: string;
    }): Promise<{ success: boolean; flagId?: string }> {
        try {
            const flagData: Omit<Flag, 'id'> = {
                resourceId: params.resourceId,
                userId: params.userId,
                userName: params.userName,
                reason: params.reason,
                details: params.details,
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            const docRef = await adminDb.collection('flags').add(flagData);
            
            // 0. Update Resource Status (Active Gating)
            // If reason is illegal, hide it immediately. Otherwise, mark as flagged.
            const newStatus = params.reason === 'illegal' ? 'hidden' : 'flagged';
            const resourceDoc = await adminDb.collection('resources').doc(params.resourceId).get();
            const resourceData = resourceDoc.data();
            
            await adminDb.collection('resources').doc(params.resourceId).update({
                status: newStatus,
                reportType: params.reason,
                updatedAt: new Date()
            });

            // 0.1 Increment strikes for the contributor
            if (resourceData?.addedBy) {
                const { StrikesService } = await import('./strikes-service');
                await StrikesService.addStrike(resourceData.addedBy, `Resource Flagged: ${params.reason}`);
            }

            // 1. Anchor to the central audit trail
            await AuditService.log({
                actor: params.userEmail,
                action: 'CONTENT_FLAGGED',
                targetType: 'resource',
                targetId: params.resourceId,
                policySlug: 'online-safety-act',
                status: 'warning',
                message: `User flagged resource for: ${params.reason}`,
                details: { flagId: docRef.id, reason: params.reason }
            });

            // 2. Raise a central ticket for Resolution Centre
            // We use 'incident' type for user flags
            await accreditationDb.collection('tickets').add({
                policyId: 'online-safety-act', // Associated with OSA
                policySlug: 'online-safety-act',
                checkId: 'probe-content-moderation',
                status: 'open',
                priority: params.reason === 'illegal' ? 'critical' : 'high',
                severity: 'major',
                type: 'incident',
                title: `Safety Report: ${params.reason.replace(/_/g, ' ').toUpperCase()}`,
                description: `A user reported a resource in PromptResources.\nReason: ${params.reason}\nDetails: ${params.details || 'No additional details provided.'}\nResource ID: ${params.resourceId}`,
                affectedApps: ['promptresources'],
                remediation: {
                    type: 'active_fix',
                    fixId: 'reinstate_content',
                    resourceId: params.resourceId,
                    notes: 'Pending human review. Active Fix will reinstate the content to "published" status.'
                },
                timeline: [
                    {
                        timestamp: new Date(),
                        action: 'Incident Raised',
                        actor: params.userEmail,
                        details: `Flag ID: ${docRef.id}`
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            });

            return { success: true, flagId: docRef.id };
        } catch (error: any) {
            console.error('[ModerationService] Flagging Failed:', error.message);
            return { success: false };
        }
    },

    /**
     * Get the moderation configuration from the local registry.
     */
    async getConfig() {
        const snap = await adminDb.collection('system_config').doc('moderation').get();
        if (!snap.exists) return { flaggingEnabled: false, aiScreening: false };
        return snap.data();
    }
};
