import React from 'react';
import { render } from '@testing-library/react-native';
import { ScanCamera } from '../features/scan/ScanCamera';

jest.mock('expo-camera', () => ({
  CameraView: ({ children, onBarcodeScanned }: any) => {
    (globalThis as any).__triggerScan = onBarcodeScanned;
    return <>{children}</>;
  },
}));

describe('ScanCamera', () => {
  it('invokes onScan with barcode + type', () => {
    const onScan = jest.fn();
    render(<ScanCamera onScan={onScan} />);
    (globalThis as any).__triggerScan?.({ type: 'ean13', data: '5449000000996' });
    expect(onScan).toHaveBeenCalledWith({ kind: 'barcode', value: '5449000000996' });
  });

  it('invokes onScan with qr kind', () => {
    const onScan = jest.fn();
    render(<ScanCamera onScan={onScan} />);
    (globalThis as any).__triggerScan?.({ type: 'qr', data: 'https://x.example' });
    expect(onScan).toHaveBeenCalledWith({ kind: 'qr', value: 'https://x.example' });
  });

  it('debounces duplicate scans', () => {
    const onScan = jest.fn();
    render(<ScanCamera onScan={onScan} />);
    (globalThis as any).__triggerScan?.({ type: 'qr', data: 'x' });
    (globalThis as any).__triggerScan?.({ type: 'qr', data: 'x' });
    expect(onScan).toHaveBeenCalledTimes(1);
  });
});
