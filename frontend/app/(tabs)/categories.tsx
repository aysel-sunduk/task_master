import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { Task, useTaskStore } from '../../store/taskStore'; // Task tipini import et

const CATEGORY_COLORS = [ '#6C63FF', '#4CAF50', '#FF9800', '#F44336', '#2196F3', '#9C27B0', '#00BCD4', '#FFEB3B', '#FF5722', '#795548' ];
const CATEGORY_ICONS = [ 'briefcase', 'home', 'fitness', 'book', 'cart', 'heart', 'airplane', 'restaurant', 'game-controller', 'code-slash' ];

interface CategoryGroup {
  name: string;
  count: number;
  completed: number;
  tasks: Task[];
}

export default function CategoriesScreen() {
  const { token } = useAuth();
  const { fetchTasks, loading } = useTaskStore();
  const router = useRouter();
  const [categories, setCategories] = useState<CategoryGroup[]>([]);

  const loadCategories = useCallback(async (showLoadingIndicator = true) => {
    console.log("[CategoriesScreen] loadCategories triggered"); // Log
    if (!token) {
        console.log("[CategoriesScreen] No token, exiting loadCategories"); // Log
        return;
    }
    
    let fetchedTasks: Task[] = [];
    try {
        console.log("[CategoriesScreen] Calling fetchTasks..."); // Log
        // fetchTasks artık Task[] döndürecek
        fetchedTasks = await fetchTasks(token);
        console.log(`[CategoriesScreen] fetchTasks completed, received ${fetchedTasks.length} tasks.`); // Log
    } catch (error) {
        console.error("[CategoriesScreen] Error calling fetchTasks:", error); // Log
    }

    // Dönen sonucu (fetchedTasks) kullanarak kategorileri hesapla
    const categoryMap: { [key: string]: CategoryGroup } = {};
    if (Array.isArray(fetchedTasks)) {
      fetchedTasks.forEach(task => {
        // <<< API yanıtınıza göre burayı kontrol edin: task.category mi task.category_id mi? >>>
        // Backend yanıtındaki category_name'i kullan
        const catName = task.category_name || 'Genel';
        
        if (!categoryMap[catName]) {
          categoryMap[catName] = { name: catName, count: 0, completed: 0, tasks: [] };
        }
        categoryMap[catName].count++;
        categoryMap[catName].tasks.push(task);
        if (task.status === 'Tamamlandı') {
          categoryMap[catName].completed++;
        }
      });
    }

    const categoriesArray = Object.values(categoryMap);
    console.log(`[CategoriesScreen] Calculated ${categoriesArray.length} categories.`); // Log
    setCategories(categoriesArray);
  }, [token, fetchTasks]);

  useFocusEffect(
    useCallback(() => {
      console.log("[CategoriesScreen] Screen focused, calling loadCategories."); // Log
      if (token) {
        loadCategories(false); 
      }
      // Cleanup function (isteğe bağlı)
      // return () => console.log("[CategoriesScreen] Screen unfocused");
    }, [token, loadCategories])
  );

  const getCategoryColor = (index: number) => CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  const getCategoryIcon = (index: number) => CATEGORY_ICONS[index % CATEGORY_ICONS.length] as keyof typeof Ionicons.glyphMap;

  console.log(`[CategoriesScreen] Rendering with ${categories.length} categories. Loading: ${loading}`); // Render log

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Kategoriler</Text>
        <Text style={styles.subtitle}>{categories?.length || 0} kategori</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => loadCategories(true)} tintColor="#6C63FF" />
        }
      >
        {/* Yükleme durumunu daha belirgin gösterelim */}
        {loading && categories.length === 0 && (
          <View style={styles.loadingContainer}>
             <ActivityIndicator size="large" color="#6C63FF" />
             <Text style={styles.loadingText}>Kategoriler Yükleniyor...</Text>
          </View>
        )}

        {!loading && categories.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="grid-outline" size={80} color="#8E8E93" />
            <Text style={styles.emptyText}>Henüz kategori yok</Text>
            <Text style={styles.emptySubtext}>Görev ekleyerek kategoriler oluşturun</Text>
          </View>
        ) : (
          <View style={styles.categoryGrid}>
            {categories.map((category, index) => {
              const completionRate = category.count > 0 ? Math.round((category.completed / category.count) * 100) : 0;
              return (
                <TouchableOpacity
                  key={category.name}
                  style={[ styles.categoryCard, { borderLeftColor: getCategoryColor(index), borderLeftWidth: 4 } ]}
                  onPress={() => router.push({ pathname: '/(tabs)/home', params: { categoryFilter: category.name } })}
                >
                  <View style={[ styles.categoryIconContainer, { backgroundColor: getCategoryColor(index) + '20' }]} >
                    <Ionicons name={getCategoryIcon(index)} size={32} color={getCategoryColor(index)} />
                  </View>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <View style={styles.categoryStats}>
                    <View style={styles.statItem}>
                      <Ionicons name="list" size={16} color="#8E8E93" />
                      <Text style={styles.statText}>{category.count || 0} görev</Text>
                    </View>
                    <View style={styles.statItem}>
                      <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                      <Text style={styles.statText}>{category.completed || 0} tamamlandı</Text>
                    </View>
                  </View>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View style={[ styles.progressFill, { width: `${completionRate || 0}%`, backgroundColor: getCategoryColor(index) }]} />
                    </View>
                    <Text style={styles.progressText}>{completionRate || 0}%</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Stiller güncellendi (loading için)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1E' },
  header: { paddingHorizontal: 24, paddingVertical: 16 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#FFFFFF' },
  subtitle: { fontSize: 14, color: '#8E8E93', marginTop: 4 },
  content: { flex: 1, paddingHorizontal: 24 },
  loadingContainer: { // Yeni stil
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 50,
  },
   loadingText: { // Yeni stil
    marginTop: 10,
    color: '#AEAEB2',
    fontSize: 16,
  },
  emptyState: { alignItems: 'center', paddingTop: 100 },
  emptyText: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#8E8E93', marginTop: 8 },
  categoryGrid: { flexDirection: 'column', gap: 16, paddingBottom: 24, },
  categoryCard: { backgroundColor: '#1C1C2E', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#2C2C3E' },
  categoryIconContainer: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  categoryName: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 12 },
  categoryStats: { gap: 8, marginBottom: 16 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 14, color: '#8E8E93' },
  progressContainer: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  progressBar: { flex: 1, height: 8, backgroundColor: '#2C2C3E', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%' },
  progressText: { fontSize: 14, color: '#FFFFFF', fontWeight: '600', minWidth: 40, textAlign: 'right' },
});