import React, { useState, useEffect } from 'react';
import { Sparkles, Brain, Loader2, Lightbulb, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { Transaction } from '../types';

interface InsightsProps {
  transactions: Transaction[];
  currentMonth: string;
}

interface AIInsights {
  summary: string;
  tips: string[];
  warnings: string[];
  recommendation: string;
}

export default function Insights({ transactions, currentMonth }: InsightsProps) {
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    if (transactions.length === 0) {
      setInsights(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Filter only current month transactions to keep request small and relevant
      const currentMonthTxs = transactions.filter(tx => tx.date.startsWith(currentMonth));

      const response = await fetch('/api/financial-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactions: currentMonthTxs
        })
      });

      if (!response.ok) {
        throw new Error('Gagal mendapatkan insight finansial dari asisten AI.');
      }

      const data = await response.json();
      setInsights(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal memuat analisis keuangan pribadi Anda.');
    } finally {
      setIsLoading(false);
    }
  };

  // Automatically trigger fetch when current month transactions change
  useEffect(() => {
    if (transactions.length > 0) {
      fetchInsights();
    } else {
      setInsights(null);
    }
  }, [currentMonth, transactions.length]);

  return (
    <div className="bg-[#111114] rounded-2xl border border-slate-800 overflow-hidden" id="ai-insights-container">
      <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            Rekomendasi & Analisis AI Finansial
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Asisten keuangan pribadi cerdas yang ditenagai oleh Gemini AI</p>
        </div>

        {transactions.length > 0 && (
          <button
            onClick={fetchInsights}
            disabled={isLoading}
            className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:bg-slate-850 hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
            title="Muat Ulang Analisis"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <div className="p-6">
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            Belum ada transaksi tercatat untuk bulan ini. Masukkan transaksi atau pindai struk untuk menerima analisis AI.
          </div>
        ) : isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400 mb-3" />
            <p className="text-sm font-semibold text-slate-200">Menganalisis log transaksi Anda...</p>
            <p className="text-xs text-slate-500 mt-1">Gemini AI sedang menghitung kesehatan finansial & menyusun tips hemat</p>
          </div>
        ) : error ? (
          <div className="text-center py-6">
            <p className="text-sm text-rose-400 mb-4">{error}</p>
            <button
              onClick={fetchInsights}
              className="py-2 px-4 rounded-xl bg-violet-500 hover:bg-violet-600 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        ) : insights ? (
          <div className="space-y-6">
            {/* AI Summary Banner */}
            <div className="p-4 bg-violet-500/5 rounded-xl border border-violet-500/20 flex gap-3.5 items-start">
              <Brain className="w-6 h-6 text-violet-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-violet-300 uppercase tracking-wide">Ringkasan Bulan Ini</h4>
                <p className="text-xs text-slate-300 leading-relaxed mt-1">{insights.summary}</p>
              </div>
            </div>

            {/* Warnings, Tips & Recommendations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Warnings & Suggestions */}
              <div className="space-y-4">
                {insights.warnings && insights.warnings.length > 0 ? (
                  <div className="p-4 bg-amber-500/5 rounded-xl border border-amber-500/20">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wide mb-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Peringatan Pengeluaran
                    </div>
                    <ul className="list-disc list-inside text-xs text-slate-300 space-y-1.5 pl-1 leading-relaxed">
                      {insights.warnings.map((warn, i) => (
                        <li key={i}>{warn}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/20 flex gap-3 items-start">
                    <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wide">Keuangan Sehat!</h4>
                      <p className="text-xxs text-slate-400 mt-0.5 leading-relaxed">Selamat! Pengeluaran Anda terkendali dengan baik dan tidak ada anomali biaya bulan ini.</p>
                    </div>
                  </div>
                )}

                {/* Main Recommendation */}
                <div className="p-4 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
                  <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wide mb-1">Rekomendasi Utama</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{insights.recommendation}</p>
                </div>
              </div>

              {/* Tips Hemat */}
              <div className="p-4 bg-teal-500/5 rounded-xl border border-teal-500/20 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-teal-400 font-semibold text-xs uppercase tracking-wide mb-3">
                    <Lightbulb className="w-4 h-4 text-teal-400" />
                    Tips Hemat Praktis
                  </div>
                  <ul className="space-y-2.5">
                    {insights.tips.map((tip, i) => (
                      <li key={i} className="flex gap-2 items-start text-xs text-slate-300 leading-relaxed">
                        <span className="w-5 h-5 rounded-full bg-teal-500/10 text-teal-400 text-xxs font-bold flex items-center justify-center shrink-0 mt-0.5">{i+1}</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <button
              onClick={fetchInsights}
              className="py-2.5 px-5 rounded-xl bg-violet-500 hover:bg-violet-600 text-slate-950 font-bold text-xs transition-colors shadow-sm inline-flex items-center gap-2 cursor-pointer"
            >
              <Brain className="w-4 h-4" />
              Mulai Analisis Keuangan Pribadi AI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
