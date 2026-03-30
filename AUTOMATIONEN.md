# AUTOMATIONEN – Automatisierungsengine
## Axano LeadFlow Plattform
**Version:** 1.0.0  
**Stand:** März 2026

---

## 1. Übersicht

Die Automatisierungsengine ist der direkte Ersatz für die n8n-Workflows. Statt 270 manuell verbundener Nodes wird die Logik als konfigurierbare Regeln in der Datenbank gespeichert und von einem BullMQ-Worker asynchron abgearbeitet.

**Kernprinzipien:**
- Jede Automatisierung gehört zu einer Kampagne
- Trigger → Bedingungen prüfen → Schritte sequenziell ausführen
- Wartezeiten = Job wird neu eingeplant (kein Blocking)
- Zeitfenster-Prüfung vor jedem E-Mail/WA-Versand
- Vollständige Protokollierung im Aktivitätslog

---

## 2. Trigger-Typen

### 2.1 `lead_eingetroffen`
Wird ausgelöst sobald ein neuer Lead in der Datenbank gespeichert wird.

```typescript
// Konfiguration (leer – keine Parameter nötig)
triggerKonfiguration: {}

// Auslöser in lead.dienst.ts:
await jobQueue.add('automatisierung_starten', {
  automatisierungId: automatisierung.id,
  leadId: lead.id,
});
```

### 2.2 `status_geaendert`
Wird ausgelöst wenn der Status eines Leads geändert wird.

```typescript
// Konfiguration
triggerKonfiguration: {
  vonStatus: 'Neu',         // Optional: nur von diesem Status
  zuStatus: 'Nicht erreichbar', // Pflicht: zu diesem Status
}

// PostgreSQL-Trigger schreibt in job_queue:
// Trigger auf leads-Tabelle → ON UPDATE → wenn status sich ändert
```

### 2.3 `inaktivitaet`
Wird ausgelöst wenn ein Lead X Stunden nicht aktualisiert wurde.

```typescript
// Konfiguration
triggerKonfiguration: {
  stunden: 24,          // Nach 24 Stunden Inaktivität
  nurStatus: ['Neu'],   // Optional: nur für bestimmte Status
}

// Cron-Job prüft alle 15 Minuten:
// SELECT * FROM leads WHERE aktualisiert_am < NOW() - INTERVAL '{stunden} hours'
```

### 2.4 `zeitplan`
Wird nach einem Cron-Zeitplan ausgeführt.

```typescript
// Konfiguration
triggerKonfiguration: {
  cron: '0 9 * * 1-5',  // Jeden Werktag um 09:00 Uhr
  status: 'In Bearbeitung', // Für alle Leads in diesem Status
}
```

---

## 3. Bedingungs-Evaluierung

Bevor die Schritte ausgeführt werden, werden alle Bedingungen geprüft. Nur wenn ALLE Bedingungen erfüllt sind, läuft die Automatisierung.

```typescript
// Bedingungen in der Datenbank (JSON-Array)
bedingungen: [
  { feld: 'quelle', operator: 'gleich', wert: 'facebook_lead_ads' },
  { feld: 'status', operator: 'ungleich', wert: 'Nicht interessiert' },
  { feld: 'email', operator: 'nicht_leer' },
]

// Unterstützte Operatoren:
type Operator = 
  | 'gleich'        // ==
  | 'ungleich'      // !=
  | 'enthaelt'      // LIKE %wert%
  | 'nicht_leer'    // IS NOT NULL
  | 'ist_leer'      // IS NULL
  | 'groesser_als'  // > (für Zahlen)
  | 'kleiner_als';  // < (für Zahlen)

// Evaluierungs-Funktion:
function bedingungenErfuellt(lead: Lead, bedingungen: Bedingung[]): boolean {
  return bedingungen.every(b => {
    const feldWert = lead[b.feld] ?? lead.felder?.[b.feld];
    switch(b.operator) {
      case 'gleich':     return feldWert === b.wert;
      case 'ungleich':   return feldWert !== b.wert;
      case 'enthaelt':   return String(feldWert).includes(b.wert);
      case 'nicht_leer': return feldWert != null && feldWert !== '';
      case 'ist_leer':   return feldWert == null || feldWert === '';
      default:           return true;
    }
  });
}
```

