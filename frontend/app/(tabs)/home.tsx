import React, { useCallback, useState, useEffect } from 'react'; // useEffect import edildi
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useAuth } from '../../contexts/AuthContext';
import { useTaskStore, Task } from '../../store/taskStore';

// Görev Kartı Component'i (Swipe to delete özelliği ile)
const TaskCard = ({ 
  task, 
  onPress, 
  onDelete 
}: { 
  task: Task; 
  onPress: () => void;
  onDelete: () => void;
}) => {
  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={onDelete}
    >
      <Ionicons name="trash" size={24} color="#FFFFFF" />
      <Text style={styles.deleteActionText}>Sil</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable renderRightActions={renderRightActions}>
  <TouchableOpacity style={styles.taskCard} onPress={onPress} activeOpacity={0.7}>
    <Text style={styles.taskTitle}>{task.title}</Text>
    <View style={styles.taskFooter}>
       <Text style={styles.taskStatus}>{task.status}</Text>
       <Text style={styles.taskCategory}>{task.category_name || task.category || 'Genel'}</Text>
    </View>
     <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, { width: `${task.completion_percentage || 0}%` }]} />
     </View>
  </TouchableOpacity>
    </Swipeable>
);
};

// Filtre seçenekleri
const STATUS_FILTERS = ['Tümü', 'Yapılacak', 'Devam Ediyor', 'Tamamlandı'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];


export default function HomeScreen() {
  const router = useRouter();
  const { token, user, logout } = useAuth();
  const { fetchTasks, tasks, loading, deleteTask } = useTaskStore();
  const params = useLocalSearchParams<{ categoryFilter?: string }>();
  
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<StatusFilter>('Tümü');
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!token) return;
    try {
      await fetchTasks(token);
    } catch (error: any) {
      console.error("Ana sayfada görevler yüklenirken hata:", error);
      // 401 hatası - Token geçersiz, logout yap
      if (error.response?.status === 401) {
        await logout();
        router.replace('/(auth)/login');
      }
    }
  }, [token, fetchTasks, router, logout]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks])
  );

  useEffect(() => {
    let tempTasks = tasks;
    if (params.categoryFilter) {
      tempTasks = tempTasks.filter(task => (task.category_name || task.category || 'Genel') === params.categoryFilter);
    }
    if (selectedStatusFilter !== 'Tümü') {
      tempTasks = tempTasks.filter(task => task.status === selectedStatusFilter);
    }
    setFilteredTasks(tempTasks);
  }, [params.categoryFilter, selectedStatusFilter, tasks]);


  const handleAddTaskPress = () => {
    console.log("Navigating to /createTask");
    router.push('/createTask'); // Doğru yol (app/createTask.tsx varsayılıyor)
  };

  const handleAiSuggestionsPress = () => {
      console.log("Navigating to Chatbot");
      router.push('/chatbot');
  };

  const getFilterChipStyle = (filter: StatusFilter) => [ styles.filterChip, selectedStatusFilter === filter && styles.filterChipActive ];
  const getFilterTextStyle = (filter: StatusFilter) => [ styles.filterChipText, selectedStatusFilter === filter && styles.filterChipTextActive ];

  const handleDeleteTask = (task: Task) => {
    if (!token) return;
    
    // Eğer bu görev zaten siliniyorsa, yeni bir silme işlemi başlatma
    if (deletingTaskId === task.id) {
      console.log(`[HomeScreen] Task ${task.id} is already being deleted, skipping...`);
      return;
    }
    
    Alert.alert(
      'Görevi Sil',
      `"${task.title}" görevini silmek istediğinize emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            // Çift tıklamayı önlemek için tekrar kontrol et
            if (deletingTaskId === task.id) {
              console.log(`[HomeScreen] Task ${task.id} is already being deleted, skipping...`);
              return;
            }
            try {
              setDeletingTaskId(task.id);
              await deleteTask(token, task.id);
              // Başarı mesajı gösterilmesine gerek yok, görev listeden kaldırılacak
            } catch (error: any) {
              console.error('Görev silinirken hata:', error);
              // 404 hatası (görev zaten silinmiş) sessizce geç
              if (error.response?.status !== 404) {
                Alert.alert('Hata', error.response?.data?.detail || 'Görev silinemedi');
              }
            } finally {
              setDeletingTaskId(null);
            }
          },
        },
      ]
    );
  };


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Başlık Bölümü - Ekran Görüntüsüne Göre */}
      <View style={styles.header}>
         <View>
             <Text style={styles.greeting}>Merhaba, {user?.username || 'Kullanıcı'}!</Text>
             <Text style={styles.taskCount}>{tasks.length} göreviniz var</Text>
         </View>
         <TouchableOpacity onPress={handleAiSuggestionsPress} style={styles.aiButton}>
             <Ionicons name="sparkles" size={24} color="#FFFFFF" />
         </TouchableOpacity>
      </View>

       {/* Kategori Filtresini Göster */}
       {params.categoryFilter && (
             <View style={styles.filterInfoContainer}>
                 <Text style={styles.filterInfoText}>Kategori: {params.categoryFilter}</Text>
                 <TouchableOpacity onPress={() => router.setParams({ categoryFilter: undefined })}>
                     <Ionicons name="close-circle" size={20} color="#AEAEB2" />
                 </TouchableOpacity>
             </View>
        )}

      {/* Durum Filtre Butonları */}
      <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              {STATUS_FILTERS.map(filter => (
                  <TouchableOpacity
                      key={filter}
                      style={getFilterChipStyle(filter)}
                      onPress={() => setSelectedStatusFilter(filter)}
                  >
                      <Text style={getFilterTextStyle(filter)}>{filter}</Text>
                  </TouchableOpacity>
              ))}
          </ScrollView>
      </View>


      {/* Görev Listesi */}
      <ScrollView
        style={styles.taskList}
        contentContainerStyle={{ paddingBottom: 100 }} // FAB için altta boşluk
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadTasks} tintColor="#6C63FF" />}
        nestedScrollEnabled={true}
      >
        {loading && filteredTasks.length === 0 && <ActivityIndicator size="large" color="#6C63FF" style={{marginTop: 50}} />}
        {!loading && filteredTasks.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={60} color="#8E8E93" />
            <Text style={styles.emptyText}>Henüz görev yok</Text>
            <Text style={styles.emptySubtext}>Yeni bir görev ekleyerek başlayın</Text>
          </View>
        )}
        {filteredTasks.map(task => (
             <TaskCard 
               key={task.id} 
               task={task} 
               onPress={() => router.push(`/taskDetail?taskId=${task.id}`)}
               onDelete={() => handleDeleteTask(task)}
             />
        ))}
      </ScrollView>

      {/* "+" Butonu */}
      <TouchableOpacity 
        style={styles.addButton} 
        onPress={handleAddTaskPress}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={30} color="white" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

// Stiller aynı kalır (önceki mesajdakiyle)
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
  taskCard: { backgroundColor: '#1C1C2E', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#2C2C3E' },
  taskTitle: { color: 'white', fontSize: 16, fontWeight: '600', marginBottom: 8 },
  taskFooter: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8},
  taskStatus: { color: '#AEAEB2', fontSize: 12 },
  taskCategory: { color: '#AEAEB2', fontSize: 12, fontWeight: '500' },
  progressBarContainer: { height: 4, backgroundColor: '#2C2C3E', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#6C63FF' },
  deleteAction: {
    backgroundColor: '#F44336',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginBottom: 12,
  },
  deleteActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginTop: 4,
    fontSize: 12,
  },
});