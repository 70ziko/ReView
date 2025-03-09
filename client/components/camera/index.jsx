import { Button, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { cssInterop } from 'nativewind';
import { Icon } from '../ui/icon';
import { MessageSquare } from 'lucide-react-native';

cssInterop(CameraView, {
  className: 'style',
});

export const Camera = ({ onTakePhoto, onSkipPhoto }) => {
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const ref = useRef();

  if (!permission) {
    // Camera permissions are still loading.
    return <View />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View className={'flex-1 justify-center'}>
        <Text className={'text-center'}>
          We need your permission to show the camera
        </Text>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  }

  const handleTakePhoto = async () => {
    const photo = await ref.current?.takePictureAsync({ quality: 0.5 });
    await onTakePhoto(photo?.uri);
  };

  return (
    <CameraView
      className={'flex-1 justify-end'}
      facing={facing}
      mode={'picture'}
      ref={ref}
    >
      <View className={'absolute bottom-12 flex-row items-center'}>
        <Pressable
          onPress={() => handleTakePhoto()}
          className={'flex-1 items-center'}
        >
          {({ pressed }) => (
            <View
              className={`h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-transparent ${pressed ? 'opacity-50' : 'opacity-100'}`}
            >
              <View className={'h-16 w-16 rounded-full bg-white'} />
            </View>
          )}
        </Pressable>
        <Pressable
          onPress={() => onSkipPhoto()}
          className={'absolute right-10'}
        >
          {({ pressed }) => (
            <View
              className={`h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-transparent ${pressed ? 'opacity-50' : 'opacity-100'}`}
            >
              <Icon
                as={MessageSquare}
                className={'h-8 w-8 rounded-full fill-white text-white'}
                fill={'white'}
              />
            </View>
          )}
        </Pressable>
      </View>
    </CameraView>
  );
};
