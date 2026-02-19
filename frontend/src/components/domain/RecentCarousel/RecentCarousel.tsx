import React from "react";
import { FolderCard, FolderCardProps } from "../FolderCard/FolderCard";
import styles from "./RecentCarousel.module.scss";

export interface RecentCarouselItem extends Omit<FolderCardProps, "className"> {
  id: string;
}

export interface RecentCarouselProps {
  items: RecentCarouselItem[];
  title?: string;
  className?: string;
  onOpenItem?: (item: RecentCarouselItem) => void;
}

export function RecentCarousel(props: RecentCarouselProps) {
  const { items, title = "Recientes", className, onOpenItem } = props;

  return (
    <section className={[styles.root, className ?? ""].filter(Boolean).join(" ")} aria-label={title}>
      <h3 className={styles.title}>{title}</h3>
      <div className={styles.track}>
        {items.map((item) => (
          <div key={item.id} className={styles.slide}>
            <FolderCard
              {...item}
              onOpen={() => {
                if (onOpenItem) {
                  onOpenItem(item);
                  return;
                }
                item.onOpen?.();
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
