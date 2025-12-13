import { create } from 'zustand';
import axios from 'axios';
import { Platform } from 'react-native';

// Android emülatör için 10.0.2.2, fiziksel cihaz/web için localhost
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

console.log(`[API] API_URL initialized: ${API_URL}, Platform: ${Platform.OS}`);

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  // <<< ÖNEMLİ: API'nizden kategori adı mı ID'si mi geliyor? >>>
  category?: string; // Eğer kategori adı geliyorsa bu kalsın
  category_id?: string; // Eğer ID geliyorsa ve adı ayrıca almanız gerekiyorsa bu daha karmaşık olur
  tags: string[];
  priority: string;
  // <<< ÖNEMLİ: API'nizdeki status tipleri bunlar mı? >>>
  status: 'Yapılacak' | 'Devam Ediyor' | 'Tamamlandı';
  completion_percentage: number;
  images: string[];
  due_date?: string;
  created_at: string;
  updated_at: string;

  category_name?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
}

interface TaskStore {
  tasks: Task[];
  loading: boolean;
  error: string | null;
  // <<< DÖNÜŞ TİPİ Promise<Task[]> OLDU >>>
  fetchTasks: (token: string, filters?: any) => Promise<Task[]>;
  // Diğer fonksiyonların dönüş tiplerini de isteğe bağlı güncelleyebiliriz
  createTask: (token: string, taskData: any) => Promise<Task | null>;
  updateTask: (token: string, taskId: string, taskData: any) => Promise<Task | null>;
  deleteTask: (token: string, taskId: string) => Promise<boolean>;
  getAISuggestions: (token: string) => Promise<string[]>;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  loading: false,
  error: null,

