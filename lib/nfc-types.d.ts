// Minimal Web NFC API type declarations for Android Chrome.
// https://developer.mozilla.org/en-US/docs/Web/API/Web_NFC_API

interface NDEFRecord {
  recordType: string;
  mediaType?: string;
  id?: string;
  data?: DataView;
  encoding?: string;
  lang?: string;
  toRecords?: () => NDEFRecord[];
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFWriteOptions {
  overwrite?: boolean;
  signal?: AbortSignal;
}

interface NDEFScanOptions {
  signal?: AbortSignal;
}

interface NDEFReadingEvent extends Event {
  serialNumber: string;
  message: NDEFMessage;
}

declare class NDEFReader extends EventTarget {
  onreading: ((event: NDEFReadingEvent) => void) | null;
  onreadingerror: ((event: Event) => void) | null;
  scan(options?: NDEFScanOptions): Promise<void>;
  write(
    message: string | NDEFMessage | { records: { recordType: string; data?: string | BufferSource; mediaType?: string; lang?: string }[] },
    options?: NDEFWriteOptions
  ): Promise<void>;
}
