import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { useTaskStore } from '../store/taskStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import RNPickerSelect from 'react-native-picker-select';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
}

const PRIORITIES = ['Düşük', 'Orta', 'Yüksek', 'Acil'];
const STATUSES = ['Yapılacak', 'Devam Ediyor', 'Tamamlandı'];
const PERCENTAGES = [0, 25, 50, 75, 100];

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

export default function CreateTaskScreen() {
  const { token } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams();

  const taskIdParam = params.taskId;
  const taskId = Array.isArray(taskIdParam) ? taskIdParam[0] : taskIdParam;
  const isEditMode = !!taskId;

  const initialTitleParam = params.prefillTitle;
  const initialTitle = Array.isArray(initialTitleParam)
    ? initialTitleParam[0] || ''
    : initialTitleParam || '';

  const [title, setTitle] = useState<string>(initialTitle);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState('');
  const [priority, setPriority] = useState('Orta');
  const [status, setStatus] = useState('Yapılacak');
  const [completionPercentage, setCompletionPercentage] = useState(0);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingTask, setLoadingTask] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      if (!token) return;
      try {
        const response = await axios.get(
          `${API_URL}/api/categories`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setCategories(response.data);

        const defaultCategory = response.data.find((cat: Category) => cat.name === 'Genel');
        if (defaultCategory && !isEditMode) {
          setCategoryId(defaultCategory.id);
        } else if (response.data.length > 0 && !isEditMode) {
          setCategoryId(response.data[0].id);
        }
      } catch (error: any) {
        console.error('Kategoriler alınırken hata oluştu:', error);
        // 401 hatası - Token geçersiz
        if (error.response?.status === 401) {
          Alert.alert(
            'Oturum Süresi Doldu',
            'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.',
            [
              {
                text: 'Tamam',
                onPress: () => {
                  // Logout yap ve login sayfasına yönlendir
                  router.replace('/(auth)/login');
                },
              },
            ]
          );
        } else {
          Alert.alert('Hata', error.response?.data?.detail || 'Kategoriler yüklenemedi.');
        }
      }
    };
    fetchCategories();
  }, [token, isEditMode]);

  useEffect(() => {
    const fetchTask = async () => {
      if (!taskId || !token || !isEditMode) return;
      
      setLoadingTask(true);
      try {
        const response = await axios.get(
          `${API_URL}/api/tasks/${taskId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const task = response.data;
        
        setTitle(task.title || '');
        setDescription(task.description || '');
        setCategoryId(task.category_id || null);
        setTags(task.tags?.join(', ') || '');
        setPriority(task.priority || 'Orta');
        setStatus(task.status || 'Yapılacak');
        setCompletionPercentage(task.completion_percentage || 0);
        setImages(task.images || []);
      } catch (error: any) {
        console.error('Görev yüklenirken hata oluştu:', error);
        Alert.alert('Hata', error.response?.data?.detail || 'Görev yüklenemedi');
        router.back();
      } finally {
        setLoadingTask(false);
      }
    };
    
    fetchTask();
  }, [taskId, token, isEditMode]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeri erişimi için izin vermeniz gerekiyor');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      setImages([...images, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_: string, i: number) => i !== index));
  };

  const handleCreateTask = async () => {
    if (!title || !categoryId) {
      Alert.alert('Hata', 'Başlık ve Kategori alanları zorunludur');
      return;
    }
    if (!token) {
      Alert.alert('Hata', 'Giriş yapılmamış. Lütfen tekrar giriş yapın.');
      return;
    }

    setLoading(true);
    try {
      const taskData = {
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        tags: tags.split(',').map((t: string) => t.trim()).filter((t: string) => t),
        priority,
        status,
        completion_percentage: completionPercentage,
        images,
        due_date: null,
      };

      if (isEditMode && taskId) {
        // Güncelleme modu - taskStore kullan
        const { updateTask } = useTaskStore.getState();
        await updateTask(token, taskId, taskData);
        Alert.alert('Başarılı', 'Görev başarıyla güncellendi');
      } else {
        // Oluşturma modu - taskStore kullan
        const { createTask: createTaskInStore } = useTaskStore.getState();
        await createTaskInStore(token, taskData);
      Alert.alert('Başarılı', 'Görev başarıyla oluşturuldu');
      }

      router.push('/(tabs)/home');

    } catch (error: any) {
      console.error('Görev işlemi sırasında hata oluştu:', error.response?.data || error);
      const errorMessage = error.response?.data?.detail || 
        (isEditMode ? 'Görev güncellenemedi' : 'Görev oluşturulamadı');
      Alert.alert('Hata', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Bu kısım doğru görünüyor, label=isim, value=id eşleşmesi yapılıyor.
  const pickerItems = categories.map((cat) => ({
    label: cat.name,
    value: cat.id,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Görevi Düzenle' : 'Yeni Görev'}</Text>
        <View style={styles.placeholder} />
      </View>
    <KeyboardAvoidingView
        style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >

        {loadingTask && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text style={styles.loadingText}>Görev yükleniyor...</Text>
          </View>
        )}

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
            onValueChange={(value: string) => {
              // >>> DEBUG LOG: Kategori seçildiğinde state'in güncellendiğini kontrol et
              console.log('Category selected in Picker:', value); // BU LOG ÖNEMLİ
              setCategoryId(value);
              // <<< DEBUG LOG SONU
            }}
            items={pickerItems}
            style={pickerSelectStyles}
            value={categoryId} // State'deki güncel değeri gösterir
            placeholder={{ label: 'Bir kategori seçin...', value: null }}
            useNativeAndroidPickerStyle={false}
            Icon={() => <Ionicons name="chevron-down" size={24} color="#8E8E93" />}
          />
        </View>

        {/* Diğer alanlar aynı kaldı... */}
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

        <Text style={styles.label}>Resimler</Text>
        <ScrollView horizontal style={styles.imageList}>
          {images.map((imgBase64, index) => (
            <View key={index} style={styles.imageWrapper}>
              <Image source={{ uri: imgBase64 }} style={styles.imagePreview} />
              <TouchableOpacity onPress={() => handleRemoveImage(index)} style={styles.imageRemove}>
                <Ionicons name="close-circle" size={24} color="#F44336" />
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.imageAddButton} onPress={handlePickImage}>
            <Ionicons name="add" size={32} color="#6C63FF" />
          </TouchableOpacity>
        </ScrollView>

        <TouchableOpacity
          style={[styles.saveButton, loading && styles.buttonDisabled]}
          onPress={handleCreateTask}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading 
              ? (isEditMode ? 'Güncelleniyor...' : 'Kaydediliyor...') 
              : (isEditMode ? 'Güncelle' : 'Kaydet')
            }
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Stiller aynı kaldı...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1E',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
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
  backButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
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
  imageList: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  imageRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#1C1C2E',
    borderRadius: 12,
  },
  imageAddButton: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#1C1C2E',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#6C63FF',
    borderStyle: 'dashed',
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
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#8E8E93',
    fontSize: 14,
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