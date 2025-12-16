/**
 * TaskMaster - Görev Yönetimi State Store
 * =========================================
 * Bu dosya, Zustand kullanarak görev yönetimi için global state yönetimini sağlar.
 * Tüm görev CRUD işlemleri (Create, Read, Update, Delete) bu store üzerinden yapılır.
 * 
 * Kullanılan Teknolojiler:
 * - Zustand: Hafif ve performanslı state management
 * - Axios: HTTP istekleri için
 */

import axios from 'axios'; // HTTP istekleri için axios
import { create } from 'zustand'; // Zustand state management kütüphanesi

// Backend API URL'si - .env dosyasından alınır
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

/**
 * Görev (Task) Interface
 * Backend'den gelen görev verisinin yapısını tanımlar
 */
export interface Task {
  id: string;  // Görev benzersiz ID'si (UUID)
  user_id: string;  // Görev sahibi kullanıcı ID'si
  title: string;  // Görev başlığı
  description?: string;  // Görev açıklaması (opsiyonel)
  category?: string;  // Kategori adı (eski format - geriye dönük uyumluluk için)
  category_id?: string;  // Kategori ID'si
  tags: string[];  // Görev etiketleri listesi
  priority: string;  // Öncelik seviyesi (Düşük, Orta, Yüksek, Acil)
  status: 'Yapılacak' | 'Devam Ediyor' | 'Tamamlandı';  // Görev durumu
  completion_percentage: number;  // Tamamlanma yüzdesi (0-100)
  images: string[];  // Görev resimleri (base64 veya URL)
  due_date?: string;  // Son tarih (ISO format string)
  created_at: string;  // Oluşturulma tarihi
  updated_at: string;  // Güncellenme tarihi

  // Kategori bilgileri (JOIN ile backend'den gelir)
  category_name?: string | null;  // Kategori adı
  category_color?: string | null;  // Kategori rengi (hex)
  category_icon?: string | null;  // Kategori ikonu (Ionicons ismi)
}

/**
 * TaskStore Interface
 * Zustand store'unun yapısını tanımlar
 */
interface TaskStore {
  // State değişkenleri
  tasks: Task[];  // Tüm görevler listesi
  loading: boolean;  // Yükleme durumu (istek devam ediyor mu?)
  error: string | null;  // Hata mesajı (varsa)

  // Action fonksiyonları
  fetchTasks: (token: string, filters?: any) => Promise<Task[]>;  // Görevleri backend'den getir
  createTask: (token: string, taskData: any) => Promise<Task | null>;  // Yeni görev oluştur
  updateTask: (token: string, taskId: string, taskData: any) => Promise<Task | null>;  // Görev güncelle
  deleteTask: (token: string, taskId: string) => Promise<boolean>;  // Görev sil
  getAISuggestions: (token: string) => Promise<string[]>;  // AI önerileri al
}

/**
 * TaskStore - Zustand Store Implementation
 * Global görev yönetimi state'i ve action'ları
 */
