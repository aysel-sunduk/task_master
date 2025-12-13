import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTaskStore, Task } from '../store/taskStore';
import axios from 'axios';
import { Platform } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

export default function TaskDetailScreen() {
  const router = useRouter();
  const { taskId } = useLocalSearchParams<{ taskId: string }>();
  const { token } = useAuth();
  const { tasks, updateTask, deleteTask, fetchTasks } = useTaskStore();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTask();
  }, [taskId, token]);

  const loadTask = async () => {
    if (!taskId || !token) return;

    // Önce store'dan kontrol et
    const foundTask = tasks.find(t => t.id === taskId);
    if (foundTask) {
      setTask(foundTask);
      setLoading(false);
      return;
    }

    // Store'da yoksa API'den çek
    try {
      setLoading(true);
      const response = await axios.get<Task>(`${API_URL}/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTask(response.data);
    } catch (error: any) {
      console.error('Görev yüklenirken hata:', error);
      Alert.alert('Hata', error.response?.data?.detail || 'Görev yüklenemedi');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (!task || !token) return;

    Alert.alert(
      'Görevi Sil',
      'Bu görevi silmek istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteTask(token, task.id);
              router.back();
            } catch (error: any) {
              console.error('Görev silinirken hata:', error);
              // 404 hatası (görev zaten silinmiş) sessizce geç
              if (error.response?.status !== 404) {
              Alert.alert('Hata', error.response?.data?.detail || 'Görev silinemedi');
              } else {
                router.back();
              }
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!task || !token) return;

    try {
      const updatedTask = await updateTask(token, task.id, { status: newStatus });
      if (updatedTask) {
        setTask(updatedTask);
        Alert.alert('Başarılı', 'Görev durumu güncellendi');
      }
    } catch (error: any) {
      console.error('Görev güncellenirken hata:', error);
      Alert.alert('Hata', error.response?.data?.detail || 'Görev güncellenemedi');
    }
  };

  const handleCompletionChange = async (newPercentage: number) => {
    if (!task || !token) return;

    try {
      const updatedTask = await updateTask(token, task.id, { completion_percentage: newPercentage });
      if (updatedTask) {
        setTask(updatedTask);
      }
    } catch (error: any) {
      console.error('Görev güncellenirken hata:', error);
      Alert.alert('Hata', error.response?.data?.detail || 'Görev güncellenemedi');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Acil': return '#F44336';
      case 'Yüksek': return '#FF9800';
      case 'Orta': return '#FFC107';
      case 'Düşük': return '#4CAF50';
      default: return '#808080';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Tamamlandı': return '#4CAF50';
      case 'Devam Ediyor': return '#2196F3';
      case 'Yapılacak': return '#FF9800';
      default: return '#808080';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Yükleniyor...</Text>
      </View>
    );
  }

  if (!task) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#F44336" />
        <Text style={styles.errorText}>Görev bulunamadı</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backIcon}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Görev Detayı</Text>
        <TouchableOpacity 
          onPress={handleDelete} 
          style={styles.deleteButton} 
          disabled={deleting}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#F44336" />
          ) : (
            <Ionicons name="trash-outline" size={24} color="#F44336" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Başlık */}
        <View style={styles.section}>
          <Text style={styles.title}>{task.title}</Text>
          {task.description && (
            <Text style={styles.description}>{task.description}</Text>
          )}
        </View>

        {/* Kategori ve Öncelik */}
        <View style={styles.section}>
          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Ionicons name="folder-outline" size={20} color="#8E8E93" />
              <Text style={styles.infoText}>
                {task.category_name || task.category || 'Genel'}
              </Text>
            </View>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(task.priority) }]}>
              <Text style={styles.priorityText}>{task.priority}</Text>
            </View>
          </View>
        </View>

        {/* Durum */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Durum</Text>
          <View style={styles.statusContainer}>
            {['Yapılacak', 'Devam Ediyor', 'Tamamlandı'].map((status) => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.statusButton,
                  task.status === status && { backgroundColor: getStatusColor(status) },
                ]}
                onPress={() => handleStatusChange(status)}
              >
                <Text
                  style={[
                    styles.statusButtonText,
                    task.status === status && styles.statusButtonTextActive,
                  ]}
                >
                  {status}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* İlerleme */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İlerleme: {task.completion_percentage}%</Text>
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${task.completion_percentage || 0}%` },
              ]}
            />
          </View>
          <View style={styles.percentageButtons}>
            {[0, 25, 50, 75, 100].map((percentage) => (
              <TouchableOpacity
                key={percentage}
                style={[
                  styles.percentageButton,
                  task.completion_percentage === percentage && styles.percentageButtonActive,
                ]}
                onPress={() => handleCompletionChange(percentage)}
              >
                <Text
                  style={[
                    styles.percentageButtonText,
                    task.completion_percentage === percentage && styles.percentageButtonTextActive,
                  ]}
                >
                  {percentage}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Etiketler */}
        {task.tags && task.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Etiketler</Text>
            <View style={styles.tagsContainer}>
              {task.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Resimler */}
        {task.images && task.images.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resimler</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {task.images.map((image, index) => (
                <Image key={index} source={{ uri: image }} style={styles.image} />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Tarih Bilgileri */}
        <View style={styles.section}>
          <View style={styles.dateRow}>
            <View style={styles.dateItem}>
              <Ionicons name="calendar-outline" size={16} color="#8E8E93" />
              <Text style={styles.dateLabel}>Oluşturulma:</Text>
              <Text style={styles.dateValue}>
                {new Date(task.created_at).toLocaleDateString('tr-TR')}
              </Text>
            </View>
            {task.updated_at && (
              <View style={styles.dateItem}>
                <Ionicons name="time-outline" size={16} color="#8E8E93" />
                <Text style={styles.dateLabel}>Güncelleme:</Text>
                <Text style={styles.dateValue}>
                  {new Date(task.updated_at).toLocaleDateString('tr-TR')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Düzenle Butonu */}
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => router.push(`/createTask?taskId=${task.id}`)}
        >
          <Ionicons name="create-outline" size={20} color="#FFFFFF" />
          <Text style={styles.editButtonText}>Düzenle</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1E',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F1E',
  },
  loadingText: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F1E',
    padding: 24,
  },
  errorText: {
    marginTop: 16,
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C3E',
  },
  backIcon: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  deleteButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#AEAEB2',
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  priorityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1C1C2E',
    borderWidth: 1,
    borderColor: '#2C2C3E',
  },
  statusButtonText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  statusButtonTextActive: {
    color: '#FFFFFF',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#2C2C3E',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
  },
  percentageButtons: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  percentageButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#1C1C2E',
    borderWidth: 1,
    borderColor: '#2C2C3E',
  },
  percentageButtonActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  percentageButtonText: {
    color: '#8E8E93',
    fontSize: 12,
    fontWeight: '600',
  },
  percentageButtonTextActive: {
    color: '#FFFFFF',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#1C1C2E',
    borderWidth: 1,
    borderColor: '#2C2C3E',
  },
  tagText: {
    color: '#AEAEB2',
    fontSize: 12,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginRight: 12,
  },
  dateRow: {
    gap: 12,
  },
  dateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#8E8E93',
    marginLeft: 4,
  },
  dateValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6C63FF',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#6C63FF',
    borderRadius: 12,
  },
  backButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});



