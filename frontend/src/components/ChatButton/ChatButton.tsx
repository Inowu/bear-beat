import { faMessage } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./ChatButton.scss";
import { useState } from "react";

export const ChatButton = () => {
    const [isOpen, setIsOpen] = useState(false);

    const handleClick = () => {
        if (isOpen) {
            handleClose();
        } else {
            handleOpen();
        }
    };

    const handleOpen = () => {
        const chatButton = document.getElementById("chat-button");
        const chatPopup = document.getElementById("chat-popup");

        if (chatButton && chatPopup) {
            chatPopup.style.display = "block";
            setIsOpen(true);
        }
    };

    const handleClose = () => {
        const chatButton = document.getElementById("chat-button");
        const chatPopup = document.getElementById("chat-popup");

        if (chatButton && chatPopup) {
            chatPopup.style.display = "none";
            setIsOpen(false);
        }
    };

    const handleStartChat = () => {
        window.open("https://m.me/rn/104901938679498?topic=VIDEOS%20PARA%20DJ&cadence=daily", "_blank");
        setIsOpen(false);
    };

    return (
        <div className="chat-container">
            <div className="chat-button" id="chat-button" onClick={handleClick}>
                <FontAwesomeIcon icon={faMessage} />
                CHAT
            </div>
            <div className="chat-popup" id="chat-popup">
                <div className="chat-header">
                    <span>Chatear con Bear Beat</span>
                    <button
                        className="close-button"
                        id="close-button"
                        onClick={(event) => {
                            event.preventDefault();
                            handleClose();
                        }}
                    >
                        ✕
                    </button>
                </div>
                <div className="chat-body">
                    <p>Hola DJ, ¿en qué podemos ayudarte?</p>
                    <button
                        className="start-chat"
                        onClick={(event) => {
                            event.preventDefault();
                            handleStartChat();
                        }}
                    >
                        INICIAR CHAT
                    </button>
                </div>
                <div className="chat-footer">
                    <small>Con la tecnología de Messenger</small>
                </div>
            </div>
        </div>
    );
};