  fetchTasks: async (token: string, filters = {}) => {
    // Sadece bir fetch işlemi aynı anda çalışsın (isteğe bağlı iyileştirme)
    if (get().loading) {
        console.log("Fetch already in progress, returning current tasks");
        return get().tasks; // Mevcut taskları döndür
    }
    set({ loading: true, error: null });
    try {
      const params = new URLSearchParams(filters);
      const fullUrl = `${API_URL}/api/tasks?${params}`;
      console.log(`[TaskStore] Fetching tasks - URL: ${fullUrl}`); // Tam URL'yi logla
      console.log(`[TaskStore] API_URL değeri: ${API_URL}`); // API_URL değerini logla
      const response = await axios.get<Task[] | { tasks: Task[] }>(fullUrl, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000
      });

      // API yanıtınızın yapısına göre görev listesini alın:
      let fetchedTasks: Task[] = [];
      if (Array.isArray(response.data)) {
          fetchedTasks = response.data; // Yanıt doğrudan dizi ise
      } else if (response.data && Array.isArray((response.data as any).tasks)) {
          fetchedTasks = (response.data as any).tasks; // Yanıt { tasks: [...] } şeklinde ise
      } else {
          console.warn("[TaskStore] Unexpected API response structure:", response.data);
      }

      console.log(`[TaskStore] Fetched ${fetchedTasks.length} tasks.`); // Log eklendi
      set({ tasks: fetchedTasks, loading: false });
      return fetchedTasks; // <<< BAŞARILI DURUMDA GÖREVLERİ DÖNDÜR >>>

    } catch (error: any) {
      const statusCode = error.response?.status;
      const errorUrl = error.config?.url;
      const errorData = error.response?.data;
      
      console.error(`[TaskStore] fetchTasks error - Status: ${statusCode}, URL: ${errorUrl}`);
      console.error(`[TaskStore] API_URL: ${API_URL}, Full URL: ${API_URL}/api/tasks`);
      console.error(`[TaskStore] Error details:`, errorData || error.message);
      console.error(`[TaskStore] Full error:`, error);
      
      const errorMessage = errorData?.detail || error.message || 'Görevler alınamadı';
      
      // 401 hatası (Unauthorized) - Token geçersiz, logout yap
      if (statusCode === 401) {
        console.error("[TaskStore] Token geçersiz, kullanıcı çıkış yapmalı");
        set({ error: "Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.", loading: false, tasks: [] });
      } else if (statusCode === 404) {
        // 404 hatası - Endpoint bulunamadı veya backend erişilemiyor
        console.error("[TaskStore] 404 Not Found - Backend endpoint bulunamadı veya backend erişilemiyor");
        set({ error: `Backend'e erişilemiyor. Lütfen backend'in çalıştığından emin olun. (URL: ${API_URL})`, loading: false, tasks: [] });
      } else if (!error.response) {
        // Network hatası - Backend'e bağlanılamıyor
        console.error("[TaskStore] Network hatası - Backend'e bağlanılamıyor");
        set({ error: `Backend'e bağlanılamıyor. Lütfen backend'in çalıştığından ve URL'nin doğru olduğundan emin olun. (URL: ${API_URL})`, loading: false, tasks: [] });
      } else {
      set({ error: errorMessage, loading: false, tasks: [] });
      }
      return []; // <<< HATA DURUMUNDA BOŞ DİZİ DÖNDÜR >>>
    }
  },

  createTask: async (token: string, taskData: any) => {
    set({ loading: true, error: null }); // Veya sadece loading: true
    try {
      console.log("[TaskStore] Creating task:", taskData); // Log eklendi
      const response = await axios.post<Task>(`${API_URL}/api/tasks`, taskData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("[TaskStore] Task created successfully, re-fetching tasks..."); // Log eklendi
      // Görev oluşturulduktan sonra listeyi yenile ve DÖNEN GÖREVİ KULLANMA!
      // Çünkü fetchTasks state'i güncelleyecek.
      await get().fetchTasks(token);
      set({ loading: false }); // Yüklemeyi bitir
      return response.data; // Yeni görevi döndür yine de (opsiyonel)
    } catch (error: any) {
       const errorMessage = error.response?.data?.detail || error.message || 'Görev oluşturulamadı';
       console.error("[TaskStore] createTask error:", errorMessage, error.response?.data); // Daha detaylı log
      set({ error: errorMessage, loading: false });
      throw error; // Hatanın component'te yakalanabilmesi için fırlat
    }
  },

  updateTask: async (token: string, taskId: string, taskData: any) => {
    set({ loading: true, error: null });
    try {
      console.log(`[TaskStore] Updating task ${taskId}:`, taskData);
      const response = await axios.put<Task>(`${API_URL}/api/tasks/${taskId}`, taskData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("[TaskStore] Task updated successfully, re-fetching tasks...");
      // Görev güncellendikten sonra listeyi yenile
      await get().fetchTasks(token);
      set({ loading: false });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'Görev güncellenemedi';
      console.error("[TaskStore] updateTask error:", errorMessage, error.response?.data);
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  deleteTask: async (token: string, taskId: string) => {
    set({ loading: true, error: null });
    try {
      console.log(`[TaskStore] Deleting task ${taskId}`);
      await axios.delete(`${API_URL}/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("[TaskStore] Task deleted successfully, removing from list...");
      // Görevi listeden hemen kaldır (UI hemen güncellenir)
      const currentTasks = get().tasks;
      const updatedTasks = currentTasks.filter(task => task.id !== taskId);
      set({ tasks: updatedTasks, loading: false });
      
      // Arka planda listeyi yenile (senkronizasyon için)
      get().fetchTasks(token).catch(err => {
        console.error("[TaskStore] Error refreshing tasks after delete:", err);
      });
      
      return true;
    } catch (error: any) {
      // 404 hatası (görev zaten silinmiş) başarı olarak kabul et
      if (error.response?.status === 404) {
        console.log("[TaskStore] Task already deleted (404), removing from list...");
        // Görevi listeden kaldır
        const currentTasks = get().tasks;
        const updatedTasks = currentTasks.filter(task => task.id !== taskId);
        set({ tasks: updatedTasks, loading: false });
        
        // Arka planda listeyi yenile
        get().fetchTasks(token).catch(err => {
          console.error("[TaskStore] Error refreshing tasks after delete:", err);
        });
        
        return true;
      }
      const errorMessage = error.response?.data?.detail || error.message || 'Görev silinemedi';
      console.error("[TaskStore] deleteTask error:", errorMessage, error.response?.data);
      set({ error: errorMessage, loading: false });
      throw error;
    }
  },

  getAISuggestions: async (token: string) => {
    set({ loading: true, error: null });
    try {
      console.log("[TaskStore] Fetching AI suggestions");
      const response = await axios.get<string[]>(`${API_URL}/api/ai/suggestions`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
      });
      set({ loading: false });
      return response.data;
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || error.message || 'AI önerileri alınamadı';
      console.error("[TaskStore] getAISuggestions error:", errorMessage, error.response?.data);
      set({ error: errorMessage, loading: false });
      return []; // Hata durumunda boş dizi döndür
    }
  },
}));