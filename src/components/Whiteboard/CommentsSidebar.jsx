import React, { useEffect, useState, useRef } from "react";
import { getComments, addComment, deleteComment } from "../../api/whiteboard";

export default function CommentsSidebar({ whiteboardId, socket, open, onClose, currentUserId }) {
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState("");
  const sidebarRef = useRef();

  useEffect(() => {
    if (open) {
      getComments(whiteboardId).then(setComments);
    }
  }, [open, whiteboardId]);

  useEffect(() => {
    if (!socket) return;
    const handleNew = (comment) => setComments((prev) => [...prev, comment]);
    const handleDelete = ({ _id }) =>
      setComments((prev) => prev.filter((c) => String(c._id) !== String(_id)));
    socket.on("newComment", handleNew);
    socket.on("deleteComment", handleDelete);
    return () => {
      socket.off("newComment", handleNew);
      socket.off("deleteComment", handleDelete);
    };
  }, [socket]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    await addComment(whiteboardId, input);
    setInput("");
  };

  const handleDelete = async (id) => {
    await deleteComment(whiteboardId, id);
  };

  return (
    <div
      ref={sidebarRef}
      className="comments-sidebar"
      style={{
        position: "fixed",
        top: 0,
        right: open ? 0 : -350,
        width: 350,
        height: "100vh",
        background: "#fff",
        boxShadow: "-2px 0 8px rgba(0,0,0,0.08)",
        zIndex: 100,
        transition: "right 0.3s",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ padding: 16, borderBottom: "1px solid #eee", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <b>Comments</b>
        <button onClick={onClose} style={{ fontSize: 20, background: "none", border: "none", cursor: "pointer" }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        {comments.length === 0 && <div style={{ color: "#888" }}>No comments yet.</div>}
        {comments.map((c) => (
          <div key={c._id} style={{ marginBottom: 18, borderBottom: "1px solid #f0f0f0", paddingBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{c.userName || "Anonymous"}</div>
            <div style={{ fontSize: 15, margin: "4px 0" }}>{c.text}</div>
            <div style={{ fontSize: 12, color: "#aaa" }}>{new Date(c.createdAt).toLocaleString()}</div>
            {c.userId === currentUserId && (
              <button
                onClick={() => handleDelete(c._id)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#e74c3c",
                  cursor: "pointer",
                  fontSize: 13,
                  marginTop: 2,
                  padding: 0,
                }}
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
      <form onSubmit={handleAdd} style={{ padding: 16, borderTop: "1px solid #eee", display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a comment..."
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ccc" }}
        />
        <button type="submit" style={{ padding: "8px 16px", borderRadius: 6, background: "#007aff", color: "#fff", border: "none", fontWeight: 600 }}>
          Add
        </button>
      </form>
    </div>
  );
}