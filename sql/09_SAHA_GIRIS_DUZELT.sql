-- ============================================================================
-- SAHA KULLANICISI GİRİŞ SORUNLARI — TEK SEFERDE DÜZELTME
--
-- Bu dosya 07 ve 08'in düzeltilmiş halini birleştirir. Supabase SQL editörüne
-- TAMAMINI yapıştırıp bir kez çalıştırın. Tekrar çalıştırılması zararsızdır.
--
-- İKİ AYRI HATA VAR:
--
-- (1) "Henüz size bir yer atanmadı"  -> profiles.ilce_id BOŞ
--     bir bölge sorumlusu (BSK-SAM-002) ve başka bir bölge sorumlusu (BSK-SAM-003) dahil 15 kişi.
--     Zincir: SahaGorunum -> bolge tablosu -> p_bolge_sel -> can_see_ilce()
--             can_see_ilce, 'sorumlu' rolü için:  p_ilce = auth_ilce()
--             auth_ilce() = profiles.ilce_id = NULL
--             'uuid' = NULL -> NULL -> politika geçmez -> 0 satır
--     Hata mesajı çıkmaz, ekran sadece boş gelir. o kullanıcıda ilce_id dolu
--     olduğu için onda bu sorun yoktu — tek fark buydu.
--
-- (2) "Her girişte yeniden şifre soruyor" -> sifre_gecici hiç temizlenemiyor
--     profiles üzerindeki tek UPDATE politikası p_profiles_upd, yalnızca
--     il/ilçe yönetimine izin veriyor. SifreDegistir.jsx'teki
--       update profiles set sifre_gecici=false where id = <kendi id>
--     çağrısı RLS tarafından filtreleniyor: hata dönmüyor, "0 satır" dönüyor,
--     sessizce yutuluyor. Kullanıcı şifresini gerçekten değiştiriyor ama
--     bayrak true kalıyor; sonraki girişte ekran yine karşısına çıkıyor.
--     Şu an 10 kişi bu döngüde.
-- ============================================================================


-- ############################################################################
-- BÖLÜM 1 — Kullanıcı kendi profilini güncelleyebilsin (şifre döngüsü)
-- ############################################################################

begin;

/* ---------------------------------------------------------------
   1.1) Yetki alanlarını kilitleyen trigger
   Politika satır bazlıdır, kolon bazlı değildir: sadece politika eklersek
   kullanıcı kendi rol'ünü 'il_yonetimi' yapabilir. Trigger bunu engeller.
   --------------------------------------------------------------- */
create or replace function public.profil_kendi_guncelleme()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  -- SUNUCU TARAFI: SQL editörü, migration ve service_role ile yapılan
  -- güncellemelerde auth.uid() NULL olur. Bunlar kısıtlanmaz — zaten RLS'i
  -- baypas ederler ve yalnızca sunucuda çalışırlar.
  -- BU SATIR ÖNEMLİ: yoksa trigger aşağıdaki kurtarma UPDATE'ini ve
  -- /api/hesap-ekle'yi de bloke ediyor (42501 hatası buradan geliyordu).
  if auth.uid() is null then
    return new;
  end if;

  -- yönetim her alanı değiştirebilir
  if public.auth_role() in ('il_yonetimi', 'ilce_yonetimi') then
    return new;
  end if;

  -- yönetim değilse yalnızca kendi satırı
  if old.id is distinct from auth.uid() then
    raise exception 'Yalnızca kendi profilinizi güncelleyebilirsiniz.'
      using errcode = '42501';
  end if;

  -- yetki ve kapsam alanları eski değerine sabitlenir (sessizce, hata vermeden)
  new.id            := old.id;
  new.rol           := old.rol;
  new.eposta        := old.eposta;
  new.il_id         := old.il_id;
  new.ilce_id       := old.ilce_id;
  new.mahalle_id    := old.mahalle_id;
  new.site_kayit_id := old.site_kayit_id;
  new.blok          := old.blok;
  new.aktif         := old.aktif;
  new.tc_no         := old.tc_no;
  new.tc_hash       := old.tc_hash;
  new.created_at    := old.created_at;

  return new;
end;
$$;

drop trigger if exists trg_profil_kendi_guncelleme on public.profiles;
create trigger trg_profil_kendi_guncelleme
  before update on public.profiles
  for each row execute function public.profil_kendi_guncelleme();

/* ---------------------------------------------------------------
   1.2) Kendi satırını güncelleme politikası
   Mevcut p_profiles_upd'a DOKUNULMAZ; politikalar VEYA'landığı için
   yönetimin yetkisi aynen sürer.
   Değiştirebileceği alanlar: sifre_gecici, ad_soyad, telefon, meslek
   Kilitli alanlar: yukarıdaki trigger'da sabitlenenler.
   --------------------------------------------------------------- */
drop policy if exists p_profiles_self_upd on public.profiles;
create policy p_profiles_self_upd on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

commit;


-- ############################################################################
-- BÖLÜM 2 — Şu an döngüde takılı kalanları kurtar
-- Şifresini zaten değiştirmiş (last_sign_in_at dolu) ama bayrağı
-- temizlenememiş olanlar.
-- ############################################################################

