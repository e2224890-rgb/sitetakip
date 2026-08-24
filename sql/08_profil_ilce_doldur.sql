-- SAHA KULLANICISI BÖLGESİNİ GÖREMİYOR — profiles.ilce_id boş
--
-- BELİRTİ: bir bölge sorumlusu (BSK-SAM-002 sorumlusu) ve başka bir bölge sorumlusu (BSK-SAM-003)
-- giriş yapıyor, "Henüz size bir yer atanmadı" görüyorlar. Oysa bolge.sorumlu_id
-- doğru hesaba bağlı. mükerrer hesabı olan kullanıcı'ta aynı sorun YOK.
--
-- SEBEP ZİNCİRİ:
--   1) SahaGorunum, bolge tablosunu sorumlu_id = auth.uid() ile sorguluyor
--   2) bolge okuma politikası: p_bolge_sel -> can_see_ilce(ilce_id)
--   3) can_see_ilce, il_yonetimi dışındaki herkes için: p_ilce = auth_ilce()
--   4) auth_ilce() = profiles.ilce_id — bu kişilerde NULL
--   5) 'uuid' = NULL  ->  NULL  ->  politika geçmez  ->  0 satır
-- Hata da vermez; ekran sadece boş gelir. diğer kullanıcının profilinde ilce_id dolu
-- olduğu için o çalışıyor. Fark tam olarak bu.
--
-- KAPSAM: ataması olduğu halde ilce_id'si boş 15 kullanıcı
--   13 grup_baskani + 2 sorumlu. Hepsi bugün boş ekran görüyor.
--   (il_yonetimi rolündeki 5 kişide de NULL ama onlar etkilenmez:
--    can_see_ilce onlara koşulsuz true döner.)
--
-- ÇÖZÜM: ilce_id'yi kişinin gerçek atamasından türet. Uydurmuyoruz —
-- bölgesinin/grubunun bağlı olduğu mahallenin ilçesi neyse o yazılıyor.

begin;

/* ---------------------------------------------------------------
   1) Bölge sorumlusu / koordinatörü olanlar -> bölgenin ilçesi
   --------------------------------------------------------------- */
update public.profiles p
   set ilce_id = m.ilce_id
  from public.bolge b
  join public.mahalle m on m.id = b.mahalle_id
 where p.ilce_id is null
   and (b.sorumlu_id = p.id or b.koordinator_id = p.id)
   and m.ilce_id is not null;

/* ---------------------------------------------------------------
   2) Sokak grubu başkanları -> grubun bölgesinin ilçesi
   --------------------------------------------------------------- */
update public.profiles p
   set ilce_id = m.ilce_id
  from public.sokak_grup g
  join public.bolge b on b.id = g.bolge_id
  join public.mahalle m on m.id = b.mahalle_id
 where p.ilce_id is null
   and g.baskan_id = p.id
   and m.ilce_id is not null;

/* ---------------------------------------------------------------
   3) Ekip üyeleri -> üyesi olduğu grubun ilçesi
   --------------------------------------------------------------- */
update public.profiles p
   set ilce_id = m.ilce_id
  from public.sokak_ekip e
  join public.sokak_grup g on g.id = e.grup_id
  join public.bolge b on b.id = g.bolge_id
  join public.mahalle m on m.id = b.mahalle_id
 where p.ilce_id is null
   and e.profil_id = p.id
   and m.ilce_id is not null;

/* ---------------------------------------------------------------
   4) Site görevlileri -> sitenin ilçesi
   --------------------------------------------------------------- */
update public.profiles p
   set ilce_id = s.ilce_id
  from public.site_kayit s
 where p.ilce_id is null
   and (s.id = p.site_kayit_id or s.temsilci_id = p.id)
   and s.ilce_id is not null;

/* ---------------------------------------------------------------
   5) Mahalle başkanları -> mahallesinin ilçesi
   --------------------------------------------------------------- */
update public.profiles p
   set ilce_id = m.ilce_id
  from public.mahalle m
 where p.ilce_id is null
   and m.id = p.mahalle_id
   and m.ilce_id is not null;

commit;

/* =====================  DOĞRULAMA  =====================

   1) Ataması olup ilçesi boş kalan kimse olmamalı — beklenen 0:
      select count(*) from profiles p
       where p.ilce_id is null and p.rol <> 'il_yonetimi' and (
         exists (select 1 from bolge b where b.sorumlu_id=p.id or b.koordinator_id=p.id)
         or exists (select 1 from sokak_grup g where g.baskan_id=p.id)
         or exists (select 1 from sokak_ekip e where e.profil_id=p.id));

   2) Şamlar sorumluları — üçünün de ilçesi dolu olmalı:
      select p.ad_soyad, p.eposta, i.ad as ilce, b.kod
        from bolge b join profiles p on p.id=b.sorumlu_id
        left join ilce i on i.id=p.ilce_id
       where b.mahalle_id='ee2e1ba2-6eb9-461a-a133-1d07d0823188' order by b.kod;

   3) Uygulamada: bir bölge sorumlusu ile giriş yapın, BSK-SAM-002 görünmeli.
   ======================================================= */

-- NOT — İLERİSİ İÇİN:
-- Bu hata sessiz olduğu için pahalıydı: ilce_id boş kalınca kullanıcı hata
-- görmüyor, sadece bomboş bir ekran görüyor. Aynı tuzağa yeniden düşmemek için
-- 2. aşama RLS çalışmasında iki şey yapılmalı:
--   a) profiles.ilce_id'ye NOT NULL kısıtı (il_yonetimi hariç tutulacaksa CHECK ile)
--   b) SahaGorunum'da "hiç bölge yok" ile "ilçen tanımsız" ayrı mesajlar versin
