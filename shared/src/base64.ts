// The API only ever transports bytes as base64 strings over JSON. These helpers use the
// standard `atob`/`btoa` globals so the exact same implementation works unmodified in the
// Expo/React Native app and in the Node backend (both provide these globals).

export function bytesToBase64(value: Uint8Array): string {
  let binary = '';
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** JSON.stringify replacer that base64-encodes any Uint8Array field it encounters. */
export function base64Replacer(_key: string, value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return bytesToBase64(value);
  }
  return value;
}
