import { faMessage } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./ChatButton.scss";

const MESSENGER_LINK = "https://m.me/rn/104901938679498?topic=VIDEOS%20PARA%20DJ&cadence=daily";

export const ChatButton = () => {
  return (
    <a
      href={MESSENGER_LINK}
      target="_blank"
      rel="noopener noreferrer"
      className="chat-fab"
      aria-label="Chatear con Bear Beat - Soporte VIP"
    >
      <span className="chat-fab-badge">¿Ayuda DJ?</span>
      <span className="chat-fab-icon">
        <FontAwesomeIcon icon={faMessage} />
      </span>
    </a>
  );
};
