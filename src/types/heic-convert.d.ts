declare module 'heic-convert' {
  interface HeicConvertOptions {
    buffer: Buffer | ArrayBuffer | Uint8Array;
    format: 'JPEG' | 'PNG';
    quality?: number; // 0..1 for JPEG
  }
  function heicConvert(options: HeicConvertOptions): Promise<Buffer | ArrayBuffer>;
  export default heicConvert;
}
