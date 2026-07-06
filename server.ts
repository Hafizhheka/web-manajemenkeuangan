import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Set up json parser with high limits for image uploads
app.use(express.json({ limit: "15mb" }));

// Initialize Gemini Client with standard User-Agent header for telemetry
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
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
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            merchantName: {
              type: Type.STRING,
              description: "Nama toko, supermarket atau merchant",
            },
            date: {
              type: Type.STRING,
              description: "Tanggal transaksi dalam format YYYY-MM-DD",
            },
            totalAmount: {
              type: Type.NUMBER,
              description: "Total pembayaran/belanja di struk",
            },
            category: {
              type: Type.STRING,
              description:
                "Kategori pengeluaran umum yang cocok (Makanan, Belanja, Transportasi, Hiburan, Kesehatan, Tagihan, Lainnya)",
            },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "Nama barang yang dibeli",
                  },
                  price: { type: Type.NUMBER, description: "Harga barang" },
                  quantity: {
                    type: Type.NUMBER,
                    description: "Jumlah barang yang dibeli",
                  },
                  category: {
                    type: Type.STRING,
                    description:
                      "Kategori pengeluaran yang cocok untuk barang spesifik ini (Makanan, Belanja, Transportasi, Hiburan, Kesehatan, Tagihan, Lainnya)",
                  },
                },
                required: ["name", "price", "category"],
              },
              description: "Daftar barang-barang di struk",
            },
            confidence: {
              type: Type.NUMBER,
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

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Gagal menerima hasil analisis dari Gemini.");
    }

    const receiptData = JSON.parse(resultText.trim());
    res.json(receiptData);
  } catch (error: any) {
    console.error("Gagal melakukan scan struk:", error);
    res.status(500).json({
      error: error.message || "Gagal memproses struk belanja menggunakan AI.",
    });
  }
});

// API Route: Financial Insights
app.post("/api/financial-insights", async (req, res) => {
  try {
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
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description:
                "Ringkasan singkat kondisi keuangan bulan ini dalam 2-3 kalimat yang bersahabat.",
            },
            tips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "3 tips hemat praktis dan konkret yang disesuaikan dengan pola pengeluaran di atas.",
            },
            warnings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description:
                "Daftar peringatan jika ada kategori pengeluaran yang membengkak atau melebihi budget (kosongkan array jika keuangan aman).",
            },
            recommendation: {
              type: Type.STRING,
              description:
                "Rekomendasi utama atau kata-kata motivasi untuk bulan depan.",
            },
          },
          required: ["summary", "tips", "warnings", "recommendation"],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Gagal menerima analisis finansial dari Gemini.");
    }

    res.json(JSON.parse(resultText.trim()));
  } catch (error: any) {
    console.error("Gagal membuat insight keuangan:", error);
    res.status(500).json({
      error: error.message || "Gagal membuat insight keuangan pribadi.",
    });
  }
});

// Start Server & Handle Vite Assets Setup
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (process.env.NODE_ENV !== "production") {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `Server keuangan pribadi berjalan di http://localhost:${PORT}`,
      );
    });
  }
}
export default app;

start();
