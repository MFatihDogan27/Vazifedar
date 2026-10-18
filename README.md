# Vazifedar

Öğrenci hayatı için kişisel takvim: planlar, haftalık ders programı, ödevler, tarihsiz görevler, unutmaman gerekenler ve küçük bir günlük, hepsi aynı yerde. Günün bir saat kadranı gibi görünür; Google Takvim'le eşitlenir.

- **Ücretsiz, kurulumsuz.** Tarayıcıda açılır, istersen telefona ve bilgisayara uygulama olarak yüklenir, internetsiz de çalışır.
- **Verin sende kalır.** Arkada bir sunucu yok. Yazdığın her şey kendi cihazında durur; eşitlemeyi açarsan bir kopyası da **kendi** Google hesabına gider. Uygulamayı paylaşan kişi dahil kimse senin verini göremez.

**Adres:** https://mfatihdogan27.github.io/Vazifedar/ · **Kaynak kod:** https://github.com/MFatihDogan27/Vazifedar

---

## İçindekiler

1. [Başlarken](#başlarken)
2. [Verilerin ve Google bağlantısı](#verilerin-ve-google-bağlantısı)
3. [Nasıl kullanılır](#nasıl-kullanılır)
4. [Sık sorulanlar ve sorunlar](#sık-sorulanlar-ve-sorunlar)
5. [Uygulamayı yayınlayan ve geliştiren için](#uygulamayı-yayınlayan-ve-geliştiren-için)

---

## Başlarken

### 1. Aç ve uygulama olarak yükle

Adresi aç, sonra:

| Cihaz | Nasıl yüklenir |
|---|---|
| Android (Chrome) | Menü (⋮) → **Uygulamayı yükle** ya da **Ana ekrana ekle** |
| iPhone / iPad (Safari) | Paylaş düğmesi → **Ana Ekrana Ekle** |
| Bilgisayar (Chrome / Edge) | Adres çubuğunun sağındaki **yükle** simgesi ya da Ayarlar → Uygulama → **Yükle** |

Yüklenince kendi simgesiyle ayrı pencerede açılır ve internet yokken de çalışır. Bilgisayarda simgeye sağ tıklayınca (telefonda uzun basınca) Yeni plan / Yeni görev / Takvim / Defter kısayolları çıkar.

İlk açılışta Vazifedar üç kısa soru sorar: hangi şehirde olduğun (namaz vakitleri için; istersen kapatırsın), hangi plan türlerini kullanacağın (Konser, Halısaha, Arkadaşlar, Roket takımı ya da kendi yazdığın türler) ve dönem tarihlerin. Hepsini atlayabilir, sonra Ayarlar'dan değiştirebilirsin. Vazifedar'ı başka bir cihazda zaten kullanıyorsan atla ve aynı Google hesabıyla bağlan; verilerin gelir.

### 2. Dönemini ve derslerini gir

**Dersler** sekmesi (sayfanın adı **Ders programı**):

1. **Dönem** kutusuna **Dönem başlangıcı** ve **Dönem sonu** tarihlerini yaz. Bayram ve ara tatil gibi günleri **Tatil ekle** ile ekle; o günlerde ders görünmez.
2. En kolayı **Programı yapıştır**: okulun öğrenci sistemindeki haftalık ders programı tablosunu (Saat, Pazartesi, Salı… sütunları) seçip kopyala, kutuya yapıştır. Dersler, günler, saatler ve derslikler çıkarılır; ardışık saatler tek oturum olur (10:30–11:20 + 11:30–12:20 → 10:30–12:20). Ne bulunduğu önizlemede görünür (yeni / güncellenecek / aynı); onaylayınca kurulur. TOBB ETÜ derslerinin adı ve konuları müfredattan gelir. Kodu zaten olan dersin yalnız saatleri güncellenir (devamsızlık ve iptal işaretleri yerinde kalır), programda olmayan derslere dokunulmaz. Dönem başında yeni programı yapıştırmak da böyle çalışır.
   Elle girmek istersen **+ Ders ekle** ile her dersi bir kez gir: kod, ad, hoca, renk ve oturumlar (gün, saat, derslik, Teori / Lab / PS). Bir dersin birden çok oturumu olabilir.
3. İstersen **devamsızlık hakkını** da yaz. "Dönemin %30'u" düğmesi bir öneri hesaplar; asıl oranı kendi yönetmeliğinden kontrol et.
4. TOBB ETÜ'deysen ders kodunu yazman yeter: dersin adı ve işlenecek **konuları** okulun müfredatından kendiliğinden gelir (bkz. [Ders konuları](#ders-konuları)).

Dersler artık dönem boyunca her hafta takvimde ve Bugün ekranının kadranında görünür. Dersler sayfasındaki **Haftalık çizelge** telefonda takvimdeki gibi mercek düzenindedir: üstteki halkalar o günün derslerini (ortada ders sayısı) gösterir, altta günler yana kayar ve her derste kod, ad, saat ve derslik okunur.

### 3. İlk planını yaz

Üstteki hızlı ekleme kutusuna düz Türkçe yaz ve Enter'a bas:

```
cuma 20:00 halısaha
```

Yazarken ne anlaşıldığı kutunun altında görünür. Daha fazla örnek [aşağıda](#plan-eklemek).

### 4. Verini koruma altına al (önemli)

Her şey yalnız bu tarayıcıda durur. Tarayıcı verisi silinirse ya da telefon değişirse kaybolmasın diye **en az birini** yap:

- **Google'a bağlan** (önerilir). Planların Google Takvim'ine, geri kalan her şey Google Drive'ındaki gizli bir klasöre gider. Diğer cihazların da aynı veriyi görür. [Nasıl yapılır →](#google-takvime-bağlanmak)
- **Otomatik yedeği aç.** Bilgisayarda (Chrome / Edge) Ayarlar → Veriler ve yedek → **Yedek klasörü seç**. Google Drive ya da OneDrive klasörünü seçersen yedek buluta da gider. Telefonda klasöre yazılamaz; Vazifedar 7 günde bir **Yedek indir** diye hatırlatır.

### 5. Kendine göre ayarla

**Ayarlar**'ın en üstündeki halka neyin eksik kaldığını gösterir (ör. "2/4") ve eksik olanın yanındaki düğme onu oradan çözer. Ayrıca bak:

- **Kategoriler**: Hazır gelen plan türleri Sınav, Konser, Halısaha, Arkadaşlar, Roket takımı, Görev zamanı ve Diğer. Sana uymayanları değiştir ya da sil, kendi türlerini ekle (renk, ikon, varsayılan süre, hatırlatma). Görev türleri de buradan değişir.
- **Hatırlatmalar**: Bildirimlere izin ver. Dersten kaç dakika önce (adı ve dersliğiyle) hatırlatılacağı, yarının çantasının ve akşam bildiriminin saatleri de burada.
- **Namaz vakitleri**: Şehrini seç (varsayılan Ankara) ya da istemiyorsan kapat.
- **Görünüm**: Renk temaları (Firuze, Mercan, Kobalt, Safran, Mürdüm, Mürekkep ya da kendi rengin) ve açık/koyu mod.
- **Gün saatleri**: Takvimde hangi saatlerin görüneceği ve görevlerin hangi saatler arasına yerleştirileceği.

---

## Verilerin ve Google bağlantısı

### Veriler nerede durur

| Ne | Nerede |
|---|---|
| Her şey | Cihazının tarayıcısında (`localStorage`) |
| Planlar | Google'a bağlıysan Google Takvim'inde de (seçtiğin takvimde) |
| Dersler, görevler, ödevler, devamsızlık, unutma notları, defter, kadran arşivi, kategoriler | Google'a bağlıysan Google Drive'ındaki gizli uygulama klasöründe tek bir dosyada. Bu klasörü yalnız Vazifedar görür; Drive'ında dosya olarak çıkmaz. |
| Görünüm, bildirim, namaz vakti ayarları | Yalnız o cihazda |

Uygulamanın sitesinde (GitHub Pages) yalnızca **kod** var; veri yok.

### Google Takvim'e bağlanmak

Bağlanmak için bir **istemci kimliği** gerekir (`…apps.googleusercontent.com` ile biten uzun bir metin). İki yol var:

**A) Uygulamayı paylaşan kişinin kimliğiyle (kolay yol)**

1. Ona Gmail adresini ver. Seni Google tarafında **test kullanıcısı** olarak eklemesi gerekiyor; eklenmeden bağlanmayı denersen Google "Erişim engellendi" der.
2. Senden istemci kimliğini iste.
3. Vazifedar → Ayarlar → Google Takvim → **OAuth istemci kimliği** kutusuna yapıştır → **Kaydet** → **Google ile bağlan**.
4. Google "**Google bu uygulamayı doğrulamadı**" diye uyarır. Bu, uygulamanın kişisel bir proje olduğu ve Google'ın resmî incelemesinden geçmediği anlamına gelir. **Gelişmiş → Vazifedar'a git** de.
5. İzinleri onayla:
   - *Takvim etkinliklerini görme ve düzenleme*: planları eşitlemek için.
   - *Google Drive'daki kendi uygulama verisi*: yalnız Vazifedar'ın gizli klasörü. Drive'ındaki diğer dosyalarını göremez.

Bu kimlikle bağlanman paylaşan kişiye senin verine erişim **vermez**. Bağlantı tamamen senin tarayıcınla Google arasında kurulur.

**B) Kendi kimliğinle (bağımsız yol)**

Kimseye bağlı kalmak istemiyorsan aşağıdaki [Google Cloud kurulumu](#google-cloud-kurulumu-bir-kerelik)'nu kendin yap. Yaklaşık 10 dakika sürer ve ücretsizdir.

### Eşitleme nasıl çalışır

- Google Takvim'indeki etkinlikler (son 60 gün ile önümüzdeki 1 yıl) Vazifedar'a gelir. Kategori başlıktan tahmin edilir: "vize", "final" → Sınav; "konser" → Konser; "halısaha", "maç" → Halısaha …
- Vazifedar'da eklediğin, değiştirdiğin ve sildiğin planlar Google'a gider. Bunu plan formundaki "Google Takvim ile eşitle" kutusu belirler. Telefonundaki takvim uygulaması da bunları gösterir.
- Ders programını istersen Google'a haftalık tekrarlayan etkinlikler olarak aktarabilirsin: Dersler → Google Takvim → **Google Takvim'e aktar**. Bir kez aktardıktan sonra ders, oturum, tatil ya da iptal değiştikçe Google'daki program kendiliğinden güncellenir. Kaldırmak için **Google'dan kaldır** de.
- **Ödev teslimleri** de Google Takvim'e gider: teslim saatinde biten kısa bir etkinlik olarak, 1 gün ve 3 saat önce hatırlatmayla. Böylece telefonundaki takvimde görünür ve Vazifedar kapalıyken de hatırlatılır. Ödevi tamamlayınca başına ✓ gelir ve hatırlatması kalkar; silince Google'dan da silinir. Ayarlar → Google Takvim → **Görevler Google Takvim'de** kısmından son tarihli görevleri de gönderebilir (tüm gün, bir gün önce sabah 9'da hatırlatır) ya da hiçbirini göndermeyebilirsin. Bu seçim cihaza özeldir.
- Ödevlerin ve derslerin Google'daki kopyalarını Vazifedar'dan değiştir. Google'da elle değiştirdiğin ya da sildiğin bir kopya bir sonraki eşitlemede Vazifedar'daki hâline döner.
- Eşitleme kendiliğinden 10 dakikada bir, uygulamaya geri döndüğünde ve bir değişiklikten birkaç saniye sonra çalışır. Üst çubuktaki eşitleme düğmesine basarak elle de eşitleyebilirsin.
- Bir görev, ders ya da not iki cihazda birden değiştiyse alan alan birleşir: telefonda bir görevi tamamlayıp bilgisayarda başlığını düzelttiysen ikisi de kalır. Aynı şeyi (ör. aynı görevin başlığını) iki yerde farklı değiştirdiysen en son yapılan değişiklik kazanır. Bir cihazda silinip öbüründe değiştirilen kayıt silinmez. İlk eşitlemede hiçbir şey silinmez, iki taraf birleşir.
- Bir değişiklik tarayıcıya kaydedilemezse (depolama dolu ya da kapalı) Vazifedar uyarır ve **Yedek indir** düğmesi gösterir.
- Google oturumu yaklaşık 1 saatte bir (telefonda uygulama her açıldığında da) yenilenmek ister. Vazifedar bunu uygulamaya ilk dokunuşunda kendiliğinden yapar: Google penceresi bir an açılıp kapanır. İstemezsen Ayarlar → Google Takvim'den kapat; o zaman üst çubuktaki **Yeniden bağlan**'a basarsın.
- Uygulamaya geri döndüğünde (telefonda arka plandan, bilgisayarda başka pencereden) ekran tazelenir ve son eşitlemenin üstünden 2 dakika geçtiyse eşitlenir.

### Yedek

Google eşitlemesi bir yedek değildir: yanlışlıkla sildiğin bir şey oradan da silinir.

- **Bilgisayarda otomatik:** Ayarlar → Veriler ve yedek → **Yedek klasörü seç**. Vazifedar her gün o klasöre `vazifedar-yedek-YYYY-AA-GG.json` yazar. Son 30 günün yedeği ve daha eskilerden her ayın ilk yedeği tutulur; klasördeki başka dosyalara dokunmaz. Tarayıcı yeniden açılınca klasör iznini yeniden isteyebilir: üstte sarı şerit çıkar, **İzin ver**'e bas.
- **Elle:** Ayarlar → Veriler ve yedek → **Yedek indir** / **Yedekten yükle**. Planlar, dersler, görevler, notlar, defter, kadran arşivi ve ayarlar yedeğe dahildir.
- Yedek dosyası günlüğün dahil her şeyini içerir. Kimseyle paylaşma, herkese açık bir yere yükleme.

---

## Nasıl kullanılır

### Bugün ekranı ve kadran

Uygulama bu ekranla açılır.

- **Kadran**: Günün 24 saati bir saat kadranı gibi dizilir; öğlen tepede, gece yarısı altta. Dersler ve planlar halkada kendi renkleriyle dilim olarak durur. Uyku saatleri gri, geçen kısım dıştaki çizgiyle, şu an ibreyle gösterilir. İç taraftaki noktalı yay günün en uzun boşluğudur, ince iç halka da gündüzü ve geceyi gösterir.
- Kadranın ortasında saat ile şu anki ya da sıradaki kayıt ve kaç dakika kaldığı yazar. Bir dilime ya da ortaya dokunmak o kaydı açar.
- **Geri sayımlar**: En yakın iki sınav ya da teslim büyük bloklar olarak durur ve türüne göre kılık değiştirir. Sınav bir optik formdur (kalan her gün bir dolu baloncuk), ödev kareli bir kâğıt, konser bir bilet.
- **Günün akışı**: Günün kalan kayıtları; şu anki kaydın altında ilerleme çubuğu var. Devamsızlık sınırına yaklaşan dersler de burada uyarılır.
- **Görev rafı**: Açık görevlerin fiş fiş dizili hâli. Ayrıntısı [Görevler](#görevler-ve-ödevler)'de.
- **Bugün unutma / Yarının çantası**: Ayrıntısı [Unutma notları](#unutma-notları-ve-yarının-çantası)'nda.
- **Bu hafta** kartı: Günlere göre yük, kategori başına saat, tamamlanan görevler, en dolu gün ve gelecek haftanın yükü.
- **Namaz vakitleri** kadranın altında durur; sıradaki vakte kalan süre de yazar. Ayarlar'dan kapatılabilir.

### Plan eklemek

**Hızlı ekleme kutusu** (üst çubukta, klavyede `/`): Düz Türkçe yaz, Enter'a bas. Shift+Enter aynı bilgilerle formu açar.

| Yazdığın | Ne olur |
|---|---|
| `cuma 20:00 halısaha` | Bu cuma 20:00–21:00, Halısaha |
| `her salı 21-23 halısaha @Gölbaşı` | Her salı tekrarlayan plan, konum Gölbaşı |
| `28 ekim 13:30 elektronik vize` | Sınav (2 saat, 1 gün önce hatırlatma) |
| `yarın akşam 8 arkadaşlarla kahve` | Yarın 20:00, Arkadaşlar |
| `haftaya pazartesi saat 3 toplantı 2 saat` | Gelecek haftanın pazartesisi 15:00–17:00 |
| `her pazartesi ve çarşamba 18:00 spor dönem sonuna kadar` | Dönem bitişine kadar haftada iki gün |
| `ELE 271 ödev 3 cuma 17:00` | ELE 271 dersine bağlı ödev, teslim cuma 17:00 |
| `ELE 271 föy her salı 17:00` | Her salı 17:00 teslim edilen tekrarlayan ödev, dönem sonuna kadar |
| `bu cuma 19-22 #roket test` | `#` ile kategori seçilir |

Tanıdığı ifadeler: bugün, yarın, öbür gün, haftaya/önümüzdeki + gün adı, "3 gün sonra", "15 ekim", "15/10", "20:00", "20.30", "14-16", "sabah/öğlen/akşam/gece 8", "2 saat", "90 dk", "tüm gün", "her gün/hafta/ay", "her salı ve perşembe", "iki haftada bir", "… kadar". Konum `@`, kategori `#` ile yazılır.

Başka yollar:

- **+ Plan ekle** düğmesi ya da `N` tuşu formu açar.
- Haftalık takvimde boş bir saate tıklamak o saatte yeni plan açar; aşağı sürüklersen saat aralığı seçersin.
- Bir planı tutup başka bir saate ya da güne **sürükleyerek taşıyabilir**, alt kenarından çekip uzatabilirsin. **Geri al** ile geri alınır.

**Tekrarlayan planlar**: Formdaki "Tekrar" kısmından her gün, her hafta (birden çok gün seçilebilir), her ay ya da her yıl seçilir; "2 haftada bir" gibi bir aralık ve isteğe bağlı bitiş tarihi de verilebilir. Serideki bir tekrarı düzenlerken "Yalnız bu / Tüm seri", silerken "Yalnız bu / Bu ve sonrakiler / Tüm seri" sorulur. Takvimde ↻ işaretiyle görünür.

**Çakışma uyarısı**: Yeni plan başka bir plan ya da dersle çakışıyorsa Vazifedar uyarır, çakışan kayıtları listeler ve ilk boş zamanı önerir. "Yine de ekle" de diyebilirsin. Takvimde çakışan iki kayıt, birbirine zımbalanmış iki kâğıt gibi görünür.

### Takvim

Hafta, Ay ve Ajanda görünümleri vardır (`H`, `A`, `J` tuşları ya da üstteki seçim).

- **Esnek saat ekseni**: Kaydı olan saatler tam boyda, boş saatler ince durur; uyku saatleri tek bir gece şeridinde toplanır. Sağ üstteki düğmeyle düz eksene dönebilirsin.
- **Gün halkaları**: Her günün tarihi kendi küçük kadranının ortasında yazar. Ay evreleri, kandiller ve bayramlar da gün başlığında görünür.
- **Boşluk cepleri**: 1 saatten uzun boşluklar "2 sa 40 dk boş" gibi bir etiketle işaretlenir. Etikete tıklayınca o boşluğa sığan görevler listelenir; birine tıklarsan oraya yerleşir.
- **Damgalar**: Geride kalan planlar solar ve köşesine pul basılır. İşlenen derslere mühür, gidilmeyen derslere kırmızı "GİTMEDİM" damgası vurulur.
- **Hicri takvim**: Ay görünümünün üstünde hicri aylar, kandiller, Ramazan ve bayramlar görünür. Diyanet takvimiyle bir gün fark olabilir.
- **Telefonda hafta (mercek)**: Telefonda yedi gün yan yana sığmadığı için hafta iki buçuk günlük geniş sütunlarla gösterilir; parmakla sağa sola kaydırırsın, her kaydırmada bir güne oturur. Üstteki şeritte haftanın yedi gün halkası durur: halkalar o günün ne kadar dolu olduğunu gösterir, mercek o an ekranda olan günlerin üstüne kayar, bir halkaya dokununca o güne gidersin. Sütun başlığında gün adı, tüm gün planları ve ödev teslimleri; kayıtlarda ad, saat ve yer okunur. Saat cetveli ve başlıklar kaydırırken yerinde kalır. Telefonu yan çevirince ya da tablette yedi sütunlu görünüme döner.
- **Yakınlaştırarak gezinme**: Ctrl + fare tekerleği (dokunmatik yüzeyde kıstırma) ya da `+` / `−` ile Dönem haritası ⇄ Ay ⇄ Hafta ⇄ Gün arasında gidilir.

### Dersler ve devamsızlık

- Bir derse gitmediğinde takvimde o derse dokun ve **Gitmedim** de. Gelecekteki bir ders için **Gitmeyeceğim** de. 09:30–11:20 gibi bir oturum 2 ders saati sayılır.
- Birden çok saatlik bir derste yalnız bir saate gitmediysen ders penceresindeki **Gitmediğin saatler** düğmelerinden o saati seç (ör. **2. saat · 11:30–12:20**); yalnız o saat devamsızlık sayılır. Takvimde "1 SAAT YOK" damgası çıkar. Bütün saatler için **Hiç gitmedim**, işareti kaldırmak için **Gittim** de. (Devamsızlığı "ders (oturum)" olarak sayan derslerde saat seçimi çıkmaz.)
- Kullanılan ve kalan hak Dersler sayfasında ve ders penceresinde görünür. Hakkın %75'ine gelince Bugün ekranında uyarı çıkar.
- O hafta yapılmayacak bir ders için derse dokunup **Bu haftaki dersi iptal et** de.
- **Dönem** sekmesi (Dönem haritası) dönemin tamamını tek ekranda gösterir: sınavlar, teslimler, tatiller ve haftalık yük grafiği (yoğun haftalar kırmızı).

### Ders konuları

Her dersin işlenecek konuları Dersler sayfasındaki **Konular** panelinde durur; çalıştıkça bitirdiğin konuyu işaretlersin.

- **Kendiliğinden gelir**: Ders kodu TOBB ETÜ müfredatında varsa (ELE 224, MAT 202, HUK 101, PSİ 103, MİM 201…) konular okulun ders sayfasındaki haftalık plandan (ABYS → "Referans Ders Çizelgesi") alınır. Bütün fakülteler var: Mühendislik, İktisadi ve İdari Bilimler, Hukuk, Mimarlık ve Tasarım, Fen Edebiyat, Tıp (yaklaşık 960 ders). Arka arkaya aynı konunun işlendiği haftalar tek konu olur: "Diyot Devreleri · 4–5. hafta". Kodu yazarken boşluk, büyük-küçük harf ya da İ/I farkı önemli değil.
- **İşaretlemek**: Her dersin kartında ilerleme halkası (bitti / toplam) ve sıradaki konu var. Sağdaki yuvarlağa dokununca sıradaki konu biter. Karta dokununca bütün konular açılır; istediğini işaretle ya da işareti kaldır. Bütün konular bitince kart dersin rengine boyanır.
- **Programla karşılaştırma**: Dönem başlangıcı girildiyse panel dönemin kaçıncı haftasında olduğunu yazar, o haftanın konusu "bu hafta" diye işaretlenir. Takibe başladığın bir derste geçen haftaların bitmemiş konuları "2 konu geride" diye, sırası gelmeden bitirdiklerin "programın önünde" diye görünür. Bir haftalık ara tatil programı bir hafta kaydırır.
- **Takvimden**: Takvimde bir derse dokununca açılan pencerede o haftanın konusu ve sıradaki konun var; dersten çıkınca oradan da işaretleyebilirsin.
- **İçeriği getir**: Ders formunda kod kutusunun yanındaki düğme (ya da kod kutusunda Enter). Ders müfredatta varsa konular ve boşsa dersin adı gelir; konular zaten varsa yenilenir, bitirdiklerin işaretli kalır. Yoksa yapıştırma kutusu açılır ve okulun ders sayfasına bağlantı çıkar.
- **Düzenlemek**: Dersi düzenle → **Konular**: konu ekle, sil, yukarı taşı, başlığını ya da haftasını ("4" ya da "4-5") değiştir. Hocan farklı sırayla anlatıyorsa böyle uydur. **İçeriği getir** konuları yeniden getirir; bitirdiklerin işaretli kalır, kendi eklediklerin sona geçer.
- **Yapıştırarak**: Dersi düzenle → Konular → **Yapıştır**. Ders sayfasındaki (ya da hocanın izlencesindeki) haftalık planı kopyalayıp kutuya bırak; Vazifedar haftaları ayırıp konuları yerleştirir, ne bulduğunu altında gösterir. "1. Hafta: …", "Hafta 1 – …", tablodan kopyalanmış "1 ⇥ konu", numarasız liste olur. "Fonksiyonlar (devam)" gibi satırlar önceki konuyla birleşir (Fonksiyonlar · 7–8. hafta). Var olan konuların yerine geçer; bitirdiklerin aynı adla duruyorsa işaretli kalır.
- Kodu müfredatta olmayan derslerin (okulun haftalık plan yayımlamadığı seçmelilerin çoğu, Matematik bölümüne özgü dersler, başka okullar) konularını yapıştırarak ya da tek tek eklersin; panelin altındaki "Konusu olmayan" satırından o derse gidebilirsin.
- Konular dersin parçasıdır; Google'a bağlıysan öteki cihazlarına da gider.

### Görevler ve ödevler

- **Görevler** belirli bir güne bağlı olmayan "bir ara yapılacak" işlerdir. Dört öncelik (Acil, Yüksek, Orta, Düşük) sütun olarak durur; bilgisayarda kartı sürükleyerek önceliğini değiştirirsin. Telefonda göreve **basılı tut** (bilgisayarda sağ tık): öncelik seçimi, **Takvime yerleştir** ve **Düzenle** çıkar. Kategori, son tarih, tahmini süre ve not eklenebilir. Klavyede `G` yeni görev açar.
- **Ödev**: Görev formunda bir ders seçince görev ödeve dönüşür ve teslim saati sorulur. Ödev takvimde teslim gününde, Dersler sayfasında ve Bugün ekranındaki geri sayımda görünür. Teslimden 24 saat ve 3 saat önce hatırlatılır. Google'a bağlıysan ödev telefonundaki takvime de gider ve uygulama kapalıyken de hatırlatılır. Hızlı ekleme kutusuna ders koduyla "ödev, proje, rapor, föy, teslim" yazarsan doğrudan ödev olarak eklenir.
- **Tekrarlayan ödev ve görev**: Formdaki **Tekrar** kısmından her hafta, 2 haftada bir, her gün ya da her ay seç (ödevde bitiş kendiliğinden dönem sonu olur). Hızlı eklemede "ELE 271 föy her salı 17:00" yazman yeter. Ekranda hep sıradaki tekrar durur; tarihi geçince bir sonraki kendiliğinden eklenir (salı teslimli föyün bir sonrakisi çarşamba görünür). Kartta ↻ işaretiyle görünür. Bir tekrarı düzenlersen ad, öncelik, ders, saat ve not sonrakilere de geçer. Silerken **Yalnız bunu sil** (seri sürer) ya da **Seriyi bitir** (açık tekrarlar silinir, tamamlananlar kalır) seçersin. Tekrar kısmını "Tekrarlanmaz" yaparsan seri biter, o görev yerinde kalır. Her ayın 31'i gibi her ayda olmayan bir gün seçersen o gün olmayan aylar atlanır.
- **Görev rafı** (Bugün ekranında): Her görev bir fiştir. Renkli koçan önceliği, üstündeki yazı da ne kadar zaman kaldığını gösterir. **Boşluğa koy** görevi bugünkü en uzun boşluğa yerleştirir; sığmıyorsa takvim düğmesi ilk uygun boş zamanı bulur. Yük çubuğu açık görevlerinin bu haftaki boş zamanına sığıp sığmadığını söyler.

### Unutma notları ve yarının çantası

Saate değil bir şeye bağlı küçük notlardır: "Lab'a multimetre götür", "halısahaya krampon".

- Takvimde bir derse ya da plana dokun ve pencerenin "Unutma" kısmına yaz. Ne zaman çıkacağını seç: yalnız bu sefer, o dersin her Lab oturumunda, her Halısaha planında…
- Defter sayfasındaki **+ Unutma notu** ile bir derse, bir plan türüne, bir plana ya da bir güne not bağlayabilirsin.
- "Bir sonraki sefer" notu o ders ya da plan gelene kadar bekler. Güne bağlı bir not işaretlenmeden günü geçerse "Kalanlar"a düşer.
- **Yarının çantası**: Gündüz Bugün ekranında "Bugün unutma" kartı durur. Akşam (varsayılan 18:00'den sonra) kart koyulaşır ve yarınki her dersi ve planı, altında götürmen gerekenlerle listeler. Hazırladıkça tikle ("2/3 hazır"). Akşam 21:00'de işaretlenmemiş not varsa bildirim gelir, ayrıca dersten 1 saat önce o dersin notları hatırlatılır. Saatler Ayarlar → Hatırlatmalar'dan değişir.

### Defter

Kadran arşivi ve günlüktür.

- Ay sayfasında her gün küçük bir halka olarak durur: o günün kadranı. Ortası koyu olan günlere defter yazılmıştır, iğne rozeti olan günlerde not vardır.
- Bir güne dokunduğunda o günün sayfası açılır: büyük kadran, o gün olanlar, bitirdiğin görevler, notlar ve çizgili kâğıtta günlük yazın. Yazdıkça kendiliğinden kaydedilir.
- **Pullar** görünümünde geçen her güne, o gün en çok zaman ayırdığın şeyin pulu basılır.
- Defter Google Takvim'e gitmez. Google bağlıysa gizli Drive klasörüne, ayrıca yedeğine girer.

### Arama

Büyüteç, `Ctrl+K` ya da `F` arama penceresini açar. Planlarda, görevlerde, derslerde, notlarda ve defterde birlikte arar. Türkçe harflere takılmaz: "halisaha" yazsan da "Halısaha"yı bulur. "15 kasım" ya da "cuma" gibi tarihle de arayabilirsin. Bir sonuca dokunmak onu açar, takvim simgesi takvimde o haftaya götürür.

### Hatırlatmalar

- Vazifedar açıkken (arka planda olsa da) sistem bildirimi gelir. İzin vermezsen uygulama içinde uyarır.
- **Uygulama tamamen kapalıyken Vazifedar bildirim gönderemez.** Telefonda kapalıyken de hatırlatma almak için Google Takvim eşitlemesini aç: planların ve ödev teslimlerinin hatırlatmaları Google'a da gider, telefonun takvim uygulaması hatırlatır. Unutma notları, namaz ve cuma hatırlatmaları yalnız Vazifedar açıkken gelir.
- Namaz vakti hatırlatması (vakit girince ya da 5–45 dk önce) Ayarlar → Namaz vakitleri'nden açılır.
- **Ders hatırlatması**: Her dersten önce (varsayılan 10 dk) dersin adı ve dersliğiyle bildirim gelir: "ELE 224 – Elektronik Devreler · Derslik: B-301 · 10:30, 10 dk sonra". "Gitmedim" dediğin dersler ve tatil günleri hatırlatılmaz. Süreyi Ayarlar → Hatırlatmalar'dan değiştir ya da kapat. Ders programını Google Takvim'e aktardıysan aynı hatırlatma oradaki derslere de konur; telefonun takvimi Vazifedar kapalıyken de hatırlatır (istemezsen "Google Takvim'deki derslere de koy"u kapat).
- **Cuma namazı hatırlatması**: Yalnız cuma günleri, cuma vaktinden (öğle vakti) önce bildirim gelir: vakit girince ya da 15 dk–1,5 saat önce. Ayarlar → Namaz vakitleri'nden açılır; vakitleri göstermeyi kapatsan da çalışır. Öğle hatırlatman da açıksa cuma günü onun yerine bu gelir. Yalnız Vazifedar açıkken (ya da arka plandayken) gelir.

### Klavye kısayolları (bilgisayarda)

| Tuş | İşlev |
|---|---|
| `/` | Hızlı ekleme kutusu |
| `Ctrl+K` ya da `F` | Ara (`↑`/`↓` gez, `Enter` aç, `Shift+Enter` takvimde göster, `Tab` grup değiştir) |
| `N` | Yeni plan (Görevler sayfasında yeni görev) |
| `G` | Yeni görev |
| `T` | Takvimde bugüne dön |
| `←` / `→` | Önceki / sonraki hafta (ay) |
| `A` / `H` / `J` | Ay / Hafta / Ajanda görünümü |
| `+` / `−`, Ctrl + tekerlek | Yakınlaş / uzaklaş (Dönem ⇄ Ay ⇄ Hafta ⇄ Gün) |

---

## Sık sorulanlar ve sorunlar

**Google "Erişim engellendi: … doğrulama sürecini tamamlamadı" diyor.**
Test kullanıcısı olarak eklenmemişsin. Uygulamayı paylaşan kişiden Gmail adresini eklemesini iste ya da [kendi kimliğini](#google-cloud-kurulumu-bir-kerelik) oluştur.

**"Google bu uygulamayı doğrulamadı" uyarısı tehlikeli mi?**
Hayır. Uygulama kişisel bir proje olduğu ve Google'ın resmî incelemesinden geçmediği için çıkar. **Gelişmiş → Vazifedar'a git** ile devam edebilirsin.

**Üst çubukta "Yeniden bağlan" yazıyor.**
Google oturumu yaklaşık 1 saatte bir yenilenmek ister. Normalde uygulamaya ilk dokunuşunda kendiliğinden yenilenir. Google penceresini kapattıysan ya da bu özellik kapalıysa yazıya tıkla, yenilenir. Pencere hiç açılmıyorsa tarayıcının açılır pencere engelleyicisine bak.

**Telefonda başka, bilgisayarda başka şeyler görünüyor.**
İki cihazı da aynı Google hesabıyla bağla. Planlar Google Takvim, geri kalanlar Drive üzerinden birleşir. Görünüm ve bildirim ayarları her cihazda ayrıdır.

**"Yeni sürüm hazır — Güncelle" çıktı.**
Uygulamanın yeni bir sürümü yayınlanmış demektir; bas. Verilerin olduğu yerde kalır. Bildirimi kaçırırsan Ayarlar → Uygulama → **Güncellemeleri denetle**. Hâlâ eski görünüyorsa **Yine de yenile**.

**Verilerim kayboldu.**
Aynı tarayıcıda ve aynı adreste misin? Veriler adres ve tarayıcı başına tutulur. Google bağlıysan yeniden bağlanınca geri gelir. Değilse Ayarlar → Veriler ve yedek → **Yedekten yükle** ile son yedeğini yükle.

**iPhone'da yedek klasörü seçemiyorum.**
Safari klasöre yazmayı desteklemiyor. Google'a bağlan ya da ara sıra **Yedek indir** de.

**Hazır kategoriler bana uymuyor.**
İlk açılıştaki kurulumda istemediklerini kaldırıp kendi türlerini ekleyebilirsin. Sonradan Ayarlar → Kategoriler'den değiştir ya da sil.

---

## Uygulamayı yayınlayan ve geliştiren için

Bu bölüm uygulamayı kendi bilgisayarında çalıştıran, GitHub'a yükleyen ya da arkadaşlarına açan kişi içindir. Kod üzerinde çalışırken bakılacak teknik notlar **`CLAUDE.md`**'de.

### Bilgisayarda yerel çalıştırma

1. Klasördeki **`baslat.bat`**'a çift tıkla. Küçük bir yerel sunucu açılır ve tarayıcıda `http://localhost:8080` görünür. Elle başlatmak istersen `python sunucu.py` ya da `node server.js` de olur.
2. Bir kez açıp uygulama olarak yüklediğinde siyah pencereye bir daha gerek kalmaz.
3. Kodu değiştirdiğinde bir kez `baslat.bat` ile aç; uygulama yeni dosyaları alır ve "Vazifedar güncellendi" der.

`index.html`'e doğrudan çift tıklamak işe yaramaz: tarayıcılar `file://` üzerinden modül yüklemez, Google girişi de bir web adresi ister.

### GitHub Pages'te yayınlamak

Telefon bilgisayardaki `localhost`'a erişemediği için uygulama GitHub Pages'te yayınlanır. Yayınlanan yalnızca koddur.

> ⚠️ **`yedekler` klasörünü, `vazifedar-yedek-*.json` dosyalarını ve `_yedek_…` klasörlerini asla yükleme.** Yedekler defter dahil tüm kişisel verini içerir ve depo herkese açıktır. Git kullanırsan `.gitignore` bunları dışarıda bırakır; tarayıcıdan sürükle-bırak yaparken dikkat et.

1. github.com → **New repository** → ad: `Vazifedar` (büyük V ile; adres büyük-küçük harfe duyarlıdır), **Public** → *Create repository*.
2. **uploading an existing file** → şunları sürükle: `index.html`, `manifest.webmanifest`, `sw.js`, `.nojekyll`, `README.md` ve `css`, `js`, `icons` klasörleri → *Commit changes*.
3. **Settings → Pages** → *Deploy from a branch* → `main`, `/ (root)` → *Save*. Bir iki dakika sonra adres hazır olur: `https://mfatihdogan27.github.io/Vazifedar/`

**Güncellemek:** Değişen dosyaları aynı ekrandan yeniden yükle (üstüne yazar). Kullanan herkesin uygulaması en geç 10 dakika içinde "Yeni sürüm hazır" der. Sürüm numarası artırmak gerekmez. Yeni bir JS dosyası eklediysen `sw.js`'teki listeye de yaz.

Hatalı bir güncelleme herkesi etkiler. Büyük değişiklikleri önce `localhost`'ta dene.

### Google Cloud kurulumu (bir kerelik)

1. [Google Cloud Console](https://console.cloud.google.com/projectcreate)'da yeni bir proje oluştur (ör. "Vazifedar").
2. [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com) ve [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com)'yi etkinleştir.
3. **Google Auth Platform** (OAuth izin ekranı): uygulama türü *External*. **Audience → Test users** kısmına kendi Gmail adresini ekle.
4. **Clients** → *Create client* → tür **Web application**.
5. **Authorized JavaScript origins**: `http://localhost:8080` ve `https://mfatihdogan27.github.io` (sonunda `/Vazifedar` olmadan). Kendi deponu kullanıyorsan kendi `https://<kullanıcı-adın>.github.io` adresini yaz.
6. Oluşan istemci kimliğini Vazifedar → Ayarlar → Google Takvim kutusuna yapıştır → **Kaydet** → **Google ile bağlan**.

### Arkadaşlarını eklemek

1. Google Cloud Console → **Google Auth Platform → Audience → Test users** → **Add users** → arkadaşının Gmail adresi → *Save*. Test modunda en fazla 100 kişi eklenebilir.
2. Ona uygulama adresini ve istemci kimliğini gönder; gerisi yukarıdaki [A yolu](#google-takvime-bağlanmak).

İstemci kimliği gizli bir bilgi değildir; her web uygulamasında açıkça görünür. Yine de herkese açık bir yere yazmana gerek yok. Arkadaşlarının verisini göremezsin: her biri kendi Google hesabıyla, kendi tarayıcısından bağlanır.

Uyarı ekranı olmadan herkese açmak istersen Google'ın uygulamayı doğrulaması gerekir, çünkü Takvim izni hassas izinlerden sayılır. Birkaç arkadaş için buna gerek yok.

### Dosyalar

```
index.html            Uygulama kabuğu
manifest.webmanifest  Uygulama olarak yükleme bilgileri (ad, simgeler, kısayollar)
sw.js                 Service worker: internetsiz açılış, güncelleme, bildirime tıklama
icons/kadran*         Uygulama simgeleri (koyu zeminde saat kadranı)
css/style.css         Görünüm "Kadran" (açık/koyu tema, mobil düzen)
css/takvim.css        Takvim sekmesi: esnek eksen, boşluk cepleri, damgalar, zımba, yakınlaştırma
js/app.js             Üst çubuk, gezinme, araç çubuğu, otomatik işler
js/store.js           Veri modeli, localStorage, çakışma ve boş zaman hesapları
js/ui.js              DOM, pencere, bildirim yardımcıları
js/dates.js           Tarih yardımcıları
js/recurrence.js      Tekrar kuralları (açılım, açıklama, Google RRULE)
js/calendar.js        Hafta / Ay / Ajanda görünümleri
js/today.js           Bugün ekranı (kadran, geri sayım, günün akışı, görev rafı)
js/notes.js           Unutma notları, yarının çantası
js/journal.js         Defter: kadran arşivi, gün sayfası, günlük, pul albümü
js/tasks.js           Görev panosu, öncelik menüsü, tekrar etiketi
js/courses.js         Ders programı sayfası
js/ttimport.js        Ders programını yapıştırarak kurma (haftalık program tablosunu ayrıştırır)
js/topics.js          Ders konuları: müfredattan getirme, işaretleme, Konular paneli, konu düzenleyici
mufredat/tobb-etu.json  TOBB ETÜ derslerinin haftalık konuları (ABYS'den çekilmiş)
mufredat/guncelle.mjs   Müfredatı okulun sitesinden yeniden çeker (node mufredat/guncelle.mjs)
mufredat/github-eylemi.yml  İstenirse GitHub'ın bunu ayda bir yapması için (.github/workflows/'a kopyalanır)
js/term.js            Dönem haritası
js/forms.js           Plan, ders, görev/ödev formları; çakışma; devamsızlık; takvime yerleştirme
js/quickadd.js        Hızlı ekleme ayrıştırıcısı (Türkçe tarih/saat/tekrar)
js/qa-ui.js           Hızlı ekleme kutusu
js/search.js          Arama
js/settings.js        Ayarlar
js/google.js          Google Takvim eşitlemesi (OAuth + Calendar API, ödev teslimleri, ders programı)
js/cloud.js           Drive'daki gizli klasörle eşitleme (dersler, görevler, notlar, defter…)
js/backup.js          Otomatik yedek
js/notify.js          Hatırlatma bildirimleri
js/onboarding.js      İlk açılış kurulumu (şehir, plan türleri, dönem)
js/pwa.js             Uygulama olarak yükleme, service worker kaydı
js/update.js          Güncelleme denetimi ve "Güncelle"
js/theme.js           Renk temaları
js/themes.js          Kategori dokuları ve tematik kartlar
js/icons.js           İkon seti
js/prayer.js          Namaz vakitleri (Diyanet yöntemi, 81 il)
js/hicri.js           Hicri tarih, kandiller, ay evreleri
sunucu.py, server.js  Yerel sunucu (Python / Node.js)
baslat.bat            Windows'ta tek tıkla başlatma
CLAUDE.md             Geliştirme notları
.gitignore            Kişisel verilerin GitHub'a gitmesini engeller
.nojekyll             GitHub Pages'in dosyaları olduğu gibi sunması için
yedekler/             Kişisel yedekler: paylaşma, yükleme
```
