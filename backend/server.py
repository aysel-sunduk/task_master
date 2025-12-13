import os
import uuid
import bcrypt
import jwt
import logging
import json
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Any
from contextlib import asynccontextmanager

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from pydantic import BaseModel, Field, ValidationError, ConfigDict
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware

# --- Logging Yapılandırması ---
logging.basicConfig(level=logging.INFO, format='%(levelname)s:%(name)s:%(asctime)s:%(message)s')
logger = logging.getLogger(__name__)

# --- Ortam Değişkenleri ---
ROOT_DIR = Path(__file__).parent
dotenv_path = ROOT_DIR / '.env'
logger.info(f".env dosyası aranıyor: {dotenv_path}")
load_dotenv(dotenv_path=dotenv_path)
logger.info(".env dosyası yüklendi (varsa).")

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")

# Başlangıç Kontrolleri
if not DATABASE_URL:
    logger.critical("DATABASE_URL ortam değişkeni bulunamadı! Lütfen .env dosyasını kontrol edin.")
    raise ValueError("DATABASE_URL ortam değişkeni ayarlanmalı.")
else:
    masked_db_url = DATABASE_URL.split('@')[0].rsplit(':', 1)[0] + "@" + DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else DATABASE_URL
    logger.info(f"DATABASE_URL yüklendi: {masked_db_url}")

if not JWT_SECRET:
    logger.critical("JWT_SECRET ortam değişkeni bulunamadı! Bu güvenlik için kritik öneme sahiptir.")
    raise ValueError("JWT_SECRET ortam değişkeni ayarlanmalı.")
else:
    logger.info(f"JWT_SECRET yüklendi: {'*' * (len(JWT_SECRET) - 4)}{JWT_SECRET[-4:]}")
logger.info(f"JWT_ALGORITHM kullanılıyor: {JWT_ALGORITHM}")

# --- Veritabanı Bağlantı Havuzu ---
connection_pool = None

# --- Uygulama Lifespan Yönetimi ---
@asynccontextmanager
async def lifespan_manager(app: FastAPI):
    # Uygulama başlarken çalışacak kısım (yield öncesi)
    logger.info("FastAPI uygulama yaşam döngüsü başlatılıyor...")

    # Bağlantı havuzunu başlat
    global connection_pool
    try:
        logger.info("PostgreSQL bağlantı havuzu oluşturuluyor...")
        connection_pool = pool.SimpleConnectionPool(1, 20, dsn=DATABASE_URL)
        # Havuzun çalışıp çalışmadığını test et
        conn_test = connection_pool.getconn()
        logger.info("Test bağlantısı alındı.")
        with conn_test.cursor() as cur:
            cur.execute("SELECT 1")
            logger.info("Veritabanı test sorgusu başarılı.")
        connection_pool.putconn(conn_test)
        logger.info("PostgreSQL bağlantı havuzu başarıyla oluşturuldu ve test edildi.")
    except psycopg2.Error as e:
        logger.critical(f"Veritabanı bağlantı havuzu oluşturulamadı veya test edilemedi: {e}", exc_info=True)
        raise RuntimeError(f"Veritabanı bağlantı havuzu hatası: {e}")
    except Exception as e:
        logger.critical(f"Bağlantı havuzu kurulurken beklenmedik hata: {e}", exc_info=True)
        raise RuntimeError(f"Bağlantı havuzu kurulum hatası: {e}")

    yield # Uygulama ömrü boyunca burada bekler

    # Uygulama kapanırken çalışacak kısım (yield sonrası)
    logger.info("FastAPI uygulama yaşam döngüsü sonlandırılıyor...")
    if connection_pool:
        connection_pool.closeall()
        logger.info("PostgreSQL bağlantı havuzu kapatıldı.")

# --- FastAPI Uygulaması ve Router ---
app = FastAPI(title="TaskMaster API", version="1.0", lifespan=lifespan_manager)
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== Pydantic Modelleri ==========

class UserRegister(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class User(BaseModel):
    id: str
    username: str
    email: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TokenData(BaseModel):
    token: str
    user: User

class CategoryBase(BaseModel):
    name: str
    color: Optional[str] = "#808080"
    icon: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: str
    user_id: Optional[str] = None
    created_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: Optional[str] = ""
    category_id: Optional[str] = None
    tags: List[str] = []
    priority: str = "Orta"
    status: str = "Yapılacak"
    completion_percentage: int = Field(0, ge=0, le=100)
    images: List[str] = []
    due_date: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1)
    description: Optional[str] = None
    category_id: Optional[str] = None
    tags: Optional[List[str]] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    completion_percentage: Optional[int] = Field(None, ge=0, le=100)
    images: Optional[List[str]] = None
    due_date: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = ""
    tags: List[str] = Field(default_factory=list)
    priority: str = "Orta"
    status: str = "Yapılacak"
    completion_percentage: int = 0
    images: List[str] = Field(default_factory=list)
    due_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    category_id: Optional[str] = None
    category_name: Optional[str] = None
    category_color: Optional[str] = None
    category_icon: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

# ========== Yardımcı Fonksiyonlar ==========

def parse_json_list_field(raw_value: Any, field_name: str, item_id: str) -> List[Any]:
    """Veritabanından gelen JSON stringi veya listeyi parse eder."""
    if isinstance(raw_value, list):
        return raw_value
    if isinstance(raw_value, str):
        try:
            parsed = json.loads(raw_value)
            if isinstance(parsed, list):
                return parsed
            else:
                logger.warning(f"ID {item_id}: '{field_name}' JSON list değil: {raw_value}. Boş liste döndürüldü.")
                return []
        except json.JSONDecodeError:
            logger.warning(f"ID {item_id}: '{field_name}' geçersiz JSON formatı: {raw_value}. Boş liste döndürüldü.")
            return []
    if raw_value is not None:
        logger.warning(f"ID {item_id}: '{field_name}' beklenmedik tip ({type(raw_value)}): {raw_value}. Boş liste ayarlandı.")
        return []
    return []