---

## 4. Aktions-Typen

### 4.1 `email_senden`

```typescript
// Konfiguration
konfiguration: {
  templateId: 'uuid-des-templates',
  anEmail: '{{email}}',              // Variable oder feste E-Mail
  zeitfenster: {
    von: '09:00',
    bis: '20:00',
    wochentage: [1, 2, 3, 4, 5],    // 1=Montag, 7=Sonntag
  }
}

// Ausführung:
async function emailSenden(lead: Lead, konfiguration: EmailKonfiguration) {
  // 1. Zeitfenster prüfen
  if (!zeitfensterAktiv(konfiguration.zeitfenster)) {
    // Job auf nächsten Zeitfensterbeginn verschieben
    return { verschieben: naechsterZeitfensterbeginn(konfiguration.zeitfenster) };
  }
  
  // 2. Template laden und Variablen auflösen
  const template = await templateLaden(konfiguration.templateId);
  const html = variablenAufloesen(template.htmlInhalt, lead);
  const betreff = variablenAufloesen(template.betreff, lead);
  
  // 3. E-Mail senden
  await emailDienst.senden({
    an: variablenAufloesen(konfiguration.anEmail, lead),
    betreff,
    html,
    text: variablenAufloesen(template.textInhalt, lead),
  });
  
  // 4. Aktivitätslog
  await aktivitaetErstellen(lead.id, 'email_gesendet', 
    `E-Mail "${betreff}" gesendet`);
}
```

### 4.2 `whatsapp_senden`

```typescript
// Konfiguration
konfiguration: {
  templateId: 'tn_irRYGW0sWmrxwgwUiDEJh',  // Superchat Template-ID
  kanalId: 'mc_1qGLKEBSHivpTTSDpaDgF',      // Superchat Kanal-ID
  variablen: [
    { name: 'vorname', wert: '{{vorname}}' }
  ],
  zeitfenster: { von: '09:00', bis: '20:00', wochentage: [1,2,3,4,5] }
}

// Ausführung:
async function whatsappSenden(lead: Lead, konfiguration: WhatsAppKonfiguration) {
  // 1. Zeitfenster prüfen
  if (!zeitfensterAktiv(konfiguration.zeitfenster)) {
    return { verschieben: naechsterZeitfensterbeginn(konfiguration.zeitfenster) };
  }
  
  // 2. Kontakt in Superchat suchen
  let kontakt = await superchat.kontaktSuchen(lead.telefon);
  
  // 3. Kontakt erstellen wenn nicht vorhanden
  if (!kontakt) {
    kontakt = await superchat.kontaktErstellen({
      telefon: lead.telefon,
      vorname: lead.vorname,
      nachname: lead.nachname,
      email: lead.email,
    });
  }
  
  // 4. Template-Nachricht senden
  const variablen = konfiguration.variablen.map(v => ({
    name: v.name,
    wert: variablenAufloesen(v.wert, lead),
  }));
  
  await superchat.templateNachrichtSenden({
    kontaktId: kontakt.id,
    kanalId: konfiguration.kanalId,
    templateId: konfiguration.templateId,
    variablen,
  });
  
  // 5. Status setzen + Aktivitätslog
  await leadStatusSetzen(lead.id, 'WhatsApp erhalten');
  await aktivitaetErstellen(lead.id, 'whatsapp_gesendet', 
    'WhatsApp-Template-Nachricht gesendet');
}
```

### 4.3 `status_setzen`

```typescript
konfiguration: { neuerStatus: 'Nicht erreichbar' }

async function statusSetzen(lead: Lead, konfiguration: StatusKonfiguration) {
  await prisma.leads.update({
    where: { id: lead.id },
    data: { status: konfiguration.neuerStatus }
  });
  // PostgreSQL-Trigger protokolliert Status-Änderung automatisch
}
```

