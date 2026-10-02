// 店が今つかっている Firebase プロジェクト（https://table-check-dev.web.app）。名前は dev だが、営業のデータが入っている。
// 開発中の試しで営業のデータを変えないよう、手元の Web（npm run dev）と iOS（Expo Go）はここにつながず、端末の中だけで動く。
// 店に新しい版を出すのは npm run deploy:store だけ（No.84）。店をどのプロジェクトで動かすかを決めたら見直す
export const STORE_PROJECT_ID = 'table-check-dev';
export function isStoreProject(projectId: string | undefined): boolean {
  return projectId === STORE_PROJECT_ID;
}
