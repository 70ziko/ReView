import { Icon } from '../ui/icon';
import { StarIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { tva } from '@gluestack-ui/nativewind-utils/tva';

export const Stars = ({ score, size }) => {
  const validScore = Math.max(1, Math.min(score, 100));
  const filledCount = Math.ceil(validScore / 20);
  const stars = Array.from({ length: 5 }, (_, index) => ({
    fill: index < filledCount,
  }));

  const starsStyles = tva({
    base: 'gap-2',
    variants: {
      size: {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8',
        xl: 'w-10 h-10',
        '2xl': 'w-12 h-12',
      },
      fill: {
        false: 'text-warning-300 ',
        true: 'text-warning-300 fill-warning-300 ',
      },
    },
    defaultVariants: {
      size: 'sm',
      fill: false,
    },
  });

  const containerStyles = tva({
    base: 'flex-row',
    variants: {
      size: {
        xs: 'gap-1',
        sm: 'gap-1',
        md: 'gap-2',
        lg: 'gap-3',
        xl: 'gap-4',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  });

  return (
    <View className={containerStyles(size)}>
      {stars?.map((star, index) => (
        <Icon
          as={StarIcon}
          key={index}
          className={starsStyles({ fill: star.fill, size })}
        />
      ))}
    </View>
  );
};
