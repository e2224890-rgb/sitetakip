-- SAHA KULLANICISI KENDİ ŞİFRESİNİ KALICI DEĞİŞTİREMİYOR
--
-- BELİRTİ: geçici şifreyle giren kullanıcı "Yeni şifre belirle" ekranını
-- tamamlıyor, şifresi gerçekten değişiyor — ama BİR SONRAKİ GİRİŞTE aynı ekran
-- yine karşısına çıkıyor. başka bir bölge sorumlusu 09.08.2026'da giriş yapmış, profilinde
-- sifre_gecici hâlâ true.
--
-- SEBEP: profiles tablosunda TEK bir UPDATE politikası var —
--   p_profiles_upd: auth_role()='il_yonetimi' OR (auth_role()='ilce_yonetimi' AND ilce_id=auth_ilce())
-- Yani hiçbir kullanıcı KENDİ satırını güncelleyemiyor. SifreDegistir.jsx'teki
--   supabase.from("profiles").update({ sifre_gecici:false }).eq("id", uid)
-- çağrısı hata da vermiyor: RLS satırı filtreliyor, "0 satır güncellendi" dönüyor
-- ve sessizce yutuluyor.
--
-- ÇÖZÜM: kullanıcı kendi satırını güncelleyebilsin — ama YETKİ ALANLARINA
-- DOKUNAMASIN. Sadece politika eklemek yetmez: politika satır bazlıdır, kolon
-- bazlı değildir; kullanıcı kendi rol'ünü 'il_yonetimi' yapabilirdi. Bu yüzden
-- politikanın yanına kolonları kilitleyen bir trigger konuyor.
--
-- DEĞİŞTİREBİLECEĞİ ALANLAR: sifre_gecici, ad_soyad, telefon, meslek
-- KİLİTLİ ALANLAR: rol, ilce_id, il_id, mahalle_id, site_kayit_id, blok, aktif,
--                  eposta, tc_no, tc_hash, id

begin;

/* ---------------------------------------------------------------
   1) Yetki alanlarını kilitleyen trigger
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
  -- baypas ederler ve yalnızca sunucuda çalışırlar. Bu satır olmadan trigger
  -- kendi kurtarma UPDATE'ini ve /api/hesap-ekle'yi de bloke ediyordu.
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
   2) Kendi satırını güncelleme politikası
   Mevcut p_profiles_upd'a DOKUNULMAZ; bu ek politika onunla VEYA'lanır,
   yani yönetimin yetkisi aynen sürer.
   --------------------------------------------------------------- */
drop policy if exists p_profiles_self_upd on public.profiles;
create policy p_profiles_self_upd on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

commit;

/* ---------------------------------------------------------------
   3) Şu an takılı kalmış kullanıcıları kurtar
   Şifresini zaten değiştirmiş ama bayrağı temizlenememiş olanlar.
   Giriş yapmış (last_sign_in_at dolu) ve hâlâ sifre_gecici=true olanlar.
   --------------------------------------------------------------- */
update public.profiles p
   set sifre_gecici = false
  from auth.users u
 where u.id = p.id
   and p.sifre_gecici is true
   and u.last_sign_in_at is not null;

/* =====================  DOĞRULAMA  =====================

   1) Takılı kalan kimse olmamalı — beklenen 0:
      select count(*) from profiles p join auth.users u on u.id = p.id
       where p.sifre_gecici and u.last_sign_in_at is not null;

   2) Uygulamada: başka bir bölge sorumlusu ile giriş yapın, şifre ekranı bir kez çıkmalı,
      yeni şifre belirledikten sonra ÇIKIP TEKRAR GİRİNCE bir daha çıkmamalı.

   3) Yetki yükseltme kapalı mı — bir saha kullanıcısı olarak çalıştırıldığında
      rol DEĞİŞMEMELİ (hata da vermez, sessizce eski değerde kalır):
      update profiles set rol='il_yonetimi' where id = auth.uid();
      select rol from profiles where id = auth.uid();   -- eski rolü göstermeli
   ======================================================= */
