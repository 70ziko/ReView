import { Card } from '../ui/card';
import { Text } from '../ui/text';
import { tva } from '@gluestack-ui/nativewind-utils/tva';

export const ChatMessage = ({ message: { author, time, content } }) => {
  const cardStyle = tva({
    slots: {
      base: 'flex-col rounded-bl-lg rounded-br-lg rounded-tl-none rounded-tr-lg gap-2',
      text: 'text-primary-900',
    },
    variants: {
      user: {
        true: {
          base: 'bg-primary-300 rounded-bl-lg rounded-br-none rounded-tl-lg rounded-tr-lg self-end',
          text: 'text-white self-end',
        },
      },
    },
  });

  const { base, text } = cardStyle({ user: author === 'user' });

  return (
    <Card size={'lg'} className={base({ class: '' })}>
      <Text size={'sm'} className={text()}>
        {time}
      </Text>
      <Text size={'lg'} className={text()}>
        {content}
      </Text>
    </Card>
  );
};
