import { useState } from 'react';
import { supabase } from './supabase';

async function getFunctionError(error, fallback) {
  if (!error) return fallback;
  try {
    const response = error.context;
    if (response && typeof response.json === 'function') {
      const body = await response.clone().json();
      if (body?.error) return [body.error, body.reason].filter(Boolean).join(' · ') || fallback;
    }
  } catch {}
  return error.message || fallback;
}

/**
 * Reusable one-time Razorpay Standard Checkout button.
 * `amount` is INR, e.g. 100 = ₹100. The server converts/validates paise.
 */
export default function RazorpayCheckoutButton({
  amount,
  label = 'Pay with Razorpay',
  receipt,
  description = 'Atma Rekha',
  onSuccess,
  className = 'membership-button',
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const startCheckout = async () => {
    setError('');
    const rupees = Number(amount);
    if (!Number.isFinite(rupees) || rupees < 1) {
      setError('Payment amount must be at least ₹1.');
      return;
    }
    if (!window.Razorpay) {
      setError('Razorpay Checkout could not be loaded. Please refresh and try again.');
      return;
    }

    setLoading(true);
    try {
      const paise = Math.round(rupees * 100);
      const { data, error: invokeError } = await supabase.functions.invoke('create-razorpay-order', {
        body: { amount: paise, currency: 'INR', receipt },
      });
      if (invokeError) throw new Error(await getFunctionError(invokeError, 'Unable to create the Razorpay order.'));
      if (!data?.order_id || !data?.amount || !data?.currency) {
        throw new Error(data?.error || 'Razorpay did not return a valid order.');
      }

      const key = import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!key) throw new Error('Razorpay public key is not configured.');

      const checkout = new window.Razorpay({
        key,
        amount: data.amount,
        currency: data.currency,
        order_id: data.order_id,
        name: 'Atma Rekha',
        description,
        image: `${window.location.origin}/ishani.png`,
        theme: { color: '#d946ef' },
        modal: {
          confirm_close: true,
          escape: true,
          backdropclose: false,
          ondismiss: () => setLoading(false),
        },
        handler: async response => {
          try {
            const { data: verification, error: verificationError } = await supabase.functions.invoke('verify-razorpay-payment', {
              body: {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            if (verificationError) throw new Error(await getFunctionError(verificationError, 'Unable to verify the Razorpay payment.'));
            if (!verification?.success) throw new Error(verification?.error || 'Payment verification failed.');
            onSuccess?.(verification);
          } catch (verificationError) {
            setError(verificationError?.message || 'Payment verification failed.');
          } finally {
            setLoading(false);
          }
        },
      });

      checkout.on('payment.failed', response => {
        setError(response?.error?.description || 'Razorpay payment failed.');
        setLoading(false);
      });
      checkout.open();
    } catch (checkoutError) {
      setError(checkoutError?.message || 'Unable to start Razorpay Checkout.');
      setLoading(false);
    }
  };

  return (
    <div>
      <button type="button" className={className} disabled={loading} onClick={startCheckout}>
        {loading ? 'Opening Razorpay…' : label}
      </button>
      {error && <p className="membership-error" role="alert">{error}</p>}
    </div>
  );
}
