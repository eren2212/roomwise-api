# Profile API Documentation

## Endpoints

Tüm endpoint'ler `Authorization: Bearer <token>` header'ı gerektirir.

### 1. Profil Oluşturma (Tüm Bilgiler Tek Request)
**POST** `/profiles`

**ÖNEMLİ:** Frontend'de kullanıcı tüm adımları (Step 1-2-3) doldurduktan sonra, tek seferde bu endpoint'e istek gönderilir. Böylece yarım profiller oluşmaz.

**Öğrenci için:**
```json
{
  "full_name": "Eren Yılmaz",
  "nickname": "eren",
  "birth_date": "2000-01-15",
  "gender": "male",
  "occupation_status": "student",
  "university": "Stanford University",
  "department": "Computer Science",
  "avatar_url": "https://...",
  "bio": "Hakkımda bilgi"
}
```

**Profesyonel için:**
```json
{
  "full_name": "Ahmet Demir",
  "birth_date": "1995-05-20",
  "gender": "male",
  "occupation_status": "professional",
  "occupation": "Software Engineer",
  "avatar_url": "https://...",
  "bio": "Hakkımda bilgi"
}
```

**Zorunlu alanlar:**
- `full_name` (string)
- `birth_date` (ISO 8601 date)
- `gender` (enum: male, female, non_binary, prefer_not_to_say)
- `occupation_status` (enum: student, professional)
- Eğer `student` ise: `university` ve `department`
- Eğer `professional` ise: `occupation`

**Opsiyonel alanlar:**
- `nickname` (string)
- `avatar_url` (string)
- `bio` (string)

**Response:**
```json
{
  "success": true,
  "message": "Profil başarıyla oluşturuldu",
  "data": {
    "id": "uuid",
    "full_name": "Eren Yılmaz",
    "avatar_url": null,
    ...
  }
}
```

---

### 2. Kendi Profilini Getir
**GET** `/profiles/me`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "full_name": "Eren Yılmaz",
    "email": "eren@example.com",
    ...
  }
}
```

---

### 3. Profil Güncelle (Genel)
**PATCH** `/profiles/me`

```json
{
  "full_name": "Yeni İsim", // opsiyonel
  "nickname": "yeni_nick", // opsiyonel
  "bio": "Hakkımda bilgi" // opsiyonel
}
```

---

### 4. Hakkında Bilgilerini Güncelle (Profil oluşturulduktan sonra)
**PATCH** `/profiles/me/about`

**Not:** Bu endpoint profil OLUŞTURULDUKTAN SONRA kullanıcı bilgilerini güncellemek için kullanılır.

```json
{
  "birth_date": "2000-01-01", // opsiyonel
  "gender": "male" // opsiyonel
}
```

---

### 5. Meslek Bilgilerini Güncelle (Profil oluşturulduktan sonra)
**PATCH** `/profiles/me/occupation`

**Not:** Bu endpoint profil OLUŞTURULDUKTAN SONRA kullanıcı bilgilerini güncellemek için kullanılır.

**Öğrenci için:**
```json
{
  "occupation_status": "student",
  "university": "Stanford University",
  "department": "Computer Science"
}
```

**Profesyonel için:**
```json
{
  "occupation_status": "professional",
  "occupation": "Software Engineer"
}
```

---

### 6. Avatar Yükleme
**POST** `/profiles/me/avatar`

**Content-Type:** `multipart/form-data`

Form field: `avatar` (file)

**Özellikler:**
- Desteklenen formatlar: JPEG, PNG, WebP
- Max boyut: 5MB
- Otomatik olarak Supabase Storage'a yüklenir
- Profil otomatik olarak güncellenir

**Response:**
```json
{
  "success": true,
  "message": "Avatar başarıyla yüklendi",
  "data": {
    "avatar_url": "https://..."
  }
}
```

---

### 7. Onboarding Tamamla
**POST** `/profiles/me/complete-onboarding`

**Response:**
```json
{
  "success": true,
  "message": "Onboarding tamamlandı",
  "data": {
    "has_seen_onboarding": true,
    ...
  }
}
```

---

### 8. Profil Tamamlanma Kontrolü
**GET** `/profiles/me/check-completion`

**Response:**
```json
{
  "success": true,
  "data": {
    "hasProfile": true,
    "profileComplete": true,
    "hasPreferences": false,
    "onboardingComplete": false,
    "nextStep": "preferences" // null | create_profile | about_you | occupation | preferences | complete_onboarding
  }
}
```

---

### 9. Tercihleri Getir
**GET** `/profiles/preferences`

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "smoking": "no_smoke",
    "alcohol": "social",
    "pets": "have_pets",
    ...
  }
}
```

