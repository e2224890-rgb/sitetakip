-- MÜKERRER HESAPLAR — saha kullanıcısı bölgesini göremiyor  · UYGULANDI
--
-- NOT: Bu dosyadaki kişi adları, e-postalar ve kullanıcı kimlikleri depoya
-- kişisel veri girmemesi için temizlenmiştir. Uygulanan gerçek sorgu, aşağıdaki
-- şablonun somut kimliklerle doldurulmuş hâliydi.
--
-- BELİRTİ: Kullanıcı giriş yapınca "Henüz size bir yer atanmadı" görüyor, oysa
-- yönetim ekranında bir bölgenin sorumlusu olarak görünüyor.
--
-- TEŞHİS: Aynı kişinin İKİ hesabı var; atamalar kullanmadığı hesapta duruyor.
--   adsoyad@alan.com    -> güncel giriş var, ataması YOK
--   ad.soyad@alan.com   -> bölge + grup + ekip burada, giriş eski
--
-- KÖK NEDEN: SokakYonetim.jsx ve TeskilatYonetim.jsx e-postayı
--   `${slug(ad)}.${Math.random().toString(36).slice(-4)}@...`
-- ile üretiyordu. Her çağrıda rastgele 4 karakter eklendiği için aynı kişi
-- ikinci kez atandığında mevcut hesabı BULUNAMIYOR, yeni hesap açılıyordu.
-- Toplam 7 kişide mükerrer hesap oluştu.
--
-- KALICI ÇÖZÜM (kod tarafı, bu dosyadan bağımsız):
--   * lib/format.js -> epostaUret() ile adres deterministik hâle getirildi
--   * app/api/hesap-ekle/route.js -> hesap açmadan önce kişiyi e-posta veya
--     telefonun son 10 hanesiyle arıyor; bulursa yeni hesap AÇMIYOR
--   * profiles(lower(eposta)) UNIQUE kısıtı eklendi (bkz. 11_RLS_...)

begin;

/* ---------------------------------------------------------------
   1) Atamaları kişinin gerçekten kullandığı hesaba taşı
      :eski_id = ataması olan ama kullanılmayan hesap
      :yeni_id = kişinin giriş yaptığı hesap
   --------------------------------------------------------------- */
update public.bolge      set sorumlu_id = :'yeni_id' where sorumlu_id = :'eski_id';
update public.sokak_grup set baskan_id  = :'yeni_id' where baskan_id  = :'eski_id';
update public.sokak_ekip set profil_id  = :'yeni_id' where profil_id  = :'eski_id';

-- artık boşta kalan ikinci hesabı pasifleştir (SİLME — auth kaydı dursun,
-- geri açmak tek satır)
update public.profiles set aktif = false where id = :'eski_id';

/* ---------------------------------------------------------------
   2) Hiç kullanılmamış mükerrer hesaplar
      (last_sign_in_at NULL ve hiçbir atama bağı yok)
      Rastgele ekli e-posta üreticisinin bıraktığı 4 artık kayıt.
   --------------------------------------------------------------- */
update public.profiles p
   set aktif = false
 where p.id in (:'artik_1', :'artik_2', :'artik_3', :'artik_4');

commit;

/* =====================  DOĞRULAMA  =====================

   1) Kişi artık bölgesini görmeli — beklenen 1 satır:
      select b.kod from bolge b where b.sorumlu_id = :'yeni_id';

   2) Pasifleşen hesapların hiçbir bağı kalmamalı — beklenen 0:
      select count(*) from profiles p
       where p.aktif = false and (
         exists (select 1 from bolge      b where b.sorumlu_id = p.id or b.koordinator_id = p.id)
         or exists (select 1 from sokak_grup g where g.baskan_id = p.id)
         or exists (select 1 from sokak_ekip e where e.profil_id = p.id));

   3) Kalan mükerrer isimler (elle bakılacak):
      select lower(ad_soyad) ad, count(*) from profiles where aktif
       group by 1 having count(*) > 1;
   ======================================================= */

-- ELLE KARAR GEREKEN — bu yamaya DAHİL EDİLMEDİ:
--   * İki kaydı da kullanılmış, farklı rollerde (mahalle_baskani / koordinator)
--     benzer adlı kişiler: aynı kişi iki görevde mi, yoksa mükerrer mi —
--     teşkilata sorulmalı.
--   * Soyadı farklı yazılmış ve telefonu da farklı olan kayıt: ayrı kişi
--     olabilir, dokunulmadı.
