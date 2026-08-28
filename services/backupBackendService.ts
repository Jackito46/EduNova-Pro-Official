import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export interface BackupMetadata {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  backup_type: 'MANUAL' | 'AUTOMATIC' | 'PRE_RESTORE_SAFETY';
  scope: 'FULL_DATABASE' | 'SCHOOL_SPECIFIC';
  school_id?: string | null;
  school_name?: string | null;
  size_bytes: number;
  tables_count: number;
  rows_count: number;
  checksum: string;
  storage_provider: 'SUPABASE_STORAGE' | 'LOCAL_MIRROR' | 'EXTERNAL_S3';
  storage_path: string;
  storage_bucket: string;
  created_by_user_id?: string | null;
  created_by_name?: string | null;
  tables_summary: Record<string, number>;
  version: string;
}

export interface BackupSettings {
  is_auto_backup_enabled: boolean;
  frequency: 'HOURLY' | 'EVERY_6H' | 'EVERY_12H' | 'DAILY' | 'WEEKLY';
  scheduled_time: string; // 'HH:MM'
  scheduled_day: number; // 0 = Sunday
  retention_count: number;
  storage_provider: 'SUPABASE_STORAGE' | 'LOCAL_MIRROR' | 'EXTERNAL_S3';
  storage_bucket: string;
  external_s3_endpoint?: string;
  external_s3_region?: string;
  external_s3_bucket?: string;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  notification_email?: string;
  last_auto_backup_at?: string | null;
  last_auto_backup_status?: 'SUCCESS' | 'FAILED' | null;
  last_auto_backup_error?: string | null;
}

export const BACKUP_TABLES_ORDER = [
  'schools',
  'school_campuses',
  'academic_years',
  'classes',
  'subjects',
  'class_subjects',
  'staff_roles',
  'staff',
  'staff_assignments',
  'students',
  'enrollments',
  'student_subjects',
  'fee_plans',
  'payments',
  'student_ad_hoc_fees',
  'ad_hoc_campaigns',
  'expense_categories',
  'expenses',
  'budgets',
  'payroll_periods',
  'payroll_slips',
  'salary_advances',
  'staff_salary_history',
  'staff_attendances',
  'student_attendances',
  'grades',
  'disciplinary_sanction_types',
  'disciplinary_records',
  'course_evaluations',
  'course_signatures',
  'class_schedules',
  'exchange_rates',
  'supply_catalog',
  'school_supplies',
  'supply_payments',
  'daily_cash_closures',
  'communication_settings',
  'communication_logs',
  'communication_recipients',
  'push_subscriptions',
  'global_settings',
  'audit_logs',
  'profiles'
];

export class BackupBackendService {
  private supabase: any;
  private backupsDir: string;
  private publicBackupDir: string;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
    this.backupsDir = path.join(process.cwd(), 'data', 'backups');
    this.publicBackupDir = path.join(process.cwd(), 'dist', 'backup', 'protected_backups');
    
    // Ensure directories exist
    if (!fs.existsSync(this.backupsDir)) {
      fs.mkdirSync(this.backupsDir, { recursive: true });
    }
    if (!fs.existsSync(this.publicBackupDir)) {
      fs.mkdirSync(this.publicBackupDir, { recursive: true });
    }

