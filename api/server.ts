import express from "express";
import path from "path";
import dotenv from "dotenv";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";

// Load environment variables
dotenv.config();

const app = express();

// Set up json parser with high limits for image uploads
app.use(express.json({ limit: "15mb" }));

// Atur CORS agar Vercel mengizinkan request dari frontend produksi dan lokal
app.use(cors({
  origin: ['https://amk-jade.vercel.app', 'http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true
}));

const apiKey = process.env.GEMINI_API_KEY;

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper to parse base64 data URLs
function parseDataUrl(dataUrl: string) {
  const matches = dataUrl.match(
    /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/,
  );
  if (!matches) {
    return { mimeType: "image/jpeg", data: dataUrl };
  }
  return {
    mimeType: matches[1],
    data: matches[2],
  };
}

// API Route: Scan Receipt
app.post("/api/scan-receipt", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({ error: "API Key Gemini belum dikonfigurasi di server Vercel." });
    }

    const { image } = req.body;
    if (!image) {
      return res
        .status(400)
        .json({ error: "Foto struk belanja diperlukan (format base64)." });
    }

    const { mimeType, data } = parseDataUrl(image);

    const imagePart = {
      inlineData: {
        mimeType,
        data,
      },
    };

    const textPart = {
      text: "Analisis gambar struk belanja ini secara detail. Ambil informasi nama toko (merchantName), tanggal transaksi (date dalam format YYYY-MM-DD), total jumlah biaya (totalAmount), daftar barang yang dibeli (items berisi name, price, quantity, dan category yaitu saran kategori pengeluaran per-item seperti Makanan, Belanja, Transportasi, Hiburan, Tagihan, Kesehatan, atau Lainnya), serta saran kategori pengeluaran umum yang cocok untuk keseluruhan struk. Pastikan semua teks diekstrak dengan akurat dalam Bahasa Indonesia.",
    };

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [imagePart, textPart],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            merchantName: {
              type: "string",
              description: "Nama toko, supermarket atau merchant",
            },
            date: {
              type: "string",
              description: "Tanggal transaksi dalam format YYYY-MM-DD",
            },
            totalAmount: {
              type: "number",
              description: "Total pembayaran/belanja di struk",
            },
            category: {
              type: "string",
              description: "Kategori pengeluaran umum yang cocok (Makanan, Belanja, Transportasi, Hiburan, Kesehatan, Tagihan, Lainnya)",
            },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Nama barang yang dibeli",
                  },
                  price: { type: "number", description: "Harga barang" },
                  quantity: {
                    type: "number",
                    description: "Jumlah barang yang dibeli",
                  },
                  category: {
                    type: "string",
                    description: "Kategori pengeluaran yang cocok untuk barang spesifik ini (Makanan, Belanja, Transportasi, Hiburan, Kesehatan, Tagihan, Lainnya)",
                  },
                },
                required: ["name", "price", "category"],
              },
              description: "Daftar barang-barang di struk",
            },
            confidence: {
              type: "number",
              description: "Skor keyakinan analisis dari 0.0 hingga 1.0",
            },
          },
          required: [
            "merchantName",
            "date",
            "totalAmount",
            "category",
            "items",
          ],
        },
      },
    });

    let resultText = response.text;
    if (!resultText) {
      throw new Error("Gagal menerima hasil analisis dari Gemini.");
    }

    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    return res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Gagal melakukan scan struk:", error);
    return res.status(500).json({
      error: error.message || "Gagal memproses struk belanja menggunakan AI.",
    });
  }
});

// API Route: Financial Insights
app.post("/api/financial-insights", async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({ error: "API Key Gemini belum dikonfigurasi di server Vercel." });
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

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
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

    resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
    return res.json(JSON.parse(resultText));
  } catch (error: any) {
    console.error("Gagal membuat insight keuangan:", error);
    return res.status(500).json({
      error: error.message || "Gagal membuat insight keuangan pribadi.",
    });
  }
});

// Penanganan Environment Lokal (SDA/SIISD Development)
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server keuangan pribadi berjalan lokal di http://localhost:${PORT}`);
  });
}

export default app;
