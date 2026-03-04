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
    const tabTeilnehmer = process.env.GOOGLE_SHEET_TAB;   // "Teilnehmer"
    const tabArchiv = "Archiv";                           // Name deines Archiv-Tabs
    const tabTeilnehmerGID = 0;                           // gid vom Teilnehmer-Tab

    // 1) Teilnehmer-Tabelle komplett laden
    const sheetData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabTeilnehmer}!A:Z`,
    });

    const rows = sheetData.data.values || [];
    console.log("ARCHIVE rows:", rows.length); // <--- Log

    if (rows.length <= 1) {
      return res.status(200).json({
        status: "ok",
        message: "Keine Teilnehmer zum Archivieren",
      });
    }

    const header = rows[0];
    const datenOhneHeader = rows.slice(1);

    // 2) Daten ans Archiv anhängen
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tabArchiv}!A:Z`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: datenOhneHeader,
      },
    });

    // 3) Teilnehmer-Tab leeren, Kopfzeile behalten
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabTeilnehmer}!A1:Z1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [header],
      },
    });

    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${tabTeilnehmer}!A2:Z`,
    });

    return res.status(200).json({
      status: "ok",
      message: "Archiviert und Teilnehmerliste geleert",
    });

  } catch (error) {
    console.error("ARCHIVE Fehler:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Archivieren",
      details: error.message,
    });
  }
}
