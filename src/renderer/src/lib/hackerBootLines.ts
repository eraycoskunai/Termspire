/**
 * Aşama 15: Saldırı Modu açılışındaki sahte "hackleme" boot sekansı için
 * rastgele IP/hash/port değerleriyle her aktivasyonda farklı görünen satırlar
 * üretir. Tamamen kozmetiktir — gerçek bir ağ/sistem işlemi yapmaz.
 */

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomIp(): string {
  return `${randomInt(10, 240)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(1, 254)}`
}

function randomHex(length: number): string {
  let out = ''
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 16).toString(16)
  return out
}

function randomPort(): number {
  return randomInt(1024, 65535)
}

function randomPid(): number {
  return randomInt(1000, 99999)
}

export function generateBootLines(): string[] {
  return [
    `> İzinsiz bağlantı tespit edildi: ${randomIp()}:${randomPort()}`,
    `> Ters tünel açılıyor... hedef port ${randomPort()}`,
    `> SHA-256 doğrulama → ${randomHex(32)}`,
    `> Güvenlik duvarı aşılıyor... [██████████] %100`,
    `> Kernel modülleri enjekte ediliyor (PID ${randomPid()})`,
    `> Bellek haritası taranıyor: 0x${randomHex(8)} bloğu bulundu`,
    `> Şifreleme katmanı devre dışı bırakıldı.`,
    `> Ajan süreçleri senkronize ediliyor...`,
    `> ERİŞİM SAĞLANDI — SALDIRI MODU AKTİF`
  ]
}
