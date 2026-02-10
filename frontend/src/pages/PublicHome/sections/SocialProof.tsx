import { useCallback, useId, useMemo, useState } from "react";
import { Modal } from "react-bootstrap";
import { Loader2, Play } from "lucide-react";
import trpc from "../../../api";
import { apiBaseUrl } from "../../../utils/runtimeConfig";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
import { formatDownloads } from "../homeFormat";
import PreviewModal from "../../../components/PreviewModal/PreviewModal";

export type SocialTopItem = {
  path: string;
  name: string;
  downloads: number;
};

type DemoKind = "audio" | "video";

function isLikelyBpm(value: number): boolean {
  return Number.isFinite(value) && value >= 50 && value <= 220;
}

function extractCamelot(value: string): string | null {
  const m = /\b(1[0-2]|[1-9])\s*([AB])\b/i.exec(value);
  if (!m) return null;
  return `${m[1]}${m[2].toUpperCase()}`;
}

function extractBpm(value: string): number | null {
  const explicit = /(\d{2,3})\s*bpm\b/i.exec(value);
  if (explicit) {
    const n = Number(explicit[1]);
    return isLikelyBpm(n) ? n : null;
  }

  const candidates = Array.from(value.matchAll(/\b(\d{2,3})\b/g))
    .map((m) => Number(m[1]))
    .filter(isLikelyBpm);

  if (candidates.length === 0) return null;
  return candidates[candidates.length - 1] ?? null;
}

function extractTrailingMeta(value: string): {
  clean: string;
  bpm: number | null;
  camelot: string | null;
} {
  const trimmed = `${value ?? ""}`.trim();
  if (!trimmed) return { clean: "", bpm: null, camelot: null };

  let clean = trimmed;
  let bpm: number | null = null;
  let camelot: string | null = null;

  // "(10B 114)" or "(114 BPM 10B)" at the end.
  const parenRe = /\s*\(([^)]*)\)\s*$/;
  const parenMatch = parenRe.exec(clean);
  if (parenMatch) {
    const inside = `${parenMatch[1] ?? ""}`.trim();
    const maybeBpm = extractBpm(inside);
    const maybeCamelot = extractCamelot(inside);
    if (maybeBpm || maybeCamelot) {
      bpm = maybeBpm ?? bpm;
      camelot = maybeCamelot ?? camelot;
      clean = clean.slice(0, parenMatch.index).trim();
    }
  }

  // Common suffixes: "... 10B 114" or "... 114 10B".
  const suffixCamelotFirst =
    /\s+\b((?:1[0-2]|[1-9])[AB])\b\s*[–-]?\s*\b(\d{2,3})\b(?:\s*bpm)?\s*$/i.exec(clean);
  if (suffixCamelotFirst) {
    const maybeBpm = Number(suffixCamelotFirst[2]);
    if (isLikelyBpm(maybeBpm)) {
      camelot = suffixCamelotFirst[1].toUpperCase();
      bpm = maybeBpm;
      clean = clean.slice(0, suffixCamelotFirst.index).trim();
    }
  } else {
    const suffixBpmFirst =
      /\s+\b(\d{2,3})\b(?:\s*bpm)?\s*[–-]?\s*\b((?:1[0-2]|[1-9])[AB])\b\s*$/i.exec(clean);
    if (suffixBpmFirst) {
      const maybeBpm = Number(suffixBpmFirst[1]);
      if (isLikelyBpm(maybeBpm)) {
        bpm = maybeBpm;
        camelot = suffixBpmFirst[2].toUpperCase();
        clean = clean.slice(0, suffixBpmFirst.index).trim();
      }
    }
  }

  return { clean, bpm, camelot };
}

