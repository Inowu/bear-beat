import { Link } from "react-router-dom";
import { ArrowRight, CirclePlay, Music, Ticket } from "src/icons";
import {
  getHomeHeroFitPoints,
  getHomeHeroStats,
  getHomeHeroSubtitle,
  HOME_CTA_SECONDARY_LABEL,
  HOME_HERO_TRUST_ITEMS,
  HOME_HERO_TITLE,
} from "../homeCopy";
import { formatInt } from "../homeFormat";
import { Button } from "src/components/ui";

type TrialSummary = {
  enabled: boolean;
  days: number;
  gb: number;
};

export default function HomeHero(props: {
  totalFiles: number;
  totalGenres: number;
  totalTBLabel: string;
  afterPriceLabel: string;
  trial: TrialSummary | null;
  ctaLabel: string;
  primaryCheckoutFrom: string;
  onPrimaryCtaClick: () => void;
  onDemoScroll: () => void;
}) {
  const {
    totalFiles,
    totalGenres,
    totalTBLabel,
    afterPriceLabel,
    trial,
    ctaLabel,
    primaryCheckoutFrom,
    onPrimaryCtaClick,
    onDemoScroll,
  } = props;

  const hasTrial = Boolean(trial?.enabled);
  const trialLabel =
    hasTrial && trial
      ? `Prueba gratis: ${formatInt(trial.days)} días + ${formatInt(trial.gb)} GB de descarga`
      : null;
  const trialSongsEstimate =
    hasTrial && trial
      ? Math.max(0, Math.floor(Number(trial.gb ?? 0) * 6))
      : 0;
  const trialSongsLabel =
    trialSongsEstimate > 0 ? `+${formatInt(trialSongsEstimate)}` : "cientos de";
  const heroSubtitle = getHomeHeroSubtitle(totalFiles);
  const heroFitPoints = getHomeHeroFitPoints(totalGenres);
  const heroStats = getHomeHeroStats({
    totalFiles,
    totalTBLabel,
    totalGenres,
  });

  return (
    <section className="home-hero" aria-label="Presentación">
      <div className="ph__container home-hero__inner">
        <div className="home-hero__copy">
          <h1 className="home-hero__title">{HOME_HERO_TITLE}</h1>
          <p className="home-hero__sub">{heroSubtitle}</p>
          <ul className="home-hero__fit" aria-label="Beneficios principales">
            {heroFitPoints.map((point) => (
              <li key={point}>
                <Music size={16} aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <div className="home-hero__stats" role="list" aria-label="Resumen">
            {heroStats.map((item) => (
              <div key={item.label} role="listitem" className="home-stat bb-stat-pill">
                <span className="home-stat__value bb-stat-pill__value">{item.value}</span>
                <span className="home-stat__label bb-stat-pill__label">
                  {item.label}
                  {item.note ? <span className="home-stat__note">({item.note})</span> : null}
                </span>
              </div>
            ))}
          </div>

          <div className="home-hero__cta">
            <div className="home-hero__cta-row" role="group" aria-label="Acciones">
              <Link
                to="/auth/registro"
                state={{ from: primaryCheckoutFrom }}
                className="home-cta home-cta--primary"
                data-testid="home-cta-primary"
                onClick={onPrimaryCtaClick}
              >
                {ctaLabel}
                <ArrowRight size={18} aria-hidden />
              </Link>
              <Button unstyled type="button" className="home-cta home-cta--secondary home-hero__cta-demo" onClick={onDemoScroll}>
                <CirclePlay size={18} aria-hidden />
                {HOME_CTA_SECONDARY_LABEL}
              </Button>
            </div>
            <div className="home-hero__trust-inline" role="note" aria-label="Confianza rápida">
              {HOME_HERO_TRUST_ITEMS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <Link to="/auth" state={{ from: primaryCheckoutFrom }} className="home-hero__cta-alt">
              ¿Ya tienes cuenta? Inicia sesión →
            </Link>

            <div className="home-hero__micro">
              {trialLabel ? (
                <>
                  <span className="home-hero__micro-row">
                    <Ticket size={16} aria-hidden />
                    <span>
                      <strong>{trialLabel}</strong>
                    </span>
                  </span>
                  <span className="home-hero__micro-row">
                    <ArrowRight size={16} aria-hidden />
                    Eso son {trialSongsLabel} canciones para probar en tu evento
                    este fin de semana.
                  </span>
                  <span className="home-hero__micro-row">
                    <ArrowRight size={16} aria-hidden />
                    Si no te convence, cancelas y no pagas nada. Cero riesgo.
                  </span>
                  <span className="home-hero__micro-row">
                    <ArrowRight size={16} aria-hidden />
                    Después: {afterPriceLabel}
                  </span>
                </>
              ) : (
                <span className="home-hero__micro-row">
                  <ArrowRight size={16} aria-hidden />
                  Desde {afterPriceLabel}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
