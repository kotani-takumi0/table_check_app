import { registerRootComponent } from 'expo';
import App from './src/App';

// Expo Go でもネイティブのビルドでも、App を最初の画面として登録する
registerRootComponent(App);
