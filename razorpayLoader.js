let loadingPromise = null;

export function loadRazorpay() {
  if (typeof window === 'undefined') return Promise.reject(new Error('Razorpay is unavailable during server rendering.'));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (loadingPromise) return loadingPromise;

  loadingPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout]');
    const script = existing || document.createElement('script');

    const cleanup = () => {
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
    const onLoad = () => {
      cleanup();
      if (window.Razorpay) resolve(window.Razorpay);
      else reject(new Error('Razorpay Checkout loaded without its API.'));
    };
    const onError = () => {
      cleanup();
      reject(new Error('Razorpay Checkout could not be loaded.'));
    };

    script.addEventListener('load', onLoad, { once: true });
    script.addEventListener('error', onError, { once: true });

    if (!existing) {
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.dataset.razorpayCheckout = 'true';
      document.head.appendChild(script);
    } else if (window.Razorpay) {
      onLoad();
    }
  }).catch(error => {
    loadingPromise = null;
    throw error;
  });

  return loadingPromise;
}
