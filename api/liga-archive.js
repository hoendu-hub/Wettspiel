import { google } from "googleapis";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Nur POST erlaubt" });
  }

  try {
    const { Name, Jahrgang } = req.body;

    if (!Name || !Jahrgang) {
      return res.status(400).json({
        status: "error",
        message: "Name und Jahrgang sind erforderlich"
      });
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"]
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheetId = process.env.LIGA_SHEET_ID;
    const tabInput = "Eingabe";
    const tabArchive = "Archiv";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: tabInput
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.status(404).json({ status: "error", message: "Keine Daten gefunden" });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const rowIndex = dataRows.findIndex(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i] || "");
      return obj["Name"] === Name && obj["Jahrgang"] === Jahrgang;
    });

    if (rowIndex === -1) {
      return res.status(404).json({ status: "error", message: "Teilnehmer nicht gefunden" });
    }

    const rowToArchive = dataRows[rowIndex];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: tabArchive,
      valueInputOption: "RAW",
      requestBody: { values: [rowToArchive] }
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: response.data.range.split("!")[0],
                dimension: "ROWS",
                startIndex: rowIndex + 1,
                endIndex: rowIndex + 2
              }
            }
          }
        ]
      }
    });

    return res.status(200).json({
      status: "ok",
      message: "Teilnehmer archiviert",
      archived: rowToArchive
    });

  } catch (error) {
    console.error("Fehler in liga-archive:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Archivieren",
      details: error.message
    });
  }
}
