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
    felder: ['api_schluessel', 'assistant_id', 'phone_number_id'],
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
 * Liest die entschlüsselte Konfiguration einer Integration (global).
 */
export async function integrationKonfigurationLesen(name: string): Promise<Record<string, string> | null> {
  const integration = await prisma.integration.findUnique({ where: { name } });
  if (!integration || !integration.aktiv) return null;

  return konfigurationEntschluesseln(name, integration.konfiguration as Record<string, string>);
}

/**
 * Entschlüsselt eine Integrations-Konfiguration basierend auf der Definition.
 */
function konfigurationEntschluesseln(name: string, konfig: Record<string, string>): Record<string, string> {
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

// ─── Pro-Kunde Integrationen ────────────────────────────────────────────

/**
 * Liest die Konfiguration mit Fallback: Kunde → Global.
 * Wenn der Kunde eine eigene aktive Integration hat, wird diese genutzt.
 * Sonst wird auf die globale Integration zurückgegriffen.
 */
export async function integrationKonfigurationLesenMitFallback(
  name: string,
  kundeId?: string | null
): Promise<Record<string, string> | null> {
  // 1. Versuche Kunden-spezifische Integration
  if (kundeId) {
    const kundenIntegration = await prisma.kundenIntegration.findUnique({
      where: { kundeId_name: { kundeId, name } },
    });

    if (kundenIntegration?.aktiv) {
      return konfigurationEntschluesseln(name, kundenIntegration.konfiguration as Record<string, string>);
    }
  }

  // 2. Fallback auf globale Integration
  return integrationKonfigurationLesen(name);
}

/**
 * Löst die kundeId aus einer kampagneId auf.
 */
export async function kundeIdVonKampagne(kampagneId: string): Promise<string | null> {
  const kampagne = await prisma.kampagne.findUnique({
    where: { id: kampagneId },
    select: { kundeId: true },
  });
  return kampagne?.kundeId || null;
}

/**
 * Convenience: Liest Integration für eine Kampagne (kampagneId → kundeId → Fallback).
 */
export async function integrationKonfigurationLesenFuerKampagne(
  name: string,
  kampagneId?: string | null
): Promise<Record<string, string> | null> {
  let kundeId: string | null = null;
  if (kampagneId) {
    kundeId = await kundeIdVonKampagne(kampagneId);
  }
  return integrationKonfigurationLesenMitFallback(name, kundeId);
}

/**
 * Listet alle Integrationen eines Kunden mit Status auf.
 */
export async function kundenIntegrationenAuflisten(kundeId: string) {
  const kundenIntegrationen = await prisma.kundenIntegration.findMany({
    where: { kundeId },
  });
  const kundenMap = new Map(kundenIntegrationen.map((i) => [i.name, i]));

  return INTEGRATIONEN_DEFINITIONEN.map((def) => {
    const kundenInt = kundenMap.get(def.name);
    let konfig: Record<string, string> = {};

    if (kundenInt) {
      const rohKonfig = kundenInt.konfiguration as Record<string, string>;
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
      eigeneKonfiguration: !!kundenInt,
      aktiv: kundenInt?.aktiv || false,
      konfiguration: konfig,
    };
  });
}

/**
 * Speichert eine Kunden-spezifische Integration.
 */
export async function kundenIntegrationSpeichern(
  kundeId: string,
  name: string,
  konfiguration: Record<string, string>,
  aktiv: boolean
) {
  const definition = INTEGRATIONEN_DEFINITIONEN.find((d) => d.name === name);
  if (!definition) {
    throw new Error(`Unbekannte Integration: ${name}`);
  }

  const verschluesseltKonfig: Record<string, string> = {};
  for (const [schluessel, wert] of Object.entries(konfiguration)) {
    if (definition.sensibleFelder.includes(schluessel) && wert && wert !== '••••••••') {
      verschluesseltKonfig[schluessel] = verschluesseln(wert);
    } else if (wert === '••••••••') {
      const bestehend = await prisma.kundenIntegration.findUnique({
        where: { kundeId_name: { kundeId, name } },
      });
      const bestehendKonfig = bestehend?.konfiguration as Record<string, string> | null;
      verschluesseltKonfig[schluessel] = bestehendKonfig?.[schluessel] || '';
    } else {
      verschluesseltKonfig[schluessel] = wert || '';
    }
  }

  const integration = await prisma.kundenIntegration.upsert({
    where: { kundeId_name: { kundeId, name } },
    update: {
      konfiguration: verschluesseltKonfig as Prisma.InputJsonValue,
      aktiv,
    },
    create: {
      kundeId,
      name,
      typ: definition.typ,
      konfiguration: verschluesseltKonfig as Prisma.InputJsonValue,
      aktiv,
    },
  });

  logger.info(`Kunden-Integration ${name} für Kunde ${kundeId} gespeichert (aktiv: ${aktiv})`);
  return integration;
}

/**
 * Löscht eine Kunden-spezifische Integration (fällt zurück auf global).
 */
export async function kundenIntegrationLoeschen(kundeId: string, name: string) {
  await prisma.kundenIntegration.deleteMany({
    where: { kundeId, name },
  });
  logger.info(`Kunden-Integration ${name} für Kunde ${kundeId} gelöscht (Fallback auf global)`);
}
