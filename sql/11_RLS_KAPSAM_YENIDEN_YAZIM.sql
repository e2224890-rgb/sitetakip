-- =============================================================================
-- RLS KAPSAM YENİDEN YAZIMI — 24.08.2026 · CANLIDA UYGULANDI
--
-- Supabase migration olarak da kayıtlı:
--   kisi_kapsam_kolonlari_ekle · kisi_kapsam_senkron_trigger
--   rls_kapsam_yardimcilari · ziyaret_kapsam_kolonlari
--   rls_kisi_kapsam_politikasi · rls_hane_ziyaret_kapsam
--   rls_grup_ekip_gorevli_talep_teskilat · rls_profiles_mahalle_baskani_kapsami
--   rls_profiles_ozyineleme_duzelt · rls_bolge_sitekayit_kapsam
--   view_security_invoker_ac · rls_kalan_tablolar_ve_search_path
--   definer_fonksiyon_execute_kisitla
--
-- Bu dosya ne yapıldığını ve NEDEN yapıldığını anlatır; tekrar çalıştırmak
-- gerekmez (migration'lar uygulandı).
-- =============================================================================


-- SORUN
-- -----
-- 65b7f37'de *_all battaniye politikaları temizlenmiş, aynı desendeki 23 politika
-- atlanmıştı. Koşulları düpedüz `true` olan bu politikalar, yanlarındaki doğru
-- politikaları (can_see_row) VEYA'lanma yoluyla tamamen etkisiz kılıyordu.
--
-- Rol taklidiyle ölçülen ÖNCEKİ durum — tek bir bölgenin sorumlusu (BSK-SAM-002) neyi görüyordu:
--     kisi=325.814   hane=126.006   bolge=227   grup=263   talep=1   profil=49
-- Yani tüm ilçenin verisi. kisi_all cmd=ALL olduğu için SİLEBİLİYORDU da.


-- NEDEN BASİT BİR "POLİTİKALARI DÜŞÜR" YETMEDİ
-- --------------------------------------------
-- Ölçüm: hane'lerin %73'ünde (92.151/126.006) ve kişilerin %70'inde
-- (229.186/325.814) bolge_id NULL — bunlar site sakinleri. can_see_row(ilce,
-- bolge) bu satırların hepsinde false döner. Battaniye politikalar öylece
-- kaldırılsaydı site görevlileri, blok sorumluları ve mahalle başkanları
-- verinin dörtte üçünü kaybederdi.
--
-- Çözüm: kapsamı bölge ekseninden çıkarıp beş eksene yaymak:
--   ilçe · mahalle · bölge · sokak grubu · site


-- 1) ŞEMA — eksik kapsam kolonları
-- --------------------------------
--   kisi        += grup_id, site_kayit_id      (hane'den türetildi, 0 uyuşmazlık)
--   ziyaret     += grup_id, site_kayit_id, mahalle_id
--   ziyaret_log += grup_id, site_kayit_id, mahalle_id
--
-- Neden denormalizasyon: kisi.bolge_id zaten aynı şekilde hane'den türetiliyordu;
-- bu tutarlı bir devam. Alternatif (politika içinde hane'ye join) 325 bin satırda
-- her sorguda alt sorgu demekti.
--
-- Senkron trigger'ları:
--   trg_hane_kapsam_yansit   — hane değişince bağlı kişiler güncellenir
--   trg_kisi_kapsam_devral   — yeni kişi hanesinden devralır (üye içe aktarımı!)
--   trg_ziyaret_kapsam       — ziyaret kapsamı HANEDEN alınır, istemciye güvenilmez
-- Bayat kapsam sessiz yetki hatası demek: devredilen bir grubun eski başkanı
-- kişileri görmeye devam ederdi.


-- 2) KAPSAM YARDIMCILARI
-- ----------------------
--   yetki_il_mi() · yetki_yonetim_mi()
--   kapsam_ilcem()     -> yalnızca ilce_yonetimi ise ilçe, değilse NULL
--   kapsam_mahallem()  -> yalnızca mahalle_baskani ise mahalle, değilse NULL
--   kapsam_bolgelerim() · kapsam_gruplarim() · kapsam_sitelerim()
--   kapsam_gorunur_bolgelerim() · kapsam_profillerim()
--
-- NULL dönmesi kasıtlı: "ilce_id = NULL" hiçbir satırı eşleştirmez, böylece rol
-- kontrolü ayrıca yazılmak zorunda kalmaz.
--
-- PERFORMANS — kritik ayrıntı: politikada "(select f())" diye SARILMALARI şart.
-- Sarıldığında Postgres bunları InitPlan'a çevirip SORGU BAŞINA BİR KEZ çalıştırır.
-- Sarılmazsa SATIR BAŞINA çalışır ve 325 bin satırda kabul edilemez.
-- Doğrulandı — EXPLAIN ANALYZE (sorumlu rolüyle, kisi sorgusu):
--   Bitmap Index Scan on ix_kisi_bolge ... InitPlan 6..10 (her biri 1 loop)
--   Execution Time: 43 ms


-- 3) POLİTİKALAR
-- --------------
-- Kaldırılan battaniyeler: kisi_all, hane_select, hane_update, ziyaret_select,
-- ziyaret_insert, ziyaret_update, ziyaret_log_select, ziyaret_log_insert,
-- sokak_grup_{select,insert,update,delete}, sokak_ekip_select, sokak_ekip_yaz,
-- gorevli_{select,insert,update,delete}, talep_sel, talep_upd, talep_log_sel,
-- talep_log_ins, teskilat_sel, mb_sel_* (kapsamsız mahalle başkanı politikaları)
--
-- OKUMA kapsamı (kisi, hane, ziyaret, ziyaret_log):
--   il_yönetimi     -> her şey
--   ilçe_yönetimi   -> kendi ilçesi
--   mahalle başkanı -> kendi mahallesi
--   sorumlu/koord.  -> sorumlu/koordinatör olduğu bölgeler + temsilcisi olduğu siteler
--   grup başkanı    -> başkanı veya ekip üyesi olduğu gruplar
--   blok/site rolü  -> hesabına bağlı site
--
-- YAZMA daha dar:
--   kisi     -> yalnızca yönetim (uygulama kisi'ye hiç yazmıyor; kod tarandı)
--   hane     -> yönetim + bölge sahibi + site temsilcisi (grup başkanı yazamaz)
--   ziyaret  -> okuma kapsamıyla aynı (saha görevlisi kendi hanesine yazar)
--
-- TALEP (F4 kararı uygulandı): "talebin ait olduğu bölgenin sorumlusu +
-- yönetim + ilçe yönetimi". Önceki hali talep_sel/talep_upd -> using(true),
-- yani herkes tüm vatandaş taleplerini görüyor VE düzenleyebiliyordu.
--
-- PROFİLLER: mb_sel_profiles politikasındaki `my_rol() = 'mahalle_baskani'`
-- koşulunda hiç kapsam yoktu — herhangi bir mahalle başkanı 39 ilçedeki bütün
-- profilleri (ad, telefon, tc_no, e-posta, rol) okuyabiliyordu, il yönetimi dahil.
--
-- ÖZYİNELEME TUZAĞI: profiles politikası bolge'yi sorgularsa, bolge politikası da
-- profiles'a baktığı için 42P17 infinite recursion olur. Bu yüzden profil ve
-- bölge kümesi aramaları SECURITY DEFINER fonksiyonlara taşındı (RLS'i baypas
-- ederek döngüyü kırarlar).


-- 4) VIEW'LAR
-- -----------
-- 7 view security_invoker kapalıydı: sahibinin (postgres) yetkisiyle çalışıp
-- alttaki tabloların RLS'ini baypas ediyorlardı. anon kapatıldıktan sonra bile
-- giriş yapmış bir grup başkanı v_hane_memleket ile tüm ilçeyi okuyabilirdi.
--   keos_ref, v_bolge_memleket, v_hane_memleket, v_rapor_sokak,
--   v_rapor_site, v_site_blok, v_sokak_ekip_durum  ->  security_invoker = on
-- Supabase linter'daki 7 adet "security_definer_view" ERROR'u sıfırlandı.


