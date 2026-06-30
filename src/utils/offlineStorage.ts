const DB_NAME = 'reporta-offline';
const DB_VERSION = 3;
const REPORTS_STORE = 'pending_reports';
const PHOTOS_STORE = 'pending_photos';
const CATEGORIES_STORE = 'categories_cache';
const AREAS_STORE = 'areas_cache';
const PROYECTOS_STORE = 'proyectos_cache';
const USERS_STORE = 'users_cache';
const COMPANY_CONFIG_STORE = 'company_config_cache';

export interface OfflineReport {
  id: string;
  title: string;
  description: string;
  category_id: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  area_proyecto: string;
  proposed_closure_date: string | null;
  photos: string[];
  created_at: string;
  synced: boolean;
}

export interface OfflinePhoto {
  id: string;
  report_id: string;
  blob: Blob;
  created_at: string;
}

export interface CachedCategory {
  id: string;
  name: string;
  icon: string;
  user_id: string;
  timestamp: number;
}

export interface CachedArea {
  id: string;
  name: string;
  user_id: string;
  timestamp: number;
}

export interface CachedProyecto {
  id: string;
  name: string;
  user_id: string;
  timestamp: number;
}

export interface CachedUser {
  id: string;
  full_name: string;
  role: string;
  company_id: string;
  timestamp: number;
}

export interface CachedCompanyConfig {
  company_id: string;
  ai_enabled: boolean;
  ai_provider: string;
  ai_model: string;
  timestamp: number;
}

class OfflineStorageDB {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          console.error('IndexedDB error:', request.error);
          this.initPromise = null;
          reject(request.error);
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          if (!db.objectStoreNames.contains(REPORTS_STORE)) {
            const reportsStore = db.createObjectStore(REPORTS_STORE, { keyPath: 'id' });
            reportsStore.createIndex('synced', 'synced', { unique: false });
            reportsStore.createIndex('created_at', 'created_at', { unique: false });
          }

