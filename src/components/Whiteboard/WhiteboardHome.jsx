import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getWhiteboards,
  createWhiteboard,
  deleteWhiteboard,
  updateWhiteboard,
} from "../../api/whiteboard";
import WhiteboardCard from "./WhiteBoardCard.jsx";
import "../css/whiteboardhome.css";
import { useLocation } from "react-router-dom";

export default function WhiteboardHome() {
  const [whiteboards, setWhiteboards] = useState([]);
  const [filteredBoards, setFilteredBoards] = useState([]);
  const [name, setName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const location = useLocation();

  useEffect(() => {
    getWhiteboards().then((data) => {
      setWhiteboards(data);
      setFilteredBoards(data);
    });
  }, []);

  // Debounced Search
  useEffect(() => {
    const delay = setTimeout(() => {
      const term = searchTerm.trim().toLowerCase();
      if (term === "") {
        setFilteredBoards(whiteboards);
      } else {
        setFilteredBoards(
          whiteboards.filter((wb) => wb.name.toLowerCase().includes(term))
        );
      }
    }, 400); // Delay in ms

    return () => clearTimeout(delay);
  }, [searchTerm, whiteboards]);

  useEffect(() => {
    if (location.state?.refresh) {
      getWhiteboards().then((data) => {
        setWhiteboards(data);
        setFilteredBoards(data);
      });
      // Remove the refresh flag so it doesn't refetch every render
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleDelete = (id) => {
    setWhiteboards((prev) => prev.filter((wb) => wb._id !== id));
    setFilteredBoards((prev) => prev.filter((wb) => wb._id !== id));
  };

  const handleRename = (id, newName, updatedAt) => {
    setWhiteboards((prev) =>
      [...prev]
        .map((wb) => (wb._id === id ? { ...wb, name: newName, updatedAt } : wb))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    );

    setFilteredBoards((prev) =>
      [...prev]
        .map((wb) => (wb._id === id ? { ...wb, name: newName, updatedAt } : wb))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    );
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await createWhiteboard(name);
    if (res._id) {
      const updated = [...whiteboards, res];
      setWhiteboards(updated);
      setFilteredBoards(updated);
      setName("");
    }
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <h2>Welcome to your Whitebored!</h2>
        <button
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem("token");
            navigate("/login");
          }}
        >
          Logout
        </button>
      </header>

      {showPopup && (
        <div className="create-popup">
          <div className="popup-content">
            <h3>Name your whiteboard</h3>
            <input
              className="popup-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
            />
            <div className="popup-actions">
              <button
                onClick={async () => {
                  const res = await createWhiteboard(name);
                  if (res._id) {
                    setWhiteboards((prev) => [res, ...prev]);
                    setName("");
                    setShowPopup(false);
                  }
                }}
              >
                Create
              </button>
              <button onClick={() => setShowPopup(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="search-bar-container">
        <input
          type="text"
          className="search-input"
          placeholder="Search whiteboards..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="whiteboard-grid">
        <div
          className="whiteboard-card create-card"
          onClick={() => setShowPopup(true)}
        >
          <div className="whiteboard-preview">
            <span className="preview-placeholder">➕</span>
          </div>
          <div className="whiteboard-name">Create New</div>
        </div>

        {filteredBoards.map((wb) => (
          <WhiteboardCard
            key={wb._id}
            whiteboard={wb}
            onDelete={handleDelete}
            onRename={handleRename}
          />
        ))}
      </div>
    </div>
  );
}
