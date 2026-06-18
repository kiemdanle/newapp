import { useRef } from 'react';
import { CameraView } from 'expo-camera';

export interface ScanResult {
  kind: 'barcode' | 'qr';
  value: string;
}

interface Props {
  onScan: (r: ScanResult) => void;
}

// expo-camera's built-in scanner handles all of these in one CameraView.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] as const;

export function ScanCamera({ onScan }: Props) {
  const lastValue = useRef<string | null>(null);

  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES as unknown as ('qr' | 'ean13' | 'ean8' | 'upc_a' | 'upc_e')[] }}
      onBarcodeScanned={({ type, data }: { type: string; data: string }) => {
        if (lastValue.current === data) return;
        lastValue.current = data;
        setTimeout(() => {
          lastValue.current = null;
        }, 2000);
        const kind = type === 'qr' ? 'qr' : 'barcode';
        onScan({ kind, value: data });
      }}
    />
  );
}
