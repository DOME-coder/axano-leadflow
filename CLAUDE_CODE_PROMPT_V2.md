# CLAUDE_CODE_PROMPT v2.0
## Axano LeadFlow – Vollständiger Entwicklungskontext
**Stand:** März 2026 | **Sprache:** Deutsch (Code + Kommentare + UI)

---

## PROJEKT-KONTEXT

Axano LeadFlow ist eine interne Plattform der Axano GmbH. Axano bietet Unternehmenskunden automatisierte Lead-Qualifizierung an. Die Plattform ersetzt einen n8n-Workflow mit 270 Nodes.

**Kernablauf:**
Lead kommt an → Daten speichern → KI ruft an (VAPI) → GPT analysiert Transkript → Follow-up per E-Mail/WhatsApp → Termin vereinbaren

---

## TECHNOLOGIE-STACK

```
Frontend:  Next.js 14 + TypeScript + Tailwind CSS + shadcn/ui
Backend:   Express.js + TypeScript + Prisma + PostgreSQL
Queue:     BullMQ + Redis
Auth:      JWT + bcrypt
Echtzeit:  Socket.IO
Schrift:   Manrope (Google Fonts)
```

## AXANO DESIGN
```
Primär:      #1a2b4c  (Dunkelblau – Seitenleiste)
Sekundär:    #2f3542
Graphit:     #3f4e65
Sky Blue:    #c7d7e8
Soft Cloud:  #f5f7fa  (Hintergrund)
Orange:      #ff8049  (CTAs, Highlights)
```

---

## VOLLSTÄNDIGER LEAD-ABLAUF (EXAKT IMPLEMENTIEREN)

### 1. Lead-Eingang
```typescript
// Reihenfolge ist ZWINGEND:
// 1. Rohdaten empfangen
// 2. Telefon normalisieren (+49)
// 3. Duplikat prüfen
// 4. In DB speichern (Status: "Neu")
// 5. WebSocket-Event senden
// 6. Automatisierung starten (nach 1 Sek Delay)
```

### 2. Zeitrouting vor jedem Anruf
```typescript
function naechstenAnrufZeitpunktBerechnen(zeitzone = 'Europe/Berlin'): Date {
  const jetzt = new Date();
  const stunde = parseInt(new Intl.DateTimeFormat('de-DE', {
    timeZone: zeitzone, hour: 'numeric', hour12: false
  }).format(jetzt));
  const tag = jetzt.getDay(); // 0=So, 6=Sa
  
  // Wochenende → Montag 09:00
  if (tag === 0 || tag === 6) {
    return naechsterWerktag(09, 00, zeitzone);
  }
  // Nach 21:00 → morgen 09:00
  if (stunde >= 21) {
    return morgen(09, 00, zeitzone);
  }
  // Vor 09:00 → heute 09:00
  if (stunde < 9) {
    return heute(09, 00, zeitzone);
  }
  // Zufallsverzögerung ±10 Min
  const verzoegerung = Math.floor(Math.random() * 10) * 60 * 1000;
  return new Date(Date.now() + verzoegerung);
}

// Zeitslots für Folge-Versuche:
const ANRUF_ZEITSLOTS = [
  { stunde: 9,  minute: 0  },  // 09:00
  { stunde: 12, minute: 30 },  // 12:30
  { stunde: 17, minute: 0  },  // 17:00
  { stunde: 18, minute: 0  },  // 18:00
  { stunde: 19, minute: 0  },  // 19:00
];
```

### 3. VAPI-Anruf starten
```typescript
async function vapiAnrufStarten(lead: Lead, kampagne: Kampagne): Promise<VapiAnrufErgebnis> {
  const antwort = await fetch('https://api.vapi.ai/call', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      assistantId: kampagne.vapiAssistantId,
      phoneNumberId: kampagne.vapiPhoneNumberId,
      customer: {
        number: lead.telefon,
        name: `${lead.vorname} ${lead.nachname}`
      },
      metadata: {
        leadId: lead.id,
        kampagneId: kampagne.id,
        versuchNr: lead.anrufVersuche + 1
      }
    })
  });
  return antwort.json();
}
```

