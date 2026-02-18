import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, CirclePlay, Lock, Ticket } from "src/icons";
import {
  HOME_HERO_FIT_POINTS,
  HOME_HERO_MICROCOPY_BASE,
  HOME_HERO_MICROCOPY_TRIAL,
  HOME_HERO_SUBTITLE,
  HOME_HERO_TRUST_ITEMS,
  HOME_HERO_TITLE,
} from "../homeCopy";
import { formatInt } from "../homeFormat";

type TrialSummary = {
  enabled: boolean;
  days: number;
  gb: number;
};

export default function HomeHero(props: {
  totalTBLabel: string;
  downloadQuotaLabel: string;
  afterPriceLabel: string;
  trial: TrialSummary | null;
  ctaLabel: string;
  onPrimaryCtaClick: () => void;
  onDemoScroll: () => void;
}) {
  const { totalTBLabel, downloadQuotaLabel, afterPriceLabel, trial, ctaLabel, onPrimaryCtaClick, onDemoScroll } = props;

  const hasTrial = Boolean(trial?.enabled);
  const trialLabel =
    hasTrial && trial ? `Prueba: ${formatInt(trial.days)} días + ${formatInt(trial.gb)} GB.` : null;

  return (
    <section className="home-hero" aria-label="Presentación">
      <div className="ph__container home-hero__inner">
        <div className="home-hero__copy">
          <h1 className="home-hero__title">{HOME_HERO_TITLE}</h1>
          <p className="home-hero__sub">{HOME_HERO_SUBTITLE}</p>
          <ul className="home-hero__fit" aria-label="Ideal para">
            {HOME_HERO_FIT_POINTS.map((point) => (
              <li key={point}>
                <CheckCircle2 size={16} aria-hidden />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <div className="home-hero__stats" role="list" aria-label="Resumen">
            <div role="listitem" className="home-stat bb-stat-pill">
              <span className="home-stat__value bb-stat-pill__value">{totalTBLabel}</span>
              <span className="home-stat__label bb-stat-pill__label">catálogo</span>
            </div>
            <div role="listitem" className="home-stat bb-stat-pill">
              <span className="home-stat__value bb-stat-pill__value">{downloadQuotaLabel}</span>
              <span className="home-stat__label bb-stat-pill__label">cuota de descarga</span>
            </div>
            <div role="listitem" className="home-stat bb-stat-pill">
              <span className="home-stat__value bb-stat-pill__value">Audios / Videos / Karaoke</span>
              <span className="home-stat__label bb-stat-pill__label">Año / Mes / Semana / Género</span>
            </div>
          </div>

          <div className="home-hero__cta">
            <div className="home-hero__cta-row" role="group" aria-label="Acciones">
              <Link
                to="/auth/registro"
                state={{ from: "/planes" }}
                className="home-cta home-cta--primary"
                data-testid="home-cta-primary"
                onClick={onPrimaryCtaClick}
              >
                {ctaLabel}
                <ArrowRight size={18} aria-hidden />
              </Link>
              <button type="button" className="home-cta home-cta--secondary" onClick={onDemoScroll}>
                <CirclePlay size={18} aria-hidden />
                Ver demo
              </button>
            </div>
            <div className="home-hero__trust-inline" role="note" aria-label="Confianza rápida">
              {HOME_HERO_TRUST_ITEMS.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>

            <Link to="/auth" state={{ from: "/planes" }} className="home-hero__cta-alt">
              ¿Ya tienes cuenta? Inicia sesión →
            </Link>

            <div className="home-hero__micro">
              {trialLabel ? (
                <>
                  <span className="home-hero__micro-row">
                    <Ticket size={16} aria-hidden />
                    <span>
                      <strong>{trialLabel}</strong> {HOME_HERO_MICROCOPY_TRIAL}
                    </span>
                  </span>
                  <span className="home-hero__micro-row">
                    <ArrowRight size={16} aria-hidden />
                    Después: desde {afterPriceLabel}
                  </span>
                </>
              ) : (
                <span className="home-hero__micro-row">
                  <ArrowRight size={16} aria-hidden />
                  Desde {afterPriceLabel}
                </span>
              )}
              <span className="home-hero__micro-row">
                <Lock size={16} aria-hidden />
                {HOME_HERO_MICROCOPY_BASE}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
