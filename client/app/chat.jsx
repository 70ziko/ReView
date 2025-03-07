import {
  ScrollView,
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

export const ChatScreen = () => {
  // Animacja przesuwania widoku w górę, gdy klawiatura jest otwarta

  const translateY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);

  useEffect(() => {
    const keyboardShow = Keyboard.addListener('keyboardDidShow', (event) => {
      if (Platform.OS === 'android') return;
      Animated.timing(translateY, {
        toValue: -event.endCoordinates.height,
        duration: 20,
        useNativeDriver: false,
        easing: Easing.out(Easing.ease),
      }).start();

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
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

  const { imageUri } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);

  const { handleToast } = useToaster();

  const getTime = () => format(new Date(), 'HH:mm');

  const {
    data: product,
    isPending: productIsPending,
    error: productError,
  } = useQuery({
    queryKey: [imageUri],
    queryFn: () => processImage(imageUri),
    enabled: !!imageUri,
    retry: 0,
  });

  const { mutate: getProduct, isPending: getProductIsPending } = useMutation({
    queryFn: (imageUri) => processImage(imageUri),
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
    getProduct(imageUri);
  }, []);

  const {
    mutateAsync: getResponse,
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
      handleToast({
        action: 'error',
        message: 'Błąd pobierania odpowiedzi',
      });
    },
  });

  const handleAddMessages = (messagesToAdd) => {
    setMessages([...messages, ...messagesToAdd]);
  };

  const handleChatSubmit = async (message) => {
    handleAddMessages([
      { author: 'user', type: 'message', content: message, time: getTime() },
    ]);
    await getResponse(message);
  };

  const flatListRef = useRef(null);

  useEffect(() => {
    // Automatyczne przewijanie do najnowszej wiadomości
    flatListRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  if (productIsPending && !!imageUri) return <LoadingScreen />;

  return (
    <Animated.View style={{ flex: 1, transform: [{ translateY }] }}>
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={({ item: message, index }) => {
          if (message.type === 'product') {
            return (
              <ProductCard key={message.index} product={message.content} />
            );
          }
          return <ChatMessage key={message.index} message={message} />;
        }}
        contentContainerClassName={'flex-1 gap-5 px-6 pt-6 justify-end'}
        className={'flex-1'}
        scrollEnabled={true}
      />
      <View className={'px-6 pb-6 pt-4'}>
        <ChatInput onSubmit={handleChatSubmit} />
      </View>
    </Animated.View>
  );
};

export default ChatScreen;
