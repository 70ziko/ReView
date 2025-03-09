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
import * as FileSystem from 'expo-file-system';

export const ChatScreen = () => {
  const { imageUri } = useLocalSearchParams();
  const [messages, setMessages] = useState([]);
  const flatListRef = useRef(null);
  const [decodedImageUri, setDecodedImageUri] = useState(null);
  const { handleToast } = useToaster();

  const getTime = () => format(new Date(), 'HH:mm');

  useEffect(() => {
    const setupImageUri = async () => {
      if (!imageUri) return;
      
      try {
        const decoded = decodeURIComponent(imageUri);
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
  }, [imageUri]);


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
    }
  });

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

  return (
    <KeyboardAvoidingView
      className={'flex-1'}
      behavior={Platform.OS === 'ios' ? 'padding' : 'undefined'}
      keyboardVerticalOffset={100}
    >
      {getProductIsPending && !!imageUri ? (
        <LoadingScreen />
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={({ item: message, index }) => {
              if (message.type === 'product') {
                return <ProductCard product={message.content} />;
              }
              return <ChatMessage message={message} />;
            }}
            className={'flex-1'}
            contentContainerClassName={'mt-auto gap-5 px-6 pt-6'}
          />
          <View className={'px-6 pb-6 pt-4'}>
            <ChatInput onSubmit={handleChatSubmit} />
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
};

export default ChatScreen;