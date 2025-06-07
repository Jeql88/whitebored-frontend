import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import WhiteboardHome from './components/Whiteboard/WhiteboardHome';
import WhiteboardCanvas from './components/Whiteboard/WhiteboardCanvas';

function App() {
  const token = localStorage.getItem('token');

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/whiteboards"
          element={token ? <WhiteboardHome /> : <Navigate to="/login" />}
        />
        <Route
          path="/whiteboard/:id"
          element={<WhiteboardCanvas />} // Allow both guests and users
        />
        <Route path="*" element={<Navigate to={token ? "/whiteboards" : "/login"} />} />
      </Routes>
    </Router>
  );
}

export default App;