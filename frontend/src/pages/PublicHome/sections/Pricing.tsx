import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
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

function getPaymentMethodsForPlan(plan: PricingPlan | null, hasTrial: boolean): PaymentMethodId[] {
  const methods = new Set<PaymentMethodId>(["visa", "mastercard", "amex"]);
  if (!plan) return Array.from(methods);
  // Trial is Stripe/card-only. Avoid showing PayPal/SPEI next to the trial message.
  if (!hasTrial) {
    if (plan.hasPaypal) methods.add("paypal");
    if (plan.currency === "mxn") methods.add("spei");
  }
  return Array.from(methods);
}

function getAltPaymentLabelForPlan(plan: PricingPlan | null): string {
  if (!plan) return "";
  const items: string[] = [];
  if (plan.hasPaypal) items.push("PayPal");
  if (plan.currency === "mxn") items.push("SPEI");
  return items.join(" / ");
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
  const mxnPlan = plans.mxn ?? null;
  const usdPlan = plans.usd ?? null;
  const hasTrial = Boolean(trial?.enabled);
  const microcopy = HOME_HERO_MICROCOPY_BASE;
  const tabPrefix = useId();
  const mxnTabId = `${tabPrefix}-tab-mxn`;
  const usdTabId = `${tabPrefix}-tab-usd`;
  const mxnPanelId = `${tabPrefix}-panel-mxn`;
  const usdPanelId = `${tabPrefix}-panel-usd`;

  const mxnPaymentMethods = useMemo(() => getPaymentMethodsForPlan(mxnPlan, hasTrial), [mxnPlan, hasTrial]);
  const usdPaymentMethods = useMemo(() => getPaymentMethodsForPlan(usdPlan, hasTrial), [usdPlan, hasTrial]);
  const mxnAltPaymentLabel = useMemo(() => getAltPaymentLabelForPlan(mxnPlan), [mxnPlan]);
  const usdAltPaymentLabel = useMemo(() => getAltPaymentLabelForPlan(usdPlan), [usdPlan]);
  const showAltPaymentsNoteMxn = Boolean(hasTrial && mxnAltPaymentLabel);
  const showAltPaymentsNoteUsd = Boolean(hasTrial && usdAltPaymentLabel);

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
          <div className="pricing__toggle bb-segmented" role="tablist" aria-label="Moneda">
            <button
              type="button"
              className={`pricing__toggle-btn bb-segmented__btn ${currency === "mxn" ? "is-active" : ""}`.trim()}
              onClick={() => setCurrency("mxn")}
              role="tab"
              id={mxnTabId}
              aria-controls={mxnPanelId}
              aria-selected={currency === "mxn"}
            >
              MXN
            </button>
            <button
              type="button"
              className={`pricing__toggle-btn bb-segmented__btn ${currency === "usd" ? "is-active" : ""}`.trim()}
              onClick={() => setCurrency("usd")}
              role="tab"
              id={usdTabId}
              aria-controls={usdPanelId}
              aria-selected={currency === "usd"}
            >
              USD
            </button>
          </div>
        )}

        <div className="pricing__panels" aria-label="Plan">
          {hasMxn && mxnPlan && (
            <div id={mxnPanelId} role="tabpanel" aria-labelledby={mxnTabId} hidden={currency !== "mxn"}>
              <div className="pricing__card">
                <div className="pricing__card-head">
                  <div className="pricing__plan">
                    <p className="pricing__pill">Pago mensual</p>
                    <h3 className="pricing__title">{mxnPlan.name ?? "Membresía Bear Beat"}</h3>
                  </div>
                  <div className="pricing__price pricing__price-panel">
                    <span className="pricing__amount">
                      {formatCurrency(mxnPlan.price, "mxn", numberLocale)}
                    </span>
                    <span className="pricing__per">/ mes</span>
                    {hasTrial && <span className="pricing__after">Después de la prueba</span>}
                  </div>
                </div>

                {hasTrial && trial && (
                  <div className="pricing__trial" role="note">
                    <strong>
                      Prueba: {trial.days} días + {formatInt(trial.gb)} GB
                    </strong>
                    <div className="pricing__trial-sub">Solo tarjeta (Stripe), 1ª vez. {HOME_HERO_MICROCOPY_TRIAL}</div>
                  </div>
                )}

                <ul className="pricing__includes" aria-label="Incluye">
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">Descargas: {formatInt(downloadQuotaGb)} GB/mes</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">Catálogo total: {catalogTBLabel} (eliges qué bajar)</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">Carpetas listas + guía por chat para activar</span>
                  </li>
                </ul>

                <div className="pricing__cta">
                  <Link
                    to="/auth/registro"
                    state={{ from: "/planes" }}
                    className="home-cta home-cta--primary"
                    data-testid="home-pricing-primary-cta"
                    onClick={onPrimaryCtaClick}
                  >
                    {ctaLabel}
                    <ArrowRight size={18} aria-hidden />
                  </Link>
                  <p className="pricing__micro">{microcopy}</p>
                  <div className="pricing__payments">
                    <PaymentMethodLogos
                      methods={mxnPaymentMethods}
                      size="md"
                      className="pricing__payment-logos"
                      ariaLabel="Métodos de pago aceptados"
                    />
                    {showAltPaymentsNoteMxn && (
                      <div className="pricing__payments-note" role="note">
                        La prueba aplica solo con tarjeta. Otros métodos ({mxnAltPaymentLabel}) se muestran como opciones sin prueba al activar.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasUsd && usdPlan && (
            <div id={usdPanelId} role="tabpanel" aria-labelledby={usdTabId} hidden={currency !== "usd"}>
              <div className="pricing__card">
                <div className="pricing__card-head">
                  <div className="pricing__plan">
                    <p className="pricing__pill">Pago mensual</p>
                    <h3 className="pricing__title">{usdPlan.name ?? "Membresía Bear Beat"}</h3>
                  </div>
                  <div className="pricing__price pricing__price-panel">
                    <span className="pricing__amount">
                      {formatCurrency(usdPlan.price, "usd", numberLocale)}
                    </span>
                    <span className="pricing__per">/ mes</span>
                    {hasTrial && <span className="pricing__after">Después de la prueba</span>}
                  </div>
                </div>

                {hasTrial && trial && (
                  <div className="pricing__trial" role="note">
                    <strong>
                      Prueba: {trial.days} días + {formatInt(trial.gb)} GB
                    </strong>
                    <div className="pricing__trial-sub">Solo tarjeta (Stripe), 1ª vez. Cancelas antes de que termine y no se cobra.</div>
                  </div>
                )}

                <ul className="pricing__includes" aria-label="Incluye">
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">Descargas: {formatInt(downloadQuotaGb)} GB/mes</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">Catálogo total: {catalogTBLabel} (eliges qué bajar)</span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">Carpetas listas + guía por chat para activar</span>
                  </li>
                </ul>

                <div className="pricing__cta">
                  <Link
                    to="/auth/registro"
                    state={{ from: "/planes" }}
                    className="home-cta home-cta--primary"
                    data-testid="home-pricing-primary-cta"
                    onClick={onPrimaryCtaClick}
                  >
                    {ctaLabel}
                    <ArrowRight size={18} aria-hidden />
                  </Link>
                  <p className="pricing__micro">{microcopy}</p>
                  <div className="pricing__payments">
                    <PaymentMethodLogos
                      methods={usdPaymentMethods}
                      size="md"
                      className="pricing__payment-logos"
                      ariaLabel="Métodos de pago aceptados"
                    />
                    {showAltPaymentsNoteUsd && (
                      <div className="pricing__payments-note" role="note">
                        La prueba aplica solo con tarjeta. Otros métodos ({usdAltPaymentLabel}) se muestran como opciones sin prueba al activar.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
