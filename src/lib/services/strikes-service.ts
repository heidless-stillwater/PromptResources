import { toolDbAdmin } from '../firebase-admin';

/**
 * Strikes Service
 * Handles contributor accountability metrics across the suite.
 */
export const StrikesService = {
    /**
     * Increment strike count for a user.
     */
    async addStrike(userId: string, reason: string): Promise<number> {
        try {
            const userRef = toolDbAdmin.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) return 0;
            
            const currentStrikes = userDoc.data()?.strikes || 0;
            const newStrikes = currentStrikes + 1;
            
            await userRef.update({ 
                strikes: newStrikes,
                updatedAt: new Date()
            });

            console.log(`[StrikesService] STRIKE_ISSUED: User ${userId} now has ${newStrikes} strikes. Reason: ${reason}`);
            return newStrikes;
        } catch (error: any) {
            console.error('[StrikesService] addStrike failed:', error.message);
            return 0;
        }
    },

    /**
     * Decrement strike count for a user.
     */
    async removeStrike(userId: string): Promise<number> {
        try {
            const userRef = toolDbAdmin.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (!userDoc.exists) return 0;
            
            const currentStrikes = userDoc.data()?.strikes || 0;
            const newStrikes = Math.max(0, currentStrikes - 1);
            
            await userRef.update({ 
                strikes: newStrikes,
                updatedAt: new Date()
            });

            console.log(`[StrikesService] STRIKE_REMOVED: User ${userId} now has ${newStrikes} strikes.`);
            return newStrikes;
        } catch (error: any) {
            console.error('[StrikesService] removeStrike failed:', error.message);
            return 0;
        }
    },

    /**
     * Manually set strike count for a user (Admin only).
     */
    async setStrikes(userId: string, count: number): Promise<boolean> {
        try {
            await toolDbAdmin.collection('users').doc(userId).update({
                strikes: Math.max(0, count),
                updatedAt: new Date()
            });
            return true;
        } catch (error: any) {
            console.error('[StrikesService] setStrikes failed:', error.message);
            return false;
        }
    }
};
