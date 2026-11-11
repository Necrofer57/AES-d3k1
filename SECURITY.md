# Güvenlik Politikası (Security Policy)

AES d3k1 (MedNot) platformu, tıp fakültesi öğrencilerinin çalışma verilerini, deneme sınavı sonuçlarını ve soru havuzu etkileşimlerini güvenli bir altyapıda barındırmayı taahhüt eder.

---

## 🛡️ Desteklenen Sürümler

Aşağıdaki tabloda aktif olarak güvenlik güncellemeleri ve yama desteği alan sürümler listelenmiştir:

| Sürüm | Destek Durumu |
| :--- | :---: |
| `1.2.x` (Güncel) | ✅ Tam Destekleniyor |
| `1.1.x` | ⚠️ Yalnızca Kritik Yamalar |
| `< 1.1.0` | ❌ Desteklenmiyor |

---

## 🔒 Güvenlik Mimarisi & Veri Koruma

Platformun güvenliği çok katmanlı modern bulut standartları üzerine kurulmuştur:

1. **Firebase Authentication & Kimlik Doğrulama:**
   - Kullanıcı kimlik doğrulama işlemleri Google Firebase Auth altyapısı üzerinden yürütülür.
   - Parolalar istemci tarafında tutulmaz, şifreli oturum belirteçleri (JWT) kullanılır.

2. **Firestore Granüler Erişim Kontrolü (`firestore.rules`):**
   - Her kullanıcı yalnızca kendi `/users/{userId}` belgesine ve kendi alt koleksiyonlarına (`/bookmarks`, `/examResults`) okuma/yazma erişimine sahiptir.
   - Doğrulanmış şema kontrolü (`isValidUserProfile`, `isValidUserBookmark`, `isValidUserExamResult`) ile veri tipi ve boyut sınırları katı biçimde zorunlu kılınır.
   - Yönetici yetkileri yalnızca yetkilendirilmiş ve e-posta onayı doğrulanmış yönetici hesabına (`sezgin45efe@gmail.com`) verilir.

3. **HTTP Güvenlik Başlıkları (`vercel.json`):**
   - `Content-Security-Policy` & `X-Content-Type-Options: nosniff` ile MIME türü suiistimalleri önlenir.
   - `X-Frame-Options: SAMEORIGIN` ile Clickjacking saldırıları engellenir.
   - `Strict-Transport-Security (HSTS)` zorunlu HTTPS şifrelemesi sağlar.
   - `Referrer-Policy: strict-origin-when-cross-origin` ve `Permissions-Policy` ile mikrofon/kamera/konum erişimi varsayılan olarak kısıtlanır.

4. **Statik Veri Bütünlüğü:**
   - Soru bankası dosyaları (`public/data/*.js`) salt okunur statik içerik olarak servis edilir ve CDN üzerinde güvenli önbellekleme ilkeleriyle korunur.

---

## 🚨 Güvenlik Açığı Bildirimi (Reporting a Vulnerability)

AES d3k1 üzerinde bir güvenlik açığı, veri sızıntısı veya yetkilendirme kusuru tespit ederseniz lütfen **herkese açık bir GitHub Issue açmak yerine** doğrudan proje yöneticisiyle iletişime geçiniz:

- 📧 **E-posta:** [sezgin45efe@gmail.com](mailto:sezgin45efe@gmail.com)
- 📌 **Konu Başlığı:** `[GÜVENLİK BİLDİRİMİ] AES d3k1 - <Açık Özeti>`

### Lütfen Bildiriminize Şunları Ekleyiniz:
- Güvenlik açığının türü ve olası etkisi
- Açığı yeniden oluşturma adımları (Proof of Concept - PoC)
- İlgili URL'ler, istek başlıkları veya kod blokları
- Varsa önerdiğiniz geçici çözüm veya düzeltme yöntemi

Bildiriminiz incelendikten sonra en geç **48 saat içinde** tarafınıza geri dönüş sağlanacak ve doğrulanan açıklar için en kısa sürede düzeltme sürümü yayınlanacaktır.