def row_to_task_response(row: dict) -> TaskResponse:
    """Veritabanı satırını TaskResponse Pydantic modeline dönüştürür."""
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
    """Şifreyi hashler."""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Şifreyi hash ile doğrular."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    """Kullanıcı ID'si için JWT token oluşturur."""
    user_id_str = str(user_id)
    expire = datetime.now(timezone.utc).timestamp() + (86400 * 30)
    payload = {"user_id": user_id_str, "exp": expire}
    logger.debug(f"Token oluşturuluyor, payload: {payload}")
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

# --- Veritabanı Bağlantısı Dependency ---
def get_db_connection():
    """FastAPI dependency: Bağlantı havuzundan bir veritabanı bağlantısı sağlar."""
    if connection_pool is None:
        logger.error("Veritabanı bağlantı havuzu tanımlanmamış veya başlatılamadı.")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Veritabanı hizmeti kullanılamıyor.")
    conn = None
    try:
        conn = connection_pool.getconn()
        logger.debug("Veritabanı bağlantısı havuzdan alındı.")
        yield conn
    except psycopg2.Error as db_pool_err:
        logger.error(f"Veritabanı havuzundan bağlantı alınırken hata: {db_pool_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Veritabanı bağlantısı alınamadı.")
    finally:
        if conn:
            connection_pool.putconn(conn)
            logger.debug("Veritabanı bağlantısı havuza geri bırakıldı.")

# --- Mevcut Kullanıcı ID'si Dependency ---
def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    conn: Any = Depends(get_db_connection)
) -> str:
    """JWT token'dan kullanıcı ID'sini çıkarır ve veritabanında varlığını kontrol eder."""
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

# ========== Auth Endpointleri ==========

@api_router.post("/auth/register", response_model=TokenData, status_code=status.HTTP_201_CREATED)
def register(user_data: UserRegister, conn: Any = Depends(get_db_connection)):
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
        task_uuid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz Görev ID formatı.")

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            select_query = """
                SELECT t.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
                FROM tasks t
                LEFT JOIN categories c ON t.category_id = c.id
                WHERE t.id = %s AND t.user_id = %s
            """
            cur.execute(select_query, (task_uuid, user_id))
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
        task_uuid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz Görev ID formatı.")

    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Görevin kullanıcıya ait olup olmadığını kontrol et
            cur.execute("SELECT id FROM tasks WHERE id = %s AND user_id = %s", (task_uuid, user_id))
            if not cur.fetchone():
                logger.warning(f"Güncellenecek görev bulunamadı veya kullanıcıya ait değil: {task_id}, kullanıcı: {user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Görev bulunamadı veya size ait değil.")

            update_data = task_update.model_dump(exclude_unset=True)

            cat_uuid = None
            if "category_id" in update_data:
                if update_data["category_id"] is not None:
                    try:
                        cat_uuid = uuid.UUID(update_data["category_id"])
                        cur.execute("SELECT id FROM categories WHERE id = %s AND (user_id = %s OR user_id IS NULL)", (cat_uuid, user_id))
                        if not cur.fetchone():
                            logger.warning(f"Geçersiz kategori ID'si (güncelleme): {update_data['category_id']}, kullanıcı {user_id} için bulunamadı.")
                            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Belirtilen kategori bulunamadı veya size ait değil.")
                    except ValueError:
                        logger.warning(f"Geçersiz kategori UUID formatı (güncelleme): {update_data['category_id']}")
                        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz kategori ID formatı.")
                update_data["category_id"] = cat_uuid

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

            query = f"UPDATE tasks SET {', '.join(set_clauses)} WHERE id = %s AND user_id = %s RETURNING id"
            params_list.extend([task_uuid, user_id])

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
                WHERE t.id = %s
            """
            cur.execute(select_query, (task_uuid,))
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
        task_uuid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz Görev ID formatı.")

    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM tasks WHERE id = %s AND user_id = %s", (task_uuid, user_id))
            conn.commit()

            if cur.rowcount == 0:
                logger.warning(f"Silinecek görev bulunamadı veya kullanıcıya ait değil: {task_id}, kullanıcı: {user_id}")
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Görev bulunamadı veya size ait değil.")

            logger.info(f"Görev başarıyla silindi: {task_id}")
            return

    except psycopg2.Error as db_err:
        conn.rollback()
        logger.error(f"Veritabanı hatası (delete_task): {db_err}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev silinirken veritabanı hatası oluştu.")
    except Exception as e:
        conn.rollback()
        logger.error(f"Beklenmedik hata (delete_task): {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Görev silinirken beklenmedik bir hata oluştu.")

# ========== AI Endpointleri ==========

@api_router.post("/ai/suggestions", response_model=List[str])
def get_ai_suggestions(user_id: str = Depends(get_current_user_id)):
    logger.info(f"AI önerileri istendi: {user_id}")
    return ["Markete git", "Projeyi bitir", "E-postaları kontrol et"]

# --- Router'ı Ana Uygulamaya Dahil Etme ---
app.include_router(api_router)

# --- Uvicorn çalıştırma ---
if __name__ == "__main__":
   import uvicorn
   logger.info("Uvicorn sunucusu başlatılıyor...")
   uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)