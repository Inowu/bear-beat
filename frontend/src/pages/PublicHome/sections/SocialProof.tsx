import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Modal } from "src/components/ui";
import { Loader2, Play } from "src/icons";
import trpc from "../../../api";
import { apiBaseUrl } from "../../../utils/runtimeConfig";
import { GROWTH_METRICS, trackGrowthMetric } from "../../../utils/growthMetrics";
import { buildDemoPlaybackUrl } from "../../../utils/demoUrl";
import { inferTrackMetadata, prettyMediaName } from "../../../utils/fileMetadata";
import { isRetryableMediaError, retryWithJitter } from "../../../utils/retry";
import { formatDownloads, formatInt } from "../homeFormat";
import PreviewModal from "../../../components/PreviewModal/PreviewModal";
import { SkeletonTable, Button } from "../../../components/ui";

export type SocialTopItem = {
  path: string;
  name: string;
  downloads: number;
};

type WeeklyGenreUpload = {
  genre: string;
  files: number;
};

type WeeklyUploadsSnapshot = {
  generatedAt: string;
  sourceFolderPath: string | null;
  sourceFolderName: string | null;
  totalFiles: number;
  genres: WeeklyGenreUpload[];
  topGenres: WeeklyGenreUpload[];
  stale: boolean;
};

type DemoKind = "audio" | "video";
type SocialCategoryKey = "audio" | "video" | "karaoke";

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

