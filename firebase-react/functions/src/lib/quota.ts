import * as admin from "firebase-admin";

/**
 * Checks and records usage for a specific partner and service type.
 * Uses Firestore transactions to ensure atomic increments.
 * 
 * @param partnerId The ID of the partner
 * @param serviceType The type of service (e.g., 'webhook', 'ocr')
 * @param quotaLimit The maximum allowed usage per day
 * @returns true if usage is within limit and recorded, false if quota exceeded
 */
export async function checkAndRecordUsage(
  partnerId: string,
  serviceType: string,
  quotaLimit: number
): Promise<boolean> {
  const db = admin.firestore();
  
  // Use YYYY-MM-DD for daily quota
  const today = new Date().toISOString().split('T')[0];
  const usageRef = db.collection("partner_usage_daily").doc(`${partnerId}_${today}`);

  try {
    const isAllowed = await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(usageRef);
      
      let currentUsage = 0;
      if (doc.exists) {
        const data = doc.data();
        if (data && typeof data[serviceType] === 'number') {
          currentUsage = data[serviceType];
        }
      }

      if (currentUsage >= quotaLimit) {
        return false; // Quota exceeded
      }

      // Increment usage
      const newUsage = currentUsage + 1;
      
      if (!doc.exists) {
        transaction.set(usageRef, {
          partnerId,
          date: today,
          [serviceType]: newUsage,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      } else {
        transaction.update(usageRef, {
          [serviceType]: newUsage,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return true;
    });

    return isAllowed;
  } catch (error) {
    console.error(`[Quota] Failed to check and record usage for ${partnerId} (${serviceType}):`, error);
    // On error, default to deny to prevent quota bypassing
    return false;
  }
}
