import React from "react";
import { Pause, Play } from "src/icons";
import { Badge, Card, IconButton } from "src/components/ui";
import styles from "./FileRow.module.scss";

export interface FileRowProps {
  title: string;
  subtitle?: string;
  format?: string;
  bpm?: number | string;
  musicalKey?: string;
  downloaded?: boolean;
  isPlaying?: boolean;
  onTogglePlay?: () => void;
  playDisabled?: boolean;
  className?: string;
  compact?: boolean;
}

function hasContent(value: string | number | undefined): value is string | number {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  return false;
}

export function FileRow(props: FileRowProps) {
  const {
    title,
    subtitle,
    format,
    bpm,
    musicalKey,
    downloaded = false,
    isPlaying = false,
    onTogglePlay,
    playDisabled = false,
    className,
    compact = false,
  } = props;

  const rootClass = [styles.root, compact ? styles.compact : "", className ?? ""]
    .filter(Boolean)
    .join(" ");

  const playLabel = isPlaying ? "Pausar preview" : "Reproducir preview";

  return (
    <Card hover padding="sm" className={rootClass}>
      <div className={styles.meta}>
        <p className={styles.title}>{title}</p>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>

      <div className={styles.badges}>
        {hasContent(format) ? (
          <Badge variant="outline" size="sm">
            {String(format).toUpperCase()}
          </Badge>
        ) : null}

        {hasContent(bpm) ? (
          <Badge variant="outline" size="sm">
            BPM {bpm}
          </Badge>
        ) : null}

        {hasContent(musicalKey) ? (
          <Badge variant="outline" size="sm">
            Key {musicalKey}
          </Badge>
        ) : null}
      </div>

      <div className={styles.actions}>
        <IconButton
          label={playLabel}
          icon={isPlaying ? <Pause size={16} /> : <Play size={16} />}
          variant="secondary"
          onClick={onTogglePlay}
          disabled={playDisabled}
        />
        <Badge variant={downloaded ? "success" : "info"} size="sm">
          {downloaded ? "Descargado" : "Nuevo"}
        </Badge>
      </div>
    </Card>
  );
}
