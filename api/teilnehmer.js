import { google } from "googleapis";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Google Auth vorbereiten
  let sheets;
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    sheets = google.sheets({ version: "v4", auth });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Auth Fehler", details: error.message });
  }

  const sheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = process.env.GOOGLE_SHEET_TAB;
  const tabGID = 0;

  // ---------------------------------------------------------
  // GET – Teilnehmer lesen
  // ---------------------------------------------------------
  if (req.method === "GET") {
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${tabName}`,
      });

      const rows = response.data.values;

      if (!rows || rows.length < 2) {
        return res.status(200).json({ status: "ok", count: 0, data: [] });
      }

      const headers = rows[0];
      const data = rows.slice(1).map((row) => {
        const obj = {};
        headers.forEach((header, index) => {
          obj[header] = row[index] || "";
        });
        return obj;
      });

      return res.status(200).json({ status: "ok", count: data.length, data });

    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Fehler beim Lesen der Daten",
        details: error.message,
      });
    }
  }

  // ---------------------------------------------------------
  // POST – Teilnehmer hinzufügen
  // ---------------------------------------------------------
  if (req.method === "POST" && req.body.action !== "delete") {
    try {
      const {
        Startnummer = "",
        Name = "",
        Gruppe = "",
        "Jahrgang (optional)": Jahrgang = "",
      } = req.body;

      const newRow = [
        Startnummer,
        Name,
        Gruppe,
        Jahrgang,
        "", "", "", "", "", "", "", "", "", "", "", "", "", ""
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${tabName}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [newRow] },
      });

      return res.status(200).json({
        status: "ok",
        message: "Teilnehmer erfolgreich hinzugefügt",
        data: req.body,
      });

    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Fehler beim Schreiben der Daten",
        details: error.message,
      });
    }
  }

  // ---------------------------------------------------------
  // PUT – Teilnehmer aktualisieren
  // ---------------------------------------------------------
  if (req.method === "PUT") {
    try {
      const { Startnummer, updates, identifier } = req.body;

      if (!updates || typeof updates !== "object") {
        return res.status(400).json({
          status: "error",
          message: "Updates fehlen oder ungültig"
        });
      }

      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${tabName}`,
      });

      const rows = sheetData.data.values;
      const header = rows[0];

      let rowIndex = -1;

      if (identifier && identifier.field && identifier.value) {
        const colIndex = header.indexOf(identifier.field);
        if (colIndex !== -1) {
          rowIndex = rows.findIndex(row => row[colIndex] === identifier.value);
        }
      }

      if (rowIndex === -1 && Startnummer) {
        const colIndex = header.indexOf("Startnummer");
        rowIndex = rows.findIndex(row => row[colIndex] === String(Startnummer));
      }

      if (rowIndex === -1) {
        return res.status(404).json({
          status: "error",
          message: "Teilnehmer nicht gefunden"
        });
      }

      const updatedRow = [...rows[rowIndex]];

      for (const [key, value] of Object.entries(updates)) {
        const colIndex = header.indexOf(key);
        if (colIndex !== -1) updatedRow[colIndex] = value;
      }

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${tabName}!${rowIndex + 1}:${rowIndex + 1}`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [updatedRow] },
      });

      return res.status(200).json({ status: "ok", updated: updatedRow });

    } catch (error) {
      return res.status(500).json({
        status: "error",
        message: "Fehler beim Aktualisieren",
        details: error.message,
      });
    }
  }

  // ---------------------------------------------------------
  // DELETE – Jimdo-kompatibel (DELETE oder POST + action:"delete")
  // ---------------------------------------------------------
  if (
    req.method === "DELETE" ||
    (req.method === "POST" && req.body.action === "delete")
  ) {
    try {
      const { Startnummer, Name, Gruppe } = req.body;

      const sheetData = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `${tabName}!A:Z`,
      });

      const rows = sheetData.data.values || [];
      const header = rows[0];

      const colStartnummer = header.indexOf("Startnummer");
      const colName = header.indexOf("Name");
      const colGruppe = header.indexOf("Gruppe");

      let rowIndex = -1;

      if (Startnummer) {
        rowIndex = rows.findIndex(
          (row, idx) => idx > 0 && row[colStartnummer] === String(Startnummer)
        );
      }

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
      return res.status(500).json({
        status: "error",
        message: "Fehler beim Löschen",
        details: error.message,
      });
    }
  }

  // ---------------------------------------------------------
  // Fallback
  // ---------------------------------------------------------
  return res.status(405).json({ status: "error", message: "Methode nicht erlaubt" });
}
