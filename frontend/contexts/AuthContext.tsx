/**
 * TaskMaster - Authentication Context
 * ====================================
 * Bu dosya, React Context API kullanarak global kimlik doğrulama state'ini yönetir.
 * Kullanıcı girişi, kayıt ve çıkış işlemleri bu context üzerinden yapılır.
 * AsyncStorage ile oturum kalıcılığı sağlanır.
 * 
 * Kullanılan Teknolojiler:
 * - React Context API: Global state yönetimi
 * - AsyncStorage: Yerel depolama (token ve kullanıcı bilgileri)
 * - Axios: HTTP istekleri
 */

import AsyncStorage from '@react-native-async-storage/async-storage'; // Yerel depolama
import axios from 'axios'; // HTTP istekleri
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native'; // Platform kontrolü (iOS/Android)

// ========== BACKEND URL YAPILANDIRMASI ==========
// .env dosyasından backend URL'sini alıyoruz
// Eğer .env'de yoksa platforma göre varsayılan URL kullanılır
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');
  // Android emülatör için özel IP (10.0.2.2 = host makine)

// ========== TYPE DEFINITIONS ==========

/**
 * Kullanıcı veri tipi
 */
interface User {
  id: string;  // Kullanıcı benzersiz ID'si (UUID)
  username: string;  // Kullanıcı adı
  email?: string;  // E-posta (opsiyonel)
}

/**
 * AuthContext tipi - Context'te bulunan değerler ve fonksiyonlar
 */
interface AuthContextType {
  // State değişkenleri
  user: User | null;  // Giriş yapmış kullanıcı bilgileri (null = giriş yapılmamış)
  token: string | null;  // JWT authentication token (null = token yok)
  loading: boolean;  // Yükleme durumu (AsyncStorage kontrolü sırasında true)
  
  // Action fonksiyonları
  login: (username: string, password: string) => Promise<void>;  // Giriş yap
  register: (username: string, password: string, email?: string) => Promise<void>;  // Kayıt ol
  logout: () => Promise<void>;  // Çıkış yap
}