export const useTaskStore = create<TaskStore>((set, get) => ({
  // ========== INITIAL STATE ==========
  tasks: [],  // Başlangıçta boş görev listesi
  loading: false,  // Başlangıçta yükleme yok
  error: null,  // Başlangıçta hata yok

  // ========== FETCH TASKS (Görevleri Getir) ==========
  /**
   * Backend'den görevleri getirir ve state'e kaydeder.
   * 
   * @param token - JWT authentication token
   * @param filters - Filtreleme parametreleri (category_id, status, priority)
   * @returns Promise<Task[]> - Getirilen görevler listesi
   */
  fetchTasks: async (token: string, filters = {}) => {
    // Çoklu istek önleme: Eğer zaten bir fetch işlemi devam ediyorsa, mevcut görevleri döndür
    if (get().loading) {
        console.log("Fetch already in progress, returning current tasks");
        return get().tasks; // Mevcut taskları döndür (duplicate request önleme)
    }
    
    // Yükleme durumunu başlat ve hataları temizle
    set({ loading: true, error: null });
    
    try {
      // Filtreleri URL parametrelerine çevir
      const params = new URLSearchParams(filters);
      console.log(`[TaskStore] Fetching tasks with filters: ${params.toString()}`);
      
      // Backend API'ye GET isteği gönder
      const response = await axios.get<Task[] | { tasks: Task[] }>(
        `${API_URL}/api/tasks?${params}`, 
        {
          headers: { Authorization: `Bearer ${token}` },  // JWT token header'a ekle
          timeout: 10000  // 10 saniye timeout (ağ sorunlarında takılmayı önler)
        }
      );

      // API yanıtını parse et (backend farklı formatlar dönebilir)
      let fetchedTasks: Task[] = [];
      if (Array.isArray(response.data)) {
          // Yanıt doğrudan dizi ise
          fetchedTasks = response.data;
      } else if (response.data && Array.isArray((response.data as any).tasks)) {
          // Yanıt { tasks: [...] } şeklinde ise
          fetchedTasks = (response.data as any).tasks;
      } else {
          // Beklenmedik format
          console.warn("[TaskStore] Unexpected API response structure:", response.data);
      }

      console.log(`[TaskStore] Fetched ${fetchedTasks.length} tasks.`);
      
      // State'i güncelle: görevleri kaydet, yükleme durumunu bitir
      set({ tasks: fetchedTasks, loading: false });
      return fetchedTasks; // Başarılı durumda görevleri döndür

    } catch (error: any) {
      // Hata durumunda mesajı çıkar ve state'e kaydet
      const errorMessage = error.response?.data?.detail || error.message || 'Görevler alınamadı';
      console.error("[TaskStore] fetchTasks error:", errorMessage, error.response?.data);
      set({ error: errorMessage, loading: false, tasks: [] }); // Hata durumunda görevleri temizle
      return []; // Hata durumunda boş dizi döndür
    }
  },

  // ========== CREATE TASK (Yeni Görev Oluştur) ==========
  /**
   * Backend'de yeni görev oluşturur ve listeyi yeniler.
   * 
   * @param token - JWT authentication token
   * @param taskData - Oluşturulacak görev verisi
   * @returns Promise<Task | null> - Oluşturulan görev veya null (hata durumunda)
   */
  createTask: async (token: string, taskData: any) => {
    set({ loading: true, error: null }); // Yükleme durumunu başlat
    try {
      console.log("[TaskStore] Creating task:", taskData);
      
      // Backend API'ye POST isteği gönder
      const response = await axios.post<Task>(
        `${API_URL}/api/tasks`, 
        taskData, 
        {
          headers: { Authorization: `Bearer ${token}` },  // JWT token header'a ekle
        }
      );
      
      console.log("[TaskStore] Task created successfully, re-fetching tasks...");
      
      // Görev oluşturulduktan sonra listeyi yenile
      // fetchTasks state'i güncelleyeceği için response.data'yı direkt kullanmıyoruz
      await get().fetchTasks(token);
      
      set({ loading: false }); // Yüklemeyi bitir
      return response.data; // Yeni görevi döndür (opsiyonel - component'ler kullanabilir)
      
    } catch (error: any) {
      // Hata durumunda mesajı çıkar ve state'e kaydet
      const errorMessage = error.response?.data?.detail || error.message || 'Görev oluşturulamadı';
      console.error("[TaskStore] createTask error:", errorMessage, error.response?.data);
      set({ error: errorMessage, loading: false });
      throw error; // Hatanın component'te yakalanabilmesi için fırlat
    }
  },

  // ========== UPDATE TASK (Görev Güncelle) ==========
  /**
   * Mevcut görevi günceller.
   * 
   * @param token - JWT authentication token
   * @param taskId - Güncellenecek görev ID'si
   * @param taskData - Güncellenecek görev verisi
   * @returns Promise<Task | null> - Güncellenen görev veya null
   */
  updateTask: async (token: string, taskId: string, taskData: any) => { 
    /* TODO: Implement update task functionality */
    return null; 
  },
  
  // ========== DELETE TASK (Görev Sil) ==========
  /**
   * Görevi siler.
   * 
   * @param token - JWT authentication token
   * @param taskId - Silinecek görev ID'si
   * @returns Promise<boolean> - Silme işlemi başarılıysa true
   */
  deleteTask: async (token: string, taskId: string) => {
    set({ loading: true, error: null });
    try {
      console.log(`[TaskStore] Deleting task: ${taskId}`);
      
      // Backend API'ye DELETE isteği gönder
      await axios.delete(
        `${API_URL}/api/tasks/${taskId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      
      console.log("[TaskStore] Task deleted successfully, re-fetching tasks...");
      
      // Görev silindikten sonra listeyi yenile
      await get().fetchTasks(token);
      
      set({ loading: false });
      return true; // Başarılı
      
    } catch (error: any) {
      // Hata durumunda mesajı çıkar ve state'e kaydet
      const errorMessage = error.response?.data?.detail || error.message || 'Görev silinemedi';
      console.error("[TaskStore] deleteTask error:", errorMessage, error.response?.data);
      set({ error: errorMessage, loading: false });
      throw error; // Hatanın component'te yakalanabilmesi için fırlat
    }
  },
  
  // ========== GET AI SUGGESTIONS (AI Önerileri Al) ==========
  /**
   * AI asistanından görev önerileri alır.
   * 
   * @param token - JWT authentication token
   * @returns Promise<string[]> - AI önerileri listesi
   */
  getAISuggestions: async (token: string) => { 
    /* TODO: Implement AI suggestions functionality */
    return []; 
  },
}));