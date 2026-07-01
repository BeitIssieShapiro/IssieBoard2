import '@react-native-firebase/app';
import { firebaseInit } from '@beitissieshapiro/issie-shared';
import { debugToken } from './common/debug-token';

export function initializeFirebase() {
  if (__DEV__) {
    (globalThis as any).RNFBDebug = true;
  }
  try {
    firebaseInit(debugToken);
    console.log('Firebase initialized successfully');
  } catch (e) {
    console.error('Firebase initialization FAILED:', e);
  }
}
