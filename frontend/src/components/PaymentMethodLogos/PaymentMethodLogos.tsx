import { Landmark } from "lucide-react";
import { FaCcAmex, FaCcMastercard, FaCcVisa, FaPaypal } from "react-icons/fa";
import type { ReactNode } from "react";
import "./PaymentMethodLogos.scss";

export type PaymentMethodId =
  | "visa"
  | "mastercard"
  | "amex"
  | "paypal"
  | "spei"
  | "oxxo"
  | "transfer";

interface PaymentMethodLogosProps {
  methods: PaymentMethodId[];
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}

interface PaymentMethodDefinition {
  label: string;
  icon?: ReactNode;
  showText?: boolean;
}

const METHOD_DEFINITIONS: Record<PaymentMethodId, PaymentMethodDefinition> = {
  visa: {
    label: "Visa",
    icon: (
      <FaCcVisa
        aria-hidden
        className="payment-method-logos__card-icon payment-method-logos__card-icon--visa"
      />
    ),
  },
  mastercard: {
    label: "Mastercard",
    icon: (
      <FaCcMastercard
        aria-hidden
        className="payment-method-logos__card-icon payment-method-logos__card-icon--mastercard"
      />
    ),
  },
  amex: {
    label: "American Express",
    icon: (
      <FaCcAmex
        aria-hidden
        className="payment-method-logos__card-icon payment-method-logos__card-icon--amex"
      />
    ),
  },
  paypal: {
    label: "PayPal",
    icon: <FaPaypal aria-hidden className="payment-method-logos__paypal-icon" />,
    showText: true,
  },
  spei: {
    label: "SPEI",
    icon: <Landmark size={15} aria-hidden className="payment-method-logos__spei-icon" />,
    showText: true,
  },
  oxxo: {
    label: "Efectivo",
    showText: true,
  },
  transfer: {
    label: "Transferencia",
    showText: true,
  },
};

function PaymentMethodLogos({
  methods,
  size = "sm",
  className = "",
  ariaLabel = "Métodos de pago aceptados",
}: PaymentMethodLogosProps) {
  const uniqueMethods = Array.from(new Set(methods));

  return (
    <div
      className={`payment-method-logos payment-method-logos--${size} ${className}`.trim()}
      role="list"
      aria-label={ariaLabel}
    >
      {uniqueMethods.map((method) => {
        const definition = METHOD_DEFINITIONS[method];
        return (
          <span
            key={method}
            role="listitem"
            className={`payment-method-logos__item payment-method-logos__item--${method}`}
            title={definition.label}
            aria-label={definition.label}
          >
            {definition.icon}
            {definition.showText && <strong>{definition.label}</strong>}
          </span>
        );
      })}
    </div>
  );
}

export default PaymentMethodLogos;
