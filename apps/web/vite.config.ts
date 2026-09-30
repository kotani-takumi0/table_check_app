import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// ビルドは必ずどれかの Firebase プロジェクトにつなぐ（設定が無いと端末ごとの localStorage で動き、同期しないまま配ってしまう）
function requireFirebase(): Plugin {
  return {
    name: 'require-firebase',
    configResolved(config) {
      if (config.command !== 'build') return;
      const projectId: unknown = config.env.VITE_FIREBASE_PROJECT_ID;
      if (!projectId) throw new Error(`apps/web/.env.${config.mode}.local に Firebase の設定がありません`);
      config.logger.info(`Firebase: ${String(projectId)}（${config.mode}）`);
    },
  };
}
export default defineConfig({ plugins: [react(), requireFirebase()] });
