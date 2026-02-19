import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "src/icons";
import { useEffect, useId, useMemo, useState } from "react";
import PaymentMethodLogos, {
  type PaymentMethodId,
} from "../../../components/PaymentMethodLogos/PaymentMethodLogos";
import { HOME_CTA_PRICING_LABEL_TRIAL } from "../homeCopy";
import { formatInt } from "../homeFormat";
import { Button } from "src/components/ui";

export type TrialSummary = {
  enabled: boolean;
  days: number;
  gb: number;
};

export type PricingStatus = "loading" | "loaded" | "error";

export type PricingPlan = {
  planId: number;
  currency: "mxn" | "usd";
  name: string;
  price: number;
  gigas: number;
  hasPaypal: boolean;
  pricingPaymentMethods: PaymentMethodId[];
  trialPricingPaymentMethods: PaymentMethodId[];
  altPaymentLabel: string;
};

const DAYS_PER_MONTH_FOR_DAILY_PRICE = 30;
const DISPLAY_LOCALE_BY_CURRENCY: Record<"mxn" | "usd", string> = {
  mxn: "es-MX",
  usd: "en-US",
};

function formatCurrency(
  amount: number,
  currency: "mxn" | "usd",
  locale: string,
  opts?: { minimumFractionDigits?: number; maximumFractionDigits?: number },
): string {
  const code = currency === "mxn" ? "MXN" : "USD";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
      minimumFractionDigits: opts?.minimumFractionDigits,
      maximumFractionDigits: opts?.maximumFractionDigits,
    }).format(amount);
  } catch {
    return `${amount} ${code}`;
  }
}

function getDailyPrice(monthlyPrice: number): number {
  const safe = Number(monthlyPrice);
  if (!Number.isFinite(safe) || safe <= 0) return 0;
  const rawDaily = safe / DAYS_PER_MONTH_FOR_DAILY_PRICE;
  // Keep a stable 1-decimal marketing figure, then render it with 2 decimals.
  return Math.floor(rawDaily * 10) / 10;
}

