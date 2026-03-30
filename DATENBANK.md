# DATENBANK – PostgreSQL Schema
## Axano LeadFlow Plattform
**Version:** 1.0.0  
**Stand:** März 2026  
**Datenbank:** PostgreSQL 15+

---

## 1. Übersicht Tabellen

```
benutzer
kampagnen
kampagnen_felder
leads
lead_felddaten
lead_status_historie
lead_notizen
lead_aktivitaeten
automatisierungen
automatisierungs_schritte
automatisierungs_ausfuehrungen
email_templates
termine
integrationen
system_logs
job_queue
```

---

## 2. Vollständiges Schema

### 2.1 Tabelle: `benutzer`

```sql
CREATE TABLE benutzer (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    passwort_hash       VARCHAR(255) NOT NULL,
    vorname             VARCHAR(100) NOT NULL,
    nachname            VARCHAR(100) NOT NULL,
    rolle               VARCHAR(50) NOT NULL DEFAULT 'mitarbeiter'
                        CHECK (rolle IN ('admin', 'mitarbeiter')),
    aktiv               BOOLEAN NOT NULL DEFAULT true,
    letzter_login       TIMESTAMPTZ,
    login_versuche      SMALLINT NOT NULL DEFAULT 0,
    gesperrt_bis        TIMESTAMPTZ,
    avatar_url          VARCHAR(500),
    erstellt_am         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aktualisiert_am     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_benutzer_email ON benutzer(email);
CREATE INDEX idx_benutzer_rolle ON benutzer(rolle);
```

### 2.2 Tabelle: `refresh_tokens`

```sql
CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    benutzer_id     UUID NOT NULL REFERENCES benutzer(id) ON DELETE CASCADE,
    token_hash      VARCHAR(255) NOT NULL UNIQUE,
    ablauf_am       TIMESTAMPTZ NOT NULL,
    erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    widerrufen      BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_refresh_tokens_benutzer ON refresh_tokens(benutzer_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token_hash);
```

### 2.3 Tabelle: `kampagnen`

```sql
CREATE TABLE kampagnen (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    beschreibung        TEXT,
    status              VARCHAR(50) NOT NULL DEFAULT 'aktiv'
                        CHECK (status IN ('aktiv', 'pausiert', 'archiviert')),
    trigger_typ         VARCHAR(50) NOT NULL
                        CHECK (trigger_typ IN (
                            'facebook_lead_ads',
                            'webhook',
                            'email',
                            'whatsapp',
                            'webformular'
                        )),
    trigger_konfiguration   JSONB NOT NULL DEFAULT '{}',
    webhook_slug            VARCHAR(100) UNIQUE,
    pipeline_spalten        JSONB NOT NULL DEFAULT '[
                                "Neu",
                                "In Bearbeitung",
                                "Follow-up",
                                "Nicht erreichbar",
                                "Termin gebucht",
                                "Nicht interessiert"
                            ]',
    erstellt_von            UUID REFERENCES benutzer(id),
    erstellt_am             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aktualisiert_am         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kampagnen_status ON kampagnen(status);
CREATE INDEX idx_kampagnen_trigger ON kampagnen(trigger_typ);
CREATE INDEX idx_kampagnen_webhook_slug ON kampagnen(webhook_slug);

COMMENT ON COLUMN kampagnen.trigger_konfiguration IS 
    'Facebook: {page_id, form_id, zugriffstoken} | 
     Webhook: {signatur_geheimnis} | 
     Email: {imap_host, imap_port, benutzer, passwort} | 
     WhatsApp: {kanal_id, api_schluessel}';
```

### 2.4 Tabelle: `kampagnen_felder`

