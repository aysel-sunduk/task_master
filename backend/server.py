"""
TaskMaster Backend API Server
==============================
Bu dosya, TaskMaster uygulamasının backend API sunucusunu içerir.
FastAPI framework'ü kullanılarak RESTful API servisleri sağlanmaktadır.

Ana Özellikler:
- Kullanıcı kimlik doğrulama (JWT tabanlı)
- Görev yönetimi (CRUD işlemleri)
- Kategori yönetimi
- PostgreSQL veritabanı entegrasyonu
- Güvenlik önlemleri (bcrypt, JWT, CORS)
"""

# ========== KÜTÜPHANE İMPORTLARI ==========
# Standart Python kütüphaneleri
import os  # Ortam değişkenleri için
import uuid  # Benzersiz ID'ler oluşturmak için
import bcrypt  # Şifre hashleme için
import jwt  # JWT token oluşturma ve doğrulama için
import logging  # Loglama işlemleri için
import json  # JSON veri işleme için
import requests  # HTTP istekleri için (OpenRouter API)
from pathlib import Path  # Dosya yolu işlemleri için
from datetime import datetime, timezone  # Tarih/saat işlemleri için
from typing import List, Optional, Any  # Tip tanımlamaları için
from contextlib import asynccontextmanager  # Uygulama yaşam döngüsü yönetimi için

# Veritabanı kütüphaneleri
import psycopg2  # PostgreSQL bağlantısı için
from psycopg2 import pool  # Veritabanı bağlantı havuzu için
from psycopg2.extras import RealDictCursor  # Sözlük formatında sonuçlar için

# Üçüncü parti kütüphaneler
from dotenv import load_dotenv  # .env dosyasından ortam değişkenlerini yüklemek için
from pydantic import BaseModel, Field, ValidationError, ConfigDict  # Veri doğrulama için
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status  # FastAPI framework
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials  # JWT güvenlik için
from starlette.middleware.cors import CORSMiddleware  # CORS yapılandırması için

# ========== LOGGING YAPILANDIRMASI ==========
# Uygulama genelinde loglama sistemini yapılandırıyoruz
# Log formatı: Seviye:İsim:Tarih:Mesaj
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(asctime)s:%(message)s')
logger = logging.getLogger(__name__)  # Bu modül için logger oluşturuluyor

# ========== ORTAM DEĞİŞKENLERİ YÜKLEME ==========
# .env dosyasından ortam değişkenlerini yüklüyoruz
ROOT_DIR = Path(__file__).parent  # Backend klasörünün yolu
dotenv_path = ROOT_DIR / '.env'  # .env dosyasının tam yolu
logger.info(f".env dosyası aranıyor: {dotenv_path}")
load_dotenv(dotenv_path=dotenv_path)  # .env dosyasını yükle
logger.info(".env dosyası yüklendi (varsa).")

# Ortam değişkenlerini okuyoruz
DATABASE_URL = os.getenv("DATABASE_URL")  # PostgreSQL bağlantı URL'si
JWT_SECRET = os.getenv("JWT_SECRET")  # JWT token imzalama için gizli anahtar
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")  # JWT algoritması (varsayılan: HS256)

# ========== BAŞLANGIÇ KONTROLLERİ ==========
# Kritik ortam değişkenlerinin varlığını kontrol ediyoruz
# Eğer eksikse uygulama başlamadan hata veriyor

# Veritabanı URL kontrolü
if not DATABASE_URL:
    logger.critical("DATABASE_URL ortam değişkeni bulunamadı! Lütfen .env dosyasını kontrol edin.")
    raise ValueError("DATABASE_URL ortam değişkeni ayarlanmalı.")
else:
    # Güvenlik için şifre kısmını maskeleyerek logluyoruz
    masked_db_url = DATABASE_URL.split('@')[0].rsplit(':', 1)[0] + "@" + DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else DATABASE_URL
    logger.info(f"DATABASE_URL yüklendi: {masked_db_url}")

# JWT Secret kontrolü (güvenlik için kritik)
if not JWT_SECRET:
    logger.critical("JWT_SECRET ortam değişkeni bulunamadı! Bu güvenlik için kritik öneme sahiptir.")
    raise ValueError("JWT_SECRET ortam değişkeni ayarlanmalı.")
else:
    # Güvenlik için sadece son 4 karakteri gösteriyoruz
    logger.info(f"JWT_SECRET yüklendi: {'*' * (len(JWT_SECRET) - 4)}{JWT_SECRET[-4:]}")
logger.info(f"JWT_ALGORITHM kullanılıyor: {JWT_ALGORITHM}")

# ========== VERİTABANI BAĞLANTI HAVUZU ==========
# PostgreSQL bağlantı havuzu - performans için birden fazla bağlantı yönetir
connection_pool = None  # Başlangıçta None, lifespan_manager'da oluşturulacak

# ========== UYGULAMA YAŞAM DÖNGÜSÜ YÖNETİMİ ==========
# FastAPI uygulamasının başlangıç ve kapanış işlemlerini yönetir
@asynccontextmanager
async def lifespan_manager(app: FastAPI):
    """
    Uygulama başlarken ve kapanırken çalışacak işlemleri yönetir.
    - Başlangıç: Veritabanı bağlantı havuzunu oluşturur ve test eder
    - Kapanış: Bağlantı havuzunu kapatır
    """
    # ========== UYGULAMA BAŞLANGIÇ İŞLEMLERİ ==========
    logger.info("FastAPI uygulama yaşam döngüsü başlatılıyor...")

    # Veritabanı bağlantı havuzunu başlat
    global connection_pool
    try:
        logger.info("PostgreSQL bağlantı havuzu oluşturuluyor...")
        # SimpleConnectionPool: min=1, max=20 bağlantı
        # Bu sayede her istek için yeni bağlantı açmak yerine havuzdan alınır (performans)
        connection_pool = pool.SimpleConnectionPool(1, 20, dsn=DATABASE_URL)
        
        # Havuzun çalışıp çalışmadığını test et
        conn_test = connection_pool.getconn()  # Havuzdan bir bağlantı al
        logger.info("Test bağlantısı alındı.")
        with conn_test.cursor() as cur:
            cur.execute("SELECT 1")  # Basit bir test sorgusu
            logger.info("Veritabanı test sorgusu başarılı.")
        connection_pool.putconn(conn_test)  # Bağlantıyı havuza geri ver
        logger.info("PostgreSQL bağlantı havuzu başarıyla oluşturuldu ve test edildi.")
    except psycopg2.Error as e:
        # Veritabanı bağlantı hatası
        logger.critical(f"Veritabanı bağlantı havuzu oluşturulamadı veya test edilemedi: {e}", exc_info=True)
        raise RuntimeError(f"Veritabanı bağlantı havuzu hatası: {e}")
    except Exception as e:
        # Beklenmedik hatalar
        logger.critical(f"Bağlantı havuzu kurulurken beklenmedik hata: {e}", exc_info=True)
        raise RuntimeError(f"Bağlantı havuzu kurulum hatası: {e}")

    yield  # Uygulama ömrü boyunca burada bekler (tüm istekler bu süreçte işlenir)

    # ========== UYGULAMA KAPANIŞ İŞLEMLERİ ==========
    logger.info("FastAPI uygulama yaşam döngüsü sonlandırılıyor...")
    if connection_pool:
        connection_pool.closeall()  # Tüm bağlantıları kapat
        logger.info("PostgreSQL bağlantı havuzu kapatıldı.")

# ========== FASTAPI UYGULAMASI VE ROUTER YAPILANDIRMASI ==========
# Ana FastAPI uygulamasını oluşturuyoruz
app = FastAPI(
    title="TaskMaster API",  # API başlığı (Swagger UI'da görünür)
    version="1.0",  # API versiyonu
    lifespan=lifespan_manager  # Yaşam döngüsü yöneticisi
)

