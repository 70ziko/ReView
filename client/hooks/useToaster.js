import {
  Toast,
  ToastDescription,
  ToastTitle,
  useToast,
} from '../components/ui/toast';
import { useState, useCallback, useRef } from 'react';

export const useToaster = () => {
  const toast = useToast();
  const currentToastId = useRef(0);

  const handleToast = useCallback(
    ({ action = 'info', duration = 2000, title, message }) => {
      title =
        title ||
        (action === 'error'
          ? 'Błąd!'
          : action === 'success'
            ? 'Sukces!'
            : action === 'info'
              ? 'Informacja!'
              : 'Uwaga!');

      if (!toast.isActive(currentToastId.current)) {
        showNewToast({ action, duration, title, message });
      }
    },
    [toast]
  );

  const showNewToast = useCallback(
    ({ action, duration, title, message }) => {
      const newId = Math.random();
      currentToastId.current = newId;

      toast.show({
        id: newId,
        placement: 'top',
        duration: duration,
        render: ({ id }) => {
          const uniqueToastId = 'toast-' + id;

          return (
            <Toast nativeID={uniqueToastId} action={action} variant="solid">
              {title && <ToastTitle>{title}</ToastTitle>}
              <ToastDescription>{message}</ToastDescription>
            </Toast>
          );
        },
      });
    },
    [toast]
  );

  return { handleToast };
};

export default useToaster;
