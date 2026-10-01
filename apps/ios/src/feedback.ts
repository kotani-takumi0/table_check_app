import * as Haptics from 'expo-haptics';

// 触覚フィードバック。端末が対応していなくても操作は止めない
export const feedback = {
  tap: () => { void Haptics.selectionAsync().catch(() => undefined); },
  step: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined); },
  open: () => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined); },
  done: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined); },
  warn: () => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined); },
};
