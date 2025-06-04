import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';

function getUserIdFromToken(token) {
  try {
    return JSON.parse(atob(token.split('.')[1])).userId;
  } catch {
    return null;
  }
}

export default function WhiteboardCanvas() {
  const { id: whiteboardId } = useParams();
  const canvasRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [strokes, setStrokes] = useState([]); // { _id, points, color, width, userId }
  const [redoStack, setRedoStack] = useState([]);
  const navigate = useNavigate();
  const strokePoints = useRef([]);
  const drawing = useRef(false);
  const userId = useRef(null);

  // Helper to redraw all strokes
  const redraw = (allStrokes) => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (const stroke of allStrokes) {
      if (!stroke.points || stroke.points.length < 2) continue;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        context.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      context.strokeStyle = stroke.color || 'black';
      context.lineWidth = stroke.width || 2;
      context.stroke();
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    userId.current = getUserIdFromToken(token);

    const newSocket = io('http://localhost:4000', { auth: { token } });
    setSocket(newSocket);

    newSocket.emit('joinWhiteboard', whiteboardId);

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Draw a single stroke
    const drawStroke = (stroke) => {
      if (!stroke.points || stroke.points.length < 2) return;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        context.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      context.strokeStyle = stroke.color || 'black';
      context.lineWidth = stroke.width || 2;
      context.stroke();
    };

    // On initial load, backend will replay all strokes
    newSocket.on('drawStroke', (stroke) => {
      setStrokes(prev => [...prev, stroke]);
      drawStroke(stroke);
    });

    newSocket.on('removeStroke', ({ _id }) => {
      setStrokes(prev => {
        const updated = prev.filter(s => String(s._id) !== String(_id));
        redraw(updated);
        return updated;
      });
    });

    newSocket.on('clearBoard', () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      setStrokes([]);
      setRedoStack([]);
    });

    // For initial join, replay all strokes
    // (drawStroke will be called for each stroke)
    // If you want to optimize, you can add a 'replaceStrokes' event for bulk update

    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line
  }, [whiteboardId, navigate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const getMousePos = (e) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    };

    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      drawing.current = true;
      strokePoints.current = [getMousePos(e)];
    };

    const handleMouseMove = (e) => {
      if (!drawing.current) return;
      const newPoint = getMousePos(e);
      strokePoints.current.push(newPoint);

      context.beginPath();
      context.moveTo(
        strokePoints.current[strokePoints.current.length - 2].x,
        strokePoints.current[strokePoints.current.length - 2].y
      );
      context.lineTo(newPoint.x, newPoint.y);
      context.strokeStyle = 'black';
      context.lineWidth = 2;
      context.stroke();
    };

    const handleMouseUp = () => {
      if (drawing.current && strokePoints.current.length > 1 && socket) {
        socket.emit('drawStroke', { points: strokePoints.current });
        setRedoStack([]); // Clear redo stack after new stroke
      }
      drawing.current = false;
      strokePoints.current = [];
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [socket, whiteboardId]);

  // Undo: only remove your own last stroke
  const handleUndo = () => {
    if (!socket) return;
    // Find last stroke by this user
    const lastMyStroke = [...strokes].reverse().find(s => s.userId === userId.current);
    if (!lastMyStroke) return;
    setRedoStack(prev => [...prev, lastMyStroke]);
    socket.emit('undoStroke', { whiteboardId });
  };

  // Redo: re-send the last undone stroke (if any)
  const handleRedo = () => {
    if (!socket || redoStack.length === 0) return;
    const lastRedo = redoStack[redoStack.length - 1];
    socket.emit('drawStroke', { points: lastRedo.points, color: lastRedo.color, width: lastRedo.width });
    setRedoStack(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (!socket) return;
    setRedoStack([]);
    setStrokes([]);
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    socket.emit('clearBoard', { whiteboardId });
  };

  return (
    <div>
      <button onClick={() => navigate('/whiteboards')}>Back</button>
      <div style={{ marginBottom: 10 }}>
        <button onClick={handleUndo}>Undo</button>
        <button onClick={handleRedo}>Redo</button>
        <button onClick={handleClear}>Clear</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        style={{ border: '1px solid black', cursor: 'crosshair' }}
      />
    </div>
  );
}