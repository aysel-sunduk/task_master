/**
 * TaskMaster - Ana Sayfa (Home Screen)
 * =====================================
 * Bu ekran, kullanıcının tüm görevlerini listeler.
 * Görevleri durum ve kategori filtreleri ile görüntüleyebilir.
 * Yeni görev ekleme ve AI asistan erişimi sağlar.
 * 
 * Özellikler:
 * - Görev listesi görüntüleme
 * - Durum filtreleme (Tümü, Yapılacak, Devam Ediyor, Tamamlandı)
 * - Kategori filtreleme
 * - Pull-to-refresh (aşağı çekerek yenileme)
 * - Yeni görev ekleme butonu
 * - AI asistan butonu
 */

import { Ionicons } from '@expo/vector-icons'; // İkonlar
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'; // Navigasyon
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler'; // Swipe gesture için
import { SafeAreaView } from 'react-native-safe-area-context'; // Güvenli alan görünümü (notch vb.)
import { useAuth } from '../../contexts/AuthContext'; // Authentication context
import { Task, useTaskStore } from '../../store/taskStore'; // Görev state store

// ========== COMPONENT: GÖREV KARTI ==========
/**
 * TaskCard Component - Swipe-to-delete ve tıklama özellikli
 * Görev bilgilerini gösteren kart component'i
 * 
 * @param task - Gösterilecek görev objesi
 * @param onPress - Karta tıklandığında çalışacak fonksiyon (detay sayfasına yönlendirme)
 * @param onDelete - Silme butonuna tıklandığında çalışacak fonksiyon
 */
