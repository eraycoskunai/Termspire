import type { Extension } from '@codemirror/state'
import { StreamLanguage } from '@codemirror/language'
import { javascript } from '@codemirror/lang-javascript'
import { python } from '@codemirror/lang-python'
import { json } from '@codemirror/lang-json'
import { css } from '@codemirror/lang-css'
import { html } from '@codemirror/lang-html'
import { markdown } from '@codemirror/lang-markdown'
import { cpp } from '@codemirror/lang-cpp'
import { rust } from '@codemirror/lang-rust'
import { java as javaLang } from '@codemirror/lang-java'
import { php } from '@codemirror/lang-php'
import { sql } from '@codemirror/lang-sql'
import { xml } from '@codemirror/lang-xml'
import { yaml } from '@codemirror/lang-yaml'
import { shell } from '@codemirror/legacy-modes/mode/shell'
import { go } from '@codemirror/legacy-modes/mode/go'
import { powerShell } from '@codemirror/legacy-modes/mode/powershell'
import { ruby } from '@codemirror/legacy-modes/mode/ruby'
import { csharp, kotlin } from '@codemirror/legacy-modes/mode/clike'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { lua } from '@codemirror/legacy-modes/mode/lua'
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile'

/**
 * Aşama 13: dosya paneli içi editör — uzantıya göre CodeMirror sözdizimi
 * vurgulama eklentisi seçer. Eşleşme yoksa `undefined` döner (sözdizimi
 * vurgusu olmadan düz metin editörü olarak çalışır — düzenleme yine de
 * tamamen desteklenir).
 */
export function getLanguageExtension(fileName: string): Extension | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
      return javascript()
    case 'jsx':
      return javascript({ jsx: true })
    case 'ts':
    case 'mts':
    case 'cts':
      return javascript({ typescript: true })
    case 'tsx':
      return javascript({ jsx: true, typescript: true })
    case 'py':
    case 'pyw':
      return python()
    case 'json':
    case 'jsonc':
      return json()
    case 'css':
    case 'scss':
    case 'less':
      return css()
    case 'html':
    case 'htm':
      return html()
    case 'md':
    case 'markdown':
      return markdown()
    case 'c':
    case 'h':
      return cpp()
    case 'cpp':
    case 'cc':
    case 'cxx':
    case 'hpp':
    case 'hxx':
      return cpp()
    case 'rs':
      return rust()
    case 'java':
      return javaLang()
    case 'php':
      return php()
    case 'sql':
      return sql()
    case 'xml':
    case 'svg':
    case 'xaml':
      return xml()
    case 'yaml':
    case 'yml':
      return yaml()
    case 'sh':
    case 'bash':
    case 'zsh':
      return StreamLanguage.define(shell)
    case 'ps1':
    case 'psm1':
    case 'psd1':
      return StreamLanguage.define(powerShell)
    case 'go':
      return StreamLanguage.define(go)
    case 'rb':
      return StreamLanguage.define(ruby)
    case 'cs':
      return StreamLanguage.define(csharp)
    case 'kt':
    case 'kts':
      return StreamLanguage.define(kotlin)
    case 'toml':
      return StreamLanguage.define(toml)
    case 'lua':
      return StreamLanguage.define(lua)
    default:
      if (fileName.toLowerCase() === 'dockerfile') return StreamLanguage.define(dockerFile)
      return undefined
  }
}

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'])

export function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.has(ext)
}
