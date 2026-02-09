import { useMemo, useState } from "react";
import { Modal } from "react-bootstrap";

export type SocialTopItem = {
  name: string;
  downloads: number;
};

function parseCamelot(value: string): string | null {
  const match = value.match(/\b(1[0-2]|[1-9])\s*([AB])\b/i);
  if (!match) return null;
  return `${match[1]}${match[2].toUpperCase()}`;
}

function extractBpmCandidates(fragment: string): number[] {
  const matches = fragment.match(/\b(\d{2,3})\b/g);
  if (!matches) return [];
  const nums = matches
    .map((raw) => Number(raw))
    .filter((n) => Number.isFinite(n) && n >= 60 && n <= 220);
  return Array.from(new Set(nums));
}

function parseBpm(value: string, camelot: string | null): number | null {
  const explicit = value.match(/\b(\d{2,3})\s*bpm\b/i);
  if (explicit) {
    const bpm = Number(explicit[1]);
    return Number.isFinite(bpm) && bpm >= 60 && bpm <= 220 ? bpm : null;
  }

  const paren = value.match(/\(([^)]{0,80})\)/);
  if (paren?.[1]) {
    const candidates = extractBpmCandidates(paren[1]);
    if (candidates.length) return candidates[candidates.length - 1] ?? null;
  }

  if (camelot) {
    const idx = value.toUpperCase().indexOf(camelot.toUpperCase());
    if (idx >= 0) {
      const after = value.slice(idx, idx + 28);
      const candidates = extractBpmCandidates(after);
      if (candidates.length) return candidates[candidates.length - 1] ?? null;
    }
  }

  return null;
}

function buildMetaLabel(value: string): string | null {
  const camelot = parseCamelot(value);
  const bpm = parseBpm(value, camelot);
  if (camelot && bpm) return `${camelot} • ${bpm} BPM`;
  if (camelot) return camelot;
  if (bpm) return `${bpm} BPM`;
  return null;
}

function TopList(props: {
  title: string;
  items: SocialTopItem[];
  numberLocale: string;
  maxRows: number;
}) {
  const { title, items, numberLocale, maxRows } = props;

  const rows = useMemo(() => {
    return (items ?? []).slice(0, maxRows).map((item) => ({
      ...item,
      metaLabel: buildMetaLabel(item.name),
    }));
  }, [items, maxRows]);

  return (
    <div className="social-proof__col" role="list" aria-label={title}>
      <h3 className="social-proof__col-title">{title}</h3>
      {rows.map((item) => (
        <div key={item.name} className="social-proof__row" role="listitem">
          <div className="social-proof__left">
            <span className="social-proof__name" title={item.name}>
              {item.name}
            </span>
            {item.metaLabel && <span className="social-proof__detail">{item.metaLabel}</span>}
          </div>
          <span className="social-proof__meta">
            {item.downloads.toLocaleString(numberLocale)} descargas
          </span>
        </div>
      ))}
    </div>
  );
}

export default function SocialProof(props: {
  audio: SocialTopItem[];
  video: SocialTopItem[];
  numberLocale: string;
}) {
  const { audio, video, numberLocale } = props;
  const [showMore, setShowMore] = useState(false);

  const hasAny = (audio?.length ?? 0) > 0 || (video?.length ?? 0) > 0;

  return (
    <section className="social-proof" aria-label="Descargas destacadas">
      <div className="ph__container">
        <div className="social-proof__head">
          <div>
            <h2 className="home-h2">Lo que más se descarga</h2>
            <p className="home-sub">Top real por categoría.</p>
          </div>
          {hasAny && (
            <button
              type="button"
              className="home-cta home-cta--secondary social-proof__more"
              onClick={() => setShowMore(true)}
            >
              Ver más →
            </button>
          )}
        </div>

        {!hasAny ? (
          <div className="social-proof__neutral" role="note">
            <h3>Repertorio listo por categorías</h3>
            <p>
              Video remixes, audios y karaokes organizados por carpetas para que descargues solo lo que necesitas.
            </p>
          </div>
        ) : (
          <div className="social-proof__grid" aria-label="Top descargas">
            {(audio?.length ?? 0) > 0 && (
              <TopList title="Audios" items={audio} numberLocale={numberLocale} maxRows={5} />
            )}
            {(video?.length ?? 0) > 0 && (
              <TopList title="Videos" items={video} numberLocale={numberLocale} maxRows={5} />
            )}
          </div>
        )}
      </div>

      <Modal
        show={showMore}
        onHide={() => setShowMore(false)}
        size="lg"
        centered
        className="home-demo-modal social-proof-modal"
        aria-labelledby="social-proof-title"
      >
        <Modal.Header closeButton>
          <Modal.Title id="social-proof-title">Lo que más se descarga</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="home-demo-modal__sub">Top real por categoría (últimos meses).</p>
          <div className="social-proof__grid" aria-label="Top descargas completo">
            {(audio?.length ?? 0) > 0 && (
              <TopList title="Audios" items={audio} numberLocale={numberLocale} maxRows={20} />
            )}
            {(video?.length ?? 0) > 0 && (
              <TopList title="Videos" items={video} numberLocale={numberLocale} maxRows={20} />
            )}
          </div>
        </Modal.Body>
      </Modal>
    </section>
  );
}
