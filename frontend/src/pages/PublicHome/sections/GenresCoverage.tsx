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

const LATINO_KEYWORDS = [
  "reggaeton",
  "dembow",
  "cumbia",
  "bachata",
  "guaracha",
  "salsa",
  "merengue",
  "corridos",
  "banda",
  "norteno",
  "nortena",
  "huapango",
  "cubaton",
  "vallenato",
  "duranguense",
  "punta",
  "latino",
  "latin",
  "espanol",
  "regional",
  "mariachi",
  "ranchera",
  "grupera",
  "sonidera",
  "tropical",
  "bolero",
  "balada",
  "timba",
  "mambo",
];

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
  "pop",
  "reggae",
  "hip hop",
  "trap",
  "drill",
  "jersey",
  "twerk",
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
  "techno",
  "trance",
  "funk",
  "disco",
  "indie",
  "alternative",
  "alternativo",
  "nu disco",
  "afro house",
  "moombahton",
  "afro",
];

const DECADE_LABEL_REGEX = /\b(?:19|20)?(70|80|90|00)\s?s\b/;

function hasKeyword(searchKey: string, keywords: string[]): boolean {
  const normalized = ` ${searchKey.trim().toLowerCase()} `;
  return keywords.some((keyword) => {
    const token = `${keyword ?? ""}`.trim().toLowerCase();
    if (!token) return false;
    return normalized.includes(` ${token} `);
  });
}

export function inferCoverageCategory(searchKey: string): CoverageCategoryKey {
  const normalized = `${searchKey ?? ""}`.trim().toLowerCase();
  if (!normalized) return "latinos";

  if (
    DECADE_LABEL_REGEX.test(normalized) ||
    hasKeyword(normalized, SPECIALTY_KEYWORDS)
  ) {
    return "specialties";
  }

  const hasLatinoSignals = hasKeyword(normalized, LATINO_KEYWORDS);
  const hasInternationalSignals = hasKeyword(normalized, INTERNATIONAL_KEYWORDS);

  if (hasLatinoSignals && !hasInternationalSignals) return "latinos";
  if (hasInternationalSignals && !hasLatinoSignals) return "international";

  if (hasLatinoSignals && hasInternationalSignals) {
    if (
      normalized.includes("latino") ||
      normalized.includes("latin") ||
      normalized.includes("espanol")
    ) {
      return "latinos";
    }
    return "international";
  }

  if (normalized.includes("urbano")) return "latinos";
  return "international";
}

function dedupeGenres(genres: HomeCatalogGenre[]): HomeCatalogGenre[] {
  const seen = new Set<string>();
  const out: HomeCatalogGenre[] = [];

  for (const genre of genres) {
    const key = `${genre.searchKey ?? ""}`.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(genre);
  }

  return out;
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
        genres: dedupeGenres(byCategory.latinos),
      },
      {
        key: "international",
        title: "AMERICANOS / INTERNACIONALES",
        genres: dedupeGenres(byCategory.international),
      },
      {
        key: "specialties",
        title: "ESPECIALIDADES",
        genres: dedupeGenres(byCategory.specialties),
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
