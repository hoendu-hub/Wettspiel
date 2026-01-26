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
    const { Startnummer, updates, identifier } = req.body;

    if (!updates || typeof updates !== "object") {
      return res.status(400).json({
        status: "error",
        message: "Updates fehlen oder ungültig"
      });
    }

    // Daten laden
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}`,
    });

    const rows = sheetData.data.values;
    const header = rows[0];

    let rowIndex = -1;

    // -----------------------------------------
    // 1) IDENTIFIER (Name)
    // -----------------------------------------
    if (identifier && identifier.field && identifier.value) {
      const colIndex = header.indexOf(identifier.field);
      if (colIndex !== -1) {
        rowIndex = rows.findIndex(row => row[colIndex] === identifier.value);
      }
    }

    // -----------------------------------------
    // 2) FALLBACK: Startnummer
    // -----------------------------------------
    if (rowIndex === -1 && Startnummer) {
      const colIndex = header.indexOf("Startnummer");
      if (colIndex === -1) {
        return res.status(400).json({
          status: "error",
          message: "Spalte 'Startnummer' existiert nicht"
        });
      }

      rowIndex = rows.findIndex(row => row[colIndex] === String(Startnummer));
    }

    if (rowIndex === -1) {
      return res.status(404).json({
        status: "error",
        message: "Teilnehmer nicht gefunden"
      });
    }

    // Zeile kopieren
    const updatedRow = [...rows[rowIndex]];

    // Updates anwenden
    for (const [key, value] of Object.entries(updates)) {
      const colIndex = header.indexOf(key);
      if (colIndex !== -1) {
        updatedRow[colIndex] = value;
      }
    }

    // -----------------------------------------
    // WICHTIG: ganze Zeile zurückschreiben!
    // -----------------------------------------
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!${rowIndex + 1}:${rowIndex + 1}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [updatedRow],
      },
    });

    return res.status(200).json({
      status: "ok",
      updated: updatedRow
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
