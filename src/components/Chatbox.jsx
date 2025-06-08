import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import "./Chatbox.css";

export default function ChatBox({ socket, userId, whiteboardId, username, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: null, y: 200 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const messagesEndRef = useRef(null);
  const chatboxRef = useRef(null);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg) => {
      if (msg.whiteboardId === whiteboardId) {
        setMessages((prev) => [...prev, msg]);
      }
    };
    socket.on("chatMessage", handler);
    return () => socket.off("chatMessage", handler);
  }, [socket, whiteboardId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Drag handlers
  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e) => {
      setPosition({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      });
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, offset]);

  const startDrag = (e) => {
    if (chatboxRef.current) {
      const rect = chatboxRef.current.getBoundingClientRect();
      setOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setDragging(true);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !socket) return;
    const msg = {
      text: input,
      user: username || "Guest",
      userId: userId,
      whiteboardId,
      time: new Date().toISOString(),
    };
    socket.emit("chatMessage", msg);
    setInput("");
  };

  return (
    <div
      className="chatbox-container"
      ref={chatboxRef}
      style={{
        left: position.x !== null ? position.x : undefined,
        right: position.x === null ? 32 : undefined,
        top: position.y,
        position: "fixed",
        resize: "both",
        zIndex: 1000,
        minWidth: 240,
        minHeight: 320,
        maxWidth: "95vw",
        maxHeight: 520,
      }}
    >
      <div
        className="chatbox-header draggable"
        onMouseDown={startDrag}
        style={{ cursor: "move", userSelect: "none" }}
      >
        <span className="chatbox-title">Chat</span>
        <button className="chatbox-close" onClick={onClose} title="Close Chat">
          ×
        </button>
      </div>
      <div className="chatbox-messages">
        {messages.map((msg, i) => {
          const isMe = msg.userId === userId;
          return (
            <div
              key={i}
              className={`chatbox-message-row ${isMe ? "me" : "them"}`}
            >
              <div className="chatbox-message-bubble">
                <div className="chatbox-message-meta">
                  <span className="chatbox-message-user">{msg.user}</span>
                  <span className="chatbox-message-time-right">
                    {msg.time && new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <span className="chatbox-message-text">{msg.text}</span>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>
      <form className="chatbox-input-row" onSubmit={sendMessage}>
        <input
          className="chatbox-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          autoComplete="off"
        />
        <button className="chatbox-send" type="submit">
          Send
        </button>
      </form>
    </div>
  );
}