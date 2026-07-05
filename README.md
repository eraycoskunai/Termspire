# 🗼 Termspire

[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)
![Electron](https://img.shields.io/badge/Electron-43-9feaf9?logo=electron&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)

> Your command tower for terminals and agents.

Tek bir pencerede birden fazla bağımsız terminal oturumunu **ve** AI kodlama
ajanını (`claude`, `codex`, PowerShell, CMD, WSL, Git Bash, `npm run dev`, log
takibi vb.) grid/pane düzeninde çalıştırabildiğiniz, Windows öncelikli ama
cross-platform (macOS/Linux) bir Electron masaüstü uygulaması. Mission
Control ile tüm workspace'lerinizin kuşbakışını alın, hangi ajanın onay
beklediğini/çöktüğünü/kaynak tükettiğini anında görün — hiçbir terminali
kaybetmeden, hiçbir ajanı gözden kaçırmadan.

## Neden Termspire?

Çoklu-terminal / çoklu-AI-ajan yönetimi kategorisi hızla kalabalıklaşıyor
(Pane, TermLoop, Termic, Terax gibi araçlar da benzer bir problemi çözüyor).
Termspire'ı farklılaştıran, tek bir pencerede birleşen şu katmanlar:

- **Mission Control** — tüm workspace/pane'lerin canlı metin önizlemeli
  kuşbakışı görünümü.
- **Çoklu-ajan onay orkestratörü** — 2+ ajan aynı anda onay beklerken hepsine
  tek tıkla Enter/y/n.
- **Crash-loop koruması + kaynak alarmı** — çöken/kaynak tüketen process'leri
  otomatik tespit edip durdurma.
- **Git-farkında dosya paneli** — durum rozetleri + gömülü diff modu.
- **Tam oturum kaydı/replay** — bir ajanın 40 dakika önce ne yazdığını
  yeniden izleyin.
- **🌐 Web pane'leri + 📊 Sistem izleme** — `localhost` önizlemesi ve host
  CPU/RAM/disk takibi aynı grid içinde.
- **💀 Saldırı Modu** — gerçek terminal hatalarına tepki veren, tamamen
  opsiyonel bir matrix-estetiği eğlence katmanı.

## Özellikler

- **Dinamik grid**: Pane sayısına göre otomatik dengeli satır/sütun düzeni,
  `react-resizable-panels` ile serbestçe yeniden boyutlandırma.
- **Sürükle-bırak**: `@dnd-kit` ile pane'lerin grid içinde yer değiştirmesi.
- **Zoom**: Bir pane'i çift tıklayarak (veya ⤢ butonuyla) tam ekrana alma;
  arka plandaki pane'ler unmount edilmez, pty bağlantıları canlı kalır.
- **Workspace/sekme sistemi**: Her workspace kendi pane setini ve düzenini
  tutar; sekme değişimi hiçbir pane'i unmount etmez (arka planda status takibi
  ve çıktı akışı kesintisiz devam eder).
- **Pane yapılandırma**: Shell tipi (PowerShell/CMD/WSL distro/Git Bash/bash/
  zsh), başlangıç komutu, çalışma dizini, görünen isim ve renk etiketi.
- **Shell keşfi**: Sistemde gerçekten kullanılabilir shell'ler ve kurulu WSL
  distroları otomatik tespit edilip modalde işaretlenir.
- **Status motoru**: Terminal çıktısı regex pattern'leriyle eşleştirilerek
  pane durumu (aktif / onay bekliyor / boşta / hata / sonlandı) hesaplanır;
  onay bekleyen veya hataya düşen pane'ler için native masaüstü bildirimi
  gösterilir.
- **Persistence**: Workspace'ler, pane yapılandırmaları ve düzen `electron-store`
  ile diske kaydedilir; uygulama yeniden açıldığında tüm pane'ler kayıtlı
  config'leriyle sıfırdan yeniden spawn edilir.
- **Preset sistemi**: Bir workspace'in pane setini isimlendirip kaydedin;
  kayıtlı bir presete tıklayarak aynı seti tek tıkla yeni bir workspace olarak
  açın.
- **Broadcast input**: Seçili pane'lere aynı anda yazma modu — bir pane'e
  yazılan her tuş vuruşu, broadcast grubuna dahil edilmiş diğer tüm pane'lere
  de iletilir.
- **Global arama**: `Ctrl+Shift+F` (veya araç çubuğundaki 🔍 Ara butonu) ile
  aktif workspace'teki tüm pane'lerin scrollback geçmişinde eşzamanlı arama.
- **Kopyala/yapıştır ayrımı** (Windows Terminal davranışı): `Ctrl+Shift+C` /
  `Ctrl+Shift+V` her zaman kopyala/yapıştır yapar; düz `Ctrl+C`, bir metin
  seçiliyse SIGINT göndermek yerine kopyalar, seçim yoksa normal şekilde
  interrupt sinyali üretir.
- **Koyu/açık tema**: Araç çubuğundaki 🌙/☀️ butonuyla anında tema değişimi
  (xterm renk paleti dahil), tercih `localStorage`'da saklanır.
