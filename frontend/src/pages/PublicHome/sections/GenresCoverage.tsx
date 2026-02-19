import { Link } from "react-router-dom";
import { useMemo } from "react";
import { formatInt } from "../homeFormat";

export type HomeCatalogGenre = {
  id: string;
  name: string;
  searchKey: string;
  files: number;
  gb: number;
};

type CoverageCategoryKey = "latinos" | "international" | "specialties";

type CoverageCategory = {
  key: CoverageCategoryKey;
  title: string;
  genres: HomeCatalogGenre[];
};

const SPECIALTY_KEYWORDS = [
  "retro",
  "old school",
  "acapella",
  "mashup",
  "megamix",
  "navidad",
  "christmas",
  "transition",
  "transicion",
  "transiciones",
  "intro",
  "out",
  "edit",
];

const INTERNATIONAL_KEYWORDS = [
  "hip hop",
  "house",
  "electro",
  "edm",
  "dance",
  "top 40",
  "ingles",
  "english",
  "r b",
  "rock",
  "country",
  "dubstep",
  "nu disco",
  "afro house",
  "moombahton",
  "afro",
];

function inferCoverageCategory(searchKey: string): CoverageCategoryKey {
  const normalized = `${searchKey ?? ""}`.trim().toLowerCase();
  if (!normalized) return "latinos";
  if (SPECIALTY_KEYWORDS.some((keyword) => normalized.includes(keyword)))
    return "specialties";
  if (INTERNATIONAL_KEYWORDS.some((keyword) => normalized.includes(keyword)))
    return "international";
  return "latinos";
}

function buildGenreFilterUrl(genre: string): string {
  return `/?genre=${encodeURIComponent(genre)}`;
}

export default function GenresCoverage(props: {
  genres: HomeCatalogGenre[];
  totalGenres: number;
  onGenreClick?: (genre: HomeCatalogGenre) => void;
}) {
  const { genres, totalGenres, onGenreClick } = props;
  const safeTotalGenres = Math.max(0, Number(totalGenres ?? 0));
  const titleLead = safeTotalGenres > 0 ? `${formatInt(safeTotalGenres)}+` : "Géneros";

  const categorized = useMemo<CoverageCategory[]>(() => {
    const source = Array.isArray(genres) ? genres : [];
    const byCategory: Record<CoverageCategoryKey, HomeCatalogGenre[]> = {
      latinos: [],
      international: [],
      specialties: [],
    };

    source.forEach((genre) => {
      const key = inferCoverageCategory(genre.searchKey);
      byCategory[key].push(genre);
    });

    return [
      {
        key: "latinos",
        title: "LATINOS",
        genres: byCategory.latinos,
      },
      {
        key: "international",
        title: "AMERICANOS / INTERNACIONALES",
        genres: byCategory.international,
      },
      {
        key: "specialties",
        title: "ESPECIALIDADES",
        genres: byCategory.specialties,
      },
    ];
  }, [genres]);

  return (
    <section className="genres-coverage" aria-label="Géneros que cubrimos">
      <div className="ph__container">
        <div className="genres-coverage__head">
          <h2 className="home-h2">{titleLead} géneros listos para cualquier evento</h2>
        </div>

        <div className="genres-coverage__desktop" aria-label="Categorías de géneros">
          {categorized.map((category) => (
            <section key={category.key} className="genres-coverage__col bb-market-surface" aria-label={category.title}>
              <h3 className="genres-coverage__title">{category.title}</h3>
              <ul className="genres-coverage__list">
                {category.genres.map((genre) => (
                  <li key={`${category.key}-${genre.id}`}>
                    <Link
                      to="/auth/registro"
                      state={{ from: buildGenreFilterUrl(genre.name) }}
                      className="genres-coverage__genre-link"
                      onClick={() => onGenreClick?.(genre)}
                    >
                      {genre.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="genres-coverage__mobile" aria-label="Géneros por categoría">
          {categorized.map((category, index) => (
            <details key={`mobile-${category.key}`} className="genres-coverage__accordion bb-market-surface" open={index === 0}>
              <summary className="genres-coverage__summary">
                <span>{category.title}</span>
                <span>{formatInt(category.genres.length)}</span>
              </summary>
              <ul className="genres-coverage__list">
                {category.genres.map((genre) => (
                  <li key={`mobile-${category.key}-${genre.id}`}>
                    <Link
                      to="/auth/registro"
                      state={{ from: buildGenreFilterUrl(genre.name) }}
                      className="genres-coverage__genre-link"
                      onClick={() => onGenreClick?.(genre)}
                    >
                      {genre.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>

        <p className="genres-coverage__tail">
          ¿No ves tu género? <strong>Escríbenos</strong> — agregamos contenido cada semana.
        </p>
      </div>
    </section>
  );
}
