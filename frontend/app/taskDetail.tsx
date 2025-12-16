/**
 * TaskMaster - Görev Detay Sayfası
 * ==================================
 * Bu ekran, görev detaylarını gösterir ve düzenleme yapılmasını sağlar.
 */

import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTaskStore } from '../store/taskStore';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

const PRIORITIES = ['Düşük', 'Orta', 'Yüksek', 'Acil'];
const STATUSES = ['Yapılacak', 'Devam Ediyor', 'Tamamlandı'];
const PERCENTAGES = [0, 25, 50, 75, 100];

export default function TaskDetailScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ taskId: string }>();
  const { fetchTasks, deleteTask } = useTaskStore();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState('Orta');
  const [status, setStatus] = useState('Yapılacak');
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // Görev detaylarını yükle
  useEffect(() => {
    if (!params.taskId || !token) return;
    
    const loadTask = async () => {
      try {
        const response = await axios.get(
          `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tasks/${params.taskId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        
        const task = response.data;
        setTitle(task.title || '');
        setDescription(task.description || '');
        setCategoryId(task.category_id || null);
        setTags((task.tags || []).join(', '));
        setPriority(task.priority || 'Orta');
        setStatus(task.status || 'Yapılacak');
        setCompletionPercentage(task.completion_percentage || 0);
        setImages(task.images || []);
      } catch (error: any) {
        console.error('Görev yüklenirken hata:', error);
        Alert.alert('Hata', 'Görev yüklenemedi');
        router.back();
      }
    };

    loadTask();
  }, [params.taskId, token]);

  // Kategorileri yükle
  useEffect(() => {
    if (!token) return;
    
    const fetchCategories = async () => {
      try {
        const response = await axios.get(
          `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/categories`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setCategories(response.data);
      } catch (error) {
        console.error('Kategoriler yüklenirken hata:', error);
      }
    };
    
    fetchCategories();
  }, [token]);

  // Görevi güncelle
  const handleUpdateTask = async () => {
    if (!title || !categoryId || !token || !params.taskId) {
      Alert.alert('Hata', 'Başlık ve Kategori alanları zorunludur');
      return;
    }

    setLoading(true);
    try {
      await axios.put(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tasks/${params.taskId}`,
        {
          title: title.trim(),
          description: description.trim(),
          category_id: categoryId,
          tags: tags.split(',').map(t => t.trim()).filter(t => t),
          priority,
          status,
          completion_percentage: completionPercentage,
          images,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      await fetchTasks(token);
      Alert.alert('Başarılı', 'Görev güncellendi');
      setIsEditing(false);
    } catch (error: any) {
      console.error('Görev güncellenirken hata:', error);
      Alert.alert('Hata', error.response?.data?.detail || 'Görev güncellenemedi');
    } finally {
      setLoading(false);
    }
  };

  // Görevi sil
  const handleDeleteTask = async () => {
    if (!token || !params.taskId) return;

    Alert.alert(
      'Görevi Sil',
      `"${title || 'Bu görev'}" görevini silmek istediğinizden emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTask(token, params.taskId);
              Alert.alert('Başarılı', 'Görev başarıyla silindi');
              // Görevleri yenile (sayfanın güncellenmesi için)
              await fetchTasks(token);
              router.back();
            } catch (error: any) {
              Alert.alert('Hata', error.response?.data?.detail || 'Görev silinemedi');
            }
          },
        },
      ]
    );
  };

  const pickerItems = categories.map((cat) => ({
    label: cat.name,
    value: cat.id,
  }));

  if (!isEditing) {
    // Görüntüleme modu
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Görev Detayı</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editButton}>
              <Ionicons name="create-outline" size={24} color="#6C63FF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDeleteTask} style={styles.deleteButton}>
              <Ionicons name="trash-outline" size={24} color="#F44336" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>{title || 'Başlıksız Görev'}</Text>
            {description ? (
              <Text style={styles.detailDescription}>{description}</Text>
            ) : null}
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Kategori:</Text>
              <Text style={styles.detailValue}>
                {categories.find(c => c.id === categoryId)?.name || 'Genel'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Öncelik:</Text>
              <Text style={styles.detailValue}>{priority}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Durum:</Text>
              <Text style={styles.detailValue}>{status}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>İlerleme:</Text>
              <Text style={styles.detailValue}>{completionPercentage}%</Text>
            </View>

            {tags ? (
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Etiketler:</Text>
                <Text style={styles.detailValue}>{tags}</Text>
              </View>
            ) : null}

            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${completionPercentage}%` }]} />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Düzenleme modu
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setIsEditing(false)}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Görevi Düzenle</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.label}>Başlık *</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Görev başlığı..."
            placeholderTextColor="#8E8E93"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Açıklama</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Görev detayları..."
            placeholderTextColor="#8E8E93"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <Text style={styles.label}>Kategori *</Text>
          <View style={styles.pickerContainer}>
            <RNPickerSelect
              onValueChange={(value: string) => setCategoryId(value)}
              items={pickerItems}
              style={pickerSelectStyles}
              value={categoryId}
              placeholder={{ label: 'Bir kategori seçin...', value: null }}
              useNativeAndroidPickerStyle={false}
              Icon={() => <Ionicons name="chevron-down" size={24} color="#8E8E93" />}
            />
          </View>

          <Text style={styles.label}>Etiketler (virgülle ayırın)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="etiket1, etiket2..."
            placeholderTextColor="#8E8E93"
            value={tags}
            onChangeText={setTags}
          />

          <Text style={styles.label}>Öncelik</Text>
          <View style={styles.chipGroup}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, priority === p && styles.chipActive]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.chipText, priority === p && styles.chipTextActive]}>
                  {p}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Durum</Text>
          <View style={styles.chipGroup}>
            {STATUSES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, status === s && styles.chipActive]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.chipText, status === s && styles.chipTextActive]}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>İlerleme: {completionPercentage}%</Text>
          <View style={styles.chipGroup}>
            {PERCENTAGES.map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.chip,
                  completionPercentage === p && styles.chipActive,
                  { minWidth: 60, justifyContent: 'center' },
                ]}
                onPress={() => setCompletionPercentage(p)}
              >
                <Text style={[styles.chipText, completionPercentage === p && styles.chipTextActive]}>
                  {p}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.saveButton, loading && styles.buttonDisabled]}
            onPress={handleUpdateTask}
            disabled={loading}
          >
            <Text style={styles.saveButtonText}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C3E',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 16,
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  detailCard: {
    backgroundColor: '#1C1C2E',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2C2C3E',
  },
  detailTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  detailDescription: {
    fontSize: 16,
    color: '#AEAEB2',
    marginBottom: 16,
    lineHeight: 22,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#8E8E93',
  },
  detailValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#2C2C3E',
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#6C63FF',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  label: {
    fontSize: 16,
    color: '#AEAEB2',
    marginBottom: 8,
    marginTop: 16,
  },
  textInput: {
    backgroundColor: '#1C1C2E',
    color: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2C2C3E',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 16,
  },
  pickerContainer: {
    backgroundColor: '#1C1C2E',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2C3E',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1C1C2E',
    borderWidth: 1,
    borderColor: '#2C2C3E',
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: '#6C63FF',
    borderColor: '#6C63FF',
  },
  chipText: {
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  saveButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
});

const pickerSelectStyles = StyleSheet.create({
  inputIOS: {
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    color: 'white',
    height: 56,
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    color: 'white',
    height: 56,
  },
  iconContainer: {
    top: 16,
    right: 16,
  },
  placeholder: {
    color: '#8E8E93',
  },
});
