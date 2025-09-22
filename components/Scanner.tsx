import React, { useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { BackIcon } from './icons.tsx';

interface ScannerProps {
  onScan: (decodedText: string) => void;
  onManualBack: () => void;
}

const SCANNER_REGION_ID = "qr-scanner-region";

const Scanner: React.FC<ScannerProps> = ({ onScan, onManualBack }) => {
  const html5QrCodeRef = useRef<any>(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode(SCANNER_REGION_ID, {
            // Optional configs
            verbose: false // Set to true for detailed logs
        });
    }
    const qrCodeScanner = html5QrCodeRef.current;

    const onScanSuccess = (decodedText: string) => {
        if (isProcessing.current) return;
        isProcessing.current = true; // Prevent multiple submissions
        
        // Stop the scanner immediately to prevent re-scans
        if (qrCodeScanner && qrCodeScanner.isScanning) {
             qrCodeScanner.stop().catch((err: any) => {
                console.error("Error stopping the scanner, but proceeding anyway.", err);
             });
        }
        
        // Pass the raw decoded text to the parent component
        onScan(decodedText);
    };
    
    const onScanFailure = (error: string) => {
        // This is called frequently, keep it quiet unless needed for debugging.
        // console.warn(`Code scan error = ${error}`);
    };

    const startScanner = () => {
        // Prefer 'environment' camera for mobile devices
        const cameraConfig = { facingMode: "environment" };
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };
        
        qrCodeScanner.start(cameraConfig, config, onScanSuccess, onScanFailure)
            .catch((err: any) => {
                console.error("Failed to start QR scanner.", err);
                // Fallback for devices that don't support 'environment'
                if (err.name === "NotAllowedError" || err.name === "NotFoundError") {
                    console.log("Trying default camera...");
                    qrCodeScanner.start({}, config, onScanSuccess, onScanFailure)
                        .catch((fallbackErr: any) => {
                             console.error("Fallback camera also failed.", fallbackErr);
                        });
                }
            });
    };

    if (qrCodeScanner && !qrCodeScanner.isScanning) {
        startScanner();
    }

    // Cleanup function to ensure the scanner stops when the component unmounts
    return () => {
      if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
        html5QrCodeRef.current.stop()
            .catch((err: any) => console.error("Failed to stop scanner on unmount.", err));
      }
    };
  }, [onScan]);

  return (
    <div className="w-full max-w-2xl mx-auto bg-white p-6 rounded-xl shadow-2xl min-h-screen flex flex-col justify-center">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-gray-800">Scanare Cod QR</h2>
        <button onClick={onManualBack} className="flex items-center space-x-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors">
          <BackIcon />
          <span>Înapoi</span>
        </button>
      </div>
      
      <p className="text-center text-gray-600 mb-4">Îndreptați camera spre codul QR...</p>

      <div id={SCANNER_REGION_ID} className="w-full border-4 border-dashed border-gray-300 rounded-lg overflow-hidden"></div>
    </div>
  );
};

export default Scanner;
