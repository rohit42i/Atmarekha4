import { useState } from 'react';
import { supabase } from './supabase';

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(true), { once: true });
      existing.addEventListener('error', () => reject(new Error('Unable to load Razorpay Checkout.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Unable to load Razorpay Checkout.'));
    document.body.appendChild(script);
  });
}

export default function RazorpayCheckout({
  amountPaise,
  receipt,
  description = 'Atma Rekha support',
  buttonLabel,
  disabled = false,
  onSuccess,
  onError,
  onDismiss,
}) {
  const [loading, setLoading] = useState(false);

  const startPayment = async () => {
    if (loading || disabled) return;

    if (!Number.isInteger(amountPaise) || amountPaise < 100) {
      onError?.(new Error('Payment amount must be at least ₹1.'));
      return;
    }

    const key = import.meta.env.VITE_RAZORPAY_KEY_ID;
    if (!key) {
      onError?.(new Error('Razorpay is not configured. Set VITE_RAZORPAY_KEY_ID.'));
      return;
    }

    setLoading(true);

    try {
      await loadRazorpayScript();

      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: {
          amount: amountPaise,
          currency: 'INR',
          receipt,
        },
      });

      if (error) throw error;
      if (!data?.order_id || data?.amount < 100 || data?.currency !== 'INR') {
        throw new Error(data?.error || 'Unable to create Razorpay order.');
      }

      const checkout = new window.Razorpay({
        key,
        amount: data.amount,
        currency: data.currency,
        name: 'Atma Rekha',
        description,
        order_id: data.order_id,
        image: `${window.location.origin}/ishani.png`,
        prefill: {},
        theme: { color: '#d946ef' },
        modal: {
          confirm_close: true,
          escape: true,
          backdropclose: false,
          animation: true,
          ondismiss: () => onDismiss?.(),
        },
        handler: async response => {
          try {
            const { data: verification, error: verificationError } = await supabase.functions.invoke(
              'verify-razorpay-payment',
              {
                body: {
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_signature: response.razorpay_signature,
                },
              }
            );

            if (verificationError) throw verificationError;
            if (!verification?.success) throw new Error(verification?.error || 'Payment verification failed.');

            onSuccess?.(verification);
          } catch (error) {
            onError?.(error);
          } finally {
            setLoading(false);
          }
        },
      });

      checkout.on('payment.failed', response => {
        const description = response?.error?.description || 'Razorpay payment failed.';
        onError?.(new Error(description));
        setLoading(false);
      });

      checkout.open();
    } catch (error) {
      setLoading(false);
      onError?.(error);
    }
  };

  return (
    <button type="button" onClick={startPayment} disabled={disabled || loading}>
      {loading ? 'Opening payment…' : buttonLabel || `Pay ₹${(amountPaise / 100).toFixed(0)}`}
    </button>
  );
}
