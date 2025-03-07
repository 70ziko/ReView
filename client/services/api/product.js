import { API_BASE_URL, createHeaders } from './config';

export const processImage = async (imageUri) => {
  let formData = new FormData();
  let filename = imageUri.split('/').pop();
  let match = /\.(\w+)$/.exec(filename);
  let type = match ? `image/${match[1]}` : `image`;

  const imageFile = {
    uri: imageUri,
    type,
    name: filename
  };
  
  formData.append('image', imageFile);

  const response = await fetch(`${API_BASE_URL}/api/image/process`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) throw new Error('Network response was not ok');
  return response.json();
};
