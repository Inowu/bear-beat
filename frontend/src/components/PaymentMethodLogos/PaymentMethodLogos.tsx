import { CreditCard, Landmark } from "src/icons";
import type { ReactNode } from "react";
import visaLogo from "../../assets/images/cards/visa.png";
import mastercardLogo from "../../assets/images/cards/master.png";
import amexLogo from "../../assets/images/cards/express.png";
import "./PaymentMethodLogos.scss";
import { Button } from "src/components/ui";
export type PaymentMethodId =
  | "card"
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
  card: {
    label: "Tarjeta",
    icon: <CreditCard size={15} aria-hidden />,
    showText: true,
  },
  visa: {
    label: "Visa",
    icon: (
      <img
        src={visaLogo}
        alt=""
        aria-hidden
        className="payment-method-logos__card-icon payment-method-logos__card-icon--visa"
      />
    ),
  },
  mastercard: {
    label: "Mastercard",
    icon: (
      <img
        src={mastercardLogo}
        alt=""
        aria-hidden
        className="payment-method-logos__card-icon payment-method-logos__card-icon--mastercard"
      />
    ),
  },
  amex: {
    label: "American Express",
    icon: (
      <img
        src={amexLogo}
        alt=""
        aria-hidden
        className="payment-method-logos__card-icon payment-method-logos__card-icon--amex"
      />
    ),
  },
  paypal: {
    label: "PayPal",
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
