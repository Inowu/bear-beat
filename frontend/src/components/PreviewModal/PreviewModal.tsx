import { Modal } from 'react-bootstrap';
import { Pause, Play } from "src/icons";
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { GROWTH_METRICS, trackGrowthMetric } from '../../utils/growthMetrics';
import './PreviewModal.scss';

interface PreviewModalPropsI {
  file: {
    url: string;
    name: string;
    kind: 'audio' | 'video';
  } | null;
  show: boolean;
  onHide: () => void;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return '00:00';
  }
  const fullSeconds = Math.floor(seconds);
  const minutes = Math.floor(fullSeconds / 60)
    .toString()
    .padStart(2, '0');
  const restSeconds = (fullSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${restSeconds}`;
};

const MAX_MEDIA_LOAD_RETRIES = 2;
const MEDIA_RETRY_BASE_DELAY_MS = 350;
const MEDIA_RETRY_JITTER_MS = 450;

const getMediaRetryDelayMs = (attempt: number): number => {
  const safeAttempt = Math.max(1, Math.floor(attempt));
  const backoffMs = MEDIA_RETRY_BASE_DELAY_MS * (2 ** (safeAttempt - 1));
  const jitterMs = Math.floor(Math.random() * (MEDIA_RETRY_JITTER_MS + 1));
  return backoffMs + jitterMs;
};

const withRetryCacheBust = (rawUrl: string, retryAttempt: number): string => {
  if (!rawUrl || retryAttempt <= 0) {
    return rawUrl;
  }

  try {
    const parsed = new URL(
      rawUrl,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
    );
    parsed.searchParams.set('__retry', String(retryAttempt));
    return parsed.toString();
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}__retry=${retryAttempt}`;
  }
};

const isPromiseLike = (value: unknown): value is Promise<unknown> =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { then?: unknown }).then === 'function';

const isExpectedPlayRestrictionError = (error: unknown): boolean => {
  const text =
    error instanceof Error
      ? `${error.name} ${error.message}`
      : `${error ?? ''}`;
  const normalized = text.toLowerCase();
  return (
    normalized.includes('notallowederror') ||
    normalized.includes('user gesture') ||
    normalized.includes('play() can only be initiated') ||
    normalized.includes('request is not allowed by the user agent')
  );
};

