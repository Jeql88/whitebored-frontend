import React, { useRef, useState, useEffect } from "react";
import "../css/toolbar.css";

const presetColors = [
  "#000000",
  "#FF3B30",
  "#FF9500",
  "#FFCC00",
  "#34C759",
  "#007AFF",
  "#5856D6",
  "#8E8E93",
];

export default function Toolbar({
  onBack,
  onUndo,
  onRedo,
  onClear,
  penColor,
  setPenColor,
  penWidth,
  setPenWidth,
  isPen,
  setIsPen,
  isEraser,
  setIsEraser,
  isTextTool,
  setIsTextTool,
  eraserWidth,
  setEraserWidth,
  whiteboardName,
  canvasRef,
  onCommentsClick,
  commentsOpen,
  onImageUpload,
  isFillTool,
  setIsFillTool,
  fillColor,
  setFillColor,
}) {
  const hiddenColorInputRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const triggerColorPicker = () => {
    if (hiddenColorInputRef.current) hiddenColorInputRef.current.click();
  };

  const handleColorChange = (e) => setPenColor(e.target.value);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Failed to copy link.");
    }
  };

  const downloadAsPNG = (highRes = false) => {
    const canvas = canvasRef.current;
    const scale = highRes ? 3 : 1;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = canvas.width * scale;
    tempCanvas.height = canvas.height * scale;
    const ctx = tempCanvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.drawImage(canvas, 0, 0);

    const link = document.createElement("a");
    link.download = `${whiteboardName || "whiteboard"}.png`;
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
  };

  const exportAsPDF = () => {
    import("jspdf").then((jsPDFModule) => {
      const jsPDF = jsPDFModule.default;
      const canvas = canvasRef.current;
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "pt",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${whiteboardName || "whiteboard"}.pdf`);
    });
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!e.target.closest(".download-dropdown")) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  return (
    <div className="toolbar">
      <button className="home-button" onClick={onBack} title="Back to Home">
        <img src="/Home.png" alt="Home" className="home-icon" />
      </button>
      <button onClick={onUndo} title="Undo" className="icon-button">
        ↺
      </button>
      <button onClick={onRedo} title="Redo" className="icon-button">
        ↻
      </button>
      <button onClick={onClear} title="Clear" className="icon-button">
        ✕
      </button>

      <div className="color-swatch-container">
        <div className="current-color-section">
          <div
            className="current-color"
            style={{ backgroundColor: penColor }}
            title="Current Color"
          />
          <span className="color-separator">|</span>
        </div>
        {presetColors.map((color) => (
          <button
            key={color}
            className={`color-swatch ${penColor === color ? "selected" : ""}`}
            style={{ backgroundColor: color }}
            onClick={() => setPenColor(color)}
            title={color}
          />
        ))}
        <div className="color-picker-wrapper">
          <button
            className="color-picker-icon-button"
            onClick={triggerColorPicker}
            title="Pick a custom color"
          >
            <img
              src="/colorpicker.png"
              alt="Color Picker"
              className="color-picker-icon"
            />
          </button>
          <input
            type="color"
            ref={hiddenColorInputRef}
            value={penColor}
            onChange={handleColorChange}
            className="hidden-color-picker"
          />
        </div>
        <label className="toolbar-label">
          <input
            type="range"
            min="1"
            max="20"
            value={isEraser ? eraserWidth : penWidth}
            onChange={(e) =>
              isEraser
                ? setEraserWidth(Number(e.target.value))
                : setPenWidth(Number(e.target.value))
            }
            className="thickness-slider"
            title={isEraser ? "Eraser Thickness" : "Pen Thickness"}
          />
          <span className="thickness-value">
            {isEraser ? eraserWidth : penWidth}px
          </span>
        </label>
        <button
          className={`icon-button ${isPen ? "selected" : ""}`}
          onClick={() => {
            setIsPen(true);
            setIsEraser(false);
            setIsTextTool(false);
          }}
          title="Pen Tool"
        >
          ✏️
        </button>
        <button
          className={`icon-button ${isEraser ? "selected" : ""}`}
          onClick={() => {
            setIsEraser((v) => !v);
            setIsPen(false);
            setIsTextTool(false);
          }}
          title="Eraser"
        >
          🧹
        </button>
        <button
          className={`icon-button ${isTextTool ? "selected" : ""}`}
          onClick={() => {
            setIsTextTool((v) => !v);
            setIsPen(false);
            setIsEraser(false);
          }}
          title="Text Tool"
        >
          T
        </button>
        <button
          className={`icon-button ${isFillTool ? "selected" : ""}`}
          onClick={() => {
            setIsFillTool((v) => !v);
            setIsPen(false);
            setIsEraser(false);
            setIsTextTool(false);
          }}
          title="Fill Page"
        >
          <svg
            width="22"
            height="22"
            fill="none"
            stroke="#007aff"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <path d="M8 8l8 8M8 16l8-8" />
          </svg>
        </button>
        {isFillTool && (
          <input
            type="color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            style={{ marginLeft: 8, verticalAlign: "middle" }}
            title="Pick Fill Color"
          />
        )}
        <input
          type="file"
          accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
          id="image-upload"
          style={{ display: "none" }}
          onChange={onImageUpload}
        />
        <button
          className="icon-button"
          title="Upload Image"
          onClick={() => document.getElementById("image-upload").click()}
        >
          <svg
            width="22"
            height="22"
            fill="none"
            stroke="#007aff"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M8 17l4-4 4 4M12 13V7" />
          </svg>
        </button>
      </div>

      <div className="spacer" />
      <div className="download-dropdown">
        <button
          className="icon-button"
          onClick={() => setShowDropdown((prev) => !prev)}
          title="Download"
        >
          ⬇️
        </button>
        {showDropdown && (
          <div className="dropdown-content">
            <button onClick={() => downloadAsPNG()}>Download PNG</button>
            <button onClick={() => downloadAsPNG(true)}>
              Download High-Res PNG
            </button>
            <button onClick={() => exportAsPDF()}>Export as PDF</button>
          </div>
        )}
      </div>
      <button
        onClick={handleCopyLink}
        className="icon-button"
        title="Copy Shareable Link"
      >
        🔗
      </button>
      {!commentsOpen && (
        <button
          className="icon-button"
          onClick={onCommentsClick}
          title="Show Comments"
        >
          {/* FontAwesome or SVG comments icon */}
          <svg
            width="24"
            height="24"
            fill="none"
            stroke="#007aff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}
      {copied && <span className="copied-message">Link copied!</span>}
    </div>
  );
}