function formatMonthlyPriceWithCode(
  amount: number,
  currency: "mxn" | "usd",
  _locale: string,
): string {
  const code = currency === "mxn" ? "MXN" : "USD";
  const hasDecimals = !Number.isInteger(amount);
  const displayLocale = DISPLAY_LOCALE_BY_CURRENCY[currency];
  const formatted = formatCurrency(amount, currency, displayLocale, {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${code} ${formatted}/mes`;
}

function formatDailyPrice(amount: number, currency: "mxn" | "usd", _locale: string): string {
  return formatCurrency(amount, currency, DISPLAY_LOCALE_BY_CURRENCY[currency], {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function Pricing(props: {
  plans: { mxn?: PricingPlan | null; usd?: PricingPlan | null };
  status: PricingStatus;
  defaultCurrency: "mxn" | "usd";
  numberLocale: string;
  totalFiles: number;
  totalGenres: number;
  karaokes: number;
  trial: TrialSummary | null;
  ctaLabel: string;
  primaryCheckoutFrom: string;
  onPrimaryCtaClick: () => void;
}) {
  const {
    plans,
    status,
    defaultCurrency,
    numberLocale,
    totalFiles,
    totalGenres,
    karaokes,
    trial,
    ctaLabel,
    primaryCheckoutFrom,
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
  const pricingCtaLabel = hasTrial ? HOME_CTA_PRICING_LABEL_TRIAL : ctaLabel;
  const microcopy = "Pago seguro y activación inmediata.";
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
  const mxnCheckoutFrom = useMemo(() => {
    const planId = Number(mxnPlan?.planId ?? 0);
    if (Number.isFinite(planId) && planId > 0)
      return `/comprar?priceId=${planId}&entry=fastlane`;
    return primaryCheckoutFrom;
  }, [mxnPlan?.planId, primaryCheckoutFrom]);
  const usdCheckoutFrom = useMemo(() => {
    const planId = Number(usdPlan?.planId ?? 0);
    if (Number.isFinite(planId) && planId > 0)
      return `/comprar?priceId=${planId}&entry=fastlane`;
    return primaryCheckoutFrom;
  }, [usdPlan?.planId, primaryCheckoutFrom]);

  const safeTotalFiles = Math.max(0, Number(totalFiles ?? 0));
  const safeTotalGenres = Math.max(0, Number(totalGenres ?? 0));
  const safeKaraokes = Math.max(0, Number(karaokes ?? 0));
  const totalFilesLabel = safeTotalFiles > 0 ? formatInt(safeTotalFiles) : "N/D";
  const totalGenresLabel = safeTotalGenres > 0 ? `${formatInt(safeTotalGenres)}+` : "N/D";
  const karaokesLabel = safeKaraokes > 0 ? formatInt(safeKaraokes) : "N/D";
  const pricingHighlights = useMemo(
    () => [
      `${totalFilesLabel} archivos listos para cabina`,
      `${totalGenresLabel} géneros latinos cubiertos`,
      "Actualizaciones semanales (no mensuales como otros)",
      "BPM + Key en cada archivo (ahórrate horas de análisis)",
      "Carpetas organizadas por género, mes y semana",
      `Karaoke: ${karaokesLabel} canciones en video listas para evento`,
      "Soporte para activar tu conexión en minutos",
    ],
    [karaokesLabel, totalFilesLabel, totalGenresLabel],
  );
  const mxnDaily = useMemo(
    () => formatDailyPrice(getDailyPrice(mxnPlan?.price ?? 0), "mxn", numberLocale),
    [mxnPlan?.price, numberLocale],
  );
  const usdDaily = useMemo(
    () => formatDailyPrice(getDailyPrice(usdPlan?.price ?? 0), "usd", numberLocale),
    [numberLocale, usdPlan?.price],
  );
  const trialSongsEstimate = hasTrial && trial
    ? Math.max(0, Math.floor(Number(trial.gb ?? 0) * 6))
    : 0;
  const trialSongsLabel =
    trialSongsEstimate > 0 ? `+${formatInt(trialSongsEstimate)}` : "cientos de";
  const mxnTrialAfterLabel = useMemo(() => {
    if (!mxnPlan || Number(mxnPlan.price) <= 0) return "";
    return `${formatMonthlyPriceWithCode(mxnPlan.price, "mxn", numberLocale)} · (${mxnDaily}/día)`;
  }, [mxnDaily, mxnPlan, numberLocale]);
  const usdTrialAfterLabel = useMemo(() => {
    if (!usdPlan || Number(usdPlan.price) <= 0) return "";
    return `${formatMonthlyPriceWithCode(usdPlan.price, "usd", numberLocale)} · (${usdDaily}/día)`;
  }, [numberLocale, usdDaily, usdPlan]);

  return (
    <section id="precio" className="pricing" aria-label="Precio">
      <div className="ph__container">
        <div className="pricing__head">
          <h2 className="home-h2">Un precio. Todo incluido. Sin sorpresas.</h2>
          <p className="home-sub">
            Audios, videos y karaokes por menos de lo que cuesta un café diario.
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
            <Button unstyled
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
            </Button>
            <Button unstyled
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
            </Button>
          </div>
        )}

        <div className="pricing__panels" aria-label="Plan">
          {isLoading && (
            <div
              className="pricing__card bb-hero-card pricing__card--skeleton"
              aria-label="Actualizando precio"
              role="status"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="sr-only">Actualizando precio del plan</span>

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
                    <span className="pricing__daily">({mxnDaily}/día)</span>
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
                      Prueba gratis: {trial.days} días + {formatInt(trial.gb)} GB
                      de descarga
                    </strong>
                    <div className="pricing__trial-sub">
                      Eso son {trialSongsLabel} canciones para probar en tu evento este fin de semana.
                    </div>
                    <div className="pricing__trial-note">
                      Si no te convence, cancelas y no pagas nada. Cero riesgo.
                    </div>
                    {mxnTrialAfterLabel ? (
                      <div className="pricing__trial-note">
                        Después: {mxnTrialAfterLabel}
                      </div>
                    ) : null}
                  </div>
                )}

                <ul className="pricing__includes" aria-label="Incluye">
                  {pricingHighlights.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={16} aria-hidden />
                      <span className="pricing__include-text">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="pricing__cta">
                  <Link
                    to="/auth/registro"
                    state={{ from: mxnCheckoutFrom }}
                    className="home-cta home-cta--primary"
                    data-testid="home-pricing-primary-cta"
                    aria-label={pricingCtaLabel}
                    onClick={onPrimaryCtaClick}
                  >
                    {pricingCtaLabel}
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
                    <span className="pricing__daily">({usdDaily}/día)</span>
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
                      Prueba gratis: {trial.days} días + {formatInt(trial.gb)} GB
                      de descarga
                    </strong>
                    <div className="pricing__trial-sub">
                      Eso son {trialSongsLabel} canciones para probar en tu evento este fin de semana.
                    </div>
                    <div className="pricing__trial-note">
                      Si no te convence, cancelas y no pagas nada. Cero riesgo.
                    </div>
                    {usdTrialAfterLabel ? (
                      <div className="pricing__trial-note">
                        Después: {usdTrialAfterLabel}
                      </div>
                    ) : null}
                  </div>
                )}

                <ul className="pricing__includes" aria-label="Incluye">
                  {pricingHighlights.map((item) => (
                    <li key={item}>
                      <CheckCircle2 size={16} aria-hidden />
                      <span className="pricing__include-text">{item}</span>
                    </li>
                  ))}
                </ul>

                <div className="pricing__cta">
                  <Link
                    to="/auth/registro"
                    state={{ from: usdCheckoutFrom }}
                    className="home-cta home-cta--primary"
                    data-testid="home-pricing-primary-cta"
                    aria-label={pricingCtaLabel}
                    onClick={onPrimaryCtaClick}
                  >
                    {pricingCtaLabel}
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
