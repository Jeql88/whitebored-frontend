import React, { useRef } from "react";
import "../css/toolbar.css";

const presetColors = [
  "#000000", // black
  "#FF3B30", // red
  "#FF9500", // orange
  "#FFCC00", // yellow
  "#34C759", // green
  "#007AFF", // blue
  "#5856D6", // purple
  "#8E8E93", // gray
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
}) {
  const hiddenColorInputRef = useRef(null);

  const triggerColorPicker = () => {
    if (hiddenColorInputRef.current) {
      hiddenColorInputRef.current.click();
    }
  };

  const handleColorChange = (e) => {
    setPenColor(e.target.value);
  };

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

      {/* Color section */}
      <div className="color-swatch-container">
        {/* Current color display + separator */}
        <div className="current-color-section">
          <div
            className="current-color"
            style={{ backgroundColor: penColor }}
            title="Current Color"
          />
          <span className="color-separator">|</span>
        </div>

        {/* Preset swatches */}
        {presetColors.map((color) => (
          <button
            key={color}
            className={`color-swatch ${penColor === color ? "selected" : ""}`}
            style={{ backgroundColor: color }}
            onClick={() => setPenColor(color)}
            title={color}
          />
        ))}

        {/* Color picker icon and hidden input */}
        <div className="color-picker-wrapper">
          <button
            className="color-picker-icon-button"
            onClick={triggerColorPicker}
            title="Pick a custom color"
          >
            <img
              src="/colorpicker.jpg"
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
      </div>

      {/* Pen thickness slider */}
      <label className="toolbar-label">
        <input
          type="range"
          min="1"
          max="20"
          value={penWidth}
          onChange={(e) => setPenWidth(Number(e.target.value))}
          className="thickness-slider"
          title="Pen Thickness"
        />
        <span className="thickness-value">{penWidth}px</span>
      </label>
    </div>
  );
}