```sql
CREATE TABLE kampagnen_felder (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kampagne_id     UUID NOT NULL REFERENCES kampagnen(id) ON DELETE CASCADE,
    feldname        VARCHAR(100) NOT NULL,
    bezeichnung     VARCHAR(255) NOT NULL,
    feldtyp         VARCHAR(50) NOT NULL
                    CHECK (feldtyp IN (
                        'text',
                        'zahl',
                        'email',
                        'telefon',
                        'datum',
                        'auswahl',
                        'ja_nein',
                        'mehrzeilig'
                    )),
    pflichtfeld     BOOLEAN NOT NULL DEFAULT false,
    optionen        JSONB,
    reihenfolge     SMALLINT NOT NULL DEFAULT 0,
    platzhalter     VARCHAR(255),
    hilfetext       VARCHAR(500),
    erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kampagnen_felder_kampagne ON kampagnen_felder(kampagne_id);
CREATE UNIQUE INDEX idx_kampagnen_felder_name 
    ON kampagnen_felder(kampagne_id, feldname);

COMMENT ON COLUMN kampagnen_felder.optionen IS 
    'Nur für feldtyp = auswahl: ["Option 1", "Option 2", ...]';
COMMENT ON COLUMN kampagnen_felder.feldname IS 
    'Technischer Name (snake_case), z.B. pferd_rasse';
```

### 2.5 Tabelle: `leads`

```sql
CREATE TABLE leads (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kampagne_id         UUID NOT NULL REFERENCES kampagnen(id),
    zugewiesen_an       UUID REFERENCES benutzer(id),
    vorname             VARCHAR(100),
    nachname            VARCHAR(100),
    email               VARCHAR(255),
    telefon             VARCHAR(50),
    status              VARCHAR(100) NOT NULL DEFAULT 'Neu',
    quelle              VARCHAR(100),
    duplikat_von        UUID REFERENCES leads(id),
    ist_duplikat        BOOLEAN NOT NULL DEFAULT false,
    gelöscht            BOOLEAN NOT NULL DEFAULT false,
    gelöscht_am         TIMESTAMPTZ,
    rohdaten            JSONB,
    erstellt_am         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aktualisiert_am     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_kampagne ON leads(kampagne_id);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_telefon ON leads(telefon);
CREATE INDEX idx_leads_zugewiesen ON leads(zugewiesen_an);
CREATE INDEX idx_leads_erstellt ON leads(erstellt_am DESC);
CREATE INDEX idx_leads_geloescht ON leads(gelöscht) WHERE gelöscht = false;
CREATE INDEX idx_leads_volltextsuche ON leads 
    USING gin(to_tsvector('german', 
        COALESCE(vorname,'') || ' ' || 
        COALESCE(nachname,'') || ' ' || 
        COALESCE(email,'') || ' ' || 
        COALESCE(telefon,'')
    ));
```

### 2.6 Tabelle: `lead_felddaten`

```sql
CREATE TABLE lead_felddaten (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    feld_id     UUID NOT NULL REFERENCES kampagnen_felder(id),
    wert        TEXT,
    erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_lead_felddaten_unique 
    ON lead_felddaten(lead_id, feld_id);
CREATE INDEX idx_lead_felddaten_lead ON lead_felddaten(lead_id);
```

### 2.7 Tabelle: `lead_status_historie`

```sql
CREATE TABLE lead_status_historie (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    alter_status    VARCHAR(100),
    neuer_status    VARCHAR(100) NOT NULL,
    geaendert_von   UUID REFERENCES benutzer(id),
    grund           TEXT,
    erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_status_historie_lead ON lead_status_historie(lead_id);
CREATE INDEX idx_status_historie_datum ON lead_status_historie(erstellt_am DESC);
```

### 2.8 Tabelle: `lead_notizen`

```sql
CREATE TABLE lead_notizen (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id     UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    autor_id    UUID REFERENCES benutzer(id),
    inhalt      TEXT NOT NULL,
    erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    bearbeitet_am TIMESTAMPTZ
);

CREATE INDEX idx_notizen_lead ON lead_notizen(lead_id);
```

### 2.9 Tabelle: `lead_aktivitaeten`

