import { Card } from '../ui/card';
import { Image } from '../ui/image';
import { Text } from '../ui/text';
import { Heading } from '../ui/heading';
import { Stars } from '../stars';
import { View } from 'react-native';

export const ProductCard = ({ product }) => {
  return (
    <Card
      size={'lg'}
      className={
        'flex-col gap-5 rounded-bl-lg rounded-br-lg rounded-tl-none rounded-tr-lg'
      }
    >
      <Image
        source={{ uri: product.image_url }}
        className={'aspect-square w-full self-center rounded-md'}
        alt={product.product_name}
        size={'3xl'}
      />
      <Heading size={'lg'}>{product.product_name}</Heading>
      <Stars score={77} size={'md'} />
      <View>
        <Heading size={'md'}>General review</Heading>
        <Text size={'md'}>{product.general_review}</Text>
      </View>

      <View className={'flex-row justify-between'}>
        <View className={'flex-col items-center'}>
          <Text size={'xl'}>${product.prices.min}</Text>
          <Heading size={'md'}>Minimalna cena</Heading>
        </View>
        <View className={'flex-col items-center'}>
          <Text size={'xl'}>${product.prices.avg}</Text>
          <Heading size={'md'}>Średnia cena</Heading>
        </View>
      </View>
    </Card>
  );
};
