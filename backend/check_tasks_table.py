import psycopg2
import os
from dotenv import load_dotenv

# .env dosyasını yükle (script'in .env ile aynı dizinde olduğunu varsayar)
load_dotenv() 

def check_tables_schema():
    DATABASE_URL = os.environ.get('DATABASE_URL')
    if not DATABASE_URL:
        print("HATA: DATABASE_URL ortam değişkeni bulunamadı.")
        return
        
    conn = None
    try:
        conn = psycopg2.connect(DATABASE_URL)
        print("Veritabanı bağlantısı başarılı.\n")
        
        with conn.cursor() as cur:
            
            # --- 1. 'tasks' Tablosunu Kontrol Et ---
            print("--- 'tasks' Tablosu Kontrol Ediliyor ---")
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks'")
            columns = [row[0] for row in cur.fetchall()]
            
            if not columns:
                print("HATA: 'tasks' tablosu bulunamadı.\n")
                return

            # 'category_id' (UUID) kontrolü yap, 'category' (VARCHAR) değil
            required_tasks_columns = [
                'id', 'user_id', 'title', 'description', 'category_id', 'tags', 
                'priority', 'status', 'completion_percentage', 'images', 
                'due_date', 'created_at', 'updated_at'
            ]
            missing_tasks_columns = [col for col in required_tasks_columns if col not in columns]
            
            if missing_tasks_columns:
                print("Eksik 'tasks' kolonları:", missing_tasks_columns)
            else:
                print("'tasks' tablosu tüm gerekli kolonlara sahip. (category_id dahil)")
            
            if 'category' in columns:
                print("UYARI: 'tasks' tablosunda eski 'category' (metin) kolonu bulundu.")
                print("Yeni 3-tablolu yapı için bu kolonun 'category_id' (UUID) olması gerekir.\n")
            else:
                print("'tasks' tablosunda eski 'category' kolonu bulunmuyor (Bu iyi bir şey).\n")


            # --- 2. 'categories' Tablosunu Kontrol Et ---
            print("--- 'categories' Tablosu Kontrol Ediliyor ---")
            cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'categories'")
            cat_columns = [row[0] for row in cur.fetchall()]

            if not cat_columns:
                print("HATA: 'categories' tablosu bulunamadı. Lütfen SQL script'i ile oluşturun.\n")
                return

            required_cat_columns = ['id', 'user_id', 'name', 'color', 'icon', 'created_at']
            missing_cat_columns = [col for col in required_cat_columns if col not in cat_columns]

            if missing_cat_columns:
                print("Eksik 'categories' kolonları:", missing_cat_columns)
            else:
                print("'categories' tablosu tüm gerekli kolonlara sahip.")
                
            print("\nKontrol tamamlandı.")

    except psycopg2.Error as e:
        print(f"Veritabanı hatası: {e}")
    finally:
        if conn:
            conn.close()
            print("Veritabanı bağlantısı kapatıldı.")

if __name__ == "__main__":
    check_tables_schema()