```sql
CREATE TABLE lead_aktivitaeten (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    typ             VARCHAR(100) NOT NULL
                    CHECK (typ IN (
                        'lead_erstellt',
                        'status_geaendert',
                        'notiz_hinzugefuegt',
                        'email_gesendet',
                        'whatsapp_gesendet',
                        'termin_gebucht',
                        'automatisierung_ausgefuehrt',
                        'fehler',
                        'manuell'
                    )),
    beschreibung    TEXT NOT NULL,
    metadaten       JSONB,
    benutzer_id     UUID REFERENCES benutzer(id),
    erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aktivitaeten_lead ON lead_aktivitaeten(lead_id);
CREATE INDEX idx_aktivitaeten_typ ON lead_aktivitaeten(typ);
CREATE INDEX idx_aktivitaeten_datum ON lead_aktivitaeten(erstellt_am DESC);
```

### 2.10 Tabelle: `automatisierungen`

```sql
CREATE TABLE automatisierungen (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kampagne_id     UUID NOT NULL REFERENCES kampagnen(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    beschreibung    TEXT,
    aktiv           BOOLEAN NOT NULL DEFAULT true,
    trigger_typ     VARCHAR(100) NOT NULL
                    CHECK (trigger_typ IN (
                        'lead_eingetroffen',
                        'status_geaendert',
                        'inaktivitaet',
                        'zeitplan'
                    )),
    trigger_konfiguration   JSONB NOT NULL DEFAULT '{}',
    bedingungen             JSONB NOT NULL DEFAULT '[]',
    reihenfolge             SMALLINT NOT NULL DEFAULT 0,
    erstellt_am             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aktualisiert_am         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_automatisierungen_kampagne ON automatisierungen(kampagne_id);
CREATE INDEX idx_automatisierungen_aktiv ON automatisierungen(aktiv);

COMMENT ON COLUMN automatisierungen.trigger_konfiguration IS
    'lead_eingetroffen: {} |
     status_geaendert: {von_status: "Neu", zu_status: "In Bearbeitung"} |
     inaktivitaet: {stunden: 24} |
     zeitplan: {cron: "0 9 * * 1-5"}';

COMMENT ON COLUMN automatisierungen.bedingungen IS
    '[{"feld": "status", "operator": "gleich", "wert": "Neu"}, ...]';
```

### 2.11 Tabelle: `automatisierungs_schritte`

```sql
CREATE TABLE automatisierungs_schritte (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automatisierung_id  UUID NOT NULL REFERENCES automatisierungen(id) ON DELETE CASCADE,
    reihenfolge         SMALLINT NOT NULL,
    aktion_typ          VARCHAR(100) NOT NULL
                        CHECK (aktion_typ IN (
                            'email_senden',
                            'whatsapp_senden',
                            'status_setzen',
                            'benachrichtigung',
                            'warten',
                            'warten_bis_uhrzeit'
                        )),
    konfiguration       JSONB NOT NULL DEFAULT '{}',
    erstellt_am         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auto_schritte_automatisierung 
    ON automatisierungs_schritte(automatisierung_id);

COMMENT ON COLUMN automatisierungs_schritte.konfiguration IS
    'email_senden: {template_id, betreff, an} |
     whatsapp_senden: {template_id, kanal_id} |
     status_setzen: {neuer_status} |
     warten: {minuten: 30} |
     warten_bis_uhrzeit: {uhrzeit: "09:00", wochentage: [1,2,3,4,5]}';
```

### 2.12 Tabelle: `automatisierungs_ausfuehrungen`

```sql
CREATE TABLE automatisierungs_ausfuehrungen (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    automatisierung_id      UUID NOT NULL REFERENCES automatisierungen(id),
    lead_id                 UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    status                  VARCHAR(50) NOT NULL DEFAULT 'laeuft'
                            CHECK (status IN ('laeuft', 'abgeschlossen', 'fehler', 'abgebrochen')),
    aktueller_schritt       SMALLINT NOT NULL DEFAULT 0,
    naechste_ausfuehrung    TIMESTAMPTZ,
    fehler_nachricht        TEXT,
    erstellt_am             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    abgeschlossen_am        TIMESTAMPTZ
);

CREATE INDEX idx_auto_ausfuehrungen_lead ON automatisierungs_ausfuehrungen(lead_id);
CREATE INDEX idx_auto_ausfuehrungen_naechste 
    ON automatisierungs_ausfuehrungen(naechste_ausfuehrung) 
    WHERE status = 'laeuft';
```

