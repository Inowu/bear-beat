import React from "react";
import { Badge, Button, Card } from "src/components/ui";
import styles from "./PackCard.module.scss";

export interface PackCardProps {
  title: string;
  description?: string;
  tracks?: number;
  sizeLabel?: string;
  onDownload?: () => void;
  downloadLabel?: string;
  downloading?: boolean;
  className?: string;
}

export function PackCard(props: PackCardProps) {
  const {
    title,
    description,
    tracks,
    sizeLabel,
    onDownload,
    downloadLabel = "Descargar",
    downloading = false,
    className,
  } = props;

  return (
    <Card hover className={[styles.root, className ?? ""].filter(Boolean).join(" ")}>
      <div className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.badges}>
          {typeof tracks === "number" ? (
            <Badge variant="outline" size="sm">
              {tracks} tracks
            </Badge>
          ) : null}
          {sizeLabel ? (
            <Badge variant="outline" size="sm">
              {sizeLabel}
            </Badge>
          ) : null}
        </div>
      </div>

      {description ? <p className={styles.description}>{description}</p> : null}

      <Button size="sm" onClick={onDownload} loading={downloading}>
        {downloadLabel}
      </Button>
    </Card>
  );
}