# API router'ı oluşturuyoruz - tüm endpoint'ler /api prefix'i ile başlayacak
api_router = APIRouter(prefix="/api")

# JWT token doğrulama için HTTPBearer kullanıyoruz
# Authorization: Bearer <token> formatında token bekler
security = HTTPBearer()

# ========== CORS (Cross-Origin Resource Sharing) YAPILANDIRMASI ==========
# Mobil uygulama farklı bir origin'den (localhost:19006) backend'e (localhost:8000) istek yapar
# CORS middleware bu isteklere izin verir
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tüm origin'lere izin ver (production'da spesifik olmalı)
    allow_credentials=True,  # Cookie ve Authorization header'larına izin ver
    allow_methods=["*"],  # Tüm HTTP metodlarına izin ver (GET, POST, PUT, DELETE)
    allow_headers=["*"],  # Tüm header'lara izin ver
)

# ========== PYDANTIC VERİ MODELLERİ ==========
# Pydantic modelleri, API istek/yanıt verilerini doğrular ve serialize eder
# Bu sayede tip güvenliği ve veri doğrulama otomatik olarak yapılır

# ========== KULLANICI İŞLEMLERİ MODELLERİ ==========

class UserRegister(BaseModel):
    """Kullanıcı kayıt isteği için model"""
    username: str  # Kullanıcı adı (zorunlu)
    password: str  # Şifre (zorunlu)
    email: Optional[str] = None  # E-posta (opsiyonel)

class UserLogin(BaseModel):
    """Kullanıcı giriş isteği için model"""
    username: str  # Kullanıcı adı
    password: str  # Şifre

class User(BaseModel):
    """Kullanıcı bilgileri için model (yanıt)"""
    id: str  # Kullanıcı ID'si (UUID)
    username: str  # Kullanıcı adı
    email: Optional[str] = None  # E-posta
    created_at: datetime  # Kayıt tarihi
    model_config = ConfigDict(from_attributes=True)  # ORM objelerinden otomatik dönüşüm

class TokenData(BaseModel):
    """JWT token ve kullanıcı bilgilerini içeren yanıt modeli"""
    token: str  # JWT token
    user: User  # Kullanıcı bilgileri

# ========== KATEGORİ İŞLEMLERİ MODELLERİ ==========

class CategoryBase(BaseModel):
    """Kategori için temel model (ortak alanlar)"""
    name: str  # Kategori adı
    color: Optional[str] = "#808080"  # Kategori rengi (varsayılan: gri)
    icon: Optional[str] = None  # Kategori ikonu (Ionicons ismi)

class CategoryCreate(CategoryBase):
    """Yeni kategori oluşturma isteği için model"""
    pass  # CategoryBase'den tüm alanları miras alır

class CategoryUpdate(BaseModel):
    """Kategori güncelleme isteği için model (tüm alanlar opsiyonel)"""
    name: Optional[str] = None  # Güncellenecek kategori adı
    color: Optional[str] = None  # Güncellenecek kategori rengi
    icon: Optional[str] = None  # Güncellenecek kategori ikonu

class CategoryResponse(CategoryBase):
    """Kategori yanıt modeli (veritabanından dönen veri)"""
    id: str  # Kategori ID'si (UUID)
    user_id: Optional[str] = None  # Kategori sahibi kullanıcı ID'si
    created_at: Optional[datetime] = None  # Oluşturulma tarihi
    model_config = ConfigDict(from_attributes=True)  # ORM objelerinden otomatik dönüşüm

# ========== GÖREV İŞLEMLERİ MODELLERİ ==========

class TaskCreate(BaseModel):
    """Yeni görev oluşturma isteği için model"""
    title: str = Field(..., min_length=1)  # Görev başlığı (zorunlu, en az 1 karakter)
    description: Optional[str] = ""  # Görev açıklaması (opsiyonel)
    category_id: Optional[str] = None  # Kategori ID'si (opsiyonel)
    tags: List[str] = []  # Etiketler listesi (varsayılan: boş)
    priority: str = "Orta"  # Öncelik seviyesi (varsayılan: Orta)
    status: str = "Yapılacak"  # Görev durumu (varsayılan: Yapılacak)
    completion_percentage: int = Field(0, ge=0, le=100)  # Tamamlanma yüzdesi (0-100 arası)
    images: List[str] = []  # Resim URL'leri listesi (base64 veya URL)
    due_date: Optional[str] = None  # Son tarih (ISO format string)

class TaskUpdate(BaseModel):
    """Görev güncelleme isteği için model (tüm alanlar opsiyonel)"""
    title: Optional[str] = Field(None, min_length=1)  # Güncellenecek başlık
    description: Optional[str] = None  # Güncellenecek açıklama
    category_id: Optional[str] = None  # Güncellenecek kategori ID'si
    tags: Optional[List[str]] = None  # Güncellenecek etiketler
    priority: Optional[str] = None  # Güncellenecek öncelik
    status: Optional[str] = None  # Güncellenecek durum
    completion_percentage: Optional[int] = Field(None, ge=0, le=100)  # Güncellenecek yüzde
    images: Optional[List[str]] = None  # Güncellenecek resimler
    due_date: Optional[str] = None  # Güncellenecek son tarih

class TaskResponse(BaseModel):
    """Görev yanıt modeli (veritabanından dönen veri + kategori bilgileri)"""
    id: str  # Görev ID'si (UUID)
    user_id: str  # Görev sahibi kullanıcı ID'si
    title: str  # Görev başlığı
    description: Optional[str] = ""  # Görev açıklaması
    tags: List[str] = Field(default_factory=list)  # Etiketler (varsayılan: boş liste)
    priority: str = "Orta"  # Öncelik seviyesi
    status: str = "Yapılacak"  # Görev durumu
    completion_percentage: int = 0  # Tamamlanma yüzdesi
    images: List[str] = Field(default_factory=list)  # Resimler (varsayılan: boş liste)
    due_date: Optional[datetime] = None  # Son tarih (datetime objesi)
    created_at: datetime  # Oluşturulma tarihi
    updated_at: datetime  # Güncellenme tarihi
    category_id: Optional[str] = None  # Kategori ID'si
    category_name: Optional[str] = None  # Kategori adı (JOIN ile alınır)
    category_color: Optional[str] = None  # Kategori rengi (JOIN ile alınır)
    category_icon: Optional[str] = None  # Kategori ikonu (JOIN ile alınır)
    model_config = ConfigDict(from_attributes=True)  # ORM objelerinden otomatik dönüşüm

# ========== YARDIMCI FONKSİYONLAR ==========

def parse_json_list_field(raw_value: Any, field_name: str, item_id: str) -> List[Any]:
    """
    Veritabanından gelen JSON stringi veya listeyi parse eder.
    
    PostgreSQL'de JSONB alanlar bazen string, bazen dict/liste olarak gelebilir.
    Bu fonksiyon her iki durumu da handle eder.
    
    Args:
        raw_value: Veritabanından gelen ham değer (string, list veya None)
        field_name: Alan adı (hata mesajları için)
        item_id: Öğe ID'si (hata mesajları için)
    
    Returns:
        List[Any]: Parse edilmiş liste (hata durumunda boş liste)
    """
    # Eğer zaten liste ise direkt döndür
    if isinstance(raw_value, list):
        return raw_value
    
    # Eğer string ise JSON parse et
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)  # JSON string'i parse et
            if isinstance(parsed, list):
                return parsed
            else:
                logger.warning(f"ID {item_id}: '{field_name}' JSON list değil: {raw_value}. Boş liste döndürüldü.")
                return []
        except json.JSONDecodeError:
            # Geçersiz JSON formatı
            logger.warning(f"ID {item_id}: '{field_name}' geçersiz JSON formatı: {raw_value}. Boş liste döndürüldü.")
            return []
    
    # Beklenmedik tip durumunda
    if raw_value is not None:
        logger.warning(f"ID {item_id}: '{field_name}' beklenmedik tip ({type(raw_value)}): {raw_value}. Boş liste ayarlandı.")
        return []
    
    # None durumunda boş liste döndür
    return []