### 2.13 Tabelle: `email_templates`

```sql
CREATE TABLE email_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(255) NOT NULL,
    betreff         VARCHAR(500) NOT NULL,
    html_inhalt     TEXT NOT NULL,
    text_inhalt     TEXT,
    variablen       JSONB NOT NULL DEFAULT '[]',
    version         SMALLINT NOT NULL DEFAULT 1,
    erstellt_von    UUID REFERENCES benutzer(id),
    erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_templates_name ON email_templates(name);
```

### 2.14 Tabelle: `termine`

```sql
CREATE TABLE termine (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         UUID REFERENCES leads(id) ON DELETE SET NULL,
    kampagne_id     UUID REFERENCES kampagnen(id),
    titel           VARCHAR(255) NOT NULL,
    beschreibung    TEXT,
    beginn_am       TIMESTAMPTZ NOT NULL,
    ende_am         TIMESTAMPTZ,
    quelle          VARCHAR(100) CHECK (quelle IN ('calendly', 'google_calendar', 'manuell')),
    externe_id      VARCHAR(255),
    teilnehmer      JSONB,
    erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_termine_lead ON termine(lead_id);
CREATE INDEX idx_termine_beginn ON termine(beginn_am DESC);
CREATE INDEX idx_termine_kampagne ON termine(kampagne_id);
```

### 2.15 Tabelle: `integrationen`

```sql
CREATE TABLE integrationen (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    typ             VARCHAR(100) NOT NULL,
    konfiguration   JSONB NOT NULL DEFAULT '{}',
    aktiv           BOOLEAN NOT NULL DEFAULT false,
    erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    aktualisiert_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN integrationen.konfiguration IS
    'Verschlüsselt gespeichert (AES-256). 
     SMTP: {host, port, benutzer, passwort, absender_name, absender_email} |
     Superchat: {api_schluessel, basis_url} |
     Facebook: {app_id, app_geheimnis, seiten_zugriffstoken} |
     Google: {client_id, client_geheimnis, refresh_token}';
```

### 2.16 Tabelle: `system_logs`

```sql
CREATE TABLE system_logs (
    id          BIGSERIAL PRIMARY KEY,
    ebene       VARCHAR(20) NOT NULL CHECK (ebene IN ('info', 'warnung', 'fehler', 'kritisch')),
    kategorie   VARCHAR(100) NOT NULL,
    nachricht   TEXT NOT NULL,
    metadaten   JSONB,
    benutzer_id UUID REFERENCES benutzer(id),
    erstellt_am TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_logs_ebene ON system_logs(ebene);
CREATE INDEX idx_system_logs_datum ON system_logs(erstellt_am DESC);
CREATE INDEX idx_system_logs_kategorie ON system_logs(kategorie);

-- Automatisches Löschen von Logs älter als 90 Tage
SELECT cron.schedule('logs-bereinigen', '0 3 * * *', 
    'DELETE FROM system_logs WHERE erstellt_am < NOW() - INTERVAL ''90 days''');
```

### 2.17 Tabelle: `job_queue`

```sql
CREATE TABLE job_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_typ         VARCHAR(100) NOT NULL,
    nutzlast        JSONB NOT NULL DEFAULT '{}',
    status          VARCHAR(50) NOT NULL DEFAULT 'ausstehend'
                    CHECK (status IN ('ausstehend', 'laeuft', 'abgeschlossen', 'fehler')),
    versuche        SMALLINT NOT NULL DEFAULT 0,
    max_versuche    SMALLINT NOT NULL DEFAULT 3,
    naechster_versuch TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fehler_nachricht  TEXT,
    erstellt_am     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    abgeschlossen_am TIMESTAMPTZ
);

CREATE INDEX idx_job_queue_status_naechster 
    ON job_queue(naechster_versuch) 
    WHERE status IN ('ausstehend', 'fehler');
```

---

## 3. Datenbankfunktionen

### 3.1 Automatische Aktualisierung von `aktualisiert_am`

