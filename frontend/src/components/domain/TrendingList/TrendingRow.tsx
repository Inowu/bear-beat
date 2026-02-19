import React from "react";
import { FileRow, FileRowProps } from "../FileRow/FileRow";
import styles from "./TrendingRow.module.scss";

export interface TrendingRowProps extends Omit<FileRowProps, "compact" | "className"> {
  position: number;
  className?: string;
}

export function TrendingRow(props: TrendingRowProps) {
  const { position, className, ...fileRowProps } = props;

  return (
    <div className={[styles.root, className ?? ""].filter(Boolean).join(" ")}>
      <span className={styles.position} aria-label={`Posición ${position}`}>
        {position}
      </span>
      <FileRow {...fileRowProps} compact className={styles.fileRow} />
    </div>
  );
}
