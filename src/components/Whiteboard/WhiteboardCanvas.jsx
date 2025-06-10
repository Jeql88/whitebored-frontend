import React, { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Toolbar from "./ToolBar.jsx";
import CommentsSidebar from "./CommentsSidebar.jsx";
import "../css/whiteboardcanvas.css";
import ChatBox from "../Chatbox";
import Minimap from "./Minimap.jsx";

function getUserIdFromToken(token) {
  try {
    return JSON.parse(atob(token.split(".")[1])).userId;
  } catch {
    return null;
  }
}
function getUserFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return { userId: payload.userId, username: payload.username };
  } catch {
    return { userId: null, username: "Guest" };
  }
}

const INITIAL_CANVAS_WIDTH = 1600;
const INITIAL_CANVAS_HEIGHT = 1200;
const EXPAND_MARGIN = 80;
const EXPAND_STEP = 800;

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
  const user = useRef({ userId: null, username: "Guest" });
  const [whiteboardName, setWhiteboardName] = useState("Whiteboard");

  // Tool states
  const [isPen, setIsPen] = useState(true);
  const [penColor, setPenColor] = useState("#000000");
  const [penWidth, setPenWidth] = useState(2);
  const [isEraser, setIsEraser] = useState(false);
  const [eraserWidth, setEraserWidth] = useState(20);
  const [isTextTool, setIsTextTool] = useState(false);
  const [isMoveTool, setIsMoveTool] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  // Text box states
  const [creatingTextBox, setCreatingTextBox] = useState(false);
  const [textBoxStart, setTextBoxStart] = useState(null);
  const [currentTextBox, setCurrentTextBox] = useState(null);
  const [textInput, setTextInput] = useState("");
  const [selectedTextBoxId, setSelectedTextBoxId] = useState(null);
  const [editingTextBoxId, setEditingTextBoxId] = useState(null);
  const [draggingBoxId, setDraggingBoxId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [openPanel, setOpenPanel] = useState(null);

  // --- Images ---
  const [images, setImages] = useState([]);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [draggingImageId, setDraggingImageId] = useState(null);
  const [resizingImageId, setResizingImageId] = useState(null);
  const [dragOffsetImage, setDragOffsetImage] = useState({ x: 0, y: 0 });

  const [isFillTool, setIsFillTool] = useState(false);
  const [fillColor, setFillColor] = useState("#ffffff");
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [prevBackgroundColor, setPrevBackgroundColor] = useState("#ffffff");

  const [isShapeTool, setIsShapeTool] = useState(false);
  const [selectedShape, setSelectedShape] = useState("rectangle");
  const [shapes, setShapes] = useState([]);
  const [creatingShape, setCreatingShape] = useState(false);
  const [currentShape, setCurrentShape] = useState(null);
  const [selectedShapeId, setSelectedShapeId] = useState(null);
  const [draggingShapeId, setDraggingShapeId] = useState(null);
  const [resizingShapeId, setResizingShapeId] = useState(null);
  const [dragOffsetShape, setDragOffsetShape] = useState({ x: 0, y: 0 });

  // --- Expandable canvas state ---
  const [canvasSize, setCanvasSize] = useState({
    width: INITIAL_CANVAS_WIDTH,
    height: INITIAL_CANVAS_HEIGHT,
  });
  const [viewport, setViewport] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const viewportStart = useRef({ x: 0, y: 0 });

  // --- Minimap ---
  const minimapSize = { width: 200, height: 150 };
  function handleMinimapMoveViewport({ x, y }) {
    setViewport({ x, y });
  }

  const [undoStack, setUndoStack] = useState([]);
  function getColorForName(name) {
    const colors = [
      "#2563eb",
      "#f59e42",
      "#10b981",
      "#f43f5e",
      "#a21caf",
      "#eab308",
      "#0ea5e9",
      "#6366f1",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++)
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  }

  // Fetch whiteboard name
  useEffect(() => {
    async function fetchWhiteboardName() {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`http://localhost:4000/whiteboards`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) {
          const boards = await res.json();
          const board = boards.find((b) => b._id === whiteboardId);
          if (board && board.name) setWhiteboardName(board.name);
        }
      } catch {}
    }
    fetchWhiteboardName();
  }, [whiteboardId]);

  // Tool switching logic
  useEffect(() => {
    // If no tool is selected, default to pen
    if (!isPen && !isEraser && !isTextTool && !isMoveTool && !isShapeTool)
      setIsPen(true);
    // If move tool is selected, disable all others
    if (isMoveTool) {
      setIsPen(false);
      setIsEraser(false);
      setIsTextTool(false);
      setIsShapeTool(false);
    }
    // If any other tool is selected, disable move tool
    if ((isPen || isEraser || isTextTool || isShapeTool) && isMoveTool)
      setIsMoveTool(false);
  }, [isPen, isEraser, isTextTool, isMoveTool, isShapeTool]);

  // Helper to redraw all events
  const redraw = (allStrokes, allTextBoxes, allImages = []) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    context.save();
    context.globalCompositeOperation = "source-over";
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.restore();

    // Pan/viewport
    context.save();
    context.translate(-viewport.x, -viewport.y);

    // Draw shapes
    for (const shape of shapes) {
      drawShape(context, shape);
    }

    // Draw strokes (always on top of images)
    for (const stroke of allStrokes) {
      if (!stroke.points || stroke.points.length < 2) continue;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        context.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      context.strokeStyle =
        stroke.color === "#fff" ? backgroundColor : stroke.color || "black";
      context.lineWidth = stroke.width || 2;
      context.stroke();
    }

    // Draw text
    for (const box of allTextBoxes) {
      context.save();
      context.font = `${box.fontSize || 20}px Arial`;
      context.fillStyle = box.color || "#222";
      context.fillText(box.text, box.x, box.y + (box.fontSize || 20));
      context.restore();
    }
    // for (const img of images) {
    //   const imageObj = new window.Image();
    //   imageObj.src = img.src;
    //   context.drawImage(imageObj, img.x, img.y, img.width, img.height);
    // }
    context.restore();
  };

  // Set user info and connect socket
  useEffect(() => {
    const token = localStorage.getItem("token");
    let guest = false;
    if (!token) {
      guest = true;
      userId.current = "guest-" + Math.random().toString(36).slice(2, 10);
      user.current = { userId: userId.current, username: "Guest" };
    } else {
      userId.current = getUserIdFromToken(token);
      user.current = getUserFromToken(token);
    }

    // Connect with or without auth
    const newSocket = guest
      ? io("http://localhost:4000")
      : io("http://localhost:4000", { auth: { token } });
    setSocket(newSocket);

    newSocket.emit("joinWhiteboard", whiteboardId);

    newSocket.on("whiteboardUsers", (users) => {
      setCollaborators(users);
    });

    // On connect, announce yourself
    newSocket.emit("presence", {
      whiteboardId,
      userId: user.current.userId,
      username: user.current.username,
    });

    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    // Draw a single stroke
    const drawStroke = (stroke) => {
      if (!stroke.points || stroke.points.length < 2) return;
      context.save();
      context.translate(-viewport.x, -viewport.y);
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        context.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      context.strokeStyle = stroke.color || "black";
      context.lineWidth = stroke.width || 2;
      context.stroke();
      context.restore();
    };

    // Draw a single text box
    const drawTextBox = (box) => {
      context.save();
      context.translate(-viewport.x, -viewport.y);
      context.font = `${box.fontSize || 20}px Arial`;
      context.fillStyle = box.color || "#222";
      context.fillText(box.text, box.x, box.y + (box.fontSize || 20));
      context.restore();
    };

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
        prev.map((b) =>
          String(b._id) === String(box._id) ? { ...b, ...box } : b
        )
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
      setImages([]);
      setBackgroundColor("#ffffff");
    });

    // --- IMAGE EVENTS ---
    newSocket.on("addImage", (img) => {
      setImages((prev) => [...prev, img]);
      setUndoStack((prev) => [...prev, { type: "image-add", data: img }]);
      setRedoStack([]);
    });
    newSocket.on("updateImage", (img) => {
      setImages((prev) =>
        prev.map((i) =>
          String(i._id) === String(img._id) ? { ...i, ...img } : i
        )
      );
    });
    newSocket.on("removeImage", ({ _id }) => {
      setImages((prev) => prev.filter((i) => String(i._id) !== String(_id)));
      setSelectedImageId((id) => (id === _id ? null : id));
    });

    return () => {
      newSocket.disconnect();
    };
  }, [whiteboardId, navigate, viewport.x, viewport.y]);

  // Redraw on state change
  useEffect(() => {
    redraw(strokes, textBoxes, images, shapes);
  }, [strokes, textBoxes, backgroundColor, images, shapes]);

  // --- Canvas expansion logic ---
  function expandCanvasIfNeeded(point) {
    let { width, height } = canvasSize;
    let expanded = false;
    if (point.x > width - EXPAND_MARGIN) {
      width += EXPAND_STEP;
      expanded = true;
    }
    if (point.y > height - EXPAND_MARGIN) {
      height += EXPAND_STEP;
      expanded = true;
    }
    if (point.x < EXPAND_MARGIN && viewport.x > 0) {
      setViewport((v) => ({ ...v, x: Math.max(0, v.x - EXPAND_STEP) }));
    }
    if (point.y < EXPAND_MARGIN && viewport.y > 0) {
      setViewport((v) => ({ ...v, y: Math.max(0, v.y - EXPAND_STEP) }));
    }
    if (expanded) setCanvasSize({ width, height });
  }

  // Mouse handlers for drawing, text, and panning
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");

    const getMousePos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left + viewport.x,
        y: e.clientY - rect.top + viewport.y,
      };
    };

    const handleMouseDown = (e) => {
      // Pan tool: left mouse if move tool is active
      if (isShapeTool && !creatingShape && !currentShape) {
        const pos = getMousePos(e);
        setCreatingShape(true);
        setCurrentShape({
          type: selectedShape,
          x: pos.x,
          y: pos.y,
          x2: pos.x,
          y2: pos.y,
          color: penColor,
          width: penWidth,
          id: "local-" + Math.random(),
        });
        setSelectedShapeId(null);
        return;
      }

      if ((isMoveTool || isPanning) && (e.button === 0 || e.button === 1)) {
        setIsPanning(true);
        panStart.current = { x: e.clientX, y: e.clientY };
        viewportStart.current = { ...viewport };
        return;
      }

      if (e.button !== 0) return;
      const pos = getMousePos(e);

      // Only create a text box if text tool is active and not already creating one
      if (isTextTool && !creatingTextBox && !currentTextBox) {
        setCreatingTextBox(true);
        setTextBoxStart(pos);
        setCurrentTextBox({ x: pos.x, y: pos.y, width: 120, height: 30 });
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
      if (isShapeTool && creatingShape && currentShape) {
        const pos = getMousePos(e);
        setCurrentShape((prev) => ({
          ...prev,
          x2: pos.x,
          y2: pos.y,
        }));
        return;
      }
      if (isPanning) {
        setViewport((v) => ({
          x: Math.max(
            0,
            Math.min(
              canvasSize.width - canvas.width,
              viewportStart.current.x - (e.clientX - panStart.current.x)
            )
          ),
          y: Math.max(
            0,
            Math.min(
              canvasSize.height - canvas.height,
              viewportStart.current.y - (e.clientY - panStart.current.y)
            )
          ),
        }));
        return;
      }

      if (isTextTool && creatingTextBox && textBoxStart) {
        const pos = getMousePos(e);
        setCurrentTextBox({
          x: Math.min(textBoxStart.x, pos.x),
          y: Math.min(textBoxStart.y, pos.y),
          width: Math.abs(pos.x - textBoxStart.x),
          height: Math.abs(pos.y - textBoxStart.y),
        });
        expandCanvasIfNeeded(pos);
        return;
      }
      if (!drawing.current) return;
      const newPoint = getMousePos(e);
      strokePoints.current.push(newPoint);

      context.save();
      context.translate(-viewport.x, -viewport.y);
      context.beginPath();
      context.moveTo(
        strokePoints.current[strokePoints.current.length - 2].x,
        strokePoints.current[strokePoints.current.length - 2].y
      );
      context.lineTo(newPoint.x, newPoint.y);
      context.strokeStyle = isEraser ? backgroundColor : penColor;
      context.lineWidth = isEraser ? eraserWidth : penWidth;
      context.stroke();
      context.restore();

      expandCanvasIfNeeded(newPoint);
    };

    const handleMouseUp = (e) => {
      if (isShapeTool && creatingShape && currentShape) {
        // Save shape
        const shape = {
          type: currentShape.type,
          x: currentShape.x,
          y: currentShape.y,
          x2: currentShape.x2,
          y2: currentShape.y2,
          color: currentShape.color,
          width: currentShape.width,
          whiteboardId,
        };
        socket.emit("addShape", shape);
        setCreatingShape(false);
        setCurrentShape(null);
        return;
      }
      if (isPanning) {
        setIsPanning(false);
        return;
      }
      if (isTextTool && creatingTextBox && currentTextBox) {
        setCreatingTextBox(false);
        setTimeout(() => {
          const input = document.getElementById("canvas-text-input");
          if (input) input.focus();
        }, 0);
        expandCanvasIfNeeded({
          x: currentTextBox.x + currentTextBox.width,
          y: currentTextBox.y + currentTextBox.height,
        });
        return;
      }
      if (drawing.current && strokePoints.current.length > 1 && socket) {
        const strokeData = {
          points: [...strokePoints.current],
          color: isEraser ? backgroundColor : penColor,
          width: isEraser ? eraserWidth : penWidth,
          userId: userId.current,
        };
        socket.emit("drawStroke", strokeData);
        setUndoStack((prev) => [...prev, { type: "stroke", data: strokeData }]);
        setRedoStack([]);
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
    isPanning,
    viewport,
    canvasSize,
    isPen,
    isMoveTool,
    isShapeTool,
    creatingShape,
    currentShape,
    selectedShape,
  ]);

  // Drag to move text box
  useEffect(() => {
    if (!draggingBoxId) return;
    const handleMove = (e) => {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left + viewport.x - dragOffset.x;
      const y = e.clientY - rect.top + viewport.y - dragOffset.y;
      setTextBoxes((prev) =>
        prev.map((box) => (box._id === draggingBoxId ? { ...box, x, y } : box))
      );
      expandCanvasIfNeeded({ x, y });
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
  }, [
    draggingBoxId,
    dragOffset,
    socket,
    textBoxes,
    whiteboardId,
    viewport,
    canvasSize,
  ]);

  // Undo: only remove your own last stroke
  const handleUndo = () => {
    if (!socket || undoStack.length === 0) return;
    const lastAction = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, lastAction]);

    switch (lastAction.type) {
      case "stroke":
        // Remove last stroke by this user
        socket.emit("undoStroke", { whiteboardId });
        break;
      case "fill":
        // Undo fill by restoring previous color
        socket.emit("setBackgroundColor", {
          color: lastAction.data.prevColor,
          whiteboardId,
        });
        break;
      case "image-add":
        // Remove the image
        socket.emit("removeImage", { _id: lastAction.data._id, whiteboardId });
        break;
      case "shape-add":
        socket.emit("removeShape", { _id: lastAction.data._id, whiteboardId });
        break;
      case "shape-delete":
        socket.emit("addShape", { ...lastAction.data, whiteboardId });
        break;
        break;
      default:
        break;
    }
  };

  // Redo: re-send the last undone stroke (if any)
  const handleRedo = () => {
    if (!socket || redoStack.length === 0) return;
    const lastRedo = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, lastRedo]);

    switch (lastRedo.type) {
      case "stroke":
        socket.emit("drawStroke", lastRedo.data);
        break;
      case "fill":
        socket.emit("setBackgroundColor", {
          color: fillColor,
          whiteboardId,
        });
        break;
      case "image-add":
        socket.emit("addImage", { ...lastRedo.data, whiteboardId });
        break;
      case "shape-add":
        socket.emit("addShape", { ...lastRedo.data, whiteboardId });
        break;
      case "shape-delete":
        socket.emit("removeShape", { _id: lastRedo.data._id, whiteboardId });
        break;
        break;
      default:
        break;
    }
  };

  const handleClear = () => {
    if (!socket) return;
    setRedoStack([]);
    setStrokes([]);
    setTextBoxes([]);
    setImages([]);
    setBackgroundColor("#ffffff");
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit("clearBoard", { whiteboardId });
  };

  // Handle text input submit (edit or create)
  const handleTextSubmit = (e) => {
    if (e) e.preventDefault();
    if (!socket || !currentTextBox || !textInput.trim()) return;
    const fontSize = Math.max(16, Math.floor(currentTextBox.height));
    if (editingTextBoxId) {
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

  // Responsive canvas: update size on window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Full viewport
      const width = window.innerWidth;
      const height = window.innerHeight - 56; // minus toolbar
      canvas.width = width;
      canvas.height = height;
      redraw(strokes, textBoxes, images, shapes); // <-- Pass images here!
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
    // eslint-disable-next-line
  }, [strokes, textBoxes, shapes]);

  // --- IMAGE HANDLING ---

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new window.Image();
      img.onload = () => {
        const aspect = img.width / img.height;
        const maxWidth = 300;
        const width = Math.min(img.width, maxWidth);
        const height = width / aspect;
        socket.emit("addImage", {
          src: ev.target.result,
          x: 100 + viewport.x,
          y: 100 + viewport.y,
          width,
          height,
          whiteboardId,
        });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // Drag image
  useEffect(() => {
    if (!draggingImageId) return;
    const handleMove = (e) => {
      setImages((prev) =>
        prev.map((img) =>
          img._id === draggingImageId
            ? {
                ...img,
                x: e.clientX - dragOffsetImage.x + viewport.x,
                y: e.clientY - dragOffsetImage.y + viewport.y,
              }
            : img
        )
      );
    };
    const handleUp = () => {
      const img = images.find((i) => i._id === draggingImageId);
      if (img && socket) {
        socket.emit("updateImage", {
          _id: img._id,
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
          whiteboardId,
        });
      }
      setDraggingImageId(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [
    draggingImageId,
    dragOffsetImage,
    images,
    socket,
    whiteboardId,
    viewport,
  ]);

  // Resize image
  useEffect(() => {
    if (!resizingImageId) return;
    const handleMove = (e) => {
      setImages((prev) =>
        prev.map((img) => {
          if (img._id !== resizingImageId) return img;
          const dx = e.movementX;
          const dy = e.movementY;
          let newWidth = img.width + dx;
          let newHeight = img.height + dy;
          const aspect = img.width / img.height;
          if (Math.abs(dx) > Math.abs(dy)) {
            newHeight = newWidth / aspect;
          } else {
            newWidth = newHeight * aspect;
          }
          return {
            ...img,
            width: Math.max(30, newWidth),
            height: Math.max(30, newHeight),
          };
        })
      );
    };
    const handleUp = () => {
      const img = images.find((i) => i._id === resizingImageId);
      if (img && socket) {
        socket.emit("updateImage", {
          _id: img._id,
          x: img.x,
          y: img.y,
          width: img.width,
          height: img.height,
          whiteboardId,
        });
      }
      setResizingImageId(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizingImageId, images, socket, whiteboardId]);

  // Delete image with keyboard
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        selectedImageId &&
        (e.key === "Delete" || e.key === "Backspace") &&
        socket
      ) {
        socket.emit("removeImage", { _id: selectedImageId, whiteboardId });
        setSelectedImageId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedImageId, socket, whiteboardId]);

  const handleCanvasMouseDown = (e) => {
    if (isFillTool && e.button === 0) {
      if (socket) {
        setUndoStack((prev) => [
          ...prev,
          { type: "fill", data: { prevColor: backgroundColor } },
        ]);
        setRedoStack([]);
        socket.emit("setBackgroundColor", { color: fillColor, whiteboardId });
      }
      setIsFillTool(false);
    }
  };

  useEffect(() => {
    if (!socket) return;
    const handleSetBackgroundColor = ({ color }) => setBackgroundColor(color);
    socket.on("setBackgroundColor", handleSetBackgroundColor);
    return () => socket.off("setBackgroundColor", handleSetBackgroundColor);
  }, [socket]);

  useEffect(() => {
    setStrokes((prev) =>
      prev.map((stroke) =>
        stroke.color === prevBackgroundColor
          ? { ...stroke, color: backgroundColor }
          : stroke
      )
    );
    setPrevBackgroundColor(backgroundColor);
  }, [backgroundColor]);

  const drawShape = (ctx, shape) => {
    ctx.save();
    ctx.strokeStyle = shape.color || "#000";
    ctx.lineWidth = shape.width || 2;
    const { x, y, x2, y2, type } = shape;
    switch (type) {
      case "rectangle":
        ctx.strokeRect(
          Math.min(x, x2),
          Math.min(y, y2),
          Math.abs(x2 - x),
          Math.abs(y2 - y)
        );
        break;
      case "circle": {
        const cx = (x + x2) / 2;
        const cy = (y + y2) / 2;
        const rx = Math.abs(x2 - x) / 2;
        const ry = Math.abs(y2 - y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.stroke();
        break;
      }
      case "line":
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        break;
      case "diamond": {
        const cx = (x + x2) / 2;
        const cy = (y + y2) / 2;
        const w = Math.abs(x2 - x) / 2;
        const h = Math.abs(y2 - y) / 2;
        ctx.beginPath();
        ctx.moveTo(cx, cy - h);
        ctx.lineTo(cx + w, cy);
        ctx.lineTo(cx, cy + h);
        ctx.lineTo(cx - w, cy);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case "triangle":
        ctx.beginPath();
        ctx.moveTo((x + x2) / 2, y);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x, y2);
        ctx.closePath();
        ctx.stroke();
        break;
      case "curve":
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.bezierCurveTo(x, y2, x2, y, x2, y2);
        ctx.stroke();
        break;
      default:
        break;
    }
    ctx.restore();
  };

  useEffect(() => {
    if (!draggingShapeId) return;
    const handleMove = (e) => {
      setShapes((prev) =>
        prev.map((shape) =>
          shape._id === draggingShapeId
            ? {
                ...shape,
                x: e.clientX - dragOffsetShape.x + viewport.x,
                y: e.clientY - dragOffsetShape.y + viewport.y,
                x2:
                  e.clientX -
                  dragOffsetShape.x +
                  viewport.x +
                  Math.abs(shape.x2 - shape.x),
                y2:
                  e.clientY -
                  dragOffsetShape.y +
                  viewport.y +
                  Math.abs(shape.y2 - shape.y),
              }
            : shape
        )
      );
    };
    const handleUp = () => {
      const shape = shapes.find((s) => s._id === draggingShapeId);
      if (shape && socket) {
        socket.emit("updateShape", {
          _id: shape._id,
          x: shape.x,
          y: shape.y,
          x2: shape.x2,
          y2: shape.y2,
          color: shape.color,
          width: shape.width,
          whiteboardId,
        });
      }
      setDraggingShapeId(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [
    draggingShapeId,
    dragOffsetShape,
    viewport,
    shapes,
    socket,
    whiteboardId,
  ]);

  // Resize shape
  useEffect(() => {
    if (!resizingShapeId) return;
    const handleMove = (e) => {
      setShapes((prev) =>
        prev.map((shape) => {
          if (shape._id !== resizingShapeId) return shape;
          const dx = e.movementX;
          const dy = e.movementY;
          return {
            ...shape,
            x2: shape.x2 + dx,
            y2: shape.y2 + dy,
          };
        })
      );
    };
    const handleUp = () => {
      const shape = shapes.find((s) => s._id === resizingShapeId);
      if (shape && socket) {
        socket.emit("updateShape", {
          _id: shape._id,
          x: shape.x,
          y: shape.y,
          x2: shape.x2,
          y2: shape.y2,
          color: shape.color,
          width: shape.width,
          whiteboardId,
        });
      }
      setResizingShapeId(null);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
  }, [resizingShapeId, shapes, socket, whiteboardId]);

  useEffect(() => {
    if (!socket) return;

    socket.on("addShape", (shape) => {
      // Map shapeType to type for frontend consistency
      const normalizedShape = {
        ...shape,
        type:
          shape.type === "shape" && shape.shapeType
            ? shape.shapeType
            : shape.type,
      };
      setShapes((prev) => [...prev, normalizedShape]);
      setUndoStack((prev) => [
        ...prev,
        { type: "shape-add", data: normalizedShape },
      ]);
      setRedoStack([]);
    });

    socket.on("updateShape", (shape) => {
      setShapes((prev) =>
        prev.map((s) =>
          String(s._id) === String(shape._id)
            ? { ...s, ...shape, type: shape.shapeType || s.type }
            : s
        )
      );
    });

    socket.on("removeShape", ({ _id }) => {
      setShapes((prev) => prev.filter((s) => String(s._id) !== String(_id)));
      setSelectedShapeId((id) => (id === _id ? null : id));
    });

    return () => {
      socket.off("addShape");
      socket.off("updateShape");
      socket.off("removeShape");
    };
  }, [socket]);

  return (
    <div
      className="whiteboard-canvas-page"
      style={{ height: "100vh", width: "100vw", padding: 0, margin: 0 }}
    >
      {userId.current && userId.current.startsWith("guest-") && (
        <div style={{ background: "#ffeeba", padding: 8, textAlign: "center" }}>
          You are editing as a guest. <a href="/login">Login</a> to save your
          boards!
        </div>
      )}
      {/* Top bar with toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#f7f7f7",
          borderBottom: "1px solid #ddd",
          position: "sticky",
          top: 0,
          zIndex: 10,
          padding: "0 24px",
          // height: 56,
        }}
      >
        {/* Editable whiteboard name */}
        <div style={{ display: "flex", alignItems: "center", minWidth: 130 }}>
          <input
            value={whiteboardName}
            onChange={(e) => setWhiteboardName(e.target.value)}
            onBlur={async () => {
              try {
                await fetch(
                  `http://localhost:4000/whiteboards/${whiteboardId}`,
                  {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${localStorage.getItem("token")}`,
                    },
                    body: JSON.stringify({ name: whiteboardName }),
                  }
                );
              } catch {}
            }}
            style={{
              fontSize: 22,
              fontWeight: 700,
              border: "none",
              background: "transparent",
              outline: "none",
              minWidth: 120,
              maxWidth: 120,
              color: "#222",
              padding: "8px 0",
            }}
          />
        </div>
        {/* Toolbar */}
        <div
          style={{
            flex: 1,
            margin: "0 24px",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Toolbar
            onBack={() =>
              navigate("/whiteboards", { state: { refresh: true } })
            }
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
            canvasRef={canvasRef}
            onCommentsClick={() => setOpenPanel("comments")}
            commentsOpen={openPanel === "comments"}
            onChatClick={() => setOpenPanel("chat")}
            chatOpen={openPanel === "chat"}
            onImageUpload={handleImageUpload}
            isFillTool={isFillTool}
            setIsFillTool={setIsFillTool}
            fillColor={fillColor}
            setFillColor={setFillColor}
            isMoveTool={isMoveTool}
            setIsMoveTool={setIsMoveTool}
            isShapeTool={isShapeTool}
            setIsShapeTool={setIsShapeTool}
            selectedShape={selectedShape}
            setSelectedShape={setSelectedShape}
          />
        </div>
        {/* Collaborators avatars */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minWidth: 80,
          }}
        >
          {collaborators.map((u) => (
            <div
              key={u.userId}
              title={u.username || "Guest"}
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: getColorForName(u.username || "Guest"),
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
                border: "2px solid #fff",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                marginBottom: 2,
                transition: "transform 0.15s",
              }}
            >
              {(u.username || "G")[0].toUpperCase()}
            </div>
          ))}
        </div>
        {openPanel === "comments" && (
          <CommentsSidebar
            whiteboardId={whiteboardId}
            socket={socket}
            open={true}
            onClose={() => setOpenPanel(null)}
            currentUserId={userId.current}
          />
        )}
      </div>
      {/* Canvas and overlays */}
      <div
        className="canvas-wrapper"
        style={{
          position: "relative",
          background: "#f3f3f3",
          width: "100vw",
          height: "calc(100vh - 56px)",
          minHeight: 0,
          minWidth: 0,
          overflow: "hidden",
        }}
        onClick={() => {
          setSelectedImageId(null);
          setEditingTextBoxId(null);
          setSelectedTextBoxId(null);
        }}
      >
        <canvas
          ref={canvasRef}
          className="whiteboard-canvas"
          width={window.innerWidth}
          height={window.innerHeight - 56}
          style={{
            background: "#fff",
            cursor:
              isMoveTool || isPanning
                ? "grab"
                : isPen
                ? "crosshair"
                : isTextTool
                ? "text"
                : "default",
            display: "block",
            width: "100vw",
            height: "calc(100vh - 56px)",
          }}
          onMouseDown={handleCanvasMouseDown}
        />
        {/* Text box overlays for selection, editing, and moving */}
        {textBoxes.map((box) => (
          <div
            key={box._id}
            style={{
              position: "absolute",
              left: box.x - viewport.x,
              top: box.y - viewport.y,
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
                  x:
                    e.clientX -
                    (box.x - viewport.x) -
                    canvasRef.current.getBoundingClientRect().left,
                  y:
                    e.clientY -
                    (box.y - viewport.y) -
                    canvasRef.current.getBoundingClientRect().top,
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
              left: currentTextBox?.x - viewport.x,
              top: currentTextBox?.y - viewport.y,
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
              left: currentTextBox.x - viewport.x,
              top: currentTextBox.y - viewport.y,
              width: currentTextBox.width,
              height: currentTextBox.height,
              border: "1px dashed #888",
              background: "rgba(255,255,255,0.3)",
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        )}

        {isShapeTool && creatingShape && currentShape && (
          <div
            style={{
              position: "absolute",
              left: Math.min(currentShape.x, currentShape.x2) - viewport.x,
              top: Math.min(currentShape.y, currentShape.y2) - viewport.y,
              width: Math.abs(currentShape.x2 - currentShape.x),
              height: Math.abs(currentShape.y2 - currentShape.y),
              pointerEvents: "none",
              zIndex: 15,
            }}
          >
            <svg
              width={Math.abs(currentShape.x2 - currentShape.x)}
              height={Math.abs(currentShape.y2 - currentShape.y)}
              style={{ width: "100%", height: "100%" }}
            >
              {(() => {
                const w = Math.abs(currentShape.x2 - currentShape.x);
                const h = Math.abs(currentShape.y2 - currentShape.y);
                switch (currentShape.type) {
                  case "rectangle":
                    return (
                      <rect
                        x={0}
                        y={0}
                        width={w}
                        height={h}
                        fill="none"
                        stroke={currentShape.color}
                        strokeWidth={currentShape.width}
                        strokeDasharray="4"
                      />
                    );
                  case "circle":
                    return (
                      <ellipse
                        cx={w / 2}
                        cy={h / 2}
                        rx={w / 2}
                        ry={h / 2}
                        fill="none"
                        stroke={currentShape.color}
                        strokeWidth={currentShape.width}
                        strokeDasharray="4"
                      />
                    );
                  case "line":
                    return (
                      <line
                        x1={0}
                        y1={0}
                        x2={w}
                        y2={h}
                        stroke={currentShape.color}
                        strokeWidth={currentShape.width}
                        strokeDasharray="4"
                      />
                    );
                  case "diamond":
                    return (
                      <polygon
                        points={`${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${
                          h / 2
                        }`}
                        fill="none"
                        stroke={currentShape.color}
                        strokeWidth={currentShape.width}
                        strokeDasharray="4"
                      />
                    );
                  case "triangle":
                    return (
                      <polygon
                        points={`${w / 2},0 ${w},${h} 0,${h}`}
                        fill="none"
                        stroke={currentShape.color}
                        strokeWidth={currentShape.width}
                        strokeDasharray="4"
                      />
                    );
                  case "curve":
                    return (
                      <path
                        d={`M0,0 C0,${h} ${w},0 ${w},${h}`}
                        fill="none"
                        stroke={currentShape.color}
                        strokeWidth={currentShape.width}
                        strokeDasharray="4"
                      />
                    );
                  default:
                    return null;
                }
              })()}
            </svg>
          </div>
        )}

        {images.map((img) => (
          <div
            key={img._id}
            style={{
              position: "absolute",
              left: img.x - viewport.x,
              top: img.y - viewport.y,
              width: img.width,
              height: img.height,
              border:
                selectedImageId === img._id
                  ? "2px solid #007aff"
                  : "1px solid #ccc",
              zIndex: 20,
              cursor: draggingImageId === img._id ? "grabbing" : "move",
              userSelect: "none",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedImageId(img._id);
            }}
            onMouseDown={(e) => {
              if (selectedImageId === img._id) {
                e.stopPropagation();
                setDraggingImageId(img._id);
                setDragOffsetImage({
                  x: e.clientX - (img.x - viewport.x),
                  y: e.clientY - (img.y - viewport.y),
                });
              }
            }}
          >
            <img
              src={img.src}
              alt=""
              draggable={false}
              style={{ width: "100%", height: "100%", pointerEvents: "none" }}
            />
            {/* Resize handle (bottom right corner) */}
            {selectedImageId === img._id && (
              <div
                style={{
                  position: "absolute",
                  right: -8,
                  bottom: -8,
                  width: 16,
                  height: 16,
                  background: "#fff",
                  border: "2px solid #007aff",
                  borderRadius: "50%",
                  cursor: "nwse-resize",
                  zIndex: 21,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setResizingImageId(img._id);
                }}
              />
            )}
            {/* Delete button (top right) */}
            {selectedImageId === img._id && (
              <button
                style={{
                  position: "absolute",
                  top: -10,
                  right: -10,
                  background: "#fff",
                  border: "1px solid #e74c3c",
                  color: "#e74c3c",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  fontSize: 14,
                  cursor: "pointer",
                  zIndex: 22,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  socket.emit("removeImage", { _id: img._id, whiteboardId });
                  setSelectedImageId(null);
                }}
                title="Delete Image"
              >
                ×
              </button>
            )}
          </div>
        ))}

        {shapes.map((shape) => (
          <div
            key={shape._id}
            style={{
              position: "absolute",
              left: Math.min(shape.x, shape.x2) - viewport.x,
              top: Math.min(shape.y, shape.y2) - viewport.y,
              width: Math.abs(shape.x2 - shape.x),
              height: Math.abs(shape.y2 - shape.y),
              border:
                selectedShapeId === shape._id
                  ? "2px solid #ff9800"
                  : "1px dashed transparent",
              background: "transparent",
              zIndex: 9,
              cursor: draggingShapeId === shape._id ? "grabbing" : "pointer",
              pointerEvents: isShapeTool ? "auto" : "none",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedShapeId(shape._id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setSelectedShapeId(shape._id);
              // Optionally, allow editing shape properties
            }}
            onMouseDown={(e) => {
              if (selectedShapeId === shape._id) {
                setDraggingShapeId(shape._id);
                setDragOffsetShape({
                  x: e.clientX - (Math.min(shape.x, shape.x2) - viewport.x),
                  y: e.clientY - (Math.min(shape.y, shape.y2) - viewport.y),
                });
              }
            }}
          >
            {/* Resize handle */}
            {selectedShapeId === shape._id && (
              <div
                style={{
                  position: "absolute",
                  right: -8,
                  bottom: -8,
                  width: 16,
                  height: 16,
                  background: "#fff",
                  border: "2px solid #007aff",
                  borderRadius: "50%",
                  cursor: "nwse-resize",
                  zIndex: 21,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setResizingShapeId(shape._id);
                }}
              />
            )}
            {/* Delete button */}
            {selectedShapeId === shape._id && (
              <button
                style={{
                  position: "absolute",
                  top: -10,
                  right: -10,
                  background: "#fff",
                  border: "1px solid #e74c3c",
                  color: "#e74c3c",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  fontSize: 14,
                  cursor: "pointer",
                  zIndex: 22,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  socket.emit("removeShape", { _id: shape._id, whiteboardId });
                  setUndoStack((prev) => [
                    ...prev,
                    { type: "shape-delete", data: shape },
                  ]);
                  setSelectedShapeId(null);
                }}
                title="Delete Shape"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {/* Minimap */}
        <Minimap
          strokes={strokes}
          textBoxes={textBoxes}
          images={images}
          backgroundColor={backgroundColor}
          canvasSize={canvasSize}
          viewport={viewport}
          minimapSize={minimapSize}
          onMinimapClick={handleMinimapMoveViewport}
        />
        {/* No canvas border/line here */}
      </div>
      {/* Chatbox at the bottom */}
      {openPanel === "chat" && (
        <ChatBox
          socket={socket}
          userId={user.current.userId}
          username={user.current.username}
          whiteboardId={whiteboardId}
          onClose={() => setOpenPanel(null)}
        />
      )}
      {/* Floating chat button (only if neither is open) */}
      {openPanel === null && (
        <button
          className="chatbox-fab"
          onClick={() => setOpenPanel("chat")}
          title="Open Chat"
        >
          <img src="/chat.png" alt="Chat" style={{ width: 24, height: 24 }} />
        </button>
      )}
    </div>
  );
}