          if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
            const photosStore = db.createObjectStore(PHOTOS_STORE, { keyPath: 'id' });
            photosStore.createIndex('report_id', 'report_id', { unique: false });
          }

          if (!db.objectStoreNames.contains(CATEGORIES_STORE)) {
            const categoriesStore = db.createObjectStore(CATEGORIES_STORE, { keyPath: 'id' });
            categoriesStore.createIndex('user_id', 'user_id', { unique: false });
          }

          if (!db.objectStoreNames.contains(AREAS_STORE)) {
            const areasStore = db.createObjectStore(AREAS_STORE, { keyPath: 'id' });
            areasStore.createIndex('user_id', 'user_id', { unique: false });
          }

          if (!db.objectStoreNames.contains(PROYECTOS_STORE)) {
            const proyectosStore = db.createObjectStore(PROYECTOS_STORE, { keyPath: 'id' });
            proyectosStore.createIndex('user_id', 'user_id', { unique: false });
          }

          if (!db.objectStoreNames.contains(USERS_STORE)) {
            const usersStore = db.createObjectStore(USERS_STORE, { keyPath: 'id' });
            usersStore.createIndex('company_id', 'company_id', { unique: false });
          }

          if (!db.objectStoreNames.contains(COMPANY_CONFIG_STORE)) {
            db.createObjectStore(COMPANY_CONFIG_STORE, { keyPath: 'company_id' });
          }
        };
      } catch (error) {
        console.error('Failed to open IndexedDB:', error);
        this.initPromise = null;
        reject(error);
      }
    });

    return this.initPromise;
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    return this.db;
  }

  async saveReport(report: OfflineReport): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      const request = store.put(report);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async savePhoto(photo: OfflinePhoto): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PHOTOS_STORE], 'readwrite');
      const store = transaction.objectStore(PHOTOS_STORE);
      const request = store.put(photo);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPendingReports(): Promise<OfflineReport[]> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve) => {
        try {
          const transaction = db.transaction([REPORTS_STORE], 'readonly');
          const store = transaction.objectStore(REPORTS_STORE);
          const request = store.getAll();

          request.onsuccess = () => {
            const allReports = request.result || [];
            const pendingReports = allReports.filter(report => !report.synced);
            resolve(pendingReports);
          };
          request.onerror = () => {
            console.error('Error getting reports:', request.error);
            resolve([]);
          };
        } catch (error) {
          console.error('Error in getPendingReports transaction:', error);
          resolve([]);
        }
      });
    } catch (error) {
      console.error('Error in getPendingReports:', error);
      return [];
    }
  }

  async getAllReports(): Promise<OfflineReport[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REPORTS_STORE], 'readonly');
      const store = transaction.objectStore(REPORTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getReport(id: string): Promise<OfflineReport | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REPORTS_STORE], 'readonly');
      const store = transaction.objectStore(REPORTS_STORE);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getPhotosByReportId(reportId: string): Promise<OfflinePhoto[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([PHOTOS_STORE], 'readonly');
        const store = transaction.objectStore(PHOTOS_STORE);
        const index = store.index('report_id');
        const request = index.getAll(IDBKeyRange.only(reportId));

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      } catch (error) {
        console.error('Error in getPhotosByReportId:', error);
        resolve([]);
      }
    });
  }

  async markReportAsSynced(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([REPORTS_STORE], 'readwrite');
      const store = transaction.objectStore(REPORTS_STORE);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const report = getRequest.result;
        if (report) {
          report.synced = true;
          const updateRequest = store.put(report);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteReport(id: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([REPORTS_STORE, PHOTOS_STORE], 'readwrite');

    const reportsStore = transaction.objectStore(REPORTS_STORE);
    const photosStore = transaction.objectStore(PHOTOS_STORE);
    const photosIndex = photosStore.index('report_id');

    return new Promise((resolve, reject) => {
      const deletePhotosRequest = photosIndex.openCursor(IDBKeyRange.only(id));

      deletePhotosRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          const deleteReportRequest = reportsStore.delete(id);
          deleteReportRequest.onsuccess = () => resolve();
          deleteReportRequest.onerror = () => reject(deleteReportRequest.error);
        }
      };

      deletePhotosRequest.onerror = () => reject(deletePhotosRequest.error);
    });
  }

  async deletePhoto(id: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PHOTOS_STORE], 'readwrite');
      const store = transaction.objectStore(PHOTOS_STORE);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearSyncedReports(): Promise<void> {
    const db = await this.ensureDB();
    const syncedReports = await this.getAllReports();
    const syncedIds = syncedReports.filter(r => r.synced).map(r => r.id);

    for (const id of syncedIds) {
      await this.deleteReport(id);
    }
  }

  async getPendingCount(): Promise<number> {
    try {
      const reports = await this.getPendingReports();
      return reports.length;
    } catch (error) {
      console.error('Error getting pending count:', error);
      return 0;
    }
  }

  async cacheCategories(categories: any[], userId: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([CATEGORIES_STORE], 'readwrite');
    const store = transaction.objectStore(CATEGORIES_STORE);

    const timestamp = Date.now();
    for (const category of categories) {
      const cached: CachedCategory = {
        id: category.id,
        name: category.name,
        icon: category.icon,
        user_id: userId,
        timestamp,
      };
      store.put(cached);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getCachedCategories(userId: string): Promise<CachedCategory[]> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([CATEGORIES_STORE], 'readonly');
        const store = transaction.objectStore(CATEGORIES_STORE);
        const index = store.index('user_id');
        const request = index.getAll(IDBKeyRange.only(userId));

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch (error) {
      console.error('Error getting cached categories:', error);
      return [];
    }
  }

  async cacheAreas(areas: any[], userId: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([AREAS_STORE], 'readwrite');
    const store = transaction.objectStore(AREAS_STORE);

    const timestamp = Date.now();
    for (const area of areas) {
      const cached: CachedArea = {
        id: area.id,
        name: area.name,
        user_id: userId,
        timestamp,
      };
      store.put(cached);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getCachedAreas(userId: string): Promise<CachedArea[]> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([AREAS_STORE], 'readonly');
        const store = transaction.objectStore(AREAS_STORE);
        const index = store.index('user_id');
        const request = index.getAll(IDBKeyRange.only(userId));

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch (error) {
      console.error('Error getting cached areas:', error);
      return [];
    }
  }

  async cacheProyectos(proyectos: any[], userId: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([PROYECTOS_STORE], 'readwrite');
    const store = transaction.objectStore(PROYECTOS_STORE);

    const timestamp = Date.now();
    for (const proyecto of proyectos) {
      const cached: CachedProyecto = {
        id: proyecto.id,
        name: proyecto.name,
        user_id: userId,
        timestamp,
      };
      store.put(cached);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getCachedProyectos(userId: string): Promise<CachedProyecto[]> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([PROYECTOS_STORE], 'readonly');
        const store = transaction.objectStore(PROYECTOS_STORE);
        const index = store.index('user_id');
        const request = index.getAll(IDBKeyRange.only(userId));

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch (error) {
      console.error('Error getting cached proyectos:', error);
      return [];
    }
  }

  async cacheUsers(users: any[], companyId: string): Promise<void> {
    const db = await this.ensureDB();
    const transaction = db.transaction([USERS_STORE], 'readwrite');
    const store = transaction.objectStore(USERS_STORE);

    const timestamp = Date.now();
    for (const user of users) {
      const cached: CachedUser = {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
        company_id: companyId,
        timestamp,
      };
      store.put(cached);
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getCachedUsers(companyId: string): Promise<CachedUser[]> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([USERS_STORE], 'readonly');
        const store = transaction.objectStore(USERS_STORE);
        const index = store.index('company_id');
        const request = index.getAll(IDBKeyRange.only(companyId));

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    } catch (error) {
      console.error('Error getting cached users:', error);
      return [];
    }
  }

  async cacheCompanyConfig(config: any, companyId: string): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([COMPANY_CONFIG_STORE], 'readwrite');
      const store = transaction.objectStore(COMPANY_CONFIG_STORE);

      const cached: CachedCompanyConfig = {
        company_id: companyId,
        ai_enabled: config.ai_enabled || false,
        ai_provider: config.ai_provider || '',
        ai_model: config.ai_model || '',
        timestamp: Date.now(),
      };

      const request = store.put(cached);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedCompanyConfig(companyId: string): Promise<CachedCompanyConfig | null> {
    try {
      const db = await this.ensureDB();
      return new Promise((resolve) => {
        const transaction = db.transaction([COMPANY_CONFIG_STORE], 'readonly');
        const store = transaction.objectStore(COMPANY_CONFIG_STORE);
        const request = store.get(companyId);

        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch (error) {
      console.error('Error getting cached company config:', error);
      return null;
    }
  }
}

export const offlineStorage = new OfflineStorageDB();
