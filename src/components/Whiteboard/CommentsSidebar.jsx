import React, { useEffect, useState, useRef } from "react";
import { getComments, addComment, deleteComment } from "../../api/whiteboard";
import "../css/commentssidebar.css";

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
      className={`comments-sidebar${open ? "" : " closed"}`}
    >
      <div className="comments-header">
        <span className="comments-title">Comments</span>
        <button className="comments-close-btn" onClick={onClose} title="Close">×</button>
      </div>
      <div className="comments-list">
        {comments.length === 0 && <div className="comments-empty">No comments yet.</div>}
        {comments.map((c) => (
          <div key={c._id} className="comment-item">
            <div className="comment-author">{c.userName || "Anonymous"}</div>
            <div className="comment-text">{c.text}</div>
            <div className="comment-meta">{new Date(c.createdAt).toLocaleString()}</div>
            {c.userId === currentUserId && (
              <button
                className="comment-delete-btn"
                onClick={() => handleDelete(c._id)}
                title="Delete"
              >
                Delete
              </button>
            )}
          </div>
        ))}
      </div>
      <form className="comments-form" onSubmit={handleAdd}>
        <input
          className="comments-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Add a comment..."
        />
        <button className="comments-add-btn" type="submit">
          Add
        </button>
      </form>
    </div>
  );
}