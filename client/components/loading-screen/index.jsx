import { ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const LoadingScreen = () => {
  return (
    <SafeAreaView className={'flex-1 items-center justify-center'}>
      <ActivityIndicator
        size={Platform.OS === 'android' ? '90' : 'large'}
        className={'color-primary-500'}
      />
    </SafeAreaView>
  );
};