### 4.4 `warten`

```typescript
konfiguration: { minuten: 30 }

// Die Ausführung gibt ein Datum zurück – der Worker plant den Job neu:
function warten(konfiguration: WartenKonfiguration): Date {
  return new Date(Date.now() + konfiguration.minuten * 60 * 1000);
}
```

### 4.5 `warten_bis_uhrzeit`

```typescript
konfiguration: {
  uhrzeit: '09:00',
  wochentage: [1, 2, 3, 4, 5],  // Mo-Fr
}

// Nächsten gültigen Zeitpunkt berechnen:
function naechsterGueltiger Zeitpunkt(konfiguration: WartenBisUhrzeitKonfiguration): Date {
  const jetzt = new Date();
  const [stunden, minuten] = konfiguration.uhrzeit.split(':').map(Number);
  
  let ziel = new Date();
  ziel.setHours(stunden, minuten, 0, 0);
  
  // Wenn die Uhrzeit heute schon vorbei ist, morgen versuchen
  if (ziel <= jetzt) {
    ziel.setDate(ziel.getDate() + 1);
  }
  
  // Nächsten gültigen Wochentag finden
  while (!konfiguration.wochentage.includes(ziel.getDay() || 7)) {
    ziel.setDate(ziel.getDate() + 1);
  }
  
  return ziel;
}
```

---

## 5. Job-Worker Implementierung

```typescript
// jobs/automatisierung.job.ts

import { Worker, Job } from 'bullmq';

const worker = new Worker('automatisierungen', async (job: Job) => {
  const { automatisierungId, leadId, aktuellerSchritt } = job.data;
  
  // 1. Automatisierung und Lead laden
  const automatisierung = await prisma.automatisierungen.findUnique({
    where: { id: automatisierungId },
    include: { schritte: { orderBy: { reihenfolge: 'asc' } } }
  });
  
  const lead = await prisma.leads.findUnique({
    where: { id: leadId },
    include: { felder: true }
  });
  
  // 2. Prüfungen
  if (!automatisierung?.aktiv) return; // Automatisierung deaktiviert
  if (!lead || lead.geloescht) return; // Lead gelöscht
  if (!bedingungenErfuellt(lead, automatisierung.bedingungen)) return;
  
  // 3. Laufende Ausführung aktualisieren
  await prisma.automatisierungsAusfuehrungen.update({
    where: { id: job.data.ausfuehrungId },
    data: { aktuellerSchritt, status: 'laeuft' }
  });
  
  // 4. Schritt ausführen
  const schritt = automatisierung.schritte[aktuellerSchritt];
  if (!schritt) {
    // Alle Schritte abgeschlossen
    await prisma.automatisierungsAusfuehrungen.update({
      where: { id: job.data.ausfuehrungId },
      data: { status: 'abgeschlossen', abgeschlossenAm: new Date() }
    });
    return;
  }
  
  let verschieben: Date | null = null;
  
  switch (schritt.aktionTyp) {
    case 'email_senden':
      const ergebnis = await emailSenden(lead, schritt.konfiguration);
      if (ergebnis?.verschieben) verschieben = ergebnis.verschieben;
      break;
    case 'whatsapp_senden':
      const ergebnisWA = await whatsappSenden(lead, schritt.konfiguration);
      if (ergebnisWA?.verschieben) verschieben = ergebnisWA.verschieben;
      break;
    case 'status_setzen':
      await statusSetzen(lead, schritt.konfiguration);
      break;
    case 'warten':
      verschieben = warten(schritt.konfiguration);
      break;
    case 'warten_bis_uhrzeit':
      verschieben = naechsterGueltigerZeitpunkt(schritt.konfiguration);
      break;
  }
  
  // 5. Nächsten Schritt planen
  const naechsterSchritt = verschieben ? aktuellerSchritt : aktuellerSchritt + 1;
  const verzoegerung = verschieben 
    ? verschieben.getTime() - Date.now() 
    : 0;
  
  if (naechsterSchritt < automatisierung.schritte.length || verschieben) {
    await jobQueue.add('automatisierung_starten', {
      ...job.data,
      aktuellerSchritt: naechsterSchritt,
    }, { delay: verzoegerung });
  }
  
}, {
  connection: redis,
  concurrency: 10,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
  }
});

// Fehlerbehandlung
worker.on('failed', async (job, fehler) => {
  console.error(`Job fehlgeschlagen: ${job?.id}`, fehler);
  
  await prisma.automatisierungsAusfuehrungen.update({
    where: { id: job?.data.ausfuehrungId },
    data: { 
      status: 'fehler', 
      fehlerNachricht: fehler.message 
    }
  });
  
  // Admin per E-Mail benachrichtigen bei kritischen Fehlern
  if (job?.attemptsMade >= 3) {
    await adminBenachrichtigen(
      'Automatisierungsfehler',
      `Job ${job.id} ist nach 3 Versuchen fehlgeschlagen: ${fehler.message}`
    );
  }
});
```

