import { faMessage } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import "./ChatButton.scss";

const MESSENGER_LINK = "https://m.me/rn/104901938679498?topic=VIDEOS%20PARA%20DJ&cadence=daily";

type ChatButtonVariant = "floating" | "inline";

interface ChatButtonProps {
  variant?: ChatButtonVariant;
}

export const ChatButton = ({ variant = "floating" }: ChatButtonProps) => {
  const chatFabClass = variant === "inline" ? "chat-fab chat-fab--inline" : "chat-fab";

  return (
    <a
      href={MESSENGER_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className={chatFabClass}
      aria-label="Chatear con Bear Beat - Soporte VIP"
      onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_CHAT)}
    >
      <span className="chat-fab-badge">¿Ayuda DJ?</span>
      <span className="chat-fab-icon">
        <FontAwesomeIcon icon={faMessage} />
      </span>
    </a>
  );
};
