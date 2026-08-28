import { supabase } from '../supabase';

const urlB64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

export const subscribeToPush = async (userId: string, schoolId: string, forceRenew: boolean = false): Promise<{success: boolean, error?: string}> => {
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported');
      return { success: false, error: 'Push messaging is not supported on this browser' };
    }

    const registration = await navigator.serviceWorker.ready;
    
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription && forceRenew) {
      await subscription.unsubscribe();
      subscription = null;
    }
    
    let isNewSub = false;

    if (!subscription) {
      // Fetch public VAPID key
      const vapidRes = await fetch('/api/push/vapid-public-key');
      if (!vapidRes.ok) {
        const txt = await vapidRes.text();
        return { success: false, error: `Failed to fetch VAPID key: ${vapidRes.status} ${txt}` };
      }
      const { publicKey } = await vapidRes.json();
      
      if (!publicKey) {
        console.warn('No VAPID key provided. Push not configured.');
        return { success: false, error: 'VAPID public key empty' };
      }

      const convertedVapidKey = urlB64ToUint8Array(publicKey);

      // Subscribe
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });
      isNewSub = true;
    }

    // Send subscription to server - bypass backend API because of anon key issues
    const authKeys = subscription.toJSON().keys;
    const { error: dbError } = await supabase.rpc('upsert_push_subscription', {
      p_user_id: userId,
      p_school_id: schoolId,
      p_endpoint: subscription.endpoint,
      p_p256dh: authKeys?.p256dh,
      p_auth: authKeys?.auth
    });

    if (dbError) {
      throw new Error(dbError.message || 'Failed to save subscription');
    }

    console.log(isNewSub ? 'Push successfully subscribed!' : 'Existing push subscription updated on server');
    return { success: true };
  } catch (error: any) {
    console.error('Failed to subscribe to push API', error);
    return { success: false, error: error.message };
  }
};
