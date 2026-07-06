import express from "express";
import cors from "cors";
// Pastikan nama package SDK yang Anda gunakan sudah sesuai, 
// ini adalah standard inisialisasi Google Gen AI SDK terbaru:
import { GoogleGenAI } from "@google/genai"; 

const app = express();
app.use(express.json());

// 1. Ambil API Key dari Environment Variable Vercel / Lokal
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("CRITICAL ERROR: GEMINI_API_KEY tidak ditemukan di environment variable!");
}

// 2. Inisialisasi Google Gen AI dengan API Key yang valid
const ai = new GoogleGenAI({ apiKey: apiKey });

// 3. Atur CORS agar Vercel mengizinkan request dari Frontend
app.use(cors({
  origin: ['https://amk-jade.vercel.app', 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

// 4. Handler Endpoint Financial Insights
app.post("/api/financial-insights", async (req, res) => {
  try {
    // Pastikan API Key ada sebelum memproses request
    if (!apiKey) {
      return res.status(500).json({ error: "Konfigurasi server salah: API Key Gemini belum diatur." });
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

    // Pemanggilan ke Gemini AI menggunakan penulisan SDK terbaru yang valid
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash", // Menggunakan model produksi yang stabil
      contents: prompt,
      generationConfig: {
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
      throw new Error("Gagal menerima analisis finansial dari Gemini.");
    }

    // Bersihkan format markdown block jika tidak sengaja dihasilkan oleh model
    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();

    // Kirim hasil JSON murni ke frontend
    return res.json(JSON.parse(resultText));
    
  } catch (error: any) {
    console.error("Gagal membuat insight keuangan:", error);
    return res.status(500).json({
      error: error.message || "Gagal membuat insight keuangan pribadi.",
    });
  }
});

// Export app untuk Vercel Serverless
export default app;
