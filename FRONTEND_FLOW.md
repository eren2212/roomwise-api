# Frontend Onboarding Akışı

## Profil Oluşturma Akışı (Step by Step ama Tek Request)

### 1️⃣ Kullanıcı Giriş Yaptı

```typescript
// Login sonrası token'ı kaydet
const { data } = await authApi.login(email, password);
localStorage.setItem('token', data.access_token);
```

---

### 2️⃣ Profil Durumunu Kontrol Et

```typescript
const checkProfile = async () => {
  const response = await fetch('http://localhost:3000/profiles/me/check-completion', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const { data } = await response.json();
  
  // data = {
  //   hasProfile: false,
  //   profileComplete: false,
  //   hasPreferences: false,
  //   onboardingComplete: false,
  //   nextStep: "create_profile"
  // }
  
  if (!data.hasProfile) {
    // Onboarding'e yönlendir
    router.push('/onboarding');
  } else if (!data.onboardingComplete) {
    // Tercihlere yönlendir
    router.push('/preferences');
  } else {
    // Ana sayfaya
    router.push('/home');
  }
};
```

---

### 3️⃣ Onboarding Sayfası - State Management

```typescript
// React örneği
import { useState } from 'react';

const [currentStep, setCurrentStep] = useState(1);
const [profileData, setProfileData] = useState({
  // Step 1
  full_name: '',
  nickname: '',
  avatar_url: '',
  
  // Step 2
  birth_date: '',
  gender: '',
  
  // Step 3
  occupation_status: '',
  university: '',
  department: '',
  occupation: '',
  
  bio: ''
});

// Step'ler arası geçiş
const handleNext = () => {
  if (validateCurrentStep()) {
    setCurrentStep(currentStep + 1);
  }
};

const handleBack = () => {
  setCurrentStep(currentStep - 1);
};
```

---

### 4️⃣ Step 1: Temel Bilgiler

```jsx
{currentStep === 1 && (
  <div>
    <h2>Create Profile</h2>
    
    {/* Avatar Upload */}
    <AvatarUpload 
      onUpload={async (file) => {
        const formData = new FormData();
        formData.append('avatar', file);
        
        const response = await fetch('http://localhost:3000/profiles/me/avatar', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        
        const { data } = await response.json();
        setProfileData(prev => ({ ...prev, avatar_url: data.avatar_url }));
      }}
    />
    
    {/* Full Name */}
    <input
      value={profileData.full_name}
      onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
      placeholder="Full Name"
    />
    
    {/* Nickname (optional) */}
    <input
      value={profileData.nickname}
      onChange={(e) => setProfileData(prev => ({ ...prev, nickname: e.target.value }))}
      placeholder="Nickname (Optional)"
    />
    
    <button onClick={handleNext}>Continue</button>
  </div>
)}
```

---

### 5️⃣ Step 2: Hakkında

```jsx
{currentStep === 2 && (
  <div>
    <h2>About You</h2>
    
    {/* Age Range / Birth Date */}
    <input
      type="date"
      value={profileData.birth_date}
      onChange={(e) => setProfileData(prev => ({ ...prev, birth_date: e.target.value }))}
    />
    
    {/* Gender */}
    <div>
      <button onClick={() => setProfileData(prev => ({ ...prev, gender: 'female' }))}>
        Female
      </button>
      <button onClick={() => setProfileData(prev => ({ ...prev, gender: 'male' }))}>
        Male
      </button>
      <button onClick={() => setProfileData(prev => ({ ...prev, gender: 'non_binary' }))}>
        Non-binary
      </button>
      <button onClick={() => setProfileData(prev => ({ ...prev, gender: 'prefer_not_to_say' }))}>
        Prefer not to say
      </button>
    </div>
    
    <button onClick={handleBack}>Back</button>
    <button onClick={handleNext}>Continue</button>
  </div>
)}
```

---

### 6️⃣ Step 3: Meslek Bilgileri

