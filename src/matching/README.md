# Matching Modülü - Dokümantasyon

Bu modül, kullanıcıların birbirleriyle eşleşme yapmasını sağlar. Coğrafi konum, tercihler ve uyumluluk skoru üzerinden çalışır.

## 🎯 Özellikler

### 1. Potansiyel Adayları Listeleme
- Coğrafi yarıçap içindeki kullanıcıları bulma
- Daha önce swipe yapılmayanları filtreleme
- Sadece onaylı (verified) kullanıcıları gösterme
- Uyumluluk skoruna göre sıralama

### 2. Swipe İşlemleri
- Like, Dislike, Superlike yapma
- Otomatik eşleşme kontrolü
- Karşılıklı like durumunda match oluşturma

### 3. Eşleşmeleri Yönetme
- Kullanıcının tüm eşleşmelerini listeleme
- Tek bir eşleşmenin detaylı bilgisini alma

---

## 📡 API Endpoint'leri

### GET `/matches/potential`
Potansiyel adayları listeler (swipe yapılacak kullanıcılar).

**Query Params:**
- `lat` (required): Enlem (örn: 41.0082)
- `lng` (required): Boylam (örn: 28.9784)
- `rad` (optional): Yarıçap (km, default: 30)

**Response:**
```json
[
  {
    "id": "user-uuid",
    "full_name": "Ahmet Yılmaz",
    "avatar_url": "https://...",
    "bio": "Merhaba ben...",
    "occupation": "Yazılım Mühendisi",
    "university": "Boğaziçi Üniversitesi",
    "match_score": 87
  }
]
```

---

### POST `/matches/swipe`
Bir kullanıcıya swipe yapar.

**Body:**
```json
{
  "swipedUserId": "user-uuid",
  "action": "like", // "like" | "dislike" | "superlike"
  "houseId": "house-uuid" // optional
}
```

**Response:**
```json
{
  "swipe": {
    "id": "swipe-uuid",
    "swiper_id": "me",
    "swiped_id": "other-user",
    "action": "like",
    "created_at": "2026-01-27T..."
  },
  "isMatch": true,
  "match": {
    "id": "match-uuid",
    "user1_id": "me",
    "user2_id": "other-user",
    "created_at": "2026-01-27T..."
  }
}
```

---

### GET `/matches`
Kullanıcının tüm eşleşmelerini listeler.

**Response:**
```json
[
  {
    "matchId": "match-uuid",
    "createdAt": "2026-01-27T...",
    "houseId": "house-uuid",
    "user": {
      "id": "user-uuid",
      "full_name": "Zeynep Kaya",
      "avatar_url": "https://...",
      "bio": "Merhaba",
      "occupation": "Öğrenci",
      "university": "İTÜ"
    }
  }
]
```

---

### GET `/matches/:matchId`
Tek bir eşleşmenin detaylı bilgisini getirir.

**Response:**
```json
{
  "matchId": "match-uuid",
  "createdAt": "2026-01-27T...",
  "houseId": "house-uuid",
  "isActive": true,
  "user": {
    "id": "user-uuid",
    "full_name": "Zeynep Kaya",
    "avatar_url": "https://...",
    "bio": "...",
    "birth_date": "2000-05-15",
    "gender": "female",
    "occupation": "Öğrenci",
    "university": "İTÜ",
    "department": "Bilgisayar Mühendisliği"
  },
  "preferences": {
    "cleanliness": "moderate",
    "smoking": "no_smoke",
    "alcohol": "social",
    "pets": "pet_friendly",
    "sleep": "flexible",
    "guests": "rarely",
    "cooking": "basic_cook",
    "communication": "balanced"
  }
}
```

---

## 🧮 Uyumluluk Algoritması

### Weighted Euclidean Distance

Algoritma, kullanıcıların tercihlerini karşılaştırarak bir uyumluluk skoru (0-100) hesaplar.

**Tercih Normalizasyonu:**
```typescript
PREFERENCE_MAP = {
  cleanliness: { relaxed: 0.2, moderate: 0.6, meticulous: 1.0 },
  smoking: { no_smoke: 1.0, balcony: 0.5, smoker: 0.0 },
  alcohol: { no_alcohol: 1.0, social: 0.5, frequent: 0.0 },
  pets: { no_pets: 1.0, pet_friendly: 0.8, have_pets: 0.5, no_tolerance: 0.0 },
  sleep: { early_bird: 1.0, flexible: 0.5, night_owl: 0.0 },
  guests: { no_guests: 1.0, rarely: 0.7, frequent: 0.2 },
  cooking: { ordering_out: 0.2, basic_cook: 0.6, master_chef: 1.0 },
  communication: { quiet: 0.2, balanced: 0.6, chatty: 1.0 }
}
```

