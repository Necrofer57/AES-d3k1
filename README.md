<div align="center">

# 🩺 AES d3k1 (MedNot)
### Tıp Fakültesi Çıkmış Sorular & Sınav Platformu (2018–2026)

Tıp fakültesi öğrencilerinin komite ve kurul sınavlarına en yüksek verimle hazırlanması için geliştirilmiş; **12.016 çıkmış soru**, akıllı tıbbi hata analizi, süreli optik deneme sınavı ve bulut senkronizasyonu sunan yeni nesil tıp eğitimi platformu.

---

[![Canlı Platform](https://img.shields.io/badge/Canl%C4%B1%20Platform-mednot.com.tr-0284c7?style=for-the-badge&logo=google-chrome&logoColor=white)](https://www.mednot.com.tr)
[![Vercel Dağıtımı](https://img.shields.io/badge/Vercel-d3--aes.vercel.app-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://d3-aes.vercel.app)
[![Soru Havuzu](https://img.shields.io/badge/Soru%20Havuzu-12.016%20Soru%20(18%20Kurul)-10b981?style=for-the-badge)](#-kurul-ve-soru-dağılımı)
[![Kapsam](https://img.shields.io/badge/Kapsam-D%C3%B6nem%201%20%E2%80%A2%202%20%E2%80%A2%203%20(2018--2026)-6366f1?style=for-the-badge)](#-kurul-ve-soru-dağılımı)
[![Altyapı](https://img.shields.io/badge/Altyap%C4%B1-Vite%20%7C%20TypeScript%20%7C%20Tailwind%20%7C%20Firebase-f59e0b?style=for-the-badge&logo=firebase&logoColor=white)](#-mimari--güvenlik-yapısı)
[![Lisans](https://img.shields.io/badge/Lisans-MIT-3b82f6?style=for-the-badge)](LICENSE)

</div>

---

## 🌟 Öne Çıkan Özellikler

- 📚 **12.016 Soruluk Kapsamlı Arşiv:** Dönem 1 (5 Kurul), Dönem 2 (6 Kurul) ve Dönem 3 (7 Kurul) olmak üzere 18 kurulun 2018–2026 yılları arasındaki tüm çıkmış, amfi hatırlanan, kurul pratik ve çalışma soruları.
- 🩺 **Akıllı Hata Analizi & Tıbbi Çözüm Motoru:** Yanlış işaretlenen sorularda seçilen şıkkın neden yanlış olduğunu anında açıklar; olumsuz soru kökü analizi, Romen rakamlı öncül karşılaştırması ve yaygın çeldirici ayrımı yapar. Doğru seçeneğin tıbbi patofizyolojisini ve A–E tüm şıkların ayrıntılı gerekçesini sunar.
- ⏱️ **Süreli Deneme Sınavı & Optik Form:** Gerçek kurul sınavı koşullarını simüle eden geri sayım sayacı, dinamik soru kodlama optik formu, sayfa yenilemelerine dayanıklı oturum koruma ve sınav bitiminde detaylı "Yanlış ve Boş Soruları İncele" başarı karnesi.
- 🔁 **Yıllar Arası Tekrar Çıkmış Soru Takibi:** Bir sorunun geçmiş yıllarda ve diğer kurullarda kaç kez tekrarlandığını gösteren rozetler ve tek tıkla sorunun sorulduğu ilgili sınav yıllarına geçiş imkânı.
- ☁️ **Firebase Bulut Senkronizasyonu & Çalışma Süresi Takibi:** Çözülen sorular, işaretlenen favoriler, deneme sınavı puan geçmişi ve aktif ders çalışma süresinin (`studySeconds`) masaüstü, tablet ve mobil cihazlar arasında anlık senkronizasyonu.
- 🔍 **Gelişmiş Çok Boyutlu Filtreleme:** Sınav Yılı, Anabilim Dalı / Ders (Patoloji, Farmakoloji, Anatomi, vb.), Öğretim Üyesi (Hoca), Çıkmış Tekrar Sayısı, Soru Durumu (Çözülmemiş, Doğru, Yanlış, Favori) ve serbest metin araması.

---

## 📊 Kurul ve Soru Dağılımı

Platformda yer alan 18 kurulun güncel ve doğrulanmış soru sayıları aşağıda listelenmiştir:

| Dönem | Kurul Kodu | Kurul / Sınav Adı | Soru Sayısı | Veri Dosyası |
| :---: | :---: | :--- | :---: | :--- |
| **Dönem 1** | `d1-1` | 1. Kurul (Tıbba Giriş & Hücre) | **569** | `public/data/d1-1.js` |
| **Dönem 1** | `d1-2` | 2. Kurul (Metabolizma) | **554** | `public/data/d1-2.js` |
| **Dönem 1** | `d1-3` | 3. Kurul (Genetik & Mikro) | **686** | `public/data/d1-3.js` |
| **Dönem 1** | `d1-4` | 4. Kurul (Doku & Kas-İskelet) | **644** | `public/data/d1-4.js` |
| **Dönem 1** | `d1-5` | Final & Bütünleme Sınavları | **901** | `public/data/d1-5.js` |
| 🔹 **Dönem 1 Alt Toplam** | **5 Kurul** | *1. Sınıf Genel Havuzu* | **3.354 Soru** | |
| :---: | :---: | :--- | :---: | :--- |
| **Dönem 2** | `d2-1` | 1. Kurul (Kas & Periferik Sinir) | **538** | `public/data/d2-1.js` |
| **Dönem 2** | `d2-2` | 2. Kurul (Nöro & Duyu) | **572** | `public/data/d2-2.js` |
| **Dönem 2** | `d2-3` | 3. Kurul (Dolaşım & Solunum) | **620** | `public/data/d2-3.js` |
| **Dönem 2** | `d2-4` | 4. Kurul (Endokrin & Ürogenital) | **596** | `public/data/d2-4.js` |
| **Dönem 2** | `d2-5` | 5. Kurul (Sindirim / GİS) | **486** | `public/data/d2-5.js` |
| **Dönem 2** | `d2-6` | Final & Bütünleme Sınavları | **1.182** | `public/data/d2-6.js` |
| 🔹 **Dönem 2 Alt Toplam** | **6 Kurul** | *2. Sınıf Genel Havuzu* | **3.994 Soru** | |
| :---: | :---: | :--- | :---: | :--- |
| **Dönem 3** | `kurul-1` | 1. Kurul (Neoplazi & Hemato) | **692** | `public/data/kurul-1.js` |
| **Dönem 3** | `kurul-2` | 2. Kurul (Enfeksiyon) | **577** | `public/data/kurul-2.js` |
| **Dönem 3** | `kurul-3` | 3. Kurul (Dolaşım & Solunum) | **580** | `public/data/kurul-3.js` |
| **Dönem 3** | `kurul-4` | 4. Kurul (Gastrointestinal) | **682** | `public/data/kurul-4.js` |
| **Dönem 3** | `kurul-5` | 5. Kurul (Endokrin & Ürogenital) | **687** | `public/data/kurul-5.js` |
| **Dönem 3** | `kurul-6` | 6. Kurul (Sinir & Psikiyatri) | **690** | `public/data/kurul-6.js` |
| **Dönem 3** | `kurul-7` | 7. Kurul (Kas-İskelet & Halk Sağlığı) | **760** | `public/data/kurul-7.js` |
| 🔹 **Dönem 3 Alt Toplam** | **7 Kurul** | *3. Sınıf Genel Havuzu* | **4.668 Soru** | |
| :---: | :---: | :--- | :---: | :--- |
| 🏆 **GENEL TOPLAM** | **18 Kurul** | **Dönem 1, 2 ve 3 Tüm Çıkmış Sorular (2018–2026)** | **12.016 Soru** | `public/data/*.js` |

---

## ⌨️ Klavye Kısayolları

Soru çözüm hızını artırmak için masaüstü tarayıcılarda tam klavye kontrolü desteklenir:

| Kısayol Tuşu | İşlem | Açıklama |
| :---: | :--- | :--- |
| <kbd>A</kbd> – <kbd>E</kbd> / <kbd>1</kbd> – <kbd>5</kbd> | **Şık Seçimi** | İlgili seçeneği doğrudan işaretler (A=1, B=2, C=3, D=4, E=5). |
| <kbd>←</kbd> / <kbd>→</kbd> | **Önceki / Sonraki Soru** | Soru listesinde ileri/geri hızlı gezinme sağlar. |
| <kbd>F</kbd> | **Favorilere Ekle / Çıkar** | Aktif soruyu favorilere ekler veya favorilerden çıkarır. |
| <kbd>G</kbd> | **Cevap & Çözümü Göster / Gizle** | Doğru cevabı ve akıllı tıbbi hata analizini gösterir / gizler. |
| <kbd>R</kbd> | **Rastgele Soru** | Filtrelenmiş soru kümesinden rastgele bir soru seçer. |
| <kbd>Esc</kbd> | **Pencereleri Kapat** | Açık modal diyalogları, optik formu veya menüleri kapatır. |

---

## 🏗️ Mimari & Güvenlik Yapısı

Proje; modern, hızlı ve yüksek performanslı bir SPA mimarisi üzerine inşa edilmiştir:

```
AES-d3k1/
├── index.html                   # Ana uygulama kabuğu, UI bileşenleri ve stil tanımları
├── src/
│   ├── auth-ui.ts               # Kimlik doğrulama, çalışma süresi takibi, kullanıcı profili
│   ├── firebase.ts              # Firebase istemci yapılandırması ve servis bağlayıcıları
│   ├── main.tsx                 # İstemci başlangıç giriş noktası
│   └── App.tsx                  # Ana uygulama bileşeni
├── public/
│   └── data/                    # 18 kurula ait 12.016 soruluk optimize statik veri setleri
│       ├── d1-1.js .. d1-5.js   # Dönem 1 veri havuzu (3.354 soru)
│       ├── d2-1.js .. d2-6.js   # Dönem 2 veri havuzu (3.994 soru)
│       └── kurul-1.js .. 7.js   # Dönem 3 veri havuzu (4.668 soru)
├── firestore.rules              # Granüler Firestore güvenlik ve erişim doğrulama kuralları
├── vercel.json                  # CDN önbellekleme ilkeleri, SPA yönlendirmeleri ve güvenlik başlıkları
├── package.json                 # Bağımlılıklar, betikler ve proje meta verileri
└── vite.config.ts               # Vite derleyici ve Tailwind CSS eklenti yapılandırması
```

### 🔒 Firestore Güvenlik Kuralları
- **Kullanıcı Veri İzolasyonu:** Her kullanıcı yalnızca kendi `users/{userId}` belgesi ve alt koleksiyonları (`/bookmarks`, `/examResults`) üzerinde yetkilidir.
- **Katı Şema Doğrulaması:** `isValidUserProfile`, `isValidUserBookmark` ve `isValidUserExamResult` fonksiyonları ile yazılan verilerin türü, boyutu ve anahtarları sunucu tarafında zorunlu tutulur.
- **Yönetici Denetimi:** Lider tablosu ve platform istatistikleri yalnızca e-posta doğrulaması tamamlanmış yönetici hesabı (`sezgin45efe@gmail.com`) tarafından incelenebilir.

---

## 💻 Kurulum ve Geliştirme (Local Development)

Projeyi yerel makinenizde çalıştırmak ve geliştirmek için aşağıdaki adımları izleyin:

### Ön Gereksinimler
- **Node.js** (v18.0.0 veya üzeri önerilir)
- **npm**, **pnpm** veya **bun** paket yöneticisi

### 1. Depoyu Klonlayın
```bash
git clone https://github.com/Necrofer57/AES-d3k1.git
cd AES-d3k1
```

### 2. Bağımlılıkları Yükleyin
```bash
npm install
```

### 3. Çevresel Değişkenleri Yapılandırın
Kök dizinde `.env` dosyası oluşturarak Firebase bilgilerinizi ekleyin (`.env.example` dosyasını referans alabilirsiniz):
```env
VITE_FIREBASE_PROJECT_ID="proje-id-niz"
VITE_FIREBASE_APP_ID="uygulama-id-niz"
VITE_FIREBASE_API_KEY="api-anahtariniz"
VITE_FIREBASE_AUTH_DOMAIN="proje.firebaseapp.com"
VITE_FIREBASE_FIRESTORE_DATABASE_ID="(default)"
VITE_FIREBASE_STORAGE_BUCKET="proje.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="sender-id"
```

### 4. Geliştirme Sunucusunu Başlatın
```bash
npm run dev
```
Tarayıcınızda `http://localhost:3000` adresini açarak uygulamayı test edebilirsiniz.

### 5. Üretim Derlemesi (Build)
```bash
npm run build
```
Derlenen dosyalar `dist/` dizinine çıkarılır ve Vercel / Netlify / Cloudflare Pages gibi statik barındırma platformlarına doğrudan yüklenebilir.

---

## 👨‍💻 Geliştirici & İletişim

Bu platform tıp fakültesi öğrencilerinin eğitim kalitesini ve kurul başarılarını artırmak amacıyla **AES (Sezgin Efe)** tarafından geliştirilmiştir.

- 👤 **Geliştirici:** Sezgin Efe (AES - MedNot)
- 🌐 **Web Sitesi:** [www.mednot.com.tr](https://www.mednot.com.tr)
- 🔗 **Canlı Dağıtım:** [d3-aes.vercel.app](https://d3-aes.vercel.app)
- 📧 **İletişim & Geri Bildirim:** [sezgin45efe@gmail.com](mailto:sezgin45efe@gmail.com)
- 🐙 **GitHub:** [@Necrofer57](https://github.com/Necrofer57)

---

## 📄 Lisans

Bu proje [MIT Lisansı](LICENSE) kapsamında açık kaynak olarak sunulmaktadır.
