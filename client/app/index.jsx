import { Camera } from '../components/camera';
import { router } from 'expo-router';

export default function Index() {
  const handleTakePhoto = async (imageUri) => {
    router.navigate(`score?imageUri=${imageUri}`);
  };

  return <Camera onTakePhoto={handleTakePhoto} />;
}