def row_to_task_response(row: dict) -> TaskResponse:
    """
    Veritabanı satırını TaskResponse Pydantic modeline dönüştürür.
    
    Veritabanından gelen ham veriyi (dict) Pydantic modeline dönüştürür.
    JSON alanları (tags, images) parse edilir ve kategori bilgileri eklenir.
    
    Args:
        row: Veritabanından gelen görev satırı (RealDictCursor ile)
    
    Returns:
        TaskResponse: Pydantic modeli
    
    Raises:
        ValueError: Veri dönüştürülemezse veya boş satır gelirse
    """
    # Boş satır kontrolü
    if not row:
        logger.error("row_to_task_response: İşlenecek boş satır.")
        raise ValueError("Veritabanından boş görev verisi geldi.")

    task_id_str = str(row.get("id", "UNKNOWN"))
    logger.debug(f"row_to_task_response - Ham veri (ID: {task_id_str}): {row}")

    tags_list = parse_json_list_field(row.get('tags'), 'tags', task_id_str)
    images_list = parse_json_list_field(row.get('images'), 'images', task_id_str)

    # Pydantic modeline uygun hale getir
    task_data_for_pydantic = {
        "id": task_id_str,
        "user_id": str(row.get("user_id", "")),
        "title": row.get("title", ""),
        "description": row.get("description"),
        "tags": tags_list,
        "priority": row.get("priority", "Orta"),
        "status": row.get("status", "Yapılacak"),
        "completion_percentage": row.get("completion_percentage", 0),
        "images": images_list,
        "due_date": row.get("due_date"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "category_id": str(row["category_id"]) if row.get("category_id") else None,
        "category_name": row.get("category_name") or None,  # NULL ise None döndür, frontend'de "Genel" gösterilecek
        "category_color": row.get("category_color"),
        "category_icon": row.get("category_icon"),
    }

    try:
        response_model = TaskResponse.model_validate(task_data_for_pydantic)
        logger.debug(f"row_to_task_response - Başarılı görev dönüşümü: {response_model.id}")
        return response_model
    except ValidationError as e:
        logger.error(f"Pydantic Validation Hatası (Görev ID: {task_id_str}): {e.errors()}", exc_info=True)
        logger.error(f"Pydantic'e Giden Veri: {task_data_for_pydantic}")
        raise ValueError(f"Görev Pydantic modeline dönüştürülemedi (ID: {task_id_str}). Detay: {e.errors()}")
    except Exception as e:
        logger.error(f"Beklenmedik hata row_to_task_response'da (Görev ID: {task_id_str}): {e}", exc_info=True)
        raise

def hash_password(password: str) -> str:
    """
    Şifreyi bcrypt algoritması ile hashler.
    
    Güvenlik için şifreler düz metin olarak saklanmaz.
    bcrypt, salt ekleyerek her hash'i benzersiz yapar.
    
    Args:
        password: Hashlenecek şifre (düz metin)
    
    Returns:
        str: Hashlenmiş şifre (veritabanında saklanacak)
    """
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """
    Kullanıcının girdiği şifreyi hash ile doğrular.
    
    Giriş sırasında kullanıcının girdiği şifre ile
    veritabanındaki hash karşılaştırılır.
    
    Args:
        password: Kullanıcının girdiği şifre (düz metin)
        hashed: Veritabanındaki hashlenmiş şifre
    
    Returns:
        bool: Şifre eşleşirse True, değilse False
    """
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    """
    Kullanıcı ID'si için JWT token oluşturur.
    
    JWT token, kullanıcının kimliğini doğrulamak için kullanılır.
    Token içinde user_id ve expiration time (30 gün) bulunur.
    
    Args:
        user_id: Token oluşturulacak kullanıcı ID'si
    
    Returns:
        str: JWT token (Authorization header'da kullanılacak)
    """
    user_id_str = str(user_id)
    # Token süresi: 30 gün (86400 saniye = 1 gün)
    expire = datetime.now(timezone.utc).timestamp() + (86400 * 30)
    payload = {"user_id": user_id_str, "exp": expire}  # Token içeriği
    logger.debug(f"Token oluşturuluyor, payload: {payload}")
    # JWT token'ı oluştur ve döndür
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# ========== FASTAPI DEPENDENCY FONKSİYONLARI ==========
# Bu fonksiyonlar endpoint'lerde Depends() ile kullanılır
# Her istek için otomatik olarak çalışır ve kaynakları yönetir

def get_db_connection():
    """
    FastAPI dependency: Bağlantı havuzundan bir veritabanı bağlantısı sağlar.
    
    Her endpoint isteğinde bu fonksiyon çalışır ve bir veritabanı bağlantısı sağlar.
    İstek bitince bağlantı otomatik olarak havuza geri verilir (yield sayesinde).
    
    Yields:
        psycopg2.connection: PostgreSQL bağlantı objesi
    
    Raises:
        HTTPException: Bağlantı havuzu yoksa veya bağlantı alınamazsa
    """
    # Bağlantı havuzu kontrolü
    if connection_pool is None:
        logger.error("Veritabanı bağlantı havuzu tanımlanmamış veya başlatılamadı.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Veritabanı hizmeti kullanılamıyor.")
    
    conn = None
    try:
        # Havuzdan bir bağlantı al
        conn = connection_pool.getconn()
        logger.debug("Veritabanı bağlantısı havuzdan alındı.")
        yield conn  # Bağlantıyı endpoint'e ver, işlem bitince finally'e döner
    except psycopg2.Error as db_pool_err:
        # Veritabanı hatası
        logger.error(f"Veritabanı havuzundan bağlantı alınırken hata: {db_pool_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Veritabanı bağlantısı alınamadı.")
    finally:
        # İşlem bitince bağlantıyı havuza geri ver (kritik: kaynak sızıntısını önler)
        if conn:
            connection_pool.putconn(conn)
            logger.debug("Veritabanı bağlantısı havuza geri bırakıldı.")

def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    conn: Any = Depends(get_db_connection)
) -> str:
    """
    JWT token'dan kullanıcı ID'sini çıkarır ve veritabanında varlığını kontrol eder.
    
    Bu fonksiyon korumalı endpoint'lerde kullanılır.
    Authorization header'ından JWT token'ı alır, doğrular ve kullanıcı ID'sini döndürür.
    
    Args:
        credentials: HTTPAuthorizationCredentials - Authorization header'dan token
        conn: Veritabanı bağlantısı (dependency)
    
    Returns:
        str: Doğrulanmış kullanıcı ID'si
    
    Raises:
        HTTPException: Token geçersizse, süresi dolmuşsa veya kullanıcı bulunamazsa
    """
    if not JWT_SECRET:
        logger.critical("JWT_SECRET ortam değişkeni ayarlanmamış. Sunucu konfigürasyon hatası.")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Sunucu konfigürasyon hatası.")
    try:
        token = credentials.credentials
        logger.info(f"Token doğrulama için alınıyor: {token[:20]}...")
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            logger.debug(f"Token decode başarılı, payload: {payload}")
        except jwt.ExpiredSignatureError:
            logger.warning("Token süresi dolmuş.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token süresi dolmuş, lütfen tekrar giriş yapın.")
        except jwt.InvalidTokenError as e:
            logger.warning(f"Geçersiz token hatası: {e}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Geçersiz token: {e}")
        
        user_id = payload.get("user_id")

        if user_id is None:
            logger.warning("JWT payload'ında 'user_id' bulunamadı.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz token payload.")

        # Kullanıcının veritabanında varlığını kontrol et
        with conn.cursor() as cur:
            cur.execute("SELECT EXISTS (SELECT 1 FROM users WHERE id = %s)", (user_id,))
            exists = cur.fetchone()[0]
            if not exists:
                logger.warning(f"Token'daki kullanıcı veritabanında bulunamadı: {user_id}")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kullanıcı bulunamadı veya yetkilendirilmedi.")

        logger.debug(f"Token başarıyla doğrulandı, kullanıcı ID: {user_id}")
        return user_id
    except HTTPException:
        raise  # HTTPException'ları tekrar fırlat
    except jwt.ExpiredSignatureError:
        logger.warning("Token süresi dolmuş.")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token süresi dolmuş, lütfen tekrar giriş yapın.")
    except jwt.InvalidTokenError as e:
        logger.warning(f"Geçersiz token hatası: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Geçersiz token: {e}")
    except Exception as e:
        logger.error(f"Token doğrulama sırasında beklenmedik hata: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Token doğrulanamadı: {str(e)}")

