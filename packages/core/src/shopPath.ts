// 店のデータの置き場所（No.88）。今の店（ログインなし）はいちばん上、ログインした店は shops/{アカウントの uid}/ の下に同じ形で持つ
export type ShopBase = string[];
export const GUEST_BASE: ShopBase = [];
export function accountBase(uid: string): ShopBase {
  return ['shops', uid];
}
// コレクションの場所（例：shops/abc/sessions）
export function shopPath(base: ShopBase, name: string): string {
  return [...base, name].join('/');
}
