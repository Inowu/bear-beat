import { CirclePlay } from "src/icons";
import CatalogPreviewWebp from "../../../assets/images/home-catalog-preview.webp";
import CatalogPreviewPng from "../../../assets/images/home-catalog-preview.png";

export default function InsidePreview(props: {
  onDemoScroll: () => void;
  onTourClick: () => void;
}) {
  const { onDemoScroll, onTourClick } = props;

  return (
    <section className="inside-preview" aria-label="Así se ve por dentro">
      <div className="ph__container">
        <div className="inside-preview__head">
          <div>
            <h2 className="home-h2">Así se ve por dentro</h2>
            <p className="home-sub">Busca por canción, artista o carpeta y navega por Año / Mes / Semana / Género.</p>
          </div>
          <button type="button" className="home-cta home-cta--secondary inside-preview__cta" onClick={onDemoScroll}>
            <CirclePlay size={18} aria-hidden />
            Ver demo
          </button>
        </div>

        <div className="home-visual bb-hero-card">
          <div className="home-visual__layout">
            <div className="home-visual__meta">
              <div className="home-visual__head">
                <strong>Vista real del catálogo</strong>
                <span className="inside-preview__hint">Captura real</span>
              </div>
              <ul className="home-visual__bullets" aria-label="Qué verás al activar">
                <li>Audios / Videos / Karaoke</li>
                <li>Búsqueda por canción, artista o carpeta</li>
                <li>Guía FTP incluida</li>
              </ul>
              <p className="home-visual__note">Captura real del catálogo. Toca la imagen para verla completa.</p>
            </div>

            <div className="home-visual__media">
              <div className="home-visual__toolbar" aria-hidden>
                <span className="home-visual__traffic">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="home-visual__toolbar-label">Biblioteca Bear Beat</span>
                <span className="home-visual__zoom-chip">Toca para ampliar</span>
              </div>
              <div className="home-visual__frame">
                <button
                  type="button"
                  className="home-visual__frame-btn"
                  onClick={onTourClick}
                  aria-label="Abrir captura del catálogo en detalle"
                >
                  <picture>
                    <source srcSet={CatalogPreviewWebp} type="image/webp" />
                    <img
                      src={CatalogPreviewPng}
                      alt="Vista real del catálogo por dentro (biblioteca: Audios, Karaoke y Videos)"
                      width={960}
                      height={600}
                      loading="lazy"
                      decoding="async"
                    />
                  </picture>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
