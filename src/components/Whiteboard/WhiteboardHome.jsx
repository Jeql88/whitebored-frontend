import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getWhiteboards, createWhiteboard } from '../../api/whiteboard';

export default function WhiteboardHome() {
  const [whiteboards, setWhiteboards] = useState([]);
  const [name, setName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    getWhiteboards().then(setWhiteboards);
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await createWhiteboard(name);
    if (res._id) {
      setWhiteboards([...whiteboards, res]);
      setName('');
    }
  };

  return (
    <div>
      <h2>Your Whiteboards</h2>
      <ul>
        {whiteboards.map(wb => (
          <li key={wb._id}>
            <button onClick={() => navigate(`/whiteboard/${wb._id}`)}>{wb.name}</button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleCreate}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New whiteboard name" required />
        <button type="submit">Create Whiteboard</button>
      </form>
      <button onClick={() => { localStorage.removeItem('token'); navigate('/login'); }}>Logout</button>
    </div>
  );
}