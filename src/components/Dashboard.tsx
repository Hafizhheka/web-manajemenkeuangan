import React, { useMemo } from 'react';
import { ArrowUpRight, ArrowDownRight, TrendingUp, DollarSign, PieChart as PieIcon, Activity, Percent } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { Transaction } from '../types';

interface DashboardProps {
  transactions: Transaction[];
  currentMonth: string; // YYYY-MM
}

export default function Dashboard({ transactions, currentMonth }: DashboardProps) {
  // Format currency helper
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num);
  };

  // Filter transactions for selected month
  const monthlyTransactions = useMemo(() => {
    return transactions.filter(tx => tx.date.startsWith(currentMonth));
  }, [transactions, currentMonth]);

  // Aggregate stats
  const stats = useMemo(() => {
    let income = 0;
    let expenses = 0;

    monthlyTransactions.forEach(tx => {
      if (tx.type === 'pemasukan') {
        income += tx.amount;
      } else {
        expenses += tx.amount;
      }
    });

    const savings = income - expenses;
    const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

    return { income, expenses, savings, savingsRate };
  }, [monthlyTransactions]);

  // Expenses by category data for PieChart
  const categoryChartData = useMemo(() => {
    const categoriesMap: { [key: string]: number } = {};
    monthlyTransactions.forEach(tx => {
      if (tx.type === 'pengeluaran') {
        categoriesMap[tx.category] = (categoriesMap[tx.category] || 0) + tx.amount;
      }
    });

    return Object.keys(categoriesMap).map(cat => ({
      name: cat,
      value: categoriesMap[cat]
    })).sort((a, b) => b.value - a.value);
  }, [monthlyTransactions]);

  // Category colors map
  const COLORS = {
    'Makanan': '#F59E0B',      // Amber
    'Belanja': '#EC4899',      // Pink
    'Transportasi': '#3B82F6',  // Blue
    'Hiburan': '#8B5CF6',      // Purple
    'Tagihan': '#EF4444',      // Red
    'Kesehatan': '#10B981',    // Emerald
    'Lainnya': '#6B7280',      // Gray
  };

  // Daily cashflow chart data
  const trendChartData = useMemo(() => {
    const dailyMap: { [key: string]: { date: string; pemasukan: number; pengeluaran: number } } = {};
    
    // Sort transactions by date
    const sorted = [...monthlyTransactions].sort((a, b) => a.date.localeCompare(b.date));

    // Get all days in the selected month
    const [year, month] = currentMonth.split('-').map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    
    for (let d = 1; d <= totalDays; d++) {
      const dayStr = `${currentMonth}-${String(d).padStart(2, '0')}`;
      const shortDay = String(d);
      dailyMap[dayStr] = { date: shortDay, pemasukan: 0, pengeluaran: 0 };
    }

    sorted.forEach(tx => {
      if (dailyMap[tx.date]) {
        if (tx.type === 'pemasukan') {
          dailyMap[tx.date].pemasukan += tx.amount;
        } else {
          dailyMap[tx.date].pengeluaran += tx.amount;
        }
      }
    });

    return Object.values(dailyMap);
  }, [monthlyTransactions, currentMonth]);

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
    <div className="space-y-6" id="dashboard-tab">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Income */}
        <div className="bg-[#111114] p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Pemasukan</span>
            <div className="text-xl font-bold text-white">{formatIDR(stats.income)}</div>
            <span className="text-xs text-emerald-400 font-medium">Bulan {getMonthLabel(currentMonth)}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-[#111114] p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Pengeluaran</span>
            <div className="text-xl font-bold text-white">{formatIDR(stats.expenses)}</div>
            <span className="text-xs text-rose-400 font-medium">Bulan {getMonthLabel(currentMonth)}</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400">
            <ArrowDownRight className="w-6 h-6" />
          </div>
        </div>

        {/* Balance / Net Savings */}
        <div className="bg-[#111114] p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Tabungan Bersih</span>
            <div className={`text-xl font-bold ${stats.savings >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {formatIDR(stats.savings)}
            </div>
            <span className="text-xs text-slate-500">Total surplus/defisit</span>
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stats.savings >= 0 ? 'bg-teal-500/10 text-teal-400' : 'bg-rose-500/10 text-rose-400'}`}>
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Savings Rate */}
        <div className="bg-[#111114] p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rasio Tabungan</span>
            <div className="text-xl font-bold text-white">{stats.savingsRate}%</div>
            <span className="text-xs text-slate-500">Target ideal &gt; 20%</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
            <Percent className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cashflow Trend Area Chart */}
        <div className="bg-[#111114] p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" />
                Tren Arus Kas Bulanan
              </h3>
              <p className="text-xs text-slate-400">Perkembangan pengeluaran vs pemasukan harian</p>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPemasukan" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPengeluaran" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1E293B" />
                <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={10} tickLine={false} tickFormatter={(v) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                <Tooltip
                  formatter={(value: number) => [formatIDR(value), '']}
                  labelFormatter={(label) => `Tanggal ${label}`}
                  contentStyle={{ backgroundColor: '#111114', borderRadius: '12px', border: '1px solid #1E293B', color: '#F1F5F9', fontSize: '12px' }}
                />
                <Area type="monotone" dataKey="pemasukan" name="Pemasukan" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorPemasukan)" />
                <Area type="monotone" dataKey="pengeluaran" name="Pengeluaran" stroke="#EF4444" strokeWidth={2} fillOpacity={1} fill="url(#colorPengeluaran)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Pie Chart */}
        <div className="bg-[#111114] p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <PieIcon className="w-5 h-5 text-amber-400" />
              Pengeluaran per Kategori
            </h3>
            <p className="text-xs text-slate-400">Komposisi pengeluaran terbesar Anda</p>
          </div>

          <div className="h-64 w-full flex items-center justify-center relative">
            {categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[entry.name as keyof typeof COLORS] || '#64748B'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number) => formatIDR(v)}
                    contentStyle={{ backgroundColor: '#111114', borderRadius: '12px', border: '1px solid #1E293B', color: '#F1F5F9', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-xs text-slate-500">Belum ada pengeluaran di bulan ini.</div>
            )}
            {categoryChartData.length > 0 && (
              <div className="absolute flex flex-col items-center">
                <span className="text-xxs font-semibold uppercase tracking-wider text-slate-400">Total Belanja</span>
                <span className="text-sm font-bold text-white">{formatIDR(stats.expenses)}</span>
              </div>
            )}
          </div>

          {/* Legend Items */}
          <div className="space-y-1.5 overflow-y-auto max-h-32 mt-2">
            {categoryChartData.map((entry) => {
              const percentage = stats.expenses > 0 ? Math.round((entry.value / stats.expenses) * 100) : 0;
              const color = COLORS[entry.name as keyof typeof COLORS] || '#64748B';
              return (
                <div key={entry.name} className="flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="font-medium text-slate-300">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono">
                    <span className="text-slate-200">{formatIDR(entry.value)}</span>
                    <span className="text-slate-500 font-medium text-xxs w-6 text-right">{percentage}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
