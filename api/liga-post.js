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

    const sheetId = process.env.LIGA_SHEET_ID;
    const tabName = "Eingabe";

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: tabName
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

    const existingRow = {};
    headers.forEach((h, i) => existingRow[h] = dataRows[rowIndex][i] || "");

    Object.keys(juryFields).forEach(key => {
      if (headers.includes(key)) existingRow[key] = juryFields[key];
    });

    const updatedRow = headers.map(h => existingRow[h] || "");

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A${rowIndex + 2}`,
      valueInputOption: "RAW",
      requestBody: { values: [updatedRow] }
    });

    return res.status(200).json({
      status: "ok",
      message: "Jury-Daten gespeichert",
      updated: existingRow
    });

  } catch (error) {
    console.error("Fehler in liga-post:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Speichern",
      details: error.message
    });
  }
}
