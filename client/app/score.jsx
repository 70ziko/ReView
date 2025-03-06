import { Text } from '../components/ui/text';
import { ScrollView } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { ProductCard } from '../components/product-card/ProductCard';
import { ChatInput } from '../components/chat-input';
import { ChatMessage } from '../components/chat-message';

const fetchScore = async ({ imageUri }) => {
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

export const Score = () => {
  const { imageUri } = useLocalSearchParams();
  const [data, setData] = useState(null);

  const { mutate, isPending } = useMutation({
    mutationFn: dummyFetch,
    onSuccess: (data) => {
      console.log(data);
      setData(data);
    },
    onError: (error) => {
      console.error(error);
    },
  });

  useEffect(() => {
    mutate({ imageUri });
  }, [imageUri]);

  if (data)
    return (
      <ScrollView
        contentContainerClassName={'gap-5 p-6'}
        automaticallyAdjustKeyboardInsets={true}
      >
        <ProductCard product={data} />
        <ChatMessage
          isUserMessage={true}
          message={{
            time: '12:45',
            content:
              'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce imperdiet quam sit amet erat venenatis, a laoreet arcu posuere. Mauris tortor lorem, convallis ut mi quis, lac',
          }}
        />
        <ChatMessage
          message={{
            time: '12:45',
            content:
              'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Fusce imperdiet quam sit amet erat venenatis, a laoreet arcu posuere. Mauris tortor lorem, convallis ut mi quis, lac',
          }}
        />
        <ChatInput />
      </ScrollView>
    );

  return <Text>Loading...</Text>;
};

export default Score;
