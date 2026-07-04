import { Notification } from 'electron'

export function showNotification(title: string, body: string): void {
  if (!Notification.isSupported()) return
  new Notification({ title, body, silent: false }).show()
}
