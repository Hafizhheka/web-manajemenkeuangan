import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Wallet,
  Sparkles,
  LogOut,
  LineChart,
  Calendar as CalendarIcon,
  Camera,
  MessageSquare,
  HelpCircle,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { User } from 'firebase/auth';

import { initAuth, googleSignIn, logout, checkRedirectResult } from './lib/firebase';
import { findOrCreateSpreadsheet, fetchTransactions, addTransactionToSheet, addTransactionsToSheet, deleteTransactionFromSheet, updateTransactionInSheet } from './lib/googleSheets';
import { Transaction } from './types';

// Component imports
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import ReceiptScanner from './components/ReceiptScanner';
import MonthlyReportView from './components/MonthlyReportView';
import Insights from './components/Insights';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(true);

  // App States
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentMonth, setCurrentMonth] = useState<string>('2026-07'); // Default based on metadata time (2026-07-02)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'scan' | 'ai'>('dashboard');

  // Loading States
  const [isInitializingSheets, setIsInitializingSheets] = useState(false);
  const [isSyncingSheet, setIsSyncingSheet] = useState(false);
  const [sheetsError, setSheetsError] = useState<string | null>(null);
  const [showAuthHelp, setShowAuthHelp] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Initialize auth on load
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    const init = async () => {
      setIsLoggingIn(true);
      try {
        const redirectData = await checkRedirectResult();
        if (redirectData && isMounted) {
          setUser(redirectData.user);
          setAccessToken(redirectData.accessToken);
          setNeedsAuth(false);
          setIsLoggingIn(false);
          return;
        }
      } catch (err) {
        console.error('Failed to check redirect result:', err);
      } finally {
        if (isMounted) {
          setIsLoggingIn(false);
        }
      }

      if (!isMounted) return;

      // Listen to normal auth state changes
      unsubscribe = initAuth(
        (currentUser, token) => {
          if (isMounted) {
            setUser(currentUser);
            setAccessToken(token);
            setNeedsAuth(false);
          }
        },
        () => {
          if (isMounted) {
            setUser(null);
            setAccessToken(null);
            setNeedsAuth(true);
          }
        }
      );
    };

    init();

    // Set current month based on current local date
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    setCurrentMonth(`${year}-${month}`);

    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Initialize Google Sheets once we have auth tokens
  useEffect(() => {
    if (user && accessToken) {
      initializeGoogleSheets(accessToken);
    } else {
      setSpreadsheetId(null);
      setTransactions([]);
    }
  }, [user, accessToken]);

  const initializeGoogleSheets = async (token: string) => {
    setIsInitializingSheets(true);
    setSheetsError(null);
    try {
      // Find or create spreadsheet
      const sheetId = await findOrCreateSpreadsheet(token);
      setSpreadsheetId(sheetId);

      // Fetch transaction list from sheet
      const data = await fetchTransactions(token, sheetId);
      setTransactions(data);
    } catch (err: any) {
      console.error('Failed to initialize sheets:', err);
      const errorMsg = err.message || '';
      if (errorMsg.includes('401') || errorMsg.includes('UNAUTHENTICATED') || errorMsg.includes('invalid') || errorMsg.includes('credentials')) {
        setSheetsError(
          'Sesi Google Anda telah berakhir (401). Silakan klik "Masuk Kembali & Perbarui Sesi" di bawah untuk memvalidasi ulang akses Google Drive & Sheets Anda secara aman.'
        );
      } else {
        setSheetsError(
          err.message || 'Gagal tersambung dengan Google Sheets Anda. Mohon pastikan izin akses Drive & Sheets diberikan.'
        );
      }
    } finally {
      setIsInitializingSheets(false);
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setAccessToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
      }
    } catch (err) {
      console.error('Google Sign-In failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogoutAction = async () => {
    setShowLogoutConfirm(false);
    try {
      await logout();
      // Remove cached items safely
      localStorage.removeItem('google_spreadsheet_id');
      localStorage.removeItem('g_access_token');
    } catch (err) {
      console.error('Logout error:', err);
    }
    setUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setSpreadsheetId(null);
    setTransactions([]);
    
    // Redirect to a clean origin to act as redirecting to the login page
    window.location.href = window.location.origin;
  };

  // Add Multiple Transactions Callback
  const handleAddTransactions = async (newTxs: Omit<Transaction, 'id'>[]) => {
    if (!accessToken || !spreadsheetId) return;

    setIsSyncingSheet(true);
    try {
      const txsWithId: Transaction[] = newTxs.map((newTx, idx) => ({
        ...newTx,
        id: `tx_${Date.now()}_${idx}`
      }));

      // 1. Sync to Google Sheet first in bulk
      await addTransactionsToSheet(accessToken, spreadsheetId, txsWithId);

      // 2. Update local state
      setTransactions((prev) => [...txsWithId, ...prev]);

      // 3. Automatically adjust currentMonth view to match the added transaction's month
      if (txsWithId[0] && txsWithId[0].date && txsWithId[0].date.length >= 7) {
        const txMonth = txsWithId[0].date.substring(0, 7); // "YYYY-MM"
        setCurrentMonth(txMonth);
      }
    } catch (err: any) {
      alert(`Gagal menyinkronkan transaksi ke Google Sheets: ${err.message}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Legacy Add Single Transaction Callback
  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    await handleAddTransactions([newTx]);
  };

  // Delete Transaction Callback
  const handleDeleteTransaction = async (id: string) => {
    if (!accessToken || !spreadsheetId) return;

    setIsSyncingSheet(true);
    try {
      // 1. Delete from Google Sheet
      await deleteTransactionFromSheet(accessToken, spreadsheetId, id);

      // 2. Remove from local state
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err: any) {
      alert(`Gagal menghapus transaksi dari Google Sheets: ${err.message}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Update Transaction Callback
  const handleUpdateTransaction = async (updatedTx: Transaction) => {
    if (!accessToken || !spreadsheetId) return;

    setIsSyncingSheet(true);
    try {
      // 1. Update in Google Sheets
      await updateTransactionInSheet(accessToken, spreadsheetId, updatedTx);

      // 2. Update local state
      setTransactions((prev) =>
        prev.map((t) => (t.id === updatedTx.id ? updatedTx : t))
      );
    } catch (err: any) {
      alert(`Gagal memperbarui transaksi di Google Sheets: ${err.message}`);
    } finally {
      setIsSyncingSheet(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-slate-200 font-sans selection:bg-emerald-500/30 selection:text-emerald-200" id="app-root">
      {/* Auth / Login State */}
      {needsAuth ? (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-tr from-slate-950 via-[#0A0A0C] to-emerald-950/30 relative overflow-hidden">
          {/* Animated Ambient background spheres */}
          <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-teal-500/10 blur-[140px] pointer-events-none animate-pulse duration-1000" />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="w-full max-w-lg bg-[#111114]/75 backdrop-blur-2xl rounded-3xl border border-slate-800/80 shadow-[0_0_80px_-15px_rgba(16,185,129,0.18)] p-8 md:p-10 space-y-6 relative z-10"
            id="login-card"
          >
            {/* Logo */}
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
                <Wallet className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight mt-3">Manajer Keuangan Pribadi</h1>
              <p className="text-xs text-emerald-400 font-mono tracking-wider uppercase">Ditenagai AI & Google Sheets</p>
            </div>

            {/* Interactive feature grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[#18181B]/80 p-3.5 rounded-2xl border border-slate-800 hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all duration-300 group">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Pindai Struk AI
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">Ambil foto struk langsung dengan kamera. AI Gemini otomatis mengekstrak rincian barang & harga.</p>
              </div>

              <div className="bg-[#18181B]/80 p-3.5 rounded-2xl border border-slate-800 hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all duration-300 group">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Real-time Sheets
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">Data pengeluaran & pendapatan langsung disinkronkan ke spreadsheet Google Sheets pribadi Anda.</p>
              </div>

              <div className="bg-[#18181B]/80 p-3.5 rounded-2xl border border-slate-800 hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all duration-300 group">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Laporan & PDF
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">Lihat visualisasi statistik interaktif bulanan dan ekspor ke format PDF profesional sekali klik.</p>
              </div>

              <div className="bg-[#18181B]/80 p-3.5 rounded-2xl border border-slate-800 hover:border-emerald-500/30 hover:bg-emerald-500/[0.02] transition-all duration-300 group">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Asisten Keuangan AI
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">Terima asisten personal finansial cerdas yang memberikan tips menghemat uang yang realistis.</p>
              </div>
            </div>

            {/* Info Google Consent */}
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Dengan masuk, aplikasi akan menghubungkan data keuangan Anda ke Google Drive dan Google Sheets secara aman untuk menyimpan log transaksi, dengan izin penuh dari Anda.
            </p>

            {/* Google Login Button */}
            <button
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="w-full cursor-pointer bg-white hover:bg-slate-100 disabled:bg-slate-200 transition-all duration-300 flex items-center justify-center rounded-2xl py-3 px-4 shadow-[0_4px_20px_rgba(255,255,255,0.06)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.15)] border border-slate-200 relative group active:scale-[0.98]"
              id="google-signin-btn"
            >
              <div className="flex items-center gap-3">
                <div className="gsi-material-button-icon shrink-0">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '20px', height: '20px' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                </div>
                <span className="font-semibold text-sm text-slate-800">
                  {isLoggingIn ? 'Menghubungkan Akun Google...' : 'Masuk dengan Google'}
                </span>
              </div>
            </button>

            <p className="text-[10px] text-slate-500 text-center leading-relaxed">
              Catatan: Jika login popup terblokir, sistem akan otomatis beralih ke mode pengalihan (redirect) halaman secara aman. Anda juga dapat membuka aplikasi di tab baru jika kendala berlanjut.
            </p>

            {/* Google OAuth Help / Unverified Block Solver */}
            <div className="mt-2 pt-2 border-t border-slate-800/40">
              <button
                type="button"
                onClick={() => setShowAuthHelp(!showAuthHelp)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[11px] text-amber-400 hover:text-amber-300 font-medium transition-colors bg-amber-500/5 hover:bg-amber-500/10 rounded-lg border border-amber-500/20"
              >
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Mengalami Error "Akses Diblokir"? Lihat Solusi 1 Menit</span>
              </button>

              <AnimatePresence>
                {showAuthHelp && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden mt-2.5"
                  >
                    <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-200/90 space-y-2 text-left leading-relaxed">
                      <p className="font-bold text-amber-400 text-[12px] flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Langkah Solusi Verifikasi Google (PENTING)
                      </p>
                      <p>
                        Error <strong>"Akses diblokir: responsible-augury-vszp9 belum menyelesaikan verifikasi Google"</strong> terjadi karena aplikasi meminta akses Google Sheets & Drive (sensitif) pada proyek Firebase yang belum dipublikasikan/diverifikasi resmi oleh Google.
                      </p>
                      <p className="font-semibold text-amber-300">
                        Cara mengatasinya sangat mudah dalam 1 menit:
                      </p>
                      <ol className="list-decimal pl-4 space-y-1.5 text-amber-200/80">
                        <li>
                          Buka <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline text-amber-400 hover:text-amber-300 font-semibold">Google Cloud Console</a> menggunakan akun Google pemilik Firebase Anda.
                        </li>
                        <li>
                          Pilih proyek <strong>responsible-augury-vszp9</strong> di bagian kiri atas.
                        </li>
                        <li>
                          Buka menu navigasi kiri, cari <strong>APIs & Services</strong> &gt; <strong>OAuth consent screen</strong>.
                        </li>
                        <li>
                          Gulir ke bagian bawah ke area <strong>Test Users (Pengguna uji coba)</strong>, lalu klik tombol <strong>+ ADD USERS</strong>.
                        </li>
                        <li>
                          Masukkan email Google Anda (<strong>nauvaleka3@gmail.com</strong>) yang akan digunakan untuk login di aplikasi ini, lalu klik <strong>Save</strong>.
                        </li>
                        <li>
                          Kembali ke aplikasi ini, muat ulang halaman, lalu klik <strong>Masuk dengan Google</strong>.
                        </li>
                        <li>
                          Saat muncul layar peringatan Google, klik opsi <strong>Lanjutan (Advanced)</strong> di bagian kiri bawah, lalu klik <strong>Buka/Lanjutkan ke responsible-augury-vszp9.firebaseapp.com (tidak aman)</strong> untuk login dengan sukses!
                        </li>
                      </ol>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      ) : (
        /* Main Application Interface */
        <div className="flex flex-col min-h-screen">
          {/* Header Navigation Bar */}
          <header className="bg-[#111114] border-b border-slate-800 py-4 px-6 sticky top-0 z-30 shadow-md" id="main-header">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* App branding */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/10">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-tight">Personal Finance Manager</h1>
                  <span className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">Real-Time Google Sheets Sync</span>
                </div>
              </div>

              {/* Central month selector and auth details */}
              <div className="flex flex-wrap items-center gap-4 justify-between md:justify-end">
                {/* Month Picker */}
                <div className="flex items-center gap-2 bg-[#18181B] border border-slate-800 rounded-xl px-3 py-1.5 shadow-sm">
                  <CalendarIcon className="w-4 h-4 text-emerald-400" />
                  <input
                    type="month"
                    value={currentMonth}
                    onChange={(e) => setCurrentMonth(e.target.value)}
                    className="bg-transparent border-none text-xs font-semibold text-slate-200 focus:outline-none scheme-dark"
                  />
                </div>

                {/* Account details */}
                <div className="flex items-center gap-3 border-l border-slate-800 pl-4">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-200">{user?.displayName}</p>
                    <p className="text-[10px] text-slate-400 max-w-[150px] truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 py-1.5 px-3 rounded-xl border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all shadow-sm text-xs font-semibold cursor-pointer"
                    title="Keluar Aplikasi"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar Aplikasi</span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* Full Width Info or Loading overlays */}
          {isInitializingSheets ? (
            <div className="flex-1 flex flex-col items-center justify-center py-24 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-400 mb-4" />
              <h3 className="text-base font-bold text-white">Menghubungkan Spreadsheet...</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                Menyiapkan template "Manajemen Keuangan Pribadi" di Google Drive & Google Sheets Anda. Harap tunggu sebentar.
              </p>
            </div>
          ) : sheetsError ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 text-center max-w-md mx-auto px-6">
              <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-400 mb-4 border border-rose-500/20">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Koneksi Google Sheets Gagal</h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">{sheetsError}</p>
              <div className="flex gap-3 mt-6">
                {sheetsError.includes('401') || sheetsError.includes('Sesi Google') ? (
                  <button
                    onClick={handleLogin}
                    className="py-2 px-5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-600 transition-colors font-bold text-xs shadow-sm cursor-pointer"
                  >
                    Masuk Kembali & Perbarui Sesi
                  </button>
                ) : (
                  <button
                    onClick={() => initializeGoogleSheets(accessToken!)}
                    className="py-2 px-5 rounded-xl bg-emerald-500 text-slate-950 hover:bg-emerald-600 transition-colors font-bold text-xs shadow-sm cursor-pointer"
                  >
                    Coba Hubungkan Kembali
                  </button>
                )}
                <button
                  onClick={handleLogout}
                  className="py-2 px-5 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800 transition-colors font-medium text-xs cursor-pointer"
                >
                  Keluar Akun
                </button>
              </div>
            </div>
          ) : (
            /* Main Content Container */
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
              {/* Syncing indicator banner */}
              {isSyncingSheet && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl px-4 py-2.5 text-xs font-semibold flex items-center gap-2 shadow-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
                  Mengirim perubahan real-time ke spreadsheet "Manajemen Keuangan Pribadi" Anda di Google Sheets...
                </div>
              )}

              {/* View/Tab switcher menu */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-px">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`py-2 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'dashboard'
                      ? 'border-emerald-500 text-emerald-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <LineChart className="w-4 h-4" />
                  Ringkasan Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`py-2 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'history'
                      ? 'border-emerald-500 text-emerald-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Laporan & Riwayat
                </button>
                <button
                  onClick={() => setActiveTab('scan')}
                  className={`py-2 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'scan'
                      ? 'border-emerald-500 text-emerald-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                  Pindai Struk Belanja
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`py-2 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
                    activeTab === 'ai'
                      ? 'border-emerald-500 text-emerald-400 font-bold'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  Asisten Keuangan AI
                </button>
              </div>

              {/* Active Tab View Rendering with AnimatePresence */}
              <div className="min-h-[400px]">
                <AnimatePresence mode="wait">
                  {activeTab === 'dashboard' && (
                    <motion.div
                      key="dashboard"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
                    >
                      {/* Left: Input, Right: Visuals */}
                      <div className="lg:col-span-1 space-y-6">
                        <TransactionForm
                          onAddTransactions={handleAddTransactions}
                          isLoadingSheet={isSyncingSheet}
                        />
                      </div>
                      <div className="lg:col-span-2">
                        <Dashboard
                          transactions={transactions}
                          currentMonth={currentMonth}
                        />
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'history' && (
                    <motion.div
                      key="history"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <MonthlyReportView
                        transactions={transactions}
                        currentMonth={currentMonth}
                        onDeleteTransaction={handleDeleteTransaction}
                        onUpdateTransaction={handleUpdateTransaction}
                        isSyncing={isSyncingSheet}
                        spreadsheetId={spreadsheetId}
                      />
                    </motion.div>
                  )}

                  {activeTab === 'scan' && (
                    <motion.div
                      key="scan"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ReceiptScanner
                        onAddTransactions={handleAddTransactions}
                        isLoadingSheet={isSyncingSheet}
                        onSuccess={() => setActiveTab('history')}
                      />
                    </motion.div>
                  )}

                  {activeTab === 'ai' && (
                    <motion.div
                      key="ai"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Insights
                        transactions={transactions}
                        currentMonth={currentMonth}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </main>
          )}

          {/* Footer Branding */}
          <footer className="py-6 border-t border-slate-800 bg-[#111114] text-center text-xs text-slate-500 mt-auto">
            <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="font-medium text-slate-400">© 2026 Personal Finance Manager.</span>
              <div className="flex gap-4">
                <span className="text-xxs uppercase tracking-wider text-emerald-400 font-semibold">Dibuat dengan Gemini AI & Google Sheets</span>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* Custom Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" id="logout-modal-root">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLogoutConfirm(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
              id="logout-modal-backdrop"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="w-full max-w-sm bg-[#111114] border border-slate-800 rounded-3xl p-6 shadow-2xl relative z-10 text-center space-y-4"
              id="logout-modal-container"
            >
              <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto" id="logout-icon-bg">
                <LogOut className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Keluar dari Aplikasi?</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Semua sesi Anda akan ditutup secara aman dan Anda akan dialihkan kembali ke halaman login.
                </p>
              </div>
              <div className="flex gap-3 pt-2" id="logout-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2 px-4 rounded-xl border border-slate-800 text-slate-300 hover:bg-slate-800/50 transition-colors font-medium text-xs cursor-pointer"
                  id="cancel-logout-btn"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmLogoutAction}
                  className="flex-1 py-2 px-4 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-colors font-bold text-xs shadow-md shadow-rose-600/10 cursor-pointer"
                  id="confirm-logout-btn"
                >
                  Ya, Keluar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
