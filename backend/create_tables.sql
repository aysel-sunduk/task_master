-- PostgreSQL tablolarını oluşturmak için SQL scripti
-- GÜNCELLENMİŞ VERSİYON - categories tablosu eklendi ve tasks tablosu düzeltildi

-- Users tablosu
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100),
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Categories tablosu (YENİ EKLENDİ)
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#808080',
    icon VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name) -- Aynı kullanıcı için aynı isimde kategori olamaz
);

-- Tasks tablosu (GÜNCELLENMİŞ - category_id kullanıyor)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL, -- category_id olarak değiştirildi
    tags JSONB DEFAULT '[]',
    priority VARCHAR(20) DEFAULT 'Orta',
    status VARCHAR(20) DEFAULT 'Yapılacak',
    completion_percentage INT DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
    images JSONB DEFAULT '[]',
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Eğer eski 'category' (VARCHAR) kolonu varsa, migration için:
-- ALTER TABLE tasks DROP COLUMN IF EXISTS category;
-- ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- İndeksler (performans için)
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category_id ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
