import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "src/icons";
import { useEffect, useId, useMemo, useState } from "react";
import PaymentMethodLogos, {
  type PaymentMethodId,
} from "../../../components/PaymentMethodLogos/PaymentMethodLogos";
import {
  HOME_HERO_MICROCOPY_BASE,
  HOME_HERO_MICROCOPY_TRIAL,
} from "../homeCopy";
import { formatInt } from "../homeFormat";

export type TrialSummary = {
  enabled: boolean;
  days: number;
  gb: number;
};

export type PricingStatus = "loading" | "loaded" | "error";

export type PricingPlan = {
  currency: "mxn" | "usd";
  name: string;
  price: number;
  gigas: number;
  hasPaypal: boolean;
  pricingPaymentMethods: PaymentMethodId[];
  trialPricingPaymentMethods: PaymentMethodId[];
  altPaymentLabel: string;
};

function formatCurrency(
  amount: number,
  currency: "mxn" | "usd",
  locale: string,
): string {
  const code = currency === "mxn" ? "MXN" : "USD";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}

export default function Pricing(props: {
  plans: { mxn?: PricingPlan | null; usd?: PricingPlan | null };
  status: PricingStatus;
  defaultCurrency: "mxn" | "usd";
  numberLocale: string;
  catalogTBLabel: string;
  downloadQuotaGb: number;
  limitsNote: string;
  trial: TrialSummary | null;
  ctaLabel: string;
  onPrimaryCtaClick: () => void;
}) {
  const {
    plans,
    status,
    defaultCurrency,
    numberLocale,
    catalogTBLabel,
    downloadQuotaGb,
    limitsNote,
    trial,
    ctaLabel,
    onPrimaryCtaClick,
  } = props;

  const hasMxn = Boolean(plans.mxn);
  const hasUsd = Boolean(plans.usd);
  const isLoading = status === "loading" && !hasMxn && !hasUsd;
  const isError = status === "error" && !hasMxn && !hasUsd;
  const resolvedDefaultCurrency: "mxn" | "usd" = useMemo(() => {
    if (defaultCurrency === "mxn" && hasMxn) return "mxn";
    if (defaultCurrency === "usd" && hasUsd) return "usd";
    return hasMxn ? "mxn" : "usd";
  }, [defaultCurrency, hasMxn, hasUsd]);

  const [currency, setCurrency] = useState<"mxn" | "usd">(
    resolvedDefaultCurrency,
  );
  useEffect(() => {
    setCurrency(resolvedDefaultCurrency);
  }, [resolvedDefaultCurrency]);
  const mxnPlan = plans.mxn ?? null;
  const usdPlan = plans.usd ?? null;
  const hasTrial = Boolean(trial?.enabled);
  const microcopy = HOME_HERO_MICROCOPY_BASE;
  const tabPrefix = useId();
  const mxnTabId = `${tabPrefix}-tab-mxn`;
  const usdTabId = `${tabPrefix}-tab-usd`;
  const mxnPanelId = `${tabPrefix}-panel-mxn`;
  const usdPanelId = `${tabPrefix}-panel-usd`;

  const mxnPaymentMethods = useMemo(() => {
    if (!mxnPlan) return ["visa", "mastercard", "amex"] as PaymentMethodId[];
    const trialMethods = Array.isArray(mxnPlan.trialPricingPaymentMethods)
      ? mxnPlan.trialPricingPaymentMethods
      : [];
    const regularMethods = Array.isArray(mxnPlan.pricingPaymentMethods)
      ? mxnPlan.pricingPaymentMethods
      : [];
    if (hasTrial && trialMethods.length > 0) return trialMethods;
    return regularMethods.length > 0
      ? regularMethods
      : (["visa", "mastercard", "amex"] as PaymentMethodId[]);
  }, [mxnPlan, hasTrial]);
  const usdPaymentMethods = useMemo(() => {
    if (!usdPlan) return ["visa", "mastercard", "amex"] as PaymentMethodId[];
    const trialMethods = Array.isArray(usdPlan.trialPricingPaymentMethods)
      ? usdPlan.trialPricingPaymentMethods
      : [];
    const regularMethods = Array.isArray(usdPlan.pricingPaymentMethods)
      ? usdPlan.pricingPaymentMethods
      : [];
    if (hasTrial && trialMethods.length > 0) return trialMethods;
    return regularMethods.length > 0
      ? regularMethods
      : (["visa", "mastercard", "amex"] as PaymentMethodId[]);
  }, [usdPlan, hasTrial]);
  const mxnAltPaymentLabel = useMemo(
    () => (mxnPlan?.altPaymentLabel ?? "").trim(),
    [mxnPlan],
  );
  const usdAltPaymentLabel = useMemo(
    () => (usdPlan?.altPaymentLabel ?? "").trim(),
    [usdPlan],
  );
  const showAltPaymentsNoteMxn = Boolean(hasTrial && mxnAltPaymentLabel);
  const showAltPaymentsNoteUsd = Boolean(hasTrial && usdAltPaymentLabel);

  return (
    <section id="precio" className="pricing" aria-label="Precio">
      <div className="ph__container">
        <div className="pricing__head">
          <h2 className="home-h2">Empieza hoy con precio claro</h2>
          <p className="home-sub">
            Catálogo total: <strong>{catalogTBLabel}</strong> • Cuota de descarga:{" "}
            <strong>{formatInt(downloadQuotaGb)} GB/mes</strong>
          </p>
          <p className="pricing__quotaExample">
            500 GB/mes = aprox. 3,000 videos (depende del peso y calidad de cada archivo).
          </p>
        </div>

        {(hasMxn || hasUsd) && hasMxn && hasUsd && (
          <div
            className={[
              "pricing__toggle",
              "bb-segmented",
              "bb-segmented--switch",
              currency === "usd" ? "is-usd" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="tablist"
            aria-label="Moneda"
          >
            <button
              type="button"
              className={[
                "bb-segmented__btn",
                currency === "mxn" ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
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
              className={[
                "bb-segmented__btn",
                currency === "usd" ? "is-active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
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
          {isLoading && (
            <div
              className="pricing__card bb-hero-card pricing__card--skeleton"
              aria-label="Cargando precio"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <p className="pricing__skeletonStatus">Cargando precio…</p>

              <div className="pricing__card-head" aria-hidden>
                <div className="pricing__plan">
                  <span className="pricing__sk pricing__sk--pill" />
                  <span className="pricing__sk pricing__sk--title" />
                </div>
                <div className="pricing__price pricing__price-panel">
                  <span className="pricing__sk pricing__sk--amount" />
                  <span className="pricing__sk pricing__sk--per" />
                </div>
              </div>

              <ul
                className="pricing__includes pricing__includes--skeleton"
                aria-hidden
              >
                {Array.from({ length: 3 }).map((_, i) => (
                  <li key={i}>
                    <span className="pricing__sk pricing__sk--icon" />
                    <span className="pricing__sk pricing__sk--line" />
                  </li>
                ))}
              </ul>

              <div className="pricing__cta" aria-hidden>
                <span className="pricing__sk pricing__sk--cta" />
              </div>
            </div>
          )}

          {isError && (
            <div
              className="pricing__card bb-hero-card pricing__card--error"
              role="status"
              aria-live="polite"
            >
              <p className="pricing__errorTitle">
                No pudimos cargar el precio.
              </p>
              <p className="pricing__errorText">
                Recarga la página o intenta en unos minutos.
              </p>
            </div>
          )}

          {hasMxn && mxnPlan && (
            <div
              id={mxnPanelId}
              role="tabpanel"
              aria-labelledby={mxnTabId}
              hidden={currency !== "mxn"}
            >
              <div className="pricing__card bb-hero-card">
                <div className="pricing__card-head">
                  <div className="pricing__plan">
                    <p className="pricing__pill">Pago mensual</p>
                    <h3 className="pricing__title">
                      {mxnPlan.name ?? "Membresía Bear Beat"}
                    </h3>
                  </div>
                  <div className="pricing__price pricing__price-panel">
                    <span className="pricing__amount">
                      {formatCurrency(mxnPlan.price, "mxn", numberLocale)}
                    </span>
                    <span className="pricing__per">/ mes</span>
                    {hasTrial && (
                      <span className="pricing__after">
                        Después de la prueba
                      </span>
                    )}
                  </div>
                </div>

                {hasTrial && trial && (
                  <div className="pricing__trial" role="note">
                    <strong>
                      Prueba: {trial.days} días + {formatInt(trial.gb)} GB
                    </strong>
                    <div className="pricing__trial-sub">
                      Solo tarjeta, 1ª vez. {HOME_HERO_MICROCOPY_TRIAL}
                    </div>
                  </div>
                )}

                <ul className="pricing__includes" aria-label="Incluye">
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">
                      Cuota de descarga: {formatInt(downloadQuotaGb)} GB/mes
                    </span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">
                      Actualizaciones: semanales (nuevos packs)
                    </span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">
                      Catálogo total: {catalogTBLabel} (eliges qué bajar)
                    </span>
                  </li>
                </ul>
                <p className="pricing__micro">{limitsNote}</p>

                <div className="pricing__cta">
                  <Link
                    to="/auth/registro"
                    state={{ from: "/planes" }}
                    className="home-cta home-cta--primary"
                    data-testid="home-pricing-primary-cta"
                    aria-label={ctaLabel}
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
                        La prueba aplica solo con tarjeta. Otros métodos (
                        {mxnAltPaymentLabel}) se muestran como opciones sin
                        prueba al activar.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {hasUsd && usdPlan && (
            <div
              id={usdPanelId}
              role="tabpanel"
              aria-labelledby={usdTabId}
              hidden={currency !== "usd"}
            >
              <div className="pricing__card bb-hero-card">
                <div className="pricing__card-head">
                  <div className="pricing__plan">
                    <p className="pricing__pill">Pago mensual</p>
                    <h3 className="pricing__title">
                      {usdPlan.name ?? "Membresía Bear Beat"}
                    </h3>
                  </div>
                  <div className="pricing__price pricing__price-panel">
                    <span className="pricing__amount">
                      {formatCurrency(usdPlan.price, "usd", numberLocale)}
                    </span>
                    <span className="pricing__per">/ mes</span>
                    {hasTrial && (
                      <span className="pricing__after">
                        Después de la prueba
                      </span>
                    )}
                  </div>
                </div>

                {hasTrial && trial && (
                  <div className="pricing__trial" role="note">
                    <strong>
                      Prueba: {trial.days} días + {formatInt(trial.gb)} GB
                    </strong>
                    <div className="pricing__trial-sub">
                      Solo tarjeta, 1ª vez. {HOME_HERO_MICROCOPY_TRIAL}
                    </div>
                  </div>
                )}

                <ul className="pricing__includes" aria-label="Incluye">
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">
                      Cuota de descarga: {formatInt(downloadQuotaGb)} GB/mes
                    </span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">
                      Actualizaciones: semanales (nuevos packs)
                    </span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} aria-hidden />
                    <span className="pricing__include-text">
                      Catálogo total: {catalogTBLabel} (eliges qué bajar)
                    </span>
                  </li>
                </ul>
                <p className="pricing__micro">{limitsNote}</p>

                <div className="pricing__cta">
                  <Link
                    to="/auth/registro"
                    state={{ from: "/planes" }}
                    className="home-cta home-cta--primary"
                    data-testid="home-pricing-primary-cta"
                    aria-label={ctaLabel}
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
                        La prueba aplica solo con tarjeta. Otros métodos (
                        {usdAltPaymentLabel}) se muestran como opciones sin
                        prueba al activar.
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
