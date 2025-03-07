import { API_BASE_URL, createHeaders } from './config';

export const sendMessage = async (message) => {
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ message }),
  });
  
  if (!response.ok) throw new Error('Network response was not ok');
  return response.json();
};

export const clearChat = async () => {
  const response = await fetch(`${API_BASE_URL}/api/chat/clear`, {
    method: 'POST',
    headers: createHeaders(),
  });
  
  if (!response.ok) throw new Error('Network response was not ok');
  return response.json();
};