function PreviewModal(props: PreviewModalPropsI) {
  const { show, onHide, file } = props;
  const resolvedKind = file?.kind === 'video' ? 'video' : 'audio';
  const isAudio = resolvedKind === 'audio';
  const mediaName = file?.name ?? '';
  const audioUrl = file?.url ?? '';
  const [audioRetryAttempt, setAudioRetryAttempt] = useState(0);
  const [videoRetryAttempt, setVideoRetryAttempt] = useState(0);
  const audioPlaybackUrl = withRetryCacheBust(audioUrl, audioRetryAttempt);
  const videoPlaybackUrl = withRetryCacheBust(file?.url ?? '', videoRetryAttempt);
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const playStartTrackedForRef = useRef<string>('');
  const audioRetryTimerRef = useRef<number | null>(null);
  const videoRetryTimerRef = useRef<number | null>(null);
  const scheduledAudioRetryRef = useRef<number>(-1);
  const scheduledVideoRetryRef = useRef<number>(-1);
  const [isModalReady, setIsModalReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [waveDrawn, setWaveDrawn] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audioLoadError, setAudioLoadError] = useState<string>('');
  const [videoLoadError, setVideoLoadError] = useState<string>('');
  const placeholderBars = Array.from({ length: 18 }, (_, idx) => idx);

  const clearRetryTimer = (timerRef: { current: number | null }) => {
    if (timerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(
    () => () => {
      clearRetryTimer(audioRetryTimerRef);
      clearRetryTimer(videoRetryTimerRef);
    },
    [],
  );

  useEffect(() => {
    if (!show) {
      setIsModalReady(false);
      setAudioLoadError('');
      setVideoLoadError('');
      setAudioRetryAttempt(0);
      setVideoRetryAttempt(0);
      scheduledAudioRetryRef.current = -1;
      scheduledVideoRetryRef.current = -1;
      clearRetryTimer(audioRetryTimerRef);
      clearRetryTimer(videoRetryTimerRef);
    }
  }, [show]);

  useEffect(() => {
    playStartTrackedForRef.current = '';
  }, [show, file?.url, file?.kind]);

  const markDemoPlayStarted = () => {
    const currentUrl = file?.url?.trim();
    if (!show || !currentUrl) return;

    const dedupeKey = `${file?.kind ?? 'audio'}|${currentUrl}`;
    if (playStartTrackedForRef.current === dedupeKey) return;
    playStartTrackedForRef.current = dedupeKey;

    trackGrowthMetric(GROWTH_METRICS.DEMO_PLAY_STARTED, {
      fileType: file?.kind === 'video' ? 'video' : 'audio',
      fileName: mediaName || null,
      pagePath:
        typeof window !== 'undefined' && window.location
          ? `${window.location.pathname}${window.location.hash || ''}`
          : null,
    });
  };

  useEffect(() => {
    if (!show) return;
    // Reset errors when switching between files while modal is open.
    setAudioLoadError('');
    setVideoLoadError('');
    setAudioRetryAttempt(0);
    setVideoRetryAttempt(0);
    scheduledAudioRetryRef.current = -1;
    scheduledVideoRetryRef.current = -1;
    clearRetryTimer(audioRetryTimerRef);
    clearRetryTimer(videoRetryTimerRef);
    setWaveDrawn(false);
  }, [show, file?.url]);

  useEffect(() => {
    if (!show || !isModalReady || audioPlaybackUrl === '' || !isAudio || !waveformRef.current) {
      if (!show || audioPlaybackUrl === '' || !isAudio) {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setAudioLoadError('');
        setWaveDrawn(false);
      }
      return;
    }

    // Prevent duplicate instances when switching files quickly.
    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
      waveSurferRef.current = null;
    }

    const wave = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(8, 225, 247, 0.44)',
      progressColor: '#08E1F7',
      cursorColor: '#08E1F7',
      cursorWidth: 2,
      barWidth: 3,
      barGap: 2,
      barRadius: 3,
      height: 92,
      normalize: true,
      dragToSeek: true,
      hideScrollbar: true,
    });

    waveSurferRef.current = wave;
    setAudioLoadError('');
    setWaveDrawn(false);
    setCurrentTime(0);
    setDuration(0);

    const handleReady = () => {
      setDuration(wave.getDuration());
      // On some devices/browsers the redraw events can be delayed or missed.
      // "ready" is our reliable signal to swap the placeholder for the real waveform UI.
      setWaveDrawn(true);
      setAudioLoadError('');
      scheduledAudioRetryRef.current = -1;
      playAudioSafely(() => wave.play());
    };
    const handleRedraw = () => {
      setWaveDrawn(true);
    };
    const handleTimeUpdate = (time: number) => {
      setCurrentTime(time);
    };
    const handlePlay = () => {
      setIsPlaying(true);
      markDemoPlayStarted();
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    const handleFinish = () => {
      setIsPlaying(false);
    };
    const handleError = () => {
      if (audioRetryAttempt < MAX_MEDIA_LOAD_RETRIES) {
        const nextAttempt = audioRetryAttempt + 1;
        if (scheduledAudioRetryRef.current !== nextAttempt) {
          const delayMs = getMediaRetryDelayMs(nextAttempt);
          scheduledAudioRetryRef.current = nextAttempt;
          setAudioLoadError('La muestra tardó en cargar. Reintentando...');
          clearRetryTimer(audioRetryTimerRef);
          if (typeof window !== 'undefined') {
            audioRetryTimerRef.current = window.setTimeout(() => {
              setAudioRetryAttempt((currentAttempt) =>
                currentAttempt >= nextAttempt ? currentAttempt : nextAttempt,
              );
              audioRetryTimerRef.current = null;
            }, delayMs);
          }
        }
        return;
      }
      setAudioLoadError('No pudimos cargar esta muestra. Prueba con otro archivo.');
      setIsPlaying(false);
    };

    wave.on('ready', handleReady);
    wave.on('redraw', handleRedraw);
    wave.on('redrawcomplete', handleRedraw);
    wave.on('timeupdate', handleTimeUpdate);
    wave.on('play', handlePlay);
    wave.on('pause', handlePause);
    wave.on('finish', handleFinish);
    wave.on('error', handleError);

    wave.load(audioPlaybackUrl);

    return () => {
      wave.destroy();
      waveSurferRef.current = null;
      setIsPlaying(false);
      setWaveDrawn(false);
      setCurrentTime(0);
      setDuration(0);
    };
  }, [show, isModalReady, audioPlaybackUrl, isAudio, audioRetryAttempt]);

  const handleVideoError = () => {
    if (videoRetryAttempt < MAX_MEDIA_LOAD_RETRIES) {
      const nextAttempt = videoRetryAttempt + 1;
      if (scheduledVideoRetryRef.current !== nextAttempt) {
        const delayMs = getMediaRetryDelayMs(nextAttempt);
        scheduledVideoRetryRef.current = nextAttempt;
        setVideoLoadError('El demo tardó en cargar. Reintentando...');
        clearRetryTimer(videoRetryTimerRef);
        if (typeof window !== 'undefined') {
          videoRetryTimerRef.current = window.setTimeout(() => {
            setVideoRetryAttempt((currentAttempt) =>
              currentAttempt >= nextAttempt ? currentAttempt : nextAttempt,
            );
            videoRetryTimerRef.current = null;
          }, delayMs);
        }
      }
      return;
    }
    setVideoLoadError('No pudimos cargar este video. Prueba con otro archivo.');
  };

  const handleVideoPlaying = () => {
    scheduledVideoRetryRef.current = -1;
    setVideoLoadError('');
    markDemoPlayStarted();
  };

  const playAudioSafely = (playbackAction: () => void | Promise<unknown>) => {
    const onPlayError = (error: unknown) => {
      // Expected in Safari/in-app browsers when autoplay is blocked.
      if (isExpectedPlayRestrictionError(error)) {
        setIsPlaying(false);
        return;
      }
      setIsPlaying(false);
    };

    try {
      const result = playbackAction();
      if (isPromiseLike(result)) {
        void result.catch(onPlayError);
      }
    } catch (error) {
      onPlayError(error);
    }
  };

  const toggleAudio = () => {
    const player = waveSurferRef.current;
    if (!player) {
      return;
    }
    if (player.isPlaying()) {
      player.pause();
      return;
    }
    playAudioSafely(() => player.play());
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      centered
      className="preview-modal"
      onEntered={() => setIsModalReady(true)}
      onExited={() => setIsModalReady(false)}
    >
      <Modal.Header closeButton closeLabel="Cerrar modal">
        <Modal.Title id="contained-modal-title-vcenter">
          Escucha una muestra
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="preview-meta">
          <h4 title={mediaName}>{mediaName}</h4>
          <p>Muestra rápida para validar mezcla y energía antes de descargar.</p>
        </div>
        <div className={`preview-container ${isAudio ? 'is-audio' : 'is-video'}`}>
          {file && isAudio && (
            <div className="preview-audio-shell">
              <div className="preview-waveform-shell">
                <div
                  className="preview-waveform"
                  ref={waveformRef}
                  role="region"
                  aria-label="Forma de onda de audio"
                  onContextMenu={(e) => e.preventDefault()}
                />
                {!waveDrawn && (
                  <div
                    className={`preview-wave-placeholder ${isPlaying ? 'is-playing' : ''}`}
                    aria-hidden
                  >
                    {placeholderBars.map((idx) => (
                      <span key={idx} style={{ ['--i' as any]: idx } as any} />
                    ))}
                  </div>
                )}
              </div>
              <div className="preview-audio-controls">
                <button
                  type="button"
                  className="preview-audio-toggle"
                  onClick={toggleAudio}
                  disabled={audioLoadError !== ''}
                >
                  {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  <span>{isPlaying ? 'Pausar' : 'Escuchar'}</span>
                </button>
                <span className="preview-audio-time">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              <p className="preview-wave-help">Haz clic sobre la onda para adelantar o regresar.</p>
              {audioLoadError !== '' && <p className="preview-wave-error">{audioLoadError}</p>}
            </div>
          )}
          {file && !isAudio && (
            <>
              <video
                key={videoPlaybackUrl}
                src={videoPlaybackUrl}
                controls
                autoPlay
                preload="metadata"
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsInline
                onPlaying={handleVideoPlaying}
                onError={handleVideoError}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              />
              {videoLoadError !== '' && (
                <div className="preview-video-error">
                  <p className="preview-wave-error">{videoLoadError}</p>
                  <a className="preview-video-fallback" href={videoPlaybackUrl} target="_blank" rel="noreferrer">
                    Abrir demo en otra pestaña →
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <p>
          Esta muestra reproduce hasta 60 segundos en calidad reducida. Al descargar con tu plan recibes el
          archivo completo y en su calidad original.
        </p>
        <button className="btn primary-pill linear-bg" onClick={onHide}>
          Cerrar
        </button>
      </Modal.Footer>
    </Modal>
  );
}

export default PreviewModal;
