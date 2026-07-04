import { app, shell, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { IPC } from '@shared/types'
import { PtyManager } from './pty/PtyManager'
import { registerPtyHandlers } from './ipc/ptyHandlers'
import { registerSystemHandlers } from './ipc/systemHandlers'
import { registerConfigHandlers } from './ipc/configHandlers'
import { registerSessionHandlers } from './ipc/sessionHandlers'
import { registerFsHandlers } from './ipc/fsHandlers'
import { registerGitHandlers } from './ipc/gitHandlers'
import { registerSysInfoHandlers } from './ipc/sysInfoHandlers'
import { createTrayIcon } from './trayIcon'
// electron-vite'ın `?asset` importu bu dosyayı `out/main` içine kopyalar ve
// import'u hem dev hem paketlenmiş build'de geçerli bir dosya yoluna çözer;
// bu sayede uygulama ikonu (pencere/görev çubuğu/tepsi) tek bir kaynaktan
// (resources/icon.png) gelir.
import appIcon from '../../resources/icon.png?asset'

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
const ptyManager = new PtyManager(() => mainWindow)

/**
 * Aşama 11: "kaldığın yerden devam et". Pencereyi kapatmak artık uygulamayı
 * gerçekten sonlandırmaz — pencere tepsiye küçülür, tüm pty process'leri
 * (npm run dev, claude code vb.) arka planda kesintisiz çalışmaya devam eder.
 * Uygulama sadece tepsi menüsündeki "Çıkış" ile veya OS kapanışıyla gerçekten
 * sonlanır; bu durumda da renderer'a son bir "tamponları kaydet" sinyali
 * gönderip kısa bir süre bekledikten sonra pty'ler temizlenip çıkılır.
 */
let isQuitting = false
let quitConfirmed = false
const QUIT_FLUSH_DELAY_MS = 250

// node-pty, bir pane kapatılırken arka planda "console process list" toplamak için
// ayrı bir yardımcı process fork edebiliyor; bu yardımcı process bazı Windows
// oturumlarında (ör. kısıtlı/headless konsollar) "AttachConsole failed" ile
// başarısız olabiliyor. Bu, asıl shell process'inin kapatılmasını etkilemez
// (senkron kill çağrısı zaten önce çalışır) ama olası bir uncaught exception
// tüm uygulamayı çökertmesin diye burada güvenlik ağı olarak yakalanıyor.
process.on('uncaughtException', (error) => {
  console.error('[main] uncaughtException (yutuldu, uygulama çalışmaya devam ediyor):', error)
})

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 500,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0b0d12',
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      // Aşama 16: "web" pane'leri (istenilen kadar gömülü web önizlemesi) <webview>
      // etiketiyle gösteriliyor. Guest sayfa her zaman kendi ayrı, kısıtlı process'inde
      // çalışır; aşağıdaki 'will-attach-webview' handler'ı guest'in nodeIntegration/
      // preload gibi ayarları yükseltmesini engelleyerek bunu garantiye alır.
      webviewTag: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Güvenlik: bir <webview> guest'i kendi webPreferences'ını manipüle edip
  // nodeIntegration açmaya veya bizim preload script'imizi kendine yüklemeye
  // çalışabilir; her attach'te bunları sıfırlayıp zararsız hale getiriyoruz.
  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences) => {
    delete webPreferences.preload
    delete (webPreferences as { preloadURL?: string }).preloadURL
    webPreferences.nodeIntegration = false
    webPreferences.contextIsolation = true
  })

  // Pencere kapatma (✕, Alt+F4 vb.) uygulamayı sonlandırmaz; sadece gizler.
  // Böylece içerideki tüm terminal process'leri arka planda çalışmaya devam eder.
  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev) {
    mainWindow.webContents.on('console-message', (event) => {
      console.log(`[renderer] ${event.message}`)
    })
    mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
      console.error(`[renderer] did-fail-load: ${code} ${description}`)
    })
    mainWindow.webContents.on('render-process-gone', (_event, details) => {
      console.error(`[renderer] render-process-gone: ${JSON.stringify(details)}`)
    })
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function showMainWindow(): void {
  if (!mainWindow) {
    createWindow()
    return
  }
  mainWindow.show()
  mainWindow.focus()
}

