import React, { useState } from 'react';
import { Plus, ArrowUpRight, ArrowDownRight, Wallet, Check, Loader2, Trash2 } from 'lucide-react';
import { Transaction } from '../types';

interface TransactionFormProps {
  onAddTransactions: (transactions: Omit<Transaction, 'id'>[]) => Promise<void> | void;
  isLoadingSheet: boolean;
}

export default function TransactionForm({ onAddTransactions, isLoadingSheet }: TransactionFormProps) {
  // Mode Selection: 'single' (transaksi tunggal) vs 'receipt' (rincian per item)
  const [entryMode, setEntryMode] = useState<'single' | 'receipt'>('single');

  // Shared states
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Makanan');
  const [paymentMethod, setPaymentMethod] = useState('Tunai');

  // Single mode states
  const [type, setType] = useState<'pemasukan' | 'pengeluaran'>('pengeluaran');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  // Receipt (multi-item) mode states
  const [merchantName, setMerchantName] = useState('');
  const [receiptItems, setReceiptItems] = useState<{ name: string; price: number; quantity: number; category: string }[]>([
    { name: '', price: 0, quantity: 1, category: 'Makanan' }
  ]);

  const categories = {
    pengeluaran: ['Makanan', 'Belanja', 'Transportasi', 'Hiburan', 'Tagihan', 'Kesehatan', 'Lainnya'],
    pemasukan: ['Gaji', 'Investasi', 'Bisnis', 'Hibah', 'Lainnya']
  };

  const paymentMethods = ['Tunai', 'Transfer Bank', 'Kartu Kredit', 'E-Wallet', 'Lainnya'];

  // Calculate total receipt amount dynamically
  const calculatedTotal = receiptItems.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

  // Handle single mode type change
  const handleTypeChange = (newType: 'pemasukan' | 'pengeluaran') => {
    setType(newType);
    setCategory(categories[newType][0]);
  };

  // Receipt mode item helpers
  const handleAddReceiptItem = () => {
    setReceiptItems([...receiptItems, { name: '', price: 0, quantity: 1, category }]);
  };

  const handleRemoveReceiptItem = (index: number) => {
    setReceiptItems(receiptItems.filter((_, idx) => idx !== index));
  };

  const handleReceiptItemChange = (index: number, key: 'name' | 'price' | 'quantity' | 'category', value: any) => {
    const updated = [...receiptItems];
    updated[index] = { ...updated[index], [key]: value } as any;
    setReceiptItems(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (entryMode === 'single') {
        if (!description.trim() || !amount || parseFloat(amount) <= 0) {
          alert('Mohon isi keterangan dan jumlah transaksi yang valid.');
          return;
        }

        await onAddTransactions([{
          date,
          category,
          description: description.trim(),
          amount: parseFloat(amount),
          type,
          paymentMethod,
          source: 'manual'
        }]);

        // Reset fields
        setDescription('');
        setAmount('');
      } else {
        if (!merchantName.trim()) {
          alert('Mohon isi nama toko / merchant.');
          return;
        }

        const validItems = receiptItems.filter(item => item.name.trim() !== '' && item.price > 0);
        if (validItems.length === 0) {
          alert('Mohon isi minimal satu rincian item belanja dengan harga valid.');
          return;
        }

        const txs: Omit<Transaction, 'id'>[] = validItems.map(item => ({
          date,
          category: item.category || category,
          description: `${merchantName.trim()} - ${item.name.trim()} (${item.quantity}x)`,
          amount: item.price * (item.quantity || 1),
          type: 'pengeluaran',
          paymentMethod,
          source: 'manual'
        }));

        await onAddTransactions(txs);

        alert('Berhasil mencatat rincian struk belanja per item!');
        // Reset receipt fields
        setMerchantName('');
        setReceiptItems([{ name: '', price: 0, quantity: 1 }]);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="bg-[#111114] rounded-2xl border border-slate-800 overflow-hidden shadow-xl" id="transaction-form-container">
      <div className="p-6 border-b border-slate-800 bg-slate-900/40">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-emerald-400" />
          Pencatatan Keuangan Manual
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">Catat rincian pengeluaran per item atau transaksi tunggal</p>
      </div>

      <div className="px-6 pt-4">
        {/* Entry Mode Tab Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900/60 rounded-xl border border-slate-800/40">
          <button
            type="button"
            onClick={() => {
              setEntryMode('single');
              setCategory(categories[type][0]);
            }}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              entryMode === 'single'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Transaksi Tunggal
          </button>
          <button
            type="button"
            onClick={() => {
              setEntryMode('receipt');
              setCategory('Belanja'); // default for shopping receipts
            }}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              entryMode === 'receipt'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Rincian Struk (Per Item)
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        {/* Toggle Type (Only for Single Mode) */}
        {entryMode === 'single' && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-900/60 rounded-xl">
            <button
              type="button"
              onClick={() => handleTypeChange('pengeluaran')}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'pengeluaran'
                  ? 'bg-rose-600/90 text-white shadow-sm font-bold border border-rose-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              Pengeluaran
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('pemasukan')}
              className={`py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                type === 'pemasukan'
                  ? 'bg-emerald-600/90 text-white shadow-sm font-bold border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/40'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Pemasukan
            </button>
          </div>
        )}

        {/* Merchant Name / Store Name (Only for Receipt Mode) */}
        {entryMode === 'receipt' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Nama Toko / Merchant</label>
            <input
              type="text"
              required={entryMode === 'receipt'}
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="e.g. Indomaret, Alfamart, Toko Kelontong"
              className="w-full px-3 py-2 border border-slate-800 rounded-lg text-sm focus:border-emerald-500 focus:outline-none text-slate-200 bg-[#18181B] placeholder-slate-600 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>
        )}

        {/* Dynamic Amount Input (Only for Single Mode) */}
        {entryMode === 'single' && (
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Jumlah (Rp)</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-sm text-slate-500 font-mono">IDR</span>
              </div>
              <input
                type="number"
                required={entryMode === 'single'}
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full pl-12 pr-3 py-2 border border-slate-800 rounded-lg text-sm focus:border-emerald-500 focus:outline-none font-medium text-slate-200 bg-[#18181B] placeholder-slate-600 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          </div>
        )}

        {/* Shared: Date & Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Tanggal</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-800 rounded-lg text-sm focus:border-emerald-500 focus:outline-none text-slate-200 bg-[#18181B] scheme-dark focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Kategori</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-800 rounded-lg text-sm focus:border-emerald-500 focus:outline-none bg-[#18181B] text-slate-200 focus:ring-1 focus:ring-emerald-500/20"
            >
              {entryMode === 'single' ? (
                categories[type].map((cat) => (
                  <option key={cat} value={cat} className="bg-[#18181B]">{cat}</option>
                ))
              ) : (
                categories.pengeluaran.map((cat) => (
                  <option key={cat} value={cat} className="bg-[#18181B]">{cat}</option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Multi-item Receipt List Section (Only for Receipt Mode) */}
        {entryMode === 'receipt' && (
          <div className="space-y-2 border border-slate-800/60 rounded-xl p-3 bg-slate-900/10">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-slate-300">Rincian Barang Belanja</span>
              <button
                type="button"
                onClick={handleAddReceiptItem}
                className="text-xxs text-emerald-400 hover:text-emerald-300 font-bold border border-emerald-500/25 bg-emerald-500/5 px-2 py-0.5 rounded cursor-pointer"
              >
                + Tambah Item
              </button>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {receiptItems.map((item, idx) => (
                <div key={idx} className="flex gap-1.5 items-center">
                  <input
                    type="text"
                    required={entryMode === 'receipt'}
                    placeholder="Nama barang"
                    value={item.name}
                    onChange={(e) => handleReceiptItemChange(idx, 'name', e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1 border border-slate-800 rounded text-xs bg-[#18181B] text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                  <select
                    value={item.category || category}
                    onChange={(e) => handleReceiptItemChange(idx, 'category', e.target.value)}
                    className="w-24 px-1 py-1 border border-slate-800 rounded text-xs bg-[#18181B] text-slate-200 focus:outline-none focus:border-emerald-500"
                  >
                    {categories.pengeluaran.map((cat) => (
                      <option key={cat} value={cat} className="bg-[#18181B]">{cat}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    required={entryMode === 'receipt'}
                    placeholder="Harga"
                    min="1"
                    value={item.price || ''}
                    onChange={(e) => handleReceiptItemChange(idx, 'price', parseFloat(e.target.value) || 0)}
                    className="w-16 px-1.5 py-1 border border-slate-800 rounded text-xs bg-[#18181B] text-slate-200 focus:outline-none focus:border-emerald-500 text-right"
                  />
                  <input
                    type="number"
                    required={entryMode === 'receipt'}
                    placeholder="Qty"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => handleReceiptItemChange(idx, 'quantity', parseInt(e.target.value) || 1)}
                    className="w-10 px-1 py-1 border border-slate-800 rounded text-xs bg-[#18181B] text-slate-200 focus:outline-none focus:border-emerald-500 text-center"
                  />
                  {receiptItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveReceiptItem(idx)}
                      className="text-slate-500 hover:text-rose-400 p-0.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Subtotal HUD for Receipt Mode */}
            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-medium">
              <span>Estimasi Total:</span>
              <span className="font-bold text-emerald-400">Rp {calculatedTotal.toLocaleString('id-ID')}</span>
            </div>
          </div>
        )}

        {/* Description & Payment Method (Only for Single Mode description, Payment Method is shared) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {entryMode === 'single' ? (
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Keterangan / Deskripsi</label>
              <input
                type="text"
                required={entryMode === 'single'}
                placeholder="e.g. Makan siang, Gaji Bulanan, Belanja"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-800 rounded-lg text-sm focus:border-emerald-500 focus:outline-none text-slate-200 bg-[#18181B] placeholder-slate-600 focus:ring-1 focus:ring-emerald-500/20"
              />
            </div>
          ) : (
            <div className="hidden md:block" />
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Metode Transaksi</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-800 rounded-lg text-sm focus:border-emerald-500 focus:outline-none bg-[#18181B] text-slate-200 focus:ring-1 focus:ring-emerald-500/20"
            >
              {paymentMethods.map((method) => (
                <option key={method} value={method} className="bg-[#18181B]">{method}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoadingSheet}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-55 cursor-pointer"
        >
          {isLoadingSheet ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Menyinkronkan ke Sheets...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4" />
              Catat Transaksi Baru
            </>
          )}
        </button>
      </form>
    </div>
  );
}