function TopList(props: {
  title: string;
  items: SocialTopItem[];
  maxRows: number;
  activeKey: string | null;
  loadingKey: string | null;
  onOpenDemo: (row: { key: string; path: string; label: string; kindHint: string }) => void;
}) {
  const { title, items, maxRows, activeKey, loadingKey, onOpenDemo } = props;
  const headingId = useId();

  const rows = useMemo(() => {
    return (items ?? []).slice(0, maxRows).map((item, idx) => {
      const raw = `${item.name ?? ""}`.trim();
      const parsed = extractTrailingMeta(raw);
      const normalized = parsed.clean || raw;
      const rowKey = item.path ? item.path : `${raw}__${idx}`;

      const sepMatch = normalized.match(/\s[-–]\s/);
      if (!sepMatch) {
        return {
          key: rowKey,
          path: item.path,
          artist: "",
          track: normalized || raw,
          downloads: item.downloads,
          bpm: parsed.bpm,
          camelot: parsed.camelot,
        };
      }

      const sepIdx = sepMatch.index ?? -1;
      const sepLen = sepMatch[0].length;
      const artist = normalized.slice(0, sepIdx).trim();
      const track = normalized.slice(sepIdx + sepLen).trim();
      return {
        key: rowKey,
        path: item.path,
        artist,
        track: track || raw,
        downloads: item.downloads,
        bpm: parsed.bpm,
        camelot: parsed.camelot,
      };
    });
  }, [items, maxRows]);

  const showKeyMeta = rows.length > 0 && rows.every((row) => Boolean(row.bpm) && Boolean(row.camelot));

  return (
    <section className="social-proof__col" aria-labelledby={headingId}>
      <h3 id={headingId} className="social-proof__col-title">
        {title}
      </h3>
      <div role="list">
        {rows.map((item) => (
          <div key={item.key} className="social-proof__row" role="listitem">
            <button
              type="button"
              className={[
                "social-proof__play",
                activeKey === item.key ? "social-proof__play--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                onOpenDemo({
                  key: item.key,
                  path: item.path,
                  label: item.artist ? `${item.artist} – ${item.track}` : item.track,
                  kindHint: title.toLowerCase(),
                });
              }}
              disabled={!item.path || loadingKey === item.key}
              aria-label={
                loadingKey === item.key
                  ? "Cargando demo"
                  : `Abrir demo de ${item.artist ? `${item.artist} – ${item.track}` : item.track}`
              }
              data-testid="home-topdemo-play"
            >
              {loadingKey === item.key ? (
                <Loader2 size={18} className="social-proof__spinner" aria-hidden />
              ) : (
                <Play size={18} aria-hidden />
              )}
            </button>
            <div className="social-proof__left">
              <span className="social-proof__name" title={item.artist ? `${item.artist} – ${item.track}` : item.track}>
                {item.artist ? (
                  <>
                    <span className="social-proof__artist">{item.artist}</span>
                    <span className="social-proof__dash" aria-hidden>
                      {" "}
                      –{" "}
                    </span>
                    <span className="social-proof__track">{item.track}</span>
                  </>
                ) : (
                  item.track
                )}
              </span>
              {showKeyMeta && (
                <span className="social-proof__row-meta">
                  {item.bpm} BPM • {item.camelot}
                </span>
              )}
            </div>
            <span className="social-proof__meta">{formatDownloads(item.downloads)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function titleWithTopCount(base: string, count: number): string {
  const n = Number(count);
  if (!Number.isFinite(n) || n <= 0) return base;
  if (n < 3) return `${base} · Top ${n}`;
  return base;
}

export default function SocialProof(props: {
  audio: SocialTopItem[];
  video: SocialTopItem[];
  karaoke: SocialTopItem[];
  onMoreClick: () => void;
}) {
  const { audio, video, karaoke, onMoreClick } = props;
  const [showMore, setShowMore] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [demoAlert, setDemoAlert] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; kind: DemoKind } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const onOpenDemo = useCallback(async (row: { key: string; path: string; label: string; kindHint: string }) => {
    setDemoAlert(null);
    setActiveKey(row.key);
    setLoadingKey(row.key);

    try {
      const result = (await trpc.downloadHistory.getPublicTopDemo.query({
        path: row.path,
      })) as { demo: string; kind: DemoKind; name?: string };
      const url = new URL(result.demo, apiBaseUrl).toString();
      const kind: DemoKind = result.kind === "video" ? "video" : "audio";

      trackGrowthMetric(GROWTH_METRICS.VIEW_DEMO_CLICK, {
        location: "top_downloads",
        kind,
        source: row.kindHint,
      });

      setShowMore(false);
      setPreviewFile({
        url,
        name: row.label || result.name || "Demo",
        kind,
      });
      setShowPreview(true);
    } catch {
      setDemoAlert("No pudimos cargar el demo en este momento. Intenta de nuevo más tarde.");
      setActiveKey(null);
      setPreviewFile(null);
      setShowPreview(false);
    } finally {
      setLoadingKey(null);
    }
  }, []);

  const hasAudio = (audio?.length ?? 0) > 0;
  const hasVideo = (video?.length ?? 0) > 0;
  const hasKaraoke = (karaoke?.length ?? 0) > 0;
  const hasAny = hasAudio || hasVideo || hasKaraoke;

  if (!hasAny) {
    return (
      <section className="social-proof" aria-label="Repertorio por categorías">
        <div className="ph__container">
          <div className="social-proof__neutral" role="note">
            <h3>Repertorio listo por categorías</h3>
            <p>
              Video remixes, audios y karaokes organizados por carpetas para que descargues solo lo que necesitas.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="social-proof" aria-label="Descargas destacadas">
      <div className="ph__container">
        <div className="social-proof__head">
          <div>
            <h2 className="home-h2">Lo que más se descarga</h2>
            <p className="home-sub">Top real por categoría. Toca play para abrir un demo (aprox. 60s).</p>
            {demoAlert && (
              <p className="social-proof__alert" role="alert">
                {demoAlert}
              </p>
            )}
          </div>
          <button
            type="button"
            className="home-cta home-cta--secondary social-proof__more"
            onClick={() => {
              onMoreClick();
              setShowMore(true);
            }}
          >
            Ver top por categoría →
          </button>
        </div>

        <div className="social-proof__grid" aria-label="Top descargas">
          {hasAudio && (
            <TopList
              title={titleWithTopCount("Audios", audio.length)}
              items={audio}
              maxRows={Math.min(5, audio.length)}
              activeKey={activeKey}
              loadingKey={loadingKey}
              onOpenDemo={onOpenDemo}
            />
          )}
          {hasVideo && (
            <TopList
              title={titleWithTopCount("Videos", video.length)}
              items={video}
              maxRows={Math.min(5, video.length)}
              activeKey={activeKey}
              loadingKey={loadingKey}
              onOpenDemo={onOpenDemo}
            />
          )}
          {hasKaraoke && (
            <TopList
              title={titleWithTopCount("Karaokes", karaoke.length)}
              items={karaoke}
              maxRows={Math.min(5, karaoke.length)}
              activeKey={activeKey}
              loadingKey={loadingKey}
              onOpenDemo={onOpenDemo}
            />
          )}
        </div>
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
            {hasAudio && (
              <TopList
                title={titleWithTopCount("Audios", audio.length)}
                items={audio}
                maxRows={Math.min(20, audio.length)}
                activeKey={activeKey}
                loadingKey={loadingKey}
                onOpenDemo={onOpenDemo}
              />
            )}
            {hasVideo && (
              <TopList
                title={titleWithTopCount("Videos", video.length)}
                items={video}
                maxRows={Math.min(20, video.length)}
                activeKey={activeKey}
                loadingKey={loadingKey}
                onOpenDemo={onOpenDemo}
              />
            )}
            {hasKaraoke && (
              <TopList
                title={titleWithTopCount("Karaokes", karaoke.length)}
                items={karaoke}
                maxRows={Math.min(20, karaoke.length)}
                activeKey={activeKey}
                loadingKey={loadingKey}
                onOpenDemo={onOpenDemo}
              />
            )}
          </div>
        </Modal.Body>
      </Modal>

      <PreviewModal
        show={showPreview}
        onHide={() => {
          setShowPreview(false);
          setPreviewFile(null);
        }}
        file={
          previewFile
            ? {
                url: previewFile.url,
                name: previewFile.name,
                kind: previewFile.kind,
              }
            : null
        }
      />
    </section>
  );
}
