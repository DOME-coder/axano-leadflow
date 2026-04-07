import { google, calendar_v3 } from 'googleapis';
import { integrationKonfigurationLesenMitFallback } from './integrationen.dienst';
import { logger } from '../hilfsfunktionen/logger';

interface FreierSlot {
  beginn: Date;
  ende: Date;
}

interface KalenderTerminDaten {
  titel: string;
  beschreibung?: string;
  beginn: Date;
  ende: Date;
  teilnehmerEmail?: string;
}

interface KalenderAnbieter {
  verfuegbarkeitPruefen(zeitpunkt: Date, dauerMinuten: number): Promise<FreierSlot[]>;
  terminErstellen(daten: KalenderTerminDaten): Promise<{ externeId: string; meetingLink?: string }>;
}

/**
 * Google Calendar Provider – nutzt OAuth2 mit Refresh-Token.
 */
class GoogleKalenderAnbieter implements KalenderAnbieter {
  private calendar: calendar_v3.Calendar;
  private kalenderId: string;

  constructor(clientId: string, clientGeheimnis: string, refreshToken: string, kalenderId?: string) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientGeheimnis);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    this.calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    this.kalenderId = kalenderId || 'primary';
  }

  async verfuegbarkeitPruefen(zeitpunkt: Date, dauerMinuten: number): Promise<FreierSlot[]> {
    const zeitMin = new Date(zeitpunkt);
    zeitMin.setHours(8, 0, 0, 0);
    const zeitMax = new Date(zeitpunkt);
    zeitMax.setHours(19, 0, 0, 0);

    try {
      const antwort = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: zeitMin.toISOString(),
          timeMax: zeitMax.toISOString(),
          timeZone: 'Europe/Berlin',
          items: [{ id: this.kalenderId }],
        },
      });

      const belegteZeiten = antwort.data.calendars?.[this.kalenderId]?.busy || [];

      // Alle 30-Min-Slots generieren und belegt filtern
      const freieSlots: FreierSlot[] = [];
      const slotStart = new Date(zeitMin);

      while (slotStart < zeitMax) {
        const slotEnde = new Date(slotStart.getTime() + dauerMinuten * 60 * 1000);

        const istBelegt = belegteZeiten.some((b) => {
          const belegStart = new Date(b.start!);
          const belegEnde = new Date(b.end!);
          return slotStart < belegEnde && slotEnde > belegStart;
        });

        if (!istBelegt) {
          freieSlots.push({ beginn: new Date(slotStart), ende: new Date(slotEnde) });
        }

        slotStart.setMinutes(slotStart.getMinutes() + 30);
      }

      return freieSlots;
    } catch (fehler) {
      logger.error('Google Calendar Verfügbarkeitsprüfung fehlgeschlagen:', { error: fehler });
      throw fehler;
    }
  }

  async terminErstellen(daten: KalenderTerminDaten): Promise<{ externeId: string; meetingLink?: string }> {
    try {
      const antwort = await this.calendar.events.insert({
        calendarId: this.kalenderId,
        conferenceDataVersion: 1,
        requestBody: {
          summary: daten.titel,
          description: daten.beschreibung,
          start: {
            dateTime: daten.beginn.toISOString(),
            timeZone: 'Europe/Berlin',
          },
          end: {
            dateTime: daten.ende.toISOString(),
            timeZone: 'Europe/Berlin',
          },
          attendees: daten.teilnehmerEmail ? [{ email: daten.teilnehmerEmail }] : undefined,
          conferenceData: {
            createRequest: {
              requestId: `leadflow-${Date.now()}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
        },
      });

      const event = antwort.data;
      const meetingLink = event.hangoutLink || event.conferenceData?.entryPoints?.[0]?.uri;

      logger.info(`Google Calendar Termin erstellt: ${event.id}`, { meetingLink });

      return {
        externeId: event.id!,
        meetingLink: meetingLink || undefined,
      };
    } catch (fehler) {
      logger.error('Google Calendar Termin-Erstellung fehlgeschlagen:', { error: fehler });
      throw fehler;
    }
  }
}

/**
 * Outlook Calendar Provider – nutzt Microsoft Graph API mit OAuth2.
 */
class OutlookKalenderAnbieter implements KalenderAnbieter {
  private clientId: string;
  private clientGeheimnis: string;
  private tenantId: string;
  private refreshToken: string;
  private accessToken: string | null = null;

  constructor(clientId: string, clientGeheimnis: string, tenantId: string, refreshToken: string) {
    this.clientId = clientId;
    this.clientGeheimnis = clientGeheimnis;
    this.tenantId = tenantId;
    this.refreshToken = refreshToken;
  }

  private async tokenAbrufen(): Promise<string> {
    if (this.accessToken) return this.accessToken;

    const antwort = await fetch(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.clientId,
          client_secret: this.clientGeheimnis,
          refresh_token: this.refreshToken,
          grant_type: 'refresh_token',
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    );

    if (!antwort.ok) {
      const fehler = await antwort.text();
      logger.error('Outlook Token-Refresh fehlgeschlagen:', { status: antwort.status, fehler });
      throw new Error(`Outlook Token-Refresh fehlgeschlagen: ${antwort.status}`);
    }

    const daten = await antwort.json() as { access_token: string };
    this.accessToken = daten.access_token;
    return this.accessToken;
  }

  private async graphAnfrage(pfad: string, methode: string = 'GET', body?: unknown): Promise<unknown> {
    const token = await this.tokenAbrufen();
    const antwort = await fetch(`https://graph.microsoft.com/v1.0${pfad}`, {
      method: methode,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!antwort.ok) {
      const fehler = await antwort.text();
      logger.error(`Outlook Graph API Fehler (${pfad}):`, { status: antwort.status, fehler });
      throw new Error(`Outlook API Fehler: ${antwort.status}`);
    }

    return antwort.json();
  }

  async verfuegbarkeitPruefen(zeitpunkt: Date, dauerMinuten: number): Promise<FreierSlot[]> {
    const zeitMin = new Date(zeitpunkt);
    zeitMin.setHours(8, 0, 0, 0);
    const zeitMax = new Date(zeitpunkt);
    zeitMax.setHours(19, 0, 0, 0);

    try {
      const daten = await this.graphAnfrage('/me/calendar/getSchedule', 'POST', {
        schedules: ['me'],
        startTime: { dateTime: zeitMin.toISOString(), timeZone: 'Europe/Berlin' },
        endTime: { dateTime: zeitMax.toISOString(), timeZone: 'Europe/Berlin' },
        availabilityViewInterval: dauerMinuten,
      }) as { value: Array<{ scheduleItems: Array<{ start: { dateTime: string }; end: { dateTime: string } }> }> };

      const belegteZeiten = daten.value?.[0]?.scheduleItems || [];

      // Freie Slots generieren
      const freieSlots: FreierSlot[] = [];
      const slotStart = new Date(zeitMin);

      while (slotStart < zeitMax) {
        const slotEnde = new Date(slotStart.getTime() + dauerMinuten * 60 * 1000);

        const istBelegt = belegteZeiten.some((b) => {
          const belegStart = new Date(b.start.dateTime);
          const belegEnde = new Date(b.end.dateTime);
          return slotStart < belegEnde && slotEnde > belegStart;
        });

        if (!istBelegt) {
          freieSlots.push({ beginn: new Date(slotStart), ende: new Date(slotEnde) });
        }

        slotStart.setMinutes(slotStart.getMinutes() + 30);
      }

      return freieSlots;
    } catch (fehler) {
      logger.error('Outlook Verfügbarkeitsprüfung fehlgeschlagen:', { error: fehler });
      throw fehler;
    }
  }

  async terminErstellen(daten: KalenderTerminDaten): Promise<{ externeId: string; meetingLink?: string }> {
    try {
      const event = await this.graphAnfrage('/me/events', 'POST', {
        subject: daten.titel,
        body: daten.beschreibung ? { contentType: 'text', content: daten.beschreibung } : undefined,
        start: { dateTime: daten.beginn.toISOString(), timeZone: 'Europe/Berlin' },
        end: { dateTime: daten.ende.toISOString(), timeZone: 'Europe/Berlin' },
        attendees: daten.teilnehmerEmail ? [{
          emailAddress: { address: daten.teilnehmerEmail },
          type: 'required',
        }] : undefined,
        isOnlineMeeting: true,
        onlineMeetingProvider: 'teamsForBusiness',
      }) as { id: string; onlineMeeting?: { joinUrl?: string } };

      const meetingLink = event.onlineMeeting?.joinUrl;

      logger.info(`Outlook Termin erstellt: ${event.id}`, { meetingLink });

      return {
        externeId: event.id,
        meetingLink: meetingLink || undefined,
      };
    } catch (fehler) {
      logger.error('Outlook Termin-Erstellung fehlgeschlagen:', { error: fehler });
      throw fehler;
    }
  }
}

/**
 * Factory: Erstellt den passenden Kalender-Anbieter für einen Kunden.
 * Priorität: 1. Outlook, 2. Google, 3. null (DB-Fallback)
 */
export async function kalenderAnbieterErstellen(kundeId?: string | null): Promise<KalenderAnbieter | null> {
  // 1. Outlook Calendar prüfen
  const outlookKonfig = await integrationKonfigurationLesenMitFallback('outlook', kundeId);

  if (outlookKonfig?.client_id && outlookKonfig?.client_geheimnis && outlookKonfig?.tenant_id && outlookKonfig?.refresh_token) {
    return new OutlookKalenderAnbieter(
      outlookKonfig.client_id,
      outlookKonfig.client_geheimnis,
      outlookKonfig.tenant_id,
      outlookKonfig.refresh_token
    );
  }

  // 2. Google Calendar prüfen
  const googleKonfig = await integrationKonfigurationLesenMitFallback('google', kundeId);

  if (googleKonfig?.client_id && googleKonfig?.client_geheimnis && googleKonfig?.refresh_token) {
    return new GoogleKalenderAnbieter(
      googleKonfig.client_id,
      googleKonfig.client_geheimnis,
      googleKonfig.refresh_token,
      googleKonfig.kalender_id || 'primary'
    );
  }

  // 3. Kein Kalender-Anbieter konfiguriert
  return null;
}

export type { KalenderAnbieter, FreierSlot, KalenderTerminDaten };
