import { google } from "googleapis";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Only POST allowed" });
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const tabName = process.env.GOOGLE_SHEET_TAB;

    // Body auslesen
    const { Startnummer, updates } = req.body;

    if (!Startnummer) {
      return res.status(400).json({ status: "error", message: "Startnummer fehlt" });
    }

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({ status: "error", message: "Updates fehlen oder sind ungültig" });
    }

    // Alle Daten laden
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}`,
    });

    const rows = sheetData.data.values;
    const header = rows[0];

    // Zeile finden
    const rowIndex = rows.findIndex((row) => row[0] === String(Startnummer));

    if (rowIndex === -1) {
      return res.status(404).json({ status: "error", message: "Startnummer nicht gefunden" });
    }

    // Bestehende Zeile kopieren
    const updatedRow = [...rows[rowIndex]];

    // Updates anwenden
    for (const [key, value] of Object.entries(updates)) {
      const colIndex = header.indexOf(key);
      if (colIndex !== -1) {
        updatedRow[colIndex] = value;
      }
    }

    // Zurückschreiben
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [updatedRow],
      },
    });

    return res.status(200).json({
      status: "ok",
      message: "Teilnehmer aktualisiert",
      updated: updatedRow,
    });

  } catch (error) {
    console.error("UPDATE Fehler:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Aktualisieren",
      details: error.message,
    });
  }
}
