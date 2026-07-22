import { useRef } from 'react';
import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';

export interface ScanResult {
  kind: 'barcode' | 'qr';
  value: string;
}

interface Props {
  onScan: (r: ScanResult) => void;
}

const QR_TYPES = new Set(['qr']);
const BARCODE_TYPES = new Set([
  'ean13',
  'ean8',
  'upc-a',
  'upc-e',
]);

export function ScanCamera({ onScan }: Props) {
  const device = useCameraDevice('back');
  const { hasPermission } = useCameraPermission();
  const lastValue = useRef<string | null>(null);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13', 'ean-8', 'upc-a', 'upc-e'],
    onCodeScanned: (codes) => {
      if (codes.length === 0) return;
      const code = codes[0];
      if (!code) return;
      const data = code.value ?? '';
      if (lastValue.current === data) return;
      lastValue.current = data;
      setTimeout(() => {
        lastValue.current = null;
      }, 2000);
      const codeType = code.type ?? 'unknown';
      const kind = QR_TYPES.has(codeType) ? 'qr' : BARCODE_TYPES.has(codeType) ? 'barcode' : 'barcode';
      onScan({ kind, value: data });
    },
  });

  if (!device || !hasPermission) return null;

  return (
    <Camera
      style={{ flex: 1 }}
      device={device}
      isActive
      codeScanner={codeScanner}
    />
  );
}
