import { Injectable } from '@angular/core';

export interface WatermarkOptions {
  /** Watermark text */
  text: string;
  /** Font size in px (default: 28) */
  fontSize?: number;
  /** Font family (default: Arial) */
  fontFamily?: string;
  /** Valid CSS color, e.g. '#b4b4b4' or 'rgb(180,180,180)' (default: '#b4b4b4') */
  color?: string;
  /** Opacity between 0 and 1 (default: 0.45) */
  opacity?: number;
  /** Spacing between repetitions in px (default: 60) */
  spacing?: number;
}

@Injectable({ providedIn: 'root' })
export class WatermarkService {

  applyWatermark(file: File, options: WatermarkOptions): Promise<Blob> {
    const {
      text,
      fontSize   = 28,
      fontFamily = 'Arial',
      color      = '#b4b4b4',
      opacity    = 0.45,
      spacing    = 60,
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        const canvas = document.createElement('canvas');
        canvas.width  = img.naturalWidth;
        canvas.height = img.naturalHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Measure text width before sizing the tile canvas
        const measureCtx = document.createElement('canvas').getContext('2d');
        if (!measureCtx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        measureCtx.font = `bold ${fontSize}px ${fontFamily}`;
        const textWidth = measureCtx.measureText(text).width;

        const tileW = Math.ceil(textWidth + spacing);
        const tileH = Math.ceil(fontSize  + spacing);

        const tileCanvas = document.createElement('canvas');
        tileCanvas.width  = tileW;
        tileCanvas.height = tileH;

        const tileCtx = tileCanvas.getContext('2d');
        if (!tileCtx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }

        tileCtx.globalAlpha  = opacity;
        tileCtx.font         = `bold ${fontSize}px ${fontFamily}`;
        tileCtx.fillStyle    = color;
        tileCtx.textBaseline = 'middle';
        tileCtx.fillText(text, spacing / 2, tileH / 2);

        const pattern = ctx.createPattern(tileCanvas, 'repeat');
        if (!pattern) {
          reject(new Error('createPattern failed'));
          return;
        }

        // Rotate the context 45° around the canvas centre, then fill a rectangle
        // larger than the diagonal so the pattern covers every corner
        const diagonal = Math.ceil(
          Math.sqrt(canvas.width ** 2 + canvas.height ** 2),
        );

        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((45 * Math.PI) / 180);
        ctx.fillStyle = pattern;
        ctx.fillRect(-diagonal, -diagonal, diagonal * 2, diagonal * 2);
        ctx.restore();

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('canvas.toBlob returned null'));
          },
          'image/jpeg',
          0.92,
        );
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image'));
      };

      img.src = objectUrl;
    });
  }
}
