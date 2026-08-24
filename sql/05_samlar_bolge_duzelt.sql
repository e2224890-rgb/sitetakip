-- ŞAMLAR — bölgeleri coğrafi olarak yeniden düzenle
--
-- SORUN: mevcut bölgeler "grup başına 150 hane" kuralına uyuyor (150/145/55) ama
-- sokaklar coğrafi yakınlığa göre değil, sırayla doldurularak dağıtılmış. Ölçüm:
--   grup içi yayılım 0,68 km · sokak kendi grubunun merkezine en yakın %37 · ayrışma 0,16 km
-- %37, üç gruba RASTGELE atama seviyesidir (%33). Yani coğrafya hiç dikkate alınmamış.
-- BSK-SAM-001 ile 002'nin merkezleri arasında yalnızca 60 metre vardı.
--
-- ÇÖZÜM: 48 sokağın 46'sı TKGM parsel servisinden konumlandırıldı
-- (keos_tam.ada_parsel -> kadastro poligonu; her sonuç "Şamlar sınırı içinde mi"
-- diye nokta-poligon testiyle doğrulandı). Sonra 150 hane tavanı ve sokak
-- bütünlüğü korunarak dengeli coğrafi kümeleme yapıldı (400 farklı başlangıç denendi).
--   grup içi yayılım 0.41 km · isabet %91 · ayrışma 0.57 km
--
-- KURALLAR KORUNDU:
--   · hiçbir sokak iki bölgeye bölünmedi
--   · grup başına en fazla 150 hane
--   · bölge kodları ve sorumluları değişmedi (her yeni grup en çok örtüştüğü bölgeye eşlendi)
--
-- DEĞİŞEN: 29 sokak / 228 hane
-- DOKUNULMAYAN: ÖZGÜR SOKAK (1 hane), UÇURTMA SOKAK (2 hane) — ne keos_tam'da ne
--   OSM'de konum kaydı var; mevcut bölgelerinde bırakıldı.
-- ETKİLENMEYEN: sokak_ekip (16 üye), sokak_grup, bolge.sorumlu_id, ziyaret (4 kayıt)
--
-- GERİ ALMA: sql/05_GERIAL_samlar.sql

begin;

-- BSK-SAM-001 — 17 sokak, 150 hane
--   19 MAYIS CADDESİ
--   23 NİSAN CADDESİ
--   29 MAYIS CADDESİ
--   30 AĞUSTOS CADDESİ
--   BOZKARA SOKAK
--   ESTERGON SOKAK
--   GÜNEYSU SOKAK
--   GÜZELBAHÇE SOKAK
--   HANEDAN SOKAK
--   HÜRMET SOKAK
--   KUZGUNCUK SOKAK
--   KİRAZLIBAHÇE SOKAK
--   MODANLI SOKAK
--   PAMUKKALE SOKAK
--   TÜRKBÜKÜ SOKAK
--   TÜRKMEN SOKAK
--   YAVUZHAN SOKAK
update public.hane set bolge_id='dff15c8b-3e3c-41e4-b385-21e6842589cd', grup_id='6ff3cba8-5b44-4e5d-add9-48e145f5f20b'
 where mahalle_id='ee2e1ba2-6eb9-461a-a133-1d07d0823188' and sokak_id in (
   '0244af29-905d-4f3c-8e71-86276ebabaaa',
   '8af3803b-4825-441f-8481-5269bb9edb00',
   '02550c50-2062-40b1-a6fe-aa28d309f80d',
   'a15aca06-450e-40a0-b818-37acb1962f18',
   'd47e68c4-3bf0-442e-a60d-edcef36d9ac4',
   'f97da7be-2336-4c42-8902-7a9782d19fd2',
   'f39e202f-0aa4-4d63-a7f7-ac68c30477e6',
   'f9d0a5e1-32da-4c0c-9ef3-03527a3ba128',
   '01525469-3f90-4ce3-af64-7edd405dec28',
   '8373dafe-56dc-4fe0-bd0d-10e65d4d89c2',
   '1deb548d-99f4-4956-a25d-c217a369c114',
   'd1bed93b-563b-40bb-b04a-dba16117e51e',
   '7cdd98a0-078a-49da-ba52-0b2e89a74475',
   'efcca121-644c-4746-af93-d09cd9daf76d',
   '440c8ed9-9e0d-4255-b721-ac76afd83fce',
   '5eb1e657-e13f-418f-9392-a59f138c4a8a',
   'a680aba2-88f5-49f8-8525-7896d6a34781'
 );

