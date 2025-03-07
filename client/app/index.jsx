import { Camera } from '../components/camera';
import { router } from 'expo-router';

export default function Index() {
  const handleTakePhoto = async (imageUri) => {
    router.navigate(`chat?imageUri=${imageUri}`);
  };

  const skipPhoto = () => {
    router.navigate('chat');
  };

  return <Camera onTakePhoto={handleTakePhoto} onSkipPhoto={skipPhoto} />;
}
