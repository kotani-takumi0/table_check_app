import type { Persistence, ReactNativeAsyncStorage } from 'firebase/auth';

// firebase/auth の型はブラウザ用で、React Native の実装にだけある getReactNativePersistence が入っていない
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: ReactNativeAsyncStorage): Persistence;
}
