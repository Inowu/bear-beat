import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { HOME_CTA_SECONDARY_LABEL } from "../homeCopy";
import { formatGB, formatInt, normalizeSearchKey } from "../homeFormat";

export type CatalogGenre = {
  id: string;
  name: string;
  searchKey: string;
  files: number;
  gb: number;
};

const MAX_RESULTS = 10;

export default function CatalogDemo(props: {
  genres: CatalogGenre[];
  isFallback: boolean;
  onSecondaryCtaClick: () => void;
}) {
  const { genres, isFallback, onSecondaryCtaClick } = props;
  const [query, setQuery] = useState("");
  const normalized = normalizeSearchKey(query);

  const results = useMemo(() => {
    const base = Array.isArray(genres) ? genres : [];
    const filtered = normalized
      ? base.filter((g) => g.searchKey.includes(normalized))
      : base;

    const sorted = [...filtered].sort((a, b) => {
      if (b.files !== a.files) return b.files - a.files;
      return a.name.localeCompare(b.name, "es");
    });

    return sorted.slice(0, MAX_RESULTS);
  }, [genres, normalized]);

  return (
    <section className="catalog-demo" aria-label="Demo del catálogo">
      <div className="ph__container">
        <div className="catalog-demo__head">
          <div>
            <h2 className="home-h2">Demo del catálogo</h2>
            <p className="home-sub">
              Busca un género y mira cómo está ordenado. Al activar ves el catálogo completo.
            </p>
          </div>
          <div className="catalog-demo__search">
            <Search size={18} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar género (ej. Cumbia, House, Reggaetón)"
              aria-label="Buscar género"
            />
          </div>
        </div>

        {isFallback && (
          <p className="catalog-demo__note" role="note">
            Catálogo en sincronización. Te mostramos un demo de ejemplo.
          </p>
        )}

        <div className="catalog-demo__grid" role="list" aria-label="Resultados de géneros">
          {results.map((g) => (
            <article key={g.id} className="catalog-demo__card" role="listitem">
              <strong>{g.name}</strong>
              <span>
                {formatInt(g.files)} archivos · {formatGB(g.gb)}
              </span>
            </article>
          ))}
          {results.length === 0 && (
            <p className="catalog-demo__empty">
              No encontramos ese género. Prueba otra palabra.
            </p>
          )}
        </div>

        <div className="catalog-demo__cta">
          <Link
            to="/auth/registro"
            state={{ from: "/planes" }}
            className="home-cta home-cta--secondary"
            onClick={onSecondaryCtaClick}
          >
            {HOME_CTA_SECONDARY_LABEL} →
          </Link>
        </div>
      </div>
    </section>
  );
}
