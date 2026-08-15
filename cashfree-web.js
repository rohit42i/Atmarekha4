let sdkPromise;

function loadSdk() {
  if (window.Cashfree) return Promise.resolve(window.Cashfree);
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-cashfree-sdk]');
    if (existing) { existing.addEventListener('load', () => resolve(window.Cashfree)); existing.addEventListener('error', () => reject(new Error('Cashfree checkout could not load.'))); return; }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.async = true; script.dataset.cashfreeSdk = 'true';
    script.onload = () => window.Cashfree ? resolve(window.Cashfree) : reject(new Error('Cashfree SDK is unavailable.'));
    script.onerror = () => reject(new Error('Cashfree checkout could not load.'));
    document.head.appendChild(script);
  });
  return sdkPromise;
}

export async function openCashfreeSubscription({ subscriptionId, subscriptionSessionId, production = false }) {
  if (!subscriptionId || !subscriptionSessionId) throw new Error('Invalid Cashfree subscription session.');
  const factory = await loadSdk();
  const cashfree = factory({ mode: production ? 'production' : 'sandbox' });
  const result = await cashfree.subscriptionsCheckout({ subsSessionId: subscriptionSessionId, redirectTarget: '_self' });
  if (result?.error) throw new Error(result.error.message || 'Cashfree checkout failed to open.');
  return result;
}
