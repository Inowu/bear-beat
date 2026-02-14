import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "src/icons";
import { HOME_FAQ_ITEMS } from "../homeCopy";

export default function HomeFaq(props: {
  onFaqExpand?: (id: string) => void;
}) {
  const { onFaqExpand } = props;
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
        if (HOME_FAQ_ITEMS.length === 0) return;
        const first = HOME_FAQ_ITEMS[0];
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
  }, []);

  const faqSchemaJson = useMemo(() => {
    const schema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: HOME_FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    };
    return JSON.stringify(schema);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-schema", "bb-faq");
    script.text = faqSchemaJson;
    document.head.appendChild(script);
    return () => script.remove();
  }, [faqSchemaJson]);

  return (
    <section id="faq" className="home-faq" aria-label="Preguntas frecuentes">
      <div className="ph__container">
        <h2 className="home-h2">FAQ</h2>
        <p className="home-sub">
          Resolvemos las dudas típicas antes de que pagues.
        </p>

        <div className="home-faq__list bb-accordion">
          {HOME_FAQ_ITEMS.map((item) => (
            <div
              key={item.id}
              id={`faq-${item.id}`}
              className={["home-faq__item", "bb-accordion__item", openIds[item.id] ? "is-open" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="home-faq__summary bb-accordion__trigger"
                aria-expanded={Boolean(openIds[item.id])}
                aria-controls={`faq-panel-${item.id}`}
                id={`faq-button-${item.id}`}
                onClick={() => handleToggle(item.id)}
              >
                <span>{item.question}</span>
                <ChevronDown size={18} aria-hidden />
              </button>
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
      </div>
    </section>
  );
}
