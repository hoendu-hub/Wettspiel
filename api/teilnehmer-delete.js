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
      scopes: ["https://www.googleapis.com/auth/spreadsheets"], // Schreibrechte
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const tabName = process.env.GOOGLE_SHEET_TAB;

    // Bei dir ist die Tab-ID tatsächlich 0
    const tabGID = 0;

    const { Startnummer } = req.body;

    if (!Startnummer) {
      return res.status(400).json({ status: "error", message: "Startnummer fehlt" });
    }

    // Tabelle vollständig laden
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A:Z`, // WICHTIG: ganze Tabelle lesen
    });

    const rows = sheetData.data.values || [];

    // Zeile anhand der Startnummer finden
    const rowIndex = rows.findIndex((row) => row[0] === String(Startnummer));

    if (rowIndex === -1) {
      return res.status(404).json({ status: "error", message: "Startnummer nicht gefunden" });
    }

    // Zeile löschen (Titelzeile bleibt automatisch stehen)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: tabGID,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    return res.status(200).json({
      status: "ok",
      message: "Teilnehmer gelöscht",
      deletedStartnummer: Startnummer,
    });

  } catch (error) {
    console.error("DELETE Fehler:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Löschen",
      details: error.message,
    });
  }
}
