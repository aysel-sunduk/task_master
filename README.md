# TaskMaster 📋

Modern ve kullanıcı dostu bir görev yönetim uygulaması. React Native (Expo) ile geliştirilmiş mobil uygulama ve FastAPI ile geliştirilmiş backend API.

## 🎯 Uygulama Hakkında

TaskMaster, kullanıcıların günlük görevlerini organize edebileceği, kategorilere ayırabileceği ve AI asistan desteği ile akıllı öneriler alabileceği modern bir mobil görev yönetim uygulamasıdır. 

**Geliştirme Bilgileri:**
- ✨ VSCode ortamında geliştirilmiştir
- 📚 Dönem projesi için yapılmıştır
- 🎓 Eğitim Kaynağı: devArdo Sıfırdan React Native Dersleri (JavaScript + Expo)

## 🚀 Özellikler

### Kullanıcı Yönetimi
- ✅ Kullanıcı kaydı ve girişi (JWT tabanlı kimlik doğrulama)
- 🔐 Güvenli şifre hashleme (bcrypt)
- 💾 Oturum kalıcılığı (AsyncStorage)
- 👤 Profil yönetimi

### Görev Yönetimi
- 📝 Görev oluşturma, düzenleme ve silme
- 🎯 Öncelik seviyeleri (Düşük, Orta, Yüksek)
- 📊 Durum takibi (Yapılacak, Devam Ediyor, Tamamlandı)
- 📈 İlerleme yüzdesi takibi (0-100%)
- 🏷️ Etiket (tag) sistemi
- 📅 Son tarih (due date) belirleme
- 🖼️ Görevlere resim ekleme desteği
- 👆 Kaydırarak silme (swipe-to-delete)

### Kategori Sistemi
- 🏷️ Kategori oluşturma ve yönetimi
- 🎨 Özel renk ve ikon seçimi
- 📊 Kategori bazlı görev gruplama
- 🔍 Kategori bazlı filtreleme

### Filtreleme ve Arama
- 🔍 Durum filtreleri (Tümü, Yapılacak, Devam Ediyor, Tamamlandı)
- 🏷️ Kategori bazlı filtreleme
- 📊 İlerleme çubuğu ile görsel takip

### AI Asistan
- 🤖 Chatbot ile görev önerileri
- 💡 Görev yönetimi konusunda akıllı yardım
- 🔄 OpenRouter API entegrasyonu
- 🌐 Çoklu AI model desteği (fallback mekanizması)

### Kullanıcı Arayüzü
- 🌙 Karanlık tema
- 🔄 Pull-to-refresh
- ⏳ Yükleme göstergeleri
- 📱 Boş durum mesajları
- 🎨 Modern ve kullanıcı dostu tasarım
- 📱 Responsive tasarım

## 📱 Uygulama Akışı

### 1. Başlangıç ve Kimlik Doğrulama
```
Uygulama Açılışı (index.tsx)
    ↓
Auth Kontrolü (AsyncStorage'den token kontrolü)
    ↓
┌─────────────────┬─────────────────┐
│   Token Var     │   Token Yok     │
│   (Oturum Açık) │   (Oturum Kapalı)│
└─────────────────┴─────────────────┘
    ↓                    ↓
Home Sayfası      Login Sayfası
```

### 2. Giriş ve Kayıt Akışı
```
Login Sayfası
    ↓
[Kullanıcı Adı + Şifre]
    ↓
Backend API (/api/auth/login)
    ↓
┌──────────────┬──────────────┐
│  Başarılı    │   Hatalı     │
└──────────────┴──────────────┘
    ↓                ↓
Token Kaydedilir   Hata Mesajı
    ↓
Home Sayfasına Yönlendirme
```

**Kayıt Akışı:**
- Register Sayfası → Backend API (/api/auth/register) → Otomatik Login → Home

### 3. Ana Sayfa (Home) Akışı
```
Home Sayfası (/(tabs)/home)
    ↓
┌─────────────────────────────────────┐
│  Görevler Yükleniyor (fetchTasks)  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Görev Listesi Gösterimi            │
│  - Durum Filtreleri                 │
│  - Kategori Filtresi (opsiyonel)    │
│  - Görev Kartları                   │
└─────────────────────────────────────┘
    ↓
┌──────────┬──────────┬──────────┬──────────┐
│  + Butonu│  AI Butonu│  Görev   │  Kategori│
│          │          │  Kartı   │  Butonu  │
└──────────┴──────────┴──────────┴──────────┘
    ↓          ↓          ↓          ↓
CreateTask  Chatbot   TaskDetail  Categories
```

### 4. Görev İşlemleri Akışı

**Görev Oluşturma:**
```
CreateTask Sayfası
    ↓
[Form Doldurma: Başlık, Açıklama, Kategori, Öncelik, Durum, vb.]
    ↓
Backend API (/api/tasks - POST)
    ↓
┌──────────────┬──────────────┐
│  Başarılı    │   Hatalı     │
└──────────────┴──────────────┘
    ↓                ↓
Home'a Dön       Hata Mesajı
Görev Listesi Güncellenir
```