const TaskCard = ({ 
  task, 
  onPress, 
  onDelete 
}: { 
  task: Task; 
  onPress: () => void;
  onDelete: () => void;
}) => {
  // Null/undefined kontrolü
  if (!task) {
    return null;
  }

  // Kategori adını belirle
  const categoryName = task.category_name || task.category || 'Genel';
  const taskStatus = task.status || 'Yapılacak';
  const taskTitle = task.title || 'Başlıksız Görev';
  const completionPercentage = Math.max(0, Math.min(100, task.completion_percentage ?? 0));

  // Swipe-to-delete için sağ tarafta silme butonu
  const renderRightActions = () => (
    <View style={styles.deleteActionContainer}>
      <TouchableOpacity
        style={styles.deleteActionButton}
        onPress={onDelete}
      >
        <Ionicons name="trash" size={24} color="#FFFFFF" />
        <Text style={styles.deleteActionText}>Sil</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable renderRightActions={renderRightActions}>
      <TouchableOpacity 
        style={styles.taskCard}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.taskTitle}>{String(taskTitle)}</Text>
        <View style={styles.taskFooter}>
           <Text style={styles.taskStatus}>{String(taskStatus)}</Text>
           <Text style={styles.taskCategory}>{String(categoryName)}</Text>
        </View>
        <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${completionPercentage}%` }]} />
         </View>
      </TouchableOpacity>
    </Swipeable>
  );
};

// ========== FİLTRE TANIMLAMALARI ==========
// Durum filtre seçenekleri
const STATUS_FILTERS = ['Tümü', 'Yapılacak', 'Devam Ediyor', 'Tamamlandı'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];  // TypeScript tip tanımı


/**
 * HomeScreen Component
 * ====================
 * Ana sayfa component'i - görev listesini gösterir
 */
export default function HomeScreen() {
  // ========== HOOKS ==========
  const router = useRouter();  // Navigasyon için
  const { token, user } = useAuth();  // Authentication bilgileri
  const { fetchTasks, tasks, loading, deleteTask } = useTaskStore();  // Görev state ve fonksiyonları
  const params = useLocalSearchParams<{ categoryFilter?: string }>();  // URL parametreleri (kategori filtresi)
  
  // ========== LOCAL STATE ==========
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);  // Filtrelenmiş görevler
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilter>('Tümü');  // Seçili durum filtresi

  // ========== GÖREVLERİ YÜKLEME FONKSİYONU ==========
  /**
   * Backend'den görevleri yükler
   * useCallback ile memoize edilmiş (gereksiz re-render önleme)
   */
  const loadTasks = useCallback(async () => {
    if (!token) return;  // Token yoksa işlem yapma
    try {
      await fetchTasks(token);  // Store'dan görevleri getir
    } catch (error) {
      console.error("Ana sayfada görevler yüklenirken hata:", error);
    }
  }, [token, fetchTasks]);

  // ========== FOCUS EFFECT ==========
  // Ekran her odaklandığında (açıldığında veya geri dönüldüğünde) görevleri yükle
  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  // ========== FİLTRELEME EFFECT ==========
  // Görevler, kategori filtresi veya durum filtresi değiştiğinde filtreleme yap
  useEffect(() => {
    let tempTasks = tasks;  // Başlangıçta tüm görevler
    
    // Kategori filtresi varsa uygula
    if (params.categoryFilter) {
      tempTasks = tempTasks.filter(task => {
        const categoryName = task.category_name || task.category || 'Genel';
        return categoryName === params.categoryFilter;
      });
    }
    
    // Durum filtresi varsa uygula
    if (selectedStatusFilter !== 'Tümü') {
      tempTasks = tempTasks.filter(task => task.status === selectedStatusFilter);
    }
    
    // Filtrelenmiş görevleri state'e kaydet
    setFilteredTasks(tempTasks);
  }, [params.categoryFilter, selectedStatusFilter, tasks]);


  // ========== EVENT HANDLERS ==========
  
  /**
   * Yeni görev ekleme butonuna tıklandığında çalışır
   */
  const handleAddTaskPress = () => {
    console.log("Navigating to /createTask");
    router.push('/createTask');  // Görev oluşturma sayfasına yönlendir
  };

  /**
   * AI asistan butonuna tıklandığında çalışır
   */
  const handleAiSuggestionsPress = () => {
      console.log("Navigating to AI Chat");
      router.push('/chatbot');  // AI chatbot sayfasına yönlendir
  };

  // ========== STYLE HELPER FONKSİYONLARI ==========
  /**
   * Filtre chip'inin stilini döndürür (seçiliyse aktif stil)
   */
  const getFilterChipStyle = (filter: StatusFilter) => [ 
    styles.filterChip, 
    selectedStatusFilter === filter && styles.filterChipActive 
  ];
  
  /**
   * Filtre chip metninin stilini döndürür (seçiliyse aktif stil)
   */
  const getFilterTextStyle = (filter: StatusFilter) => [ 
    styles.filterChipText, 
    selectedStatusFilter === filter && styles.filterChipTextActive 
  ];

  // ========== GÖREV İŞLEMLERİ ==========
  
  /**
   * Görev kartına tıklandığında detay sayfasına yönlendir
   */
  const handleTaskPress = (taskId: string) => {
    router.push({
      pathname: '/taskDetail',
      params: { taskId }
    });
  };

  /**
   * Görevi silme fonksiyonu (onay diyaloğu ile)
   */
  const handleDeleteTask = async (taskId: string, taskTitle: string) => {
    Alert.alert(
      'Görevi Sil',
      `"${taskTitle}" görevini silmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            try {
              await deleteTask(token, taskId);
              // Görevler otomatik olarak yenilenecek (deleteTask içinde fetchTasks çağrılacak)
              // Başarı mesajı göster
              Alert.alert('Başarılı', 'Görev başarıyla silindi');
              // Görevleri manuel olarak yenile (sayfanın güncellenmesi için)
              await loadTasks();
            } catch (error: any) {
              Alert.alert('Hata', error.response?.data?.detail || 'Görev silinemedi. Lütfen tekrar deneyin.');
            }
          },
        },
      ]
    );
  };

  // ========== RENDER ==========
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ========== HEADER BÖLÜMÜ ========== */}
      {/* Üst kısım: Karşılama mesajı ve AI butonu */}
      <View style={styles.header}>
         <View>
             <Text style={styles.greeting}>Merhaba, {user?.username || 'Kullanıcı'}!</Text>
             <Text style={styles.taskCount}>{tasks?.length || 0} göreviniz var</Text>
         </View>
         {/* AI Asistan Butonu */}
         <TouchableOpacity onPress={handleAiSuggestionsPress} style={styles.aiButton}>
             <Ionicons name="sparkles" size={24} color="#FFFFFF" />
         </TouchableOpacity>
      </View>

      {/* ========== KATEGORİ FİLTRE BİLGİSİ ========== */}
      {/* Eğer kategori filtresi aktifse, hangi kategoride olduğunu göster */}
       {params.categoryFilter && (
             <View style={styles.filterInfoContainer}>
                 <Text style={styles.filterInfoText}>Kategori: {params.categoryFilter}</Text>
                 {/* Filtreyi kaldırma butonu */}
                 <TouchableOpacity onPress={() => router.setParams({ categoryFilter: undefined })}>
                     <Ionicons name="close-circle" size={20} color="#AEAEB2" />
                 </TouchableOpacity>
             </View>
        )}

      {/* ========== DURUM FİLTRE BUTONLARI ========== */}
      {/* Yatay kaydırılabilir filtre butonları */}
      <View style={styles.filterContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.filterScroll}
          >
              {STATUS_FILTERS.map(filter => (
                  <TouchableOpacity
                      key={filter}
                      style={getFilterChipStyle(filter)}
                      onPress={() => setSelectedStatusFilter(filter)}  // Filtre seçildiğinde state'i güncelle
                  >
                      <Text style={getFilterTextStyle(filter)}>{filter}</Text>
                  </TouchableOpacity>
              ))}
          </ScrollView>
      </View>


      {/* ========== GÖREV LİSTESİ ========== */}
      <ScrollView
        style={styles.taskList}
        contentContainerStyle={{ paddingBottom: 100 }}  // FAB (Floating Action Button) için altta boşluk
        refreshControl={
          <RefreshControl 
            refreshing={loading} 
            onRefresh={loadTasks}  // Aşağı çekince görevleri yenile
            tintColor="#6C63FF" 
          />
        }
      >
        {/* Yükleme göstergesi - sadece ilk yüklemede göster */}
        {loading && filteredTasks.length === 0 && (
          <ActivityIndicator size="large" color="#6C63FF" style={{marginTop: 50}} />
        )}
        
        {/* Boş durum - görev yoksa */}
        {!loading && filteredTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={60} color="#8E8E93" />
            <Text style={styles.emptyText}>Henüz görev yok</Text>
            <Text style={styles.emptySubtext}>Yeni bir görev ekleyerek başlayın</Text>
          </View>
        )}
        
        {/* Görev kartlarını listele */}
        {filteredTasks.map(task => {
          // Task null/undefined kontrolü
          if (!task || !task.id) {
            return null;
          }
          return (
            <TaskCard
              key={task.id}
              task={task}
              onPress={() => handleTaskPress(task.id)}
              onDelete={() => handleDeleteTask(task.id, task.title || 'Görev')}
            />
          );
        })}
      </ScrollView>

      {/* ========== FLOATING ACTION BUTTON (FAB) ========== */}
      {/* Yeni görev ekleme butonu - sağ altta sabit */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddTaskPress}>
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// ========== STYLES ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1E' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 28, fontWeight: 'bold', color: '#FFFFFF' },
  taskCount: { fontSize: 14, color: '#8E8E93', marginTop: 4 },
  aiButton: { backgroundColor: '#6C63FF', padding: 10, borderRadius: 20 },
  filterInfoContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 8, backgroundColor: '#1C1C2E', marginHorizontal: 24, borderRadius: 15, marginTop: 10, gap: 8 },
  filterInfoText: { color: '#AEAEB2', fontSize: 14 },
  filterContainer: { paddingVertical: 12, paddingLeft: 24 },
  filterScroll: { paddingRight: 24, gap: 12 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1C1C2E', borderWidth: 1, borderColor: '#2C2C3E' },
  filterChipActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  filterChipText: { color: '#AEAEB2', fontWeight: '600' },
  filterChipTextActive: { color: '#FFFFFF' },
  taskList: { flex: 1, paddingHorizontal: 24, marginTop: 10 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyText: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#8E8E93', marginTop: 8, textAlign: 'center' },
  addButton: { position: 'absolute', bottom: 80, right: 24, backgroundColor: '#6C63FF', width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 5 },
  taskCard: { 
    backgroundColor: '#1C1C2E', 
    padding: 16, 
    borderRadius: 12, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#2C2C3E' 
  },
  taskTitle: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  taskFooter: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
  taskStatus: { color: '#AEAEB2', fontSize: 12 },
  taskCategory: { color: '#AEAEB2', fontSize: 12, fontWeight: '500' },
  progressBarContainer: { height: 4, backgroundColor: '#2C2C3E', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#6C63FF' },
  // Swipe-to-delete stilleri
  deleteActionContainer: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'flex-end',
    borderRadius: 12,
    marginBottom: 12,
    paddingRight: 20,
    width: 100,
  },
  deleteActionButton: {
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 20,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
});