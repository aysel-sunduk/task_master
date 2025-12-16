/**
 * TaskMaster - Görev Oluşturma/Düzenleme Ekranı
 * ==============================================
 * Bu ekran, yeni görev oluşturma veya mevcut görevi düzenleme işlemlerini yapar.
 * 
 * Özellikler:
 * - Görev başlığı ve açıklama girişi
 * - Kategori seçimi (dropdown)
 * - Öncelik seviyesi seçimi
 * - Durum seçimi
 * - İlerleme yüzdesi ayarlama
 * - Etiket ekleme
 * - Resim ekleme (galeri)
 * - Form validasyonu
 */

import { Ionicons } from '@expo/vector-icons'; // İkonlar
import axios from 'axios'; // HTTP istekleri
import * as ImagePicker from 'expo-image-picker'; // Resim seçme
import { useLocalSearchParams, useRouter } from 'expo-router'; // Navigasyon
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select'; // Dropdown picker
import { useAuth } from '../contexts/AuthContext'; // Authentication

// ========== TYPE DEFINITIONS ==========

/**
 * Kategori interface
 */
interface Category {
  id: string;  // Kategori ID'si
  name: string;  // Kategori adı
  color: string;  // Kategori rengi
  icon: string;  // Kategori ikonu
}

// ========== CONSTANTS ==========
// Öncelik seviyeleri
const PRIORITIES = ['Düşük', 'Orta', 'Yüksek', 'Acil'];
// Görev durumları
const STATUSES = ['Yapılacak', 'Devam Ediyor', 'Tamamlandı'];
// İlerleme yüzdesi seçenekleri
const PERCENTAGES = [0, 25, 50, 75, 100];

/**
 * CreateTaskScreen Component
 * ===========================
 * Görev oluşturma/düzenleme formu
 */
