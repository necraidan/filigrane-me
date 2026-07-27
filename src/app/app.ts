import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WatermarkService } from './watermark.service';

type AppState = 'idle' | 'preview' | 'processing' | 'done' | 'error';

const ACCEPTED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const DEBOUNCE_MS = 400;
const DEFAULT_COLOR = '#b4b4b4';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly watermarkService = inject(WatermarkService);
  private readonly fileInputEl = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

  protected readonly state = signal<AppState>('idle');
  protected readonly watermarkText = signal('');
  protected readonly previewUrl = signal<string | null>(null);
  protected readonly resultUrl = signal<string | null>(null);
  protected readonly errorMessage = signal('');
  protected readonly isDragging = signal(false);
  /** Watermark opacity between 0 and 1, driven by the slider */
  protected readonly opacity = signal(0.45);
  /** Watermark text color, driven by the color picker */
  protected readonly color = signal(DEFAULT_COLOR);
  /** True while re-processing from the result view (keeps the layout in place) */
  protected readonly isUpdating = signal(false);

  private readonly originalFile = signal<File | null>(null);
  private readonly originalFileName = signal('');
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  /** Invalidates in-flight processing when a newer request supersedes it */
  private processToken = 0;

  protected readonly canProcess = computed(
    () => this.state() === 'preview' && this.watermarkText().trim().length > 0,
  );

  /** Displayed value next to the slider (0–100) */
  protected readonly opacityPercent = computed(() => Math.round(this.opacity() * 100));

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  protected onDragLeave(): void {
    this.isDragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.loadFile(file);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.loadFile(file);
    input.value = '';
  }

  protected openFilePicker(): void {
    this.fileInputEl().nativeElement.click();
  }

  private loadFile(file: File): void {
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
      this.errorMessage.set('Format non supporté. Utilisez JPG ou PNG.');
      this.state.set('error');
      return;
    }

    this.revokeObjectUrls();
    this.originalFile.set(file);
    this.originalFileName.set(file.name.replace(/\.[^.]+$/, ''));
    this.previewUrl.set(URL.createObjectURL(file));
    this.state.set('preview');
  }

  protected async processWatermark(): Promise<void> {
    const file = this.originalFile();
    const text = this.watermarkText().trim();
    if (!file || !text) return;

    // Re-processing from the result view keeps the 'done' layout in place
    // (switching to 'processing' would swap the whole block and make the image jump)
    const isUpdate = this.state() === 'done';
    if (isUpdate) {
      this.isUpdating.set(true);
    } else {
      this.state.set('processing');
    }

    const token = ++this.processToken;

    try {
      const blob = await this.watermarkService.applyWatermark(file, {
        text,
        opacity: this.opacity(),
        color: this.color(),
      });

      const url = URL.createObjectURL(blob);
      // Decode the new image off-screen so the <img> swap never shows a blank frame
      await this.preloadImage(url);

      if (token !== this.processToken) {
        URL.revokeObjectURL(url);
        return;
      }

      // Assign the new URL before revoking the old one to avoid a blank frame
      const prev = this.resultUrl();
      this.resultUrl.set(url);
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      this.state.set('done');
    } catch {
      if (token !== this.processToken) return;
      this.errorMessage.set('Une erreur est survenue lors du traitement.');
      this.state.set('error');
    } finally {
      if (token === this.processToken) {
        this.isUpdating.set(false);
      }
    }
  }

  protected onOpacityChange(value: number): void {
    this.opacity.set(value);
    this.scheduleReprocess();
  }

  protected onColorChange(value: string): void {
    this.color.set(value);
    this.scheduleReprocess();
  }

  private scheduleReprocess(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.processWatermark();
    }, DEBOUNCE_MS);
  }

  private preloadImage(url: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    });
  }

  protected download(): void {
    const url = this.resultUrl();
    if (!url) return;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${this.originalFileName()}_filigrane.jpg`;
    anchor.click();
  }

  protected reset(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.revokeObjectUrls();
    this.originalFile.set(null);
    this.originalFileName.set('');
    this.watermarkText.set('');
    this.errorMessage.set('');
    this.opacity.set(0.45);
    this.color.set(DEFAULT_COLOR);
    this.isUpdating.set(false);
    this.processToken++;
    this.state.set('idle');
  }

  private revokeObjectUrls(): void {
    const preview = this.previewUrl();
    const result = this.resultUrl();
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    if (result) {
      URL.revokeObjectURL(result);
    }
    this.previewUrl.set(null);
    this.resultUrl.set(null);
  }
}
