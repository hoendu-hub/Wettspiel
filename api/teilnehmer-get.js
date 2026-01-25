import { google } from "googleapis";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    // Service Account Credentials aus Environment Variable
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const tabName = process.env.GOOGLE_SHEET_TAB;

    // Daten aus Google Sheets holen
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}`,
    });

    const rows = response.data.values;

    if (!rows || rows.length < 2) {
      return res.status(200).json({ data: [] });
    }

    // Erste Zeile = Spaltennamen
    const headers = rows[0];

    // Restliche Zeilen = Daten
    const data = rows.slice(1).map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = row[index] || "";
      });
      return obj;
    });

    return res.status(200).json({
      status: "ok",
      count: data.length,
      data,
    });

  } catch (error) {
    console.error("Fehler in GET-Funktion:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Lesen der Daten",
      details: error.message,
    });
  }
}
