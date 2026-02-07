import { MessageCircle } from "lucide-react";
import { trackManyChatConversion, MC_EVENTS } from "../../utils/manychatPixel";
import { SUPPORT_CHAT_URL } from "../../utils/supportChat";
import "./ChatButton.scss";

type ChatButtonVariant = "floating" | "inline";

interface ChatButtonProps {
  variant?: ChatButtonVariant;
}

export const ChatButton = ({ variant = "floating" }: ChatButtonProps) => {
  const chatFabClass = variant === "inline" ? "chat-fab chat-fab--inline" : "chat-fab";

  return (
    <a
      href={SUPPORT_CHAT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={chatFabClass}
      aria-label="Chatear con Bear Beat - Soporte VIP"
      onClick={() => trackManyChatConversion(MC_EVENTS.CLICK_CHAT)}
    >
      <span className="chat-fab-badge">¿Ayuda DJ?</span>
      <span className="chat-fab-icon">
        <MessageCircle aria-hidden />
      </span>
    </a>
  );
};
