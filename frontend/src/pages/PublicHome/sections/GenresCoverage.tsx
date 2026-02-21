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

        <div className="genres-coverage__lanes" aria-label="Carriles animados de géneros">
          {categorized.map((category, index) => {
            const reverse = index % 2 === 1;
            return (
              <section key={category.key} className="genres-coverage__lane bb-market-surface" aria-label={category.title}>
                <header className="genres-coverage__lane-head">
                  <h3 className="genres-coverage__title">{category.title}</h3>
                  <span className="genres-coverage__count">{formatInt(category.genres.length)}</span>
                </header>

                {category.genres.length > 0 ? (
                  <div className="genres-coverage__marquee" role="presentation">
                    <div
                      className={`genres-coverage__track ${reverse ? "is-reverse" : ""}`}
                      aria-label={`Géneros en ${category.title}`}
                    >
                      {[0, 1].map((replica) => (
                        <div
                          key={`${category.key}-replica-${replica}`}
                          className={`genres-coverage__segment ${replica === 1 ? "is-clone" : ""}`}
                          aria-hidden={replica === 1}
                        >
                          {category.genres.map((genre) => (
                            <Link
                              key={`${category.key}-${replica}-${genre.id}`}
                              to="/auth/prueba"
                              state={{ from: buildGenreFilterUrl(genre.name) }}
                              className="genres-coverage__chip"
                              onClick={replica === 0 ? () => onGenreClick?.(genre) : undefined}
                              tabIndex={replica === 1 ? -1 : undefined}
                            >
                              {genre.name}
                            </Link>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="genres-coverage__empty">Actualizando géneros de esta categoría.</p>
                )}
              </section>
            );
          })}
        </div>

        <p className="genres-coverage__tail">
          ¿No ves tu género? <strong>Escríbenos</strong> — agregamos contenido cada semana.
        </p>
      </div>
    </section>
  );
}
