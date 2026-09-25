import { expect, it } from 'vitest';
import { estimateOffset } from './serverClock';

it.each([
  [1000, 1200, 5000, 3900],
  [0, 0, 0, 0],
  [1000, 1200, 500, -600],
  [1000, 1201, 5000, 3900],
])('estimateOffset(%i, %i, %i) = %i', (sentAt, receivedAt, serverAt, expected) => {
  expect(estimateOffset(sentAt, receivedAt, serverAt)).toBe(expected);
});
