-- ACİL RLS YAMASI — anonim (giriş yapmamış) erişimi kapatır
--
-- SORUN: Anon key tarayıcı bundle'ında herkese açık. 18.08.2026 tarihli testte
-- GİRİŞ YAPMADAN şunlar okunabiliyordu:
--   hane          126.006 satır  (adres, kapı no, blok — tüm hane listesi)
--   ziyaret            17 satır  (yaklasim = siyasi eğilim, not_ = serbest not, hane_id)
--   ziyaret_log        24 satır  (aynı verinin geçmişi)
--   sokak_grup        263 satır  (baskan_ad, baskan_tel + kişi/hane/üye sayıları)
--   gorevli             1 satır  (ad_soyad, telefon, rol)
--   v_rapor_site      512 satır  (site adları + ziyaret ilerlemesi)
--   mv_mahalle_ozet    13 satır  (mahalle kırılımlı demografi)
-- ziyaret.hane_id ile hane birleştirilebildiğinden "adres + siyasi eğilim + not"
-- üçlüsü dışarıdan çekilebilir durumdaydı. KVKK açısından en kritik nokta bu.
--
-- kisi tablosu ZATEN KAPALI (TC/telefon/isim sızmıyor) — orada sorun yok.
-- profiles, bolge, sokak, site_kayit, sokak_ekip, teskilat, talep, mahalle, ilce
-- de anonime kapalı görünüyor.
--
-- BU YAMANIN KAPSAMI: yalnızca "anonim erişimi kes". Giriş yapmış her kullanıcı
-- bugünkü yetkisiyle çalışmaya devam eder — yani uygulama KIRILMAZ, ama rol/ilçe
-- bazlı daraltma da YAPMAZ. Şu an bir saha görevlisi de tüm ilçelerin hanesini
-- görebiliyor; bunu düzeltmek 2. aşama (mevcut politikalar okunduktan sonra).
--
-- ÇALIŞTIRMADAN ÖNCE: Supabase SQL Editor'de tek tek çalıştırıp uygulamayı
-- (hane listesi, ziyaret kaydetme, ekip kurma) test edin.

begin;

-- 1) hane — istemci select + update yapıyor
alter table public.hane enable row level security;
create policy hane_select on public.hane for select to authenticated using (true);
create policy hane_update on public.hane for update to authenticated using (true) with check (true);

-- 2) ziyaret — istemci select + insert + update yapıyor
alter table public.ziyaret enable row level security;
create policy ziyaret_select on public.ziyaret for select to authenticated using (true);
create policy ziyaret_insert on public.ziyaret for insert to authenticated with check (true);
create policy ziyaret_update on public.ziyaret for update to authenticated using (true) with check (true);

-- 3) ziyaret_log — istemci select + insert yapıyor
alter table public.ziyaret_log enable row level security;
create policy ziyaret_log_select on public.ziyaret_log for select to authenticated using (true);
create policy ziyaret_log_insert on public.ziyaret_log for insert to authenticated with check (true);

-- 4) sokak_grup — istemci select + insert + update + delete yapıyor
alter table public.sokak_grup enable row level security;
create policy sokak_grup_select on public.sokak_grup for select to authenticated using (true);
create policy sokak_grup_insert on public.sokak_grup for insert to authenticated with check (true);
create policy sokak_grup_update on public.sokak_grup for update to authenticated using (true) with check (true);
create policy sokak_grup_delete on public.sokak_grup for delete to authenticated using (true);

-- 5) gorevli — istemci select + insert + update + delete yapıyor
alter table public.gorevli enable row level security;
create policy gorevli_select on public.gorevli for select to authenticated using (true);
create policy gorevli_insert on public.gorevli for insert to authenticated with check (true);
create policy gorevli_update on public.gorevli for update to authenticated using (true) with check (true);
create policy gorevli_delete on public.gorevli for delete to authenticated using (true);

-- 6) View/MV'lerde RLS yok — yetkiyi doğrudan geri al
revoke select on public.v_rapor_site   from anon;
revoke select on public.mv_mahalle_ozet from anon;

commit;

-- DOĞRULAMA (yamadan sonra çalıştırın; hepsi 0 dönmeli):
--   set role anon;
--   select count(*) from public.hane;
--   select count(*) from public.ziyaret;
--   select count(*) from public.sokak_grup;
--   reset role;
