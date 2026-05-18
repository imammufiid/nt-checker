// Bahasa Indonesia copy registry. New user-visible strings introduced in M1
// (auth + profile slice) live here. Verdict tier labels stay in their existing
// components — see VerdictCard.tsx and HistoryPage.tsx — to avoid touching the
// scan flow this pass.

export const id = {
  // Nav
  nav: {
    home: 'Beranda',
    history: 'Riwayat',
    today: 'Hari ini',
    profile: 'Profil',
    login: 'Masuk',
    signup: 'Daftar',
    logout: 'Keluar',
  },

  // Auth — shared
  auth: {
    email: 'Email',
    password: 'Kata sandi',
    name: 'Nama',
    showPassword: 'Tampilkan kata sandi',
    hidePassword: 'Sembunyikan kata sandi',
    passwordHelp: 'Minimal 8 karakter',
  },

  // Login
  login: {
    title: 'Masuk ke akunmu',
    submit: 'Masuk',
    submitting: 'Masuk…',
    noAccount: 'Belum punya akun?',
    signupCta: 'Daftar',
    errors: {
      unauthorized: 'Email atau kata sandi salah.',
      rateLimited: 'Terlalu banyak percobaan. Coba lagi 10 menit lagi.',
      network: 'Tidak bisa menghubungi server.',
      generic: 'Tidak bisa masuk sekarang. Coba lagi.',
    },
  },

  // Signup
  signup: {
    title: 'Buat akun baru',
    subtitle: 'Gratis — scan, lacak kalori dan makro harianmu.',
    submit: 'Daftar',
    submitting: 'Mendaftarkan…',
    haveAccount: 'Sudah punya akun?',
    loginCta: 'Masuk',
    errors: {
      duplicateEmail: 'Email sudah terdaftar. Coba masuk.',
      invalidEmail: 'Format email tidak valid.',
      passwordTooShort: 'Kata sandi minimal 8 karakter.',
      nameRequired: 'Nama tidak boleh kosong.',
      generic: 'Tidak bisa mendaftar sekarang. Coba lagi.',
    },
  },

  // Profile
  profile: {
    title: 'Profil kesehatan',
    subtitle: 'Bantu kami sarankan target kalori harianmu.',
    firstRunBanner: 'Lengkapi profilmu dulu.',
    submit: 'Simpan profil',
    submitting: 'Menyimpan…',
    saved: 'Profil tersimpan.',
    fields: {
      age: 'Usia',
      gender: 'Jenis kelamin',
      weight: 'Berat (kg)',
      height: 'Tinggi (cm)',
      activity: 'Tingkat aktivitas',
      conditions: 'Kondisi kesehatan',
      allergies: 'Alergi',
      goals: 'Tujuan diet',
    },
    placeholders: {
      selectGender: 'Pilih…',
    },
    activityLevels: {
      sedentary: 'Tidak aktif',
      light: 'Ringan',
      moderate: 'Sedang',
      active: 'Aktif',
      very_active: 'Sangat aktif',
    },
    genders: {
      male: 'Laki-laki',
      female: 'Perempuan',
      other: 'Lainnya',
      prefer_not_to_say: 'Tidak ingin menyebutkan',
    },
    conditions: {
      diabetes_type_1: 'Diabetes tipe 1',
      diabetes_type_2: 'Diabetes tipe 2',
      hypertension: 'Hipertensi',
      high_cholesterol: 'Kolesterol tinggi',
      heart_disease: 'Penyakit jantung',
      pcos: 'PCOS',
      gout: 'Asam urat',
      none: 'Tidak ada',
    },
    allergies: {
      gluten: 'Gluten',
      lactose: 'Laktosa',
      nuts: 'Kacang pohon',
      peanuts: 'Kacang tanah',
      soy: 'Kedelai',
      eggs: 'Telur',
      shellfish: 'Kerang/udang',
      fish: 'Ikan',
    },
    goals: {
      weight_loss: 'Turunkan berat',
      weight_gain: 'Naikkan berat',
      muscle_gain: 'Tambah massa otot',
      keto: 'Keto',
      low_sodium: 'Rendah garam',
      low_sugar: 'Rendah gula',
      vegetarian: 'Vegetarian',
      vegan: 'Vegan',
      halal: 'Halal',
      kosher: 'Kosher',
    },
  },

  // Home
  home: {
    heroTitle: 'Tahu makananmu sehat — sebelum kamu makan.',
    heroSubtitle:
      'Foto label gizi atau daftar bahan, dan kami jelaskan dengan bahasa yang mudah dipahami. Lacak kalori dan makro harianmu sekaligus.',
    signupCta: 'Daftar gratis',
    loginPrompt: 'Sudah punya akun?',
    loginCta: 'Masuk',
  },

  // Common errors
  errors: {
    generic: 'Terjadi kesalahan. Coba lagi.',
    network: 'Tidak bisa menghubungi server.',
    unauthorized: 'Sesi habis. Silakan masuk lagi.',
    rateLimited: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.',
    notFound: 'Data tidak ditemukan.',
    invalidInput: 'Data yang dikirim tidak valid.',
  },

  // Common
  common: {
    loading: 'Memuat…',
    cancel: 'Batal',
    save: 'Simpan',
  },
} as const;