### 4. VAPI End-of-Call Webhook verarbeiten
```typescript
// POST /api/v1/webhooks/vapi/end-of-call
async function vapiWebhookVerarbeiten(payload: VapiWebhookPayload) {
  // Nur End-of-Call-Reports verarbeiten
  if (payload.message?.type !== 'end-of-call-report') return;
  
  const { endedReason, artifact } = payload.message;
  const { leadId, versuchNr } = payload.metadata;
  
  // Technische Fehler → nächsten Versuch planen
  const technischeFehler = [
    'call-start-error-neither-assistant-nor-server-set',
    'assistant-error',
    'worker-shutdown', 
    'assistant-join-timed-out',
    'assistant-request-returned-error'
  ];
  
  if (technischeFehler.includes(endedReason)) {
    await naechstenVersuchPlanen(leadId, versuchNr);
    return;
  }
  
  // Voicemail → Backup-Check mit GPT
  if (endedReason === 'voicemail') {
    const backup = await voicemailBackupCheck(artifact.transcript);
    if (backup.verdict === 'voicemail') {
      await naechstenVersuchPlanen(leadId, versuchNr);
      await followUpSenden(leadId, 'voicemail');
      return;
    }
    // War doch ein echtes Gespräch → normal analysieren
  }
  
  // GPT-Analyse des Transkripts
  const analyse = await transkriptAnalysieren(artifact.transcript);
  await verdictVerarbeiten(leadId, analyse.verdict, analyse.summary);
}
```

### 5. GPT-Transkript-Analyse
```typescript
async function transkriptAnalysieren(transkript: string): Promise<GptAnalyse> {
  const antwort = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Du bist ein nützlicher, intelligenter Assistent, spezialisiert auf die Zusammenfassung und Analyse von Gesprächen/Transkripten.'
      },
      {
        role: 'user',
        content: `Du erhältst das Transkript eines Telefonats zwischen einem potenziellen Kunden und einem KI-Agenten. Der Anruf wurde vollständig durchgeführt. Fasse auf Deutsch prägnant zusammen was passiert ist.

Berücksichtige:
- Wurden Kontaktdaten gesammelt?
- Wurde ein Termin vereinbart oder abgelehnt?
- Sonstige relevante Infos?

Die Zusammenfassung dient zur internen Dokumentation. Schreibe sachlich, konkret, ohne Füllwörter. Falls du aufzählst welche Daten bestätigt wurden, nenne nur den Datentyp (nicht den Wert).

Gib AUSSCHLIESSLICH dieses JSON zurück:
{
  "summary": "[Zusammenfassung auf Deutsch]",
  "verdict": "[callback scheduled|not interested|wrong number|voicemail|disconnected|hung up]"
}

Verdicts:
- "callback scheduled" = Rückruf vereinbart oder Termin gebucht
- "not interested" = Klar kein Interesse geäußert
- "wrong number" = Falsche Person erreicht
- "voicemail" = Direkt in Mailbox gelaufen
- "disconnected" = Unerwartet unterbrochen
- "hung up" = Sofort aufgelegt ohne echtes Gespräch

Transkript: ${transkript}`
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(antwort.choices[0].message.content);
}

async function voicemailBackupCheck(transkript: string): Promise<{verdict: 'voicemail' | 'call'}> {
  const antwort = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: 'Du bist ein nützlicher, intelligenter Assistent, spezialisiert auf die Zusammenfassung und Analyse von Gesprächen/Transkripten.'
      },
      {
        role: 'user',
        content: `Du erhältst ein Transkript. Deine Aufgabe: erkenne ob die Voicemail fälschlicherweise nicht erkannt wurde oder ob tatsächlich ein Gespräch stattfand.

Gib NUR dieses JSON zurück:
{
  "verdict": "voicemail" oder "call"
}

"voicemail" = Es war die Voicemail
"call" = Es hat tatsächlich ein Gespräch stattgefunden

Transkript: ${transkript}`
      }
    ],
    response_format: { type: 'json_object' }
  });
  
  return JSON.parse(antwort.choices[0].message.content);
}
```

### 6. Verdict verarbeiten
```typescript
async function verdictVerarbeiten(leadId: string, verdict: string, zusammenfassung: string) {
  const statusMap: Record<string, string> = {
    'callback scheduled': 'Termin gebucht',
    'not interested':     'Nicht interessiert',
    'wrong number':       'Falsche Nummer',
    'voicemail':          'Voicemail',
    'disconnected':       'Attempt',
    'hung up':            'Attempt'
  };
  
  await leadStatusAktualisieren(leadId, statusMap[verdict]);
  await aktivitaetProtokollieren(leadId, 'anruf_analysiert', zusammenfassung);
  
  // Finale Status → kein weiterer Versuch
  const finaleStatus = ['Termin gebucht', 'Nicht interessiert', 'Falsche Nummer'];
  if (finaleStatus.includes(statusMap[verdict])) return;
  
  // Weiterer Versuch planen
  await naechstenVersuchPlanen(leadId);
}
```

