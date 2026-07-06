import express from "express";
import cors from "cors";
// Menggunakan inisialisasi resmi dari SDK @google/genai terbaru
import { GoogleGenAI } from "@google/genai"; 

const app = express();

// Middleware wajib untuk membaca body request berformat JSON
app.use(express.json());

// 1. Ambil API Key dari Environment Variable Vercel atau Lokal
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("PERINGATAN: GEMINI_API_KEY tidak terdeteksi di server!");
}

// 2. Inisialisasi instance Google Gen AI
const ai = new GoogleGenAI({ apiKey: apiKey });

// 3. Konfigurasi CORS agar Vercel mengizinkan request dari frontend Anda
app.use(cors({
  origin: [
    'https://amk-jade.vercel.app', 
    'http://localhost:5173', 
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// 4. Endpoint utama untuk Asisten Keuangan AI
app.post("/api/financial-insights", async (req, res) => {
  try {
    // Validasi awal jika API Key belum terpasang di serverless function
    if (!apiKey) {
      return res.status(500).json({ 
        error: "Konfigurasi server salah: API Key Gemini belum diatur di dashboard Vercel." 
      });
    }

    const { transactions, monthlyBudget } = req.body;

    if (!transactions || !Array.isArray(transactions)) {
      return res.status(400).json({ error: "Data transaksi tidak valid." });
    }

    const budgetText = monthlyBudget
      ? `Anggaran pengeluaran bulanan pengguna adalah: ${JSON.stringify(monthlyBudget)}`
      : "Pengguna belum menetapkan batasan anggaran spesifik.";

    const prompt = `
Anda adalah asisten keuangan pribadi AI cerdas yang bersahabat. Berikan analisis keuangan pribadi, tips hemat, dan peringatan anggaran berdasarkan log transaksi pengeluaran pengguna bulan ini dalam Bahasa Indonesia.

Berikut data transaksi keuangan bulan ini:
${JSON.stringify(transactions, null, 2)}

${budgetText}

Analisis data di atas dan buatlah ringkasan kondisi keuangan mereka, tips praktis yang spesifik berdasarkan kebiasaan belanja mereka, dan peringatan jika ada pengeluaran berlebih di kategori tertentu. Berikan saran yang ramah dan memotivasi.
`;

    // Pemanggilan Gemini menggunakan struktur SDK Google Gen AI terbaru yang valid
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", // Menggunakan model produksi yang cepat dan stabil
      contents: prompt,
      generationConfig: {        // Struktur konfigurasi schema yang benar
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            summary: {
              type: "string",
              description: "Ringkasan singkat kondisi keuangan bulan ini dalam 2-3 kalimat yang bersahabat.",
            },
            tips: {
              type: "array",
              items: { type: "string" },
              description: "3 tips hemat praktis dan konkret yang disesuaikan dengan pola pengeluaran di atas.",
            },
            warnings: {
              type: "array",
              items: { type: "string" },
              description: "Daftar peringatan jika ada kategori pengeluaran yang membengkak atau melebihi budget (kosongkan array jika keuangan aman).",
            },
            recommendation: {
              type: "string",
              description: "Rekomendasi utama atau kata-kata motivasi untuk bulan depan.",
            },
          },
          required: ["summary", "tips", "warnings", "recommendation"],
        },
      },
    });

    let resultText = response.text;
    if (!resultText) {
      throw new Error("Gagal menerima teks analisis finansial dari Gemini.");
    }

    // Antisipasi pembersihan jika Gemini tidak sengaja membungkusnya dengan markdown ```json
    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();

    // Kirimkan response objek JSON murni kembali ke frontend
    return res.json(JSON.parse(resultText));
    
  } catch (error: any) {
    console.error("Gagal membuat insight keuangan:", error);
    return res.status(500).json({
      error: error.message || "Gagal membuat insight keuangan pribadi.",
    });
  }
});

// Export app agar bisa dikenali oleh Vercel Serverless Functions
export default app;
