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
    const {
      Startnummer = "",
      Name = "",
      Gruppe = "",
      "Jahrgang (optional)": Jahrgang = "",
      "Bemerkung (optional)": Bemerkung = "",
      "Punkte Jury 1": PunkteJ1 = "",
      "Abzug Jury 1": AbzugJ1 = "",
      "Punkte Jury 2": PunkteJ2 = "",
      "Abzug Jury 2": AbzugJ2 = "",
      "Technik Jury 3": TechnikJ3 = "",
      "Rhythmik Jury 3": RhythmikJ3 = "",
      "Dynamik Jury 3": DynamikJ3 = "",
      "Abzug Jury 3": AbzugJ3 = "",
      "Technik Jury Finale": TechnikF = "",
      "Rhythmik Jury Finale": RhythmikF = "",
      "Dynamik Jury Finale": DynamikF = "",
      "Abzug Jury Finale": AbzugF = "",
      "Final‑Startnummer": FinalStartnummer = ""
    } = req.body;

    // Neue Zeile vorbereiten
    const newRow = [
      Startnummer,
      Name,
      Gruppe,
      Jahrgang,
      Bemerkung,
      PunkteJ1,
      AbzugJ1,
      PunkteJ2,
      AbzugJ2,
      TechnikJ3,
      RhythmikJ3,
      DynamikJ3,
      AbzugJ3,
      TechnikF,
      RhythmikF,
      DynamikF,
      AbzugF,
      FinalStartnummer
    ];

    // In Sheet schreiben
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tabName}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [newRow],
      },
    });

    return res.status(200).json({
      status: "ok",
      message: "Teilnehmer erfolgreich hinzugefügt",
      data: req.body,
    });

  } catch (error) {
    console.error("POST Fehler:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Schreiben der Daten",
      details: error.message,
    });
  }
}
