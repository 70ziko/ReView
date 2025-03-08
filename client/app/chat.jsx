import {
  View,
  Keyboard,
  FlatList,
  Platform,
  KeyboardAvoidingView,
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
  const { imageUri } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);

  const { handleToast } = useToaster();

  const getTime = () => format(new Date(), 'HH:mm');

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
    getResponse(message);
  };

  const flatListRef = useRef(null);

  useEffect(() => {
    // Automatyczne przewijanie do najnowszej wiadomości
    const timeout = setTimeout(() => {
      flatListRef.current?.scrollToEnd();
    }, 50);
  }, [messages]);

  useEffect(() => {
    const scrollToBottom = Keyboard.addListener('keyboardDidShow', () => {
      const timeout = setTimeout(() => {
        flatListRef.current?.scrollToEnd();
      }, 50);
    });

    return () => {
      scrollToBottom.remove();
    };
  }, []);

  if (getProductIsPending && !!imageUri) return <LoadingScreen />;

  return (
    <KeyboardAvoidingView
      className={'flex-1'}
      behavior={Platform.OS === 'ios' ? 'padding' : 'undefined'}
      keyboardVerticalOffset={100}
    >
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
        className={'flex-1'}
        contentContainerClassName={'mt-auto gap-5 px-6 pt-6'}
      />
      <View className={'px-6 pb-6 pt-4'}>
        <ChatInput onSubmit={handleChatSubmit} />
      </View>
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;
