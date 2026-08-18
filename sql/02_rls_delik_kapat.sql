-- RLS DELİĞİNİ KAPAT — "*_all" battaniye politikalarını kaldırır
--
-- TEŞHİS (01 numaralı yamadan sonra pg_policies çıktısıyla doğrulandı):
-- RLS tüm tablolarda zaten AÇIKTI. Sızıntının sebebi her tabloda duran
--   create policy <tablo>_all on <tablo> for all to public using (true)
-- satırıydı. "public" rolü anon'u da kapsar, koşul sabit true — yani
-- giriş yapmamış herkes okuyup yazabiliyordu.
--
-- Bu politikalar aynı zamanda veritabanındaki DÜZGÜN politikaları da
-- işlevsiz kılıyor: can_see_row(), can_manage_ilce(), ekip_yetkim(),
-- mahalle başkanı ve sokak sorumlusu kısıtları VEYA'landığı için hiç
-- devreye girmiyor. Yani rol bazlı yetkilendirme fiilen kapalı.
--
-- GÜVENLİ Mİ: 01 numaralı yamada eklenen kapsayıcı politikalar
-- (hane_select, hane_update, ziyaret_select/insert/update,
-- ziyaret_log_select/insert, sokak_grup_*, gorevli_*) hepsi
-- "to authenticated using (true)" — giriş yapmış kullanıcı bugünkü
-- yetkisini aynen korur, uygulama KIRILMAZ. Düşen tek şey anonim erişim.
--
-- kisi_all BİLEREK BIRAKILDI: kisi tablosunda anon'un GRANT'i yok, yani
-- dışarı sızmıyor. Onu kaldırmak yetkiyi can_see_row()'a devreder ve
-- bazı roller (blok sorumlusu vb.) veri göremeyebilir — o 2. aşama işi,
-- rol rol test edilmeli.

begin;

drop policy if exists hane_all        on public.hane;
drop policy if exists ziyaret_all     on public.ziyaret;
drop policy if exists ziyaret_log_all on public.ziyaret_log;
drop policy if exists sokak_grup_all  on public.sokak_grup;
drop policy if exists gorevli_all     on public.gorevli;

-- İkinci savunma hattı: kisi'de çalışan desenin aynısı — anon'un tablo
-- yetkisini tamamen al. Politikadan bağımsız olarak erişimi keser.
revoke all on public.hane        from anon;
revoke all on public.ziyaret     from anon;
revoke all on public.ziyaret_log from anon;
revoke all on public.sokak_grup  from anon;
revoke all on public.gorevli     from anon;

commit;

-- ÇALIŞTIRDIKTAN SONRA UYGULAMADA TEST EDİN:
--   - hane listesi açılıyor mu (yönetim + saha görünümü)
--   - ziyaret kaydedilebiliyor mu (ZiyaretModal)
--   - ekip/görevli ekleme-silme çalışıyor mu (SokakYonetim, BlokSorumlulari)
-- "permission denied" alırsanız hangi ekranda olduğunu bildirin.