---

### 10. Tercihleri Güncelle/Oluştur
**PUT** `/profiles/preferences`

```json
{
  "smoking": "no_smoke", // no_smoke, balcony, smoker
  "alcohol": "social", // no_alcohol, social, frequent
  "pets": "have_pets", // no_pets, have_pets, pet_friendly, no_tolerance
  "sleep": "night_owl", // early_bird, night_owl, flexible
  "guests": "rarely", // no_guests, rarely, frequent
  "cleanliness": "moderate", // relaxed, moderate, meticulous
  "communication": "balanced", // quiet, chatty, balanced
  "cooking": "basic_cook" // ordering_out, basic_cook, master_chef
}
```

---

### 11. Soru Kataloğunu Getir
**GET** `/profiles/questions`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "category": "lifestyle",
      "question_text": "Sigara kullanıyor musun?",
      "icon_name": "smoking",
      "target_column": "smoking",
      "options": [
        {"label": "Kullanmıyorum", "value": "no_smoke"},
        {"label": "Balkonda", "value": "balcony"},
        {"label": "Kullanıyorum", "value": "smoker"}
      ]
    },
    ...
  ]
}
```

---

## Kullanım Akışı

### İlk Kayıt Sonrası Onboarding Akışı (YENİ):

1. **Kullanıcı giriş yapar** → Auth token alır

2. **Profil varlık kontrolü**
   ```
   GET /profiles/me/check-completion
   ```
   Response'a göre kullanıcıyı yönlendir.

3. **Frontend'de kullanıcı adımları doldurur (State'te tut)**
   - Step 1: Full name, nickname (opsiyonel)
   - Step 2: Birth date, gender
   - Step 3: Occupation status, university/department veya occupation
   
   **ÖNEMLİ:** Avatar yüklemek istiyorsa önce upload et:
   ```
   POST /profiles/me/avatar
   Body: FormData with avatar file
   Response: { avatar_url: "https://..." }
   ```

4. **Kullanıcı "Tamamla" butonuna bastığında TEK REQUEST İLE profil oluştur**
   ```
   POST /profiles
   Body: {
     full_name,
     nickname?,
     birth_date,
     gender,
     occupation_status,
     university?, department?, occupation?,
     avatar_url?, // Avatar upload'tan gelen URL
     bio?
   }
   ```

5. **Soruları Getir ve Tercihleri Kaydet**
   ```
   GET /profiles/questions  // Soruları göster
   
   PUT /profiles/preferences  // Cevapları kaydet
   Body: { smoking, alcohol, pets, ... }
   ```

6. **Onboarding Tamamla**
   ```
   POST /profiles/me/complete-onboarding
   ```

### Sonraki Girişler:

1. **Kontrol Et**
   ```
   GET /profiles/me/check-completion
   ```

2. **nextStep !== null ise:**
   - Kullanıcıyı ilgili adıma yönlendir
   - Yarım kalan profili tamamlat

3. **nextStep === null ise:**
   - Ana uygulamaya yönlendir
   - Profil tamamlanmış ✅

---

## Enum Değerleri

### Gender
- `male`
- `female`
- `non_binary`
- `prefer_not_to_say`

### OccupationStatus
- `student`
- `professional`

### Smoking
- `no_smoke`
- `balcony`
- `smoker`

### Alcohol
- `no_alcohol`
- `social`
- `frequent`

### Pets
- `no_pets`
- `have_pets`
- `pet_friendly`
- `no_tolerance`

### Sleep
- `early_bird`
- `night_owl`
- `flexible`

### Guest
- `no_guests`
- `rarely`
- `frequent`

### Cleanliness
- `relaxed`
- `moderate`
- `meticulous`

### Communication
- `quiet`
- `chatty`
- `balanced`

### Cooking
- `ordering_out`
- `basic_cook`
- `master_chef`

---

## Hata Kodları

- **400 Bad Request**: Geçersiz veri, eksik alan
- **401 Unauthorized**: Token geçersiz veya yok
- **404 Not Found**: Profil bulunamadı
- **409 Conflict**: Profil zaten mevcut
