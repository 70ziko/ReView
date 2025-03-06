import { Card } from '../ui/card';
import { Text } from '../ui/text';
import { tva } from '@gluestack-ui/nativewind-utils/tva';

export const ChatMessage = ({ message, isUserMessage, children }) => {
  const cardStyle = tva({
    slots: {
      base: 'flex-col gap-3 rounded-bl-lg rounded-br-lg rounded-tl-none rounded-tr-lg',
      text: 'text-primary-900',
    },
    variants: {
      user: {
        true: {
          base: 'bg-primary-300 rounded-bl-lg rounded-br-none rounded-tl-lg rounded-tr-lg',
          text: 'text-white self-end',
        },
      },
    },
  });

  const { base, text } = cardStyle({ user: isUserMessage });

  return (
    <Card size={'lg'} className={base()}>
      <Text size={'sm'} className={text()}>
        {message.time}
      </Text>
      <Text size={'lg'} className={text()}>
        {message.content}
      </Text>
    </Card>
  );
};
