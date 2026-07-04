const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:[a-zA-Z0-9]*(?:;[a-zA-Z0-9]*)*)?\u0007|(?:\d{1,4}(?:;\d{0,4})*)?[0-9A-PR-TZcf-ntqry=><~])/g

/** Terminale yazılan ham veriden ANSI escape kodlarını temizler (pattern matching için). */
export function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, '')
}
