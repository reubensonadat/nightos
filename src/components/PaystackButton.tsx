import { useCallback, useEffect, useRef } from 'react';
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
  subaccountCode?: string;
  convenienceFee?: number;
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
  subaccountCode,
  convenienceFee,
  onSuccess,
  onClose,
  children,
  disabled,
  className,
}: Props) {
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    if (document.querySelector('script[src*="paystack"]')) {
      scriptLoadedRef.current = true;
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://js.paystack.co/v1/inline.js';
    script.async = true;
    document.body.appendChild(script);
    script.onload = () => {
      scriptLoadedRef.current = true;
    };
  }, []);

  const handlePayment = useCallback(() => {
    if (!window.PaystackPop) {
      console.error('Paystack script not loaded yet');
      return;
    }

    const ref = generateReference();
    const amountPesewas = Math.round(amount * 100);

    const config: Parameters<typeof window.PaystackPop.setup>[0] = {
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_placeholder',
      email: email || `${billId.slice(0, 8)}@nightos.com`,
      amount: amountPesewas,
      currency: 'GHS',
      ref,
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

    if (subaccountCode && convenienceFee) {
      config.subaccount = subaccountCode;
      config.transaction_charge = Math.round(convenienceFee * 100);
      config.bearer = 'subaccount';
    }

    const handler = window.PaystackPop.setup(config);
    handler.openIframe();
  }, [amount, billId, venueId, email, subaccountCode, convenienceFee, onSuccess, onClose]);

  return (
    <button type="button" onClick={handlePayment} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
