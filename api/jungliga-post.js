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
    const { Name, Jahrgang, ...juryFields } = req.body;

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

    const sheetId = process.env.JUNGLIGA_SHEET_ID;
    const tabName = "Eingabe";

    // Bestehende Daten laden
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: tabName
    });

    const rows = response.data.values;
    if (!rows || rows.length < 2) {
      return res.status(404).json({
        status: "error",
        message: "Keine Daten gefunden"
      });
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    // Zeile finden
    const rowIndex = dataRows.findIndex(row => {
      const rowObj = {};
      headers.forEach((h, i) => rowObj[h] = row[i] || "");
      return rowObj["Name"] === Name && rowObj["Jahrgang"] === Jahrgang;
    });

    if (rowIndex === -1) {
      return res.status(404).json({
        status: "error",
        message: "Teilnehmer nicht gefunden"
      });
    }

    // Bestehende Zeile in Objekt umwandeln
    const existingRow = {};
    headers.forEach((h, i) => {
      existingRow[h] = dataRows[rowIndex][i] || "";
    });

    // Nur die gelieferten Felder überschreiben
    Object.keys(juryFields).forEach(key => {
      if (headers.includes(key)) {
        existingRow[key] = juryFields[key];
      }
    });

    // Zurück in Array umwandeln
    const updatedRow = headers.map(h => existingRow[h] || "");

    // Zeile zurückschreiben
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A${rowIndex + 2}`,
      valueInputOption: "RAW",
      requestBody: {
        values: [updatedRow]
      }
    });

    return res.status(200).json({
      status: "ok",
      message: "Jury-Daten erfolgreich gespeichert",
      updated: existingRow
    });

  } catch (error) {
    console.error("Fehler in jungliga-post:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Speichern",
      details: error.message
    });
  }
}
