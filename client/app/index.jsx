import { Camera } from '../components/camera';
import { router } from 'expo-router';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

export default function Index() {
  const handleTakePhoto = async (imageUri) => {
    try {
      console.log('Original image URI:', imageUri);
      
      if (Platform.OS === 'android') {
        // On Android, we need to copy the file to ensure it exists and is accessible
        const fileInfo = await FileSystem.getInfoAsync(imageUri);
        
        if (!fileInfo.exists) {
          console.error('Image file does not exist at path:', imageUri);
          return;
        }
        
        // Create a new path in the app's document directory
        const timestamp = new Date().getTime();
        const newFilePath = `${FileSystem.documentDirectory}temp_${timestamp}.jpg`;
        
        // Copy the file
        await FileSystem.copyAsync({
          from: imageUri,
          to: newFilePath,
        });
        
        console.log('Image copied to:', newFilePath);
        
        // Verify the new file exists
        const newFileInfo = await FileSystem.getInfoAsync(newFilePath);
        console.log('New file info:', newFileInfo);
        
        // Use the new path (encoded for safety)
        const encodedUri = encodeURIComponent(newFilePath);
        router.navigate(`chat?imageUri=${encodedUri}`);
      } else {
        // On iOS and web, we can use the URI directly
        // Still encode it for safety in URL parameters
        const encodedUri = encodeURIComponent(imageUri);
        router.navigate(`chat?imageUri=${encodedUri}`);
      }
    } catch (error) {
      console.error('Error handling photo:', error);
      // Navigate anyway but without image
      router.navigate('chat');
    }
  };

  const skipPhoto = () => {
    router.navigate('chat');
  };

  return <Camera onTakePhoto={handleTakePhoto} onSkipPhoto={skipPhoto} />;
}