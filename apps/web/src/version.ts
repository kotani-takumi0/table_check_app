// リポジトリ直下の package.json の version を画面に出す（名前付き import なので他の項目はバンドルされない）
import { version } from '../../../package.json';
import type { AppInfo } from '@table-check/core/sessionRecord';

export const APP_VERSION = `v${version}`;
// 記録に写す端末の種類と版（No.113）
export const APP_INFO: AppInfo = { platform: 'web', version };
