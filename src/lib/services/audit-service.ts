import { accreditationDb } from '../firebase-admin';

export interface AuditLogEntry {
    id?: string;
    timestamp: Date;
    actor: string;
    action: string;
    targetType: 'resource' | 'user' | 'system' | 'policy';
    targetId: string;
    policySlug?: string;
    status: 'success' | 'failure' | 'warning';
    message: string;
    details?: any;
    appContext: 'promptresources';
}

/**
 * Sovereign Audit Service (PromptResources Proxy)
 * Anchors critical events to the PromptAccreditation central registry.
 */
export const AuditService = {
    /**
     * Write an immutable audit log entry to the central registry.
     */
    async log(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'appContext'>): Promise<void> {
        try {
            await accreditationDb.collection('audit_log').add({
                ...entry,
                timestamp: new Date(),
                appContext: 'promptresources'
            });
            console.log(`[AuditService] Event Logged: ${entry.action} on ${entry.targetType}/${entry.targetId}`);
        } catch (error: any) {
            console.error('[AuditService] Critical Failure: Could not anchor audit log:', error.message);
            // In a real sovereign system, this might trigger a local fail-safe log
        }
    }
};
