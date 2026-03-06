import { google } from "googleapis";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Nur GET erlaubt" });
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"]
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheetId = process.env.JUNGLIGA_SHEET_ID;
    const tabName = "Eingabe";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: tabName
    });

    const rows = response.data.values;

    // Immer ok zurückgeben – auch wenn leer
    if (!rows || rows.length < 2) {
      return res.status(200).json({
        status: "ok",
        count: 0,
        data: []
      });
    }

    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });

    return res.status(200).json({
      status: "ok",
      count: data.length,
      data
    });

  } catch (error) {
    console.error("Fehler in jungliga-get:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Lesen der Daten",
      details: error.message
    });
  }
}
