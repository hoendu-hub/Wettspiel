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
    const tabGID = 0;

    const { Startnummer, Name, Gruppe } = req.body;

    // Tabelle laden
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabName}!A:Z`,
    });

    const rows = sheetData.data.values || [];
    const header = rows[0];

    // Spaltenindex bestimmen
    const colStartnummer = header.indexOf("Startnummer");
    const colName = header.indexOf("Name");
    const colGruppe = header.indexOf("Gruppe");

    let rowIndex = -1;

    // 1) Wenn Startnummer vorhanden → darüber löschen
    if (Startnummer) {
      rowIndex = rows.findIndex(
        (row, idx) => idx > 0 && row[colStartnummer] === String(Startnummer)
      );
    }

    // 2) Wenn keine Startnummer → über Name + Gruppe löschen
    if (!Startnummer && Name && Gruppe) {
      rowIndex = rows.findIndex(
        (row, idx) =>
          idx > 0 &&
          row[colName] === Name &&
          row[colGruppe] === Gruppe
      );
    }

    if (rowIndex === -1) {
      return res.status(404).json({
        status: "error",
        message: "Teilnehmer nicht gefunden",
      });
    }

    // Zeile löschen
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

