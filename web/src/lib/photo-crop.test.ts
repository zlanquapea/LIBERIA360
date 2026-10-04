import { cropRect, initialCrop, isUnchanged, outputSize, rotatedSize } from './photo-crop';

describe('photo crop maths', () => {
  it('fits the largest frame of the chosen shape, centred', () => {
    expect(cropRect(4000, 3000, initialCrop(4000, 3000, '16:9'))).toEqual({ x: 0, y: 375, width: 4000, height: 2250 });
    expect(cropRect(4000, 3000, initialCrop(4000, 3000, '1:1'))).toEqual({ x: 500, y: 0, width: 3000, height: 3000 });
    expect(cropRect(4000, 3000, initialCrop(4000, 3000))).toEqual({ x: 0, y: 0, width: 4000, height: 3000 });
  });

  it('zooms in around the centre and keeps the frame inside the photo', () => {
    const state = { ...initialCrop(4000, 3000, '4:3'), zoom: 2 };
    expect(cropRect(4000, 3000, state)).toEqual({ x: 1000, y: 750, width: 2000, height: 1500 });
    // Panned past the edge: clamped.
    expect(cropRect(4000, 3000, { ...state, cx: 0, cy: 99999 })).toEqual({ x: 0, y: 1500, width: 2000, height: 1500 });
  });

  it('swaps width and height for quarter turns', () => {
    expect(rotatedSize(4000, 3000, 90)).toEqual({ width: 3000, height: 4000 });
    const r = cropRect(4000, 3000, initialCrop(4000, 3000, 'original', 90));
    expect(r.width).toBe(3000);
    expect(r.height).toBe(4000);
  });

  it('knows when nothing was changed', () => {
    expect(isUnchanged(initialCrop(10, 10))).toBe(true);
    expect(isUnchanged({ ...initialCrop(10, 10), rotation: 90 })).toBe(false);
    expect(isUnchanged(initialCrop(10, 10, '1:1'))).toBe(false);
  });

  it('caps the output size', () => {
    expect(outputSize({ x: 0, y: 0, width: 4000, height: 3000 })).toEqual({ width: 2400, height: 1800 });
    expect(outputSize({ x: 0, y: 0, width: 800, height: 600 })).toEqual({ width: 800, height: 600 });
  });
});
