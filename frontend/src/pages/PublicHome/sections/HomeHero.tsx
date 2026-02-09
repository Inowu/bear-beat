import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle } from "lucide-react";
import {
  HOME_CTA_PRIMARY_LABEL,
  HOME_HERO_MICROCOPY_BASE,
  HOME_HERO_MICROCOPY_TRIAL,
  HOME_HERO_SUBTITLE,
  HOME_HERO_TITLE,
} from "../homeCopy";

type TrialSummary = {
  enabled: boolean;
  days: number;
  gb: number;
};

export default function HomeHero(props: {
  totalTBLabel: string;
  downloadQuotaLabel: string;
  trial: TrialSummary | null;
  onPrimaryCtaClick: () => void;
  onDemoClick: () => void;
}) {
  const { totalTBLabel, downloadQuotaLabel, trial, onPrimaryCtaClick, onDemoClick } = props;

  const hasTrial = Boolean(trial?.enabled);
  const microcopy = hasTrial ? HOME_HERO_MICROCOPY_TRIAL : HOME_HERO_MICROCOPY_BASE;
  const bulletTrialAddon =
    hasTrial && trial
      ? ` · Prueba: ${trial.days} días / ${trial.gb} GB (solo tarjeta, 1ª vez)`
      : "";

  return (
    <section className="home-hero" aria-label="Presentación">
      <div className="ph__container home-hero__inner">
        <div className="home-hero__copy">
          <h1 className="home-hero__title">{HOME_HERO_TITLE}</h1>
          <p className="home-hero__sub">{HOME_HERO_SUBTITLE}</p>

          <ul className="home-hero__bullets" aria-label="Puntos clave">
            <li>Catálogo total: {totalTBLabel} (eliges qué bajar)</li>
            <li>Descargas: {downloadQuotaLabel}{bulletTrialAddon}</li>
            <li>Carpetas listas por género/año/mood + activación guiada por chat</li>
          </ul>

          <div className="home-hero__cta">
            <Link
              to="/auth/registro"
              state={{ from: "/planes" }}
              className="home-cta home-cta--primary"
              onClick={onPrimaryCtaClick}
            >
              {HOME_CTA_PRIMARY_LABEL}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <p className="home-hero__micro">{microcopy}</p>
          </div>
        </div>

        <div className="home-hero__visual" aria-label="Así se ve por dentro">
          <div className="home-visual">
            <div className="home-visual__head">
              <strong>Así se ve por dentro</strong>
              <button type="button" className="home-visual__demo" onClick={onDemoClick}>
                <PlayCircle size={18} aria-hidden />
                Ver demo
              </button>
            </div>
            <div className="home-visual__frame" role="img" aria-label="Vista previa del catálogo por carpetas">
              <div className="home-visual__row">
                <span className="home-visual__dot" />
                <span>Video Remixes</span>
              </div>
              <div className="home-visual__row">
                <span className="home-visual__dot home-visual__dot--muted" />
                <span>→ Género</span>
              </div>
              <div className="home-visual__row">
                <span className="home-visual__dot home-visual__dot--muted" />
                <span>→ Año</span>
              </div>
              <div className="home-visual__row">
                <span className="home-visual__dot home-visual__dot--muted" />
                <span>→ Mes</span>
              </div>
              <div className="home-visual__chips" aria-hidden>
                <span>MP4</span>
                <span>MP3</span>
                <span>Karaokes</span>
              </div>
            </div>
            <p className="home-visual__note">
              {/* TODO: reemplazar este placeholder por video (20–30s) o screenshot real del catálogo. */}
              Vista demo. Al activar ves el catálogo completo y descargas lo que necesitas.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
