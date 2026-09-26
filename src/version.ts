// package.json の version を画面に出す（名前付き import なので他の項目はバンドルされない）
import { version } from '../package.json';

export const APP_VERSION = `v${version}`;