# ========== KİMLİK DOĞRULAMA ENDPOINT'LERİ ==========

@api_router.post("/auth/register", response_model=TokenData, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, conn: Any = Depends(get_db_connection)):
    """
    Yeni kullanıcı kaydı endpoint'i.
    
    Kullanıcı adı, şifre ve opsiyonel e-posta ile yeni kullanıcı oluşturur.
    Şifre bcrypt ile hashlenir, JWT token oluşturulur ve otomatik giriş yapılır.
    Yeni kullanıcıya varsayılan kategoriler (Genel, İş, Kişisel) oluşturulur.
    
    Args:
        user_data: UserRegister - Kayıt bilgileri
        conn: Veritabanı bağlantısı (dependency)
    
    Returns:
        TokenData: JWT token ve kullanıcı bilgileri
    
    Raises:
        HTTPException: Kullanıcı adı/e-posta zaten kayıtlıysa veya veritabanı hatası varsa
    """
    logger.info(f"Kayıt isteği alındı: {user_data.username}")
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Kullanıcı adı veya e-posta zaten kayıtlı mı kontrol et
            cur.execute("SELECT id FROM users WHERE username = %s OR email = %s", (user_data.username, user_data.email))
            if cur.fetchone():
                logger.warning(f"Kayıt başarısız: Kullanıcı adı ({user_data.username}) veya e-posta ({user_data.email}) zaten kayıtlı.")
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kullanıcı adı veya e-posta zaten kullanılıyor.")

            user_id_obj = uuid.uuid4()
            user_id_str = str(user_id_obj)
            hashed_password = hash_password(user_data.password)
            created_at = datetime.now(timezone.utc)

            # Yeni kullanıcıyı ekle
            cur.execute("INSERT INTO users (id, username, email, password_hash, created_at) VALUES (%s, %s, %s, %s, %s)",
                        (user_id_obj, user_data.username, user_data.email, hashed_password, created_at))

            # Varsayılan kategoriler oluştur
            default_categories = [
                ("Genel", "#808080", "list"),
                ("İş", "#007BFF", "briefcase"),
                ("Kişisel", "#28A745", "person")
            ]
            cat_insert_sql = "INSERT INTO categories (id, user_id, name, color, icon, created_at) VALUES (%s, %s, %s, %s, %s, %s)"
            for name, color, icon in default_categories:
                cur.execute(cat_insert_sql, (uuid.uuid4(), user_id_obj, name, color, icon, created_at))

            conn.commit()
            logger.info(f"Yeni kullanıcı ve varsayılan kategoriler oluşturuldu: {user_data.username} (ID: {user_id_str})")

            # Token oluştur ve kullanıcı bilgisiyle birlikte döndür
            token = create_token(user_id_str)
            user_response = User(id=user_id_str, username=user_data.username, email=user_data.email, created_at=created_at)
            return TokenData(token=token, user=user_response)

    except psycopg2.Error as db_err:
        conn.rollback()
        logger.error(f"Veritabanı hatası (register): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Kayıt hatası: {str(db_err).strip()}")
    except HTTPException as http_exc:
        conn.rollback()
        raise http_exc
    except Exception as e:
        conn.rollback()
        logger.error(f"Beklenmedik hata (register): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kayıt işlemi sırasında beklenmedik bir hata oluştu.")

@api_router.post("/auth/login", response_model=TokenData)
def login(credentials: UserLogin, conn: Any = Depends(get_db_connection)):
    """
    Kullanıcı giriş endpoint'i.
    
    Kullanıcı adı ve şifre ile giriş yapar.
    Şifre veritabanındaki hash ile karşılaştırılır.
    Başarılı girişte JWT token oluşturulur ve döndürülür.
    
    Args:
        credentials: UserLogin - Giriş bilgileri (kullanıcı adı, şifre)
        conn: Veritabanı bağlantısı (dependency)
    
    Returns:
        TokenData: JWT token ve kullanıcı bilgileri
    
    Raises:
        HTTPException: Kullanıcı adı/şifre hatalıysa veya veritabanı hatası varsa
    """
    logger.info(f"Giriş isteği alındı: {credentials.username}")
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, username, email, password_hash, created_at FROM users WHERE username = %s", (credentials.username,))
            user_row = cur.fetchone()

            if not user_row or not verify_password(credentials.password, user_row["password_hash"]):
                logger.warning(f"Başarısız giriş denemesi: {credentials.username} (Yanlış kullanıcı adı/şifre)")
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Kullanıcı adı veya şifre hatalı.")

            user_id_str = str(user_row["id"])
            token = create_token(user_id_str)
            user_response = User(id=user_id_str, username=user_row["username"], email=user_row.get("email"), created_at=user_row["created_at"])
            logger.info(f"Başarılı giriş: {credentials.username}")
            return TokenData(token=token, user=user_response)

    except psycopg2.Error as db_err:
        logger.error(f"Veritabanı hatası (login): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Giriş işlemi sırasında bir veritabanı hatası oluştu.")
    except Exception as e:
        logger.error(f"Beklenmedik hata (login): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Giriş işlemi sırasında beklenmedik bir hata oluştu.")