```jsx
{currentStep === 3 && (
  <div>
    <h2>What do you do?</h2>
    
    {/* Occupation Status */}
    <div>
      <button onClick={() => setProfileData(prev => ({ 
        ...prev, 
        occupation_status: 'student' 
      }))}>
        Student
      </button>
      <button onClick={() => setProfileData(prev => ({ 
        ...prev, 
        occupation_status: 'professional' 
      }))}>
        Professional
      </button>
    </div>
    
    {/* Student için */}
    {profileData.occupation_status === 'student' && (
      <>
        <input
          value={profileData.university}
          onChange={(e) => setProfileData(prev => ({ ...prev, university: e.target.value }))}
          placeholder="e.g. Stanford University"
        />
        <input
          value={profileData.department}
          onChange={(e) => setProfileData(prev => ({ ...prev, department: e.target.value }))}
          placeholder="e.g. Computer Science"
        />
      </>
    )}
    
    {/* Professional için */}
    {profileData.occupation_status === 'professional' && (
      <input
        value={profileData.occupation}
        onChange={(e) => setProfileData(prev => ({ ...prev, occupation: e.target.value }))}
        placeholder="e.g. Software Engineer"
      />
    )}
    
    <button onClick={handleBack}>Back</button>
    <button onClick={handleCreateProfile}>Complete Profile</button>
  </div>
)}
```

---

### 7️⃣ Profil Oluşturma (Tek Request)

```typescript
const handleCreateProfile = async () => {
  try {
    // Sadece gerekli alanları gönder
    const requestData: any = {
      full_name: profileData.full_name,
      birth_date: profileData.birth_date,
      gender: profileData.gender,
      occupation_status: profileData.occupation_status,
    };
    
    // Opsiyonel alanlar
    if (profileData.nickname) requestData.nickname = profileData.nickname;
    if (profileData.avatar_url) requestData.avatar_url = profileData.avatar_url;
    if (profileData.bio) requestData.bio = profileData.bio;
    
    // Occupation durumuna göre
    if (profileData.occupation_status === 'student') {
      requestData.university = profileData.university;
      requestData.department = profileData.department;
    } else {
      requestData.occupation = profileData.occupation;
    }
    
    const response = await fetch('http://localhost:3000/profiles', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }
    
    const { data } = await response.json();
    console.log('Profil oluşturuldu:', data);
    
    // Tercihlere yönlendir
    router.push('/preferences');
    
  } catch (error) {
    console.error('Profil oluşturma hatası:', error);
    alert(error.message);
  }
};
```

---

### 8️⃣ Tercihler (Sorular)

```typescript
// Soruları getir
const fetchQuestions = async () => {
  const response = await fetch('http://localhost:3000/profiles/questions', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { data } = await response.json();
  setQuestions(data);
};

// Cevapları kaydet
const handleSavePreferences = async (answers) => {
  const response = await fetch('http://localhost:3000/profiles/preferences', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(answers)
  });
  
  const { data } = await response.json();
  
  // Onboarding'i tamamla
  await fetch('http://localhost:3000/profiles/me/complete-onboarding', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  // Ana sayfaya yönlendir
  router.push('/home');
};
```

---

## ✅ Avantajları

1. **Atomik İşlem**: Kullanıcı tüm adımları tamamlamadan profil oluşturulmaz
2. **Performans**: 3 request yerine 1 request
3. **Veri Tutarlılığı**: Yarım profiller kalma riski yok
4. **UX**: Kullanıcı istediği zaman geri gidip düzenleyebilir, kayıt olmaz
5. **Validation**: Backend'de tüm validasyonlar tek seferde yapılır

---

## ⚠️ Önemli Notlar

1. **Avatar Upload**: Profil oluşturmadan ÖNCE yapılmalı, URL alınmalı
2. **Validation**: Her step'te client-side validation yap
3. **Error Handling**: Backend'den gelen hataları kullanıcıya göster
4. **Loading States**: API istekleri sırasında loading göster
5. **State Persistence**: Kullanıcı sayfayı yenilerse state'i kaybet (localStorage kullanma, çünkü profil oluşturulmadı)