export default function CreateTaskScreen() {
  // ========== HOOKS ==========
  const { token } = useAuth();  // JWT token
  const router = useRouter();  // Navigasyon
  const params = useLocalSearchParams();  // URL parametreleri

  // ========== INITIAL VALUES ==========
  // URL'den gelen ön doldurulmuş başlık (AI önerilerinden gelebilir)
  const initialTitleParam = params.prefillTitle;
  const initialTitle = Array.isArray(initialTitleParam)
    ? initialTitleParam[0] || ''
    : initialTitleParam || '';

  // ========== STATE HOOKS ==========
  const [title, setTitle] = useState<string>(initialTitle);  // Görev başlığı
  const [description, setDescription] = useState('');  // Görev açıklaması
  const [categoryId, setCategoryId] = useState<string | null>(null);  // Seçili kategori ID'si
  const [categories, setCategories] = useState<Category[]>([]);  // Kategoriler listesi
  const [tags, setTags] = useState('');  // Etiketler (virgülle ayrılmış string)
  const [priority, setPriority] = useState('Orta');  // Öncelik seviyesi
  const [status, setStatus] = useState('Yapılacak');  // Görev durumu
  const [completionPercentage, setCompletionPercentage] = useState(0);  // Tamamlanma yüzdesi
  const [images, setImages] = useState<string[]>([]);  // Resimler (base64 array)
  const [loading, setLoading] = useState(false);  // Form gönderme durumu

  // ========== EFFECT: KATEGORİLERİ YÜKLE ==========
  // Component mount olduğunda kategorileri backend'den yükle
  useEffect(() => {
    const fetchCategories = async () => {
      if (!token) return;  // Token yoksa işlem yapma
      
      try {
        // Backend'den kategorileri getir
        const response = await axios.get(
          `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/categories`,
          {
            headers: { Authorization: `Bearer ${token}` },  // JWT token header'a ekle
          }
        );
        
        setCategories(response.data);  // Kategorileri state'e kaydet
        console.log('Fetched Categories:', response.data);

        // Varsayılan kategoriyi seç (Genel varsa onu, yoksa ilk kategoriyi)
        const defaultCategory = response.data.find((cat: Category) => cat.name === 'Genel');
        if (defaultCategory) {
          setCategoryId(defaultCategory.id);
          console.log('Default category set to Genel:', defaultCategory.id);
        } else if (response.data.length > 0) {
          setCategoryId(response.data[0].id);
          console.log('Default category set to first available:', response.data[0].id);
        }
      } catch (error: any) {
        console.error('Kategoriler alınırken hata oluştu:', error);
        
        // 401 hatası - Token geçersiz veya süresi dolmuş
        if (error.response?.status === 401) {
          Alert.alert(
            'Oturum Süresi Doldu',
            'Oturum süreniz dolmuş. Lütfen tekrar giriş yapın.',
            [
              {
                text: 'Tamam',
                onPress: () => {
                  // Login sayfasına yönlendir
                  router.replace('/(auth)/login');
                },
              },
            ]
          );
        } else {
          // Diğer hatalar
          Alert.alert('Hata', error.response?.data?.detail || 'Kategoriler yüklenemedi.');
        }
      }
    };
    fetchCategories();
  }, [token]);  // Token değiştiğinde tekrar çalış

  // ========== RESİM İŞLEMLERİ ==========
  
  /**
   * Galeriden resim seçme fonksiyonu
   * Kullanıcıdan galeri erişim izni ister, resim seçer ve base64 formatında kaydeder
   */
  const handlePickImage = async () => {
    // Galeri erişim izni iste
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Galeri erişimi için izin vermeniz gerekiyor');
      return;
    }
    
    // Resim seçiciyi aç
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,  // Sadece resimler
      allowsEditing: true,  // Düzenlemeye izin ver
      quality: 0.5,  // Kalite (0-1 arası, 0.5 = %50 kalite - dosya boyutu için)
      base64: true,  // Base64 formatında al (backend'e göndermek için)
    });

    // Kullanıcı resim seçtiyse ve base64 verisi varsa, state'e ekle
    if (!result.canceled && result.assets && result.assets[0].base64) {
      setImages([...images, `data:image/jpeg;base64,${result.assets[0].base64}`]);
    }
  };

  /**
   * Resim silme fonksiyonu
   * @param index - Silinecek resmin index'i
   */
  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_: string, i: number) => i !== index));
  };

  // ========== GÖREV OLUŞTURMA FONKSİYONU ==========
  /**
   * Form gönderme fonksiyonu
   * Form verilerini backend'e gönderir ve yeni görev oluşturur
   */
  const handleCreateTask = async () => {
    // ========== VALİDASYON ==========
    // Başlık ve kategori zorunlu alanlar
    if (!title || !categoryId) {
      Alert.alert('Hata', 'Başlık ve Kategori alanları zorunludur');
      return;
    }
    
    // Token kontrolü
    if (!token) {
      Alert.alert('Hata', 'Giriş yapılmamış. Lütfen tekrar giriş yapın.');
      return;
    }

    setLoading(true);  // Yükleme durumunu başlat
    
    try {
      // ========== VERİ HAZIRLAMA ==========
      // Backend'e gönderilecek veriyi hazırla
      const taskData = {
        title: title.trim(),  // Başlıktaki boşlukları temizle
        description: description.trim(),  // Açıklamadaki boşlukları temizle
        category_id: categoryId,  // Seçili kategori ID'si
        tags: tags.split(',').map((t: string) => t.trim()).filter((t: string) => t),  // Virgülle ayrılmış etiketleri array'e çevir
        priority,  // Öncelik seviyesi
        status,  // Görev durumu
        completion_percentage: completionPercentage,  // Tamamlanma yüzdesi
        images,  // Resimler (base64 array)
        due_date: null,  // Son tarih (şimdilik null)
      };

      console.log('--- Sending Task Data ---');
      console.log('Title:', taskData.title);
      console.log('Sending categoryId:', taskData.category_id);
      console.log('-------------------------');

      // ========== BACKEND İSTEĞİ ==========
      // Backend API'ye POST isteği gönder
      await axios.post(
        `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/tasks`,
        taskData,
        {
          headers: { Authorization: `Bearer ${token}` },  // JWT token header'a ekle
        }
      );

      // ========== BAŞARI DURUMU ==========
      Alert.alert('Başarılı', 'Görev başarıyla oluşturuldu');
      router.push('/(tabs)/home');  // Ana sayfaya dön

    } catch (error: any) {
      // ========== HATA DURUMU ==========
      console.error('Görev oluşturulurken hata oluştu:', error.response?.data || error);
      Alert.alert('Hata', error.response?.data?.detail || 'Görev oluşturulamadı');
    } finally {
      setLoading(false);  // Yükleme durumunu bitir (her durumda)
    }
  };

  // ========== PICKER ITEMS HAZIRLAMA ==========
  // Dropdown picker için kategori listesini hazırla
  // label: Görünen isim, value: Seçildiğinde dönen ID
  const pickerItems = categories.map((cat) => ({
    label: cat.name,  // Kategori adı (görünen)
    value: cat.id,  // Kategori ID'si (seçildiğinde dönen değer)
  }));

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Yeni Görev</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

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
          <Text style={styles.saveButtonText}>{loading ? 'Kaydediliyor...' : 'Kaydet'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Stiller aynı kaldı...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1E',
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
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