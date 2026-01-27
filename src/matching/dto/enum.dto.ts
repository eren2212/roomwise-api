// Buradaki değerler senin veritabanındaki ENUM'lar ile birebir aynıdır.
export const PREFERENCE_MAP = {
    // Temizlik (cleanliness)
    cleanliness: {
      relaxed: 0.2,
      moderate: 0.6,
      meticulous: 1.0,
    },
    // Sigara (smoking)
    smoking: {
      no_smoke: 1.0,
      balcony: 0.5,
      smoker: 0.0, // Sigara içmeyen biri için smoker düşük puandır
    },
    // Alkol (alcohol)
    alcohol: {
      no_alcohol: 1.0,
      social: 0.5,
      frequent: 0.0,
    },
    // Evcil Hayvan (pets)
    pets: {
      no_pets: 1.0,
      pet_friendly: 0.8,
      have_pets: 0.5,
      no_tolerance: 0.0,
    },
    // Uyku (sleep)
    sleep: {
      early_bird: 1.0,
      flexible: 0.5,
      night_owl: 0.0,
    },
    // Misafir (guest)
    guests: {
      no_guests: 1.0,
      rarely: 0.7,
      frequent: 0.2,
    },
    // Yemek (cooking)
    cooking: {
      ordering_out: 0.2,
      basic_cook: 0.6,
      master_chef: 1.0,
    },
    // İletişim (communication)
    communication: {
      quiet: 0.2,
      balanced: 0.6,
      chatty: 1.0,
    }
  };
  
  // KRİTER AĞIRLIKLARI (Hangi konu daha önemli?)
  export const WEIGHTS = {
    cleanliness: 2.5, // Düzen çok önemli
    smoking: 3.0,     // En büyük kavga sebebi
    alcohol: 1.5,
    pets: 2.0,
    sleep: 1.5,
    guests: 2.0,
    cooking: 0.5,     // Yemek yapması bonus
    communication: 1.5, // İletişim tercihi
  };