**Kriter Ağırlıkları:**
```typescript
WEIGHTS = {
  cleanliness: 2.5,     // Düzen çok önemli
  smoking: 3.0,         // En büyük kavga sebebi
  alcohol: 1.5,
  pets: 2.0,
  sleep: 1.5,
  guests: 2.0,
  cooking: 0.5,         // Yemek yapması bonus
  communication: 1.5    // İletişim tercihi
}
```

**Formül:**
```
1. Her kriter için fark hesapla: (A - B)²
2. Ağırlık ile çarp: (A - B)² × weight
3. Tüm farkları topla ve karekök al (Euclidean Distance)
4. Normalizasyon: similarity = 1 - (distance / maxDistance)
5. Yüzdeye çevir: score = similarity × 100
```

**Örnek:**
```
UserA: { smoking: 'no_smoke' (1.0), cleanliness: 'meticulous' (1.0) }
UserB: { smoking: 'smoker' (0.0), cleanliness: 'relaxed' (0.2) }

Smoking: (1.0 - 0.0)² × 3.0 = 3.0
Cleanliness: (1.0 - 0.2)² × 2.5 = 1.6

Total = √(3.0 + 1.6) = 2.145
MaxDistance = √(1² × 3.0 + 1² × 2.5) = 2.345

Similarity = 1 - (2.145 / 2.345) = 0.085
Score = 8.5% (çok düşük uyumluluk)
```

---

## 🗄️ Database Trigger: Otomatik Eşleşme

Supabase'de `on_match_check` trigger'ı çalışır:

```sql
-- Swipes tablosuna INSERT olduğunda çalışır
-- Eğer karşı taraf da like/superlike yaptıysa otomatik match oluşturur

CREATE TRIGGER on_match_check
AFTER INSERT ON public.swipes
FOR EACH ROW
EXECUTE FUNCTION public.check_mutual_like();
```

**Trigger Fonksiyonu:**
```sql
begin
  if new.action in ('like', 'superlike') then
    if exists (
      select 1 from public.swipes 
      where swiper_id = new.swiped_id
      and swiped_id = new.swiper_id
      and action in ('like', 'superlike')
    ) then
      insert into public.matches (user1_id, user2_id)
      values (new.swiper_id, new.swiped_id);
    end if;
  end if;
  return new;
end;
```

---

## 🧪 Test Örnekleri

### 1. Potansiyel adayları listele
```bash
GET /matches/potential?lat=41.0082&lng=28.9784&rad=50
Authorization: Bearer <token>
```

### 2. Like yap
```bash
POST /matches/swipe
Authorization: Bearer <token>
Content-Type: application/json

{
  "swipedUserId": "user-uuid-123",
  "action": "like"
}
```

### 3. Superlike yap
```bash
POST /matches/swipe
Authorization: Bearer <token>
Content-Type: application/json

{
  "swipedUserId": "user-uuid-456",
  "action": "superlike",
  "houseId": "house-uuid-789"
}
```

### 4. Eşleşmeleri listele
```bash
GET /matches
Authorization: Bearer <token>
```

### 5. Eşleşme detayı
```bash
GET /matches/match-uuid-123
Authorization: Bearer <token>
```

---

## ⚠️ Hata Durumları

### 400 Bad Request
- Kendine swipe yapmaya çalışma
- Aynı kişiye tekrar swipe yapma
- Yanlış match detayı erişimi

### 401 Unauthorized
- Token eksik veya geçersiz

### 404 Not Found
- Eşleşme bulunamadı

---

## 📝 TODO (Gelecek İyileştirmeler)

- [ ] Rate limiting (spam önleme)
- [ ] Swipe geçmişini görme endpoint'i
- [ ] Match'i unmatch yapma
- [ ] Superlike kotası sistemi
- [ ] Push notification (eşleşme olduğunda)
- [ ] Match statistics endpoint'i
- [ ] Tercih ağırlıklarını kullanıcı bazlı özelleştirme

---

## 🔧 Geliştirici Notları

### Type Safety
Tüm Supabase işlemleri `Database` type'ı ile yapılıyor:
```typescript
type UserPreference = Database['public']['Tables']['user_preferences']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type Match = Database['public']['Tables']['matches']['Row'];
```

### RPC Function
`get_nearby_candidates` fonksiyonu Supabase RPC olarak çalışıyor ve PostGIS ile coğrafi sorgu yapıyor.

### Güvenlik
- Tüm endpoint'ler authentication gerektiriyor
- Kullanıcı sadece kendi match'lerine erişebiliyor
- Kendine swipe yapma engelleniyor
