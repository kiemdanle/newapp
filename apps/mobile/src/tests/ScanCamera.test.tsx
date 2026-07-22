import React from 'react';
import { render } from '@testing-library/react-native';
import { ScanCamera } from '../features/scan/ScanCamera';

jest.mock('react-native-vision-camera', () => ({
  Camera: ({ codeScanner }: any) => {
    (globalThis as any).__codeScanner = codeScanner;
    return null;
  },
  useCameraDevice: jest.fn(() => ({ id: 'back' })),
  useCameraPermission: jest.fn(() => ({ hasPermission: true })),
  useCodeScanner: jest.fn((opts: any) => opts),
}));

describe('ScanCamera', () => {
  it('invokes onScan with barcode + type', () => {
    const onScan = jest.fn();
    render(<ScanCamera onScan={onScan} />);
    (globalThis as any).__codeScanner?.onCodeScanned?.([{ type: 'ean-13', value: '5449000000996' }]);
    expect(onScan).toHaveBeenCalledWith({ kind: 'barcode', value: '5449000000996' });
  });

  it('invokes onScan with qr kind', () => {
    const onScan = jest.fn();
    render(<ScanCamera onScan={onScan} />);
    (globalThis as any).__codeScanner?.onCodeScanned?.([{ type: 'qr', value: 'https://x.example' }]);
    expect(onScan).toHaveBeenCalledWith({ kind: 'qr', value: 'https://x.example' });
  });

  it('debounces duplicate scans', () => {
    const onScan = jest.fn();
    render(<ScanCamera onScan={onScan} />);
    (globalThis as any).__codeScanner?.onCodeScanned?.([{ type: 'qr', value: 'x' }]);
    (globalThis as any).__codeScanner?.onCodeScanned?.([{ type: 'qr', value: 'x' }]);
    expect(onScan).toHaveBeenCalledTimes(1);
  });
});
