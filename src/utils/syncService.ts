import { supabase } from '../lib/supabase';
import { offlineStorage, OfflineReport } from './offlineStorage';
import { uploadPhoto } from './storage';

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  current: string;
}

export type SyncEventType = 'start' | 'progress' | 'complete' | 'error';

export interface SyncEvent {
  type: SyncEventType;
  progress?: SyncProgress;
  error?: Error;
}

export class SyncService {
  private isSyncing = false;
  private syncInProgress: Set<string> = new Set();
  private listeners: ((event: SyncEvent) => void)[] = [];
  private maxRetries = 3;
  private baseDelay = 1000;

  addEventListener(listener: (event: SyncEvent) => void): void {
    this.listeners.push(listener);
  }

  removeEventListener(listener: (event: SyncEvent) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  private emitEvent(event: SyncEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in sync event listener:', error);
      }
    });
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries = this.maxRetries
  ): Promise<T> {
    for (let i = 0; i < retries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === retries - 1) throw error;
        const delay = this.baseDelay * Math.pow(2, i);
        console.log(`Retry ${i + 1}/${retries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    throw new Error('Max retries exceeded');
  }

  async syncPendingReports(companyId: string, userId: string): Promise<void> {
    if (this.isSyncing) {
      console.log('Sync already in progress');
      return;
    }

    if (!navigator.onLine) {
      console.log('No internet connection, skipping sync');
      return;
    }

    this.isSyncing = true;
    console.log('Starting sync of pending reports...');

    try {
      const pendingReports = await offlineStorage.getPendingReports();

      if (!pendingReports || pendingReports.length === 0) {
        console.log('No pending reports to sync');
        return;
      }

      console.log(`Found ${pendingReports.length} pending reports`);

      const progress: SyncProgress = {
        total: pendingReports.length,
        completed: 0,
        failed: 0,
        current: '',
      };

      this.emitEvent({ type: 'start', progress });

      for (const offlineReport of pendingReports) {
        if (this.syncInProgress.has(offlineReport.id)) {
          continue;
        }

        this.syncInProgress.add(offlineReport.id);
        progress.current = offlineReport.title;
        this.emitEvent({ type: 'progress', progress });

        try {
          await this.retryWithBackoff(() =>
            this.syncSingleReport(offlineReport, companyId, userId)
          );
          console.log(`Successfully synced report: ${offlineReport.id}`);
          progress.completed++;
        } catch (error) {
          console.error(`Failed to sync report ${offlineReport.id}:`, error);
          progress.failed++;
          this.emitEvent({
            type: 'error',
            progress,
            error: error as Error
          });
        } finally {
          this.syncInProgress.delete(offlineReport.id);
        }

        this.emitEvent({ type: 'progress', progress });
      }

      await offlineStorage.clearSyncedReports();
      console.log('Sync completed successfully');
      this.emitEvent({ type: 'complete', progress });

      window.dispatchEvent(new CustomEvent('reports-synced'));
    } catch (error) {
      console.error('Sync failed:', error);
      this.emitEvent({
        type: 'error',
        error: error as Error
      });
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncSingleReport(
    offlineReport: OfflineReport,
    companyId: string,
    userId: string
  ): Promise<void> {
    let photos: Awaited<ReturnType<typeof offlineStorage.getPhotosByReportId>> = [];

    try {
      photos = await offlineStorage.getPhotosByReportId(offlineReport.id);
    } catch (error) {
      console.error('Failed to get photos for report:', error);
      photos = [];
    }

    const photoUrls: string[] = [];

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const file = new File([photo.blob], `photo_${i}.jpg`, { type: 'image/jpeg' });

      try {
        const photoUrl = await uploadPhoto(file, companyId, offlineReport.id, false);
        photoUrls.push(photoUrl);
      } catch (error) {
        console.error(`Failed to upload photo ${photo.id}:`, error);
        throw error;
      }
    }

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        company_id: companyId,
        reporter_id: userId,
        type: 'unsafe_condition',
        category_id: offlineReport.category_id,
        description: offlineReport.description,
        proposed_closure: offlineReport.title,
        proposed_closure_date: offlineReport.proposed_closure_date,
        status: 'reported',
        priority: 'medium',
        latitude: offlineReport.latitude,
        longitude: offlineReport.longitude,
        location_address: offlineReport.location,
        area: offlineReport.area_proyecto,
        proyecto: offlineReport.area_proyecto,
      })
      .select()
      .single();

    if (reportError) {
      console.error('Failed to create report:', reportError);
      throw reportError;
    }

    if (photoUrls.length > 0 && report) {
      const photoInserts = photoUrls.map((url, index) => ({
        report_id: report.id,
        photo_url: url,
        is_main: index === 0,
        is_evidence: false,
        uploaded_by: userId,
      }));

      const { error: photosError } = await supabase
        .from('report_photos')
        .insert(photoInserts);

      if (photosError) {
        console.error('Failed to insert photos:', photosError);
        throw photosError;
      }
    }

    await offlineStorage.markReportAsSynced(offlineReport.id);
  }

  async startAutoSync(companyId: string, userId: string): Promise<void> {
    const handleOnline = () => {
      console.log('Network online - starting auto sync');
      this.syncPendingReports(companyId, userId);
    };

    window.addEventListener('network-online', handleOnline);

    if (navigator.onLine) {
      await this.syncPendingReports(companyId, userId);
    }
  }

  async forceSyncNow(companyId: string, userId: string): Promise<void> {
    if (!navigator.onLine) {
      throw new Error('No hay conexión a internet');
    }
    return this.syncPendingReports(companyId, userId);
  }

  getIsSyncing(): boolean {
    return this.isSyncing;
  }
}

export const syncService = new SyncService();
