import { Link } from "react-router-dom";
import { ArrowRight, PlayCircle } from "lucide-react";
import {
  HOME_HERO_MICROCOPY_BASE,
  HOME_HERO_MICROCOPY_TRIAL,
  HOME_HERO_SUBTITLE,
  HOME_HERO_TITLE,
} from "../homeCopy";
import { formatInt } from "../homeFormat";
import CatalogPreviewWebp from "../../../assets/images/home-catalog-preview.webp";
import CatalogPreviewPng from "../../../assets/images/home-catalog-preview.png";

type TrialSummary = {
  enabled: boolean;
  days: number;
  gb: number;
};

export default function HomeHero(props: {
  totalTBLabel: string;
  downloadQuotaLabel: string;
  trial: TrialSummary | null;
  ctaLabel: string;
  onPrimaryCtaClick: () => void;
  onDemoScroll: () => void;
  onTourClick: () => void;
}) {
  const { totalTBLabel, downloadQuotaLabel, trial, ctaLabel, onPrimaryCtaClick, onDemoScroll, onTourClick } = props;

  const hasTrial = Boolean(trial?.enabled);
  const microcopy = hasTrial ? HOME_HERO_MICROCOPY_TRIAL : HOME_HERO_MICROCOPY_BASE;
  const bulletTrialAddon =
    hasTrial && trial
      ? ` · Prueba: ${formatInt(trial.days)} días / ${formatInt(trial.gb)} GB (solo tarjeta, 1ª vez)`
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
              data-testid="home-cta-primary"
              onClick={onPrimaryCtaClick}
            >
              {ctaLabel}
              <ArrowRight size={18} aria-hidden />
            </Link>
            <p className="home-hero__micro">{microcopy}</p>
            <Link to="/auth" state={{ from: "/planes" }} className="home-hero__cta-alt">
              Ya tengo cuenta
            </Link>
          </div>
        </div>

        <div className="home-hero__visual" aria-label="Así se ve por dentro">
            <div className="home-visual">
              <div className="home-visual__head">
                <strong>Así se ve por dentro</strong>
                <button type="button" className="home-visual__demo" onClick={onDemoScroll}>
                  <PlayCircle size={18} aria-hidden />
                  Ver demo
                </button>
              </div>
            <ul className="home-visual__bullets" aria-label="Qué verás al activar">
              <li>Audios / Videos / Karaoke</li>
              <li>Búsqueda por canción, artista o carpeta</li>
              <li>Guía FTP incluida</li>
            </ul>
            <div className="home-visual__frame">
              <button
                type="button"
                className="home-visual__frame-btn"
                onClick={onTourClick}
                aria-label="Ver captura del catálogo"
              >
                <picture>
                  <source srcSet={CatalogPreviewWebp} type="image/webp" />
                  <img
                    src={CatalogPreviewPng}
                    alt="Vista real del catálogo por dentro (biblioteca y secciones)"
                    width={960}
                    height={600}
                    loading="eager"
                    decoding="async"
                  />
                </picture>
              </button>
            </div>
            <p className="home-visual__note">Vista real del catálogo. Toca la captura para ver detalles.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
