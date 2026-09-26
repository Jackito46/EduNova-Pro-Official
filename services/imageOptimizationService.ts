/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Service universel d'optimisation et de compression d'images avant envoi sur le serveur / bucket.
 * Garantit un redimensionnement strict et une compression WebP à taille minimale pour ne jamais
 * alourdir les buckets de stockage Supabase ou la base de données.
 */

export interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (recommandé: 0.80)
  targetFormat?: 'image/webp' | 'image/jpeg' | 'image/png';
  maxSizeBytes?: number; // Taille cible maximale recommandée (ex: 50 Ko)
}

export interface OptimizedImageResult {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  savingsPercent: number;
  mimeType: string;
  extension: 'webp' | 'jpg' | 'png';
}

export class ImageOptimizationService {
  public static readonly DEFAULT_LOGO_MAX_WIDTH = 256;
  public static readonly DEFAULT_LOGO_MAX_HEIGHT = 256;
  public static readonly DEFAULT_QUALITY = 0.80;
  public static readonly TARGET_MAX_SIZE_BYTES = 50 * 1024; // 50 Ko max

  /**
   * Formate une taille en octets en chaîne lisible (Ko / Mo)
   */
  public static formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 o';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  }

  /**
   * Compresse et redimensionne n'importe quelle source d'image (File, Blob, DataURL ou URL)
   * à des dimensions contrôlées et en format ultra-léger (WebP optimisé).
   */
  public static async optimizeImage(
    source: File | Blob | string,
    options: ImageOptimizationOptions = {}
  ): Promise<OptimizedImageResult> {
    const maxWidth = options.maxWidth || this.DEFAULT_LOGO_MAX_WIDTH;
    const maxHeight = options.maxHeight || this.DEFAULT_LOGO_MAX_HEIGHT;
    const initialQuality = options.quality ?? this.DEFAULT_QUALITY;
    const targetFormat = options.targetFormat || 'image/webp';
    const targetMaxBytes = options.maxSizeBytes || this.TARGET_MAX_SIZE_BYTES;

    // 1. Déterminer la taille d'origine
    let originalSizeBytes = 0;
    if (source instanceof Blob) {
      originalSizeBytes = source.size;
    } else if (typeof source === 'string') {
      if (source.startsWith('data:')) {
        originalSizeBytes = Math.round((source.length * 3) / 4);
      } else {
        originalSizeBytes = 0;
      }
    }

    // 2. Charger l'image dans un élément HTML Image
    const img = await this.loadImage(source);

    // 3. Calculer les dimensions proportionnelles
    let { width, height } = this.calculateDimensions(img.width, img.height, maxWidth, maxHeight);

    // 4. Dessiner sur un Canvas pour le rééchantillonnage haute fidélité
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { alpha: true });

    if (!ctx) {
      throw new Error("Impossible d'initialiser le contexte de rendu 2D pour la compression d'image.");
    }

    // Lissage haute qualité
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // 5. Compression adaptative (premier essai)
    let currentQuality = initialQuality;
    let blob = await this.canvasToBlob(canvas, targetFormat, currentQuality);

    // Si le format demandé est le WebP mais que le navigateur ne le supporte pas dans toBlob,
    // repli automatique sur JPEG
    let effectiveMime = blob.type;
    let ext: 'webp' | 'jpg' | 'png' = 'webp';

    if (!effectiveMime.includes('webp')) {
      if (effectiveMime.includes('png')) ext = 'png';
      else ext = 'jpg';
    }

    // 6. Si le fichier dépasse encore la taille cible recommandée et que la qualité peut être ajustée,
    // faire une passe adaptative supplémentaire
    if (blob.size > targetMaxBytes && currentQuality > 0.55) {
      currentQuality = 0.65;
      const secondBlob = await this.canvasToBlob(canvas, targetFormat, currentQuality);
      if (secondBlob.size < blob.size) {
        blob = secondBlob;
      }
    }

    // 7. Générer un dataUrl optimisé
    const dataUrl = canvas.toDataURL(targetFormat, currentQuality);
    const compressedSizeBytes = blob.size;

    const savingsPercent = originalSizeBytes > 0 
      ? Math.max(0, Math.round(((originalSizeBytes - compressedSizeBytes) / originalSizeBytes) * 100))
      : 0;

    return {
      blob,
      dataUrl,
      width,
      height,
      originalSizeBytes,
      compressedSizeBytes,
      savingsPercent,
      mimeType: blob.type,
      extension: ext
    };
  }

  /**
   * Calcule les dimensions en conservant strictement le ratio d'aspect
   */
  private static calculateDimensions(
    srcWidth: number, 
    srcHeight: number, 
    maxWidth: number, 
    maxHeight: number
  ): { width: number; height: number } {
    let width = srcWidth;
    let height = srcHeight;

    if (width > height) {
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }
    } else {
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height);
        height = maxHeight;
      }
    }

    // Garder des dimensions minimales positives
    width = Math.max(1, width);
    height = Math.max(1, height);

    return { width, height };
  }

  /**
   * Charge une image de manière asynchrone
   */
  private static loadImage(source: File | Blob | string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        resolve(img);
      };

      img.onerror = (err) => {
        reject(new Error("Impossible de décoder ou charger le fichier image sélectionné."));
      };

      if (source instanceof Blob) {
        const objectUrl = URL.createObjectURL(source);
        img.onload = () => {
          URL.revokeObjectURL(objectUrl);
          resolve(img);
        };
        img.src = objectUrl;
      } else if (typeof source === 'string') {
        img.src = source;
      } else {
        reject(new Error("Source d'image non valide."));
      }
    });
  }

  /**
   * Convertit un canvas HTML en Blob de façon asynchrone
   */
  private static canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Fallback base64 -> blob
            try {
              const dataUrl = canvas.toDataURL(mimeType, quality);
              const byteString = atob(dataUrl.split(',')[1]);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              resolve(new Blob([ab], { type: mimeType }));
            } catch (err) {
              reject(err);
            }
          }
        },
        mimeType,
        quality
      );
    });
  }
}
