import { Transaction } from '../types';

// Cache sheetId of 'Transaksi' to perform operations like delete row
let transaksiSheetId: number | null = null;

// Helper to get Google API request headers
const getHeaders = (accessToken: string) => ({
  'Authorization': `Bearer ${accessToken}`,
  'Content-Type': 'application/json'
});

/**
 * Searches for a spreadsheet named "Manajemen Keuangan Pribadi" in the user's Drive.
 * If not found or if Drive search fails, attempts to use or create a new spreadsheet and
 * caches the ID in localStorage for high availability.
 */
export async function findOrCreateSpreadsheet(accessToken: string): Promise<string> {
  try {
    // 1. First check if we have a verified cached spreadsheet ID in localStorage
    const cachedId = localStorage.getItem('google_spreadsheet_id');
    if (cachedId) {
      try {
        transaksiSheetId = null;
        await fetchSheetMetadata(accessToken, cachedId);
        if (transaksiSheetId !== null) {
          console.log('Using verified cached spreadsheet ID from localStorage:', cachedId);
          return cachedId;
        }
      } catch (e) {
        console.warn('Cached spreadsheet is not accessible, searching or creating a new one...', e);
      }
    }

    // 2. Search for the file using Drive API search
    let searchData: any = null;
    try {
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=name='Manajemen Keuangan Pribadi' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
      const searchResponse = await fetch(searchUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (searchResponse.ok) {
        searchData = await searchResponse.json();
      } else {
        const errText = await searchResponse.text();
        console.warn(`Drive search API responded with status ${searchResponse.status}: ${errText}`);
      }
    } catch (e) {
      console.warn('Drive search API call failed (might be disabled in Google Cloud project):', e);
    }

    if (searchData && searchData.files && searchData.files.length > 0) {
      const spreadsheetId = searchData.files[0].id;
      // Get Transaksi sheetId
      await fetchSheetMetadata(accessToken, spreadsheetId);
      if (transaksiSheetId !== null) {
        localStorage.setItem('google_spreadsheet_id', spreadsheetId);
        return spreadsheetId;
      }
    }

    // 3. Drive search failed or not found, fallback: Create a new spreadsheet using Sheets API
    console.log('Creating a new spreadsheet "Manajemen Keuangan Pribadi" using Sheets API...');
    const createUrl = 'https://sheets.googleapis.com/v4/spreadsheets';
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: getHeaders(accessToken),
      body: JSON.stringify({
        properties: {
          title: 'Manajemen Keuangan Pribadi'
        },
        sheets: [
          {
            properties: {
              title: 'Transaksi',
              gridProperties: {
                frozenRowCount: 1
              }
            }
          },
          {
            properties: {
              title: 'Ringkasan'
            }
          }
        ]
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Gagal membuat spreadsheet baru di Google Sheets. Status: ${createResponse.status}, Detail: ${errorText}`);
    }

    const newSheet = await createResponse.json();
    const spreadsheetId = newSheet.spreadsheetId;

    // Cache the newly created Transaksi sheetId
    const transaksiSheet = newSheet.sheets.find((s: any) => s.properties.title === 'Transaksi');
    if (transaksiSheet) {
      transaksiSheetId = transaksiSheet.properties.sheetId;
    }

    // Store in localStorage
    localStorage.setItem('google_spreadsheet_id', spreadsheetId);

    // 4. Initialize headers & formulas
    await initializeSpreadsheetTemplate(accessToken, spreadsheetId);

    return spreadsheetId;
  } catch (error: any) {
    console.error('findOrCreateSpreadsheet error:', error);
    throw error;
  }
}

/**
 * Fetches sheet metadata to locate sheetIds
 */
async function fetchSheetMetadata(accessToken: string, spreadsheetId: string) {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });
    if (res.ok) {
      const data = await res.json();
      const transaksiSheet = data.sheets.find((s: any) => s.properties.title === 'Transaksi');
      if (transaksiSheet) {
        transaksiSheetId = transaksiSheet.properties.sheetId;
      } else {
        transaksiSheetId = null;
      }
    } else {
      transaksiSheetId = null;
    }
  } catch (e) {
    console.error('Failed to fetch sheet metadata', e);
    transaksiSheetId = null;
  }
}

/**
 * Initial setup of columns in Transaksi sheet, and calculations in Ringkasan sheet
 */
async function initializeSpreadsheetTemplate(accessToken: string, spreadsheetId: string): Promise<void> {
  const headers = [
    ["ID", "Tanggal", "Kategori", "Deskripsi", "Jumlah", "Tipe", "Metode Pembayaran", "Sumber"]
  ];

  // Write headers to Transaksi sheet
  const transaksiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transaksi!A1:H1?valueInputOption=USER_ENTERED`;
  await fetch(transaksiUrl, {
    method: 'PUT',
    headers: getHeaders(accessToken),
    body: JSON.stringify({ values: headers })
  });

  // Write Ringkasan template with nice Excel formulas
  const ringkasanData = [
    ["RINGKASAN LAPORAN KEUANGAN PRIBADI"],
    ["Dibuat secara otomatis oleh Aplikasi Manajemen Keuangan"],
    [],
    ["METRIK UTAMA", "JUMLAH (IDR)"],
    ["Total Pemasukan", "=SUMIF(Transaksi!F:F; \"pemasukan\"; Transaksi!E:E)"],
    ["Total Pengeluaran", "=SUMIF(Transaksi!F:F; \"pengeluaran\"; Transaksi!E:E)"],
    ["Saldo Bersih", "=B5-B6"],
    [],
    ["Daftar Pengeluaran per Kategori"],
    ["Kategori", "Total Pengeluaran"],
    ["Makanan", "=SUMIFS(Transaksi!E:E; Transaksi!C:C; A11; Transaksi!F:F; \"pengeluaran\")"],
    ["Belanja", "=SUMIFS(Transaksi!E:E; Transaksi!C:C; A12; Transaksi!F:F; \"pengeluaran\")"],
    ["Transportasi", "=SUMIFS(Transaksi!E:E; Transaksi!C:C; A13; Transaksi!F:F; \"pengeluaran\")"],
    ["Hiburan", "=SUMIFS(Transaksi!E:E; Transaksi!C:C; A14; Transaksi!F:F; \"pengeluaran\")"],
    ["Tagihan", "=SUMIFS(Transaksi!E:E; Transaksi!C:C; A15; Transaksi!F:F; \"pengeluaran\")"],
    ["Kesehatan", "=SUMIFS(Transaksi!E:E; Transaksi!C:C; A16; Transaksi!F:F; \"pengeluaran\")"],
    ["Lainnya", "=SUMIFS(Transaksi!E:E; Transaksi!C:C; A17; Transaksi!F:F; \"pengeluaran\")"]
  ];

  const ringkasanUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Ringkasan!A1:B17?valueInputOption=USER_ENTERED`;
  await fetch(ringkasanUrl, {
    method: 'PUT',
    headers: getHeaders(accessToken),
    body: JSON.stringify({ values: ringkasanData })
  });
}

/**
 * Fetch all transaction rows from the Transaksi sheet
 */
export async function fetchTransactions(accessToken: string, spreadsheetId: string): Promise<Transaction[]> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transaksi!A2:H10000`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error('Gagal mengunduh data transaksi dari Google Sheets.');
    }

    const data = await response.json();
    if (!data.values) {
      return [];
    }

    // Map rows back to Transaction interfaces
    return data.values.map((row: any[]): Transaction => ({
      id: row[0] || '',
      date: row[1] || '',
      category: row[2] || '',
      description: row[3] || '',
      amount: parseFloat(row[4]) || 0,
      type: (row[5] as 'pemasukan' | 'pengeluaran') || 'pengeluaran',
      paymentMethod: row[6] || '',
      source: (row[7] as 'manual' | 'receipt') || 'manual'
    }));
  } catch (error) {
    console.error('fetchTransactions error:', error);
    throw error;
  }
}

/**
 * Append a transaction to the Transaksi sheet
 */
export async function addTransactionToSheet(
  accessToken: string,
  spreadsheetId: string,
  tx: Transaction
): Promise<void> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transaksi!A2:H2:append?valueInputOption=USER_ENTERED`;
    const row = [
      tx.id,
      tx.date,
      tx.category,
      tx.description,
      tx.amount,
      tx.type,
      tx.paymentMethod,
      tx.source
    ];

    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(accessToken),
      body: JSON.stringify({
        values: [row]
      })
    });

    if (!response.ok) {
      throw new Error('Gagal menyinkronkan transaksi ke Google Sheets.');
    }
  } catch (error) {
    console.error('addTransactionToSheet error:', error);
    throw error;
  }
}

/**
 * Append multiple transactions to the Google Sheet in bulk.
 */
export async function addTransactionsToSheet(
  accessToken: string,
  spreadsheetId: string,
  txs: Transaction[]
): Promise<void> {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transaksi!A2:H2:append?valueInputOption=USER_ENTERED`;
    const rows = txs.map(tx => [
      tx.id,
      tx.date,
      tx.category,
      tx.description,
      tx.amount,
      tx.type,
      tx.paymentMethod,
      tx.source
    ]);

    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(accessToken),
      body: JSON.stringify({
        values: rows
      })
    });

    if (!response.ok) {
      throw new Error('Gagal menyinkronkan daftar transaksi ke Google Sheets.');
    }
  } catch (error) {
    console.error('addTransactionsToSheet error:', error);
    throw error;
  }
}

