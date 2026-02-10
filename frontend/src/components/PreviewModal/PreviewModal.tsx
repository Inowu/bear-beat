import { Modal } from 'react-bootstrap';
import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
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

function PreviewModal(props: PreviewModalPropsI) {
  const { show, onHide, file } = props;
  const resolvedKind = file?.kind === 'video' ? 'video' : 'audio';
  const isAudio = resolvedKind === 'audio';
  const mediaName = file?.name ?? '';
  const audioUrl = file?.url ?? '';
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isModalReady, setIsModalReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [waveDrawn, setWaveDrawn] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audioLoadError, setAudioLoadError] = useState<string>('');
  const [videoLoadError, setVideoLoadError] = useState<string>('');
  const placeholderBars = Array.from({ length: 18 }, (_, idx) => idx);

  useEffect(() => {
    if (!show) {
      setIsModalReady(false);
      setVideoLoadError('');
    }
  }, [show]);

  useEffect(() => {
    if (!show) return;
    // Reset errors when switching between files while modal is open.
    setAudioLoadError('');
    setVideoLoadError('');
    setWaveDrawn(false);
  }, [show, file?.url]);

  useEffect(() => {
    if (!show || !isModalReady || audioUrl === '' || !isAudio || !waveformRef.current) {
      if (!show || audioUrl === '' || !isAudio) {
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
      wave.play();
    };
    const handleRedraw = () => {
      setWaveDrawn(true);
    };
    const handleTimeUpdate = (time: number) => {
      setCurrentTime(time);
    };
    const handlePlay = () => {
      setIsPlaying(true);
    };
    const handlePause = () => {
      setIsPlaying(false);
    };
    const handleFinish = () => {
      setIsPlaying(false);
    };
    const handleError = () => {
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

    wave.load(audioUrl);

    return () => {
      wave.destroy();
      waveSurferRef.current = null;
      setIsPlaying(false);
      setWaveDrawn(false);
      setCurrentTime(0);
      setDuration(0);
    };
  }, [show, isModalReady, audioUrl, isAudio]);

  const toggleAudio = () => {
    const player = waveSurferRef.current;
    if (!player) {
      return;
    }
    if (player.isPlaying()) {
      player.pause();
      return;
    }
    player.play();
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
      <Modal.Header closeButton>
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
                key={file.url}
                src={file.url}
                controls
                autoPlay
                preload="metadata"
                controlsList="nodownload noplaybackrate"
                disablePictureInPicture
                playsInline
                onError={() => setVideoLoadError('No pudimos cargar este video. Prueba con otro archivo.')}
                onContextMenu={(e) => e.preventDefault()}
                onDragStart={(e) => e.preventDefault()}
              />
              {videoLoadError !== '' && (
                <div className="preview-video-error">
                  <p className="preview-wave-error">{videoLoadError}</p>
                  <a className="preview-video-fallback" href={file.url} target="_blank" rel="noreferrer">
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