function createTray(): void {
  // Gerçek marka ikonu (resources/icon.png) tepsi boyutuna (Windows'ta 16x16)
  // küçültülerek kullanılır; herhangi bir sebeple yüklenemezse (bozuk dosya
  // vb.) programatik ">_" rozetine düşülür.
  const resizedIcon = nativeImage.createFromPath(appIcon).resize({ width: 16, height: 16 })
  tray = new Tray(resizedIcon.isEmpty() ? createTrayIcon() : resizedIcon)
  tray.setToolTip('Termspire — arka planda çalışıyor')

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Göster', click: () => showMainWindow() },
    { type: 'separator' },
    {
      label: 'Çıkış',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  // setContextMenu() kullanmıyoruz çünkü Windows'ta bu, sol tık için de menüyü
  // açar; sol tık = pencereyi göster/odakla, sağ tık = context menu şeklinde
  // ayırmak için click/right-click event'lerini ayrı ayrı dinliyoruz.
  tray.on('click', () => showMainWindow())
  tray.on('right-click', () => tray?.popUpContextMenu(contextMenu))
}

// Uygulama artık kapatma yerine tepsiye küçülüp arka planda çalışmaya devam
// ettiği için, ikinci bir kopyanın açılmaya çalışılması (ör. kısayoldan tekrar
// tıklama) yeni bir pencere/PtyManager/config yazıcısı DEĞİL, mevcut pencereyi
// öne getirmelidir. Aksi halde iki ayrı süreç aynı config.json ve
// session-buffers dizinini eşzamanlı kullanır ve birbirinin durumunu ezer.
const gotSingleInstanceLock = app.requestSingleInstanceLock()

if (!gotSingleInstanceLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    showMainWindow()
  })

  app.whenReady().then(() => {
    electronApp.setAppUserModelId('com.termspire.app')

    // macOS dock ikonu (dev'de/paketlenmemiş çalıştırmada) BrowserWindow'un
    // `icon` seçeneğinden otomatik gelmez, ayrıca ayarlanması gerekir.
    if (process.platform === 'darwin') {
      app.dock?.setIcon(appIcon)
    }

    app.on('browser-window-created', (_, window) => {
      optimizer.watchWindowShortcuts(window)
    })

    registerPtyHandlers(ptyManager)
    registerSystemHandlers(() => mainWindow)
    registerConfigHandlers()
    registerSessionHandlers()
    registerFsHandlers()
    registerGitHandlers()
    registerSysInfoHandlers()

    createWindow()
    createTray()

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      } else {
        showMainWindow()
      }
    })
  })

  // Artık pencere kapatma "hide"a dönüştüğü için bu event normalde sadece
  // gerçek çıkış akışında (before-quit -> pencereler için native close) tetiklenir.
  app.on('window-all-closed', () => {
    ptyManager.killAll()
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('before-quit', (event) => {
    if (quitConfirmed) {
      ptyManager.killAll()
      return
    }
    // Gerçek çıkıştan hemen önce renderer'a son bir "tamponları kaydet" sinyali
    // gönderilir; kısa bir gecikmenin ardından pty'ler temizlenip çıkış onaylanır.
    // Bu, periyodik (15sn) otomatik kayıt penceresini kapanış anında en aza indirir.
    event.preventDefault()
    isQuitting = true
    mainWindow?.webContents.send(IPC.APP_BEFORE_QUIT)
    setTimeout(() => {
      quitConfirmed = true
      app.quit()
    }, QUIT_FLUSH_DELAY_MS)
  })
}
