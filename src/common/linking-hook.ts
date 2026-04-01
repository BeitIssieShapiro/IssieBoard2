import { Linking } from 'react-native';
import { useEffect, useRef } from 'react';

/**
 * Hook that listens for incoming file URLs (from "Open With" / share).
 * Handles both cold start (app launched by file) and warm start (app already running).
 */
export function useIncomingURL(onLinkReceived: (url: string) => void) {
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const handleUrl = ({ url }: { url: string | null }) => {
      if (url && url !== handled.current) {
        // Only handle file:// URLs (not issieboard:// deep links)
        if (url.startsWith('file://') || url.includes('.zip')) {
          handled.current = url;
          onLinkReceived(url);
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    // Check for cold start URL
    (async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        setTimeout(() => handleUrl({ url }));
      }
    })();

    return () => {
      subscription.remove();
    };
  }, []);
}
