-- ACİL: kisi tablosu anonim erişime AÇIK — kapat
--
-- 02 numaralı dosyadaki "kisi tablosunda anon'un GRANT'i yok" notu YANLIŞTI.
-- 19 Ağustos 2026'da anon anahtarıyla test edildi, gerçek veri döndü:
--   GET /rest/v1/kisi?select=ad,soyad,telefon,tc_son4&limit=3  ->  HTTP 200
--   [{"ad":"SEFA","soyad":"KAYA",...,"tc_son4":"8580"}, ...]
--
-- SEBEP: iki şey aynı anda açık:
--   1) pg_class.relacl = anon=arwdDxtm  (anon'da tam select/insert/update/delete)
--   2) kisi_all politikası: for all to public using (true)
-- Yani giriş yapmamış herkes tüm kişi kayıtlarını okuyabiliyor ve yazabiliyor.
--
-- BU YAMA NE YAPAR: sadece anon'un GRANT'ini alır — 02'de diğer tablolarda
-- uygulanan desenin aynısı. kisi_all politikasına DOKUNMAZ, dolayısıyla giriş
-- yapmış hiçbir kullanıcı etkilenmez, uygulama KIRILMAZ.
--
-- kisi_all'ın kaldırılması 2. aşama işidir (bkz. 04): kaldırılınca yetki
-- can_see_row()'a devredilir ve o fonksiyon şu an 13 rolden sadece 4'ünü
-- tanıdığı için grup_baskani / blok_sorumlu / kollar hiçbir veri göremez.

begin;

revoke all on public.kisi from anon;

commit;

-- ÇALIŞTIRDIKTAN SONRA DOĞRULAMA (terminalden, anon anahtarıyla):
--   HTTP 401 + "permission denied for table kisi" dönmeli.
--   Uygulamada ise giriş yapıp kişi listelerinin açıldığını kontrol edin.
--
-- NOT: bolge ve profiles tablolarında da anon GRANT'i duruyor ama
-- politikaları fail-closed (can_see_ilce / auth_role anon'da null döner,
-- test edildi: HTTP 200 ama 0 satır). Acil değil; istenirse aynı şekilde
-- revoke edilebilir — ikinci savunma hattı olur:
--   revoke all on public.bolge    from anon;
--   revoke all on public.profiles from anon;