/**
 * Delete a transaction from the Google Sheet by reading all rows, finding the index,
 * and calling batchUpdate to delete that row.
 */
export async function deleteTransactionFromSheet(
  accessToken: string,
  spreadsheetId: string,
  txId: string
): Promise<void> {
  try {
    // 1. Fetch current transaction list to get row indexes
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transaksi!A:A`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error('Gagal mencocokkan data transaksi untuk dihapus.');
    }

    const data = await response.json();
    if (!data.values) return;

    // Find row index (0-based)
    // data.values[0] is header ["ID"], so row indices match 1-to-1 with indices in data.values
    const rowIndex = data.values.findIndex((row: any[]) => row[0] === txId);

    if (rowIndex === -1) {
      console.warn(`Transaction ID ${txId} not found in Google Sheet.`);
      return;
    }

    if (transaksiSheetId === null) {
      await fetchSheetMetadata(accessToken, spreadsheetId);
    }

    if (transaksiSheetId === null) {
      throw new Error('Gagal mendapatkan ID sheet Transaksi.');
    }

    // 2. Perform delete row request
    const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
    const batchResponse = await fetch(batchUrl, {
      method: 'POST',
      headers: getHeaders(accessToken),
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: transaksiSheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1
              }
            }
          }
        ]
      })
    });

    if (!batchResponse.ok) {
      throw new Error('Gagal menghapus baris transaksi di Google Sheets.');
    }
  } catch (error) {
    console.error('deleteTransactionFromSheet error:', error);
    throw error;
  }
}

/**
 * Update an existing transaction in the Google Sheet by finding its row index and writing USER_ENTERED values.
 */
export async function updateTransactionInSheet(
  accessToken: string,
  spreadsheetId: string,
  tx: Transaction
): Promise<void> {
  try {
    // 1. Fetch current transaction list to find the row index
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transaksi!A:A`;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    if (!response.ok) {
      throw new Error('Gagal mencocokkan data transaksi untuk diperbarui.');
    }

    const data = await response.json();
    if (!data.values) {
      throw new Error('Tidak ada data transaksi ditemukan di Google Sheets.');
    }

    // Find row index (0-based)
    const rowIndex = data.values.findIndex((row: any[]) => row[0] === tx.id);

    if (rowIndex === -1) {
      throw new Error(`Transaksi dengan ID ${tx.id} tidak ditemukan di Google Sheets.`);
    }

    const rowNum = rowIndex + 1; // Google Sheets is 1-indexed

    // 2. Perform PUT request to update the specific row range
    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Transaksi!A${rowNum}:H${rowNum}?valueInputOption=USER_ENTERED`;
    const row = [
      tx.id,
      tx.date,
      tx.category,
      tx.description,
      tx.amount,
      tx.type,
      tx.paymentMethod,
      tx.source
    ];

    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: getHeaders(accessToken),
      body: JSON.stringify({
        values: [row]
      })
    });

    if (!updateResponse.ok) {
      throw new Error('Gagal memperbarui baris transaksi di Google Sheets.');
    }
  } catch (error) {
    console.error('updateTransactionInSheet error:', error);
    throw error;
  }
}

