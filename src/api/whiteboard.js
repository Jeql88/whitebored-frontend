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