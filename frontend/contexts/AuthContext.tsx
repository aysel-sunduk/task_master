import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

// .env dosyasından backend URL'sini alıyoruz
const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 
  (Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000');

// Kullanıcı veri tipini tanımlıyoruz
interface User {
  id: string;
  username: string;
  email?: string;
}

// Context'in tipini tanımlıyoruz
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, email?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Uygulama ilk açıldığında depolanmış kullanıcı bilgilerini yükler
  useEffect(() => {
    console.log('🔐 AuthProvider: Başlatılıyor...');
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      console.log('📦 AuthProvider: AsyncStorage kontrol ediliyor...');
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      console.log('📦 AuthProvider: Stored data - Token:', !!storedToken, 'User:', !!storedUser);
      
      if (storedToken && storedUser) {
        console.log('✅ AuthProvider: Kayıtlı kullanıcı bulundu');
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } else {
        console.log('❌ AuthProvider: Kayıtlı kullanıcı bulunamadı');
      }
    } catch (error) {
      console.error('🚨 AuthProvider: Auth yükleme hatası:', error);
    } finally {
      console.log('🔓 AuthProvider: Loading false olarak ayarlanıyor');
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    try {
      console.log('🔐 Login işlemi başlatılıyor:', username);
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        username,
        password,
      });

      const { token: newToken, user: newUser } = response.data;
      console.log('✅ Login başarılı:', newUser.username);
      
      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      
      setToken(newToken);
      setUser(newUser);
    } catch (error) {
      // --- YENİ VE GELİŞTİRİLMİŞ HATA YÖNETİMİ ---
      console.error('🚨 Login API Hatası Detayı:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Sunucu bir hata koduyla (4xx, 5xx) yanıt verdi
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

  const register = async (username: string, password: string, email?: string) => {
    try {
      console.log('📝 Register işlemi başlatılıyor:', username);
      const response = await axios.post(`${API_URL}/api/auth/register`, {
        username,
        password,
        email,
      });

      const { token: newToken, user: newUser } = response.data;
      console.log('✅ Register başarılı:', newUser.username);

      await AsyncStorage.setItem('token', newToken);
      await AsyncStorage.setItem('user', JSON.stringify(newUser));
      
      setToken(newToken);
      setUser(newUser);
    } catch (error) {
      // --- YENİ VE GELİŞTİRİLMİŞ HATA YÖNETİMİ ---
      console.error('🚨 Register API Hatası Detayı:', error);
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Sunucu bir hata koduyla (4xx, 5xx) yanıt verdi
          const message = error.response.data?.detail || error.response.data?.message || 'Sunucudan geçersiz bir yanıt alındı.';
          throw new Error(message);
        } else if (error.request) {
          // İstek yapıldı ama yanıt alınamadı (örn. sunucu kapalı, ağ hatası)
          throw new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı veya sunucu adresini kontrol edin.');
        }
      }
      // Diğer beklenmedik hatalar için genel mesaj
      throw new Error('Kayıt olurken beklenmedik bir hata oluştu.');
    }
  };

  const logout = async () => {
    try {
      console.log('🚪 Logout işlemi başlatılıyor');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      setToken(null);
      setUser(null);
      console.log('✅ Logout başarılı');
    } catch (error) {
      console.error('🚨 Logout hatası:', error);
    }
  };

  console.log('🔄 AuthProvider render - loading:', loading, 'user:', user?.username);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook'u dışarıya açıyoruz
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth, bir AuthProvider içinde kullanılmalıdır');
  }
  return context;
};