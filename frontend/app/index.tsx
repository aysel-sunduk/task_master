import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [hasNavigated, setHasNavigated] = React.useState(false);

  useEffect(() => {
    console.log('🏠 Index: Auth state değişti - loading:', loading, 'user:', user?.username);
    
    // Loading bitince hemen yönlendir
    if (!loading && !hasNavigated) {
      setHasNavigated(true);
      try {
        console.log('🌐 Backend URL:', process.env.EXPO_PUBLIC_BACKEND_URL);
        
          if (user) {
            console.log('✅ Index: Kullanıcı var, Home sayfasına yönlendiriliyor...');
            router.replace('/(tabs)/home');
          } else {
            console.log('❌ Index: Kullanıcı yok, Login sayfasına yönlendiriliyor...');
            router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('🚨 Index: Yönlendirme hatası:', error);
      }
    }
  }, [user, loading, router, hasNavigated]);
    
  // Fallback: 2 saniye sonra yönlendirmeyi zorla
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (!hasNavigated) {
        console.log('⏰ Index: Fallback timeout tetiklendi');
        setHasNavigated(true);
        if (user) {
          router.replace('/(tabs)/home');
        } else {
          router.replace('/(auth)/login');
        }
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [user, router, hasNavigated]);

  // Eğer yönlendirme yapıldıysa hiçbir şey render etme
  if (hasNavigated) {
    return null;
  }

  console.log('🔄 Index component render - loading:', loading, 'user:', user?.username);

  return (
    <View style={styles.container} pointerEvents="box-none">
      <ActivityIndicator size="large" color="#6C63FF" />
      <Text style={styles.text}>TaskMaster Yükleniyor...</Text>
      <Text style={styles.debugText}>
        Durum: {loading ? 'Yükleniyor...' : user ? 'Kullanıcı: ' + user.username : 'Kullanıcı Yok'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F1E',
  },
  text: {
    marginTop: 16,
    fontSize: 16,
    color: '#FFFFFF',
  },
  debugText: {
    marginTop: 8,
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});