**Görev Düzenleme:**
```
TaskDetail Sayfası
    ↓
[Görev Bilgileri Gösterimi]
    ↓
Düzenle Butonu
    ↓
CreateTask Sayfası (Edit Mode)
    ↓
[Güncellemeler Yapılır]
    ↓
Backend API (/api/tasks/{id} - PUT)
    ↓
TaskDetail Sayfasına Dön
```

**Görev Silme:**
```
Home Sayfası - Görev Kartı
    ↓
[Sola Kaydırma - Swipe]
    ↓
Sil Butonu Görünür
    ↓
Onay Diyaloğu (Alert)
    ↓
Backend API (/api/tasks/{id} - DELETE)
    ↓
Görev Listesinden Kaldırılır
```

### 5. Kategori Yönetimi Akışı
```
Categories Sayfası (/(tabs)/categories)
    ↓
┌─────────────────────────────────────┐
│  Kategoriler Yükleniyor             │
│  (Görevlerden otomatik gruplama)    │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Kategori Kartları                  │
│  - Kategori Adı                     │
│  - Görev Sayısı                    │
│  - Tamamlanan Görev Sayısı         │
│  - Renk ve İkon                    │
└─────────────────────────────────────┘
    ↓
Kategoriye Tıklama
    ↓
Home Sayfasına Dön (Kategori Filtresi Aktif)
```

### 6. AI Chatbot Akışı
```
Home Sayfası - AI Butonu
    ↓
Chatbot Sayfası
    ↓
┌─────────────────────────────────────┐
│  Hoş Geldin Mesajı                  │
│  "Merhaba! TaskMaster asistanınızım"│
└─────────────────────────────────────┘
    ↓
[Kullanıcı Mesajı Girer]
    ↓
Backend API (/api/ai/chat - POST)
    ↓
┌─────────────────────────────────────┐
│  OpenRouter API'ye İstek            │
│  (AI Model: meta-llama/llama-3.2)   │
└─────────────────────────────────────┘
    ↓
┌──────────────┬──────────────┐
│  Başarılı    │   Hatalı     │
│  (429 Rate   │  (Network    │
│   Limit)     │   Error)     │
└──────────────┴──────────────┘
    ↓                ↓
Fallback Model    Hata Mesajı
    ↓
AI Yanıtı Gösterilir
```

### 7. Profil ve Ayarlar
```
Profile Sayfası (/(tabs)/profile)
    ↓
┌─────────────────────────────────────┐
│  Kullanıcı Bilgileri                │
│  - Kullanıcı Adı                    │
│  - Email                            │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│  Menü Öğeleri                       │
│  - Yardım ve Destek                 │
│  - Hakkında                         │
│  - Çıkış Yap                        │
└─────────────────────────────────────┘
```

## 📁 Proje Yapısı

```
task_master/
├── backend/                    # FastAPI Backend
│   ├── server.py              # Ana API sunucusu
│   ├── requirements.txt       # Python bağımlılıkları
│   ├── create_tables.sql      # Veritabanı şema dosyası
│   └── .env                   # Ortam değişkenleri (gitignore'da)
│
├── frontend/                   # React Native (Expo) Frontend
│   ├── app/                   # Expo Router sayfaları
│   │   ├── _layout.tsx        # Root layout
│   │   ├── index.tsx          # Başlangıç sayfası (yönlendirme)
│   │   ├── (auth)/            # Kimlik doğrulama sayfaları
│   │   │   ├── login.tsx      # Giriş sayfası
│   │   │   └── register.tsx   # Kayıt sayfası
│   │   ├── (tabs)/            # Tab navigasyon sayfaları
│   │   │   ├── _layout.tsx    # Tab layout
│   │   │   ├── home.tsx       # Ana sayfa (görev listesi)
│   │   │   ├── categories.tsx # Kategoriler sayfası
│   │   │   └── profile.tsx    # Profil sayfası
│   │   ├── createTask.tsx     # Görev oluşturma/düzenleme
│   │   ├── taskDetail.tsx      # Görev detay sayfası
│   │   └── chatbot.tsx        # AI chatbot sayfası
│   ├── contexts/              # React Context'ler
│   │   └── AuthContext.tsx    # Kimlik doğrulama context'i
│   ├── store/                 # Zustand state yönetimi
│   │   └── taskStore.ts       # Görev state yönetimi
│   ├── assets/                # Statik dosyalar (resimler, fontlar)
│   ├── package.json           # Node.js bağımlılıkları
│   └── .env                   # Ortam değişkenleri (gitignore'da)
│
└── README.md                  # Bu dosya
```

## 🛠️ Kurulum

### Gereksinimler
- **Python 3.8+**
- **Node.js 18+** ve **npm** veya **yarn**
- **PostgreSQL 12+**
- **Expo CLI** (global kurulum: `npm install -g expo-cli`)

### Backend Kurulumu

1. **Backend dizinine gidin:**
   ```bash
   cd backend
   ```

2. **Python sanal ortamı oluşturun:**
   ```bash
   python -m venv venv
   
   # Windows:
   venv\Scripts\activate
   
   # Linux/Mac:
   source venv/bin/activate
   ```

