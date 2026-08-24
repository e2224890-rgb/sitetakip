-- ANONİM ERİŞİMİ TAMAMEN KAPAT — view / matview sızıntısı dahil
--
-- NEDEN GEREKLİ: 02 yaması 5 tabloyu kapattı ama 19.08.2026'da anon anahtarıyla
-- yapılan taramada 10 nesne hâlâ veri döndürdü:
--   kisi, v_hane_memleket, v_rapor_sokak, v_site_blok, v_sokak_ekip_durum,
--   keos_ref, mv_bolge_ozet, mv_site_ozet, mv_mahalle_nufus_il, mv_mahalle_yas_cins
--
-- İKİ AYRI SEBEP VARDI:
--   1) View'ler varsayılan olarak SAHİBİNİN (postgres) yetkisiyle çalışır;
--      yani alttaki tablonun RLS'ini BAYPAS EDER. Sadece 4 view'de
--      security_invoker açıktı (v_kapi_blok, v_sokak_ekip, v_talep, vw_bolge_ozet)
--      — nitekim taramada onlar 401 verdi, diğerleri veri döndü.
--   2) Materialized view'lerde RLS ZATEN ÇALIŞMAZ. Tek koruma GRANT'tir ve
--      hepsinde anon GRANT'i duruyordu.
--
-- BU YAMA NE YAPAR:
--   A) public şemasındaki HER nesnenin anon yetkisini alır (tablo + view + matview).
--   B) RLS'i baypas eden view'lere security_invoker verir.
--   C) RLS'i kapalı iki tabloyu açar.
--
-- GÜVENLİ Mİ: EVET. Uygulama giriş yapmadan hiçbir veri okumuyor —
-- app/page.jsx yalnızca supabase.auth.getSession() çağırıyor, Login.jsx yalnızca
-- signInWithPassword. Yani anon rolünün tablo yetkisine hiç ihtiyaç yok.
-- authenticated rolüne DOKUNULMAZ; giriş yapmış kullanıcı bugünkü yetkisini korur.

begin;

/* ---------------------------------------------------------------
   A) anon'un public şemasındaki tüm okuma/yazma yetkisini al.
   "ALL TABLES" PostgreSQL'de view ve materialized view'leri de kapsar.
   --------------------------------------------------------------- */
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;

-- Bundan sonra oluşturulacak nesneler de otomatik olarak anon'a kapalı olsun
alter default privileges in schema public revoke all on tables    from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on functions from anon;

/* ---------------------------------------------------------------
   B) View'ler artık çağıranın yetkisiyle çalışsın (RLS'i baypas etmesin).
   Bugün etkisi yok — authenticated için hane/kisi/ziyaret politikaları hâlâ
   using(true). Ama 2. aşamada RLS daraltıldığında bu view'ler de otomatik
   olarak doğru kapsamı gösterecek. Bu satır olmadan 2. aşama yamalanamaz:
   politikaları daraltsak bile bu view'lerden her şey görünmeye devam ederdi.
   --------------------------------------------------------------- */
alter view public.v_hane_memleket    set (security_invoker = on);
alter view public.v_bolge_memleket   set (security_invoker = on);
alter view public.v_rapor_site       set (security_invoker = on);
alter view public.v_rapor_sokak      set (security_invoker = on);
alter view public.v_site_blok        set (security_invoker = on);
alter view public.v_sokak_ekip_durum set (security_invoker = on);

-- keos_ref BİLEREK DIŞARIDA BIRAKILDI: kaynağı keos_ref_snapshot ve o tabloda
-- RLS açık ama HİÇ politika yok. security_invoker verilirse view herkese 0 satır
-- döndürür. Uygulama keos_ref'i kullanmıyor, anon yetkisi de yukarıda alındığı
-- için sızıntı kapandı. İleride adres referansı ilçe bazlı kullanılacaksa
-- keos_ref_snapshot'a ilce_id + politika eklenip burası da açılmalı.

/* ---------------------------------------------------------------
   C) RLS'i kapalı kalmış iki tablo. İkisi de şu an boş; veri girdiği anda
   koruması olmayan tablolar olurdu. Uygulama ikisini de kullanmıyor.
   --------------------------------------------------------------- */
alter table public.kapi_nokta      enable row level security;
alter table public.sokak_site_aday enable row level security;

commit;

/* =================================================================
   ÇALIŞTIRDIKTAN SONRA DOĞRULAMA

   1) Anonim tarama tekrar çalıştırılmalı; hepsi 401 dönmeli:
        GET /rest/v1/kisi?select=id&limit=1              -> 401
        GET /rest/v1/v_hane_memleket?select=*&limit=1    -> 401
        GET /rest/v1/mv_site_ozet?select=*&limit=1       -> 401

   2) Uygulamada giriş yapıp şu ekranlar açılmalı (view kullananlar):
        Yönetim ana ekran            (mv_mahalle_ozet)
        Bölgeler                     (mv_bolge_ozet, mv_mahalle_nufus_il)
        Siteler / Site skorboard     (mv_site_ozet, v_rapor_site, v_kapi_blok)
        Demografi / Gezgin           (mv_mahalle_yas_cins, mv_mahalle_nufus_il)
        Koordinatör ekranı           (vw_bolge_ozet)
        Başkan raporu                (v_rapor_sokak, v_rapor_site)
        Ekip atama / Blok sorumluları(v_site_blok)

   Bir ekran boş gelirse: o view security_invoker listesinde ve alttaki tabloda
   authenticated politikası eksik demektir — hangi ekran olduğunu bildirin.

   NOT: Bu yamadan sonra da GİRİŞ YAPMIŞ kullanıcı hâlâ her şeyi görüyor.
   O, 01 yamasındaki geçici using(true) politikalarının işi ve 2. aşamada
   (can_see_row v2 + rol politikaları) ele alınacak.
   ================================================================= */
