# Vazifedar

Tarayıcıda çalışan kişisel takvim: planlar, haftalık ders programı, tarihsiz görevler ve Google Takvim eşitlemesi. Kurulum gerektirmez, uzak sunucu yoktur; veriler tarayıcıda (localStorage) durur ve her gün seçtiğin bir klasöre yedeklenir, Google ile doğrudan tarayıcı konuşur. Bilgisayara ve telefona uygulama olarak yüklenebilir, internetsiz de açılır.

## Çalıştırma

1. Klasördeki **`baslat.bat`** dosyasına çift tıkla. Küçük bir yerel sunucu açılır ve tarayıcıda `http://localhost:8080` görünür.
2. Siyah pencere açık kaldığı sürece uygulama çalışır.

`index.html`'e doğrudan çift tıklamak işe yaramaz (tarayıcılar `file://` üzerinden modül yüklemez, Google girişi de `localhost` ister).
Elle başlatmak istersen: `python sunucu.py` (ya da `node server.js`).

### Uygulama olarak yükle (bir kerelik, önerilir)

`baslat.bat` ile bir kez açtıktan sonra Chrome/Edge adres çubuğunun sağındaki **yükle** simgesine (ya da Ayarlar → Uygulama → **Uygulama olarak yükle**) bas. Vazifedar Başlat menüsüne kendi simgesiyle eklenir, ayrı pencerede açılır ve **bundan sonra siyah pencereye gerek kalmaz**: dosyalar uygulamanın içinde saklanır, internet ya da yerel sunucu olmadan da açılır. Veriler aynı kalır (aynı `localhost:8080` adresi). Simgeye sağ tıklayınca Yeni plan / Yeni görev / Takvim / Defter kısayolları çıkar.

Kodu değiştirdiğinde yeni hâli görmek için bir kez `baslat.bat` ile aç: sunucu açıkken uygulama her zaman en yeni dosyaları alır ve kendini günceller ("Vazifedar güncellendi — Yenile").

### İlk iş: otomatik yedeği aç

Ayarlar → Veriler → **Yedek klasörü seç**. Vazifedar her gün o klasöre `vazifedar-yedek-YYYY-AA-GG.json` yazar (değişiklikten yaklaşık 1 dakika sonra, aynı günün dosyasının üstüne). Bunun neden önemli olduğunu aşağıdaki **Otomatik yedek** başlığında bulabilirsin.

## Neler var

**Bugün** — Uygulama bu ekranla açılır. Solda büyük renk bloğunda günün tarihi (dönemin kaçıncı haftası olduğuyla) ve **kadran**: günün 24 saati bir saat kadranı gibi; öğlen tepede, gece yarısı altta. Dersler ve planlar halkada kendi renkleriyle dilim olarak durur (uzun olanların adı halkanın üstünde yazar), uyku saatleri gri, geçen kısım dışarıdaki çizgiyle, şimdi ibreyle gösterilir; günün en uzun boşluğu iç tarafta noktalı yay. Kadranın ortasında saat ve şu an ya da sıradaki kayıt (kaç dakika kaldığıyla); bir dilime ya da ortaya tıklamak o kaydı açar. Sağda en yakın iki sınav/teslim büyük geri sayım blokları olarak, altında **Günün akışı** (kalan kayıtlar, şu ankinin ilerleme çubuğu) ve devamsızlık sınırına yaklaşan dersler.

**Görev rafı** (Bugün ekranında) — Açık görevlerin her biri bir fiş: renkli koçan önceliği gösterir, üstünde zaman yazar (son tarihe kaç gün kaldı, "Bugün", "Yarın 09:00", gecikmişse kaç gün geçtiği ve çizgili koçan; tarihsizse kaç gündür beklediği). Fişin gövdesinde ders ya da kategori, son tarih, başlık (tıklayınca görevi açar), tahmini süre (küçük daire 4 saate göre dolar), tamamlama tiki ve yerleştirme düğmesi: görev bugünkü en uzun boşluğa sığıyorsa "Boşluğa koy" ile tek tıkla oraya eklenir, sığmıyorsa takvim düğmesi ilk uygun boş zamanı bulur; zaten yerleştirilmişse gün ve saati görünür. Üstte Hepsi / Bu hafta / Ödevler / Tarihsiz süzgeci ve Enter'la görev ekleme kutusu (Orta öncelikle ekler). Yük çubuğu açık görevlerin toplam süresini bu haftanın kalanındaki boş zamanla (görev yerleştirme saatleri içinde) karşılaştırır; sığmıyorsa ne kadar taştığını söyler. En fazla 8 fiş görünür, fazlası Görevler sayfasına götürür.

