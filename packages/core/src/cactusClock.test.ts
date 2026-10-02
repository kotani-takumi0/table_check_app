import { describe, expect, it } from 'vitest';
import { cactusClock } from './cactusClock';

const at = (h: number, m: number) => new Date(2026, 9, 2, h, m, 0).getTime();
describe('サボテンの時計の印', () => {
  it('縁に10個の点', () => {
    const { dots } = cactusClock(at(12, 0));
    expect(dots).toHaveLength(10);
    expect(dots[0]).toEqual({ x: 12, y: 3.42 });
  });
  it('針はいまの時刻を指す（12時は真上、3時は右、30分は真下）', () => {
    const noon = cactusClock(at(12, 0));
    expect(noon.hour.x).toBeCloseTo(12);
    expect(noon.hour.y).toBeLessThan(12);
    expect(noon.minute.x).toBeCloseTo(12);
    const three = cactusClock(at(15, 0));
    expect(three.hour.x).toBeGreaterThan(12);
    expect(three.hour.y).toBeCloseTo(12);
    const half = cactusClock(at(19, 30));
    expect(half.minute.x).toBeCloseTo(12);
    expect(half.minute.y).toBeGreaterThan(12);
  });
});