-- 5) KISITLAR VE İNDEKSLER
-- ------------------------
--   ziyaret(hane_id)                 UNIQUE  — kod bir hanede tek ziyaret satırı
--                                              varsayıyordu, kısıt yoktu; iki kişi
--                                              aynı anda kaydederse çift satır olurdu
--   profiles(lower(eposta))          UNIQUE  — mükerrer hesap sorununun yapısal kökü
--   kisi(tc_hash)                    UNIQUE  — ÜYE LİSTESİ İÇE AKTARIMI İÇİN ŞART
--                                              (325.814 kayıtta dolu ve çakışmasız)
--   sokak_ekip(grup_id, profil_id)   UNIQUE  — aynı kişi gruba iki kez eklenemesin
--   hane(mahalle_id), ziyaret(ilce_id), kisi(grup_id), kisi(site_kayit_id),
--   ziyaret(site_kayit_id), ziyaret(grup_id)     — eksik indeksler


-- 6) DİĞER
-- --------
--   kapi_nokta, sokak_site_aday        -> RLS açıldı + yönetim politikası
--   norm, norm_mah, yol_core, kapi_base -> search_path sabitlendi
--   30 SECURITY DEFINER fonksiyon      -> EXECUTE yetkisi PUBLIC/anon'dan alındı,
--                                          authenticated + service_role'a verildi


