/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, supabaseUrl } from '../supabase';
import { ImageOptimizationService, OptimizedImageResult } from './imageOptimizationService';

export interface LogoMigrationReport {
  success: boolean;
  totalSchools: number;
  migratedSchools: number;
  totalCampuses: number;
  migratedCampuses: number;
  bytesSaved: number;
  details: Array<{
    id: string;
    name: string;
    type: 'school' | 'campus';
    previousType: 'base64' | 'url' | 'empty';
    newUrl: string | null;
    bytesSaved: number;
    status: 'migrated' | 'already_optimized' | 'skipped' | 'error';
    error?: string;
  }>;
}

export class LogoStorageMigrationService {
  private static STORAGE_BUCKET = 'database_backups';
  private static FOLDER = 'school_logos';

  /**
   * Assure la disponibilité publique du bucket de stockage pour les assets d'établissements.
   */
  public static async ensureStorageReady(): Promise<boolean> {
    try {
      // 1. Assurer que database_backups est public
      await supabase.rpc('exec_ddl', { 
        ddl_query: `UPDATE storage.buckets SET public = true WHERE id = '${this.STORAGE_BUCKET}';` 
      });

      // 2. Assurer que la colonne logo_url existe sur school_campuses pour les annexes
      await supabase.rpc('exec_ddl', { 
        ddl_query: `ALTER TABLE public.school_campuses ADD COLUMN IF NOT EXISTS logo_url TEXT;` 
      });

      return true;
    } catch (err) {
      console.warn('[LogoMigration] Impossible de forcer exec_ddl sur storage.buckets:', err);
      return false;
    }
  }

