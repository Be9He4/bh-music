export function base64ToBlob(base64: string, mimeType: string): Blob {
  // Android Base64.DEFAULT inserts \r\n every 76 chars — strip before atob()
  const cleaned = base64.replace(/[\s\r\n]+/g, "");
  const binaryStr = atob(cleaned);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return new Blob([bytes.buffer], { type: mimeType });
}