function normalizeWeeklyGenreItems(value: unknown): WeeklyGenreUpload[] {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item: any) => ({
      genre: `${item?.genre ?? ""}`.trim().toLowerCase(),
      files: Number(item?.files ?? 0),
    }))
    .filter((item) => item.genre.length > 0 && Number.isFinite(item.files) && item.files > 0);
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
    <section id={sectionId} className="social-proof__col bb-market-surface" aria-labelledby={headingId}>
      <h3 id={headingId} className="social-proof__col-title">
        {title}
      </h3>
      <div role="list">
        {rows.map((item) => {
          const demoLabel = item.artist ? `${item.artist} – ${item.track}` : item.track;
          const isDisabled = !item.path || loadingKey === item.key;
          const rowButtonLabel =
            loadingKey === item.key ? `Reproduciendo demo: ${demoLabel}` : `Reproducir demo: ${demoLabel}`;

          return (
            <div key={item.key} className="social-proof__row" role="listitem">
              <Button unstyled
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
              </Button>
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
  const [activeCategory, setActiveCategory] = useState<SocialCategoryKey | null>(null);
  const [weeklyUploads, setWeeklyUploads] = useState<WeeklyUploadsSnapshot | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(true);

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

  useEffect(() => {
    let cancelled = false;

    const loadWeeklyUploads = async (initial = false) => {
      if (initial) setWeeklyLoading(true);

      try {
        const response = await trpc.downloadHistory.getPublicWeeklyGenreUploads.query({
          top: 5,
        });

        if (cancelled) return;

        const snapshot: WeeklyUploadsSnapshot = {
          generatedAt: `${response?.generatedAt ?? ""}`,
          sourceFolderPath:
            typeof response?.sourceFolderPath === "string" && response.sourceFolderPath.trim()
              ? response.sourceFolderPath.trim()
              : null,
          sourceFolderName:
            typeof response?.sourceFolderName === "string" && response.sourceFolderName.trim()
              ? response.sourceFolderName.trim()
              : null,
          totalFiles: Number(response?.totalFiles ?? 0),
          genres: normalizeWeeklyGenreItems(response?.genres),
          topGenres: normalizeWeeklyGenreItems(response?.topGenres),
          stale: Boolean(response?.stale),
        };

        setWeeklyUploads(snapshot);
      } catch {
        if (!cancelled) {
          setWeeklyUploads(null);
        }
      } finally {
        if (!cancelled && initial) {
          setWeeklyLoading(false);
        }
      }
    };

    void loadWeeklyUploads(true);

    const refreshInterval = window.setInterval(() => {
      void loadWeeklyUploads(false);
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, []);

  const onOpenDemo = useCallback(async (row: { key: string; path: string; label: string; kindHint: string }) => {
    setDemoAlert(null);
    setActiveKey(row.key);
    setLoadingKey(row.key);

    try {
      const result = (await retryWithJitter(
        async () =>
          await trpc.downloadHistory.getPublicTopDemo.query({
            path: row.path,
          }),
        {
          maxAttempts: 3,
          baseDelayMs: 250,
          maxDelayMs: 1800,
          jitterMs: 450,
          shouldRetry: isRetryableMediaError,
        },
      )) as { demo: string; kind: DemoKind; name?: string };
      const url = buildDemoPlaybackUrl(result.demo, apiBaseUrl);
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
  const availableCategories = useMemo(
    () =>
      [
        hasAudio
          ? {
              key: "audio" as SocialCategoryKey,
              label: "Audios",
              sectionId: "top-audios",
              title: titleWithTopCount("Audios", audio.length),
              items: audio,
            }
          : null,
        hasVideo
          ? {
              key: "video" as SocialCategoryKey,
              label: "Videos",
              sectionId: "top-videos",
              title: titleWithTopCount("Videos", video.length),
              items: video,
            }
          : null,
        hasKaraoke
          ? {
              key: "karaoke" as SocialCategoryKey,
              label: "Karaokes",
              sectionId: "top-karaokes",
              title: titleWithTopCount("Karaokes", karaoke.length),
              items: karaoke,
            }
          : null,
      ].filter(Boolean) as Array<{
        key: SocialCategoryKey;
        label: string;
        sectionId: string;
        title: string;
        items: SocialTopItem[];
      }>,
    [audio, hasAudio, hasKaraoke, hasVideo, karaoke, video],
  );

  useEffect(() => {
    if (availableCategories.length === 0) {
      if (activeCategory !== null) setActiveCategory(null);
      return;
    }
    const hasCurrent = availableCategories.some((category) => category.key === activeCategory);
    if (!hasCurrent) setActiveCategory(availableCategories[0].key);
  }, [activeCategory, availableCategories]);

  const modalAudio = modalTop?.audio ?? audio;
  const modalVideo = modalTop?.video ?? video;
  const modalKaraoke = modalTop?.karaoke ?? karaoke;
  const modalHasAudio = (modalAudio?.length ?? 0) > 0;
  const modalHasVideo = (modalVideo?.length ?? 0) > 0;
  const modalHasKaraoke = (modalKaraoke?.length ?? 0) > 0;
  const selectedCategory = availableCategories.find((category) => category.key === activeCategory) ?? null;
  const weeklyTopGenres = useMemo(
    () => (weeklyUploads?.topGenres ?? []).slice(0, 5),
    [weeklyUploads?.topGenres],
  );
  const weeklyTickerLine = useMemo(() => {
    const line = weeklyTopGenres
      .map((item) => `${formatInt(item.files)} ${item.genre} nuevos`)
      .join(" · ");
    return line ? `${line} · ` : "";
  }, [weeklyTopGenres]);

  if (!hasAny) {
    return (
      <section id="demo" className="social-proof" aria-label="Repertorio por categorías" data-testid="home-demo-section">
        <div className="ph__container">
          <div className="social-proof__neutral bb-market-card" role="note">
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
            <h2 className="home-h2">Escucha lo que otros DJs ya están tocando este mes</h2>
            <p className="home-sub">Top descargas en tiempo real — dale play a cualquier preview de 60 segundos.</p>
            <nav className="social-proof__jump" aria-label="Seleccionar categoría" role="tablist">
              {availableCategories.map((category) => {
                const isActive = selectedCategory?.key === category.key;
                return (
                  <Button unstyled
                    key={category.key}
                    id={`social-proof-tab-${category.key}`}
                    type="button"
                    role="tab"
                    className={[
                      "social-proof__jump-link",
                      isActive ? "is-active" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-selected={isActive}
                    aria-controls={category.sectionId}
                    onClick={() => setActiveCategory(category.key)}
                  >
                    {category.label}
                  </Button>
                );
              })}
            </nav>
            {demoAlert && (
              <p className="social-proof__alert" role="alert">
                {demoAlert}
              </p>
            )}
          </div>
          <Button unstyled
            type="button"
            className="home-cta home-cta--secondary social-proof__more"
            onClick={() => {
              onMoreClick();
              setShowMore(true);
            }}
          >
            Ver top 100 por categoría →
          </Button>
        </div>

        <div className="social-proof__grid" aria-label="Top descargas">
          {selectedCategory && (
            <TopList
              sectionId={selectedCategory.sectionId}
              title={selectedCategory.title}
              items={selectedCategory.items}
              maxRows={Math.min(5, selectedCategory.items.length)}
              activeKey={activeKey}
              loadingKey={loadingKey}
              onOpenDemo={onOpenDemo}
            />
          )}
        </div>

        {(weeklyLoading || weeklyTopGenres.length > 0) && (
          <section className="social-proof__weekly bb-market-surface" aria-label="Nuevos de esta semana" role="note">
            <p className="social-proof__weekly-title">📊 Esta semana subimos:</p>
            {weeklyTopGenres.length > 0 ? (
              <div className="social-proof__weekly-ticker" aria-live="polite">
                <span className="social-proof__weekly-track">{weeklyTickerLine.repeat(3)}</span>
              </div>
            ) : (
              <p className="social-proof__weekly-loading">Actualizando conteos semanales en tiempo real…</p>
            )}
            <p className="social-proof__weekly-question">¿Tu record pool actual te da esto CADA semana?</p>
          </section>
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
        <Modal.Header closeButton closeLabel="Cerrar modal">
          <Modal.Title id="social-proof-title">Lo que más se descarga</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="home-demo-modal__sub">Top 100 real por categoría (últimos meses).</p>
          {modalLoading && !modalTop && (
            <div className="social-proof__modal-loading bb-market-surface" role="status" aria-live="polite">
              <span className="sr-only">Actualizando top 100</span>
              <SkeletonTable className="social-proof__modal-skeleton" />
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
