import { google } from "googleapis";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") {
    return res.status(405).json({ status: "error", message: "Only GET allowed" });
  }

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    const sheetId = process.env.GOOGLE_SHEET_ID;
    const tabTeilnehmer = process.env.GOOGLE_SHEET_TAB;
    const tabArchiv = "archiv";

    // Jahr bestimmen
    const jahr = new Date().getFullYear();

    // Teilnehmer-Daten laden
    const teilnehmerData = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${tabTeilnehmer}`,
    });

    const rows = teilnehmerData.data.values || [];

    // Wenn keine Daten vorhanden sind → abbrechen
    if (rows.length <= 1) {
      return res.status(200).json({
        status: "ok",
        message: "Keine Teilnehmer zum Archivieren",
      });
    }

    // Erste Zeile = Header
    const header = rows[0];
    const dataRows = rows.slice(1);

    // Jahr vorne einfügen
    const archivRows = dataRows.map((row) => [jahr, ...row]);

    // In Archiv anhängen
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tabArchiv}`,
      valueInputOption: "RAW",
      requestBody: {
        values: archivRows,
      },
    });

    // Teilnehmer-Tab leeren (alles außer Header)
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabTeilnehmer}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [header], // nur Header bleibt
      },
    });

    return res.status(200).json({
      status: "ok",
      message: "Archivierung erfolgreich",
      jahr,
      archivierteEinträge: archivRows.length,
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
