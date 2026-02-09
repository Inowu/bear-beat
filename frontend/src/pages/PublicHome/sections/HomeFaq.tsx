import { useCallback } from "react";
import { ChevronDown } from "lucide-react";
import { HOME_FAQ_ITEMS } from "../homeCopy";

export default function HomeFaq(props: {
  onFaqExpand?: (id: string) => void;
}) {
  const { onFaqExpand } = props;

  const handleToggle = useCallback(
    (id: string, open: boolean) => {
      if (!open) return;
      onFaqExpand?.(id);
    },
    [onFaqExpand],
  );

  return (
    <section className="home-faq" aria-label="Preguntas frecuentes">
      <div className="ph__container">
        <h2 className="home-h2">FAQ</h2>
        <p className="home-sub">
          Resolvemos las dudas típicas antes de que pagues.
        </p>

        <div className="home-faq__list" role="list">
          {HOME_FAQ_ITEMS.map((item) => (
            <details
              key={item.id}
              className="home-faq__item"
              onToggle={(e) => {
                const el = e.currentTarget as HTMLDetailsElement;
                handleToggle(item.id, el.open);
              }}
            >
              <summary className="home-faq__summary">
                <span>{item.question}</span>
                <ChevronDown size={18} aria-hidden />
              </summary>
              <div className="home-faq__body" role="listitem">
                <p>{item.answer}</p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