---

## 6. Variablen-System

### 6.1 Verfügbare Variablen in Templates

```
{{vorname}}             – Vorname des Leads
{{nachname}}            – Nachname des Leads
{{email}}               – E-Mail-Adresse
{{telefon}}             – Telefonnummer
{{status}}              – Aktueller Status
{{kampagne_name}}       – Name der Kampagne
{{erstellt_am}}         – Datum der Lead-Erstellung (DE-Format)
{{zugewiesen_an}}       – Name des zugewiesenen Mitarbeiters

// Kampagnenspezifische Felder (dynamisch):
{{feld_pferd_rasse}}    – Wert des Feldes "pferd_rasse"
{{feld_anzahl_pferde}}  – Wert des Feldes "anzahl_pferde"
```

### 6.2 Variablen auflösen

```typescript
function variablenAufloesen(vorlage: string, lead: Lead): string {
  const variablen: Record<string, string> = {
    vorname:       lead.vorname ?? '',
    nachname:      lead.nachname ?? '',
    email:         lead.email ?? '',
    telefon:       lead.telefon ?? '',
    status:        lead.status,
    kampagne_name: lead.kampagne?.name ?? '',
    erstellt_am:   lead.erstelltAm.toLocaleDateString('de-DE'),
    zugewiesen_an: lead.zugewiesenAn?.vorname ?? 'Axano Team',
  };
  
  // Kampagnenspezifische Felder
  for (const feld of lead.felder ?? []) {
    variablen[`feld_${feld.feldname}`] = feld.wert ?? '';
  }
  
  return vorlage.replace(/\{\{(\w+)\}\}/g, (_, schluessel) => 
    variablen[schluessel] ?? `{{${schluessel}}}`
  );
}
```

---

## 7. Mapping: n8n → Axano LeadFlow

| n8n Node | Axano Äquivalent |
|----------|-----------------|
| `facebookLeadAdsTrigger` | Trigger-Typ: `facebook_lead_ads` |
| `set` (Lead Daten) | Automatische Lead-Normalisierung |
| `postgres` ADD Lead | Automatisch bei Lead-Eingang |
| `wait` (30 Min, 09:00 etc.) | Schritt: `warten` / `warten_bis_uhrzeit` |
| `switch` (Zeitliches Routing) | Zeitfenster-Konfiguration pro Schritt |
| `if` (Anruf lief?) | Bedingungs-Evaluierung |
| `gmail` (E-Mail senden) | Schritt: `email_senden` mit Template |
| `superchat` (WA Template) | Schritt: `whatsapp_senden` |
| `postgres` SET Status | Schritt: `status_setzen` |
| `calendlyTrigger` | Integration: Calendly Webhook |
| `googleCalendar` | Integration: Google Calendar |
| `openAi` (Zusammenfassung) | Zukünftig: KI-Zusammenfassung (v2) |
| 270 Nodes für 11 Versuche | 1 Automatisierung mit Schleife |

---

*Axano GmbH – Vertraulich – Nur für internen Gebrauch*
