export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  category: string;
  description: string;
  amount: number;
  type: 'pemasukan' | 'pengeluaran';
  paymentMethod: string;
  source: 'manual' | 'receipt';
  receiptImageUrl?: string;
}

export interface ReceiptItem {
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

export interface ScannedReceipt {
  merchantName: string;
  date: string;
  totalAmount: number;
  items: ReceiptItem[];
  category: string;
  confidence: number;
}

export interface MonthlyBudget {
  category: string;
  limit: number;
}
