import {
  ScrollView,
  View,
  Animated,
  Keyboard,
  Easing,
  FlatList,
} from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ProductCard } from '../components/product-card/ProductCard';
import { ChatInput } from '../components/chat-input';
import { ChatMessage } from '../components/chat-message';
import { format } from 'date-fns';
import useToaster from '../hooks/useToaster';
import { LoadingScreen } from '../components/loading-screen';

const fetchProduct = async ({ imageUri }) => {
  let formData = new FormData();

  let filename = imageUri.split('/').pop();
  let match = /\.(\w+)$/.exec(filename);
  let type = match ? `image/${match[1]}` : `image`;

  formData.append('image', {
    uri: imageUri,
    name: filename,
    type: type,
  });

  formData.append('isUrl', false);

  const response = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/api/image/process`,
    {
      method: 'POST',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

const dummyFetch = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        product_name: 'Premium Bluetooth Headphones',
        score: 86,
        image_url: 'https://picsum.photos/800',
        general_review:
          'High-quality wireless headphones with excellent sound quality and comfortable fit. Battery life could be improved.',
        amazon_reviews_ref: 'https://amazon.com/product/123456/reviews',
        alternatives: [
          {
            name: 'Budget Bluetooth Headphones',
            product_id: 'BT78901',
            score: 4,
          },
          {
            name: 'Premium Wired Headphones',
            product_id: 'WH45678',
            score: 4,
          },
        ],
        prices: {
          min: 79.99,
          avg: 94.5,
        },
        product_id: 'BT12345',
        category: 'Electronics/Audio/Headphones',
      });
    }, 1500);
  });
};

const dummyFetchResponse = () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        message:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Lorem ipsum dolor sit amet. Lorem ipsum dolor sit amet.',
      });
    }, 1500);
  });
};

export const ChatScreen = () => {
  // Animacja przesuwania widoku w górę, gdy klawiatura jest otwarta

  const translateY = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef(null);

  useEffect(() => {
    const keyboardShow = Keyboard.addListener('keyboardDidShow', (event) => {
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

  //
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
    queryFn: dummyFetch,
    enabled: !!imageUri,
  });

  const {
    mutate: getResponse,
    isPending: getResponseIsPending,
    error: responseError,
  } = useMutation({
    mutationFn: dummyFetchResponse,
    onSuccess: (data) => {
      handleAddMessages([
        {
          author: 'bot',
          type: 'message',
          content: data.message,
          time: getTime(),
        },
      ]);
    },
    onError: (error) => {
      console.error(error);
    },
  });

  useEffect(() => {
    if (!product) return;
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
  }, [product]);

  useEffect(() => {
    if (productError) {
      handleToast({
        action: 'error',
        message: 'Błąd pobierania danych produktu',
      });
    }
    if (responseError) {
      handleToast({
        action: 'error',
        message: 'Błąd pobierania odpowiedzi',
      });
    }
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
          console.log('message:', message);
          if (message.type === 'product') {
            return (
              <ProductCard key={message.index} product={message.content} />
            );
          }
          return <ChatMessage key={message.index} message={message} />;
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
