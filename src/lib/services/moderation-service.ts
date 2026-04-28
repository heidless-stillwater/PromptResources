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
            
            
            // Generate ticket ID first so we can link it
            const ticketRef = accreditationDb.collection('tickets').doc();
            const ticketId = ticketRef.id;

            // 1. Raise a central ticket for Resolution Centre first
            // We use 'incident' type for user flags
            const isFeedback = params.reason === 'other';
            await accreditationDb.collection('tickets').doc(ticketId).set({
                policyId: 'online-safety-act', // Associated with OSA
                policySlug: 'online-safety-act',
                checkId: 'probe-content-moderation',
                status: 'open',
                priority: params.reason === 'illegal' ? 'critical' : (isFeedback ? 'low' : 'high'),
                severity: isFeedback ? 'minor' : 'major',
                type: isFeedback ? 'suggestion' : 'incident',
                title: isFeedback ? 'General Feedback' : `Safety Report: ${params.reason.replace(/_/g, ' ').toUpperCase()}`,
                description: isFeedback 
                    ? `A user provided general feedback for a resource.\nDetails: ${params.details || 'No additional details provided.'}\nResource ID: ${params.resourceId}`
                    : `A user reported a resource in PromptResources.\nReason: ${params.reason}\nDetails: ${params.details || 'No additional details provided.'}\nResource ID: ${params.resourceId}`,
                affectedApps: ['promptresources'],
                remediation: isFeedback ? {
                    type: 'no_action',
                    resourceId: params.resourceId,
                    notes: 'General feedback submission. No automated fix required — for admin review only.'
                } : {
                    type: 'active_fix',
                    fixId: 'reinstate_content',
                    resourceId: params.resourceId,
                    notes: 'Pending human review. Active Fix will reinstate the content to "published" status.'
                },
                timeline: [
                    {
                        timestamp: new Date(),
                        action: isFeedback ? 'Feedback Received' : 'Incident Raised',
                        actor: params.userEmail,
                        details: `Flag ID: ${docRef.id}`
                    }
                ],
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // 2. Update Resource Status (Active Gating)
            // If reason is illegal, hide it. If general feedback, KEEP published. Otherwise, flagged.
            const resourceDoc = await adminDb.collection('resources').doc(params.resourceId).get();
            const resourceData = resourceDoc.data();
            const newStatus = params.reason === 'illegal' ? 'hidden' : (isFeedback ? (resourceData?.status || 'published') : 'flagged');
            
            await adminDb.collection('resources').doc(params.resourceId).update({
                status: newStatus,
                reportType: params.reason,
                activeTicketId: ticketId, // Always link so UI can show the status/link
                updatedAt: new Date()
            });

            // 3. Anchor to the central audit trail
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

            // 3.1 Increment strikes for the contributor (only for actual violations, not general feedback)
            if (resourceData?.addedBy && params.reason !== 'other') {
                const { StrikesService } = await import('./strikes-service');
                await StrikesService.addStrike(resourceData.addedBy, `Resource Flagged: ${params.reason}`);
            }

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
