import React, { useRef, useState } from "react";
import "../css/toolbar.css";

const presetColors = [
  "#000000", "#FF3B30", "#FF9500", "#FFCC00",
  "#34C759", "#007AFF", "#5856D6", "#8E8E93",
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
}) {
  const hiddenColorInputRef = useRef(null);
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="toolbar">
      <button className="home-button" onClick={onBack} title="Back to Home">
        <img src="/Home.png" alt="Home" className="home-icon" />
      </button>
      <button onClick={onUndo} title="Undo" className="icon-button">↺</button>
      <button onClick={onRedo} title="Redo" className="icon-button">↻</button>
      <button onClick={onClear} title="Clear" className="icon-button">✕</button>

      <div className="color-swatch-container">
        <div className="current-color-section">
          <div className="current-color" style={{ backgroundColor: penColor }} title="Current Color" />
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
          <button className="color-picker-icon-button" onClick={triggerColorPicker} title="Pick a custom color">
            <img src="/colorpicker.png" alt="Color Picker" className="color-picker-icon" />
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
      </div>
      <div className="spacer" />
      <button onClick={handleCopyLink} className="icon-button" title="Copy Shareable Link">🔗</button>
      {copied && <span className="copied-message">Link copied!</span>}
    </div>
  );
}