import { Button, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { cssInterop } from 'nativewind';

cssInterop(CameraView, {
  className: 'style',
});

export const Camera = ({ onTakePhoto }) => {
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
    <View className={'flex-1 justify-center'}>
      <CameraView
        className={'flex-1'}
        facing={facing}
        mode={'picture'}
        ref={ref}
      >
        <View
          className={
            'flex-1 flex-col-reverse items-center bg-transparent pb-16'
          }
        >
          <Pressable onPress={() => handleTakePhoto()} className={''}>
            {({ pressed }) => (
              <View
                className={`h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-transparent ${pressed ? 'opacity-50' : 'opacity-100'}`}
              >
                <View className={'h-16 w-16 rounded-full bg-white'} />
              </View>
            )}
          </Pressable>
          {/*<TouchableOpacity*/}
          {/*  className={'flex-1 items-center self-end'}*/}
          {/*  onPress={toggleCameraFacing}*/}
          {/*>*/}
          {/*  <Text className={'text-bold text-2xl text-white'}>Flip Camera</Text>*/}
          {/*</TouchableOpacity>*/}
        </View>
      </CameraView>
    </View>
  );
};
