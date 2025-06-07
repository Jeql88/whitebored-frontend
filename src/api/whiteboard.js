const API_URL = 'http://localhost:4000';

export async function getWhiteboards() {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/whiteboards`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function createWhiteboard(name) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/whiteboards`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name }),
  });
  return res.json();
}

export async function deleteWhiteboard(id) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/whiteboards/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function updateWhiteboard(id, name) {
  const token = localStorage.getItem('token');
  console.log('Renaming whiteboard with ID:', id);
  const res = await fetch(`${API_URL}/whiteboards/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Failed to rename: ${res.status} - ${errorText}`);
  }

  return res.json();
}

export async function getComments(whiteboardId) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/whiteboards/${whiteboardId}/comments`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}

export async function addComment(whiteboardId, text) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/whiteboards/${whiteboardId}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function deleteComment(whiteboardId, commentId) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_URL}/whiteboards/${whiteboardId}/comments/${commentId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}