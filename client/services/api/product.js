import { Platform } from 'react-native';
import { API_BASE_URL } from './config';
import * as FileSystem from 'expo-file-system';

/**
 * Processes an image and returns product information
 *
 * @param {string} imageUri - The URI of the image to process
 * @param {string} [message] - Optional message to send with the image
 * @returns {Promise<Object>} - Product information
 */
export const processImage = async (imageUri, message = null) => {
  const formData = new FormData();

  try {
    console.log('Processing image:', imageUri);

    if (Platform.OS === 'web') {
      // Web platform handling
      if (imageUri.startsWith('data:')) {
        console.log('Handling data URI for web');

        const fetchResponse = await fetch(imageUri);
        const blob = await fetchResponse.blob();

        const file = new File([blob], 'image.jpg', {
          type: blob.type || 'image/jpeg',
        });

        formData.append('image', file);
      } else {
        const filename = imageUri.split('/').pop() || 'image.jpg';

        if (typeof imageUri === 'object' && imageUri instanceof File) {
          formData.append('image', imageUri);
        } else {
          try {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            formData.append(
              'image',
              new File([blob], filename, { type: blob.type })
            );
          } catch (error) {
            console.error('Error fetching image on web:', error);
            throw new Error(`Cannot fetch image: ${error.message}`);
          }
        }
      }
    } else if (Platform.OS === 'ios') {
      try {
        let filename = imageUri.split('/').pop();
        let match = /\.(\w+)$/.exec(filename);
        let type = match ? `image/${match[1]}` : `image`;
      
        const file = {
          uri: imageUri,
          type: type || 'image/jpeg', // Default to jpeg if no extension
          name: filename || 'photo.jpg',
        };
      
        formData.append('image', file);
      } catch (error) {
        console.error('Error processing iOS image:', error);
        throw error;
      }
    } else if (Platform.OS === 'android') {
      try {
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        if (!fileInfo.exists) {
          throw new Error(`File does not exist: ${imageUri}`);
        }

        console.log('Android file info:', fileInfo);

        // For Android, we'll read the file as base64 and send that
        // This is more reliable than trying to use the file:// URI directly
        console.log('Reading file as base64...');
        const base64 = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        console.log(`Read file successfully, base64 length: ${base64.length}`);

        const filename = imageUri.split('/').pop() || `photo_${Date.now()}.jpg`;

        const dataUri = `data:image/jpeg;base64,${base64}`;

        // Create a blob from the data URI for sending
        // Note: React Native FormData on Android handles this specially
        formData.append('image', {
          uri: dataUri,
          type: 'image/jpeg',
          name: filename,
        });

        console.log('Successfully appended Android image to FormData');
      } catch (error) {
        console.error('Error processing Android image:', error);
        throw error;
      }
    }

    console.log('Sending request to:', `${API_BASE_URL}/api/image/process`);

    // detailed logging for Android
    if (Platform.OS === 'android') {
      console.log('FormData keys:');
      for (const [key, value] of Object.entries(formData._parts)) {
        console.log(`- Key: ${key}, Value type: ${typeof value}`);
      }
    }

    const response = await fetch(`${API_BASE_URL}/api/image/process`, {
      method: 'POST',
      body: formData,
      headers: {
        Accept: 'application/json',
      },
    });

    console.log('Response status:', response.status);

    const responseText = await response.text();
    console.log(
      'Server response preview:',
      responseText.substring(0, 100) + '...'
    );

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error('JSON parse error:', e);
      throw new Error(
        `Server returned invalid JSON: ${responseText.substring(0, 100)}...`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Server error: ${response.status} ${response.statusText}`
      );
    }

    return result;
  } catch (error) {
    console.error('Image processing error:', error);
    throw error;
  }
};
