import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";
import PaymentMethodLogos, { type PaymentMethodId } from "../../../components/PaymentMethodLogos/PaymentMethodLogos";
import { HOME_HERO_MICROCOPY_BASE, HOME_HERO_MICROCOPY_TRIAL } from "../homeCopy";
import { formatInt } from "../homeFormat";

export type TrialSummary = {
  enabled: boolean;
  days: number;
  gb: number;
};

export type PricingPlan = {
  currency: "mxn" | "usd";
  name: string;
  price: number;
  gigas: number;
  hasPaypal: boolean;
};

function formatCurrency(amount: number, currency: "mxn" | "usd", locale: string): string {
  const code = currency === "mxn" ? "MXN" : "USD";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}

export default function Pricing(props: {
  plans: { mxn?: PricingPlan | null; usd?: PricingPlan | null };
  defaultCurrency: "mxn" | "usd";
  numberLocale: string;
  catalogTBLabel: string;
  downloadQuotaGb: number;
  trial: TrialSummary | null;
  ctaLabel: string;
  onPrimaryCtaClick: () => void;
}) {
  const {
    plans,
    defaultCurrency,
    numberLocale,
    catalogTBLabel,
    downloadQuotaGb,
    trial,
    ctaLabel,
    onPrimaryCtaClick,
  } = props;

  const hasMxn = Boolean(plans.mxn);
  const hasUsd = Boolean(plans.usd);
  const initialCurrency: "mxn" | "usd" = useMemo(() => {
    if (defaultCurrency === "mxn" && hasMxn) return "mxn";
    if (defaultCurrency === "usd" && hasUsd) return "usd";
    return hasMxn ? "mxn" : "usd";
  }, [defaultCurrency, hasMxn, hasUsd]);

  const [currency, setCurrency] = useState<"mxn" | "usd">(initialCurrency);
  const plan = currency === "mxn" ? plans.mxn : plans.usd;
  const hasTrial = Boolean(trial?.enabled);
  const microcopy = hasTrial ? HOME_HERO_MICROCOPY_TRIAL : HOME_HERO_MICROCOPY_BASE;

  const paymentMethods = useMemo<PaymentMethodId[]>(() => {
    const methods = new Set<PaymentMethodId>(["visa", "mastercard", "amex"]);
    if (plan?.hasPaypal) methods.add("paypal");
    if (plan?.currency === "mxn") methods.add("spei");
    return Array.from(methods);
  }, [plan]);

  return (
    <section className="pricing" aria-label="Precio">
      <div className="ph__container">
        <div className="pricing__head">
          <h2 className="home-h2">Precio simple, catálogo gigante</h2>
          <p className="home-sub">
            Catálogo total: <strong>{catalogTBLabel}</strong> • Descargas:{" "}
            <strong>{formatInt(downloadQuotaGb)} GB/mes</strong>
          </p>
        </div>

        {(hasMxn || hasUsd) && hasMxn && hasUsd && (
          <div className="pricing__toggle" role="tablist" aria-label="Moneda">
            <button
              type="button"
              className={`pricing__toggle-btn ${currency === "mxn" ? "is-active" : ""}`.trim()}
              onClick={() => setCurrency("mxn")}
              role="tab"
              aria-selected={currency === "mxn"}
            >
              MXN
            </button>
            <button
              type="button"
              className={`pricing__toggle-btn ${currency === "usd" ? "is-active" : ""}`.trim()}
              onClick={() => setCurrency("usd")}
              role="tab"
              aria-selected={currency === "usd"}
            >
              USD
            </button>
          </div>
        )}

        <div className="pricing__card" aria-label="Plan">
          <div className="pricing__card-head">
            <div>
              <p className="pricing__pill">Pago mensual</p>
              <h3 className="pricing__title">{plan?.name ?? "Membresía Bear Beat"}</h3>
            </div>
            <div className="pricing__price">
              <span className="pricing__amount">
                {plan ? formatCurrency(plan.price, plan.currency, numberLocale) : "—"}
              </span>
              <span className="pricing__per">/ mes</span>
            </div>
          </div>

          {hasTrial && trial && (
            <div className="pricing__trial" role="note">
              <strong>Prueba: {trial.days} días</strong> · {formatInt(trial.gb)} GB incluidos · solo tarjeta (Stripe), 1ª vez
              <div className="pricing__trial-sub">Cancela antes de que termine y no se cobra.</div>
            </div>
          )}

          <ul className="pricing__includes" aria-label="Incluye">
            <li>
              <CheckCircle2 size={16} aria-hidden /> Descargas: {formatInt(downloadQuotaGb)} GB/mes
            </li>
            <li>
              <CheckCircle2 size={16} aria-hidden /> Catálogo total: {catalogTBLabel} (eliges qué bajar)
            </li>
            <li>
              <CheckCircle2 size={16} aria-hidden /> Carpetas listas + guía por chat para activar
            </li>
          </ul>

          <div className="pricing__cta">
            <Link
              to="/auth/registro"
              state={{ from: "/planes" }}
              className="home-cta home-cta--primary"
              onClick={onPrimaryCtaClick}
            >
              {ctaLabel}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <p className="pricing__micro">{microcopy}</p>
            <div className="pricing__payments">
              <PaymentMethodLogos
                methods={paymentMethods}
                size="md"
                className="pricing__payment-logos"
                ariaLabel="Métodos de pago aceptados"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
