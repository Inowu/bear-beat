import { Link } from "react-router-dom";
import "./GenreTicker.scss";
import { Button } from "src/components/ui";
const ROW1 =
  "Cumbias Wepa (100GB) • Reggaeton Old School (1.1TB) • Corridos (75GB) • Video Remixes (11.5TB) • Banda (40GB) • Cumbias Sonideras • Norteñas • Sierreñas • ";
const ROW2 =
  "Tech House • Salsa Remix • Retro 80s • Guaracha • Cumbias Sonideras • Norteñas Sax • Electrónica • Bachata • Quebradita • ";

function GenreTicker() {
  return (
    <section className="genre-ticker" aria-label="Géneros del catálogo">
      <div className="genre-ticker__track-wrap">
        <div className="genre-ticker__gradient genre-ticker__gradient--l" aria-hidden />
        <div className="genre-ticker__gradient genre-ticker__gradient--r" aria-hidden />
        <div className="genre-ticker__row genre-ticker__row--1">
          <span className="genre-ticker__text">{ROW1.repeat(3)}</span>
        </div>
        <div className="genre-ticker__row genre-ticker__row--2">
          <span className="genre-ticker__text">{ROW2.repeat(3)}</span>
        </div>
      </div>
      <Link
        to="/auth/registro"
        state={{ from: "/planes" }}
        className="genre-ticker__cta"
      >
        ¿Quieres ver todo? Regístrate gratis para ver los demos
      </Link>
    </section>
  );
}

export default GenreTicker;