**Unutma notları** — Saate değil bir *ana* bağlı küçük notlar. Takvimde bir derse ya da plana tıkla, pencerenin "Unutma" kısmına yaz ve ne zaman çıkacağını seç: ders için "Yalnız bu derste", "Her Lab oturumunda" (oturum türüne göre: Lab, PS…) ya da "Bu dersin her oturumunda"; plan için "Bu planda", "Her tekrarında" ya da "Her Halısaha planında" (plan türüne göre). Defter sayfasındaki **+ Unutma notu** düğmesiyle de eklenir: bir derse, bir plan türüne, bir plana ya da bir güne; "Bir sonraki sefer" ya da "Her seferinde". "Bir sonraki sefer" notu o ders/plan gelene kadar bekler, işaretlenmezse kendiliğinden bir sonrakine geçer; güne ya da tek bir kayda bağlı not zamanı geçip işaretlenmediyse "Kalanlar"a düşer. Notu olan kayıtların kadranda dilim başında küçük bir iğne başı, Günün akışı'nda notları, haftalık takvimde iğne işareti görünür.

**Yarının çantası** (Bugün ekranında) — Gündüz "Bugün unutma" kartı: bugünün kalan derslerine/planlarına iğnelenen notlar, bugüne yazılan notlar ve kalanlar. Akşam (varsayılan 18:00'den sonra) kart koyulaşır ve **Yarının çantası** olur: yarınki her ders/plan saatiyle, altında götürmen ya da yapman gerekenler; her birini hazırladıkça tikle ("2/3 hazır" → "Hazır"). Bu akşam henüz başlamamış bir planın işaretlenmemiş notları da üstte görünür. Kutuya yazıp Enter'a basınca yarına not eklenir. Akşam 21:00'de (ayarlanabilir) yarın için işaretlenmemiş not varsa bildirim gelir, ayrıca dersten/plandan 1 saat önce o kaydın notları hatırlatılır. Ayarlar → Unutma notları ve çanta'dan saatler değiştirilir. Kartın altında **Defterden bir satır**: günün kısa notunu oradan yazabilirsin.

**Defter** — Kadran arşivi ve günlük. Ay sayfasında her gün küçük bir halka: o günün kadranı (dersler ve planlar renkleriyle, öğlen tepede). Ortası koyu olan günlere defter yazılmış, üstünde iğne rozeti olan günlerde unutma notu var; gelecek günler soluk durur. Bir güne tıklayınca sağda o günün sayfası açılır: büyük kadranı ve kayıtları, o gün biten görevler ve hazırlanan notlar, o güne iğnelenen notlar (gelecek günlere not yazılabilir) ve çizgili kâğıtta defter yazısı (yazdıkça kendiliğinden kaydedilir). Bir gün geride kalınca kadranı arşive alınır (dünü canlı bırakır, geç işaretlenen devamsızlık da halkaya yansır); arşivdeki bir günü "Takvimden yeniden çiz" ile tazeleyebilirsin. Sayfanın altında tüm unutma notları: kalanlar, her seferinde çıkanlar ve sıradakiler. Defter ve notlar yalnız bu tarayıcıda durur, Google'a gitmez; yedek dosyasına dahildir.

**Dönem haritası** — Dönemin tamamı tek ekranda: ay ve hafta başlıkları altında sınavlar, ödev teslimleri, tatiller ve haftalık yük grafiği (ortalamanın belirgin üstündeki haftalar kırmızı). Bugünün yeri kırmızı çizgiyle işaretli; altta en yoğun hafta, sıradaki sınav/teslim ve en hafif hafta özetleri. Dönem tarihleri Ders programı sayfasından girilir.

**Takvim** — Hafta, Ay ve Ajanda görünümleri. Haftalık görünümde boş bir saate tıklayınca o saatte yeni plan açılır; boş alanda fareyle aşağı sürükleyerek saat aralığı seçebilirsin. Bir planı tutup başka saate/güne **sürükleyerek taşıyabilir**, alt kenarından çekip uzatabilirsin (tekrarlayan planda "Yalnız bu / Tüm seri" sorulur, çakışma olursa uyarır, "Geri al" ile geri alınır).

- **Esnek saat ekseni** (hafta): o hafta herhangi bir günde kaydı olan saatler tam boyda, hiçbir günde kaydı olmayan saatler ince, uyku saatleri (Ayarlar'daki gün başlangıcı/bitişi dışı) ay simgeli tek bir gece şeridi. Gece yarısına sarkan bir konser olursa o saat kendiliğinden açılır. Sağ üstteki "Esnek eksen / Düz eksen" düğmesiyle eski düzene dönülür.
- **Gün halkaları**: haftanın başlığında her günün tarihi kendi küçük kadranının ortasında durur (Defter'deki halkaların aynısı); bugünün halkasında şimdiki saati gösteren bir ibre ucu var. Ay evresi (yeni ay, ilk dördün, dolunay, son dördün) gün adının yanında, kandil ve bayramlar tarihin altında görünür.
- **Boşluk cepleri**: görev yerleştirme saatleri içindeki 1 saatten uzun boşluklar, teknik çizimdeki ölçü çizgisi gibi bir köşeli parantez ve "2 sa 40 dk boş" etiketiyle görünür. Etikete tıklayınca o boşluğa sığan açık görevler öncelik sırasıyla listelenir; birine tıklamak onu oraya yerleştirir, ya da "Bu saate plan ekle" denir.
- **Mürekkep ve damga**: geride kalan planlar solar ve köşesine kendi pulu basılır; işlenen derslere mühür, gidilmeyen derslere kırmızı "GİTMEDİM" damgası vurulur.
- **Zımbalı çakışma**: çakışan iki kayıt üst üste binmiş, hafifçe yamuk iki kâğıt gibi durur ve birbirine zımbayla tutturulmuştur.
- **Hicri takvim**: Ay görünümünün üstünde hicri ay(lar), hicri ay başları ve mübarek günler (Regaib, Miraç, Berat, Kadir, Mevlid kandilleri; Ramazan başı; bayramlar ve arifeler; Aşure, hicri yılbaşı). Tarayıcının Ümmü'l-Kurâ takviminden hesaplanır, internet gerekmez; Diyanet takvimiyle bir gün fark olabilir. Ay evreleri yaklaşıktır.
- **Yakınlaştırarak gezinme**: Ctrl + fare tekerleği (dokunmatik yüzeyde kıstırma) ya da `+` / `−` ile Dönem haritası ⇄ Ay ⇄ Hafta ⇄ Gün arasında gidilir. Ayda imlecin altındaki gün büyüyüp o haftaya, haftada imlecin altındaki gün sütunu o günün Defter sayfasına (büyük kadranı) dönüşür; uzaklaşınca geri çıkılır.

**Görünüm ("Kadran")** — Üstte tek satırlık çubuk: bölümler, hızlı ekleme kutusu ve Google eşitleme durumu. Cesur renk blokları, yuvarlak hatlar; başlıklar ve büyük sayılar Unbounded, metin Rubik yazı tipiyle. Haftalık takvimde planlar dolu renk, dersler açık zemin üzerinde çizgili durur (rutin derslerle planlar bir bakışta ayrılır). Ayarlar → Görünüm'de altı renk teması (Firuze, Mercan, Kobalt, Safran, Mürdüm, Mürekkep), istersen kendi rengin, renk bloklarındaki desenin yoğunluğu ve açık/koyu mod. Görev tamamlayınca tik çizilir ve kart kayarak çıkar; son acil görevi bitirince küçük bir kutlama olur (sistemde "hareketi azalt" açıksa animasyonlar kapanır). Bugün ekranının altında **Bu hafta** kartı: günlere göre yük (her gün kategorilere bölünmüş bir sütun), kategori başına saat, tamamlanan görev sayısı, en dolu gün ve gelecek haftanın yükü.

**Dokular ve tematik kartlar** — Her plan türü kendi dünyasının desenini taşır; haftalık takvim bloklarında, kadran dilimlerinde ve pencere başlıklarında görünür. Halısaha biçilmiş çim şeritleri ve orta saha, konser ekolayzır, teori dersi kareli defter, Lab breadboard ve jumper, PS noktalı kâğıt, sınav optik form, roket takımı gece göğü ve uçuş yayı, arkadaşlar kahve fincanı halkaları, görev zamanı milimetrik kâğıt. Kendi eklediğin kategoriler seçtiğin ikona göre doku alır (film şeridi, piksel, kod satırı, nabız, rota…). Bugün ekranındaki geri sayımlar da türüne göre kılık değiştirir: sınav bir optik form (kalan her gün bir dolu baloncuk, her gün biri boşalır), ödev kıvrık köşeli kareli kâğıt, konser koçanlı bir bilet. Bir plana tıklayınca pencerenin başında da kendi kartı: halısaha için LED'li skorbord (gün : saat : dk), roket takımı için T-eksi sayacı.

**Kadranda gün ışığı ve bitiş anı** — Kadranın iç yüzünü saran ince halkada güneşin doğuşundan batışına gündüz açık, gece koyu görünür; ibrenin dibinde gündüz güneş, gece ay durur (vakitler cihazda hesaplanır). Bir ders ya da plan bittiğinde dilimin sonunda kendi simgesi kısa bir an belirir: halısahada top zıplar, konserde nota sallanır, roket havalanır ("hareketi azalt" açıksa çıkmaz).

**Pul albümü** (Defter) — Ay sayfasında "Kadranlar / Pullar" seçimi. Pullar görünümünde geçen her güne, o gün en çok zaman ayırdığın şeyin pulu basılır (kep, breadboard, top, nota, roket…), defter yazılmış günler posta damgası taşır; gelecek günler boş pul yeri.

**Hızlı ekleme** — Takvimin üstündeki kutuya düz Türkçe yaz, Enter'a bas. Yazarken ne anlaşıldığı altta görünür; Shift+Enter aynı bilgilerle formu açar. Klavyede `/` kutuya gider. Örnekler:

| Yazdığın | Ne olur |
|---|---|
| `cuma 20:00 halısaha` | Bu cuma 20:00–21:00, Halısaha kategorisi |
| `her salı 21-23 halısaha @Gölbaşı` | Her salı tekrarlayan plan, konum Gölbaşı |
| `28 ekim 13:30 elektronik vize` | Sınav (2 saat, 1 gün önce hatırlatma) |
| `yarın akşam 8 arkadaşlarla kahve` | Yarın 20:00, Arkadaşlar |
| `haftaya pazartesi saat 3 toplantı 2 saat` | Gelecek haftanın pazartesisi 15:00–17:00 |
| `her pazartesi ve çarşamba 18:00 spor dönem sonuna kadar` | Dönem bitişine kadar haftada iki gün |
| `ELE 271 ödev 3 cuma 17:00` | ELE 271 dersine bağlı ödev, teslim cuma 17:00 |
| `bu cuma 19-22 #roket test` | `#` ile kategori seçilir |

Tanıdığı ifadeler: bugün, yarın, öbür gün, haftaya/önümüzdeki + gün adı, "3 gün sonra", "15 ekim", "15/10", "20:00", "20.30", "14-16", "sabah/öğlen/akşam/gece 8", "2 saat", "90 dk", "tüm gün", "her gün/hafta/ay", "her salı ve perşembe", "iki haftada bir", "… kadar". Konum `@` ile yazılır.

**Tekrarlayan planlar** — Plan formundaki "Tekrar" kısmından her gün, her hafta (birden çok gün seçilebilir), her ay ya da her yıl; "2 haftada bir" gibi aralık ve isteğe bağlı bitiş tarihi. Serideki bir tekrara tıklayınca düzenlerken "Yalnız bu / Tüm seri", silerken "Yalnız bu / Bu ve sonrakiler / Tüm seri" sorulur. Takvimde ↻ işaretiyle görünür; çakışma kontrolü önümüzdeki tekrarların hepsine bakar. Google Takvim'e de tekrarlayan etkinlik olarak gider.

**Plan kategorileri** — Sınav, Konser, Halısaha, Arkadaşlar, Roket takımı, Görev zamanı, Diğer. Her kategorinin rengi, varsayılan süresi ve hatırlatması var (ör. Halısaha 1 saat, Konser 3 saat, Sınav için 1 gün önce hatırlatma). Ayarlar'dan değiştirilebilir, yeni kategori eklenebilir.

**Çakışma uyarısı** — Plan eklerken/düzenlerken başka bir plan ya da dersle çakışıyorsa uyarır, çakışan kayıtları listeler ve ilk boş zamanı önerir. "Yine de ekle" ile ekleyebilirsin. Takvimde çakışan kayıtlar kırmızı çerçeve ve ⚠ ile görünür.

**Ders programı** — Her dersi bir kez gir (birden çok oturum: gün, saat, derslik, Teori/Lab/PS); dönem başlangıç–bitiş tarihleri arasında her hafta takvimde görünür. Tatil günleri eklenebilir; bir derse tıklayıp "Bu haftaki dersi iptal et" denebilir. Dersler arası saat çakışması da uyarılır. İstersen ders programını Google Takvim'e haftalık tekrarlayan etkinlikler olarak aktarabilirsin.

**Devamsızlık sayacı** — Ders formunda devamsızlık hakkını gir (ders saati ya da ders sayısı olarak; "Dönemin %30'u" düğmesi öneri hesaplar, asıl oranı yönetmelikten kontrol et). Bir derse gitmediğinde takvimde o derse tıklayıp **Gitmedim** de (gelecekteki bir ders için **Gitmeyeceğim**). 09:30–11:20 gibi bir oturum 2 ders saati sayılır. Kullanılan/kalan hak ders programı sayfasında ve ders penceresinde görünür; hakkın %75'ine gelince Bugün ekranında uyarı çıkar. Gitmediğin dersler takvimde üstü çizili görünür.

**Ödev ve teslim tarihleri** — Görev formunda bir ders seçince görev ödeve dönüşür ve teslim saati sorulur. Ödevler takvimde teslim gününün üst satırında (kesik çerçeveyle), ders programı sayfasındaki "Ödevler ve teslimler" listesinde, ders penceresinde ve Bugün ekranındaki geri sayımda görünür. Teslimden 24 saat ve 3 saat önce hatırlatılır. Hızlı ekleme kutusuna ders kodu/adıyla "ödev, proje, rapor, föy, teslim" kelimelerinden biri yazılırsa doğrudan ödev olarak eklenir.

**Görevler** — Belirli bir güne bağlı olmayan "bir ara yapılacak" işler. Dört öncelik (Acil, Yüksek, Orta, Düşük) sütun olarak durur; kartları sürükleyerek önceliği değiştirebilirsin. Kategori, isteğe bağlı son tarih, tahmini süre, not. Son tarihi yaklaşanlar renklenir, son tarihsiz ve 7 günden uzun bekleyenler "… gündür bekliyor" diye işaretlenir.

**Takvime yerleştir (📅)** — Bir görevin tahmini süresine uyan ilk boş zamanı takvimde bulur (ders ve planların arasından, Ayarlar'daki saat aralığında) ve oraya "Görev zamanı" olarak ekler.

**Üst çubuk** — Bölümler (dar ekranda altta), her sayfadan erişilen hızlı ekleme kutusu (`/` ile odaklanır; Görevler sayfasında kendi kutusu var) ve Google eşitleme durumu (tıklayınca eşitler).

**Namaz vakitleri** — Bugün ekranında kadranın altında günün altı vakti (İmsak, Güneş, Öğle, İkindi, Akşam, Yatsı) ve sıradaki vakte kalan süre; kadranda her vakit halkayı kesen ince bir çizgi ve sekiz köşeli yıldızla, haftalık takvimde her günün sütununda kesik çizgiyle görünür. Vakitler Diyanet yöntemiyle (İmsak 18°, Yatsı 17°, Diyanet temkinleri) bilgisayarda hesaplanır, internet gerekmez; Diyanet'in yayımladığı takvimle bir iki dakika fark olabilir. Ayarlar → Namaz vakitleri'nden şehir (81 il ya da "Konumumu kullan"), kadranda/haftalık takvimde gösterme, vakit girince ya da 5–45 dk önce hatırlatma (hangi vakitlerde olacağı seçilir) ve vakit başına dakika ince ayarı. Vakitler Google Takvim'e gönderilmez.

**Hatırlatmalar** — Vazifedar açıkken (sekme ya da yüklü uygulama penceresi, arka planda olsa da) sistem bildirimi; izin verilmezse uygulama içinde uyarı. Bildirime tıklayınca Vazifedar öne gelir. Uygulama tamamen kapalıyken bildirim gelmez; telefonda kapalıyken de hatırlatma için Google Takvim eşitlemesini aç, hatırlatma süresi Google'a da gider.

**Otomatik yedek** — Görevler, ders programı, devamsızlık, unutma notları, defter ve kadran arşivi yalnız bu tarayıcıda durur (Google'a yalnız planlar gider). Tarayıcı verileri temizlenirse bunlar gider; bu yüzden:
- **Chrome / Edge**: Ayarlar → Veriler → *Yedek klasörü seç*. Seçilen klasöre her gün bir yedek yazılır; son 30 günün yedeği ve daha eskilerden her ayın ilk yedeği tutulur (gerisi kendiliğinden silinir; klasördeki başka dosyalara dokunulmaz). Vazifedar klasörünün kendisini seçersen içinde `yedekler` klasörü açılır. **Google Drive ya da OneDrive klasörü seçersen** yedekler buluta da gider, bilgisayara bir şey olsa bile kaybolmaz.
- Tarayıcı yeniden açıldığında klasör iznini yeniden isteyebilir: üstte sarı şerit çıkar, **İzin ver**'e bas (çıkarsa "Her ziyarette izin ver"i seç, bir daha sorulmaz). Klasör taşınır ya da silinirse kırmızı şerit yeni klasör seçmeni ister.
- **Telefon, Firefox, Safari** klasöre kendiliğinden yazamaz: 7 gün yedek alınmazsa üstte "Yedek indir" hatırlatması çıkar.
- Uygulama ayrıca tarayıcıdan "kalıcı depolama" ister; yer darlığında tarayıcı bu sitenin verisini kendiliğinden silmez.
- Elle de alınabilir: Ayarlar → Veriler → *Yedek indir* / *Yedekten yükle* (planlar, dersler, görevler, unutma notları, defter, kadran arşivi ve ayarlar).

### Klavye kısayolları

| Tuş | İşlev |
|---|---|
| `/` | Hızlı ekleme kutusu (üst çubukta) |
| `N` | Yeni plan (Görevler sayfasında yeni görev) |
| `G` | Yeni görev |
| `T` | Bugüne dön |
| `←` / `→` | Önceki / sonraki hafta (ay) |
| `A` / `H` / `J` | Ay / Hafta / Ajanda görünümü |
| `+` / `−`, Ctrl + tekerlek | Yakınlaş / uzaklaş (Dönem ⇄ Ay ⇄ Hafta ⇄ Gün) |

## Google Takvim bağlantısı (bir kerelik kurulum)

1. [Google Cloud Console](https://console.cloud.google.com/projectcreate)'da yeni proje oluştur (ör. "Vazifedar").
2. [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com)'yi etkinleştir.
3. **Google Auth Platform** (OAuth izin ekranı): uygulama türü *External*; **Audience → Test users** kısmına kendi Gmail adresini ekle.
4. **Clients** (Kimlik bilgileri) → *Create client* → tür **Web application**.
5. **Authorized JavaScript origins**: `http://localhost:8080`
6. Oluşan istemci kimliğini (`…apps.googleusercontent.com`) Vazifedar → Ayarlar → Google Takvim kutusuna yapıştır → **Kaydet** → **Google ile bağlan**.

Notlar:
- Uygulama test modunda olduğu için Google bir uyarı ekranı gösterir ("Google bu uygulamayı doğrulamadı") — kendi uygulaman olduğu için "Devam" diyebilirsin. Ara sıra yeniden giriş isteyebilir.
- Erişim anahtarı 1 saat geçerlidir; süresi dolunca üst çubuktaki düğme "Yeniden bağlan" olur, tek tıkla yenilenir.
- Hangi takvimle eşitleneceğini Ayarlar'dan seçebilirsin (birincil ya da ayrı bir "Vazifedar" takvimi).

### Eşitleme nasıl çalışır

- Google'daki etkinlikler (son 60 gün – önümüzdeki 1 yıl) Vazifedar'a gelir; başlığa göre kategori tahmin edilir ("vize", "final" → Sınav; "konser" → Konser; "halısaha", "maç" → Halısaha …).
- Vazifedar'da eklediğin, değiştirdiğin, sildiğin planlar Google'a gider (formdaki "Google Takvim ile eşitle" kutusu).
- Google'da değiştirilen/silinen etkinlikler bir sonraki eşitlemede Vazifedar'a yansır. Aynı anda iki yerde değiştirilen bir kayıtta Vazifedar'daki değişiklik kazanır.
- Otomatik eşitleme varsayılan 10 dakikada bir ve sekmeye geri döndüğünde çalışır.
- Görevler (tarihsiz olanlar) yalnız Vazifedar'da durur.

## Telefona kurmak (GitHub Pages)

Telefon bilgisayardaki `localhost`'a erişemez; Vazifedar'ı ücretsiz olarak GitHub Pages'te yayınlayıp telefondan oradan yüklersin. Yayınlanan yalnız **kod**dur: verilerin her cihazın kendi tarayıcısında kalır, kimse göremez. Google istemci kimliği de koda değil Ayarlar'a girildiği için kodda gizli bir şey yoktur.

> ⚠️ **`yedekler` klasörünü ve `vazifedar-yedek-*.json` dosyalarını asla yükleme.** Bunlar defterin ve notların dahil tüm verini içerir; GitHub Pages deposu herkese açıktır. (Git kullanırsan `.gitignore` bunları zaten dışarıda bırakır; tarayıcıdan sürükle-bırak yaparken dikkat et.)

1. github.com'da **New repository** → ad: `vazifedar`, **Public** → *Create repository*.
2. Açılan sayfada **uploading an existing file** → Vazifedar klasöründen şunları sürükle: `index.html`, `manifest.webmanifest`, `sw.js`, `icon.svg`, `.nojekyll` ve `css`, `js`, `icons` klasörleri (README de olabilir). `yedekler` ve `_yedek_takvim_oncesi` klasörlerini **sürükleme**. → *Commit changes*.
3. Depoda **Settings → Pages** → *Source: Deploy from a branch* → Branch: `main`, klasör: `/ (root)` → *Save*. Bir iki dakika sonra adres hazır olur: `https://mfatihdogan27.github.io/vazifedar/`
4. [Google Cloud Console](https://console.cloud.google.com/auth/clients) → Vazifedar istemcisi → **Authorized JavaScript origins**'e `https://mfatihdogan27.github.io` ekle (sonunda `/vazifedar` olmadan) → *Save*.
5. Telefonda Chrome ile adresi aç → menü (⋮) → **Ana ekrana ekle / Uygulamayı yükle**. (iPhone: Safari → Paylaş → *Ana Ekrana Ekle*.) Sonra Vazifedar → Ayarlar → Google Takvim: istemci kimliğini yapıştır → *Google ile bağlan*.
6. Ders programını ve görevleri taşımak için bilgisayarda *Yedek indir*, dosyayı telefona gönder (WhatsApp, Drive…), telefonda *Yedekten yükle*.

**Bilmen gerekenler**
- Veriler adres başınadır: `localhost:8080`'deki Vazifedar ile `github.io`'daki ayrı veri tutar. Planlar Google Takvim üzerinden iki tarafta da görünür; görevler, ders programı, notlar ve defter görünmez. Bunları tek bir yerde tutmak (ör. defteri yalnız bilgisayarda yazmak) ya da ara sıra yedekle taşımak gerekir.
- Kodu güncellersen GitHub'daki dosyaları da yenile (aynı yükleme ekranı, üstüne yazar); telefondaki uygulama bir sonraki açılışta kendini günceller.
- İstersen bilgisayarda da `github.io` adresini kullanabilirsin (o zaman `baslat.bat`'a hiç gerek kalmaz), ama mevcut verilerini yedekle oraya taşıman gerekir.

## Dosyalar

```
index.html        Uygulama kabuğu
manifest.webmanifest  Uygulama olarak yükleme bilgileri (ad, simgeler, kısayollar)
sw.js             Service worker: internetsiz/sunucusuz açılış, bildirime tıklama
icons/            Uygulama simgeleri (icon.svg'den üretildi)
css/style.css     Görünüm "Kadran" (açık/koyu tema, mobil düzen)
css/takvim.css    Takvim sekmesi: esnek eksen, boşluk cepleri, damgalar, zımba, yakınlaştırma
js/app.js         Üst çubuk, gezinme, araç çubuğu, otomatik işler
js/store.js       Veri modeli, localStorage, çakışma ve boş zaman hesapları
js/calendar.js    Hafta / Ay / Ajanda görünümleri (esnek eksen, boşluk cepleri)
js/hicri.js       Hicri tarih, kandil ve bayramlar, ay evreleri
js/forms.js       Plan, ders, görev/ödev formları; çakışma uyarısı; devamsızlık; takvime yerleştirme
js/recurrence.js  Tekrar kuralları (açılım, açıklama, Google RRULE)
js/quickadd.js    Hızlı ekleme ayrıştırıcısı (Türkçe tarih/saat/tekrar)
js/qa-ui.js       Hızlı ekleme kutusu
js/today.js       Bugün ekranı (kadran, geri sayım, günün akışı)
js/notes.js       Unutma notları, yarının çantası, not formu
js/journal.js     Defter: kadran arşivi, gün sayfası, günlük, pul albümü
js/themes.js      Kategori dokuları ve tematik kartlar (skorbord, bilet, optik form…)
js/term.js        Dönem haritası
js/icons.js       İkon seti
js/theme.js       Renk temaları
js/tasks.js       Görev panosu
js/courses.js     Ders programı sayfası
js/settings.js    Ayarlar
js/google.js      Google Takvim eşitlemesi (OAuth + Calendar API)
js/notify.js      Hatırlatma bildirimleri
js/prayer.js      Namaz vakitleri (Diyanet yöntemiyle hesap, 81 il)
js/dates.js       Tarih yardımcıları
js/ui.js          DOM, modal, bildirim yardımcıları
js/backup.js      Otomatik yedek (klasöre günlük yedek, hatırlatma şeridi)
js/pwa.js         Uygulama olarak yükleme, service worker kaydı, sistem bildirimi
sunucu.py         Yerel sunucu (Python)
server.js         Yerel sunucu (Node.js, yedek)
baslat.bat        Windows'ta tek tıkla başlatma
.gitignore        Yedeklerin GitHub'a gitmesini engeller
.nojekyll         GitHub Pages'in dosyaları olduğu gibi sunması için
yedekler/         (otomatik yedek bu klasöre yazılırsa) kişisel veriler — paylaşma
```