3. **Bağımlılıkları yükleyin:**
   ```bash
   pip install -r requirements.txt
   ```

4. **`.env` dosyası oluşturun:**
   `backend` klasöründe `.env` dosyası oluşturun:
   ```env
   DATABASE_URL=postgresql://kullanici:sifre@localhost:5432/taskmaster
   JWT_SECRET=super-gizli-jwt-secret-key-buraya-uzun-bir-deger-yazin-en-az-32-karakter
   JWT_ALGORITHM=HS256
   OPENROUTER_API_KEY=your-openrouter-api-key-here
   ```

5. **PostgreSQL veritabanını hazırlayın:**
   ```bash
   # PostgreSQL'de veritabanı oluşturun
   createdb taskmaster
   
   # Tabloları oluşturun
   psql -U kullanici -d taskmaster -f create_tables.sql
   ```

6. **Sunucuyu başlatın:**
   ```bash
   python server.py
   ```
   Backend `http://localhost:8000` adresinde çalışacaktır.

### Frontend Kurulumu

1. **Frontend dizinine gidin:**
   ```bash
   cd frontend
   ```

2. **Bağımlılıkları yükleyin:**
   ```bash
   npm install
   # veya
   yarn install
   ```

3. **`.env` dosyası oluşturun:**
   `frontend` klasöründe `.env` dosyası oluşturun:
   ```env
   EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
   ```
   
   **Not:** Mobil cihazdan erişim için bilgisayarınızın IP adresini kullanın:
   ```env
   EXPO_PUBLIC_BACKEND_URL=http://192.168.1.100:8000
   ```

4. **Uygulamayı başlatın:**
   ```bash
   npm start
   # veya
   yarn start
   ```

5. **Çalıştırma seçenekleri:**
   - **Web:** `w` tuşuna basın
   - **Android:** `a` tuşuna basın (Android Studio/Emulator gerekli)
   - **iOS:** `i` tuşuna basın (Mac + Xcode gerekli)
   - **QR Kod:** Expo Go uygulaması ile tarayın

## 📚 API Dokümantasyonu

Backend çalıştıktan sonra API dokümantasyonuna şu adresten erişebilirsiniz:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

## 🔑 API Endpoint'leri

### Kimlik Doğrulama
- `POST /api/auth/register` - Kullanıcı kaydı
- `POST /api/auth/login` - Kullanıcı girişi
- `GET /api/auth/me` - Mevcut kullanıcı bilgisi

### Kategoriler
- `GET /api/categories` - Kategorileri listele
- `POST /api/categories` - Yeni kategori oluştur
- `PUT /api/categories/{category_id}` - Kategori güncelle
- `DELETE /api/categories/{category_id}` - Kategori sil

### Görevler
- `GET /api/tasks` - Görevleri listele (filtreleme destekler)
- `GET /api/tasks/{task_id}` - Tek görev getir
- `POST /api/tasks` - Yeni görev oluştur
- `PUT /api/tasks/{task_id}` - Görev güncelle
- `DELETE /api/tasks/{task_id}` - Görev sil

### AI
- `POST /api/ai/suggestions` - AI önerileri al
- `POST /api/ai/chat` - AI chatbot ile konuş

## 🗄️ Veritabanı Şeması

### Users Tablosu
- `id` (UUID, Primary Key)
- `username` (VARCHAR, Unique)
- `email` (VARCHAR)
- `password_hash` (TEXT)
- `created_at` (TIMESTAMP)

### Categories Tablosu
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key → users.id)
- `name` (VARCHAR)
- `color` (VARCHAR)
- `icon` (VARCHAR)
- `created_at` (TIMESTAMP)

### Tasks Tablosu
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key → users.id)
- `title` (VARCHAR)
- `description` (TEXT)
- `category_id` (UUID, Foreign Key → categories.id)
- `tags` (JSONB)
- `priority` (VARCHAR)
- `status` (VARCHAR)
- `completion_percentage` (INT, 0-100)
- `images` (JSONB)
- `due_date` (TIMESTAMP)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

## 🛡️ Güvenlik

- JWT tabanlı kimlik doğrulama
- Bcrypt ile şifre hashleme
- CORS yapılandırması
- SQL injection koruması (parametreli sorgular)
- UUID kullanımı (güvenli ID'ler)

## 🐛 Bilinen Sorunlar

- AI servisi rate limit'e takılabilir (fallback mekanizması mevcut)
- Bazı hata mesajları kullanıcıya düzgün gösterilmeyebilir
- Görsel yükleme özelliği henüz tam implement edilmemiş

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add some amazing feature'`)
4. Push yapın (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📝 Lisans

Bu proje MIT lisansı altında lisanslanmıştır.

## 👨‍💻 Geliştirici

**İletişim:**
- 📧 Email: sundukaysel@gmail.com

**Proje Bilgileri:**
- ✨ VSCode ortamında geliştirilmiştir
- 📚 Dönem projesi için yapılmıştır
- 🎓 Eğitim Kaynağı: devArdo Sıfırdan React Native Dersleri (JavaScript + Expo)

---

**Not:** Daha detaylı bilgi için kod içindeki yorumları inceleyebilirsiniz.