- **Hızlı onay butonları**: Bir pane onay/giriş bekliyor durumuna geçtiğinde
  başlığında "↵ Onayla / y / n" butonları belirir; tıklanınca doğrudan o
  pane'in pty'sine yazılır.
- **Workspace durum rozeti**: Arka plandaki (aktif olmayan) bir workspace
  sekmesinde, içindeki herhangi bir pane hata verirse kırmızı, onay
  bekliyorsa sarı bir rozet belirir.
- **Odak vurgusu**: O an yazdığınız pane, ince bir mavi kenarlıkla
  vurgulanır.
- **GPU hızlandırmalı render**: `@xterm/addon-webgl` ile WebGL renderer
  denenir (ağır çıktılarda belirgin şekilde daha akıcı kaydırma); donanım
  desteklemiyorsa sessizce varsayılan renderer'a düşer.
- **Pane vitals**: Her pane başlığında o an çalışan process'in anlık
  CPU/bellek kullanımı (`pidusage` ile ~2.5sn'de bir ölçülür).
- **Durum bazlı ambient efekt**: Aktif/onay bekleyen/hatalı pane'lerin
  kenarlığında duruma özgü renkte hafif "nabız" parıltısı.
- **Retro CRT modu**: Araç çubuğundaki 📺 CRT butonuyla açılıp kapatılabilen,
  tüm pencereyi kaplayan tarama çizgisi + vinyet efekti.
- **Ctrl+Scroll font zoom**: Bir pane üzerinde fareyle scroll + Ctrl basılıyken
  font boyutu anında büyür/küçülür (8-32px aralığında).
- **Otomatik yeniden başlatma**: Pane başlığındaki 🔁 anahtarı açıksa, o
  pane'in process'i beklenmedik şekilde (exit code ≠ 0) sonlanınca 1sn sonra
  otomatik olarak yeniden başlatılır; tercih diske kalıcı olarak kaydedilir.
- **Sunum/Kiosk modu**: `Ctrl+Shift+K` / `F11` veya araç çubuğundaki ⛶ Sunum
  butonuyla toolbar/sekme/preset barları gizlenip sadece grid'in gösterildiği
  temiz bir demo modu açılır; sağ üstte fareyle beliren buton veya aynı
  kısayolla geri dönülür.
- **Workspace'ler arası pane sürükleme**: Bir pane'i sürükleyip başka bir
  workspace sekmesinin üzerine bırakarak o workspace'e taşıyabilirsiniz (yeni
  workspace'te pty sıfırdan spawn edilir).
- **Aktivite geçmişi paneli**: Araç çubuğundaki 🔔 butonu, hangi pane'in ne
  zaman onay beklediğini/hata verdiğini listeleyen, tıklayınca ilgili
  workspace'e atlayan bir açılır panel gösterir.
- **Preset mini önizleme**: Preset barındaki her preset pilinin yanında, pane
  sayısını ve renklerini yansıtan küçük bir grid thumbnail'ı gösterilir.
- **Zamanlanmış komut**: Pane başlığındaki ⏰ butonuyla, belirli bir saatte
  (tek seferlik veya her gün tekrar eden) o pane'e otomatik bir komut
  enjekte eden basit bir zamanlayıcı eklenebilir.
- **Pane çıktı boru hattı**: Pane başlığındaki 🔗 açılır listesinden bir hedef
  pane seçerek, bu pane'in tüm çıktısını canlı olarak hedefin girdisine
  akıtabilirsiniz (ör. bir log tail'inin çıktısını başka bir işleme yönlendirme).
- **Kaldığın yerden devam et (Aşama 11)**: Uygulama artık pencereyi kapatınca
  gerçekten sonlanmaz — sistem tepsisine küçülür ve içindeki tüm terminal
  process'leri (npm run dev, claude code vb.) arka planda kesintisiz çalışmaya
  devam eder; pencereyi tekrar açtığınızda hiçbir şey kaybolmamış olur. Gerçek
  bir kapanış (tepsi menüsündeki "Çıkış", uygulama çökmesi veya PC kapanması)
  durumunda ise her pane'in ekran görüntüsü periyodik olarak diske yazılır;
  uygulama yeniden açıldığında bu görüntü, altına eklenen ince bir "önceki
  oturumdan devam ediliyor" ayracıyla birlikte geri yüklenir ve process aynı
  dizinde otomatik olarak yeniden başlatılır. Böylece process'in kendisi
  teknik olarak yeniden doğsa bile bağlam/geçmiş asla kaybolmaz. Aynı anda
  ikinci bir kopyanın açılması engellenir (single-instance-lock); ikinci bir
  başlatma denemesi sadece mevcut pencereyi öne getirir.
- **Kapatılanları geri al — CANLI process ile (Aşama 12)**: Bir pane'i (✕)
  veya bir workspace sekmesini yanlışlıkla kapatırsanız, araç çubuğundaki
  "↩️ Kapatılanlar" butonu (veya `Ctrl+Shift+T`) son 20 kapatma işlemini eski
  konumuyla birlikte geri yükler — tarayıcıların "kapatılan sekmeyi yeniden
  aç" özelliğiyle aynı mantık. Ama ondan çok daha fazlası: kapatma anında o
  terminalin **gerçek process'i (Claude Code, Codex, npm run dev, ne
  çalışıyorsa) öldürülmez** — arka planda "detach" edilmiş şekilde tamamen
  canlı kalır (tmux'un detach/attach mantığı gibi). "Geri Al" dediğinizde
  sıfırdan bir shell açıp process'i yeniden başlatmak yerine **aynı canlı
  process'e yeniden bağlanılır**; process nerede kaldıysa (Claude Code'la
  ortasında bir konuşma, sunucunun ürettiği yeni loglar vb.) tam olarak orada
  devam eder, hiçbir şey yeniden yazılmaz. Bu davranış en fazla 20 kapatma
  için geçerlidir (kapasite dolup bir kayıt listeden düşerse veya "Temizle"ye
  basılırsa o pane'in process'i o an gerçekten sonlandırılır — sonsuza kadar
  arka planda hayalet process birikmez). Uygulama tamamen kapatılırsa (gerçek
  process restart'ı) bu canlı bağlantı doğal olarak korunamaz; o durumda
  Aşama 11'in ekran görüntüsü tabanlı kurtarmasına düşülür.
- **IDE tarzı dosya paneli (Aşama 12)**: Araç çubuğundaki "📁 Dosyalar"
  butonuyla, o an tıkladığınız/odaklandığınız terminalin başlangıç
  dizinini gösteren bir yan panel açılır. Klasörler arası gezinme (çift tık /
  ↑ üst dizin), yeni klasör/dosya oluşturma, silme, dosyayı OS'un varsayılan
  uygulamasıyla açma, dizini OS dosya gezgininde gösterme ve — en önemlisi —
  **Windows Gezgini'nden panele dosya/klasör sürükleyip bırakarak** o dizine
  kopyalama desteklenir. Farklı bir terminale tıkladığınızda panel otomatik
  olarak o terminalin dizinine geçer.
- **Dosya paneli içi kod editörü/önizleyici (Aşama 13)**: Dosya panelinde bir
  dosyaya **tek tıkladığınızda** (çift tık hâlâ OS'un varsayılan uygulamasıyla
  açar), CodeMirror 6 tabanlı, satır numaralı, sözdizimi vurgulamalı bir
  editör tam da o panelin yanında açılır — JS/TS/JSX/TSX, Python, JSON, CSS/
  SCSS, HTML, Markdown, C/C++, Rust, Java, PHP, SQL, XML, YAML, Go, Ruby,
  C#, Kotlin, TOML, Lua, Shell/Bash, PowerShell ve Dockerfile için vurgulama
  dahil. Doğrudan içerikte değişiklik yapıp `Ctrl+S` veya "Kaydet" butonuyla
  diske yazabilirsiniz; kaydedilmemiş değişiklik varken dosyayı/panel'i
  kapatmaya çalışırsanız onay istenir. Görsel dosyalar (png/jpg/gif/webp/svg/
  bmp/ico) editör yerine doğrudan önizlenir. İkili/çok büyük dosyalar (metin
  için >4 MB, görsel için >20 MB) önizlenemez; bu durumda "OS uygulamasıyla
  aç" seçeneği sunulur.
- **Komut Paleti — `Ctrl+K` (Aşama 14)**: VS Code/Linear tarzı, fuzzy-search
  bir komut paleti. Workspace'e/pane'e git, bir preseti yeni workspace olarak
  aç, bir pane'i yeniden başlat, tema/CRT/Spotlight/Kiosk/Dosya paneli
  aç-kapat, yeni terminal/workspace ekle ve — en önemlisi — **belirli bir
  pane'e doğrudan metin/komut gönder** gibi tüm aksiyonlar klavyeden hiç
  çıkmadan tek bir arayüzden yapılabilir. Komut listesi her açılışta canlı
  store durumundan türetilir; ok tuşlarıyla gezinip `Enter` ile çalıştırılır.
- **Mission Control — `Ctrl+Shift+O` (Aşama 14)**: macOS Mission Control/
  Exposé mantığında, TÜM workspace'lerin TÜM pane'lerini tek bir kuşbakışı
  ekranda gösterir. Her kart, o pane'in ekranının son birkaç satırının canlı
  bir metin önizlemesini (performans için ~1.2sn'de bir "pull" edilir) ve
  durum rengini içerir; bir karta tıklamak ilgili workspace'e geçip pane'i
  odaklar ve gerçek klavye odağını verir. 15-20 terminal paralel çalışırken
  "hangi pane'de ne oluyor" sorusuna saniyeler içinde cevap verir.
- **Çoklu-ajan onay orkestratörü (Aşama 14)**: Status motoru zaten her pane
  için "onay bekliyor" durumunu tespit ediyor. **2 veya daha fazla pane**
  (farklı workspace'lerde bile olsa) AYNI ANDA bu durumdaysa, ekranın altında
  otomatik olarak beliren bir çubuk, tek bir tıkla **hepsine birden** Enter/
  y/n gönderir — her birine tek tek gidip onaylamak yerine tüm bekleyen
  ajanları bir arada yönetin. Çubuk genişletilip hangi pane'lerin beklediği
  tek tek de listelenebilir.
- **Git-farkında dosya paneli (Aşama 14)**: Dosya panelindeki her girdinin
  yanında, o dizin bir git deposuysa `git status`'a göre bir durum rozeti
  belirir (M = değişti, A = eklendi, D = silindi, U = untracked, R =
  yeniden adlandırıldı); klasörler, içindeki herhangi bir dosya
  değiştiyse de rozet alır. Dosya paneli içi editörde, git geçmişi olan
  dosyalarda başlıkta beliren **"⇄ Diff"** butonuyla, o anki (kaydedilmemiş
  olsa da) içerik ile `HEAD`'deki içerik arasındaki satır bazlı fark
  (`@codemirror/merge` `unifiedMergeView`) doğrudan editör üzerinde
  vurgulanır — bir ajanın ne değiştirdiğini ham `git diff` çıktısını okumak
  yerine görsel olarak takip etmek çok daha kolaydır. Dizin bir git deposu
  değilse rozetler/Diff butonu hiç gösterilmez.
- **Crash-loop koruması (Aşama 14)**: "Otomatik yeniden başlat" açık bir pane
  art arda çökerse, sabit 1sn gecikme yerine üstel backoff uygulanır (1sn,
  2sn, 4sn, 8sn… en fazla 30sn). Bir process 60 saniyelik pencerede 5'ten
  fazla çökerse (gerçek bir crash-loop), otomatik yeniden başlatma tamamen
  durdurulur, kullanıcıya native bildirim gösterilir ve "otomatik yeniden
  başlat" anahtarı otomatik kapatılır — böylece bozuk bir process CPU'yu
  sonsuza kadar boğamaz. Process 20 saniye kesintisiz çalışırsa (gerçek bir
  toparlanma) çökme sayacı sıfırlanır.
- **Kaynak alarmı (Aşama 14)**: Pane vitals (CPU/RAM) ~7.5 saniye (3 ardışık
  ölçüm) sürdürülebilir şekilde eşik üstünde kalırsa (RAM > 1.5 GB veya
  CPU > %180) bu bir "runaway process" olarak kabul edilir; native bildirim
  gösterilir, pane başlığındaki kullanım rozeti kırmızıya döner ve
  aktivite geçmişine bir kayıt eklenir. Eşik altına dönüldüğünde bir sonraki
  gerçek olay için sayaç sıfırlanır.
- **Tam oturum kaydı/replay (Aşama 14)**: Pane başlığındaki 🕐 butonu, o
  pane'in geçmişte dakikada bir alınan anlık görüntüleri arasında bir
  "scrubber" (kaydırma çubuğu) ile gezinmenizi sağlayan bir replay paneli
  açar. Her anlık görüntü, salt-okunur ayrı bir xterm.js instance'ında
  gerçek ANSI renkleriyle render edilir — bir ajanın 40 dakika önce tam
  olarak ne yazdığını, hangi hatayı verdiğini yeniden "izleyebilirsiniz".
  En fazla ~150 kayıt (≈2.5 saat) append-only bir günlükte tutulur, kapasite
  dolduğunda en eskiler otomatik budanır.
- **Framer Motion geçişleri (Aşama 14)**: Pane zoom'a girip çıkarken hafif
  bir "pop" (scale+opacity) animasyonu; Komut Paleti, Mission Control ve
  onay orkestratörü çubuğu yumuşak spring/fade animasyonlarıyla açılıp
  kapanır. Bu animasyonlar bilinçli olarak react-resizable-panels'ın manuel
  sürükle-boyutlandırma davranışına MÜDAHALE ETMEZ (yalnızca kozmetik
  `transform`/`opacity`, gerçek layout/resize akışı anında gerçekleşir).
- **Odak/Spotlight modu (Aşama 14)**: Araç çubuğundaki 🔦 Spotlight
  butonuyla açılır; açıkken bir pane'e tıkladığınızda (odaklandığınızda)
  diğer tüm pane'ler hafifçe kararır (üzerine gelince tekrar belirir),
  yoğun grid'lerde dikkatinizi tek bir pane'e toplamanızı sağlar.
- **💀 Saldırı Modu / "Hacker Attack Mode" (Aşama 15)**: Araç çubuğundaki
  💀 Saldırı Modu butonu, komut paleti veya `Ctrl+Shift+H` ile açılır. Tüm
  uygulamanın renk paletini (`--mtf-bg/surface/border/text` CSS
  değişkenleri) neon-yeşil bir "sızma" temasına çevirir — bu sayede tüm
  pane'ler, toolbar ve butonlar ekstra kod yazılmadan otomatik olarak
  yeniden temalanır. Açılışta ~2 sn'lik sahte bir **"hackleme" boot
  sekansı** (rastgele IP/hash/port satırları hızlıca akar) oynar, ardından
  ambient moda geçilir: canvas tabanlı bir **matrix-yağmuru** animasyonu,
  farenin ardında sönümlenen bir **neon imleç izi**, sol üstte döngülü sahte
  sızma logları + GERÇEK canlı istatistikler (aktif pane sayısı, toplam
  CPU/RAM, bekleyen/hatalı pane sayısı) gösteren bir **HUD kutusu**, nadir
  aralıklarla kısa RGB-split **glitch patlamaları**, açılış/kapanışta ekran
  **flash + sarsıntı** efekti ve sentezlenmiş (Web Audio API, dış ses dosyası
  yok) bir "power-up/power-down" sweep sesi bulunur. En önemlisi: bir pane
  GERÇEKTEN `error` durumuna geçtiğinde (status engine tarafından tespit
  edilince) ekran kırmızı bir **"İHLAL ALARMI"** vinyetine döner, siren sesi
  çalar ve HUD hangi pane'in hata verdiğini gösterir — yani dekoratif katman,
  gerçek terminal durumuna tepki veren işlevsel bir uyarı sistemine de
  dönüşür. Tamamen `pointer-events-none` olduğundan gerçek terminal
  etkileşimini asla bloklamaz — sadece atmosferi değiştirir.
- **🌐 Web pane'leri (Aşama 16)**: Araç çubuğundaki **"+ Web ekle"** butonu
  (veya komut paletindeki "Web pane ekle") ile, terminal pane'lerin yanına
  Electron `<webview>` ile gömülü, tam bir tarayıcı sekmesi gibi çalışan
  **istenildiği kadar** "web" pane açılabilir — tipik kullanım: bir
  terminalde `npm run dev` çalıştırıp yanındaki web pane'de canlı çıktısını
  (`localhost:3000` vb.) anında önizlemek. Her web pane'in kendi geri/ileri/
  yenile butonları ve düzenlenebilir adres çubuğu vardır; adres çubuğuna
  `localhost:5173` gibi kısaltmalar da yazılabilir. Diğer pane'ler gibi grid
  içinde sürüklenebilir, zoom'a alınabilir, kapatılıp **"Geri Al" ile geri
  getirilebilir** (son gezinilen URL ile birlikte) ve workspace kalıcılığına
  dahildir (uygulama yeniden açıldığında son URL ile birlikte geri gelir).
  Her guest sayfa Electron'un `will-attach-webview` güvenlik kancasıyla
  sıkılaştırılmıştır (nodeIntegration/preload guest tarafından asla
  yükseltilemez).
- **📊 Sistem bilgisi paneli (Aşama 16)**: Araç çubuğundaki 📊 Sistem
  butonu, ana bilgisayarın canlı **CPU** (toplam + çekirdek başına kullanım
  çubukları), **RAM**, **disk** (Windows'ta `Win32_LogicalDisk`, macOS/Linux'ta
  `df -k` ile) kullanımını ve **uptime**'ını gösteren açılır bir panel açar.
  Panel açıkken 2 saniyede bir main process'ten taze bir örneklem çekilir
  (kapalıyken hiçbir polling yapılmaz); CPU yüzdesi Node'un `os.cpus()`
  kümülatif zamanları arasında delta alınarak (htop mantığıyla) hesaplanır.

## Teknoloji Yığını

- **Electron** + **electron-vite** (main/preload/renderer ayrımı, HMR)
- **React 18** + **TypeScript** (strict mode)
- **Tailwind CSS 4** (CSS değişkenleriyle tema desteği)
- **Zustand** (workspace/pane/UI/preset state)
- **node-pty** (native pty spawn, main process)
- **@xterm/xterm** + `addon-fit`, `addon-web-links`, `addon-search`, `addon-webgl`,
  `addon-serialize` (oturum kurtarma için ekran görüntüsü serileştirme)
- **CodeMirror 6** (dosya paneli içi kod editörü — `codemirror`, dil paketleri,
  `@codemirror/legacy-modes`, `@codemirror/theme-one-dark`, `@codemirror/merge`
  diff modu için)
- **framer-motion** (Komut Paleti/Mission Control/onay çubuğu/pane zoom
  geçiş animasyonları)
- **pidusage** (main process, pane başına CPU/RAM ölçümü + kaynak alarmı)
- **react-resizable-panels** (grid boyutlandırma)
- **@dnd-kit/core** (sürükle-bırak)
- **electron-store** (JSON tabanlı persistence)
- **git CLI** (main process, `child_process.execFile` ile — dosya paneli
  durum rozetleri ve diff modu için; kurulu değilse özellik sessizce
  devre dışı kalır)
- **electron-builder** (Windows/macOS/Linux paketleme)

## Önkoşullar

- **Node.js** 18+ ve **npm**
- **node-pty** native modülünü derlemek için:
  - **Windows**: Visual Studio Build Tools (Desktop development with C++
    workload) + Python 3.x
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `make`, `gcc/g++`, `python3`

> Not: Bu depoda Windows'ta VS Build Tools ile `node-pty` derlemesini
> engelleyen bir "Spectre mitigation" derleyici hatası için `patch-package`
> ile otomatik uygulanan bir yama bulunur (`patches/node-pty+*.patch`).
> `npm install` sonrası `postinstall` script'i bu yamayı otomatik uygular.

## Kurulum

### Son kullanıcı (indirilebilir sürüm)

Kaynak koduyla uğraşmak istemiyorsanız [Releases](../../releases) sayfasından
işletim sisteminize uygun kurulum dosyasını indirip çalıştırabilirsiniz
(Windows: `.exe` installer, macOS: `.dmg`, Linux: `.AppImage`).

### Geliştirici (kaynak koddan)

```bash
npm install
```

## Geliştirme

```bash
npm run dev
```

Bu komut, main/preload/renderer'ı derleyip Electron penceresini HMR (hot
module replacement) ile açar.

## Kod Kalitesi

```bash
npm run typecheck   # main + renderer için strict TS kontrolü
npm run lint         # ESLint (max-warnings 0)
npm run format       # Prettier ile otomatik biçimlendirme
```

## Build / Paketleme

```bash
npm run build         # typecheck + electron-vite build
npm run build:win     # Windows NSIS installer
npm run build:mac     # macOS (dmg/zip)
npm run build:linux   # Linux (AppImage/deb)
```

## Klasör Yapısı

```
src/
  shared/types.ts          # main <-> renderer paylaşılan tipler + IPC kanalları
  main/
    index.ts               # app lifecycle, tray, single-instance-lock, quit-time flush
    trayIcon.ts             # programatik sistem tepsisi ikonu (nativeImage)
    pty/PtyManager.ts       # spawn/write/resize/kill/detach/reattach (geri al için canlı process)
    pty/shellResolver.ts    # PowerShell/CMD/WSL distro/Git Bash keşfi
    ipc/ptyHandlers.ts
    ipc/systemHandlers.ts   # shell keşfi, dizin seçici, native bildirim
    ipc/configHandlers.ts   # workspace/preset persistence (electron-store)
    ipc/sessionHandlers.ts  # pane ekran görüntüsü kaydet/yükle/temizle + oturum geçmişi (replay)
    ipc/fsHandlers.ts       # dosya paneli: list/create/delete/import/reveal/open + read-text/data-url/write-text (editör)
    ipc/gitHandlers.ts      # git status + HEAD içeriği (dosya paneli rozetleri/diff modu)
    ipc/sysInfoHandlers.ts  # 📊 sistem bilgisi paneli — CPU/RAM/disk/uptime anlık görüntüsü (Aşama 16)
    store/configStore.ts
    store/sessionBufferStore.ts  # pane başına .buf dosyası (kaldığın yerden devam et)
    store/sessionHistoryStore.ts # pane başına .history.jsonl (tam oturum kaydı/replay)
    notifications.ts
  preload/index.ts           # contextBridge ile window.api
  renderer/src/
    App.tsx, main.tsx
    components/
      TerminalPane.tsx       # xterm.js + pty entegrasyonu, arama/kopyala-yapıştır
      WebPane.tsx             # 🌐 gömülü tarayıcı pane'i (<webview>, adres çubuğu) (Aşama 16)
      GridLayout.tsx          # grid, drag&drop, zoom, global arama çubuğu
      Toolbar.tsx
      WorkspaceTabBar.tsx     # sekmeler + cross-workspace drop hedefleri
      PresetBar.tsx
      PaneConfigModal.tsx
      WebPaneModal.tsx        # 🌐 "+ Web ekle" diyaloğu (URL/isim/renk) (Aşama 16)
      SystemInfoPanel.tsx     # 📊 canlı CPU/RAM/disk/uptime açılır paneli (Aşama 16)
      StatusIndicator.tsx
      ActivityLogButton.tsx   # 🔔 aktivite geçmişi açılır paneli
      ScheduleButton.tsx      # ⏰ zamanlanmış komut açılır paneli
      RecentlyClosedButton.tsx # ↩️ kapatılan pane/workspace'leri geri alma paneli
      FileExplorerPanel.tsx    # 📁 IDE tarzı dosya paneli (gezinme/oluşturma/sürükle-bırak/git rozetleri)
      FileEditorPanel.tsx      # 📝 dosya paneli içi CodeMirror editör/görsel önizleyici + diff modu
      CommandPalette.tsx       # ⌘K komut paleti (Aşama 14)
      MissionControl.tsx       # 🛰️ tüm workspace/pane kuşbakışı (Aşama 14)
      ApprovalOrchestratorBar.tsx # çoklu-ajan toplu onay çubuğu (Aşama 14)
      SessionReplayPanel.tsx   # 🕐 oturum geçmişi/replay scrubber paneli (Aşama 14)
      HackerModeOverlay.tsx    # 💀 Saldırı Modu — matrix yağmuru + HUD (Aşama 15)
    hooks/usePaneStatusEngine.ts  # pattern-matching status motoru
    state/
      useWorkspaceStore.ts   # zustand: workspaces, panes, broadcast, pipe, cross-workspace move, focusedPaneId
      usePresetStore.ts
      useUiStore.ts          # tema, global arama, kiosk modu, CRT efekti, dosya paneli, spotlight, komut paleti, mission control, saldırı modu
      useActivityStore.ts    # onay/hata/kaynak-alarmı olay geçmişi (bellekte)
      useScheduleStore.ts    # zamanlanmış komutlar (bellekte)
      useClosedItemsStore.ts # kapatılan pane/workspace yığını (bellekte, "geri al" için)
    lib/
      gridAlgorithm.ts        # N -> {cols, rows} en dengeli düzen
      statusPatterns.ts        # varsayılan waiting/error regex listesi
      ansiStrip.ts
      ptyRegistry.ts           # broadcast için paneId -> ptyInstanceId eşlemesi
      flushRegistry.ts         # quit anında tüm pane'lerin son kez flush edilmesi
      softClosedPtys.ts        # "geri al" — kapatılırken canlı bırakılan pty'lerin defteri
      paneHandleRegistry.ts    # workspace kapatma gibi akışlar için global paneId -> handle
      codeLangForFile.ts       # dosya uzantısı -> CodeMirror dil eklentisi eşlemesi
      crashLoopTracker.ts      # paneId başına çökme geçmişi + üstel backoff kararı (Aşama 14)
      fuzzyMatch.ts             # Komut Paleti için basit subsequence fuzzy eşleştirme (Aşama 14)
      hackerSound.ts            # Saldırı Modu için Web Audio API ile sentezlenen power-up/down/ihlal-alarmı sesleri (Aşama 15)
      hackerBootLines.ts        # Saldırı Modu boot sekansı için rastgele IP/hash/port satırları (Aşama 15)
      colorSwatches.ts           # Terminal/Web pane oluşturma diyaloglarında paylaşılan renk paleti (Aşama 16)
      shellMeta.ts
    styles/index.css           # tema CSS değişkenleri (:root / .light)
resources/                    # build ikonları
patches/                      # node-pty Windows derleme yaması
```

## Klavye Kısayolları

| Kısayol                       | Aksiyon                                 |
| ----------------------------- | --------------------------------------- |
| `Ctrl+Shift+F`                | Global arama çubuğunu aç/kapat          |
| `Ctrl+C` (seçim varken)       | Seçili metni kopyala (SIGINT göndermez) |
| `Ctrl+Shift+C`                | Seçili metni her zaman kopyala          |
| `Ctrl+Shift+V`                | Panodan pane'e yapıştır                 |
| Çift tık (pane başlığı)       | Pane'i zoom'a al / geri al              |
| `Ctrl+Scroll` (pane üzerinde) | Font boyutunu büyüt/küçült              |
| `Ctrl+Shift+K` / `F11`        | Sunum/Kiosk modunu aç/kapat             |
| `Ctrl+Shift+T`                | Son kapatılan pane/workspace'i geri al  |
| `Ctrl+K`                      | Komut Paletini aç                       |
| `Ctrl+Shift+O`                | Mission Control'ü aç/kapat              |
| `Ctrl+Shift+H`                | 💀 Saldırı Modunu aç/kapat              |

## Bilinen Kısıtlar / Notlar

- Geliştirme modunda `node-pty`'nin arka plan temizlik yardımcı process'i
  (`conpty_console_list_agent.js`) bazı Windows konsollarında zararsız bir
  `AttachConsole failed` hatası basabilir; bu, ana uygulamayı etkilemez ve
  `main/index.ts`'teki `uncaughtException` güvenlik ağı tarafından yutulur.
- Tema ve global arama durumu kalıcı değildir/sadece `localStorage`'da
  tutulur; workspace/pane/preset yapılandırması ise `electron-store` ile
  kalıcıdır (`%APPDATA%/termspire/config.json` — Windows).
- Pane vitals (CPU/RAM) `pidusage` ile ölçülür; Windows'ta CPU yüzdesi
  `wmic`/`gwmi` üzerinden hesaplandığından bazı sistemlerde birkaç saniye
  gecikmeli veya yaklaşık olabilir, bellek ölçümü her zaman güvenilirdir.
- Aktivite geçmişi ve zamanlanmış komutlar kalıcı değildir (sadece oturum
  boyunca bellekte tutulur); uygulama yeniden başlatıldığında sıfırlanır.
  Otomatik yeniden başlatma tercihi ise diğer pane ayarları gibi kalıcıdır.
- "Kaldığın yerden devam et" gerçek process'in kendisini değil, ekran
  görüntüsünü (scrollback) korur — pencere kapatılmadan uygulama arka planda
  çalışmaya devam ettiği sürece process zaten hiç durmaz; ama gerçek bir çıkış
  ya da PC kapanması sonrası process'in kendisi kaçınılmaz olarak yeniden
  spawn edilir (aynı shell/komut/dizinle). Ekran görüntüsü en fazla ~15
  saniyede bir diske yazılır; ani bir elektrik kesintisi gibi anlık/beklenmedik
  durumlarda bu son ~15 saniyelik pencere kaybolabilir. Bir pane'i başka bir
  workspace'e sürükleyip taşımak veya elle yeniden başlatmak da aynı mekanizmayı
  kullanır: pty sıfırdan başlar ama önceki ekran görüntüsü bir ayraçla birlikte
  korunur.
- Sistem tepsisi ikonu harici bir dosyaya ihtiyaç duymadan `nativeImage` ile
  programatik olarak (basit bir ">_" rozeti) üretilir; kendi ikonunuzu
  kullanmak isterseniz `src/main/trayIcon.ts`'i güncelleyebilirsiniz.
- "Kapatılanlar" listesi (geri al) sadece oturum boyunca bellekte tutulur —
  uygulama tamamen kapatılıp yeniden açıldığında sıfırlanır (aktivite geçmişi
  ve zamanlanmış komutlarla aynı desen). En fazla son 20 kapatma işlemi
  saklanır; bir kayıt bu kapasite dolduğu için listeden düşerse veya
  "Temizle"ye basılırsa, o pane'e ait canlı-ama-detached process de o an
  gerçekten sonlandırılır (aksi halde sonsuza kadar arka planda hayalet
  process birikirdi). Bu "canlı reattach" mekanizması yalnızca AYNI uygulama
  oturumu içinde geçerlidir — uygulama tamamen kapatılırsa (gerçek process
  restart'ı) tüm process'ler doğal olarak sonlanır ve bir sonraki açılışta
  Aşama 11'in ekran görüntüsü tabanlı kurtarmasına düşülür.
- Dosya paneli, bir pane'in _başlangıç_ çalışma dizinini gösterir (terminal
  içinde `cd` ile gezinilen anlık dizini canlı takip etmez); panel içindeki
  ↑/çift tık gezinmesi bağımsızdır ve terminale hiçbir komut yazmaz. Uygulama
  zaten node-pty ile tam kullanıcı yetkisiyle shell çalıştırdığından, dosya
  paneli işlemleri (oluşturma/silme/kopyalama) ek bir sanal alan kısıtı
  içermez — kullanıcı zaten aynı dosyalara terminalden de erişebilir.
- Dosya paneli içi editör (Aşama 13) sözdizimi vurgulamasını yalnızca
  desteklenen uzantılar için sağlar (bkz. `lib/codeLangForFile.ts`); listede
  olmayan bir uzantı düz metin olarak (vurgulama olmadan) yine tam
  düzenlenebilir açılır. Metin dosyaları için 4 MB, görsel önizleme için
  20 MB üst sınır vardır — üzerindeki dosyalar önizlenemez, "OS uygulamasıyla
  aç" ile açılabilir. Aynı dosya terminalden de (örn. bir editörle) eşzamanlı
  değiştiriliyorsa uygulama içi editör bunu otomatik algılamaz/yeniden
  yüklemez — "Yenile" niyetiyle dosyayı kapatıp yeniden açmanız gerekir.
- Git-farkında dosya paneli (Aşama 14) sistemde kurulu bir `git` CLI'ye
  bağımlıdır; kurulu değilse veya dizin bir git deposu değilse rozetler ve
  "⇄ Diff" butonu sessizce gösterilmez (hata diyaloğu açılmaz). Diff modu,
  editördeki O ANKİ (kaydedilmemiş olsa da) içerikle `HEAD`'deki içeriği
  karşılaştırır — staged/unstaged ayrımı yapmaz.
- Crash-loop koruması (Aşama 14) sayaçları paneId'ye bağlı olarak modül
  seviyesinde (React state DEĞİL) tutulur; bu sayede "Geri Al" veya manuel
  yeniden başlatma gibi component'i tamamen unmount/remount eden akışlarda
  bile art arda çökmeler doğru sayılır. Uygulama tamamen yeniden başlatılırsa
  (gerçek process restart'ı) bu sayaçlar da doğal olarak sıfırlanır.
- Tam oturum kaydı/replay (Aşama 14) geçmişi dakikada bir, en fazla ~150
  kayıt (≈2.5 saat) tutar; bu pencereden daha eski anlar geri getirilemez.
  Mission Control'deki mini önizlemeler ise ayrı bir mekanizmadır (canlı
  xterm buffer'ından "pull" edilir, diske yazılmaz) — sadece Mission Control
  açıkken ve ~1.2sn'de bir güncellenir.
- Kaynak alarmı (Aşama 14) eşikleri (RAM > 1.5 GB, CPU > %180, 3 ardışık
  ölçüm ≈7.5sn) şu an sabittir; farklı iş yükleri için `TerminalPane.tsx`
  içindeki `RESOURCE_ALARM_*` sabitleri düzenlenebilir.
- **Preload script değişiklikleri (`window.api`'ye yeni bir uç eklendiğinde)
  Vite HMR ile canlı yansımaz** — bu değişiklikleri görmek için uygulamayı
  tepsi menüsündeki "Çıkış" ile tamamen kapatıp yeniden başlatmanız gerekir
  (pencereyi ✕ ile kapatmak yeterli değildir, çünkü artık sadece tepsiye
  küçülür).

## Katkıda Bulunma

Katkılar memnuniyetle karşılanır! Bir özellik eklemeden veya büyük bir
değişiklik yapmadan önce ne yapmak istediğinizi bir issue'da açmanız,
üzerinde çalışırken çakışmaları önler. Genel akış:

1. Depoyu fork'layın ve yeni bir branch açın.
2. Değişikliğinizi yapın; göndermeden önce yerelde şunları çalıştırın:
   ```bash
   npm run typecheck
   npm run lint
   npm run format
   ```
3. Anlaşılır bir commit mesajıyla bir Pull Request açın.

Hata bildirimleri için lütfen işletim sisteminizi, Node.js sürümünüzü ve
mümkünse tekrar üretme adımlarını issue'ya ekleyin.

## Lisans

Bu proje [MIT Lisansı](LICENSE) ile lisanslanmıştır.
