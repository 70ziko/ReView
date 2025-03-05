import { Text } from '../components/ui/text';
import { View } from 'react-native';
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { useMutation, useQuery } from '@tanstack/react-query';

const fetchScore = async ({ imageUri }) => {
  let formData = new FormData();

  // Extract file name & type
  let filename = imageUri.split('/').pop();
  let match = /\.(\w+)$/.exec(filename);
  let type = match ? `image/${match[1]}` : `image`;

  // Append image
  formData.append('image', {
    uri: imageUri,
    name: filename,
    type: type,
  });

  // Append extra parameter
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

export const Score = () => {
  const { imageUri } = useLocalSearchParams();
  const [data, setData] = useState(null);

  const { mutate, isPending } = useMutation({
    mutationFn: fetchScore,
    onSuccess: (data) => {
      console.log(data);
    },
    onError: (error) => {
      console.error(error);
    },
  });

  useEffect(() => {
    mutate({ imageUri });
  }, [imageUri]);

  if (isPending) return <Text>Loading...</Text>;

  return (
    <View>
      <Text>Score</Text>
      <Text>{data?.product_name}</Text>
      <Text>{data?.score}</Text>
    </View>
  );
};

export default Score;
