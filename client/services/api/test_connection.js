
import { API_BASE_URL } from './config';

/**
 * Tests the connection to the API server
 * @returns {Promise<boolean>} True if connection successful
 */
export const testApiConnection = async () => {
  try {
    console.log(`Testing connection to: ${API_BASE_URL}`);
    const response = await fetch(`${API_BASE_URL}/api`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      // Short timeout for quick feedback
      timeout: 5000
    });
    
    console.log('Connection test response status:', response.status);
    return response.ok;
  } catch (error) {
    console.error('API connection test failed:', error.message);
    return false;
  }
};

/**
 * Creates a small test request with minimal data to test file uploads
 * @returns {Promise<Object>} Server response or error
 */
export const testImageUpload = async () => {
  try {
    // Create minimal FormData with a tiny test image
    const formData = new FormData();
    
    // Create a simple 1x1 transparent pixel as base64
    const minimalImageB64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    
    // Convert to blob for web
    const fetchResponse = await fetch(minimalImageB64);
    const blob = await fetchResponse.blob();
    
    const file = new File(
      [blob], 
      "test-pixel.png", 
      { type: 'image/png' }
    );
    
    formData.append('image', file);
    formData.append('message', 'Test upload');
    
    console.log('Sending test upload request to:', `${API_BASE_URL}/api/image/process`);
    
    const response = await fetch(`${API_BASE_URL}/api/image/process`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    const responseText = await response.text();
    console.log('Test upload response:', responseText);
    
    return { success: response.ok, status: response.status, data: responseText };
  } catch (error) {
    console.error('Test upload failed:', error.message);
    return { success: false, error: error.message };
  }
};