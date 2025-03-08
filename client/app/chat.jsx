import {
  View,
  Animated,
  Keyboard,
  Easing,
  FlatList,
  Platform,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { processImage, sendMessage } from '../services/api';
import { ProductCard } from '../components/product-card/ProductCard';
import { ChatInput } from '../components/chat-input';
import { ChatMessage } from '../components/chat-message';
import { format } from 'date-fns';
import useToaster from '../hooks/useToaster';
import { LoadingScreen } from '../components/loading-screen';
import * as FileSystem from 'expo-file-system';

export const ChatScreen = () => {
  const translateY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  
  const params = useLocalSearchParams();
  const { handleToast } = useToaster();
  const [messages, setMessages] = useState([]);
  const [decodedImageUri, setDecodedImageUri] = useState(null);
  
  const getTime = () => format(new Date(), 'HH:mm');

  useEffect(() => {
    const setupImageUri = async () => {
      if (!params.imageUri) return;
      
      try {
        const decoded = decodeURIComponent(params.imageUri);
        console.log('Decoded URI:', decoded);
        
        if (Platform.OS === 'android' || Platform.OS === 'ios') {
          const fileInfo = await FileSystem.getInfoAsync(decoded);
          console.log('File exists check:', fileInfo);
          
          if (!fileInfo.exists) {
            console.error('Image file does not exist after decoding URI');
            handleToast({
              action: 'error',
              message: 'Could not find the image file',
            });
            return;
          }
        }
        
        setDecodedImageUri(decoded);
      } catch (error) {
        console.error('Error processing image URI:', error);
        handleToast({
          action: 'error',
          message: 'Error processing image',
        });
      }
    };

    setupImageUri();
  }, [params.imageUri]);

  const { mutate: getProduct, isPending: getProductIsPending } = useMutation({
    mutationFn: (imageUri) => processImage(imageUri),
    onSuccess: (data) => {
      setMessages([
        {
          author: 'bot',
          type: 'product',
          content: data,
          time: getTime(),
        },
        {
          author: 'bot',
          type: 'message',
          content: `Here are some alternatives:
${data.alternatives.map((a) => `- ${a.name}`).join('\n')}`,
          time: getTime(),
        },
      ]);
    },
  });

  useEffect(() => {
    if (!!imageUri) getProduct(imageUri);
  }, []);

  const {
    data: product,
    isPending: productIsPending,
    error: productError,
  } = useQuery({
    queryKey: ['productImage', decodedImageUri],
    queryFn: () => processImage(decodedImageUri),
    enabled: !!decodedImageUri,
    retry: 1,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
    cacheTime: Infinity,
  });

  const {
    mutate: getResponse,
    isPending: getResponseIsPending,
    error: responseError,
  } = useMutation({
    mutationFn: sendMessage,
    onSuccess: (data) => {
      handleAddMessages([
        {
          author: 'bot',
          type: 'message',
          content: data.response,
          time: getTime(),
        },
      ]);
    },
    onError: (error) => {
      console.error('Chat error:', error);
    },
  });

  useEffect(() => {
    const keyboardShow = Keyboard.addListener('keyboardDidShow', (event) => {
      Animated.timing(translateY, {
        toValue: -event.endCoordinates.height,
        duration: 20,
        useNativeDriver: false,
        easing: Easing.out(Easing.ease),
      }).start();

      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 1);
    });

    const keyboardHide = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(translateY, {
        toValue: 0,
        duration: 20,
        useNativeDriver: false,
        easing: Easing.out(Easing.ease),
      }).start();
    });

    return () => {
      keyboardShow.remove();
      keyboardHide.remove();
    };
  }, []);

  // Handle errors
  useEffect(() => {
    if (productError) {
      console.error('Product error:', productError);
      handleToast({
        action: 'error',
        message: 'Error loading product data',
      });
    }
    
    if (responseError) {
      console.error('Response error:', responseError);
      handleToast({
        action: 'error',
        message: 'Error getting response',
      });
    }
  }, [productError, responseError]);

  // Clean up temporary files when component unmounts
  useEffect(() => {
    return () => {
      if (Platform.OS === 'android' && decodedImageUri && 
          decodedImageUri.includes(FileSystem.documentDirectory)) {
        console.log('Cleaning up temporary file:', decodedImageUri);
        FileSystem.deleteAsync(decodedImageUri, { idempotent: true })
          .catch(err => console.log('Error deleting temp file:', err));
      }
    };
  }, [decodedImageUri]);

  const handleAddMessages = (messagesToAdd) => {
    setMessages((prev) => [...prev, ...messagesToAdd]);
  };

  const handleChatSubmit = async (message) => {
    handleAddMessages([
      { author: 'user', type: 'message', content: message, time: getTime() },
    ]);
    getResponse(message);
  };

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  if (productIsPending && !!decodedImageUri) return <LoadingScreen />;

  return (
    <Animated.View style={{ flex: 1, transform: [{ translateY }] }}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => `message-${index}`}
        renderItem={({ item: message }) => {
          if (message.type === 'product') {
            return <ProductCard product={message.content} />;
          }
          return <ChatMessage message={message} />;
        }}
        contentContainerClassName={'flex-1 gap-5 px-6 pt-6'}
        className={'flex-1'}
      />
      <View className={'px-6 pb-6 pt-4'}>
        <ChatInput onSubmit={handleChatSubmit} />
      </View>
    </Animated.View>
  );
};

export default ChatScreen;