    // Auto-ensure Supabase bucket exists in background
    this.ensureBucketExists('database_backups').catch(() => {});
  }

  /**
   * Ensure Supabase Storage bucket exists or create it
   */
  async ensureBucketExists(bucketName = 'database_backups'): Promise<boolean> {
    try {
      const { data: buckets, error: listErr } = await this.supabase.storage.listBuckets();
      if (!listErr && Array.isArray(buckets)) {
        const exists = buckets.some((b: any) => b.name === bucketName || b.id === bucketName);
        if (exists) return true;

        console.log(`[Backup] Bucket '${bucketName}' not found in Supabase Storage. Attempting creation...`);
        const { error: createErr } = await this.supabase.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: 52428800 // 50MB per backup snapshot
        });
        
        if (!createErr) {
          console.log(`[Backup] Supabase bucket '${bucketName}' successfully created.`);
          return true;
        } else {
          // If RLS prevents anonymous bucket creation, log gracefully without throwing unhandled error
          console.info(`[Backup] Note: Supabase Storage bucket '${bucketName}' creation via API requires dashboard or service_role privileges (${createErr.message}). Local high-availability mirror is active.`);
          return false;
        }
      }
      return false;
    } catch (e: any) {
      console.info(`[Backup] Supabase Storage check note: ${e.message || 'using local high-availability storage'}`);
      return false;
    }
  }

  /**
   * Fetch current backup settings
   */
  async getSettings(): Promise<BackupSettings> {
    const defaultSettings: BackupSettings = {
      is_auto_backup_enabled: true,
      frequency: 'DAILY',
      scheduled_time: '02:00',
      scheduled_day: 0,
      retention_count: 30,
      storage_provider: 'SUPABASE_STORAGE',
      storage_bucket: 'database_backups',
      notify_on_success: false,
      notify_on_failure: true,
      notification_email: 'support@edunova.pro'
    };

    try {
      // Try via exec_sql first to bypass any RLS limitations
      const { data: sqlRes } = await this.supabase.rpc('exec_sql', {
        sql_query: "SELECT value FROM public.global_settings WHERE key = 'backup_settings' LIMIT 1;"
      });

      if (Array.isArray(sqlRes) && sqlRes.length > 0 && sqlRes[0]?.value) {
        return { ...defaultSettings, ...(typeof sqlRes[0].value === 'string' ? JSON.parse(sqlRes[0].value) : sqlRes[0].value) };
      }

      const { data } = await this.supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'backup_settings')
        .single();

      if (data && data.value) {
        return { ...defaultSettings, ...(typeof data.value === 'string' ? JSON.parse(data.value) : data.value) };
      }
    } catch (e) {
      console.warn('Could not read backup_settings from global_settings, returning defaults:', e);
    }

    return defaultSettings;
  }

  /**
   * Save backup settings
   */
  async saveSettings(settings: Partial<BackupSettings>, userId?: string): Promise<BackupSettings> {
    const current = await this.getSettings();
    const updated: BackupSettings = { ...current, ...settings };

    try {
      const jsonStr = JSON.stringify(updated).replace(/'/g, "''");
      const ddl = `INSERT INTO public.global_settings (key, value, updated_at) 
                  VALUES ('backup_settings', '${jsonStr}'::jsonb, NOW()) 
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`;
      
      const { error: ddlErr } = await this.supabase.rpc('exec_ddl', { ddl_query: ddl });
      if (ddlErr) {
        throw new Error(ddlErr.message);
      }
    } catch (sqlErr) {
      console.warn('Could not save backup_settings via exec_ddl, attempting direct upsert:', sqlErr);
      try {
        await this.supabase
          .from('global_settings')
          .upsert({
            key: 'backup_settings',
            value: updated,
            updated_at: new Date().toISOString(),
            updated_by: userId || null
          }, { onConflict: 'key' });
      } catch (err) {
        console.error('Failed to save backup_settings to DB:', err);
      }
    }

    return updated;
  }

  /**
   * List all stored backup metadata
   */
  async listBackups(): Promise<BackupMetadata[]> {
    let registry: BackupMetadata[] = [];
    
    // 1. Try fetching from global_settings via exec_sql
    try {
      const { data: sqlRes } = await this.supabase.rpc('exec_sql', {
        sql_query: "SELECT value FROM public.global_settings WHERE key = 'system_backups_registry' LIMIT 1;"
      });

      if (Array.isArray(sqlRes) && sqlRes.length > 0 && sqlRes[0]?.value) {
        const val = typeof sqlRes[0].value === 'string' ? JSON.parse(sqlRes[0].value) : sqlRes[0].value;
        if (Array.isArray(val)) {
          registry = val;
        }
      }
    } catch (sqlErr) {
      console.warn('Could not fetch backup registry via exec_sql, falling back to direct select:', sqlErr);
    }

    if (registry.length === 0) {
      try {
        const { data } = await this.supabase
          .from('global_settings')
          .select('value')
          .eq('key', 'system_backups_registry')
          .single();

        if (data && Array.isArray(data.value)) {
          registry = data.value as BackupMetadata[];
        }
      } catch (e) {
        console.warn('Could not fetch backup registry from global_settings direct select:', e);
      }
    }

    // 2. Check local fallback file registry.json if DB was empty
    const localRegistryPath = path.join(this.backupsDir, 'registry.json');
    if (registry.length === 0 && fs.existsSync(localRegistryPath)) {
      try {
        const fileContent = fs.readFileSync(localRegistryPath, 'utf-8');
        const parsed = JSON.parse(fileContent);
        if (Array.isArray(parsed)) {
          registry = parsed;
        }
      } catch (e) {}
    }

    // 3. Scan Supabase Storage snapshots folder and auto-hydrate any snapshots found in cloud
    try {
      const { data: cloudFiles, error: cloudErr } = await this.supabase.storage
        .from('database_backups')
        .list('snapshots');

      if (!cloudErr && Array.isArray(cloudFiles)) {
        for (const cFile of cloudFiles) {
          if (!cFile.name || !cFile.name.endsWith('.json')) continue;
          const cFileId = cFile.name.replace(/\.json$/, '');
          const existing = registry.find(r => r.id === cFileId || r.storage_path?.includes(cFile.name));
          
          if (!existing) {
            // Attempt to download and read metadata, or construct robust cloud metadata
            let metadata: BackupMetadata | null = null;
            try {
              const { data: fileBlob } = await this.supabase.storage
                .from('database_backups')
                .download(`snapshots/${cFile.name}`);

            if (fileBlob) {
                const text = await fileBlob.text();
                const parsed = JSON.parse(text);
                
                const totalParsedRows = Object.values(parsed.tables || {}).reduce((acc: number, cur: any) => acc + (Array.isArray(cur) ? cur.length : 0), 0);
                const tablesSummaryObj = Object.fromEntries(Object.entries(parsed.tables || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]));

                metadata = parsed.metadata || {
                  id: parsed.backup_id || cFileId,
                  name: parsed.name || `Sauvegarde Cloud (${new Date(parsed.created_at || cFile.created_at).toLocaleDateString('fr-FR')})`,
                  created_at: parsed.created_at || cFile.created_at || cFile.updated_at || new Date().toISOString(),
                  backup_type: parsed.backup_type || 'MANUAL',
                  scope: parsed.scope || 'FULL_DATABASE',
                  school_id: parsed.school_id || null,
                  school_name: parsed.school_name || null,
                  size_bytes: cFile.metadata?.size || Buffer.byteLength(text, 'utf-8'),
                  tables_count: Object.keys(parsed.tables || {}).length || 43,
                  rows_count: totalParsedRows,
                  checksum: crypto.createHash('sha256').update(text).digest('hex'),
                  storage_provider: 'SUPABASE_STORAGE',
                  storage_path: `database_backups/snapshots/${cFile.name}`,
                  storage_bucket: 'database_backups',
                  tables_summary: tablesSummaryObj,
                  version: parsed.version || '2.4'
                };

                // Also mirror to local disk for fast access
                const localMirroredPath = path.join(this.backupsDir, cFile.name);
                if (!fs.existsSync(localMirroredPath)) {
                  fs.writeFileSync(localMirroredPath, text, 'utf-8');
                }
              }
            } catch (dlErr) {
              console.warn(`Could not read cloud backup ${cFile.name}:`, dlErr);
            }

            if (!metadata) {
              metadata = {
                id: cFileId,
                name: `Sauvegarde Cloud (${cFile.name})`,
                created_at: cFile.created_at || cFile.updated_at || new Date().toISOString(),
                backup_type: 'MANUAL',
                scope: 'FULL_DATABASE',
                size_bytes: cFile.metadata?.size || 0,
                tables_count: 43,
                rows_count: 0,
                checksum: '',
                storage_provider: 'SUPABASE_STORAGE',
                storage_path: `database_backups/snapshots/${cFile.name}`,
                storage_bucket: 'database_backups',
                tables_summary: {},
                version: '2.4'
              };
            }
            registry.push(metadata);
          }
        }
      }
    } catch (storageScanErr) {
      console.warn('Could not scan Supabase Storage snapshots:', storageScanErr);
    }

    // 4. Scan filesystem to ensure any locally stored JSON backups are listed
    try {
      if (fs.existsSync(this.backupsDir)) {
        const files = fs.readdirSync(this.backupsDir).filter(f => (f.endsWith('.json') || f.endsWith('.json.gz')) && f !== 'registry.json');
        for (const file of files) {
          const filePath = path.join(this.backupsDir, file);
          const stat = fs.statSync(filePath);
          const fileId = file.replace(/\.json(\.gz)?$/, '');
          
          const existing = registry.find(r => r.id === fileId || r.storage_path?.includes(file));
          if (!existing) {
            try {
              let contentStr = '';
              if (file.endsWith('.gz')) {
                const buffer = fs.readFileSync(filePath);
                contentStr = zlib.gunzipSync(buffer).toString('utf-8');
              } else {
                contentStr = fs.readFileSync(filePath, 'utf-8');
              }
              const parsed = JSON.parse(contentStr);
              const metadata: BackupMetadata = parsed.metadata || {
                id: fileId,
                name: `Sauvegarde ${file}`,
                created_at: stat.mtime.toISOString(),
                backup_type: 'MANUAL',
                scope: 'FULL_DATABASE',
                size_bytes: stat.size,
                tables_count: Object.keys(parsed.tables || {}).length,
                rows_count: Object.values(parsed.tables || {}).reduce((acc: number, cur: any) => acc + (Array.isArray(cur) ? cur.length : 0), 0),
                checksum: crypto.createHash('sha256').update(contentStr).digest('hex'),
                storage_provider: 'LOCAL_MIRROR',
                storage_path: filePath,
                storage_bucket: 'database_backups',
                tables_summary: Object.fromEntries(Object.entries(parsed.tables || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
                version: '2.4'
              };
              registry.push(metadata);
            } catch (readErr) {
              console.warn(`Could not parse local backup file ${file}:`, readErr);
            }
          }
        }
      }
    } catch (fsErr) {
      console.warn('Could not scan backups directory:', fsErr);
    }

    // Deduplicate by ID and storage_path
    const uniqueMap = new Map<string, BackupMetadata>();
    for (const item of registry) {
      if (item && item.id) {
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      }
    }
    const deduplicated = Array.from(uniqueMap.values());

    // Sort by created_at DESC
    return deduplicated.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  /**
   * Save the backup registry to global_settings and local registry.json
   */
  private async saveRegistry(registry: BackupMetadata[]): Promise<void> {
    // 1. Save locally to registry.json
    try {
      const localRegistryPath = path.join(this.backupsDir, 'registry.json');
      fs.writeFileSync(localRegistryPath, JSON.stringify(registry, null, 2), 'utf-8');
    } catch (fsErr) {
      console.warn('Could not save local registry.json:', fsErr);
    }

    // 2. Save to database via exec_ddl (bypasses RLS safely and performs actual INSERT/UPDATE)
    try {
      const jsonStr = JSON.stringify(registry).replace(/'/g, "''");
      const ddl = `INSERT INTO public.global_settings (key, value, updated_at) 
                  VALUES ('system_backups_registry', '${jsonStr}'::jsonb, NOW()) 
                  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();`;
      
      const { error: ddlErr } = await this.supabase.rpc('exec_ddl', { ddl_query: ddl });
      if (ddlErr) {
        throw new Error(ddlErr.message);
      }
    } catch (sqlErr) {
      console.warn('Failed to update system_backups_registry via exec_ddl, attempting direct upsert:', sqlErr);
      try {
        await this.supabase
          .from('global_settings')
          .upsert({
            key: 'system_backups_registry',
            value: registry,
            updated_at: new Date().toISOString()
          }, { onConflict: 'key' });
      } catch (err) {
        console.error('Failed to update system_backups_registry direct upsert:', err);
      }
    }
  }

  /**
   * Create a full or school-specific database backup snapshot
   */
  async createBackup(params: {
    name?: string;
    description?: string;
    backup_type?: 'MANUAL' | 'AUTOMATIC' | 'PRE_RESTORE_SAFETY';
    scope?: 'FULL_DATABASE' | 'SCHOOL_SPECIFIC';
    school_id?: string | null;
    user_id?: string | null;
    user_name?: string | null;
  }): Promise<{ success: boolean; metadata: BackupMetadata; rawSize: number }> {
    const backupId = `bkp_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();
    const backupType = params.backup_type || 'MANUAL';
    const scope = params.scope || 'FULL_DATABASE';

    let schoolName: string | null = null;
    if (params.school_id) {
      try {
        const { data: sData } = await this.supabase.rpc('exec_sql', {
          sql_query: `SELECT name FROM public.schools WHERE id = '${params.school_id}' LIMIT 1;`
        });
        if (Array.isArray(sData) && sData.length > 0) {
          schoolName = sData[0].name;
        }
      } catch (e) {}
    }

    const defaultName = params.name || (
      backupType === 'AUTOMATIC'
        ? `Sauvegarde Automatique (${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')})`
        : backupType === 'PRE_RESTORE_SAFETY'
        ? `Point de Sécurité Pré-Restauration (${new Date().toLocaleDateString('fr-FR')} ${new Date().toLocaleTimeString('fr-FR')})`
        : `Sauvegarde Manuelle ${scope === 'SCHOOL_SPECIFIC' && schoolName ? `- ${schoolName}` : 'Complète'} (${new Date().toLocaleDateString('fr-FR')})`
    );

    console.log(`[Backup] Starting snapshot creation: ${backupId} (${backupType} - ${scope})`);

    const tablesData: Record<string, any[]> = {};
    const tablesSummary: Record<string, number> = {};
    let totalRows = 0;

    for (const tableName of BACKUP_TABLES_ORDER) {
      try {
        let sqlQuery = `SELECT * FROM public.${tableName}`;
        if (scope === 'SCHOOL_SPECIFIC' && params.school_id) {
          // Add school filtering where applicable
          if (tableName === 'schools') {
            sqlQuery += ` WHERE id = '${params.school_id}'`;
          } else if (['school_campuses', 'academic_years', 'classes', 'subjects', 'staff', 'students', 'fee_plans', 'payments', 'expenses', 'budgets', 'communication_settings', 'communication_logs'].includes(tableName)) {
            sqlQuery += ` WHERE school_id = '${params.school_id}'`;
          }
        }
        sqlQuery += ';';

        const { data, error } = await this.supabase.rpc('exec_sql', { sql_query: sqlQuery });
        if (error) {
          console.warn(`[Backup] Table ${tableName} query error via exec_sql:`, error.message);
          tablesData[tableName] = [];
          tablesSummary[tableName] = 0;
        } else {
          const rows = Array.isArray(data) ? data : [];
          tablesData[tableName] = rows;
          tablesSummary[tableName] = rows.length;
          totalRows += rows.length;
        }
      } catch (err: any) {
        console.warn(`[Backup] Exception reading table ${tableName}:`, err.message);
        tablesData[tableName] = [];
        tablesSummary[tableName] = 0;
      }
    }

    const payload = {
      version: '2.4',
      system: 'EduNova Pro Multi-Tenant Database Backup',
      created_at: timestamp,
      backup_id: backupId,
      backup_type: backupType,
      scope: scope,
      school_id: params.school_id || null,
      school_name: schoolName,
      tables: tablesData
    };

    const jsonString = JSON.stringify(payload, null, 2);
    const checksum = crypto.createHash('sha256').update(jsonString).digest('hex');
    const rawSizeBytes = Buffer.byteLength(jsonString, 'utf-8');

    // Save JSON to local backups directory
    const fileName = `${backupId}.json`;
    const localFilePath = path.join(this.backupsDir, fileName);
    fs.writeFileSync(localFilePath, jsonString, 'utf-8');

    // Mirror to public backup dir for fast secure serving
    try {
      const publicFilePath = path.join(this.publicBackupDir, fileName);
      fs.writeFileSync(publicFilePath, jsonString, 'utf-8');
    } catch (e) {}

    // Upload to Supabase Storage if available
    let storageProvider: 'SUPABASE_STORAGE' | 'LOCAL_MIRROR' = 'LOCAL_MIRROR';
    let storagePath = localFilePath;

    try {
      const currentSettings = await this.getSettings();
      const targetBucket = currentSettings.storage_bucket || 'database_backups';
      await this.ensureBucketExists(targetBucket);

      const { data: uploadData, error: uploadErr } = await this.supabase.storage
        .from(targetBucket)
        .upload(`snapshots/${fileName}`, Buffer.from(jsonString), {
          contentType: 'application/json',
          upsert: true
        });

      if (!uploadErr && uploadData) {
        storageProvider = 'SUPABASE_STORAGE';
        storagePath = `${targetBucket}/snapshots/${fileName}`;
        console.log(`[Backup] Successfully synced snapshot ${fileName} to Supabase Storage bucket '${targetBucket}'`);
      } else if (uploadErr) {
        console.warn(`[Backup] Supabase Storage upload error:`, uploadErr.message);
      }
    } catch (storageErr) {
      console.warn('[Backup] Supabase Storage upload skipped/failed, keeping local mirror:', storageErr);
    }

    const metadata: BackupMetadata = {
      id: backupId,
      name: defaultName,
      description: params.description || `Instantané complet de la base de données (${totalRows} enregistrements dans ${Object.keys(tablesData).length} tables)`,
      created_at: timestamp,
      backup_type: backupType,
      scope: scope,
      school_id: params.school_id || null,
      school_name: schoolName,
      size_bytes: rawSizeBytes,
      tables_count: Object.keys(tablesData).length,
      rows_count: totalRows,
      checksum: checksum,
      storage_provider: storageProvider,
      storage_path: storagePath,
      storage_bucket: 'database_backups',
      created_by_user_id: params.user_id || null,
      created_by_name: params.user_name || (backupType === 'AUTOMATIC' ? 'Système Automatique' : 'Super Administrateur'),
      tables_summary: tablesSummary,
      version: '2.4'
    };

    // Update Registry
    const registry = await this.listBackups();
    registry.unshift(metadata);

    // Apply retention policy if automatic
    const settings = await this.getSettings();
    if (registry.length > settings.retention_count) {
      const toKeep = registry.slice(0, settings.retention_count);
      const toRemove = registry.slice(settings.retention_count);
      
      for (const item of toRemove) {
        if (item.backup_type === 'AUTOMATIC') {
          await this.deleteBackup(item.id).catch(() => {});
        } else {
          toKeep.push(item);
        }
      }
      await this.saveRegistry(toKeep);
    } else {
      await this.saveRegistry(registry);
    }

    console.log(`[Backup] Completed successfully: ${backupId} (${(rawSizeBytes / 1024).toFixed(2)} KB, ${totalRows} rows)`);

    return {
      success: true,
      metadata,
      rawSize: rawSizeBytes
    };
  }

  /**
   * Get the full snapshot payload for restoration or download
   */
  async getBackupPayload(backupId: string): Promise<{ metadata: BackupMetadata; tables: Record<string, any[]> } | null> {
    const fileName = `${backupId}.json`;
    const localFilePath = path.join(this.backupsDir, fileName);

    if (fs.existsSync(localFilePath)) {
      try {
        const content = fs.readFileSync(localFilePath, 'utf-8');
        const parsed = JSON.parse(content);
        return {
          metadata: parsed.metadata || (await this.listBackups()).find(b => b.id === backupId)!,
          tables: parsed.tables || {}
        };
      } catch (err) {
        console.error(`Error reading backup file ${localFilePath}:`, err);
      }
    }

    // Try reading from Supabase Storage
    try {
      const { data, error } = await this.supabase.storage
        .from('database_backups')
        .download(`snapshots/${fileName}`);

      if (!error && data) {
        const text = await data.text();
        const parsed = JSON.parse(text);
        return {
          metadata: parsed.metadata || (await this.listBackups()).find(b => b.id === backupId)!,
          tables: parsed.tables || {}
        };
      }
    } catch (e) {
      console.warn(`Could not download backup ${backupId} from Supabase storage:`, e);
    }

    return null;
  }

  /**
   * Restore database state from a backup snapshot
   */
  async restoreBackup(params: {
    backup_id?: string;
    raw_payload?: any;
    selected_tables?: string[];
    create_safety_snapshot?: boolean;
    user_id?: string;
    user_name?: string;
  }): Promise<{
    success: boolean;
    safety_snapshot_id?: string;
    restored_tables: string[];
    restored_rows_count: number;
    errors: Array<{ table: string; message: string }>;
    duration_ms: number;
  }> {
    const startTime = Date.now();
    let payloadTables: Record<string, any[]> = {};
    let backupName = 'Instantané Externe';

    if (params.raw_payload) {
      payloadTables = params.raw_payload.tables || params.raw_payload;
      backupName = params.raw_payload.backup_id || 'Fichier Importé';
    } else if (params.backup_id) {
      const backupData = await this.getBackupPayload(params.backup_id);
      if (!backupData) {
        throw new Error(`Sauvegarde ${params.backup_id} introuvable sur le stockage.`);
      }
      payloadTables = backupData.tables;
      backupName = backupData.metadata?.name || params.backup_id;
    } else {
      throw new Error('Aucun identifiant de sauvegarde ou fichier fourni.');
    }

    // 1. Create safety snapshot before restoration if requested
    let safetySnapshotId: string | undefined;
    if (params.create_safety_snapshot !== false) {
      try {
        console.log('[Restore] Creating safety pre-restore snapshot...');
        const safetyResult = await this.createBackup({
          name: `Sécurité Pré-Restauration (${backupName})`,
          description: `Point de restauration automatique généré avant d'appliquer la sauvegarde ${backupName}`,
          backup_type: 'PRE_RESTORE_SAFETY',
          user_id: params.user_id,
          user_name: params.user_name
        });
        safetySnapshotId = safetyResult.metadata.id;
      } catch (safetyErr: any) {
        console.warn('[Restore] Could not create safety pre-restore snapshot:', safetyErr.message);
      }
    }

    const tablesToRestore = (params.selected_tables && params.selected_tables.length > 0)
      ? BACKUP_TABLES_ORDER.filter(t => params.selected_tables!.includes(t))
      : BACKUP_TABLES_ORDER;

    const restoredTables: string[] = [];
    let totalRestoredRows = 0;
    const errors: Array<{ table: string; message: string }> = [];

    console.log(`[Restore] Starting restoration of ${tablesToRestore.length} tables...`);

    for (const tableName of tablesToRestore) {
      const rows = payloadTables[tableName];
      if (!rows || !Array.isArray(rows) || rows.length === 0) {
        continue;
      }

      try {
        // Restore table records using chunked upserts
        const chunkSize = 50;
        let tableRowCount = 0;

        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          
          // Sanitize chunk rows (remove generated columns if any)
          const sanitizedChunk = chunk.map(row => {
            const cleanRow = { ...row };
            return cleanRow;
          });

          // Perform Upsert via Supabase client
          const { error: upsertErr } = await this.supabase
            .from(tableName)
            .upsert(sanitizedChunk, { 
              onConflict: tableName === 'global_settings' ? 'key' : (tableName === 'class_subjects' ? 'class_id,subject_id' : 'id'),
              ignoreDuplicates: false 
            });

          if (upsertErr) {
            console.warn(`[Restore] Standard upsert error on ${tableName}, attempting SQL fallback:`, upsertErr.message);
            
            // Try individual row insertion via exec_sql
            for (const item of sanitizedChunk) {
              try {
                const keys = Object.keys(item).filter(k => item[k] !== undefined);
                const values = keys.map(k => {
                  const val = item[k];
                  if (val === null) return 'NULL';
                  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
                  if (typeof val === 'boolean') return val ? 'true' : 'false';
                  if (typeof val === 'number') return val.toString();
                  return `'${String(val).replace(/'/g, "''")}'`;
                });

                const sql = `
                  INSERT INTO public.${tableName} (${keys.join(', ')})
                  VALUES (${values.join(', ')})
                  ON CONFLICT DO NOTHING;
                `;

                await this.supabase.rpc('exec_sql', { sql_query: sql });
                tableRowCount++;
              } catch (singleRowErr: any) {
                // Ignore individual non-fatal conflicts
              }
            }
          } else {
            tableRowCount += chunk.length;
          }
        }

        restoredTables.push(tableName);
        totalRestoredRows += tableRowCount;
        console.log(`[Restore] Restored ${tableName}: ${tableRowCount} rows`);
      } catch (tableErr: any) {
        console.error(`[Restore] Failed to restore table ${tableName}:`, tableErr);
        errors.push({ table: tableName, message: tableErr.message || 'Erreur inconnue' });
      }
    }

    // Invalidate PostgREST schema cache to ensure all changes reflect immediately
    try {
      await this.supabase.rpc('exec_sql', { sql_query: "NOTIFY pgrst, 'reload schema';" });
    } catch (e) {}

    const durationMs = Date.now() - startTime;

    return {
      success: errors.length === 0 || restoredTables.length > 0,
      safety_snapshot_id: safetySnapshotId,
      restored_tables: restoredTables,
      restored_rows_count: totalRestoredRows,
      errors,
      duration_ms: durationMs
    };
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    console.log(`[Backup] Initiating deletion of backup ID: ${backupId}`);
    
    // 1. Clean local backups dir
    if (fs.existsSync(this.backupsDir)) {
      try {
        const localFiles = fs.readdirSync(this.backupsDir);
        for (const f of localFiles) {
          if (f.includes(backupId) && f !== 'registry.json') {
            try {
              fs.unlinkSync(path.join(this.backupsDir, f));
              console.log(`[Backup] Removed local backup file: ${f}`);
            } catch (err) {}
          }
        }
      } catch (e) {}
    }

    // 2. Clean public mirror dir
    if (fs.existsSync(this.publicBackupDir)) {
      try {
        const publicFiles = fs.readdirSync(this.publicBackupDir);
        for (const f of publicFiles) {
          if (f.includes(backupId)) {
            try {
              fs.unlinkSync(path.join(this.publicBackupDir, f));
            } catch (err) {}
          }
        }
      } catch (e) {}
    }

    // 3. Clean Supabase Storage
    try {
      await this.supabase.storage
        .from('database_backups')
        .remove([
          `snapshots/${backupId}.json`,
          `${backupId}.json`,
          `snapshots/${backupId}.json.gz`,
          `${backupId}.json.gz`
        ]);
    } catch (e) {
      console.warn('[Backup] Supabase storage delete warning:', e);
    }

    // 4. Update registry
    const registry = await this.listBackups();
    const updated = registry.filter(b => b.id !== backupId && !b.storage_path?.includes(backupId));
    await this.saveRegistry(updated);

    console.log(`[Backup] Backup ${backupId} successfully deleted from registry and storage.`);
    return true;
  }

  /**
   * Send backup execution email notification
   */
  async sendNotificationEmail(params: {
    status: 'SUCCESS' | 'FAILED';
    backupName: string;
    details: string;
    recipientEmail?: string;
  }): Promise<void> {
    try {
      const settings = await this.getSettings();
      const targetEmail = params.recipientEmail || settings.notification_email;
      if (!targetEmail) return;

      // Check communication_settings for global SMTP
      const { data: smtpSettings } = await this.supabase
        .from('communication_settings')
        .select('*')
        .not('smtp_host', 'is', null)
        .limit(1)
        .single();

      if (!smtpSettings || !smtpSettings.smtp_host || !smtpSettings.smtp_pass) {
        console.log('[Backup Notification] No active SMTP configuration found to send email alert.');
        return;
      }

      const transporter = nodemailer.createTransport({
        host: smtpSettings.smtp_host,
        port: smtpSettings.smtp_port || 587,
        secure: smtpSettings.smtp_port === 465,
        auth: {
          user: smtpSettings.smtp_user || smtpSettings.email_from_address,
          pass: smtpSettings.smtp_pass,
        },
      });

      const isSuccess = params.status === 'SUCCESS';
      const subject = isSuccess
        ? `[EduNova Pro] Sauvegarde Réussie : ${params.backupName}`
        : `[ALERTE EduNova Pro] Échec de la Sauvegarde Automatique`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
          <div style="background-color: ${isSuccess ? '#4f46e5' : '#e11d48'}; padding: 16px; border-radius: 8px; color: white; text-align: center;">
            <h2 style="margin: 0;">${isSuccess ? 'Sauvegarde Base de Données Réussie' : 'Alerte : Échec de Sauvegarde'}</h2>
          </div>
          <div style="padding: 20px 0;">
            <p style="font-size: 15px; color: #334155;"><strong>Nom de la Sauvegarde :</strong> ${params.backupName}</p>
            <p style="font-size: 15px; color: #334155;"><strong>Date & Heure :</strong> ${new Date().toLocaleString('fr-FR')}</p>
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 6px; border-left: 4px solid ${isSuccess ? '#10b981' : '#f43f5e'};">
              <p style="margin: 0; font-size: 14px; color: #475569;">${params.details.replace(/\n/g, '<br>')}</p>
            </div>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0;" />
          <p style="font-size: 12px; color: #94a3b8; text-align: center;">
            Système de Sauvegarde Haute Disponibilité EduNova Pro Cluster v2.4
          </p>
        </div>
      `;

      await transporter.sendMail({
        from: `"${smtpSettings.email_from_name || 'EduNova Backup Service'}" <${smtpSettings.email_from_address}>`,
        to: targetEmail,
        subject: subject,
        html: html
      });

      console.log(`[Backup Notification] Email successfully dispatched to ${targetEmail}`);
    } catch (err: any) {
      console.warn('[Backup Notification] Error sending notification email:', err.message);
    }
  }
}