// Context oluşturuluyor (başlangıç değeri undefined)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * AuthProvider Component
 * =======================
 * Authentication context provider'ı. Uygulamanın root seviyesinde sarmalanır.
 * Tüm alt component'ler bu context'e erişebilir.
 * 
 * @param children - Provider içine sarılacak component'ler
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  // ========== STATE HOOKS ==========
  const [user, setUser] = useState<User | null>(null);  // Kullanıcı bilgileri
  const [token, setToken] = useState<string | null>(null);  // JWT token
  const [loading, setLoading] = useState(true);  // İlk yükleme durumu (AsyncStorage kontrolü)

  // ========== LIFECYCLE HOOK ==========
  // Uygulama ilk açıldığında depolanmış kullanıcı bilgilerini yükler
  // AsyncStorage'den token ve user bilgilerini kontrol eder
  useEffect(() => {
    console.log('🔐 AuthProvider: Başlatılıyor...');
    loadStoredAuth();  // Kayıtlı oturum bilgilerini yükle
  }, []);  // Sadece component mount olduğunda çalışır

  /**
   * AsyncStorage'den kayıtlı oturum bilgilerini yükler.
   * Uygulama açıldığında otomatik giriş yapılmasını sağlar.
   */
  const loadStoredAuth = async () => {
    try {
      console.log('📦 AuthProvider: AsyncStorage kontrol ediliyor...');
      
      // AsyncStorage'den token ve kullanıcı bilgilerini al
      const storedToken = await AsyncStorage.getItem('token');  // JWT token
      const storedUser = await AsyncStorage.getItem('user');  // Kullanıcı bilgileri (JSON string)
      
      console.log('📦 AuthProvider: Stored data - Token:', !!storedToken, 'User:', !!storedUser);
      
      // Eğer hem token hem de kullanıcı bilgisi varsa, oturum açık demektir
      if (storedToken && storedUser) {
        console.log('✅ AuthProvider: Kayıtlı kullanıcı bulundu');
        setToken(storedToken);  // Token'ı state'e kaydet
        setUser(JSON.parse(storedUser));  // JSON string'i parse et ve state'e kaydet
      } else {
        console.log('❌ AuthProvider: Kayıtlı kullanıcı bulunamadı');
        // Token veya user yoksa, kullanıcı giriş yapmamış demektir
      }
    } catch (error) {
      // Hata durumunda logla ama uygulamayı çökertme
      console.error('🚨 AuthProvider: Auth yükleme hatası:', error);
    } finally {
      // Her durumda loading'i false yap (uygulama devam edebilsin)
      console.log('🔓 AuthProvider: Loading false olarak ayarlanıyor');
      setLoading(false);
    }
  };

  /**
   * Kullanıcı giriş fonksiyonu
   * 
   * Backend API'ye giriş isteği gönderir, token ve kullanıcı bilgilerini alır.
   * Başarılı girişte token ve kullanıcı bilgilerini hem state'e hem de AsyncStorage'e kaydeder.
   * 
   * @param username - Kullanıcı adı
   * @param password - Şifre
   * @throws Error - Giriş başarısız olursa hata fırlatır
   */
  const login = async (username: string, password: string) => {
    try {
      console.log('🔐 Login işlemi başlatılıyor:', username);
      
      // Backend API'ye POST isteği gönder
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        username,
        password,
      });

      // Yanıttan token ve kullanıcı bilgilerini al
      const { token: newToken, user: newUser } = response.data;
      console.log('✅ Login başarılı:', newUser.username);
      
      // Başarılı girişte bilgileri AsyncStorage'e kaydet (oturum kalıcılığı)
      await AsyncStorage.setItem('token', newToken);  // Token'ı kaydet
      await AsyncStorage.setItem('user', JSON.stringify(newUser));  // Kullanıcı bilgilerini JSON olarak kaydet
      
      // State'i güncelle (component'ler re-render olacak)
      setToken(newToken);
      setUser(newUser);
      
    } catch (error) {
      // ========== GELİŞTİRİLMİŞ HATA YÖNETİMİ ==========
      console.error('🚨 Login API Hatası Detayı:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Sunucu bir hata koduyla (4xx, 5xx) yanıt verdi
          // Örnek: 401 Unauthorized, 400 Bad Request
          const message = error.response.data?.detail || error.response.data?.message || 'Sunucudan geçersiz bir yanıt alındı.';
          throw new Error(message);
        } else if (error.request) {
          // İstek yapıldı ama yanıt alınamadı (örn. sunucu kapalı, ağ hatası)
          throw new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı veya sunucu adresini kontrol edin.');
        }
      }
      // Diğer beklenmedik hatalar için genel mesaj
      throw new Error('Giriş yapılırken beklenmedik bir hata oluştu.');
    }
  };

  /**
   * Kullanıcı kayıt fonksiyonu
   * 
   * Backend API'ye kayıt isteği gönderir, yeni kullanıcı oluşturur.
   * Başarılı kayıtta otomatik giriş yapılır (token ve kullanıcı bilgileri alınır).
   * 
   * @param username - Kullanıcı adı
   * @param password - Şifre
   * @param email - E-posta (opsiyonel)
   * @throws Error - Kayıt başarısız olursa hata fırlatır
   */
  const register = async (username: string, password: string, email?: string) => {
    try {
      console.log('📝 Register işlemi başlatılıyor:', username);
      
      // Backend API'ye POST isteği gönder
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        username,
        password,
        email,
      });

      // Yanıttan token ve kullanıcı bilgilerini al (otomatik giriş)
      const { token: newToken, user: newUser } = response.data;
      console.log('✅ Register başarılı:', newUser.username);

      // Bilgileri AsyncStorage'e kaydet
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      
      // State'i güncelle
      setToken(newToken);
      setUser(newUser);
      
    } catch (error) {
      // ========== GELİŞTİRİLMİŞ HATA YÖNETİMİ ==========
      console.error('🚨 Register API Hatası Detayı:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Sunucu bir hata koduyla (4xx, 5xx) yanıt verdi
          const message = error.response.data?.detail || error.response.data?.message || 'Sunucudan geçersiz bir yanıt alındı.';
          throw new Error(message);
        } else if (error.request) {
          // İstek yapıldı ama yanıt alınamadı
          throw new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı veya sunucu adresini kontrol edin.');
        }
      }
      // Diğer beklenmedik hatalar için genel mesaj
      throw new Error('Kayıt olurken beklenmedik bir hata oluştu.');
    }
  };

  /**
   * Kullanıcı çıkış fonksiyonu
   * 
   * AsyncStorage'den token ve kullanıcı bilgilerini siler.
   * State'i temizler (user ve token null olur).
   */
  const logout = async () => {
    try {
      console.log('🚪 Logout işlemi başlatılıyor');
      
      // AsyncStorage'den bilgileri sil
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      
      // State'i temizle
      setToken(null);
      setUser(null);
      
      console.log('✅ Logout başarılı');
    } catch (error) {
      console.error('🚨 Logout hatası:', error);
    }
  };

  console.log('🔄 AuthProvider render - loading:', loading, 'user:', user?.username);

  // Context Provider'ı render et - tüm alt component'ler bu değerlere erişebilir
  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// ========== CUSTOM HOOK ==========
/**
 * useAuth Hook
 * ============
 * AuthContext'e erişmek için kullanılan custom hook.
 * Component'lerde bu hook ile authentication state ve fonksiyonlarına erişilir.
 * 
 * @returns AuthContextType - Kullanıcı bilgileri, token ve auth fonksiyonları
 * @throws Error - Eğer AuthProvider dışında kullanılırsa hata fırlatır
 * 
 * Kullanım örneği:
 * ```tsx
 * const { user, token, login, logout } = useAuth();
 * ```
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  
  // Context undefined ise, component AuthProvider dışında demektir
  if (context === undefined) {
    throw new Error('useAuth, bir AuthProvider içinde kullanılmalıdır');
  }
  
  return context;
};