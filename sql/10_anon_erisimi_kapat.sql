-- ANONİM (GİRİŞSİZ) ERİŞİMİ KAPAT — 24.08.2026 · UYGULANDI
--
-- TESPİT: anon rolü, hiç giriş yapmadan REST üzerinden veri okuyabiliyordu.
-- Canlı test (anon publishable key ile, oturum açmadan) gerçek veri döndürdü:
--   v_hane_memleket     -> hane_id, bolge_id, memleket, kisi, uye
--   v_rapor_sokak       -> ilçenin 1012 sokağının ziyaret durumu
--   v_site_blok         -> site/blok kırılımı
--   v_sokak_ekip_durum  -> grup/bölge ekip durumu
--   keos_ref            -> mahalle + yol + kapı no (adres referansı)
--   mv_bolge_ozet, mv_site_ozet, mv_mahalle_yas_cins, mv_mahalle_nufus_il
--
-- NEDEN RLS KURTARMADI:
--   * View'lar security_invoker=off ile tanımlı -> sahibinin (postgres)
--     yetkisiyle çalışıyor, alttaki tabloların RLS'ini BAYPAS ediyor.
--   * Materialized view'larda RLS zaten MÜMKÜN DEĞİL; tek koruma GRANT'tir.
--   * kapi_nokta ve sokak_site_aday tablolarında RLS hiç açık değildi.
--   Yani bu nesnelerde politika yazmak işe yaramaz; GRANT kaldırmak gerekiyordu.
--
-- GÜVENLİ Mİ: evet. Uygulamanın hiçbir yerinde anon sorgusu yok — kullanıcı
-- önce giriş yapıyor, sonra bütün istekler authenticated rolüyle gidiyor.
-- Kullanılan view'lar (v_rapor_sokak, v_rapor_site, v_site_blok, v_kapi_blok,
-- vw_bolge_ozet) authenticated tarafından okunmaya devam ediyor; kontrol edildi.
-- GERİ ALINABİLİR: yalnızca GRANT değişikliği, veri/politika dokunulmadı.

do $$
declare r record; n int := 0;
begin
  for r in
    select c.oid::regclass::text as nesne
      from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
     where ns.nspname = 'public' and c.relkind in ('r','v','m','p','f')
  loop
    execute format('revoke all on %s from anon', r.nesne);
    n := n + 1;
  end loop;
  raise notice 'anon yetkisi kaldirilan nesne sayisi: %', n;
end $$;

revoke all on all functions in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke usage on schema public from anon;

/* =====================  DOĞRULAMA  =====================

   1) anon hiçbir şey okuyamamalı — beklenen 0:
      select count(*) from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
       where ns.nspname='public' and c.relkind in ('r','v','m')
         and has_table_privilege('anon', c.oid, 'SELECT');

   2) authenticated bozulmamalı — hepsi true olmalı:
      select c.relname, has_table_privilege('authenticated', c.oid, 'SELECT')
        from pg_class c join pg_namespace ns on ns.oid=c.relnamespace
       where ns.nspname='public'
         and c.relname in ('kisi','hane','ziyaret','profiles','bolge',
                           'sokak_grup','v_rapor_sokak','mv_mahalle_ozet','v_site_blok');

   3) REST'ten girişsiz deneme 42501 (permission denied) dönmeli:
      curl "$URL/rest/v1/v_hane_memleket?select=*&limit=1" -H "apikey: $ANON_KEY"

   4) Giriş hâlâ çalışmalı (yanlış şifre 400 dönmeli, 500/403 DEĞİL):
      curl -X POST "$URL/auth/v1/token?grant_type=password" -H "apikey: $ANON_KEY" ...
   ======================================================= */

-- SIRADAKİ — BU YAMA KAPSAMINDA DEĞİL:
--   * Kayıt (signup) açık: /auth/v1/settings -> "disable_signup": false
--     Dashboard > Authentication > Sign In / Providers > Email > "Allow new users
--     to sign up" KAPATILMALI. Hesaplar /api/hesap-ekle üzerinden admin API ile
--     açıldığı için bu ayarın kapatılması hiçbir şeyi bozmaz.
--   * authenticated için battaniye politikalar (kisi_all ALL/true, hane_update,
--     ziyaret_*, sokak_grup_*, gorevli_*, talep_upd, teskilat_sel) hâlâ açık.
--     Bunlar kaldırılırken hane/kişi satırlarının %73'ünün bolge_id'si NULL
--     olduğu (site sakinleri) hesaba katılmalı; can_see_row tek başına yetmez.
--   * security_invoker=on view'lar için ayrı ele alınacak.
