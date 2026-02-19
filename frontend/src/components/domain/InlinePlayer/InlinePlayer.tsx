import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "src/icons";
import { IconButton } from "src/components/ui";
import styles from "./InlinePlayer.module.scss";

export interface InlinePlayerProps {
  src?: string | null;
  label?: string;
  className?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

function formatSeconds(rawSeconds: number): string {
  const total = Number.isFinite(rawSeconds) ? Math.max(0, Math.floor(rawSeconds)) : 0;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function InlinePlayer(props: InlinePlayerProps) {
  const {
    src,
    label = "Preview",
    className,
    disabled = false,
    size = "md",
  } = props;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onLoaded = () => setDuration(audio.duration || 0);

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);

    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
  }, [src]);

  const isDisabled = disabled || !src;

  const currentLabel = useMemo(() => {
    if (isPlaying) return `Pausar ${label}`;
    return `Reproducir ${label}`;
  }, [isPlaying, label]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || isDisabled) return;
    if (isPlaying) {
      audio.pause();
      return;
    }
    try {
      await audio.play();
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <div
      className={[
        styles.root,
        size === "sm" ? styles.small : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <IconButton
        label={currentLabel}
        icon={isPlaying ? <Pause size={16} /> : <Play size={16} />}
        variant="secondary"
        onClick={toggle}
        disabled={isDisabled}
      />
      <span className={styles.meta}>
        {label} · {formatSeconds(currentTime)} / {formatSeconds(duration)}
      </span>
      <audio ref={audioRef} src={src ?? undefined} preload="none" />
    </div>
  );
}