update public.profiles p
   set sifre_gecici = false
  from auth.users u
 where u.id = p.id
   and p.sifre_gecici is true
   and u.last_sign_in_at is not null;


-- ############################################################################
-- BÖLÜM 3 — profiles.ilce_id / il_id boşluklarını gerçek atamadan doldur
-- Uydurmuyoruz: kişinin bölgesinin/grubunun bağlı olduğu mahallenin ilçesi
-- neyse o yazılıyor.
-- ############################################################################

begin;

-- 3.1) Bölge sorumlusu / koordinatörü -> bölgenin ilçesi
update public.profiles p
   set ilce_id = m.ilce_id
  from public.bolge b
  join public.mahalle m on m.id = b.mahalle_id
 where p.ilce_id is null
   and (b.sorumlu_id = p.id or b.koordinator_id = p.id)
   and m.ilce_id is not null;

-- 3.2) Sokak grubu başkanları -> grubun bölgesinin ilçesi
update public.profiles p
   set ilce_id = m.ilce_id
  from public.sokak_grup g
  join public.bolge b on b.id = g.bolge_id
  join public.mahalle m on m.id = b.mahalle_id
 where p.ilce_id is null
   and g.baskan_id = p.id
   and m.ilce_id is not null;

-- 3.3) Ekip üyeleri -> üyesi olduğu grubun ilçesi
update public.profiles p
   set ilce_id = m.ilce_id
  from public.sokak_ekip e
  join public.sokak_grup g on g.id = e.grup_id
  join public.bolge b on b.id = g.bolge_id
  join public.mahalle m on m.id = b.mahalle_id
 where p.ilce_id is null
   and e.profil_id = p.id
   and m.ilce_id is not null;

-- 3.4) Site görevlileri -> sitenin ilçesi
update public.profiles p
   set ilce_id = s.ilce_id
  from public.site_kayit s
 where p.ilce_id is null
   and (s.id = p.site_kayit_id or s.temsilci_id = p.id)
   and s.ilce_id is not null;

-- 3.5) Mahalle başkanları -> mahallesinin ilçesi
update public.profiles p
   set ilce_id = m.ilce_id
  from public.mahalle m
 where p.ilce_id is null
   and m.id = p.mahalle_id
   and m.ilce_id is not null;

-- 3.6) il_id'yi ilçeden türet (şu an politikalarda kullanılmıyor ama
--      raporlama ve ileride çok-il kurulumu için tutarlı olmalı)
update public.profiles p
   set il_id = i.il_id
  from public.ilce i
 where p.il_id is null
   and i.id = p.ilce_id
   and i.il_id is not null;

commit;


/* =========================  DOĞRULAMA  =========================
   Aşağıyı ayrıca çalıştırın. Beklenen: ilk iki sütun 0, üçüncü 'YENI'.
   ============================================================== */
select
  (select count(*) from public.profiles p
     join auth.users u on u.id = p.id
    where p.sifre_gecici and u.last_sign_in_at is not null)          as sifre_dongusunde_kalan,

  (select count(*) from public.profiles p
    where p.ilce_id is null and p.rol <> 'il_yonetimi' and (
         exists (select 1 from public.bolge b where b.sorumlu_id=p.id or b.koordinator_id=p.id)
      or exists (select 1 from public.sokak_grup g where g.baskan_id=p.id)
      or exists (select 1 from public.sokak_ekip e where e.profil_id=p.id))) as ilcesiz_sorumlu,

  (select case when pg_get_functiondef(f.oid) like '%SUNUCU TARAFI%'
               then 'YENI (duzeltilmis)' else 'ESKI (bozuk)' end
     from pg_proc f join pg_namespace n on n.oid = f.pronamespace
    where n.nspname='public' and f.proname='profil_kendi_guncelleme')  as trigger_surumu;

/* Şamlar sorumluları — üçünün de ilçesi dolu görünmeli:
   select p.ad_soyad, p.eposta, i.ad as ilce, b.kod
     from bolge b join profiles p on p.id = b.sorumlu_id
     left join ilce i on i.id = p.ilce_id
    where b.kod like 'BSK-SAM-%' order by b.kod;

   Uygulamada: bir bölge sorumlusu ile giriş yapın -> BSK-SAM-002 görünmeli.
               başka bir bölge sorumlusu ile giriş yapın -> şifre ekranı BİR KEZ çıkmalı,
               çıkıp tekrar girince bir daha çıkmamalı.
*/

-- ---------------------------------------------------------------------------
-- İLERİSİ İÇİN NOT — bu iki hata da SESSİZ olduğu için pahalıydı:
--   * ilce_id boşken kullanıcı hata görmüyor, bomboş ekran görüyor
--   * RLS'in filtrelediği UPDATE hata döndürmüyor, "0 satır" dönüyor
-- 2. aşama RLS çalışmasında:
--   a) profiles.ilce_id'ye NOT NULL / CHECK kısıtı (il_yonetimi hariç)
--   b) SahaGorunum "hiç bölge yok" ile "ilçen tanımsız"ı ayrı mesajla göstersin
-- ---------------------------------------------------------------------------
