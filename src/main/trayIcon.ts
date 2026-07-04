import { nativeImage, type NativeImage } from 'electron'

/**
 * Aşama 11: sistem tepsisi ikonu. Depoda harici bir ikon dosyası bulunmadığı
 * için, basit bir ">_" terminal rozeti ham RGBA piksel arabelleğiyle
 * programatik olarak üretilir (nativeImage.createFromBuffer BGRA bekler).
 */
export function createTrayIcon(): NativeImage {
  const size = 16
  const buffer = Buffer.alloc(size * size * 4)
  const accent = { r: 59, g: 130, b: 246 } // marka mavisi (#3b82f6)

  function setPixel(x: number, y: number, r: number, g: number, b: number, a: number): void {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const offset = (y * size + x) * 4
    buffer[offset] = b
    buffer[offset + 1] = g
    buffer[offset + 2] = r
    buffer[offset + 3] = a
  }

  const center = (size - 1) / 2
  const radius = size / 2 - 0.5

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - center
      const dy = y - center
      if (dx * dx + dy * dy <= radius * radius) {
        setPixel(x, y, accent.r, accent.g, accent.b, 255)
      }
    }
  }

  // ">" işareti (iki köşegen çizgi parçası)
  const chevron: Array<[number, number]> = [
    [4, 4],
    [5, 5],
    [6, 6],
    [7, 7],
    [6, 8],
    [5, 9],
    [4, 10]
  ]
  for (const [x, y] of chevron) setPixel(x, y, 255, 255, 255, 255)
  // "_" alt çizgisi
  for (let x = 8; x <= 11; x++) setPixel(x, 11, 255, 255, 255, 255)

  return nativeImage.createFromBuffer(buffer, { width: size, height: size })
}
