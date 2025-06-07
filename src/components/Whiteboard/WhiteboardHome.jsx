import React, { useEffect, useState, useMemo } from "react";
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

const DISPLAY_LIMIT = 5;

export default function WhiteboardHome() {
  const [whiteboards, setWhiteboards] = useState([]);
  const [filteredBoards, setFilteredBoards] = useState([]);
  const [name, setName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);
  const location = useLocation();

  // Show more/less state
  const [showAllOwned, setShowAllOwned] = useState(false);
  const [showAllShared, setShowAllShared] = useState(false);

  const currentUserId = getUserIdFromToken();

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
    }, 400);

    return () => clearTimeout(delay);
  }, [searchTerm, whiteboards]);

  useEffect(() => {
    if (location.state?.refresh) {
      getWhiteboards().then((data) => {
        setWhiteboards(data);
        setFilteredBoards(data);
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Reset toggles only when search term changes
  useEffect(() => {
    setShowAllOwned(false);
    setShowAllShared(false);
  }, [searchTerm]);

  // Memoize ownedBoards and sharedBoards for stable references
  const ownedBoards = useMemo(
    () => filteredBoards.filter((wb) => wb.userId === currentUserId),
    [filteredBoards, currentUserId]
  );
  const sharedBoards = useMemo(
    () => filteredBoards.filter((wb) => wb.userId !== currentUserId),
    [filteredBoards, currentUserId]
  );

  // Sliced arrays for display
  const ownedToShow = showAllOwned ? ownedBoards : ownedBoards.slice(0, DISPLAY_LIMIT);
  const sharedToShow = showAllShared ? sharedBoards : sharedBoards.slice(0, DISPLAY_LIMIT);

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

      {/* Your Whiteboards Section */}
      <section style={{ width: "100%", maxWidth: 960, marginBottom: 32 }}>
        <h3 style={{ margin: "24px 0 12px 0", color: "#007bff" }}>Your Whiteboards</h3>
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
          {ownedBoards.length === 0 && (
            <div style={{ gridColumn: "1/-1", color: "#888", textAlign: "center", marginTop: 24 }}>
              No whiteboards yet. Create one!
            </div>
          )}
          {ownedToShow.map((wb) => (
            <WhiteboardCard
              key={wb._id}
              whiteboard={wb}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))}
        </div>
        {ownedBoards.length > DISPLAY_LIMIT && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              className="btn"
              style={{
                fontWeight: 600,
                fontSize: "1rem",
                position: "relative",
                zIndex: 10,
              }}
              onClick={() => setShowAllOwned((v) => !v)}
            >
              {showAllOwned
                ? "Show Less"
                : `Show More (${ownedBoards.length - DISPLAY_LIMIT} more)`}
            </button>
          </div>
        )}
      </section>

      {/* Shared With You Section */}
      <section style={{ width: "100%", maxWidth: 960 }}>
        <h3 style={{ margin: "24px 0 12px 0", color: "#ff6600" }}>Whiteboards Shared With You</h3>
        <div className="whiteboard-grid">
          {sharedBoards.length === 0 && (
            <div style={{ gridColumn: "1/-1", color: "#888", textAlign: "center", marginTop: 24 }}>
              No shared whiteboards yet.
            </div>
          )}
          {sharedToShow.map((wb) => (
            <WhiteboardCard
              key={wb._id}
              whiteboard={wb}
              onDelete={handleDelete}
              onRename={handleRename}
            />
          ))}
        </div>
        {sharedBoards.length > DISPLAY_LIMIT && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              className="btn"
              style={{
                fontWeight: 600,
                fontSize: "1rem",
                position: "relative",
                zIndex: 10,
              }}
              onClick={() => setShowAllShared((v) => !v)}
            >
              {showAllShared
                ? "Show Less"
                : `Show More (${sharedBoards.length - DISPLAY_LIMIT} more)`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}