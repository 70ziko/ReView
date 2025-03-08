import { View, Animated, Keyboard, Easing, FlatList } from 'react-native';
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

export const ChatScreen = () => {
  const translateY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);

  const { imageUri } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);
  const { handleToast } = useToaster();

  const getTime = () => format(new Date(), 'HH:mm');

  const {
    data: product,
    isPending: productIsPending,
    error: productError,
  } = useQuery({
    queryKey: ['productImage', imageUri],
    queryFn: () => processImage(imageUri),
    enabled: !!imageUri,
    retry: 3,
    refetchOnWindowFocus: false,
    refetchOnMount: false, 
    staleTime: Infinity,
    // cacheTime: Infinity,
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

  useEffect(() => {
    if (!product) return;

    if (messages.length === 0) {
      setMessages([
        {
          author: 'bot',
          type: 'product',
          content: product,
          time: getTime(),
        },
        {
          author: 'bot',
          type: 'message',
          content: `Here are some alternatives:
${product.alternatives.map((a) => `- ${a.name}`).join('\n')}`,
          time: getTime(),
        },
      ]);
    }
  }, [product]);

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

  if (productIsPending && !!imageUri) return <LoadingScreen />;

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
