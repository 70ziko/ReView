import { Card } from '../ui/card';
import { Text } from '../ui/text';
import { tva } from '@gluestack-ui/nativewind-utils/tva';
import { useEffect, useState } from 'react';
import Markdown from 'react-native-markdown-display';
import { StyleSheet } from 'react-native';

export const ChatMessage = ({ typing, message: { author, time, content } }) => {
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

  const [dots, setDots] = useState('.');

  useEffect(() => {
    let interval = null;
    if (typing) {
      interval = setInterval(() => {
        setDots((prev) => {
          if (prev === '...') {
            return '.';
          }
          return prev + '.';
        });
      }, 200);
    }
    return () => {
      if (typing) clearInterval(interval);
    };
  }, [typing]);

  return (
    <Card size={'lg'} className={base({ class: '' })}>
      <Text size={'sm'} className={text()}>
        {time}
      </Text>
      {typing && (
        <Text size={'lg'} className={text()}>
          {dots}
        </Text>
      )}
      {content && <Markdown style={styles(author)}>{content}</Markdown>}
    </Card>
  );
};

const styles = (author) =>
  StyleSheet.create({
    heading1: {
      fontSize: 32,
    },
    heading2: {
      fontSize: 26,
    },
    heading3: {
      fontSize: 20,
    },
    heading4: {
      fontSize: 18,
    },
    heading5: {
      fontSize: 15,
    },
    heading6: {
      fontSize: 13,
    },
    body: {
      fontSize: 16,
      color: author === 'user' ? 'white' : 'black',
      alignSelf: author === 'user' ? 'flex-end' : 'flex-start',
    },
  });
