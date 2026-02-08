import { Landmark } from "lucide-react";
import { FaPaypal } from "react-icons/fa";
import AmexLogo from "../../assets/images/cards/express.png";
import MastercardLogo from "../../assets/images/cards/master.png";
import VisaLogo from "../../assets/images/cards/visa.png";
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
  type: "image" | "brand";
  imageSrc?: string;
}

const METHOD_DEFINITIONS: Record<PaymentMethodId, PaymentMethodDefinition> = {
  visa: {
    label: "Visa",
    type: "image",
    imageSrc: VisaLogo,
  },
  mastercard: {
    label: "Mastercard",
    type: "image",
    imageSrc: MastercardLogo,
  },
  amex: {
    label: "American Express",
    type: "image",
    imageSrc: AmexLogo,
  },
  paypal: {
    label: "PayPal",
    type: "brand",
  },
  spei: {
    label: "SPEI",
    type: "brand",
  },
  oxxo: {
    label: "Efectivo",
    type: "brand",
  },
  transfer: {
    label: "Transferencia",
    type: "brand",
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
            {definition.type === "image" && definition.imageSrc ? (
              <img src={definition.imageSrc} alt={definition.label} loading="lazy" />
            ) : (
              <>
                {method === "paypal" && <FaPaypal aria-hidden />}
                {method === "spei" && <Landmark size={15} aria-hidden />}
                <strong>{definition.label}</strong>
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

export default PaymentMethodLogos;