/* =====================  SONUÇ (rol taklidiyle ölçüldü)  =====================

  rol               kisi     hane     bolge  site  grup  talep  profil
  ---------------------------------------------------------------------
  il_yonetimi     325814   126006       227   514   263      1      49
  ilce_yonetimi   325814   126006       227   514   263      1      43
  site_sosyal      29694    11436         0     5     0      1       1
  ana_kademe       13056     4802         0     1     0      0       1
  mahalle_baskani    936      358         3     1     3      0       4
  sorumlu            390      145         1     0     1      0       5
  grup_baskani       148       55         1     0     1      0       5

  ÖNCESİNDE HEPSİ:  325814   126006       227   514   263      1      49

  Doğrulama sorgusu (psql / SQL editörü):
    begin;
    set local role authenticated;
    set local request.jwt.claims = '{"sub":"<kullanici-uuid>","role":"authenticated"}';
    select (select count(*) from kisi), (select count(*) from hane);
    rollback;
  ========================================================================== */


-- AÇIK KALANLAR — ayrı ele alınacak
-- ---------------------------------
--   * mv_* materialized view'lar authenticated tarafından okunabiliyor.
--     Matview'da RLS mümkün değil; içerikleri yalnızca sayısal toplam olduğu için
--     (ad/adres yok) kabul edildi. Kişi bazlı kırılım eklenirse gözden geçirilmeli.
--   * Yedek tablolar (site_kayit_yedek_20260726, ziyaret_yedek_20260726,
--     ziyaret_log_yedek_20260726, ziyaret_not_yedek, keos_tam, keos_ref_snapshot):
--     RLS açık ama politikası yok -> erişim tamamen kapalı. İçlerinde kişisel veri
--     var; arşivlenip düşürülmeleri gerekir. SİLME İŞLEMİ YAPILMADI.
--   * Dashboard: "Leaked password protection" kapalı (HaveIBeenPwned kontrolü).
--   * Çok ilçeye dağıtım: 6 yerde Başakşehir sabit kodlu (bkz. INCELEME_2026-08-24.md O6).
