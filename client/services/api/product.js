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
    
    // Handle web vs native platforms differently
    if (Platform.OS === 'web') {
      // For web, we need to handle data URIs properly
      if (imageUri.startsWith('data:')) {
        // Parse the data URI
        console.log('Handling data URI for web');
        
        // Convert data URI to blob
        const fetchResponse = await fetch(imageUri);
        const blob = await fetchResponse.blob();
        
        // Create a File object from the blob
        const file = new File(
          [blob], 
          "image.jpg", 
          { type: blob.type || 'image/jpeg' }
        );
        
        // Append the file to form data
        formData.append('image', file);
      } else {
        // Handle URL or File object
        const filename = imageUri.split('/').pop() || 'image.jpg';
        
        if (typeof imageUri === 'object' && imageUri instanceof File) {
          // If it's already a File object
          formData.append('image', imageUri);
        } else {
          // Try to fetch the URL and create a blob
          const response = await fetch(imageUri);
          const blob = await response.blob();
          formData.append('image', new File([blob], filename, { type: blob.type }));
        }
      }
    } else {
      // For React Native (iOS/Android)
      let filename = imageUri.split('/').pop();
      let match = /\.(\w+)$/.exec(filename);
      let type = match ? `image/${match[1].toLowerCase()}` : 'image/jpeg';
      
      if (match && match[1].toLowerCase() === 'jpg') type = 'image/jpeg';
      
      const file = {
        uri: Platform.OS === 'android' 
          ? imageUri 
          : Platform.OS === 'ios' 
            ? imageUri.replace('file://', '') 
            : imageUri,
        type: type,
        name: filename || `photo_${Date.now()}.jpg`,
      };
      
      formData.append('image', file);
    }
    
    // Append optional message if provided
    if (message) {
      formData.append('message', message);
    }
    
    console.log('Sending request to:', `${API_BASE_URL}/api/image/process`);
    
    // Send the request - no Content-Type header for multipart/form-data
    const response = await fetch(`${API_BASE_URL}/api/image/process`, {
      method: 'POST',
      body: formData,
      // Important: Don't manually set Content-Type header
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Get response text for debugging
    const responseText = await response.text();
    console.log('Server response:', responseText);
    
    // Parse JSON response
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