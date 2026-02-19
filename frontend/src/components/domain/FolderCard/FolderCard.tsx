import React from "react";
import { Button, Card, Badge } from "src/components/ui";
import styles from "./FolderCard.module.scss";

export interface FolderCardProps {
  title: string;
  description?: string;
  newItems?: number;
  onOpen?: () => void;
  openLabel?: string;
  disabled?: boolean;
  className?: string;
}

export function FolderCard(props: FolderCardProps) {
  const {
    title,
    description,
    newItems,
    onOpen,
    openLabel = "Abrir",
    disabled = false,
    className,
  } = props;

  const hasNewItems = typeof newItems === "number";

  return (
    <Card hover className={[styles.root, className ?? ""].filter(Boolean).join(" ")}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        {hasNewItems ? (
          <Badge size="sm" variant={newItems > 0 ? "default" : "success"}>
            {newItems > 0 ? `${newItems} nuevos` : "Al día"}
          </Badge>
        ) : null}
      </div>

      {description ? <p className={styles.description}>{description}</p> : null}

      <Button variant="secondary" size="sm" onClick={onOpen} disabled={disabled}>
        {openLabel}
      </Button>
    </Card>
  );
}