  /**
   * Téléverse un buffer ou Blob dans Supabase Storage et retourne l'URL publique permanente.
   * Compresse et redimensionne systématiquement l'image au format WebP ultra-léger avant envoi.
   */
  public static async uploadLogoBlob(
    targetId: string, 
    fileOrBlobOrString: Blob | File | string, 
    fileNamePrefix: string = 'school'
  ): Promise<{ 
    success: boolean; 
    publicUrl?: string; 
    error?: string;
    optimization?: OptimizedImageResult;
  }> {
    try {
      await this.ensureStorageReady();

      // Redimensionnement et compression systématique côté client avant envoi sur le bucket
      const optResult = await ImageOptimizationService.optimizeImage(fileOrBlobOrString, {
        maxWidth: ImageOptimizationService.DEFAULT_LOGO_MAX_WIDTH,
        maxHeight: ImageOptimizationService.DEFAULT_LOGO_MAX_HEIGHT,
        quality: ImageOptimizationService.DEFAULT_QUALITY,
        targetFormat: 'image/webp'
      });

      const filePath = `${this.FOLDER}/${fileNamePrefix}_${targetId}_${Date.now()}.${optResult.extension}`;

      const { error: uploadError } = await supabase.storage
        .from(this.STORAGE_BUCKET)
        .upload(filePath, optResult.blob, {
          contentType: optResult.mimeType,
          upsert: true
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: pubData } = supabase.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(filePath);

      const publicUrl = pubData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/${this.STORAGE_BUCKET}/${filePath}`;
      return { 
        success: true, 
        publicUrl,
        optimization: optResult
      };
    } catch (err: any) {
      console.error('[LogoMigration] Erreur uploadLogoBlob:', err);
      return { success: false, error: err.message || 'Erreur inconnue upload storage' };
    }
  }

  /**
   * Convertit une chaîne Base64 en Blob binaire
   */
  public static base64ToBlob(base64Data: string): { blob: Blob; mime: string; ext: string } | null {
    try {
      const matches = base64Data.match(/^data:([A-Za-z-+\\/]+);base64,(.+)$/);
      if (!matches) return null;

      const mime = matches[1];
      const base64Content = matches[2];
      const byteCharacters = atob(base64Content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mime });
      const ext = mime.includes('png') ? 'png' : mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'webp';

      return { blob, mime, ext };
    } catch (err) {
      console.error('[LogoMigration] Erreur décodage base64:', err);
      return null;
    }
  }

  /**
   * Migre tous les logos Base64 de la base de données vers Supabase Storage
   * (Pour toutes les écoles du système Multi-Tenant et leurs annexes).
   */
  public static async migrateAllLogosToStorage(): Promise<LogoMigrationReport> {
    await this.ensureStorageReady();

    const report: LogoMigrationReport = {
      success: true,
      totalSchools: 0,
      migratedSchools: 0,
      totalCampuses: 0,
      migratedCampuses: 0,
      bytesSaved: 0,
      details: []
    };

    try {
      // 1. Récupération de tous les établissements
      const { data: schoolsData, error: schoolsError } = await supabase.rpc('exec_sql', {
        sql_query: "SELECT id, name, logo_url FROM schools;"
      });

      const schools = Array.isArray(schoolsData) ? schoolsData : [];
      report.totalSchools = schools.length;

      for (const school of schools) {
        const logoUrl = school.logo_url;
        const isBase64 = typeof logoUrl === 'string' && logoUrl.startsWith('data:image/');

        if (!logoUrl) {
          report.details.push({
            id: school.id,
            name: school.name || 'Établissement sans nom',
            type: 'school',
            previousType: 'empty',
            newUrl: null,
            bytesSaved: 0,
            status: 'skipped'
          });
          continue;
        }

        if (!isBase64) {
          report.details.push({
            id: school.id,
            name: school.name || 'Établissement sans nom',
            type: 'school',
            previousType: 'url',
            newUrl: logoUrl,
            bytesSaved: 0,
            status: 'already_optimized'
          });
          continue;
        }

        // Conversion, redimensionnement et compression WebP avant upload sur Supabase Storage
        let uploadBlob: Blob;
        let uploadMime = 'image/webp';
        let uploadExt: 'webp' | 'jpg' | 'png' = 'webp';

        try {
          const opt = await ImageOptimizationService.optimizeImage(logoUrl, {
            maxWidth: ImageOptimizationService.DEFAULT_LOGO_MAX_WIDTH,
            maxHeight: ImageOptimizationService.DEFAULT_LOGO_MAX_HEIGHT,
            quality: ImageOptimizationService.DEFAULT_QUALITY,
            targetFormat: 'image/webp'
          });
          uploadBlob = opt.blob;
          uploadMime = opt.mimeType;
          uploadExt = opt.extension;
        } catch (compErr) {
          const parsed = this.base64ToBlob(logoUrl);
          if (!parsed) {
            report.details.push({
              id: school.id,
              name: school.name,
              type: 'school',
              previousType: 'base64',
              newUrl: null,
              bytesSaved: 0,
              status: 'error',
              error: 'Base64 corrompu ou format image invalide'
            });
            continue;
          }
          uploadBlob = parsed.blob;
          uploadMime = parsed.mime;
          uploadExt = parsed.ext as any;
        }

        const filePath = `${this.FOLDER}/${school.id}.${uploadExt}`;
        const { error: uploadErr } = await supabase.storage
          .from(this.STORAGE_BUCKET)
          .upload(filePath, uploadBlob, {
            contentType: uploadMime,
            upsert: true
          });

        if (uploadErr) {
          report.details.push({
            id: school.id,
            name: school.name,
            type: 'school',
            previousType: 'base64',
            newUrl: null,
            bytesSaved: 0,
            status: 'error',
            error: uploadErr.message
          });
          continue;
        }

        const { data: pubData } = supabase.storage
          .from(this.STORAGE_BUCKET)
          .getPublicUrl(filePath);

        const publicUrl = pubData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/${this.STORAGE_BUCKET}/${filePath}`;
        
        // Mise à jour sécurisée dans PostgreSQL
        const escapedUrl = publicUrl.replace(/'/g, "''");
        await supabase.rpc('exec_ddl', {
          ddl_query: `UPDATE schools SET logo_url = '${escapedUrl}' WHERE id = '${school.id}';`
        });

        const saved = logoUrl.length - publicUrl.length;
        report.migratedSchools++;
        report.bytesSaved += saved;

        // Mise à jour du cache local si disponible
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            localStorage.setItem(`school_logo_${school.id}`, publicUrl);
          }
        } catch (e) {}

        report.details.push({
          id: school.id,
          name: school.name,
          type: 'school',
          previousType: 'base64',
          newUrl: publicUrl,
          bytesSaved: saved,
          status: 'migrated'
        });
      }

      // 2. Traitement des campus / annexes (school_campuses)
      try {
        const { data: campusesData } = await supabase.rpc('exec_sql', {
          sql_query: "SELECT id, school_id, name, logo_url FROM school_campuses;"
        });

        const campuses = Array.isArray(campusesData) ? campusesData : [];
        report.totalCampuses = campuses.length;

        for (const campus of campuses) {
          const cLogo = campus.logo_url;
          if (cLogo && typeof cLogo === 'string' && cLogo.startsWith('data:image/')) {
            let cBlob: Blob;
            let cMime = 'image/webp';
            let cExt: 'webp' | 'jpg' | 'png' = 'webp';

            try {
              const opt = await ImageOptimizationService.optimizeImage(cLogo, {
                maxWidth: ImageOptimizationService.DEFAULT_LOGO_MAX_WIDTH,
                maxHeight: ImageOptimizationService.DEFAULT_LOGO_MAX_HEIGHT,
                quality: ImageOptimizationService.DEFAULT_QUALITY,
                targetFormat: 'image/webp'
              });
              cBlob = opt.blob;
              cMime = opt.mimeType;
              cExt = opt.extension;
            } catch (e) {
              const parsed = this.base64ToBlob(cLogo);
              if (!parsed) continue;
              cBlob = parsed.blob;
              cMime = parsed.mime;
              cExt = parsed.ext as any;
            }

            const filePath = `${this.FOLDER}/campus_${campus.id}.${cExt}`;
            await supabase.storage
              .from(this.STORAGE_BUCKET)
              .upload(filePath, cBlob, { contentType: cMime, upsert: true });

              const { data: pubData } = supabase.storage
                .from(this.STORAGE_BUCKET)
                .getPublicUrl(filePath);

              const publicUrl = pubData?.publicUrl || `${supabaseUrl}/storage/v1/object/public/${this.STORAGE_BUCKET}/${filePath}`;
              const escapedUrl = publicUrl.replace(/'/g, "''");
              await supabase.rpc('exec_ddl', {
                ddl_query: `UPDATE school_campuses SET logo_url = '${escapedUrl}' WHERE id = '${campus.id}';`
              });

              const saved = cLogo.length - publicUrl.length;
              report.migratedCampuses++;
              report.bytesSaved += saved;

              report.details.push({
                id: campus.id,
                name: campus.name,
                type: 'campus',
                previousType: 'base64',
                newUrl: publicUrl,
                bytesSaved: saved,
                status: 'migrated'
              });
            }
          }
      } catch (cErr) {
        console.warn('[LogoMigration] Aucun traitement annexe requis ou table non initialisée:', cErr);
      }

    } catch (globalErr: any) {
      console.error('[LogoMigration] Erreur globale migration:', globalErr);
      report.success = false;
    }

    return report;
  }
}
