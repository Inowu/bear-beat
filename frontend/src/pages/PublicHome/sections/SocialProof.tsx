import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Modal } from "react-bootstrap";
import { Loader2, Play } from "lucide-react";
import trpc from "../../../api";
import { apiBaseUrl } from "../../../utils/runtimeConfig";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
import { inferTrackMetadata, prettyMediaName } from "../../../utils/fileMetadata";
import { formatDownloads } from "../homeFormat";
import PreviewModal from "../../../components/PreviewModal/PreviewModal";

export type SocialTopItem = {
  path: string;
  name: string;
  downloads: number;
};

type DemoKind = "audio" | "video";

function normalizeApiItems(value: unknown): SocialTopItem[] {
  const items = Array.isArray(value) ? value : [];
  return items
    .filter((item: any) => item && typeof item.path === "string" && typeof item.name === "string")
    .map((item: any) => ({
      path: item.path,
      name: prettyMediaName(item.name) || item.name,
      downloads: Number(item.downloads ?? 0),
    }));
}

function TopList(props: {
  sectionId?: string;
  title: string;
  items: SocialTopItem[];
  maxRows: number;
  activeKey: string | null;
  loadingKey: string | null;
  onOpenDemo: (row: { key: string; path: string; label: string; kindHint: string }) => void;
}) {
  const { sectionId, title, items, maxRows, activeKey, loadingKey, onOpenDemo } = props;
  const headingId = useId();

  const rows = useMemo(() => {
    return (items ?? []).slice(0, maxRows).map((item, idx) => {
      const raw = `${item.name ?? ""}`.trim();
      const parsed = inferTrackMetadata(raw);
      const normalized = parsed.displayName || raw;
      const rowKey = item.path ? item.path : `${raw}__${idx}`;
      return {
        key: rowKey,
        path: item.path,
        artist: parsed.artist ?? "",
        track: parsed.title || normalized || raw,
        downloads: item.downloads,
        bpm: parsed.bpm,
        camelot: parsed.camelot,
      };
    });
  }, [items, maxRows]);

  const showKeyMeta = rows.length > 0 && rows.every((row) => Boolean(row.bpm) && Boolean(row.camelot));

  return (
    <section id={sectionId} className="social-proof__col" aria-labelledby={headingId}>
      <h3 id={headingId} className="social-proof__col-title">
        {title}
      </h3>
      <div role="list">
        {rows.map((item) => {
          const demoLabel = item.artist ? `${item.artist} – ${item.track}` : item.track;
          const isDisabled = !item.path || loadingKey === item.key;
          const rowButtonLabel =
            loadingKey === item.key ? `Cargando demo: ${demoLabel}` : `Reproducir demo: ${demoLabel}`;

          return (
            <div key={item.key} className="social-proof__row" role="listitem">
              <button
                type="button"
                className="social-proof__row-btn"
                onClick={() => {
                  onOpenDemo({
                    key: item.key,
                    path: item.path,
                    label: demoLabel,
                    kindHint: title.toLowerCase(),
                  });
                }}
                disabled={isDisabled}
                aria-label={rowButtonLabel}
                data-testid="home-topdemo-play"
              >
                <span
                  className={[
                    "social-proof__play",
                    activeKey === item.key ? "social-proof__play--active" : "",
                    loadingKey === item.key ? "social-proof__play--loading" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-hidden
                >
                  {loadingKey === item.key ? (
                    <Loader2 size={18} className="social-proof__spinner" aria-hidden />
                  ) : (
                    <Play size={18} aria-hidden />
                  )}
                </span>
                <span className="social-proof__left">
                  <span
                    className="social-proof__name"
                    title={item.artist ? `${item.artist} – ${item.track}` : item.track}
                  >
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
                </span>
                <span className="social-proof__meta">{formatDownloads(item.downloads)}</span>
              </button>
          </div>
          );
        })}
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
  const [modalTop, setModalTop] = useState<{
    audio: SocialTopItem[];
    video: SocialTopItem[];
    karaoke: SocialTopItem[];
  } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [demoAlert, setDemoAlert] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; kind: DemoKind } | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!showMore) return;
    if (modalTop) return;
    let cancelled = false;

    (async () => {
      setModalError(null);
      setModalLoading(true);
      try {
        const result: any = await trpc.downloadHistory.getPublicTopDownloads.query({
          limit: 100,
          sinceDays: 120,
        });
        if (cancelled) return;
        setModalTop({
          audio: normalizeApiItems(result?.audio),
          video: normalizeApiItems(result?.video),
          karaoke: normalizeApiItems(result?.karaoke),
        });
      } catch {
        if (!cancelled) {
          setModalError("No pudimos cargar el top completo en este momento. Te mostramos una versión corta.");
        }
      } finally {
        if (!cancelled) setModalLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [modalTop, showMore]);

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

  const modalAudio = modalTop?.audio ?? audio;
  const modalVideo = modalTop?.video ?? video;
  const modalKaraoke = modalTop?.karaoke ?? karaoke;
  const modalHasAudio = (modalAudio?.length ?? 0) > 0;
  const modalHasVideo = (modalVideo?.length ?? 0) > 0;
  const modalHasKaraoke = (modalKaraoke?.length ?? 0) > 0;

  if (!hasAny) {
    return (
      <section id="demo" className="social-proof" aria-label="Repertorio por categorías" data-testid="home-demo-section">
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
    <section id="demo" className="social-proof" aria-label="Descargas destacadas" data-testid="home-demo-section">
      <span id="top100" className="social-proof__anchor" aria-hidden="true" />
      <div className="ph__container">
        <div className="social-proof__head">
          <div>
            <h2 className="home-h2">Lo que más se descarga</h2>
            <p className="home-sub">Top real por categoría. Toca play para abrir un demo (aprox. 60s).</p>
            <nav className="social-proof__jump" aria-label="Saltar a categoría">
              {hasAudio && (
                <a className="social-proof__jump-link" href="#top-audios">
                  Audios
                </a>
              )}
              {hasVideo && (
                <a className="social-proof__jump-link" href="#top-videos">
                  Videos
                </a>
              )}
              {hasKaraoke && (
                <a className="social-proof__jump-link" href="#top-karaokes">
                  Karaokes
                </a>
              )}
            </nav>
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
            Ver top 100 por categoría →
          </button>
        </div>

        <div className="social-proof__grid" aria-label="Top descargas">
          {hasAudio && (
            <TopList
              sectionId="top-audios"
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
              sectionId="top-videos"
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
              sectionId="top-karaokes"
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
          <p className="home-demo-modal__sub">Top 100 real por categoría (últimos meses).</p>
          {modalLoading && !modalTop && (
            <div className="social-proof__modal-loading" role="status" aria-live="polite">
              <Loader2 size={18} className="social-proof__spinner" aria-hidden />
              Cargando top 100…
            </div>
          )}
          {modalError && (
            <p className="social-proof__alert" role="alert">
              {modalError}
            </p>
          )}
          <div className="social-proof__grid" aria-label="Top descargas completo">
            {modalHasAudio && (
              <TopList
                title={titleWithTopCount("Audios", modalAudio.length)}
                items={modalAudio}
                maxRows={Math.min(100, modalAudio.length)}
                activeKey={activeKey}
                loadingKey={loadingKey}
                onOpenDemo={onOpenDemo}
              />
            )}
            {modalHasVideo && (
              <TopList
                title={titleWithTopCount("Videos", modalVideo.length)}
                items={modalVideo}
                maxRows={Math.min(100, modalVideo.length)}
                activeKey={activeKey}
                loadingKey={loadingKey}
                onOpenDemo={onOpenDemo}
              />
            )}
            {modalHasKaraoke && (
              <TopList
                title={titleWithTopCount("Karaokes", modalKaraoke.length)}
                items={modalKaraoke}
                maxRows={Math.min(100, modalKaraoke.length)}
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
