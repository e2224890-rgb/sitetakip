// Hata metinlerini Türkçeleştirir.
//
// Supabase (GoTrue + PostgREST) hataları İngilizce döner: "Invalid login
// credentials", "permission denied for table kisi", "duplicate key value
// violates unique constraint" gibi. Bunlar doğrudan kullanıcıya gösteriliyordu.
// Buradaki hataMetni() tek giriş noktasıdır; ekranlar ham .message yerine bunu
// kullanır.
//
// Kural: kendi attığımız Türkçe hatalar olduğu gibi geçer (Türkçe karakter
// içeriyorsa dokunulmaz). Tanınmayan İngilizce hatalar genel bir mesaja
// düşer ve ayrıntı console'a yazılır — kullanıcıya teknik metin gösterilmez.

const KOD = {
  /* ---- Supabase Auth (GoTrue) ---- */
  invalid_credentials: "E-posta veya şifre hatalı.",
  email_not_confirmed: "E-posta adresiniz henüz doğrulanmamış.",
  user_already_exists: "Bu e-posta adresi zaten kayıtlı.",
  email_exists: "Bu e-posta adresi zaten kayıtlı.",
  phone_exists: "Bu telefon numarası zaten kayıtlı.",
  weak_password: "Şifre çok zayıf. En az 6 karakterli, tahmin edilmesi zor bir şifre seçin.",
  same_password: "Yeni şifre eskisiyle aynı olamaz.",
  email_address_invalid: "E-posta adresi geçersiz.",
  validation_failed: "Girilen bilgiler geçersiz.",
  signup_disabled: "Yeni kayıt alımı kapalı.",
  user_not_found: "Kullanıcı bulunamadı.",
  user_banned: "Bu hesap askıya alınmış.",
  session_not_found: "Oturumunuz sona erdi. Lütfen tekrar giriş yapın.",
  session_expired: "Oturumunuz sona erdi. Lütfen tekrar giriş yapın.",
  bad_jwt: "Oturumunuz geçersiz. Lütfen tekrar giriş yapın.",
  no_authorization: "Oturum bulunamadı. Lütfen tekrar giriş yapın.",
  otp_expired: "Kod süresi dolmuş. Yeni kod isteyin.",
  over_request_rate_limit: "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.",
  over_email_send_rate_limit: "Çok fazla e-posta gönderildi. Biraz bekleyip tekrar deneyin.",
  captcha_failed: "Güvenlik doğrulaması başarısız.",

  /* ---- PostgreSQL (SQLSTATE) ---- */
  "42501": "Bu işlem için yetkiniz yok.",
  "23505": "Bu kayıt zaten mevcut.",
  "23503": "Bağlı kayıtlar olduğu için bu işlem yapılamıyor.",
  "23502": "Zorunlu bir alan boş bırakılmış.",
  "23514": "Girilen değer kurallara uymuyor.",
  "22P02": "Geçersiz bir değer girildi.",
  "22001": "Girilen metin izin verilenden uzun.",
  "42P01": "Veritabanı tablosu bulunamadı. (Kurulum SQL'i eksik olabilir.)",
  "42703": "Veritabanı sütunu bulunamadı. (Kurulum SQL'i eksik olabilir.)",
  "57014": "İşlem zaman aşımına uğradı. Daha dar bir filtreyle tekrar deneyin.",
  "40001": "Yoğunluk nedeniyle işlem tamamlanamadı. Tekrar deneyin.",
  "40P01": "Kayıtlar başka bir işlem tarafından kilitlenmiş. Tekrar deneyin.",
  "53300": "Veritabanı bağlantı sınırına ulaşıldı. Biraz sonra tekrar deneyin.",

  /* ---- PostgREST ---- */
  PGRST116: "Kayıt bulunamadı.",
  PGRST301: "Oturumunuz sona erdi. Lütfen tekrar giriş yapın.",
  PGRST202: "İstenen veritabanı işlevi bulunamadı.",
  PGRST204: "Gönderilen alanlardan biri tabloda yok.",
};

