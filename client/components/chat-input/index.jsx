import { Pressable, View } from 'react-native';
import { Textarea, TextareaInput } from '../ui/textarea';
import { SendIcon } from 'lucide-react-native';
import { Icon } from '../ui/icon';
import { useEffect, useState } from 'react';

export const ChatInput = ({ onSubmit }) => {
  const [chatText, setchatText] = useState('');

  return (
    <View className={'flex-row items-center gap-3'}>
      <Textarea
        size="lg"
        isReadOnly={false}
        isInvalid={false}
        isDisabled={false}
        className="flex-1 rounded-xl bg-white"
      >
        <TextareaInput
          className={'p-3'}
          placeholder="Your text goes here..."
          value={chatText}
          onChangeText={setchatText}
        />
      </Textarea>
      <View
        className={
          'items-center justify-center rounded-full border-2 border-primary-300 bg-white p-3'
        }
      >
        <Pressable
          onPress={() => {
            onSubmit(chatText);
            setchatText('');
          }}
        >
          <Icon as={SendIcon} className={'h-8 w-8 text-primary-500'} />
        </Pressable>
      </View>
    </View>
  );
};
