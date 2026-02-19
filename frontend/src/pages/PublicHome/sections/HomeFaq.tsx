import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "src/icons";
import type { HomeFaqItem } from "../homeCopy";
import { Button } from "src/components/ui";
export default function HomeFaq(props: {
  items: HomeFaqItem[];
  onFaqExpand?: (id: string) => void;
  postCta?: {
    label: string;
    href?: string | null;
  };
  onPostCtaClick?: () => void;
}) {
  const { items, onFaqExpand, postCta, onPostCtaClick } = props;
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  const handleToggle = useCallback(
    (id: string) => {
      setOpenIds((prev) => {
        const next = { ...prev, [id]: !prev[id] };
        if (next[id]) onFaqExpand?.(id);
        return next;
      });
    },
    [onFaqExpand],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const openFromHash = () => {
      const hash = window.location.hash;
      if (hash === "#faq") {
        if (items.length === 0) return;
        const first = items[0];
        if (!first) return;
        setOpenIds((prev) => ({ ...prev, [first.id]: true }));
        const section = document.getElementById("faq");
        section?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      if (!hash || !hash.startsWith("#faq-")) return;
      const el = document.querySelector(hash);
      if (!(el instanceof HTMLElement)) return;
      const id = hash.replace("#faq-", "");
      setOpenIds((prev) => ({ ...prev, [id]: true }));
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    return () => window.removeEventListener("hashchange", openFromHash);
  }, [items]);

  const faqSchemaJson = useMemo(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: items.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };
    return JSON.stringify(schema);
  }, [items]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "bb-faq");
    script.text = faqSchemaJson;
    document.head.appendChild(script);
    return () => script.remove();
  }, [faqSchemaJson]);

  const postCtaHref = `${postCta?.href ?? ""}`.trim();
  const isPostCtaExternal = /^https?:\/\//i.test(postCtaHref);

  return (
    <section id="faq" className="home-faq" aria-label="Preguntas frecuentes">
      <div className="ph__container">
        <h2 className="home-h2">FAQ</h2>
        <p className="home-sub">
          Resolvemos las dudas típicas antes de que pagues.
        </p>

        <div className="home-faq__list bb-accordion">
          {items.map((item) => (
            <div
              key={item.id}
              id={`faq-${item.id}`}
              className={["home-faq__item", "bb-market-surface", "bb-accordion__item", openIds[item.id] ? "is-open" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <Button unstyled
                type="button"
                className="home-faq__summary bb-accordion__trigger"
                aria-expanded={Boolean(openIds[item.id])}
                aria-controls={`faq-panel-${item.id}`}
                id={`faq-button-${item.id}`}
                aria-label={item.question}
                onClick={() => handleToggle(item.id)}
              >
                <span>{item.question}</span>
                <ChevronDown size={18} aria-hidden />
              </Button>
              <div
                className="home-faq__body bb-accordion__panel"
                id={`faq-panel-${item.id}`}
                role="region"
                aria-labelledby={`faq-button-${item.id}`}
                hidden={!openIds[item.id]}
              >
                <p>{item.answer}</p>
              </div>
            </div>
          ))}
        </div>

        {postCta?.label ? (
          <div className="home-faq__post-cta">
            {postCtaHref ? (
              <a
                className="home-faq__post-link"
                href={postCtaHref}
                onClick={onPostCtaClick}
                target={isPostCtaExternal ? "_blank" : undefined}
                rel={isPostCtaExternal ? "noopener noreferrer" : undefined}
              >
                {postCta.label}
              </a>
            ) : (
              <Button
                unstyled
                type="button"
                className="home-faq__post-link"
                onClick={onPostCtaClick}
              >
                {postCta.label}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