```sql
CREATE OR REPLACE FUNCTION aktualisiert_am_setzen()
RETURNS TRIGGER AS $$
BEGIN
    NEW.aktualisiert_am = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger für alle relevanten Tabellen
CREATE TRIGGER benutzer_aktualisiert_am
    BEFORE UPDATE ON benutzer
    FOR EACH ROW EXECUTE FUNCTION aktualisiert_am_setzen();

CREATE TRIGGER kampagnen_aktualisiert_am
    BEFORE UPDATE ON kampagnen
    FOR EACH ROW EXECUTE FUNCTION aktualisiert_am_setzen();

CREATE TRIGGER leads_aktualisiert_am
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION aktualisiert_am_setzen();
```

### 3.2 Automatische Status-Historie

```sql
CREATE OR REPLACE FUNCTION lead_status_protokollieren()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO lead_status_historie (lead_id, alter_status, neuer_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER leads_status_protokoll
    AFTER UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION lead_status_protokollieren();
```

### 3.3 Duplikatsprüfung

```sql
CREATE OR REPLACE FUNCTION duplikat_pruefen(
    p_kampagne_id UUID,
    p_email VARCHAR,
    p_telefon VARCHAR
) RETURNS UUID AS $$
DECLARE
    v_duplikat_id UUID;
BEGIN
    SELECT id INTO v_duplikat_id
    FROM leads
    WHERE kampagne_id = p_kampagne_id
      AND gelöscht = false
      AND (
          (email IS NOT NULL AND email = p_email) OR
          (telefon IS NOT NULL AND telefon = p_telefon)
      )
    ORDER BY erstellt_am ASC
    LIMIT 1;
    
    RETURN v_duplikat_id;
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Nützliche Views

### 4.1 Lead-Übersicht mit Kampagnenname

```sql
CREATE VIEW v_lead_uebersicht AS
SELECT
    l.id,
    l.vorname,
    l.nachname,
    l.email,
    l.telefon,
    l.status,
    l.quelle,
    l.ist_duplikat,
    l.erstellt_am,
    k.name AS kampagne_name,
    k.trigger_typ,
    CONCAT(b.vorname, ' ', b.nachname) AS zugewiesen_an_name
FROM leads l
JOIN kampagnen k ON l.kampagne_id = k.id
LEFT JOIN benutzer b ON l.zugewiesen_an = b.id
WHERE l.gelöscht = false;
```

### 4.2 Kampagnen-Statistiken

```sql
CREATE VIEW v_kampagnen_statistiken AS
SELECT
    k.id,
    k.name,
    k.trigger_typ,
    k.status,
    COUNT(l.id) AS gesamt_leads,
    COUNT(l.id) FILTER (WHERE l.erstellt_am >= NOW() - INTERVAL '24 hours') AS leads_heute,
    COUNT(l.id) FILTER (WHERE l.status = 'Termin gebucht') AS termine,
    COUNT(l.id) FILTER (WHERE l.status = 'Nicht erreichbar') AS nicht_erreichbar,
    ROUND(
        COUNT(l.id) FILTER (WHERE l.status = 'Termin gebucht')::DECIMAL /
        NULLIF(COUNT(l.id), 0) * 100, 1
    ) AS conversion_rate
FROM kampagnen k
LEFT JOIN leads l ON k.id = l.kampagne_id AND l.gelöscht = false
GROUP BY k.id, k.name, k.trigger_typ, k.status;
```

---

## 5. Migrations-Reihenfolge

```
001_benutzer.sql
002_refresh_tokens.sql
003_kampagnen.sql
004_kampagnen_felder.sql
005_leads.sql
006_lead_felddaten.sql
007_lead_status_historie.sql
008_lead_notizen.sql
009_lead_aktivitaeten.sql
010_automatisierungen.sql
011_automatisierungs_schritte.sql
012_automatisierungs_ausfuehrungen.sql
013_email_templates.sql
014_termine.sql
015_integrationen.sql
016_system_logs.sql
017_job_queue.sql
018_funktionen.sql
019_trigger.sql
020_views.sql
021_indizes.sql
022_standard_daten.sql
```

---

*Axano GmbH – Vertraulich – Nur für internen Gebrauch*
