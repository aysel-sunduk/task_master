# TaskMaster - Sunum İçin Kod Gösterim Stratejisi

## 📋 Genel Yaklaşım

Hocanıza sunum yaparken kodları gösterirken şu sırayı takip edin:

1. **Mimari Genel Bakış** (2-3 dakika)
2. **Backend API Yapısı** (3-4 dakika)
3. **Frontend State Yönetimi** (2-3 dakika)
4. **Ana Özellikler ve Kod Örnekleri** (5-6 dakika)
5. **Güvenlik ve Best Practices** (2-3 dakika)

---

## 🎯 1. MİMARİ GENEL BAKIŞ (2-3 dakika)

### Gösterilecek Dosyalar:
- `README.md` - Proje yapısı
- `backend/server.py` (başlangıç kısmı - import'lar ve yapılandırma)

### Ne Söyleyeceksiniz:
> "Hocam, TaskMaster uygulaması üç katmanlı bir mimariye sahip. Backend tarafında Python FastAPI framework'ü kullanıyoruz, PostgreSQL veritabanı ile çalışıyoruz. Frontend'de React Native ve Expo kullanıyoruz. Şimdi backend yapısına bakalım..."

### Kod Gösterimi:
```python
# backend/server.py dosyasını açın
# İlk 50 satırı gösterin (import'lar, logging, config)
```

**Vurgulayacaklarınız:**
- FastAPI framework kullanımı
- PostgreSQL bağlantı havuzu
- JWT authentication
- CORS yapılandırması
- Logging sistemi

---

## 🔧 2. BACKEND API YAPISI (3-4 dakika)

### Gösterilecek Dosyalar:
- `backend/server.py` (Pydantic modelleri ve endpoint'ler)

### Ne Söyleyeceksiniz:
> "Backend'de RESTful API prensiplerine uygun endpoint'ler oluşturduk. Pydantic modelleri ile veri doğrulama yapıyoruz. Şimdi görev oluşturma endpoint'ine bakalım..."

### Kod Gösterimi Sırası:

#### A) Pydantic Modelleri (1 dakika)
```python
# backend/server.py - Satır 211-255 arası
# TaskCreate, TaskUpdate, TaskResponse modellerini gösterin
```

**Vurgulayacaklarınız:**
- Veri doğrulama (Field, min_length, ge, le)
- Type safety
- Optional ve required alanlar

#### B) Endpoint Örneği - Görev Oluşturma (2 dakika)
```python
# backend/server.py - Satır 623-707 arası
# @api_router.post("/tasks") endpoint'ini gösterin
```

**Vurgulayacaklarınız:**
- Dependency injection (get_db_connection, get_current_user_id)
- JWT token doğrulama
- Veritabanı işlemleri
- Hata yönetimi
- Transaction yönetimi (commit/rollback)

#### C) Güvenlik Fonksiyonları (1 dakika)
```python
# backend/server.py - Satır 250-334 arası
# hash_password, verify_password, create_token, get_current_user_id
```

**Vurgulayacaklarınız:**
- Bcrypt ile şifre hashleme
- JWT token oluşturma
- Token doğrulama mekanizması

---

## 📱 3. FRONTEND STATE YÖNETİMİ (2-3 dakika)

### Gösterilecek Dosyalar:
- `frontend/contexts/AuthContext.tsx`
- `frontend/store/taskStore.ts`

### Ne Söyleyeceksiniz:
> "Frontend'de state yönetimi için iki yaklaşım kullandık: React Context API ile authentication state'i, Zustand ile görev yönetimi state'i. Önce authentication context'ine bakalım..."

### Kod Gösterimi Sırası:

#### A) AuthContext (1.5 dakika)
```typescript
// frontend/contexts/AuthContext.tsx
// AuthProvider component'ini gösterin (satır 29-152)
```

**Vurgulayacaklarınız:**
- Context API kullanımı
- AsyncStorage ile oturum kalıcılığı
- Login/Register/Logout fonksiyonları
- Hata yönetimi

#### B) TaskStore (1.5 dakika)
```typescript
// frontend/store/taskStore.ts
// useTaskStore implementation'ını gösterin (satır 42-109)
```

**Vurgulayacaklarınız:**
- Zustand state management
- Async fonksiyonlar (fetchTasks, createTask)
- Loading ve error state yönetimi
- API entegrasyonu

---

## 🎨 4. ANA ÖZELLİKLER VE KOD ÖRNEKLERİ (5-6 dakika)

### Gösterilecek Dosyalar:
- `frontend/app/(tabs)/home.tsx`
- `frontend/app/createTask.tsx`
- `frontend/app/(tabs)/categories.tsx`

### Ne Söyleyeceksiniz:
> "Şimdi kullanıcı arayüzü kodlarına bakalım. Ana sayfa, görev oluşturma ve kategori yönetimi ekranlarını inceleyelim..."

### Kod Gösterimi Sırası:

#### A) Ana Sayfa - Görev Listesi (2 dakika)
```typescript
// frontend/app/(tabs)/home.tsx
// HomeScreen component'ini gösterin
```

**Vurgulayacaklarınız:**
- useFocusEffect ile ekran odaklandığında veri yükleme
- Filtreleme mantığı (useEffect ile)
- Pull-to-refresh özelliği
- Empty state handling
- Component yapısı (TaskCard)

**Gösterilecek Özellikler:**
- Durum filtreleme (Tümü, Yapılacak, Devam Ediyor, Tamamlandı)
- Kategori filtreleme
- Görev kartları
- İlerleme çubuğu

#### B) Görev Oluşturma Formu (2 dakika)
```typescript
// frontend/app/createTask.tsx
// CreateTaskScreen component'ini gösterin
```

**Vurgulayacaklarınız:**
- Form state yönetimi (useState)
- Kategori dropdown (RNPickerSelect)
- Resim seçme (ImagePicker)
- Form validasyonu
- API entegrasyonu

**Gösterilecek Özellikler:**
- Başlık, açıklama, kategori seçimi
- Öncelik ve durum seçimi
- İlerleme yüzdesi ayarlama
- Etiket ekleme
- Resim ekleme

#### C) Kategori Yönetimi (1-2 dakika)
```typescript
// frontend/app/(tabs)/categories.tsx
// CategoriesScreen component'ini gösterin
```

**Vurgulayacaklarınız:**
- Kategorileri görevlerden otomatik gruplama
- İstatistik hesaplama (tamamlanma yüzdesi)
- Navigasyon ile filtreleme

---

## 🔒 5. GÜVENLİK VE BEST PRACTICES (2-3 dakika)

### Gösterilecek Dosyalar:
- `backend/server.py` (güvenlik fonksiyonları)
- `frontend/contexts/AuthContext.tsx` (hata yönetimi)

### Ne Söyleyeceksiniz:
> "Güvenlik açısından uyguladığımız önlemlere bakalım..."

### Kod Gösterimi:

#### A) Backend Güvenlik (1.5 dakika)
```python
# backend/server.py
# - hash_password, verify_password (bcrypt)
# - get_current_user_id (JWT doğrulama)
# - SQL injection koruması (parametreli sorgular)
```

**Vurgulayacaklarınız:**
- Şifre hashleme (bcrypt)
- JWT token doğrulama
- SQL injection koruması
- CORS yapılandırması

#### B) Frontend Hata Yönetimi (1 dakika)
```typescript
// frontend/contexts/AuthContext.tsx
// Login fonksiyonundaki hata yönetimini gösterin (satır 63-95)
```

**Vurgulayacaklarınız:**
- Axios error handling
- Kullanıcı dostu hata mesajları
- Network error handling
- 401 Unauthorized handling

---

## 📊 SUNUM AKIŞ ŞEMASI

```
1. Giriş (30 saniye)
   └─ Proje tanıtımı, teknoloji stack

2. Mimari Genel Bakış (2-3 dakika)
   └─ backend/server.py (başlangıç)
   └─ Proje yapısı

3. Backend API (3-4 dakika)
   └─ Pydantic modelleri
   └─ Endpoint örneği (görev oluşturma)
   └─ Güvenlik fonksiyonları

4. Frontend State (2-3 dakika)
   └─ AuthContext
   └─ TaskStore

5. UI Kodları (5-6 dakika)
   └─ Ana sayfa
   └─ Görev oluşturma
   └─ Kategori yönetimi

6. Güvenlik (2-3 dakika)
   └─ Backend güvenlik
   └─ Frontend hata yönetimi

7. Soru-Cevap (kalan süre)
```

---

## 💡 İPUÇLARI

### Kod Gösterirken:
1. **VS Code'da Split View kullanın** - Ekranı ikiye bölün, bir tarafta kod diğer tarafta uygulama
2. **Syntax highlighting açık olsun** - Kodların renkli görünmesi önemli
3. **Zoom yapın** - Kodları büyütün ki hocanız rahatça görebilsin
4. **Fare ile işaret edin** - Hangi satırdan bahsettiğinizi gösterin
5. **Yavaş ilerleyin** - Her bölümü açıklayarak ilerleyin

### Hangi Kodları Göstermeli:
✅ **Göster:**
- Ana fonksiyonlar ve endpoint'ler
- State yönetimi kodları
- Güvenlik fonksiyonları
- Önemli business logic

❌ **Gösterme:**
- Stil tanımlamaları (StyleSheet.create)
- Çok uzun import listeleri
- Debug console.log'lar
- Boş veya TODO fonksiyonlar

### Sorulara Hazırlıklı Olun:
- "Neden Zustand kullandınız?" → Hafif, performanslı, TypeScript desteği
- "Neden Context API + Zustand birlikte?" → Context auth için, Zustand görevler için (farklı scope'lar)
- "Güvenlik önlemleri neler?" → Bcrypt, JWT, SQL injection koruması, CORS
- "Veritabanı bağlantı havuzu nedir?" → Performans için, her istekte yeni bağlantı açmak yerine havuzdan alınır

---

## 🎬 SUNUM SIRASI (ÖNERİLEN)

1. **README.md açın** - Proje yapısını gösterin (30 saniye)
2. **backend/server.py açın** - İlk 50 satır (import'lar, config) (1 dakika)
3. **Pydantic modelleri gösterin** - TaskCreate, TaskResponse (1 dakika)
4. **Görev oluşturma endpoint'i gösterin** - @api_router.post("/tasks") (2 dakika)
5. **Güvenlik fonksiyonları gösterin** - hash_password, get_current_user_id (1 dakika)
6. **frontend/contexts/AuthContext.tsx açın** - AuthProvider (1.5 dakika)
7. **frontend/store/taskStore.ts açın** - useTaskStore (1.5 dakika)
8. **frontend/app/(tabs)/home.tsx açın** - Ana sayfa (2 dakika)
9. **frontend/app/createTask.tsx açın** - Görev oluşturma (2 dakika)
10. **Güvenlik özeti** - Backend ve frontend güvenlik (2 dakika)

**Toplam: ~15 dakika kod gösterimi**

---

## 📝 SON NOTLAR

- Her kod bloğunu gösterirken **ne yaptığını** açıklayın
- **Neden bu yaklaşımı seçtiğinizi** belirtin
- **Alternatif çözümlerden** bahsedin (örn: "Redux yerine Zustand seçtik çünkü...")
- **Zorlandığınız noktaları** da paylaşın (hocanız takdir eder)
- **Gelecek iyileştirmelerden** bahsedin (örn: "AI chatbot'u tam implement edeceğiz")

**Başarılar! 🚀**
