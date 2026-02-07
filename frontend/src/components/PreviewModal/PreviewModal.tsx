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
  const audioPattern = /\.(mp3|wav|aac|m4a|flac|ogg|aiff|alac)(\?|$)/i;
  const resolvedKind =
    file?.kind === 'audio' || audioPattern.test(`${file?.name ?? ''} ${file?.url ?? ''}`)
      ? 'audio'
      : 'video';
  const isAudio = resolvedKind === 'audio';
  const mediaName = file?.name ?? '';
  const audioUrl = file?.url ?? '';
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [audioLoadError, setAudioLoadError] = useState<string>('');

  useEffect(() => {
    if (!show || audioUrl === '' || !isAudio || !waveformRef.current) {
      if (!show || audioUrl === '' || !isAudio) {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        setAudioLoadError('');
      }
      return;
    }

    const wave = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(8, 225, 247, 0.28)',
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
    setCurrentTime(0);
    setDuration(0);

    const handleReady = () => {
      setDuration(wave.getDuration());
      wave.play();
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
      setCurrentTime(0);
      setDuration(0);
    };
  }, [show, audioUrl, isAudio]);

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
              <div
                className="preview-waveform"
                ref={waveformRef}
                role="region"
                aria-label="Forma de onda de audio"
                onContextMenu={(e) => e.preventDefault()}
              />
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
            <video
              controls
              autoPlay
              controlsList="nodownload noplaybackrate"
              disablePictureInPicture
              playsInline
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
            >
              <source src={file.url} />
            </video>
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
