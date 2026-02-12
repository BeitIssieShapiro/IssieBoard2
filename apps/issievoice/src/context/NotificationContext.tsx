import React, {createContext, useContext, useState, ReactNode} from 'react';
import Notification from '../components/Notification/Notification';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider: React.FC<{children: ReactNode}> = ({
  children,
}) => {
  const [notification, setNotification] = useState<{
    message: string;
    type: NotificationType;
  } | null>(null);

  const showNotification = (message: string, type: NotificationType = 'success') => {
    setNotification({message, type});
  };

  const hideNotification = () => {
    setNotification(null);
  };

  return (
    <NotificationContext.Provider value={{showNotification}}>
      {children}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onHide={hideNotification}
        />
      )}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotification must be used within NotificationProvider',
    );
  }
  return context;
};