-- BSK-SAM-002 — 17 sokak, 137 hane
--   19 KASIM CADDESİ
--   2842. SOKAK
--   29 EKİM CADDESİ
--   AYDEDE SOKAK
--   CENNETKUŞU SOKAK
--   FUNDA SOKAK
--   GONCA SOKAK
--   GÜLCE ÇIKMAZI SOKAK
--   GÜLEÇ ÇIKMAZI SOKAK
--   KOŞAR ÇIKMAZI SOKAK
--   TOPÇUOĞLU SOKAK
--   YAZICI SOKAK
--   ZİYARET SOKAK
--   ÇAMLIBEL SOKAK
--   ÇANAKKALE ŞEHİTLERİ CADDESİ
--   ÖZGÜVEN SOKAK
--   İZCİ SOKAK
update public.hane set bolge_id='5d95e810-280e-4584-8e62-823910c20cb0', grup_id='1a8f83aa-f5dd-4d32-993e-bd45c4b77c42'
 where mahalle_id='ee2e1ba2-6eb9-461a-a133-1d07d0823188' and sokak_id in (
   '77cf7df6-a03c-47bc-b8c9-924859ab7a8d',
   '3967ab50-c695-4d3d-a6b7-27e8f0a3eb21',
   'c4b0b552-01b6-447a-b014-f9abd34afe78',
   '86235ff9-42be-4894-b0a6-cbc10e3cbf86',
   '2c11fd99-7d63-4392-a51a-b1791cf67ff8',
   '8f3dc39f-d3da-455c-ae82-0ef00a4c0bad',
   'ee7ad082-0501-4cfb-aa53-1607efb99d26',
   '4db8fc8e-5ee4-4c03-9aca-60fd18ca523c',
   '0ad03a5e-c6ec-455f-819a-f367d30e21fd',
   'dc5d1bf9-390a-4af4-9e2d-10fe8011f20a',
   '0ccaa3ce-db22-410a-ae13-0da0b81196b5',
   'bfb289eb-be56-49dd-8b52-63fb035622f9',
   '10da2f3b-c5d5-4d85-8e26-f2a30c82e14c',
   'af2b66d8-7de0-4ad1-a0d2-2ddf6116c7b7',
   '55cca7ef-a84c-4255-bfc2-f66000db34a8',
   '4edac15a-a14e-4db2-9d2c-1b42cd0bd54a',
   '8c53d391-476a-4719-a622-f96987f97ffc'
 );

-- BSK-SAM-003 — 12 sokak, 60 hane
--   2828. SOKAK
--   2829. SOKAK
--   2831. SOKAK
--   2832. SOKAK
--   2834. SOKAK
--   2836. ÇIKMAZ SOKAK
--   DEĞERMİHİÇ CADDESİ
--   GİRİT ÇIKMAZI SOKAK
--   KARATAYLAR ÇİFTLİK YOLU CADDESİ
--   TERKOS ALTINŞEHİR YOLU SOKAK
--   TUĞÇE SOKAK
--   İSTİKLAL CADDESİ
update public.hane set bolge_id='9386f9dc-6b0a-4b5a-bbd5-079ea7b967f3', grup_id='bd7e8f79-128b-49d3-bcdb-3436f3ef7d3c'
 where mahalle_id='ee2e1ba2-6eb9-461a-a133-1d07d0823188' and sokak_id in (
   'c3415830-277b-4d25-8a56-ef67532838d4',
   '036e6d84-8e34-4e57-b5a3-afbce202b150',
   '74db8c63-3eb3-4e36-ba51-56098d98f594',
   '0c28073d-b2f9-4116-b9e8-528c9caded8b',
   'c5a1bad4-295f-4088-b0ad-d13ac437d71f',
   'dccb9257-4a0d-43a2-8fb3-0a281c9ddc26',
   'd72f88a5-12b9-4617-ab50-5ea145f39ebb',
   '1c702fa1-63c7-4cc8-9d1d-f9686e0e74b9',
   '778cd077-6b1f-4202-8606-373cc2e4e4af',
   '7c5a2220-0f46-4942-8f65-3412b8486a6a',
   '791779c8-b11f-412e-a889-b9c9a08fb2ac',
   '9a517519-da05-4731-9fdc-83bf18ef22fd'
 );

-- kişilerin bölgesi hanesinden türetilir
update public.kisi k set bolge_id = h.bolge_id
  from public.hane h
 where k.hane_id = h.id and h.mahalle_id='ee2e1ba2-6eb9-461a-a133-1d07d0823188';

commit;

/* =====================  DOĞRULAMA  =====================
   Çalıştırdıktan sonra bu üç sorguyu koşturun.

   1) Bölge büyüklükleri — beklenen 150 / 146 / 51 civarı:
      select b.kod, count(distinct h.sokak_id) as sokak, count(*) as hane
        from hane h join bolge b on b.id = h.bolge_id
       where h.mahalle_id = 'ee2e1ba2-6eb9-461a-a133-1d07d0823188'
       group by b.kod order by b.kod;

   2) Bölünmüş sokak kalmamalı — beklenen 0:
      select count(*) from (
        select sokak_id from hane where mahalle_id = 'ee2e1ba2-6eb9-461a-a133-1d07d0823188'
         group by sokak_id having count(distinct bolge_id) > 1) x;

   3) Kişi–hane bölge tutarlılığı — beklenen 0:
      select count(*) from kisi k join hane h on h.id = k.hane_id
       where h.mahalle_id = 'ee2e1ba2-6eb9-461a-a133-1d07d0823188' and k.bolge_id is distinct from h.bolge_id;
   ======================================================= */
