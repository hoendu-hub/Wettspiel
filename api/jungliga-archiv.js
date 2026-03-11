import { google } from "googleapis";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Nur POST erlaubt" });
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheetId = process.env.JUNGLIGA_SHEET_ID;
    const tabInput = "Eingabe";
    const tabArchive = "Archiv";

    // Eingabe-Daten laden
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: tabInput
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.status(200).json({
        status: "ok",
        message: "Keine Daten zum Archivieren"
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    if (dataRows.length === 0) {
      return res.status(200).json({
        status: "ok",
        message: "Keine Daten zum Archivieren"
      });
    }

    // ALLE Daten ins Archiv anhängen
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: tabArchive,
      valueInputOption: "RAW",
      requestBody: {
        values: dataRows
      }
    });

    // Eingabe leeren (nur Header behalten)
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: tabInput,
      valueInputOption: "RAW",
      requestBody: {
        values: [headers] // nur Header zurückschreiben
      }
    });

    return res.status(200).json({
      status: "ok",
      message: "Jungliga erfolgreich archiviert",
      count: dataRows.length
    });

  } catch (error) {
    console.error("Fehler in jungliga-archive:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Archivieren",
      details: error.message
    });
  }
}
