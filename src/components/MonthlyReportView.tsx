import React, { useState } from 'react';
import { Calendar, Trash2, Download, Table, ExternalLink, RefreshCcw, CheckCircle, HelpCircle, FileDown, Edit2, Check, X, Loader2 } from 'lucide-react';
import { Transaction } from '../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MonthlyReportViewProps {
  transactions: Transaction[];
  currentMonth: string;
  onDeleteTransaction: (id: string) => void;
  onUpdateTransaction: (tx: Transaction) => Promise<void> | void;
  isSyncing: boolean;
  spreadsheetId: string | null;
}

export default function MonthlyReportView({
  transactions,
  currentMonth,
  onDeleteTransaction,
  onUpdateTransaction,
  isSyncing,
  spreadsheetId
}: MonthlyReportViewProps) {

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(num);
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Transaction | null>(null);

  const handleEditClick = (tx: Transaction) => {
    setEditingId(tx.id);
    setEditForm({ ...tx });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = async () => {
    if (!editForm) return;
    if (!editForm.description.trim()) {
      alert('Deskripsi transaksi tidak boleh kosong.');
      return;
    }
    if (editForm.amount <= 0) {
      alert('Jumlah transaksi harus lebih dari Rp 0.');
      return;
    }

    try {
      await onUpdateTransaction(editForm);
      setEditingId(null);
      setEditForm(null);
    } catch (err: any) {
      alert(`Gagal memperbarui transaksi: ${err.message || err}`);
    }
  };

  const filteredTransactions = transactions
    .filter(tx => tx.date.startsWith(currentMonth))
    .sort((a, b) => b.date.localeCompare(a.date));

  // Export current month transactions to PDF
  const handleExportPDF = () => {
    if (filteredTransactions.length === 0) {
      alert('Tidak ada data transaksi untuk diekspor pada bulan ini.');
      return;
    }

    try {
      const doc = new jsPDF();
      
      // Header Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text('MANAJER KEUANGAN PRIBADI', 14, 20);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Slate-500
      doc.text(`Laporan Bulanan & Riwayat Transaksi - Bulan ${getMonthLabel(currentMonth)}`, 14, 26);
      doc.text(`Dibuat secara otomatis oleh AI & Google Sheets pada ${new Date().toLocaleDateString('id-ID')}`, 14, 31);
      
      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 35, 196, 35);

      // Financial statistics computation
      let totalIncome = 0;
      let totalExpenses = 0;
      filteredTransactions.forEach(tx => {
        if (tx.type === 'pemasukan') {
          totalIncome += tx.amount;
        } else {
          totalExpenses += tx.amount;
        }
      });
      const balance = totalIncome - totalExpenses;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text('RINGKASAN LAPORAN KEUANGAN:', 14, 44);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Pemasukan: ${formatIDR(totalIncome)}`, 14, 50);
      doc.text(`Total Pengeluaran: ${formatIDR(totalExpenses)}`, 75, 50);
      
      if (balance >= 0) {
        doc.setTextColor(16, 185, 129); // Emerald
      } else {
        doc.setTextColor(239, 68, 68); // Red
      }
      doc.setFont('helvetica', 'bold');
      doc.text(`Tabungan Bersih: ${formatIDR(balance)}`, 135, 50);

      // Divider line
      doc.setDrawColor(226, 232, 240);
      doc.line(14, 54, 196, 54);

      // Table headers & row mapping
      const tableHeaders = [['Tanggal', 'Kategori', 'Keterangan', 'Metode', 'Jumlah (IDR)']];
      const tableRows = filteredTransactions.map(tx => [
        tx.date,
        tx.category,
        tx.description,
        tx.paymentMethod,
        `${tx.type === 'pemasukan' ? '+' : '-'} ${tx.amount.toLocaleString('id-ID')}`
      ]);

      // Generate AutoTable using jspdf-autotable extended API
      autoTable(doc, {
        startY: 59,
        head: tableHeaders,
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [16, 185, 129], // Emerald
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [51, 65, 85]
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 25 },
          2: { cellWidth: 80 },
          3: { cellWidth: 22 },
          4: { cellWidth: 30, halign: 'right' }
        },
        styles: {
          font: 'helvetica'
        }
      });

      doc.save(`Laporan_Keuangan_${currentMonth}.pdf`);
    } catch (err: any) {
      console.error('Failed to generate PDF:', err);
      alert(`Gagal mengekstrak PDF: ${err.message}`);
    }
  };

  // Handle delete transaction with explicit modal/confirmation dialog
  const handleDeleteClick = (tx: Transaction) => {
    const isConfirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus transaksi "${tx.description}" sebesar ${formatIDR(tx.amount)}?\n\nTindakan ini akan menghapus data dari aplikasi dan Google Sheets Anda.`
    );
    if (isConfirmed) {
      onDeleteTransaction(tx.id);
    }
  };

  // Export current month transactions to CSV (Excel compatible)
  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) {
      alert('Tidak ada data transaksi untuk diekspor pada bulan ini.');
      return;
    }

    // CSV header
    let csvContent = 'ID,Tanggal,Kategori,Keterangan,Jumlah (IDR),Tipe,Metode Pembayaran,Sumber\n';

    // Add rows
    filteredTransactions.forEach(tx => {
      const row = [
        tx.id,
        tx.date,
        `"${tx.category.replace(/"/g, '""')}"`,
        `"${tx.description.replace(/"/g, '""')}"`,
        tx.amount,
        tx.type,
        `"${tx.paymentMethod.replace(/"/g, '""')}"`,
        tx.source
      ].join(',');
      csvContent += row + '\n';
    });

    // Create a blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Keuangan_${currentMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  const getMonthLabel = (mString: string) => {
    if (!mString) return '';
    const [year, month] = mString.split('-');
    return `${monthNames[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className="bg-[#111114] rounded-2xl border border-slate-800 overflow-hidden" id="monthly-report-tab">
      {/* Header section with Actions */}
      <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/40">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Laporan Bulanan & Riwayat Transaksi
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Analisis pengeluaran terperinci untuk bulan {getMonthLabel(currentMonth)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Google Sheets Link */}
          {spreadsheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="py-2 px-3 rounded-lg border border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 font-medium text-xs flex items-center gap-1.5 transition-colors"
            >
              <Table className="w-3.5 h-3.5" />
              Buka Google Sheets
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Excel CSV Export */}
          <button
            onClick={handleExportCSV}
            className="py-2 px-3 rounded-lg border border-slate-800 text-slate-200 bg-[#18181B] hover:bg-slate-800/80 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            Ekspor ke Excel (CSV)
          </button>

          {/* PDF Export */}
          <button
            onClick={handleExportPDF}
            className="py-2 px-3 rounded-lg border border-rose-500/20 text-rose-400 bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/30 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5 text-rose-400" />
            Ekspor ke PDF
          </button>
        </div>
      </div>

      {/* Sync Status Banner */}
      <div className="px-6 py-2.5 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          {isSyncing ? (
            <>
              <RefreshCcw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-amber-400 font-medium">Sedang menyinkronkan data dengan Google Sheets...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">Data tersinkronisasi 100% secara real-time dengan Google Sheets.</span>
            </>
          )}
        </div>
        <span className="text-xxs text-slate-500 font-mono">Real-time Sync</span>
      </div>

      {/* Transaction List Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-900/20">
              <th className="px-6 py-3 text-xxs font-bold text-slate-400 uppercase tracking-wider">Tanggal</th>
              <th className="px-6 py-3 text-xxs font-bold text-slate-400 uppercase tracking-wider">Kategori</th>
              <th className="px-6 py-3 text-xxs font-bold text-slate-400 uppercase tracking-wider">Keterangan</th>
              <th className="px-6 py-3 text-xxs font-bold text-slate-400 uppercase tracking-wider">Metode</th>
              <th className="px-6 py-3 text-xxs font-bold text-slate-400 uppercase tracking-wider text-right">Jumlah</th>
              <th className="px-6 py-3 text-xxs font-bold text-slate-400 uppercase tracking-wider text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredTransactions.map((tx) => {
              const isEditing = editingId === tx.id;
              if (isEditing && editForm) {
                const currentCategories = editForm.type === 'pemasukan'
                  ? ['Gaji', 'Investasi', 'Bisnis', 'Hibah', 'Lainnya']
                  : ['Makanan', 'Belanja', 'Transportasi', 'Hiburan', 'Tagihan', 'Kesehatan', 'Lainnya'];
                return (
                  <tr key={tx.id} className="bg-slate-900/60 border-l-4 border-emerald-500 transition-colors">
                    <td className="px-6 py-3">
                      <input
                        type="date"
                        required
                        value={editForm.date}
                        onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500 scheme-dark"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <select
                        value={editForm.category}
                        onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {currentCategories.map((cat) => (
                          <option key={cat} value={cat} className="bg-[#111114]">{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        required
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                        placeholder="Keterangan transaksi"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <select
                        value={editForm.paymentMethod}
                        onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                        className="w-full px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500"
                      >
                        {['Tunai', 'Transfer Bank', 'Kartu Kredit', 'E-Wallet', 'Lainnya'].map((method) => (
                          <option key={method} value={method} className="bg-[#111114]">{method}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <select
                          value={editForm.type}
                          onChange={(e) => {
                            const newType = e.target.value as 'pemasukan' | 'pengeluaran';
                            const cats = newType === 'pemasukan'
                              ? ['Gaji', 'Investasi', 'Bisnis', 'Hibah', 'Lainnya']
                              : ['Makanan', 'Belanja', 'Transportasi', 'Hiburan', 'Tagihan', 'Kesehatan', 'Lainnya'];
                            setEditForm({ ...editForm, type: newType, category: cats[0] });
                          }}
                          className="px-1.5 py-1 bg-slate-950 border border-slate-800 rounded text-xxs text-white focus:outline-none focus:border-emerald-500"
                        >
                          <option value="pengeluaran">(-)</option>
                          <option value="pemasukan">(+)</option>
                        </select>
                        <input
                          type="number"
                          required
                          min="1"
                          value={editForm.amount}
                          onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white focus:outline-none focus:border-emerald-500 text-right"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={handleSaveEdit}
                          disabled={isSyncing}
                          className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded transition-all cursor-pointer disabled:opacity-40"
                          title="Simpan Perubahan"
                        >
                          {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={isSyncing}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer disabled:opacity-40"
                          title="Batal"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }

              return (
                <tr key={tx.id} className="hover:bg-slate-800/20 transition-colors">
                  <td className="px-6 py-4 text-xs font-medium text-slate-400 font-mono">{tx.date}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xxs font-semibold ${
                      tx.type === 'pemasukan' 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {tx.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-200 max-w-xs truncate" title={tx.description}>
                    {tx.description}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">{tx.paymentMethod}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`text-xs font-bold ${tx.type === 'pemasukan' ? 'text-emerald-400' : 'text-white'}`}>
                      {tx.type === 'pemasukan' ? '+' : '-'} {formatIDR(tx.amount)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleEditClick(tx)}
                        disabled={isSyncing}
                        className="p-1 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded transition-all cursor-pointer disabled:opacity-40"
                        title="Edit Transaksi"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(tx)}
                        disabled={isSyncing}
                        className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all cursor-pointer disabled:opacity-40"
                        title="Hapus Transaksi"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                  Belum ada transaksi tercatat untuk bulan ini.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
