import { Platform } from 'react-native';
import { API_BASE_URL } from './config';

/**
 * Processes an image and returns product information
 * 
 * @param {string} imageUri - The URI of the image to process
 * @param {string} [message] - Optional message to send with the image
 * @returns {Promise<Object>} - Product information
 */
export const processImage = async (imageUri, message = null) => {
  // Create form data object
  const formData = new FormData();
  
  try {
    console.log('Processing image:', imageUri);
    
    if (Platform.OS === 'web') {
      // Web: send a blob
      if (imageUri.startsWith('data:')) {
        console.log('Handling data URI for web');
        
        const fetchResponse = await fetch(imageUri);
        const blob = await fetchResponse.blob();
        
        const file = new File(
          [blob], 
          "image.jpg", 
          { type: blob.type || 'image/jpeg' }
        );
        
        formData.append('image', file);
      } else {
        const filename = imageUri.split('/').pop() || 'image.jpg';
        
        if (typeof imageUri === 'object' && imageUri instanceof File) {
          formData.append('image', imageUri);
        } else {
          const response = await fetch(imageUri);
          const blob = await response.blob();
          formData.append('image', new File([blob], filename, { type: blob.type }));
        }
      }
    } else {
      // Native platforms (iOS/Android):
      let filename = imageUri.split('/').pop() || `photo_${Date.now()}.jpg`;
      let match = /\.(\w+)$/.exec(filename);
      let type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
      
      if (match && match[1].toLowerCase() === 'jpg') type = 'image/jpeg';
      
      // For native platforms, we just need to pass the URI and metadata
      const file = {
        uri: Platform.OS === 'android' 
          ? imageUri 
          : Platform.OS === 'ios' 
            ? imageUri.replace('file://', '') 
            : imageUri,
        type: type,
        name: filename,
      };
      
      formData.append('image', file);
    }
    
    if (message) {
      formData.append('message', message);
    }
    
    console.log('Sending request to:', `${API_BASE_URL}/api/image/process`);
    
    const response = await fetch(`${API_BASE_URL}/api/image/process`, {
      method: 'POST',
      body: formData,
      // Important: Don't manually set Content-Type header
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const responseText = await response.text();
    console.log('Server response:', responseText);
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      throw new Error(`Server returned invalid JSON: ${responseText}`);
    }
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    
    return result;
  } catch (error) {
    console.error('Image processing error:', error);
    throw error;
  }
};