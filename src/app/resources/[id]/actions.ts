'use server';

import { accreditationDb, adminDb } from '@/lib/firebase-admin';
import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'debug_fix.log');

function logDebug(msg: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${msg}\n`);
}

export async function triggerTicketFixAction(ticketId: string) {
  try {
    logDebug(`Triggering fix for Ticket: ${ticketId}`);
    
    // 1. Fetch Ticket from Accreditation
    const ticketDoc = await accreditationDb.collection('tickets').doc(ticketId).get();
    if (!ticketDoc.exists) {
      logDebug(`Ticket ${ticketId} not found`);
      return { success: false, message: 'Ticket not found in Accreditation Hub.' };
    }

    const ticketData = ticketDoc.data() as any;
    const fixId = ticketData.remediation?.fixId;
    const resourceId = ticketData.remediation?.resourceId;

    logDebug(`FixId: ${fixId}, ResourceId: ${resourceId}`);

    if (!fixId) {
      logDebug(`No fixId for ticket ${ticketId}`);
      return { success: false, message: `No automated fix defined for this ticket (FixId: ${fixId}).` };
    }

    // 2. Execute Specific Fix Logic
    if (fixId === 'reinstate_content' && resourceId) {
      logDebug(`Executing reinstate_content for ${resourceId}`);
      // Reinstatement logic for PromptResources
      await adminDb.collection('resources').doc(resourceId).update({
        status: 'published',
        reportType: null,
        updatedAt: FieldValue.serverTimestamp() as any,
        reinstatedAt: FieldValue.serverTimestamp() as any,
        reinstatedBy: 'Sovereign_Admin'
      });

      // Update Ticket Status in Accreditation
      await accreditationDb.collection('tickets').doc(ticketId).update({
        status: 'resolved',
        'remediation.resolvedAt': FieldValue.serverTimestamp(),
        'remediation.resolvedBy': 'Sovereign_Admin',
        'remediation.notes': 'Content reinstated via Active Fix protocol.'
      });

      revalidatePath(`/resources/${resourceId}`);
      logDebug(`SUCCESS: Resource ${resourceId} reinstated.`);
      return { success: true, message: 'Resource reinstated successfully.' };
    }

    if (fixId === 'archive_content' && resourceId) {
      logDebug(`Executing archive_content for ${resourceId}`);
      // Archive logic
      await adminDb.collection('resources').doc(resourceId).update({
        status: 'archived',
        reportType: null,
        updatedAt: FieldValue.serverTimestamp() as any,
        archivedAt: FieldValue.serverTimestamp() as any
      });

      // Update Ticket Status
      await accreditationDb.collection('tickets').doc(ticketId).update({
        status: 'resolved',
        'remediation.resolvedAt': FieldValue.serverTimestamp(),
        'remediation.resolvedBy': 'Sovereign_Admin',
        'remediation.notes': 'Content archived as tainted via Active Fix protocol.'
      });

      revalidatePath(`/resources/${resourceId}`);
      logDebug(`SUCCESS: Resource ${resourceId} archived.`);
      return { success: true, message: 'Resource archived successfully.' };
    }

    // Add more fix handlers here as needed (encryption, av_gateway, etc.)
    // For many systemic fixes, we'd call TechnicalEnforcer methods if they were shared.

    return { success: false, message: `Fix handler for '${fixId}' not yet implemented in Resource Hub.` };

  } catch (error: any) {
    logDebug(`Fix Execution Failed: ${error.message}`);
    console.error('[ResourcesAction] Fix Execution Failed:', error);
    return { success: false, message: error.message };
  }
}
