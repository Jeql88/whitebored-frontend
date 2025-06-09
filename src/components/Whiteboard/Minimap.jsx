import React, { useEffect, useRef, useState } from "react";

export default function Minimap({
  strokes,
  textBoxes,
  images,
  backgroundColor,
  canvasSize,
  viewport,
  minimapSize = { width: 200, height: 150 },
  onMinimapClick,
}) {
  const minimapRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  // Helper to get minimap viewport rectangle size
  function minimapViewWidth() {
    const scale = Math.min(
      minimapSize.width / canvasSize.width,
      minimapSize.height / canvasSize.height
    );
    return window.innerWidth * scale;
  }
  function minimapViewHeight() {
    const scale = Math.min(
      minimapSize.width / canvasSize.width,
      minimapSize.height / canvasSize.height
    );
    return (window.innerHeight - 56) * scale;
  }

  // Draw minimap
  useEffect(() => {
    const minimap = minimapRef.current;
    if (!minimap) return;
    const ctx = minimap.getContext("2d");
    const { width: cWidth, height: cHeight } = canvasSize;
    const { width: mWidth, height: mHeight } = minimapSize;

    // Scale factor
    const scale = Math.min(mWidth / cWidth, mHeight / cHeight);

    // Clear minimap
    ctx.clearRect(0, 0, mWidth, mHeight);

    // Draw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, cWidth * scale, cHeight * scale);

    // Draw strokes
    for (const stroke of strokes) {
      if (!stroke.points || stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * scale, stroke.points[0].y * scale);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * scale, stroke.points[i].y * scale);
      }
      ctx.strokeStyle = stroke.color || "black";
      ctx.lineWidth = Math.max(1, (stroke.width || 2) * scale);
      ctx.stroke();
    }

    // Draw text boxes
    for (const box of textBoxes) {
      ctx.save();
      ctx.font = `${(box.fontSize || 20) * scale}px Arial`;
      ctx.fillStyle = box.color || "#222";
      ctx.fillText(
        box.text,
        box.x * scale,
        (box.y + (box.fontSize || 20)) * scale
      );
      ctx.restore();
    }

    // Draw images
    for (const img of images) {
      const imageObj = new window.Image();
      imageObj.src = img.src;
      ctx.drawImage(
        imageObj,
        img.x * scale,
        img.y * scale,
        img.width * scale,
        img.height * scale
      );
    }

    // Draw viewport rectangle
    ctx.save();
    ctx.strokeStyle = "#007aff";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.8;
    ctx.strokeRect(
      viewport.x * scale,
      viewport.y * scale,
      minimapViewWidth(),
      minimapViewHeight()
    );
    ctx.restore();
  }, [
    strokes,
    textBoxes,
    images,
    backgroundColor,
    canvasSize,
    viewport,
    minimapSize,
  ]);

  // Move viewport by clicking or dragging on minimap
  function moveViewportFromEvent(e) {
    const minimap = minimapRef.current;
    if (!minimap) return;
    const rect = minimap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const scale = Math.min(
      minimapSize.width / canvasSize.width,
      minimapSize.height / canvasSize.height
    );
    // Center viewport on pointer
    const newViewportX = Math.max(
      0,
      Math.min(
        canvasSize.width - window.innerWidth,
        x / scale - window.innerWidth / 2
      )
    );
    const newViewportY = Math.max(
      0,
      Math.min(
        canvasSize.height - (window.innerHeight - 56),
        y / scale - (window.innerHeight - 56) / 2
      )
    );
    if (onMinimapClick) onMinimapClick({ x: newViewportX, y: newViewportY });
  }

  // Mouse events for drag-to-move
  function handleMinimapMouseDown(e) {
    setDragging(true);
    moveViewportFromEvent(e);
  }
  useEffect(() => {
    if (!dragging) return;
    function handleMouseMove(e) {
      moveViewportFromEvent(e);
    }
    function handleMouseUp() {
      setDragging(false);
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    // eslint-disable-next-line
  }, [dragging, minimapSize, canvasSize, onMinimapClick]);

  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        bottom: 16,
        zIndex: 50,
        background: "#fff",
        border: "1px solid #ddd",
        borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        padding: 4,
        userSelect: "none",
      }}
    >
      <canvas
        ref={minimapRef}
        width={minimapSize.width}
        height={minimapSize.height}
        style={{
          width: minimapSize.width,
          height: minimapSize.height,
          display: "block",
          cursor: dragging ? "grabbing" : "pointer",
          borderRadius: 6,
          background: "#fafbfc",
        }}
        onMouseDown={handleMinimapMouseDown}
        onClick={moveViewportFromEvent}
        title="Click or drag to move viewport"
      />
    </div>
  );
}