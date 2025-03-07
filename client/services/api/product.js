import { Platform } from 'react-native';
import { API_BASE_URL, createHeaders } from './config';

export const processImage = async (imageUri) => {
  let formData = new FormData();
  let filename = imageUri.split('/').pop();
  let match = /\.(\w+)$/.exec(filename);
  let type = match ? `image/${match[1]}` : `image`;

  const file = {
    uri: imageUri,
    type: type || 'image/jpeg', // Default to jpeg if no extension
    name: filename || 'photo.jpg',
  };
  
  formData.append('image', file);

  const response = await fetch(`${API_BASE_URL}/api/image/process`, {
    method: 'POST',
    body: formData,
    headers: Platform.select({
      default: {
        'Accept': 'application/json',
        // Let the browser set the Content-Type with boundary
      },
      native: {
        'Accept': 'application/json',
        'Content-Type': 'multipart/form-data',
      },
    }),
  });
  
  if (!response.ok) {
    console.error('Network response error:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url
    });
    const errorText = await response.text();
    console.error('Error response:', errorText);
    throw new Error(`Network response was not ok: ${response.status} ${response.statusText}`);
  }
  
  const result = await response.json();
  console.log('API Response:', result);
  return result;
};
