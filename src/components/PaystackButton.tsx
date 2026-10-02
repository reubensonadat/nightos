 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { generateReference } from '../lib/utils';

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        subaccount?: string;
        transaction_charge?: number;
        bearer?: string;
        metadata?: Record<string, unknown>;
        channels?: string[];
        callback: (response: { reference: string }) => void;
        onClose: () => void;
      }) => { openIframe: () => void };
    };
  }
}

type Props = {
  email?: string;
  amount: number;
  billId: string;
  venueId: string;
  channels?: ('card' | 'mobile_money')[];
  /** Paystack subaccount code (ACCT_xxx) — when set, Paystack settles the
   *  transaction_charge (pesewas) to the platform and the rest to the venue. */
  subaccount?: string | null;
  /** Amount (in pesewas) routed to the platform subaccount settlement. */
  transactionCharge?: number | null;
  onSuccess: (reference: string) => void;
  onClose?: () => void;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
};

export function PaystackButton({
  email,
  amount,
  billId,
  venueId,
  channels,
  subaccount,
  transactionCharge,
  onSuccess,
  onClose,
  children,
  disabled,
  className,
}: Props) {
  const [scriptReady, setScriptReady] = useState(() => {
    return typeof window.PaystackPop !== 'undefined';
  });

  useEffect(() => {
     
    if (typeof window.PaystackPop !== 'undefined') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setScriptReady(true);
      return;
    }
    if (document.querySelector('script[src*="paystack"]')) {
      return; // will flip flag onload below
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    script.onload = () => setScriptReady(true);
    document.body.appendChild(script);
  }, []);

  const handlePayment = useCallback(() => {
    const key = import.meta.env.PROD
      ? import.meta.env.VITE_PAYSTACK_LIVE_KEY || ''
      : import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';
    if (!key || key.startsWith('pk_test_placeholder') || key.startsWith('pk_live_placeholder')) {
      toast.error("Payments aren't set up yet — the venue is missing its Paystack key.");
      return;
    }
    if (amount <= 0) {
      toast.error("Nothing due — this bill is already settled.");
      return;
    }
    if (!window.PaystackPop) {
      toast.error("Payment is still loading — please try again in a second.");
      return;
    }

    const ref = generateReference();
    const amountPesewas = Math.round(amount * 100);

    const config: Parameters<typeof window.PaystackPop.setup>[0] = {
      key,
      email: email || `${billId.slice(0, 8)}@bysen.com`,
      amount: amountPesewas,
      currency: 'GHS',
      ref,
      ...(subaccount ? { subaccount, bearer: 'account' } : {}),
      ...(subaccount && transactionCharge && transactionCharge > 0
        ? { transaction_charge: Math.round(transactionCharge) }
        : {}),
      ...(channels && channels.length > 0 ? { channels } : {}),
      metadata: {
        bill_id: billId,
        venue_id: venueId,
        custom_fields: [{ variable_name: 'bill_id', value: billId }],
      },
      callback: (response) => {
        onSuccess(response.reference);
      },
      onClose: () => {
        onClose?.();
      },
    };

    const handler = window.PaystackPop.setup(config);
    handler.openIframe();
  }, [amount, billId, venueId, email, channels, subaccount, transactionCharge, onSuccess, onClose]);

  return (
    <button
      type="button"
      onClick={handlePayment}
      disabled={disabled || !scriptReady}
      className={className}
    >
      {children}
    </button>
  );
}