@api_router.get("/auth/me", response_model=User)
def get_me(user_id: str = Depends(get_current_user_id), conn: Any = Depends(get_db_connection)):
    logger.debug(f"Mevcut kullanıcı bilgisi isteniyor: {user_id}")
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, username, email, created_at FROM users WHERE id = %s", (user_id,))
            user_row = cur.fetchone()

            if not user_row:
                logger.warning(f"Kullanıcı bulunamadı (get_me): {user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

            user_row['id'] = str(user_row['id'])
            return User.model_validate(user_row)

    except psycopg2.Error as db_err:
        logger.error(f"Veritabanı hatası (get_me): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kullanıcı bilgileri alınırken veritabanı hatası oluştu.")
    except Exception as e:
        logger.error(f"Beklenmedik hata (get_me): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kullanıcı bilgileri alınırken beklenmedik bir hata oluştu.")

# ========== Kategori Endpointleri ==========

@api_router.get("/categories", response_model=List[CategoryResponse])
def get_categories(user_id: str = Depends(get_current_user_id), conn: Any = Depends(get_db_connection)):
    logger.info(f"Kategoriler isteniyor, kullanıcı: {user_id}")
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, user_id, name, color, icon, created_at FROM categories WHERE user_id = %s OR user_id IS NULL ORDER BY name", (user_id,))
            categories = cur.fetchall()
            logger.info(f"{len(categories)} kategori bulundu.")

            response_list = []
            for cat in categories:
                cat_data = dict(cat)
                cat_data['id'] = str(cat_data['id'])
                if cat_data['user_id']:
                    cat_data['user_id'] = str(cat_data['user_id'])
                response_list.append(CategoryResponse.model_validate(cat_data))
            return response_list

    except psycopg2.Error as db_err:
        logger.error(f"Veritabanı hatası (get_categories): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kategoriler alınırken veritabanı hatası oluştu.")
    except Exception as e:
        logger.error(f"Beklenmedik hata (get_categories): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kategoriler alınırken beklenmedik bir hata oluştu.")

@api_router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(category_data: CategoryCreate, user_id: str = Depends(get_current_user_id), conn: Any = Depends(get_db_connection)):
    category_id_obj = uuid.uuid4()
    category_id_str = str(category_id_obj)
    created_at = datetime.now(timezone.utc)
    logger.info(f"Yeni kategori oluşturma isteği: {category_data.name}, kullanıcı: {user_id}")

    try:
        # user_id'yi UUID'ye çevir
        # user_id zaten string, direkt kullan
        
        with conn.cursor() as cur:
            cur.execute("INSERT INTO categories (id, user_id, name, color, icon, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
                        (category_id_obj, user_id, category_data.name, category_data.color, category_data.icon, created_at))
            conn.commit()
            logger.info(f"Kategori başarıyla oluşturuldu: {category_data.name} (ID: {category_id_str})")

            return CategoryResponse(id=category_id_str, user_id=user_id, created_at=created_at, **category_data.model_dump())

    except psycopg2.IntegrityError as e:
        conn.rollback()
        logger.warning(f"Kategori oluşturulamadı (IntegrityError): '{category_data.name}' kullanıcı {user_id} için zaten mevcut. {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu isimde bir kategori zaten mevcut.")
    except psycopg2.Error as db_err:
        conn.rollback()
        logger.error(f"Veritabanı hatası (create_category): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kategori oluşturulurken veritabanı hatası oluştu.")
    except HTTPException as http_exc:
        conn.rollback()
        raise http_exc
    except Exception as e:
        conn.rollback()
        logger.error(f"Beklenmedik hata (create_category): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kategori oluşturulurken beklenmedik bir hata oluştu.")

@api_router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: str,
    category_update: CategoryUpdate,
    user_id: str = Depends(get_current_user_id),
    conn: Any = Depends(get_db_connection)
):
    logger.info(f"Kategori güncelleniyor: {category_id}, kullanıcı: {user_id}")
    try:
        category_uuid = uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz kategori ID formatı.")

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Kategorinin kullanıcıya ait olup olmadığını kontrol et
            cur.execute("SELECT id, user_id, name, color, icon, created_at FROM categories WHERE id = %s AND user_id = %s", (category_uuid, user_id))
            existing_category = cur.fetchone()

            if not existing_category:
                logger.warning(f"Güncellenecek kategori bulunamadı veya kullanıcıya ait değil: {category_id}, kullanıcı: {user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategori bulunamadı veya size ait değil.")

            # Güncelleme verilerini hazırla
            update_data = category_update.model_dump(exclude_unset=True)
            if not update_data:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Güncellenecek alan yok.")

            # Eğer isim değiştiriliyorsa, aynı isimde başka kategori var mı kontrol et
            if "name" in update_data:
                cur.execute("SELECT id FROM categories WHERE name = %s AND user_id = %s AND id != %s", 
                          (update_data["name"], user_id, category_uuid))
                if cur.fetchone():
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu isimde bir kategori zaten mevcut.")

            # Güncelleme sorgusunu oluştur
            set_clauses = []
            params_list = []
            for key, value in update_data.items():
                set_clauses.append(f"{key} = %s")
                params_list.append(value)

            query = f"UPDATE categories SET {', '.join(set_clauses)} WHERE id = %s AND user_id = %s RETURNING id, user_id, name, color, icon, created_at"
            params_list.extend([category_uuid, user_id])

            cur.execute(query, tuple(params_list))
            updated_category = cur.fetchone()
            conn.commit()

            if not updated_category:
                logger.error(f"Kategori güncellendi fakat geri alınamadı: {category_id}")
                conn.rollback()
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kategori güncellenemedi.")

            logger.info(f"Kategori başarıyla güncellendi: {category_id}")

            # Response hazırla
            cat_data = dict(updated_category)
            cat_data['id'] = str(cat_data['id'])
            if cat_data['user_id']:
                cat_data['user_id'] = str(cat_data['user_id'])
            return CategoryResponse.model_validate(cat_data)

    except psycopg2.IntegrityError as e:
        conn.rollback()
        logger.warning(f"Kategori güncellenemedi (IntegrityError): {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bu isimde bir kategori zaten mevcut.")
    except psycopg2.Error as db_err:
        conn.rollback()
        logger.error(f"Veritabanı hatası (update_category): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kategori güncellenirken veritabanı hatası oluştu.")
    except HTTPException as http_exc:
        conn.rollback()
        raise http_exc
    except Exception as e:
        conn.rollback()
        logger.error(f"Beklenmedik hata (update_category): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kategori güncellenirken beklenmedik bir hata oluştu.")

