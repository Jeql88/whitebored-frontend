import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function WhiteboardCard({ whiteboard }) {
  const navigate = useNavigate();

  return (
    <div
      className="whiteboard-card"
      onClick={() => navigate(`/whiteboard/${whiteboard._id}`)}
    >
      <div className="whiteboard-preview">
        <span className="preview-placeholder">📝</span>
      </div>
      <div className="whiteboard-name">{whiteboard.name}</div>
    </div>
  );
}
