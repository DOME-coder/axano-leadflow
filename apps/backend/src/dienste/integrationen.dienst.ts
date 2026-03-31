import { prisma } from '../datenbank/prisma.client';
import { Prisma } from '@prisma/client';
import { verschluesseln, entschluesseln } from '../hilfsfunktionen/verschluesselung';
import { logger } from '../hilfsfunktionen/logger';

// Standardmäßig verfügbare Integrationen
const INTEGRATIONEN_DEFINITIONEN = [
  {
    name: 'smtp',
    typ: 'E-Mail-Versand',
    felder: ['host', 'port', 'benutzer', 'passwort', 'absender_name', 'absender_email'],
    sensibleFelder: ['passwort'],
  },
  {
    name: 'facebook',
    typ: 'Facebook Lead Ads',
    felder: ['app_id', 'app_geheimnis', 'verify_token', 'seiten_zugriffstoken'],
    sensibleFelder: ['app_geheimnis', 'seiten_zugriffstoken'],
  },
  {
    name: 'superchat',
    typ: 'WhatsApp (Superchat)',
    felder: ['api_schluessel', 'webhook_geheimnis', 'basis_url'],
    sensibleFelder: ['api_schluessel', 'webhook_geheimnis'],
  },
  {
    name: 'google',
    typ: 'Google Calendar',
    felder: ['client_id', 'client_geheimnis', 'refresh_token'],
    sensibleFelder: ['client_geheimnis', 'refresh_token'],
  },
  {
    name: 'calendly',
    typ: 'Calendly',
    felder: ['webhook_signing_key'],
    sensibleFelder: ['webhook_signing_key'],
  },
  {
    name: 'outlook',
    typ: 'Outlook Calendar',
    felder: ['client_id', 'client_geheimnis', 'tenant_id', 'refresh_token'],
    sensibleFelder: ['client_geheimnis', 'refresh_token'],
  },
  {
    name: 'vapi',
    typ: 'VAPI AI-Anrufe',
    felder: ['api_schluessel'],
    sensibleFelder: ['api_schluessel'],
  },
  {
    name: 'openai',
    typ: 'OpenAI (GPT)',
    felder: ['api_schluessel', 'modell'],
    sensibleFelder: ['api_schluessel'],
  },
  {
    name: 'anthropic',
    typ: 'Anthropic (Claude)',
    felder: ['api_schluessel', 'modell'],
    sensibleFelder: ['api_schluessel'],
  },
];

/**
 * Gibt den Konfigurations-Status aller Integrationen zurück (ohne sensible Daten).
 */
export async function integrationenStatusAuflisten() {
  const gespeicherte = await prisma.integration.findMany();
  const gespeicherteMap = new Map(gespeicherte.map((i) => [i.name, i]));

  return INTEGRATIONEN_DEFINITIONEN.map((def) => {
    const gespeichert = gespeicherteMap.get(def.name);
    let konfiguriert = false;

    if (gespeichert) {
      const rohKonfig = gespeichert.konfiguration as Record<string, string>;
      // Prüfe ob mindestens ein sensibles Feld einen Wert hat
      konfiguriert = def.sensibleFelder.some((feld) => {
        const wert = rohKonfig[feld];
        return wert && wert.length > 0;
      });
    }

    return {
      name: def.name,
      typ: def.typ,
      konfiguriert,
      aktiv: gespeichert?.aktiv ?? false,
    };
  });
}

/**
 * Listet alle Integrationen mit Status auf.
 * Sensible Felder werden maskiert zurückgegeben.
 */
export async function integrationenAuflisten() {
  const gespeicherte = await prisma.integration.findMany();
  const gespeicherteMap = new Map(gespeicherte.map((i) => [i.name, i]));

  return INTEGRATIONEN_DEFINITIONEN.map((def) => {
    const gespeichert = gespeicherteMap.get(def.name);
    let konfig: Record<string, string> = {};

    if (gespeichert) {
      const rohKonfig = gespeichert.konfiguration as Record<string, string>;
      // Sensible Felder maskieren
      for (const [schluessel, wert] of Object.entries(rohKonfig)) {
        if (def.sensibleFelder.includes(schluessel) && wert) {
          konfig[schluessel] = '••••••••';
        } else {
          try {
            konfig[schluessel] = wert ? entschluesseln(wert) : '';
          } catch {
            konfig[schluessel] = wert || '';
          }
        }
      }
    }

    return {
      name: def.name,
      typ: def.typ,
      felder: def.felder,
      aktiv: gespeichert?.aktiv || false,
      konfiguration: konfig,
    };
  });
}

/**
 * Speichert die Konfiguration einer Integration (sensible Felder verschlüsselt).
 */
export async function integrationSpeichern(
  name: string,
  konfiguration: Record<string, string>,
  aktiv: boolean
) {
  const definition = INTEGRATIONEN_DEFINITIONEN.find((d) => d.name === name);
  if (!definition) {
    throw new Error(`Unbekannte Integration: ${name}`);
  }

  // Sensible Felder verschlüsseln
  const verschluesseltKonfig: Record<string, string> = {};
  for (const [schluessel, wert] of Object.entries(konfiguration)) {
    if (definition.sensibleFelder.includes(schluessel) && wert && wert !== '••••••••') {
      verschluesseltKonfig[schluessel] = verschluesseln(wert);
    } else if (wert === '••••••••') {
      // Maskierten Wert nicht überschreiben – vorherigen behalten
      const bestehend = await prisma.integration.findUnique({ where: { name } });
      const bestehendKonfig = bestehend?.konfiguration as Record<string, string> | null;
      verschluesseltKonfig[schluessel] = bestehendKonfig?.[schluessel] || '';
    } else {
      verschluesseltKonfig[schluessel] = wert || '';
    }
  }

  const integration = await prisma.integration.upsert({
    where: { name },
    update: {
      konfiguration: verschluesseltKonfig as Prisma.InputJsonValue,
      aktiv,
    },
    create: {
      name,
      typ: definition.typ,
      konfiguration: verschluesseltKonfig as Prisma.InputJsonValue,
      aktiv,
    },
  });

  logger.info(`Integration ${name} gespeichert (aktiv: ${aktiv})`);
  return integration;
}

/**
 * Liest die entschlüsselte Konfiguration einer Integration.
 */
export async function integrationKonfigurationLesen(name: string): Promise<Record<string, string> | null> {
  const integration = await prisma.integration.findUnique({ where: { name } });
  if (!integration || !integration.aktiv) return null;

  const konfig = integration.konfiguration as Record<string, string>;
  const definition = INTEGRATIONEN_DEFINITIONEN.find((d) => d.name === name);
  if (!definition) return konfig;

  const entschluesselt: Record<string, string> = {};
  for (const [schluessel, wert] of Object.entries(konfig)) {
    if (definition.sensibleFelder.includes(schluessel) && wert) {
      try {
        entschluesselt[schluessel] = entschluesseln(wert);
      } catch {
        entschluesselt[schluessel] = wert;
      }
    } else {
      entschluesselt[schluessel] = wert;
    }
  }

  return entschluesselt;
}