@api_router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: str,
    user_id: str = Depends(get_current_user_id),
    conn: Any = Depends(get_db_connection)
):
    logger.info(f"Kategori silme isteği: {category_id}, kullanıcı: {user_id}")
    try:
        category_uuid = uuid.UUID(category_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz kategori ID formatı.")

    try:
        with conn.cursor() as cur:
            # Kategorinin kullanıcıya ait olup olmadığını kontrol et
            cur.execute("SELECT id FROM categories WHERE id = %s AND user_id = %s", (category_uuid, user_id))
            if not cur.fetchone():
                logger.warning(f"Silinecek kategori bulunamadı veya kullanıcıya ait değil: {category_id}, kullanıcı: {user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategori bulunamadı veya size ait değil.")

            # Kategoriyi sil (CASCADE sayesinde bu kategoriye ait görevlerin category_id'si NULL olur)
            cur.execute("DELETE FROM categories WHERE id = %s AND user_id = %s", (category_uuid, user_id))
            conn.commit()

            if cur.rowcount == 0:
                logger.warning(f"Kategori silinemedi: {category_id}, kullanıcı: {user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kategori bulunamadı veya size ait değil.")

            logger.info(f"Kategori başarıyla silindi: {category_id}")
            return

    except psycopg2.Error as db_err:
        conn.rollback()
        logger.error(f"Veritabanı hatası (delete_category): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kategori silinirken veritabanı hatası oluştu.")
    except HTTPException as http_exc:
        conn.rollback()
        raise http_exc
    except Exception as e:
        conn.rollback()
        logger.error(f"Beklenmedik hata (delete_category): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Kategori silinirken beklenmedik bir hata oluştu.")

# ========== Görev Endpointleri ==========
# DİKKAT: Sadece bu fonksiyonu kopyalayıp eskisinin yerine yapıştırın!
# Diğer fonksiyonlar önceki cevaptaki gibi kalmalı.

# DİKKAT: Sadece bu fonksiyonu kopyalayıp eskisinin yerine yapıştırın!
@api_router.post("/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, user_id: str = Depends(get_current_user_id), conn: Any = Depends(get_db_connection)):
    task_id_obj = uuid.uuid4()
    task_id_str = str(task_id_obj)
    created_at = datetime.now(timezone.utc)
    logger.info(f"Yeni görev oluşturma isteği: '{task_in.title}', kullanıcı: {user_id}")

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cat_id_to_use = None

            if task_in.category_id:
                try:
                    # Kategori kontrolü - direkt string olarak kontrol et
                    cur.execute(
                        "SELECT id FROM categories WHERE id = %s AND (user_id = %s OR user_id IS NULL)",
                        (task_in.category_id, user_id)  # Direkt string olarak kullan
                    )
                    if not cur.fetchone():
                        logger.warning(f"Geçersiz kategori ID'si: {task_in.category_id}, kullanıcı {user_id} için bulunamadı.")
                        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Belirtilen kategori bulunamadı veya size ait değil.")
                    cat_id_to_use = task_in.category_id  # String olarak sakla
                except ValueError:
                    logger.warning(f"Geçersiz kategori ID formatı: {task_in.category_id}")
                    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz kategori ID formatı.")

            tags_json = json.dumps(task_in.tags or [])
            images_json = json.dumps(task_in.images or [])

            # Tüm ID'leri string olarak gönder
            insert_query = """
                INSERT INTO tasks (id, user_id, title, description, category_id, tags, priority, status, completion_percentage, images, due_date, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cur.execute(insert_query, (
                task_id_str,  # STRING olarak gönder
                user_id,      # String olarak gönder
                task_in.title, 
                task_in.description,
                cat_id_to_use,  # String veya None
                tags_json, 
                task_in.priority, 
                task_in.status, 
                task_in.completion_percentage,
                images_json, 
                task_in.due_date, 
                created_at, 
                created_at
            ))

            conn.commit()
            logger.info(f"Görev veritabanına eklendi: {task_id_str}")

            # Oluşturulan görevi geri getir
            select_query = """
                SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
                FROM tasks t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.id = %s
            """
            cur.execute(select_query, (task_id_str,))  # String olarak sorgula
            new_task_row = cur.fetchone()

            if not new_task_row:
                logger.error(f"Yeni oluşturulan görev (ID: {task_id_str}) geri alınamadı.")
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Oluşturulan görev geri alınamadı.")

            return row_to_task_response(new_task_row)

    except psycopg2.Error as db_err:
        conn.rollback()
        logger.error(f"Veritabanı hatası (create_task): {db_err}", exc_info=True)
        error_message = str(db_err).strip()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Veritabanı hatası: {error_message}")
    except HTTPException as http_exc:
        conn.rollback()
        raise http_exc
    except ValueError as val_err:
        conn.rollback()
        logger.error(f"Veri işleme hatası (create_task): {val_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Görev verisi işlenirken hata: {val_err}")
    except Exception as e:
        conn.rollback()
        logger.error(f"Beklenmedik hata (create_task): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev oluşturulurken beklenmedik bir hata oluştu.")

# Diğer fonksiyonlar (@api_router.get("/tasks") vs.) burada devam eder...
@api_router.get("/tasks", response_model=List[TaskResponse])
def get_tasks(
    category_id: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
    conn: Any = Depends(get_db_connection)
):
    logger.info(f"Görev listesi isteniyor, kullanıcı: {user_id}, filtreler: category_id={category_id}, priority={priority}, status={status}")
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            query_params = [user_id]
            base_query = """
                SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
                FROM tasks t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_id = %s
            """

            if category_id:
                try:
                    cat_uuid = uuid.UUID(category_id)
                    base_query += " AND t.category_id = %s"
                    query_params.append(cat_uuid)
                except ValueError:
                    logger.warning(f"Geçersiz kategori ID formatı (filtre): {category_id}. Boş görev listesi döndürülüyor.")
                    return []

            if priority:
                base_query += " AND t.priority = %s"
                query_params.append(priority)

            if status:
                base_query += " AND t.status = %s"
                query_params.append(status)

            base_query += " ORDER BY t.created_at DESC"

            cur.execute(base_query, tuple(query_params))
            rows = cur.fetchall()
            logger.info(f"{len(rows)} görev bulundu (filtreler ile).")

            tasks_response = [row_to_task_response(row) for row in rows]
            return tasks_response

    except psycopg2.Error as db_err:
        logger.error(f"Veritabanı hatası (get_tasks): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev listesi alınırken veritabanı hatası oluştu.")
    except ValueError as val_err:
        logger.error(f"Veri dönüşüm hatası (get_tasks): {val_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Görev verisi işlenemedi: {val_err}")
    except Exception as e:
        logger.error(f"Beklenmedik hata (get_tasks): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev listesi alınırken beklenmedik bir hata oluştu.")

@api_router.get("/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: str, user_id: str = Depends(get_current_user_id), conn: Any = Depends(get_db_connection)):
    logger.info(f"Tek görev isteniyor: {task_id}, kullanıcı: {user_id}")
    try:
        # UUID formatını doğrula ama string olarak kullan (psycopg2 adapt sorunu için)
        task_uuid = uuid.UUID(task_id)
        user_uuid = uuid.UUID(user_id)
        # String'e çevir - PostgreSQL otomatik cast eder
        task_uuid_str = str(task_uuid)
        user_uuid_str = str(user_uuid)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz Görev ID formatı.")

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            select_query = """
                SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
                FROM tasks t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.id = %s::uuid AND t.user_id = %s::uuid
            """
            cur.execute(select_query, (task_uuid_str, user_uuid_str))
            row = cur.fetchone()

            if not row:
                logger.warning(f"Görev bulunamadı veya kullanıcıya ait değil: {task_id}, kullanıcı: {user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Görev bulunamadı.")

            return row_to_task_response(row)

    except psycopg2.Error as db_err:
        logger.error(f"Veritabanı hatası (get_task): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev alınırken veritabanı hatası oluştu.")
    except ValueError as val_err:
        logger.error(f"Veri dönüşüm hatası (get_task): {val_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Görev verisi işlenemedi: {val_err}")
    except Exception as e:
        logger.error(f"Beklenmedik hata (get_task): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev alınırken beklenmedik bir hata oluştu.")

@api_router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: str, task_update: TaskUpdate, user_id: str = Depends(get_current_user_id), conn: Any = Depends(get_db_connection)):
    logger.info(f"Görev güncelleniyor: {task_id}, kullanıcı: {user_id}, Güncelleme Verisi: {task_update.model_dump(exclude_unset=True)}")
    try:
        # UUID formatını doğrula ama string olarak kullan (psycopg2 adapt sorunu için)
        task_uuid = uuid.UUID(task_id)
        user_uuid = uuid.UUID(user_id)
        # String'e çevir - PostgreSQL otomatik cast eder
        task_uuid_str = str(task_uuid)
        user_uuid_str = str(user_uuid)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz Görev ID formatı.")

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Görevin kullanıcıya ait olup olmadığını kontrol et
            cur.execute("SELECT id FROM tasks WHERE id = %s::uuid AND user_id = %s::uuid", (task_uuid_str, user_uuid_str))
            if not cur.fetchone():
                logger.warning(f"Güncellenecek görev bulunamadı veya kullanıcıya ait değil: {task_id}, kullanıcı: {user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Görev bulunamadı veya size ait değil.")

            update_data = task_update.model_dump(exclude_unset=True)

            cat_uuid_str = None
            if "category_id" in update_data:
                if update_data["category_id"] is not None:
                    try:
                        cat_uuid = uuid.UUID(update_data["category_id"])
                        cat_uuid_str = str(cat_uuid)
                        cur.execute("SELECT id FROM categories WHERE id = %s::uuid AND (user_id = %s::uuid OR user_id IS NULL)", (cat_uuid_str, user_uuid_str))
                        if not cur.fetchone():
                            logger.warning(f"Geçersiz kategori ID'si (güncelleme): {update_data['category_id']}, kullanıcı {user_id} için bulunamadı.")
                            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Belirtilen kategori bulunamadı veya size ait değil.")
                    except ValueError:
                        logger.warning(f"Geçersiz kategori UUID formatı (güncelleme): {update_data['category_id']}")
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz kategori ID formatı.")
                update_data["category_id"] = cat_uuid_str

            if not update_data:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Güncellenecek alan yok.")

            update_data["updated_at"] = datetime.now(timezone.utc)

            params_list = []
            set_clauses = []
            for key, value in update_data.items():
                set_clauses.append(f"{key} = %s")
                if key in ["tags", "images"] and value is not None:
                    params_list.append(json.dumps(value))
                else:
                    params_list.append(value)

            query = f"UPDATE tasks SET {', '.join(set_clauses)} WHERE id = %s::uuid AND user_id = %s::uuid RETURNING id"
            params_list.extend([task_uuid_str, user_uuid_str])

            cur.execute(query, tuple(params_list))
            updated_row_id = cur.fetchone()
            conn.commit()

            if not updated_row_id:
                logger.error(f"Görev güncellendi fakat ID geri alınamadı: {task_id}. rollback yapıldı.")
                conn.rollback()
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev güncellenemedi veya ID geri alınamadı.")

            logger.info(f"Görev başarıyla güncellendi: {task_id}")

            # Güncellenen görevi geri getir
            select_query = """
                SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
                FROM tasks t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.id = %s::uuid AND t.user_id = %s::uuid
            """
            cur.execute(select_query, (task_uuid_str, user_uuid_str))
            updated_task_row = cur.fetchone()

            if not updated_task_row:
                 logger.error(f"Güncellenen görev geri alınamadı: {task_id}")
                 raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Güncellenen görev bulunamadı.")

            return row_to_task_response(updated_task_row)

    except psycopg2.Error as db_err:
        conn.rollback()
        logger.error(f"Veritabanı hatası (update_task): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Veritabanı hatası: {str(db_err).strip()}")
    except HTTPException as http_exc:
        conn.rollback()
        raise http_exc
    except ValueError as val_err:
        conn.rollback()
        logger.error(f"Veri işleme hatası (update_task): {val_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Görev güncelleme verisi işlenirken hata: {val_err}")
    except Exception as e:
        conn.rollback()
        logger.error(f"Beklenmedik hata (update_task): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev güncellenirken beklenmedik bir hata oluştu.")

@api_router.delete("/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(task_id: str, user_id: str = Depends(get_current_user_id), conn: Any = Depends(get_db_connection)):
    logger.info(f"Görev silme isteği: {task_id}, kullanıcı: {user_id}")
    try:
        # UUID formatını doğrula ama string olarak kullan (psycopg2 adapt sorunu için)
        task_uuid = uuid.UUID(task_id)
        user_uuid = uuid.UUID(user_id)
        # String'e çevir - PostgreSQL otomatik cast eder
        task_uuid_str = str(task_uuid)
        user_uuid_str = str(user_uuid)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz Görev ID formatı.")

    try:
        with conn.cursor() as cur:
            # Önce görevin varlığını ve kullanıcıya ait olup olmadığını kontrol et
            cur.execute("SELECT id FROM tasks WHERE id = %s::uuid AND user_id = %s::uuid", (task_uuid_str, user_uuid_str))
            if not cur.fetchone():
                logger.warning(f"Silinecek görev bulunamadı veya kullanıcıya ait değil: {task_id}, kullanıcı: {user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Görev bulunamadı veya size ait değil.")
            
            # Görevi sil
            cur.execute("DELETE FROM tasks WHERE id = %s::uuid AND user_id = %s::uuid", (task_uuid_str, user_uuid_str))
            
            # Silme işleminin başarılı olup olmadığını kontrol et
            if cur.rowcount == 0:
                logger.warning(f"Görev silme işlemi başarısız (rowcount=0): {task_id}, kullanıcı: {user_id}")
                conn.rollback()
                raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev silinemedi.")
            
            # İşlemi commit et
            conn.commit()
            logger.info(f"Görev başarıyla silindi: {task_id}")
            return

    except HTTPException:
        # HTTPException'ları tekrar fırlat (rollback yapılmış olabilir)
        if conn:
            try:
                conn.rollback()
            except:
                pass
        raise
    except psycopg2.Error as db_err:
        if conn:
            try:
                conn.rollback()
            except:
                pass
        logger.error(f"Veritabanı hatası (delete_task): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev silinirken veritabanı hatası oluştu.")
    except Exception as e:
        if conn:
            try:
                conn.rollback()
            except:
                pass
        logger.error(f"Beklenmedik hata (delete_task): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev silinirken beklenmedik bir hata oluştu.")

# ========== AI Endpointleri ==========

class ChatMessage(BaseModel):
    """AI chat mesaj modeli"""
    message: str  # Kullanıcı mesajı

class ChatResponse(BaseModel):
    """AI chat yanıt modeli"""
    response: str  # AI yanıtı

@api_router.post("/ai/suggestions", response_model=List[str])
def get_ai_suggestions(user_id: str = Depends(get_current_user_id)):
    """AI önerileri endpoint'i (eski - geriye dönük uyumluluk için)"""
    logger.info(f"AI önerileri istendi: {user_id}")
    return ["Markete git", "Projeyi bitir", "E-postaları kontrol et"]

@api_router.post("/ai/chat", response_model=ChatResponse)
def ai_chat(
    chat_message: ChatMessage,
    user_id: str = Depends(get_current_user_id),
    conn: Any = Depends(get_db_connection)
):
    """
    AI Chatbot endpoint'i.
    
    Kullanıcının görevlerine hakim olan bir AI asistan ile sohbet eder.
    OpenRouter API kullanarak ücretsiz AI modeli ile görev yönetimi konusunda yardım sağlar.
    
    Args:
        chat_message: ChatMessage - Kullanıcı mesajı
        user_id: Kullanıcı ID'si (dependency)
        conn: Veritabanı bağlantısı (dependency)
    
    Returns:
        ChatResponse: AI yanıtı
    """
    logger.info(f"AI chat isteği alındı: {user_id}, mesaj: {chat_message.message[:50]}...")
    
    try:
        # Kullanıcının görevlerini veritabanından al
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
                FROM tasks t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.user_id = %s
                ORDER BY t.created_at DESC
                LIMIT 20
            """, (user_id,))
            tasks = cur.fetchall()
        
        # Görevleri AI için formatla
        tasks_summary = []
        for task in tasks:
            tasks_summary.append({
                "title": task.get("title", ""),
                "description": task.get("description", ""),
                "status": task.get("status", ""),
                "priority": task.get("priority", ""),
                "completion_percentage": task.get("completion_percentage", 0),
                "category": task.get("category_name", "Genel"),
                "tags": json.loads(task.get("tags", "[]")) if isinstance(task.get("tags"), str) else task.get("tags", [])
            })
        
        # AI için sistem prompt'u hazırla (daha samimi ve akıllı)
        system_prompt = f"""Sen TaskMaster görev yönetimi uygulamasının AI asistanısın. 
Kullanıcının görevlerine ve detaylarına tam olarak hakimsin. Görevlerini akıllıca yönetmesinde yardımcı ol.

Kullanıcının mevcut görevleri:
{json.dumps(tasks_summary, ensure_ascii=False, indent=2)}

ÖNEMLİ TALİMATLAR:
1. Kullanıcı selamlaşırsa (merhaba, selam, iyi günler vb.), önce samimi bir şekilde selamla, sonra nasıl yardımcı olabileceğini sor.
2. Her soruya farklı ve özel cevaplar ver. Aynı cevabı tekrarlama.
3. Görevlerle ilgili sorulara detaylı ve akıllıca cevaplar ver.
4. Önceliklendirme, zaman yönetimi, görev organizasyonu konularında pratik öneriler sun.
5. Kullanıcının görevlerini analiz et ve kişiselleştirilmiş tavsiyeler ver.
6. Samimi, dostane ve yardımsever bir ton kullan. İnsansı konuş.
7. Her zaman Türkçe cevap ver.
8. Kısa ve öz cevaplar ver, gereksiz uzatma.

Örnek iyi cevaplar:
- "Merhaba! Tabii ki, görevlerinizi önceliklendirmenize yardımcı olabilirim. Şu anda 3 göreviniz var..."
- "Görevlerinize baktığımda, 'Proje sunumu' göreviniz yüksek öncelikli görünüyor..."
- "Evet, görevlerinizi daha iyi organize edebiliriz. Hangi konuda yardıma ihtiyacınız var?"

Kötü cevaplar (bunları verme):
- Her soruya aynı istatistikleri tekrarlamak
- Mekanik ve robot gibi cevaplar
- "Görevlerinizi yönetmek için ana sayfadan..." gibi genel ifadeleri sürekli tekrarlamak"""

        # OpenRouter API'ye istek gönder (ücretsiz model kullan)
        # Önce ortam değişkeninden oku, yoksa .env'den tekrar yükle
        OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
        
        # Eğer ortam değişkeninde yoksa, .env dosyasını tekrar yükle
        if not OPENROUTER_API_KEY:
            logger.warning("OPENROUTER_API_KEY ortam değişkeninde bulunamadı, .env dosyası tekrar yükleniyor...")
            dotenv_path = ROOT_DIR / '.env'
            load_dotenv(dotenv_path=dotenv_path, override=True)  # override=True ile mevcut değerleri güncelle
            OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
        
        # Debug: API key kontrolü
        logger.info(f"OPENROUTER_API_KEY kontrolü: {'Var' if OPENROUTER_API_KEY else 'YOK'}")
        if OPENROUTER_API_KEY:
            logger.info(f"API Key uzunluğu: {len(OPENROUTER_API_KEY)} karakter")
            logger.info(f"API Key ilk 10 karakter: {OPENROUTER_API_KEY[:10]}...")
        else:
            logger.error("OPENROUTER_API_KEY bulunamadı! Lütfen backend/.env dosyasında OPENROUTER_API_KEY=your-key şeklinde tanımlayın.")
            logger.error(f".env dosyası yolu: {ROOT_DIR / '.env'}")
            logger.error(f".env dosyası var mı: {(ROOT_DIR / '.env').exists()}")
        
        if not OPENROUTER_API_KEY:
            return ChatResponse(response="AI servisi yapılandırılmamış. Lütfen yöneticiye başvurun.")
        
        # ÜCRETSİZ MODELLER (OpenRouter - 2025 - :free etiketi ile doğrulanmış):
        # 
        # EN İYİ SEÇENEK (Türkçe görev yönetimi için):
        # 1. google/gemma-3-4b-it:free (ÖNERİLEN - 4B parametre, ücretsiz, iyi kalite, Türkçe desteği)
        # 2. mistralai/mistral-small-3.2-24b-instruct:free (En iyi kalite - 24B parametre, daha yavaş)
        # 
        # ALTERNATİFLER:
        # 3. google/gemma-3-12b-it:free (12B parametre, çok iyi kalite, orta hız)
        # 4. microsoft/phi-3-medium-4k-instruct (Ücretsiz, hızlı, küçük context)
        # 
        # Not: gemma-3-4b-it:free en dengeli seçenek (hız + kalite + ücretsiz + Türkçe)
        # Daha iyi kalite için mistral-small-3.2-24b-instruct:free kullanılabilir (daha yavaş)
        model = "google/gemma-3-4b-it:free"  # Ücretsiz model (önerilen - en iyi denge)
        
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": chat_message.message}
                ],
                "temperature": 0.8,  # Daha yaratıcı ve doğal cevaplar için artırıldı
                "max_tokens": 300,  # Daha kısa ve öz cevaplar için azaltıldı
            },
            timeout=30
        )
        
        if response.status_code == 200:
            ai_response = response.json()
            chat_response_text = ai_response["choices"][0]["message"]["content"]
            logger.info(f"AI yanıtı alındı: {chat_response_text[:50]}...")
            return ChatResponse(response=chat_response_text)
        else:
            # Rate limit veya hata durumunda fallback
            logger.warning(f"OpenRouter API hatası: {response.status_code}, {response.text}")
            
            # Basit bir fallback yanıt
            if "rate limit" in response.text.lower() or response.status_code == 429:
                return ChatResponse(response="Üzgünüm, AI servisi şu anda çok yoğun. Birkaç dakika sonra tekrar deneyebilir misiniz?")
            else:
                # Görevler hakkında akıllı fallback yanıt (kullanıcı mesajına göre)
                total_tasks = len(tasks_summary)
                completed = sum(1 for t in tasks_summary if t["status"] == "Tamamlandı")
                in_progress = sum(1 for t in tasks_summary if t["status"] == "Devam Ediyor")
                todo = sum(1 for t in tasks_summary if t["status"] == "Yapılacak")
                
                user_message_lower = chat_message.message.lower()
                
                # Kullanıcı mesajına göre farklı cevaplar
                if any(word in user_message_lower for word in ["merhaba", "selam", "hey", "hi", "hello"]):
                    fallback_response = f"Merhaba! TaskMaster asistanınızım. Şu anda {total_tasks} göreviniz var. {completed} görev tamamlandı, {in_progress} görev devam ediyor, {todo} görev yapılacak durumda. Görevlerinizle ilgili nasıl yardımcı olabilirim?"
                elif any(word in user_message_lower for word in ["öncelik", "önceliklendir", "hangi", "hangisi"]):
                    # Öncelikli görevleri bul
                    high_priority = [t for t in tasks_summary if t.get("priority") in ["Yüksek", "Acil"]]
                    if high_priority:
                        task_names = ", ".join([t["title"] for t in high_priority[:3]])
                        fallback_response = f"Öncelikli görevlerinize baktığımda: {task_names} görevleriniz yüksek öncelikli görünüyor. Bunlara öncelik vermenizi öneririm."
                    else:
                        fallback_response = "Şu anda yüksek öncelikli göreviniz görünmüyor. Görevlerinizi önceliklendirmek için görev detaylarından öncelik seviyesini ayarlayabilirsiniz."
                elif any(word in user_message_lower for word in ["tamamlan", "bitir", "yapıldı"]):
                    fallback_response = f"Harika! {completed} göreviniz tamamlanmış. {todo} görev daha yapılacak durumda. Devam eden görevlerinizi tamamlamaya odaklanabilirsiniz."
                elif any(word in user_message_lower for word in ["yardım", "nasıl", "ne yapmalı"]):
                    fallback_response = f"Size yardımcı olabilirim! {total_tasks} göreviniz var. Görevlerinizi önceliklendirmek, organize etmek veya yeni görevler eklemek konusunda yardımcı olabilirim. Hangi konuda destek istersiniz?"
                else:
                    # Genel cevap (daha samimi)
                    if total_tasks == 0:
                        fallback_response = "Henüz göreviniz yok. Yeni görevler ekleyerek başlayabilirsiniz. Size nasıl yardımcı olabilirim?"
                    else:
                        fallback_response = f"Görevlerinize baktığımda {total_tasks} göreviniz var. {completed} görev tamamlandı, {in_progress} görev devam ediyor. Görevlerinizle ilgili daha spesifik bir soru sorarsanız size daha iyi yardımcı olabilirim."
                
                return ChatResponse(response=fallback_response)
                
    except requests.exceptions.RequestException as e:
        logger.error(f"OpenRouter API istek hatası: {e}", exc_info=True)
        return ChatResponse(response="AI servisine bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.")
    except Exception as e:
        logger.error(f"AI chat beklenmedik hata: {e}", exc_info=True)
        return ChatResponse(response="Bir hata oluştu. Lütfen tekrar deneyin.")

# --- Router'ı Ana Uygulamaya Dahil Etme ---
app.include_router(api_router)

# --- Uvicorn çalıştırma ---
if __name__ == "__main__":
   import uvicorn
   logger.info("Uvicorn sunucusu başlatılıyor...")
   uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)