(function() {

  const API_BASE = "https://wettspiel.vercel.app/api";
  const ROUTE_GET = "/jungliga-get";

  /* -----------------------------------------
     JURIES – Feldnamen wie in deiner API
  ----------------------------------------- */
  const JURIES = [
    { index:1, type:"punkte",  dateKey:"Datum Jury 1", vortragKey:"Vortrag Jury 1", punkteKey:"Punkte Jury 1", abzugKey:"Abzug Jury 1", bemerkKey:"Bemerkung Jury 1" },
    { index:2, type:"punkte",  dateKey:"Datum Jury 2", vortragKey:"Vortrag Jury 2", punkteKey:"Punkte Jury 2", abzugKey:"Abzug Jury 2", bemerkKey:"Bemerkung Jury 2" },
    { index:3, type:"rhttech", dateKey:"Datum Jury 3", vortragKey:"Vortrag Jury 3", rhythmikKey:"Rhythmik Jury 3", technikKey:"Technik Jury 3", abzugKey:"Abzug Jury 3", bemerkKey:"Bemerkung Jury 3" },
    { index:4, type:"rdt",     dateKey:"Datum Jury 4", vortragKey:"Vortrag Jury 4", rhythmikKey:"Rhythmik Jury 4", dynamikKey:"Dynamik Jury 4", technikKey:"Technik Jury 4", abzugKey:"Abzug Jury 4", bemerkKey:"Bemerkung Jury 4" },
    { index:5, type:"rdt",     dateKey:"Datum Jury 5", vortragKey:"Vortrag Jury 5", rhythmikKey:"Rhythmik Jury 5", dynamikKey:"Dynamik Jury 5", technikKey:"Technik Jury 5", abzugKey:"Abzug Jury 5", bemerkKey:"Bemerkung Jury 5" }
  ];

  const COL_NAME = "Name";
  const COL_GRUPPE = "Gruppe";
  const COL_JAHRGANG = "Jahrgang";

  /* -----------------------------------------
     Hilfsfunktionen
  ----------------------------------------- */
  function round2(x){ return Math.round((x+Number.EPSILON)*100)/100; }

  function normalizeDate(v){
    if(!v) return "";
    const s = String(v).trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    let c = s.replace(/[,\.\/]/g,"-");
    let p = c.split("-").filter(x=>x);
    if(p.length===3){
      let d=p[0].padStart(2,"0"), m=p[1].padStart(2,"0"), y=p[2];
      if(y.length===2) y="20"+y;
      if(y.length===4) return `${y}-${m}-${d}`;
    }
    return "";
  }

  function formatDateCH(ymd){
    if(!ymd) return "";
    const [y,m,d] = ymd.split("-");
    return `${d}.${m}.${y}`;
  }

  /* -----------------------------------------
     Optimierung: Jury‑Meta‑Infos EINMAL bauen
  ----------------------------------------- */
  function buildJuryMetaMap(allRows){
    const map = {}; // { "2026-06-28": ["Gremlins"], ... }

    allRows.forEach(r=>{
      JURIES.forEach(j=>{
        const d = normalizeDate(r[j.dateKey]);
        if(!d) return;

        if(!map[d]) map[d] = new Set();
        if(r[j.vortragKey]) map[d].add(r[j.vortragKey]);
      });
    });

    const result = {};
    Object.keys(map).forEach(d=>{
      result[d] = Array.from(map[d]);
    });

    return result;
  }

  /* -----------------------------------------
     Alle verfügbaren Daten sammeln
  ----------------------------------------- */
  function collectAvailableDates(allRows){
    const set = new Set();
    allRows.forEach(r=>{
      JURIES.forEach(j=>{
        const d = normalizeDate(r[j.dateKey]);
        if(d) set.add(d);
      });
    });
    return Array.from(set).sort();
  }

  /* -----------------------------------------
     Hauptlogik – wie Apps Script
  ----------------------------------------- */
  function buildDataForDate(allRows, targetYmd){
    const targetYear = targetYmd.substring(0,4);

    const participants = new Map();
    const perJuryEntries = JURIES.map(()=>[]);
    const juryMeta = Array(JURIES.length).fill(null);

    allRows.forEach(row=>{
      const name = row[COL_NAME];
      if(!name) return;

      if(!participants.has(name)){
        participants.set(name,{
          name,
          gruppe: row[COL_GRUPPE],
          jahrgang: row[COL_JAHRGANG],
          juries: Array(JURIES.length).fill(null)
        });
      }
      const p = participants.get(name);

      JURIES.forEach((j,idx)=>{
        const dYmd = normalizeDate(row[j.dateKey]);
        if(!dYmd) return;

        if(!juryMeta[idx]){
          juryMeta[idx] = { date:dYmd, vortrag:row[j.vortragKey] };
        }

        // Tagesrangliste
        if(dYmd===targetYmd){
          let total=0, rhythmik=0, dynamik=0, technik=0, punkte=0, abzug=0;

          if(j.type==="punkte"){
            punkte = Number(row[j.punkteKey])||0;
            abzug  = Number(row[j.abzugKey])||0;
            total = round2(punkte - abzug);
          }
          if(j.type==="rhttech"){
            rhythmik = Number(row[j.rhythmikKey])||0;
            technik  = Number(row[j.technikKey])||0;
            abzug    = Number(row[j.abzugKey])||0;
            total = round2(rhythmik + technik - abzug);
          }
          if(j.type==="rdt"){
            rhythmik = Number(row[j.rhythmikKey])||0;
            dynamik  = Number(row[j.dynamikKey])||0;
            technik  = Number(row[j.technikKey])||0;
            abzug    = Number(row[j.abzugKey])||0;
            total = round2(rhythmik + dynamik + technik - abzug);
          }

          perJuryEntries[idx].push({
            name,
            gruppe: row[COL_GRUPPE],
            jahrgang: row[COL_JAHRGANG],
            total,
            abzug,
            vortrag: row[j.vortragKey],
            rhythmik,
            dynamik,
            technik,
            bemerk: row[j.bemerkKey]
          });
        }

        // Gesamtwertung
        if(dYmd.substring(0,4)===targetYear && dYmd<=targetYmd){
          if(!p.juries[idx]){
            p.juries[idx] = { date:dYmd, vortrag:row[j.vortragKey], rank:null, rankPoints:0 };
          }
        }
      });
    });

    /* Rangpunkte für frühere Jurys */
    JURIES.forEach((j,idx)=>{
      const meta = juryMeta[idx];
      if(!meta) return;
      const juryDate = meta.date;
      if(juryDate.substring(0,4)!==targetYear || juryDate>=targetYmd) return;

      const entries=[];
      allRows.forEach(r=>{
        if(normalizeDate(r[j.dateKey])!==juryDate) return;

        let total=0, rhythmik=0, dynamik=0, technik=0, punkte=0, abzug=0;

        if(j.type==="punkte"){
          punkte = Number(r[j.punkteKey])||0;
          abzug  = Number(r[j.abzugKey])||0;
          total = round2(punkte - abzug);
        }
        if(j.type==="rhttech"){
          rhythmik = Number(r[j.rhythmikKey])||0;
          technik  = Number(r[j.technikKey])||0;
          abzug    = Number(r[j.abzugKey])||0;
          total = round2(rhythmik + technik - abzug);
        }
        if(j.type==="rdt"){
          rhythmik = Number(r[j.rhythmikKey])||0;
          dynamik  = Number(r[j.dynamikKey])||0;
          technik  = Number(r[j.technikKey])||0;
          abzug    = Number(r[j.abzugKey])||0;
          total = round2(rhythmik + dynamik + technik - abzug);
        }

        entries.push({ name:r[COL_NAME], total });
      });

      entries.sort((a,b)=>b.total-a.total);

      let lastTotal=null, lastRank=0, count=0;
      const size=entries.length;

      entries.forEach(e=>{
        count++;
        let rank;
        if(lastTotal===null || e.total!==lastTotal){
          rank=count;
          lastRank=rank;
          lastTotal=e.total;
        } else rank=lastRank;

        const rp = size-rank+1;
        const p = participants.get(e.name);
        if(p && p.juries[idx] && p.juries[idx].date===juryDate){
          p.juries[idx].rank=rank;
          p.juries[idx].rankPoints=rp;
        }
      });
    });

    /* Tagesranglisten */
    const dayJuryTables=[];
    perJuryEntries.forEach((entries,idx)=>{
      if(!entries.length) return;

      entries.sort((a,b)=>b.total-a.total);

      let lastTotal=null, lastRank=0, count=0;
      const size=entries.length;

      const rows = entries.map(e=>{
        count++;
        let rank;
        if(lastTotal===null || e.total!==lastTotal){
          rank=count;
          lastRank=rank;
          lastTotal=e.total;
        } else rank=lastRank;

        const rp = size-rank+1;

        const p = participants.get(e.name);
        if(p && p.juries[idx] && p.juries[idx].date===targetYmd){
          p.juries[idx].rank=rank;
          p.juries[idx].rankPoints=rp;
        }

        return {...e, rank, rankPoints:rp};
      });

      dayJuryTables.push({ juryIndex:JURIES[idx].index, rows });
    });

    /* Gesamtwertung */
    const overall=[];
    participants.forEach(p=>{
      let totalPoints=0;
      const perJuryPoints=[];
      JURIES.forEach((j,idx)=>{
        const info=p.juries[idx];
        if(info && info.rankPoints>0){
          totalPoints+=info.rankPoints;
          perJuryPoints.push(info.rankPoints);
        } else perJuryPoints.push(0);
      });
      overall.push({ name:p.name, gruppe:p.gruppe, jahrgang:p.jahrgang, totalPoints, perJuryPoints });
    });

    overall.sort((a,b)=>{
      if(b.totalPoints!==a.totalPoints) return b.totalPoints-a.totalPoints;
      return a.name.localeCompare(b.name);
    });

    let last=null, lastRank=0, c=0;
    overall.forEach(o=>{
      c++;
      if(last===null || o.totalPoints!==last){
        o.rank=c;
        lastRank=c;
        last=o.totalPoints;
      } else o.rank=lastRank;
    });

    return { dayJuryTables, overall, juryMeta, targetYmd };
  }

  /* -----------------------------------------
     Rendering
  ----------------------------------------- */
  function renderAuswertung(root, data){
    const { dayJuryTables, overall, juryMeta, targetYmd } = data;
    const year = targetYmd.substring(0,4);
    const datumCH = formatDateCH(targetYmd);

    root.innerHTML = `
      <style>
        #jungliga-auswertung-root {
          background:#fff;
          padding:20px;
          border-radius:8px;
          box-shadow:0 0 12px rgba(0,0,0,0.15);
          margin-bottom:40px;
        }
        .jl-header {
          border:1px solid #ccc;
          background:#fafafa;
          padding:12px 18px;
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom:25px;
        }
        .jl-header-title-main {
          font-size:20px;
          font-weight:bold;
        }
        .jl-tagesbereich {
          display:flex;
          gap:20px;
          flex-wrap:wrap;
          margin-bottom:30px;
        }
        .jl-jury { flex:1; min-width:260px; }
        .jl-table {
          width:100%;
          border-collapse:collapse;
          margin-bottom:10px;
        }
        .jl-table th {
          background:#f0f0f0;
          border:1px solid #999;
          padding:4px;
          text-align:center;
        }
        .jl-table td {
          border:1px solid #999;
          padding:3px 4px;
          text-align:center;
        }
        .jl-table td:nth-child(1),
        .jl-table td:nth-child(2){
          text-align:left;
        }
      </style>

      <div class="jl-header">
        <div>
          <div style="font-size:12px;">Tambouren Spiez</div>
          <div class="jl-header-title-main">Surfdrummers Jungliga – ${year}</div>
          <div style="font-size:11px;margin-top:4px;">Datum: ${datumCH}</div>
        </div>
      </div>

      <div class="jl-tagesbereich">
        ${dayJuryTables.map(jt=>{
          const meta = juryMeta[jt.juryIndex-1] || {};
          return `
            <div class="jl-jury">
              <h2>Rangliste Jury ${jt.juryIndex} – ${meta.vortrag||""}</h2>
              <table class="jl-table">
                <thead>
                  <tr>
                    <th>Rang</th>
                    <th>Name</th>
                    ${
                      jt.juryIndex<=2
                      ? `<th>Punkte</th><th>Abz.</th><th>Total</th><th>Bem.</th>`
                      : jt.juryIndex===3
                        ? `<th>Rht.</th><th>Tech.</th><th>Abz.</th><th>Total</th><th>Bem.</th>`
                        : `<th>Vortrag</th><th>Rht.</th><th>Dyn.</th><th>Tech.</th><th>Abz.</th><th>Total</th><th>Bem.</th>`
                    }
                  </tr>
                </thead>
                <tbody>
                  ${jt.rows.map(r=>{
                    if(jt.juryIndex<=2){
                      const punkte = (r.total+r.abzug).toFixed(2);
                      return `
                        <tr>
                          <td>${r.rank}</td>
                          <td>${r.name}</td>
                          <td>${punkte}</td>
                          <td>${r.abzug.toFixed(2)}</td>
                          <td>${r.total.toFixed(2)}</td>
                          <td>${r.bemerk||""}</td>
                        </tr>`;
                    }
                    if(jt.juryIndex===3){
                      return `
                        <tr>
                          <td>${r.rank}</td>
                          <td>${r.name}</td>
                          <td>${r.rhythmik.toFixed(2)}</td>
                          <td>${r.technik.toFixed(2)}</td>
                          <td>${r.abzug.toFixed(2)}</td>
                          <td>${r.total.toFixed(2)}</td>
                          <td>${r.bemerk||""}</td>
                        </tr>`;
                    }
                    return `
                      <tr>
                        <td>${r.rank}</td>
                        <td>${r.name}</td>
                        <td>${r.vortrag||""}</td>
                        <td>${r.rhythmik.toFixed(2)}</td>
                        <td>${r.dynamik.toFixed(2)}</td>
                        <td>${r.technik.toFixed(2)}</td>
                        <td>${r.abzug.toFixed(2)}</td>
                        <td>${r.total.toFixed(2)}</td>
                        <td>${r.bemerk||""}</td>
                      </tr>`;
                  }).join("")}
                </tbody>
              </table>
            </div>
          `;
        }).join("")}
      </div>

      <h2>Gesamt-Rangliste (nach Rangpunkten)</h2>
      <table class="jl-table">
        <thead>
          <tr>
            <th>Rang</th>
            <th>Name</th>
            ${JURIES.map((j,idx)=>{
              const meta = juryMeta[idx];
              const d = meta?.date ? formatDateCH(meta.date) : "";
              return `
                <th>
                  Jury ${j.index}<br>
                  <span style="font-size:10px;">
                    ${meta?.vortrag||""}<br>${d}
                  </span>
                </th>`;
            }).join("")}
            <th>Total Rangpunkte</th>
          </tr>
        </thead>
        <tbody>
          ${overall.map(o=>`
            <tr>
              <td>${o.rank}</td>
              <td>${o.name}</td>
              ${o.perJuryPoints.map(p=>`<td>${p||""}</td>`).join("")}
              <td>${o.totalPoints}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }

  /* -----------------------------------------
     Initialisierung
  ----------------------------------------- */
  async function init(){
    const root = document.getElementBy
