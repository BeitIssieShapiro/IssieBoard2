import { Linking } from 'react-native';
import { useEffect } from 'react';

/**
 * Hook that listens for incoming file URLs (from "Open With" / share).
 * Handles both cold start (app launched by file) and warm start (app already running).
 */
export function useIncomingURL(onLinkReceived: (url: string) => void) {
  useEffect(() => {
    const handleUrl = ({ url }: { url: string | null }) => {
      if (url) {
        // Only handle file:// URLs (not issieboard:// deep links)
        if (url.startsWith('file://') || url.includes('.zip')) {
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
