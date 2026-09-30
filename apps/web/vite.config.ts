import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// ビルドのモードごとにつなぐ Firebase プロジェクト（.firebaserc の prod・dev と同じ）
const PROJECTS: Record<string, string> = { production: 'table-check-prod', development: 'table-check-dev' };
const KEYS = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
// 設定が欠けたまま配ると端末ごとの localStorage で動いて同期されず、別のプロジェクトの設定だと本番と練習のデータが混ざるので、ビルドを止める
function requireFirebase(): Plugin {
  return {
    name: 'require-firebase',
    configResolved(config) {
      if (config.command !== 'build') return;
      const file = `apps/web/.env.${config.mode}.local`;
      const missing = KEYS.filter(key => !config.env[key]);
      if (missing.length) throw new Error(`${file} に ${missing.join('・')} がありません`);
      const expected = PROJECTS[config.mode];
      const actual = `${String(config.env.VITE_FIREBASE_PROJECT_ID)}（${String(config.env.VITE_FIREBASE_AUTH_DOMAIN)}）`;
      if (config.env.VITE_FIREBASE_PROJECT_ID !== expected || config.env.VITE_FIREBASE_AUTH_DOMAIN !== `${expected}.firebaseapp.com`) {
        throw new Error(`${config.mode} のビルドは ${expected ?? '（対応するプロジェクトなし）'} につなぐはずが、${actual} の設定になっています（${file} を確認してください）`);
      }
      config.logger.info(`Firebase: ${expected}（${config.mode}）`);
    },
  };
}
export default defineConfig({ plugins: [react(), requireFirebase()] });
