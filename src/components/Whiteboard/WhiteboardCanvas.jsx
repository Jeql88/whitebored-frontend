import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Toolbar from "./ToolBar.jsx";
import "../css/whiteboardcanvas.css";

function getUserIdFromToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1])).userId;
  } catch {
    return null;
  }
}

export default function WhiteboardCanvas() {
  const { id: whiteboardId } = useParams();
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [strokes, setStrokes] = useState([]);
  const [textBoxes, setTextBoxes] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const navigate = useNavigate();
  const strokePoints = useRef([]);
  const drawing = useRef(false);
  const userId = useRef(null);

  // Tool states
  const [isPen, setIsPen] = useState(true);
  const [penColor, setPenColor] = useState("black");
  const [penWidth, setPenWidth] = useState(2);
  const [isEraser, setIsEraser] = useState(false);
  const [eraserWidth, setEraserWidth] = useState(20);
  const [isTextTool, setIsTextTool] = useState(false);

  // Text box states
  const [creatingTextBox, setCreatingTextBox] = useState(false);
  const [textBoxStart, setTextBoxStart] = useState(null);
  const [currentTextBox, setCurrentTextBox] = useState(null); // For creating or editing
  const [textInput, setTextInput] = useState("");
  const [selectedTextBoxId, setSelectedTextBoxId] = useState(null);
  const [editingTextBoxId, setEditingTextBoxId] = useState(null);
  const [draggingBoxId, setDraggingBoxId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isPen) {
      setIsEraser(false);
      setIsTextTool(false);
    }
  }, [isPen]);
  useEffect(() => {
    if (isEraser) {
      setIsPen(false);
      setIsTextTool(false);
    }
  }, [isEraser]);
  useEffect(() => {
    if (isTextTool) {
      setIsPen(false);
      setIsEraser(false);
    }
  }, [isTextTool]);

  // Helper to redraw all events
  const redraw = (allStrokes, allTextBoxes) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of allStrokes) {
      if (!stroke.points || stroke.points.length < 2) continue;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        context.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      context.strokeStyle = stroke.color || "black";
      context.lineWidth = stroke.width || 2;
      context.stroke();
    }
    for (const box of allTextBoxes) {
      context.save();
      context.font = `${box.fontSize || 20}px Arial`;
      context.fillStyle = box.color || "#222";
      context.fillText(box.text, box.x, box.y + (box.fontSize || 20));
      context.restore();
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    let guest = false;
    if (!token) {
      guest = true;
      // Optionally, set a guest userId (e.g., random or "guest")
      userId.current = "guest-" + Math.random().toString(36).slice(2, 10);
    } else {
      userId.current = getUserIdFromToken(token);
    }

    // Connect with or without auth
    const newSocket = guest
      ? io("http://localhost:4000")
      : io("http://localhost:4000", { auth: { token } });
    setSocket(newSocket);

    newSocket.emit("joinWhiteboard", whiteboardId);

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    // Draw a single stroke
    const drawStroke = (stroke) => {
      if (!stroke.points || stroke.points.length < 2) return;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        context.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      context.strokeStyle = stroke.color || "black";
      context.lineWidth = stroke.width || 2;
      context.stroke();
    };

    // Draw a single text box
    const drawTextBox = (box) => {
      context.save();
      context.font = `${box.fontSize || 20}px Arial`;
      context.fillStyle = box.color || "#222";
      context.fillText(box.text, box.x, box.y + (box.fontSize || 20));
      context.restore();
    };

    // On initial load, backend will replay all events
    newSocket.on("drawStroke", (stroke) => {
      setStrokes((prev) => [...prev, stroke]);
      drawStroke(stroke);
    });

    newSocket.on("addTextBox", (box) => {
      setTextBoxes((prev) => [...prev, box]);
      drawTextBox(box);
    });

    newSocket.on("updateTextBox", (box) => {
      setTextBoxes((prev) =>
        prev.map((b) => (String(b._id) === String(box._id) ? { ...b, ...box } : b))
      );
    });

    newSocket.on("removeTextBox", ({ _id }) => {
      setTextBoxes((prev) => prev.filter((b) => String(b._id) !== String(_id)));
      setSelectedTextBoxId((id) => (id === _id ? null : id));
      setEditingTextBoxId((id) => (id === _id ? null : id));
    });

    newSocket.on("removeStroke", ({ _id }) => {
      setStrokes((prev) => {
        const updated = prev.filter((s) => String(s._id) !== String(_id));
        redraw(updated, textBoxes);
        return updated;
      });
    });

    newSocket.on("clearBoard", () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      setStrokes([]);
      setTextBoxes([]);
      setRedoStack([]);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [whiteboardId, navigate]);

  // Redraw on state change
  useEffect(() => {
    redraw(strokes, textBoxes);
  }, [strokes, textBoxes]);

  // Mouse handlers for drawing and text box creation
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    const getMousePos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    // --- Drawing/Eraser ---
    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      const pos = getMousePos(e);

      // Text tool: start creating a text box
      if (isTextTool) {
        setCreatingTextBox(true);
        setTextBoxStart(pos);
        setCurrentTextBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
        setTextInput("");
        setSelectedTextBoxId(null);
        return;
      }

      // Pen/Eraser
      if (isPen || isEraser) {
        drawing.current = true;
        strokePoints.current = [pos];
      }
    };

    const handleMouseMove = (e) => {
      if (isTextTool && creatingTextBox && textBoxStart) {
        const pos = getMousePos(e);
        setCurrentTextBox({
          x: Math.min(textBoxStart.x, pos.x),
          y: Math.min(textBoxStart.y, pos.y),
          width: Math.abs(pos.x - textBoxStart.x),
          height: Math.abs(pos.y - textBoxStart.y),
        });
        return;
      }
      if (!drawing.current) return;
      const newPoint = getMousePos(e);
      strokePoints.current.push(newPoint);

      context.beginPath();
      context.moveTo(
        strokePoints.current[strokePoints.current.length - 2].x,
        strokePoints.current[strokePoints.current.length - 2].y
      );
      context.lineTo(newPoint.x, newPoint.y);
      context.strokeStyle = isEraser ? "#fff" : penColor;
      context.lineWidth = isEraser ? eraserWidth : penWidth;
      context.stroke();
    };

    const handleMouseUp = (e) => {
      if (isTextTool && creatingTextBox && currentTextBox) {
        setCreatingTextBox(false);
        setTimeout(() => {
          const input = document.getElementById("canvas-text-input");
          if (input) input.focus();
        }, 0);
        return;
      }
      if (drawing.current && strokePoints.current.length > 1 && socket) {
        socket.emit("drawStroke", {
          points: strokePoints.current,
          color: isEraser ? "#fff" : penColor,
          width: isEraser ? eraserWidth : penWidth,
          userId: userId.current,
        });
        setRedoStack([]); // Clear redo stack after new stroke
      }
      drawing.current = false;
      strokePoints.current = [];
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    socket,
    penColor,
    penWidth,
    isEraser,
    eraserWidth,
    isTextTool,
    creatingTextBox,
    currentTextBox,
    textBoxStart,
  ]);

  // Drag to move text box
  useEffect(() => {
    if (!draggingBoxId) return;
    const handleMove = (e) => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffset.x;
      const y = e.clientY - rect.top - dragOffset.y;
      setTextBoxes((prev) =>
        prev.map((box) =>
          box._id === draggingBoxId
            ? { ...box, x, y }
            : box
        )
      );
    };
    const handleUp = () => {
      const box = textBoxes.find((b) => b._id === draggingBoxId);
      if (box && socket) {
        socket.emit("updateTextBox", { ...box, whiteboardId });
      }
      setDraggingBoxId(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [draggingBoxId, dragOffset, socket, textBoxes, whiteboardId]);

  // Undo: only remove your own last stroke
  const handleUndo = () => {
    if (!socket) return;
    // Find last stroke by this user
    const lastMyStroke = [...strokes]
      .reverse()
      .find((s) => s.userId === userId.current);
    if (!lastMyStroke) return;
    setRedoStack((prev) => [...prev, lastMyStroke]);
    socket.emit("undoStroke", { whiteboardId });
  };

  // Redo: re-send the last undone stroke (if any)
  const handleRedo = () => {
    if (!socket || redoStack.length === 0) return;
    const lastRedo = redoStack[redoStack.length - 1];
    socket.emit("drawStroke", {
      points: lastRedo.points,
      color: lastRedo.color,
      width: lastRedo.width,
      userId: userId.current,
    });
    setRedoStack((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (!socket) return;
    setRedoStack([]);
    setStrokes([]);
    setTextBoxes([]);
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit("clearBoard", { whiteboardId });
  };

  // Handle text input submit (edit or create)
  const handleTextSubmit = (e) => {
    if (e) e.preventDefault(); // Fixes the preventDefault error
    if (!socket || !currentTextBox || !textInput.trim()) return;
    const fontSize = Math.max(16, Math.floor(currentTextBox.height));
    if (editingTextBoxId) {
      // Update existing text box
      socket.emit("updateTextBox", {
        _id: editingTextBoxId,
        x: currentTextBox.x,
        y: currentTextBox.y,
        width: currentTextBox.width,
        height: currentTextBox.height,
        text: textInput,
        color: penColor,
        fontSize,
        userId: userId.current,
        whiteboardId,
      });
    } else {
      // Create new text box
      socket.emit("addTextBox", {
        x: currentTextBox.x,
        y: currentTextBox.y,
        width: currentTextBox.width,
        height: currentTextBox.height,
        text: textInput,
        color: penColor,
        fontSize,
        userId: userId.current,
        whiteboardId,
      });
    }
    setCurrentTextBox(null);
    setTextInput("");
    setEditingTextBoxId(null);
  };

  // Remove text box with Delete/Backspace
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        selectedTextBoxId &&
        (e.key === "Delete" || e.key === "Backspace") &&
        socket
      ) {
        socket.emit("removeTextBox", { _id: selectedTextBoxId, whiteboardId });
        setSelectedTextBoxId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTextBoxId, socket, whiteboardId]);

  // Auto-submit text box on outside click
  useEffect(() => {
    const handleDocumentMouseDown = (e) => {
      if (
        (isTextTool || editingTextBoxId) &&
        currentTextBox &&
        !creatingTextBox &&
        e.target.id !== "canvas-text-input"
      ) {
        handleTextSubmit();
      }
    };
    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () =>
      document.removeEventListener("mousedown", handleDocumentMouseDown);
  }, [isTextTool, editingTextBoxId, currentTextBox, creatingTextBox]);

  return (
    
    <div className="whiteboard-canvas-page">
      {userId.current && userId.current.startsWith("guest-") && (
        <div style={{background: "#ffeeba", padding: 8, textAlign: "center"}}>
          You are editing as a guest. <a href="/login">Login</a> to save your boards!
        </div>
      )}
      <Toolbar
        onBack={() => navigate("/whiteboards", { state: { refresh: true } })}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        penColor={penColor}
        setPenColor={setPenColor}
        penWidth={penWidth}
        setPenWidth={setPenWidth}
        isPen={isPen}
        setIsPen={setIsPen}
        isEraser={isEraser}
        setIsEraser={setIsEraser}
        isTextTool={isTextTool}
        setIsTextTool={setIsTextTool}
        eraserWidth={eraserWidth}
        setEraserWidth={setEraserWidth}
      />
      <div className="canvas-wrapper" style={{ position: "relative" }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          className="whiteboard-canvas"
        />
        {/* Text box overlays for selection, editing, and moving */}
        {textBoxes.map((box) => (
          <div
            key={box._id}
            style={{
              position: "absolute",
              left: box.x,
              top: box.y,
              width: box.width || 120,
              height: box.height || 30,
              border:
                selectedTextBoxId === box._id
                  ? "2px solid #ff9800"
                  : "1px dashed transparent",
              background: "transparent",
              zIndex: 8,
              cursor: draggingBoxId === box._id ? "grabbing" : "pointer",
              pointerEvents: isTextTool ? "auto" : "none",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTextBoxId(box._id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingTextBoxId(box._id);
              setCurrentTextBox(box);
              setTextInput(box.text);
            }}
            onMouseDown={(e) => {
              if (selectedTextBoxId === box._id && !editingTextBoxId) {
                setDraggingBoxId(box._id);
                setDragOffset({
                  x: e.clientX - box.x - canvasRef.current.getBoundingClientRect().left,
                  y: e.clientY - box.y - canvasRef.current.getBoundingClientRect().top,
                });
              }
            }}
          />
        ))}

        {/* Text box overlay for typing or editing */}
        {(isTextTool && currentTextBox && !creatingTextBox) ||
        editingTextBoxId ? (
          <form
            onSubmit={handleTextSubmit}
            style={{
              position: "absolute",
              left: currentTextBox?.x,
              top: currentTextBox?.y,
              width: currentTextBox?.width || 120,
              height: currentTextBox?.height || 30,
              background: "rgba(255,255,255,0.8)",
              border: "1px dashed #aaa",
              zIndex: 10,
            }}
          >
            <input
              id="canvas-text-input"
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              style={{
                width: "100%",
                height: "100%",
                fontSize: Math.max(
                  16,
                  Math.floor(currentTextBox?.height || 20)
                ),
                border: "none",
                background: "transparent",
                outline: "none",
              }}
              autoFocus
              onBlur={() => {
                handleTextSubmit();
              }}
            />
          </form>
        ) : null}

        {/* Draw rectangle while dragging for text box */}
        {isTextTool && creatingTextBox && currentTextBox && (
          <div
            style={{
              position: "absolute",
              left: currentTextBox.x,
              top: currentTextBox.y,
              width: currentTextBox.width,
              height: currentTextBox.height,
              border: "1px dashed #888",
              background: "rgba(255,255,255,0.3)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        )}
      </div>
    </div>
  );
}