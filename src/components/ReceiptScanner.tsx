import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, AlertCircle, CheckCircle, Plus, Trash2, Loader2, Sparkles, RefreshCw } from 'lucide-react';
import { ScannedReceipt, Transaction } from '../types';

interface ReceiptScannerProps {
  onAddTransactions: (transactions: Omit<Transaction, 'id'>[]) => Promise<void> | void;
  isLoadingSheet: boolean;
  onSuccess?: () => void;
}

export default function ReceiptScanner({ onAddTransactions, isLoadingSheet, onSuccess }: ReceiptScannerProps) {
  const [image, setImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedResult, setScannedResult] = useState<ScannedReceipt | null>(null);
  
  // Camera-specific states
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Scanned result edit states
  const [merchantName, setMerchantName] = useState('');
  const [date, setDate] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [category, setCategory] = useState('');
  const [items, setItems] = useState<{ name: string; price: number; quantity: number }[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    setIsCameraActive(true);
    setError(null);
    setImage(null);
    setScannedResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setError('Gagal mengakses kamera. Mohon pastikan izin kamera diberikan di browser Anda.');
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setImage(dataUrl);
        stopCamera();
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Format file tidak didukung. Silakan unggah file gambar (PNG, JPG, JPEG).');
      return;
    }
    
    if (file.size > 12 * 1024 * 1024) {
      setError('Ukuran gambar terlalu besar. Maksimum 12MB.');
      return;
    }

    setError(null);
    setScannedResult(null);

    const reader = new FileReader();
    reader.onload = () => {
      setImage(reader.result as string);
    };
    reader.onerror = () => {
      setError('Gagal membaca file gambar.');
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleScan = async () => {
    if (!image) return;

    setIsScanning(true);
    setError(null);

    try {
      const response = await fetch('/api/scan-receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal memindai struk belanja.');
      }

      const data: ScannedReceipt = await response.json();
      setScannedResult(data);
      
      // Helper to robustly normalize various date formats to YYYY-MM-DD
      const normalizeDateStr = (dateStr?: string): string => {
        if (!dateStr) return new Date().toISOString().split('T')[0];
        const cleanStr = dateStr.trim();
        
        // 1. YYYY-MM-DD (standard)
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
          return cleanStr;
        }
        
        // 2. DD-MM-YYYY or DD/MM/YYYY
        const dmyMatch = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
        if (dmyMatch) {
          const [_, d, m, y] = dmyMatch;
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        
        // 3. YYYY/MM/DD
        const ymdMatch = cleanStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
        if (ymdMatch) {
          const [_, y, m, d] = ymdMatch;
          return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        }
        
        // Try JS Date parsing
        try {
          const parsed = new Date(cleanStr);
          if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
          }
        } catch (e) {
          console.warn("Failed to parse date:", cleanStr);
        }
        
        return new Date().toISOString().split('T')[0];
      };

      const normalizedDate = normalizeDateStr(data.date);

      // Initialize form edit fields with values extracted by Gemini
      setMerchantName(data.merchantName || '');
      setDate(normalizedDate);
      setTotalAmount(data.totalAmount || 0);
      setCategory(data.category || 'Belanja');
      setItems(data.items || []);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Koneksi ke server AI terganggu atau kualitas gambar kurang jelas. Silakan coba lagi.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleAddItem = () => {
    setItems([...items, { name: '', price: 0, quantity: 1, category }]);
  };

  const handleRemoveItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    
    const newTotal = updated.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    setTotalAmount(newTotal);
  };

  const handleItemChange = (index: number, key: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [key]: value };
    setItems(updated);

    const newTotal = updated.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    setTotalAmount(newTotal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!merchantName || !date || totalAmount <= 0) {
      setError('Mohon lengkapi data struk terlebih dahulu.');
      return;
    }

    try {
      const txsToSave: Omit<Transaction, 'id'>[] = items.length > 0
        ? items.map(item => ({
            date,
            category: item.category || category,
            description: `${merchantName} - ${item.name} (${item.quantity}x)`,
            amount: item.price * (item.quantity || 1),
            type: 'pengeluaran' as const,
            paymentMethod: 'Tunai',
            source: 'receipt' as const
          }))
        : [{
            date,
            category,
            description: `Belanja di ${merchantName}`,
            amount: totalAmount,
            type: 'pengeluaran' as const,
            paymentMethod: 'Tunai',
            source: 'receipt' as const
          }];

      await onAddTransactions(txsToSave);

      alert('Seluruh item dari struk belanja berhasil disimpan & disinkronkan ke Google Sheets secara terperinci!');
      
      // Reset scanner states
      setImage(null);
      setScannedResult(null);

      // Fire success redirect callback to transition tabs
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      console.error('Failed to save receipt transactions:', err);
      setError('Gagal menyimpan rincian transaksi: ' + (err.message || err));
    }
  };

  return (
    <div className="bg-[#111114] rounded-2xl border border-slate-800 overflow-hidden shadow-xl" id="receipt-scanner-container">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400 animate-pulse" />
            Pindai Struk Belanja dengan Gemini AI
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Foto struk Anda secara langsung atau unggah file gambar untuk pencatatan otomatis & sinkronisasi Google Sheets</p>
        </div>
      </div>

      <div className="p-6">
        {error && (
          <div className="mb-4 p-4 bg-rose-500/10 border-l-4 border-rose-500 rounded-r-xl flex items-start gap-3 border-y border-r border-rose-500/20">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-sm text-rose-300">{error}</div>
          </div>
        )}

        {!image ? (
          <div className="space-y-4">
            {isCameraActive ? (
              /* Video Stream HUD View */
              <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-black aspect-[4/3] flex flex-col items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-slate-950/40 pointer-events-none" />
                
                {/* Overlay Box boundary simulation */}
                <div className="absolute inset-10 border-2 border-dashed border-emerald-500/40 rounded-xl pointer-events-none flex items-center justify-center">
                  <span className="text-[10px] text-emerald-400/70 font-mono tracking-widest uppercase bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800">
                    Posisikan Struk di Sini
                  </span>
                </div>

                {/* Control Action Buttons */}
                <div className="absolute inset-x-0 bottom-6 flex justify-center gap-4 z-10 pointer-events-auto">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    className="py-2.5 px-6 rounded-full bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-600 transition-all shadow-lg flex items-center gap-2 border border-emerald-400/20 active:scale-95 cursor-pointer"
                  >
                    <Camera className="w-4 h-4" />
                    Ambil Foto
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="py-2.5 px-6 rounded-full border border-slate-700 text-slate-300 bg-slate-900/90 font-medium text-xs hover:bg-slate-800 transition-all active:scale-95 cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </div>
            ) : (
              /* Two-way Choice Launcher cards */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Direct Webcam Capture Button */}
                <button
                  type="button"
                  onClick={startCamera}
                  className="border-2 border-dashed border-emerald-500/20 hover:border-emerald-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-[#18181B] hover:bg-emerald-500/[0.02] group text-left min-h-[220px]"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-110 transition-transform shadow-sm">
                    <Camera className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-200">Ambil Foto dengan Kamera</p>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                    Gunakan kamera/webcam di perangkat Anda untuk memotret struk fisik belanja secara langsung saat ini.
                  </p>
                </button>

                {/* File Upload Option */}
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-800 hover:border-emerald-500 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all bg-[#18181B] hover:bg-emerald-500/[0.02] group min-h-[220px]"
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <div className="w-12 h-12 rounded-full bg-slate-800/60 flex items-center justify-center text-slate-400 mb-4 group-hover:scale-110 transition-transform shadow-sm">
                    <Upload className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-bold text-slate-200">Unggah File Gambar</p>
                  <p className="text-xs text-slate-400 mt-1.5 leading-relaxed text-center">
                    Tarik & lepas file gambar struk belanja ke sini, atau klik untuk memilih gambar (PNG, JPG, JPEG) dari penyimpanan.
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Image Preview & Actions */}
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#18181B] aspect-[4/3] flex items-center justify-center">
                <img src={image} alt="Struk Belanja" className="max-h-full max-w-full object-contain" />
                {isScanning && (
                  <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white backdrop-blur-sm px-6 text-center">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-3" />
                    <p className="text-sm font-semibold tracking-wide">Menganalisis struk dengan Gemini AI...</p>
                    <p className="text-xs text-slate-400 mt-1.5">Mengekstrak harga, kuantitas, nama toko, tanggal belanja, dan menyusun rincian pengeluaran Anda</p>
                  </div>
                )}
              </div>

              {!isScanning && !scannedResult && (
                <div className="flex gap-3">
                  <button
                    onClick={handleScan}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    Mulai Ekstraksi AI
                  </button>
                  <button
                    onClick={() => { setImage(null); setScannedResult(null); }}
                    className="py-2.5 px-4 rounded-xl border border-slate-800 text-slate-300 bg-[#18181B] font-medium text-sm hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Scanned Result Edit Form */}
            <div>
              {isScanning && (
                <div className="h-full border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center space-y-4 bg-[#18181B]">
                  <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
                  <div className="space-y-2 w-full max-w-[200px]">
                    <div className="h-2 bg-slate-800 animate-pulse rounded w-3/4 mx-auto"></div>
                    <div className="h-2 bg-slate-800 animate-pulse rounded w-1/2 mx-auto"></div>
                  </div>
                </div>
              )}

              {!isScanning && !scannedResult && (
                <div className="h-full border border-dashed border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center text-slate-500 bg-[#18181B] min-h-[250px]">
                  <Sparkles className="w-8 h-8 mb-3 text-emerald-500/40 animate-pulse" />
                  <p className="text-sm font-medium text-slate-300">Struk Siap Dianalisis</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    Klik tombol "Mulai Ekstraksi AI" di bawah gambar untuk memerintahkan AI menganalisis tulisan di struk Anda.
                  </p>
                </div>
              )}

              {scannedResult && (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-2 bg-emerald-500/10 py-1.5 px-3 rounded-lg border border-emerald-500/20">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    Berhasil dianalisis oleh Gemini AI
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Nama Toko / Merchant</label>
                    <input
                      type="text"
                      required
                      value={merchantName}
                      onChange={(e) => setMerchantName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-800 rounded-lg text-sm bg-[#18181B] text-slate-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tanggal Transaksi</label>
                      <input
                        type="date"
                        required
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-800 rounded-lg text-sm bg-[#18181B] text-slate-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20 scheme-dark"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Kategori Pengeluaran</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-800 rounded-lg text-sm bg-[#18181B] text-slate-200 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
                      >
                        <option value="Makanan" className="bg-[#18181B]">Makanan</option>
                        <option value="Belanja" className="bg-[#18181B]">Belanja</option>
                        <option value="Transportasi" className="bg-[#18181B]">Transportasi</option>
                        <option value="Hiburan" className="bg-[#18181B]">Hiburan</option>
                        <option value="Tagihan" className="bg-[#18181B]">Tagihan</option>
                        <option value="Kesehatan" className="bg-[#18181B]">Kesehatan</option>
                        <option value="Lainnya" className="bg-[#18181B]">Lainnya</option>
                      </select>
                    </div>
                  </div>

                  {/* Items list detail extractor */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daftar Barang Belanja</label>
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="text-xxs text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer bg-emerald-500/5 py-0.5 px-2 rounded border border-emerald-500/15"
                      >
                        <Plus className="w-3 h-3" /> Tambah Manual
                      </button>
                    </div>

                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1 border border-slate-800 rounded-lg p-2 bg-[#18181B]">
                      {items.map((item, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                             type="text"
                             placeholder="Nama barang"
                             required
                             value={item.name}
                             onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                             className="flex-1 min-w-0 px-2 py-1 border border-slate-800 rounded text-xs focus:border-emerald-500 focus:outline-none bg-[#18181B] text-slate-200 focus:ring-1 focus:ring-emerald-500/20"
                          />
                          <select
                             value={item.category || category}
                             onChange={(e) => handleItemChange(idx, 'category', e.target.value)}
                             className="w-24 px-1 py-1 border border-slate-800 rounded text-xs focus:border-emerald-500 focus:outline-none bg-[#18181B] text-slate-200 focus:ring-1 focus:ring-emerald-500/20"
                          >
                            <option value="Makanan">Makanan</option>
                            <option value="Belanja">Belanja</option>
                            <option value="Transportasi">Transportasi</option>
                            <option value="Hiburan">Hiburan</option>
                            <option value="Tagihan">Tagihan</option>
                            <option value="Kesehatan">Kesehatan</option>
                            <option value="Lainnya">Lainnya</option>
                          </select>
                          <input
                             type="number"
                             placeholder="Harga"
                             required
                             min="0"
                             value={item.price || ''}
                             onChange={(e) => handleItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                             className="w-16 px-2 py-1 border border-slate-800 rounded text-xs focus:border-emerald-500 focus:outline-none bg-[#18181B] text-slate-200 focus:ring-1 focus:ring-emerald-500/20 text-right"
                          />
                          <input
                             type="number"
                             placeholder="Qty"
                             required
                             min="1"
                             value={item.quantity || 1}
                             onChange={(e) => handleItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                             className="w-10 px-1 py-1 border border-slate-800 rounded text-xs focus:border-emerald-500 focus:outline-none bg-[#18181B] text-slate-200 focus:ring-1 focus:ring-emerald-500/20 text-center"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="text-slate-500 hover:text-rose-400 transition-colors p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {items.length === 0 && (
                        <p className="text-xs text-slate-500 text-center py-2">Tidak ada rincian barang belanja terperinci.</p>
                      )}
                    </div>
                  </div>

                  {/* Total Amount Input Display */}
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                    <span className="text-xs font-semibold text-emerald-300">Total Biaya Pengeluaran:</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-500 font-mono">Rp</span>
                      <input
                        type="number"
                        required
                        min="1"
                        value={totalAmount}
                        onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                        className="w-28 font-bold text-base text-emerald-400 bg-transparent border-b border-dashed border-emerald-500/40 focus:outline-none text-right"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={isLoadingSheet}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-500 text-slate-950 font-bold text-sm hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-55 cursor-pointer"
                    >
                      {isLoadingSheet ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Menyimpan ke Sheets...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          Simpan & Sinkron ke Sheets
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setImage(null); setScannedResult(null); }}
                      className="py-2.5 px-4 rounded-xl border border-slate-800 text-slate-300 bg-[#18181B] font-medium text-sm hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Ulangi
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
