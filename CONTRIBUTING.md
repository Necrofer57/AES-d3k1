# Katkı Sağlama Rehberi (Contributing Guide)

**AES d3k1 (MedNot)** platformuna katkıda bulunmak istediğiniz için teşekkür ederiz! Tıp fakültesi öğrencilerinin sınav hazırlık sürecini kolaylaştıran bu açık kaynaklı projeye soru düzeltmeleri, yeni sınav yılları veya kod geliştirmeleri ile katkıda bulunabilirsiniz.

---

## 🧭 Katkı Yolları

Projemize katkı sağlamanın üç temel yolu vardır:
1. **Soru ve Cevap Düzeltmeleri** (Hatalı anahtar, soru metni yazım hatası veya açıklama ekleme)
2. **Yeni Sınav Yılları ve Soru Girişi** (Yeni çıkmış soruların arşive dahil edilmesi)
3. **Kod ve Tasarım İyileştirmeleri** (Yeni özellikler, performans optimizasyonları, hata onarımları)

---

## 1. 📝 Soru ve Cevap Düzeltmeleri

Bir soruda hatalı doğru seçenek, yazım yanlışı veya eksik tıbbi çözüm görüyorsanız:

1. GitHub'da **Issues** sekmesine gidin.
2. **Yeni Issue** butonuna basarak **`Soru / Cevap Düzeltme Bildirimi`** şablonunu seçin.
3. Formda şu bilgileri eksiksiz belirtin:
   - **Dönem:** (Örn. Dönem 3)
   - **Kurul:** (Örn. 1. Kurul - Neoplazi & Hemato)
   - **Sınav Yılı & Soru No:** (Örn. 2023–2024 Soru 42)
   - **Mevcut Durum:** (Sistemde gösterilen hatalı şık veya açıklama)
   - **Doğru Durum & Tıbbi Kaynak:** (Doğru şık ve referans alınan ders notu, hoca slaytı veya standart tıp kitabı: Robbins, Guyton, Harper vb.)

---

## 2. 📚 Yeni Sınav Yılı veya Soru Seti Ekleme

Yeni bir sınav yılı veya soru havuzu eklemek istiyorsanız `public/data/` altındaki ilgili veri dosyasını güncelleyebilirsiniz.

### Soru Veri Modeli Formatı:
Soru objeleri standart JavaScript objeleri olarak tanımlanır:

```javascript
{
  id: "d3-k1-2025-001",
  donem: 3,
  kurul: 1,
  yil: "2024-2025",
  ders: "Patoloji",
  hoca: "Prof. Dr. İsim Soyisim",
  soru: "Aşağıdakilerden hangisi apoptozun morfolojik bulgularından biri değildir?",
  secenekler: {
    A: "Hücre büzüşmesi",
    B: "Kromatin yoğunlaşması",
    C: "Sitoplazmik kabarcık oluşumu",
    D: "Yoğun inflamatuar hücre infiltrasyonu",
    E: "Apoptotik cisimciklerin oluşumu"
  },
  dogruCevap: "D",
  aciklama: "Apoptozda hücre membranı bütünlüğü korunduğu için etrafa hücresel içerik sızmaz ve inflamasyon gelişmez. İnflamatuar infiltrasyon nekrozun karakteristik bulgusudur.",
  tekrarSayisi: 3,
  tekrarYillari: ["2020-2021", "2022-2023", "2024-2025"]
}
```

- JSON/JS formatında sözdizimi hataları olmamasına dikkat ediniz.
- Şıkların başında `A)`, `B)` gibi harf önekleri tekrar yazılmamalı, doğrudan şık metni yazılmalıdır.

---

## 3. 💻 Kod ve Arayüz Geliştirme

Teknik bir özellik veya performans iyileştirmesi eklemek için:

### Adım 1: Depoyu Fork Edin ve Klonlayın
```bash
git clone https://github.com/<kullanici-adiniz>/AES-d3k1.git
cd AES-d3k1
```

### Adım 2: Bağımlılıkları Yükleyin
```bash
npm install
```

### Adım 3: Yeni Bir Dal (Branch) Oluşturun
Açıklayıcı ve amacını belirten bir dal adı kullanın:
```bash
git checkout -b feature/koyu-tema-iyilestirmesi
# veya
git checkout -b fix/optik-form-sayac-hatasi
```

### Adım 4: Değişiklikleri Yapın ve Test Edin
- Yerel sunucuyu başlatın: `npm run dev`
- Tip denetimini çalıştırın: `npm run lint`
- Üretim derlemesini doğrulayın: `npm run build`

### Adım 5: Değişiklikleri Commit Edin ve Gönderin
```bash
git add .
git commit -m "feat(exam): optik form sonuç karnesine detaylı filtre eklendi"
git push origin feature/koyu-tema-iyilestirmesi
```

### Adım 6: Pull Request (PR) Açın
- `main` dalına yönelik bir PR açın.
- Yaptığınız değişiklikleri, çözülen issue numarasını ve ekran görüntülerini PR açıklamasına ekleyin.

---

## 🤝 İletişim & Destek

Her türlü soru, öneri veya topluluk katkısı için:
- Proje Sahibi: **Sezgin Efe (AES)**
- E-posta: [sezgin45efe@gmail.com](mailto:sezgin45efe@gmail.com)
- Web: [www.mednot.com.tr](https://www.mednot.com.tr)