### 7. Retry-Logik
```typescript
async function naechstenVersuchPlanen(leadId: string) {
  const lead = await prisma.leads.findUnique({ where: { id: leadId } });
  const kampagne = await prisma.kampagnen.findUnique({ where: { id: lead.kampagneId } });
  
  // Maximale Versuche erreicht?
  if (lead.anrufVersuche >= kampagne.maxAnrufVersuche) {
    await leadStatusAktualisieren(leadId, 'Nicht erreichbar');
    await followUpSenden(leadId, 'unerreichbar');
    return;
  }
  
  // Nächsten Zeitpunkt berechnen
  const naechsterZeitpunkt = naechstenAnrufZeitpunktBerechnen();
  
  // Job einplanen
  await anrufQueue.add('vapi-anruf', { leadId }, {
    delay: naechsterZeitpunkt.getTime() - Date.now()
  });
}
```

### 8. AI-Auto-Generierung
```typescript
async function kampagneInhalteGenerieren(eingabe: KampagneEingabe): Promise<GeneriertInhalte> {
  const antwort = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Erstelle alle Inhalte für eine Lead-Qualifizierungs-Kampagne.

Branche: ${eingabe.branche}
Produkt/Dienstleistung: ${eingabe.produkt}
Zielgruppe: ${eingabe.zielgruppe}
Ton: ${eingabe.ton}
Sprache: Deutsch

Gib NUR dieses JSON zurück:
{
  "vapiPrompt": "[Vollständiges Gesprächsskript für den KI-Agenten]",
  "emailTemplates": {
    "verpassterAnruf": { "betreff": "...", "html": "..." },
    "voicemailFollowup": { "betreff": "...", "html": "..." },
    "unerreichbar": { "betreff": "...", "html": "..." }
  },
  "whatsappTemplates": {
    "anrufFehlgeschlagen": "[Text]",
    "unerreichbar": "[Text]"
  },
  "formularfelder": [
    { "feldname": "...", "bezeichnung": "...", "feldtyp": "text|zahl|datum|auswahl|ja_nein", "pflichtfeld": true/false }
  ]
}`
    }]
  });
  
  return JSON.parse(antwort.content[0].text);
}
```

---

## DATENBANK-ERWEITERUNGEN (zu bestehenden Tabellen hinzufügen)

```sql
-- Kampagnen-Tabelle erweitern
ALTER TABLE kampagnen ADD COLUMN IF NOT EXISTS
  vapi_aktiviert        BOOLEAN DEFAULT false,
  vapi_assistant_id     VARCHAR(255),
  vapi_phone_number_id  VARCHAR(255),
  vapi_prompt           TEXT,
  max_anruf_versuche    SMALLINT DEFAULT 11,
  anruf_zeitslots       JSONB DEFAULT '[{"stunde":9,"minute":0},{"stunde":12,"minute":30},{"stunde":17,"minute":0},{"stunde":18,"minute":0},{"stunde":19,"minute":0}]',
  email_aktiviert       BOOLEAN DEFAULT true,
  whatsapp_aktiviert    BOOLEAN DEFAULT false,
  benachrichtigung_email VARCHAR(255),
  calendly_link         VARCHAR(500),
  branche               VARCHAR(255),
  zielgruppe            TEXT;

-- Leads-Tabelle erweitern  
ALTER TABLE leads ADD COLUMN IF NOT EXISTS
  anruf_versuche        SMALLINT DEFAULT 0,
  letzter_anruf_am      TIMESTAMPTZ,
  naechster_anruf_am    TIMESTAMPTZ,
  gpt_zusammenfassung   TEXT,
  gpt_verdict           VARCHAR(100),
  vapi_call_id          VARCHAR(255);
```

---

## API-ENDPUNKTE (neu hinzufügen)

```
POST /api/v1/webhooks/vapi/end-of-call     – VAPI Webhook
POST /api/v1/kampagnen/:id/ki-generieren   – AI-Auto-Generierung
GET  /api/v1/leads/:id/anruf-historie      – Anruf-Verlauf
POST /api/v1/leads/:id/anruf-starten       – Manueller Anruf
POST /api/v1/leads/:id/anruf-stoppen       – Anruf abbrechen
```

---

## WICHTIGE REGELN

1. **Reihenfolge:** Lead speichern → DANN Automatisierung starten (nie gleichzeitig)
2. **Zeitzone:** IMMER Europe/Berlin für Zeitberechnungen
3. **Vor jedem Anruf prüfen:** Ist Lead noch "aktiv" (kein finaler Status)?
4. **GPT-Output:** IMMER als JSON erzwingen, IMMER try/catch um JSON.parse
5. **VAPI-Webhook:** NUR `type === 'end-of-call-report'` verarbeiten
6. **Telefon:** IMMER +49-Format vor VAPI-Anruf prüfen
7. **Alle API-Keys:** AES-256-GCM verschlüsselt speichern
8. **Aktivitätslog:** JEDEN Schritt protokollieren (Anruf, GPT, Email, WA)

---

*Axano GmbH – Vertraulich*
