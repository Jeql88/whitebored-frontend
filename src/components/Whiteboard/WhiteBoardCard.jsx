import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteWhiteboard, updateWhiteboard } from "../../api/whiteboard";
import "../css/whiteboardcard.css";
import { formatDistanceToNow } from "date-fns";

// Helper to get userId from JWT in localStorage
function getUserIdFromToken() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split(".")[1])).userId;
  } catch {
    return null;
  }
}

export default function WhiteboardCard({ whiteboard, onDelete, onRename }) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [newName, setNewName] = useState(whiteboard.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const currentUserId = getUserIdFromToken();

  const handleDelete = async () => {
    await deleteWhiteboard(whiteboard._id);
    onDelete(whiteboard._id);
    setShowDeleteConfirm(false);
  };

  const handleRename = async () => {
    if (newName.trim() && newName !== whiteboard.name) {
      await updateWhiteboard(whiteboard._id, newName);
      onRename(whiteboard._id, newName, new Date().toISOString());
    }
    setEditing(false);
  };

  return (
    <>
      <div
        className="whiteboard1-card"
        onClick={() => {
          if (!editing && !showDeleteConfirm) {
            navigate(`/whiteboard/${whiteboard._id}`);
          }
        }}
      >
        <div className="whiteboard1-preview">📝</div>

        <div className="whiteboard1-name">
          {whiteboard.name}
          {whiteboard.userId !== currentUserId && (
            <span
              style={{
                color: "#007bff",
                fontSize: "0.85rem",
                marginLeft: 8,
                fontWeight: 600,
                background: "#e6f0ff",
                borderRadius: 6,
                padding: "2px 8px",
              }}
            >
              Shared with you
            </span>
          )}
          <p style={{ fontSize: "0.8rem", color: "#888", marginTop: "4px" }}>
            Last edited:{" "}
            {whiteboard.updatedAt && !isNaN(new Date(whiteboard.updatedAt))
              ? formatDistanceToNow(new Date(whiteboard.updatedAt)) + " ago"
              : "unknown"}
          </p>
        </div>

        <div
          className="whiteboard1-actions"
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src="/edit.png"
            alt="Edit"
            title="Edit"
            className="action-icon"
            onClick={() => setEditing(true)}
          />
          <img
            src="/delete.png"
            alt="Delete"
            title="Delete"
            className="action-icon"
            onClick={() => setShowDeleteConfirm(true)}
          />
        </div>
      </div>

      {/* Rename Modal */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(false)}>
          <div className="modal-popup" onClick={(e) => e.stopPropagation()}>
            <h3>Rename Whiteboard</h3>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className="modal-buttons">
              <button className="btn primary" onClick={handleRename}>
                Save
              </button>
              <button className="btn" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="modal-overlay"
          onClick={() => setShowDeleteConfirm(false)}
        >
          <div className="modal-popup" onClick={(e) => e.stopPropagation()}>
            <h3>Delete Whiteboard</h3>
            <p>
              Are you sure you want to delete <strong>{whiteboard.name}</strong>
              ?
            </p>
            <div className="modal-buttons">
              <button className="btn danger" onClick={handleDelete}>
                Delete
              </button>
              <button
                className="btn"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}