// Kod yoksa metinden yakala. Sıra önemli: özel olan önce.
const DESEN = [
  [/invalid login credentials/i, "E-posta veya şifre hatalı."],
  [/email not confirmed/i, "E-posta adresiniz henüz doğrulanmamış."],
  [/(already registered|already been registered|user already exists)/i, "Bu e-posta adresi zaten kayıtlı."],
  [/new password should be different/i, "Yeni şifre eskisiyle aynı olamaz."],
  [/password should be at least (\d+)/i, (m) => `Şifre en az ${m[1]} karakter olmalı.`],
  [/for security purposes.*?(\d+) seconds/i, (m) => `Güvenlik nedeniyle ${m[1]} saniye sonra tekrar deneyebilirsiniz.`],
  [/(rate limit|too many requests)/i, "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin."],
  [/signups? (not allowed|is disabled)/i, "Yeni kayıt alımı kapalı."],
  [/unable to validate email address|invalid format/i, "E-posta adresi geçersiz."],
  [/is invalid$/i, "Girilen değer geçersiz."],
  [/(jwt expired|token has expired|invalid jwt|invalid claim)/i, "Oturumunuz sona erdi. Lütfen tekrar giriş yapın."],
  [/auth session missing/i, "Oturum bulunamadı. Lütfen tekrar giriş yapın."],
  [/user not found/i, "Kullanıcı bulunamadı."],
  [/permission denied for (?:table|relation|view|schema|sequence) "?([\w.]+)"?/i,
    (m) => `Bu veriye erişim yetkiniz yok. (${m[1]})`],
  [/permission denied/i, "Bu işlem için yetkiniz yok."],
  [/(violates row-level security|row-level security policy)/i, "Bu kaydı görme veya değiştirme yetkiniz yok."],
  [/duplicate key value/i, "Bu kayıt zaten mevcut."],
  [/violates foreign key constraint/i, "Bağlı kayıtlar olduğu için bu işlem yapılamıyor."],
  [/violates not-null constraint/i, "Zorunlu bir alan boş bırakılmış."],
  [/violates check constraint/i, "Girilen değer kurallara uymuyor."],
  [/(failed to fetch|network ?error|networkrequestfailed|fetch failed)/i,
    "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin."],
  [/(timeout|timed out|canceling statement)/i, "İşlem zaman aşımına uğradı. Daha dar bir filtreyle tekrar deneyin."],
  [/(json object requested|multiple \(or no\) rows returned)/i, "Kayıt bulunamadı."],
  [/could not find the .* column/i, "Gönderilen alanlardan biri tabloda yok."],
  [/(load failed|service unavailable|502|503)/i, "Sunucuya şu an ulaşılamıyor. Birazdan tekrar deneyin."],
];

const TURKCE_HARF = /[çğıöşüÇĞİÖŞÜ]/;

/**
 * Herhangi bir hatayı Türkçe, kullanıcıya gösterilebilir tek cümleye çevirir.
 * @param {unknown} hata  Supabase error nesnesi, Error, string veya null
 * @param {string} varsayilan  Tanınmayan hatalarda gösterilecek metin
 */
export function hataMetni(hata, varsayilan = "Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.") {
  if (!hata) return varsayilan;

  const metin = typeof hata === "string" ? hata : String(hata?.message || hata?.error_description || hata?.msg || "");
  // GoTrue bazen code'a HTTP durumunu (400) koyup asıl kodu error_code'a yazar;
  // supabase-js ise code alanını kullanır. İkisine de bakılır.
  const kodlar = [hata?.error_code, hata?.code].map((k) => String(k ?? "")).filter(Boolean);

  // Kendi Türkçe mesajlarımız aynen geçsin
  if (metin && TURKCE_HARF.test(metin)) return metin;

  for (const k of kodlar) if (KOD[k]) return KOD[k];

  for (const [desen, karsilik] of DESEN) {
    const m = metin.match(desen);
    if (m) return typeof karsilik === "function" ? karsilik(m) : karsilik;
  }

  // HTTP durum kodundan son bir deneme
  const durum = Number(hata?.status || hata?.statusCode || 0);
  if (durum === 401 || durum === 403) return "Bu işlem için yetkiniz yok.";
  if (durum === 404) return "Kayıt bulunamadı.";
  if (durum === 409) return "Bu kayıt zaten mevcut.";
  if (durum === 429) return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.";
  if (durum >= 500) return "Sunucu hatası. Birazdan tekrar deneyin.";

  // Tanınmadı: kullanıcıya teknik metin gösterme, ayrıntıyı console'a bırak
  if (metin && typeof console !== "undefined") console.error("Çevrilmemiş hata:", metin, hata);
  return varsayilan;
}

/** "Kaydedilemedi: E-posta veya şifre hatalı." gibi önekli metin üretir. */
export function hataOnekli(onek, hata, varsayilan) {
  return `${onek}: ${hataMetni(hata, varsayilan)}`;
}
