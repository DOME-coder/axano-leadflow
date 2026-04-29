# Einwilligungs-Wortlaut für Werbeformulare unserer Kunden

**Stand:** 29.04.2026
**Anwaltlich freigegeben:** 29.04.2026
**Rechtsgrundlage:** UWG §7 Abs. 2 Nr. 1 + DSGVO Art. 6 Abs. 1 lit. a

## Zweck

Dieser Text muss von jedem Geschäftskunden, der Axano LeadFlow für automatisierte
KI-Anrufe nutzt, **als Pflicht-Checkbox in seinen Werbeformularen** (Facebook Lead
Ads, Webformulare, Landing Pages) eingebunden werden.

**Ohne diese Einwilligung sind die automatisierten Werbeanrufe rechtswidrig** und
dürfen nicht gestartet werden. Der Werbetreibende ist als Verantwortlicher (Art. 4
Nr. 7 DSGVO) für die Erhebung der Einwilligung zuständig; Axano GmbH verarbeitet
die so eingewilligten Lead-Daten als Auftragsverarbeiter (siehe Mustertext-AV-
Vertrag, [`../Vertraege/README.md`](../Vertraege/README.md)).

---

## Mustertext (anwaltlich freigegeben)

> Ich willige hiermit ausdrücklich ein, dass die **[Firmenname des Werbetreibenden]**
> sowie die **Axano GmbH**, Stettener Hauptstraße 62, 70771 Leinfelden-Echterdingen
> (als technischer Dienstleister im Auftrag von **[Firmenname]**), mich zum Zwecke
> der Beratung bezüglich **[Produkt/Thema]** kontaktieren dürfen — und zwar:
>
> - per Telefon (auch mittels automatisierter KI-Anrufsysteme)
> - per WhatsApp
> - per E-Mail
>
> Diese Einwilligung erteile ich freiwillig und kann sie jederzeit ohne Angabe von
> Gründen mit Wirkung für die Zukunft widerrufen. Der Widerruf berührt nicht die
> Rechtmäßigkeit der bis dahin erfolgten Verarbeitung. Zum Widerruf genügt eine
> formlose Mitteilung per E-Mail an: **[E-Mail-Adresse des Werbetreibenden]**
> oder an **team@axano.com**.
>
> Ich habe die **[Datenschutzerklärung von [Firmenname]]** sowie die Datenschutzerklärung
> der Axano GmbH (https://axano.com/datenschutz) zur Kenntnis genommen.

---

## Platzhalter, die der Werbetreibende ersetzen muss

| Platzhalter | Beispiel (Cannito GmbH) |
|---|---|
| `[Firmenname des Werbetreibenden]` | Cannito GmbH |
| `[Firmenname]` (verkürzte Wiederholung) | Cannito GmbH |
| `[Produkt/Thema]` | Pferdekrankenversicherung |
| `[E-Mail-Adresse des Werbetreibenden]` | datenschutz@cannito.de |
| `[Datenschutzerklärung von [Firmenname]]` | https://cannito.de/datenschutz |

---

## Anwendung pro Kanal

### Facebook Lead Ads

Im Facebook Ads Manager beim Erstellen der Lead-Form:

1. **Form-Type:** „More volume" oder „Higher intent"
2. **Custom Questions:** Pflichtfeld vom Typ „Conditional" oder „Custom"
3. **Im „Privacy Policy"-Abschnitt:** den Mustertext einfügen, **mit Pflicht-Checkbox**
4. **Wichtig:** Meta begrenzt manche Felder auf 2.000 Zeichen — der Mustertext oben passt rein

Nutzt euer Kunde stattdessen ein „Disclaimer"-Feld, dort den Text als Pflicht-Disclaimer einbinden.

### Webformulare / Landing Pages

Pflicht-Checkbox **vor** dem Submit-Button:

```html
<label>
  <input type="checkbox" required name="einwilligung" />
  [Mustertext, formatiert mit Zeilenumbrüchen]
</label>
```

Speichern beim Lead-Submit:
- `einwilligungAm = jetzt`
- `einwilligungIp = req.ip`
- `einwilligungText = [exakter angezeigter Text]`
- `einwilligungQuelle = "webformular_pflichtcheckbox"`

(Diese Felder existieren bereits im Lead-Schema, siehe
[`apps/backend/prisma/schema.prisma`](../../apps/backend/prisma/schema.prisma).)

### WhatsApp / E-Mail-Eingang (eingehende Leads)

Wenn ein Lead aktiv per WhatsApp oder E-Mail Kontakt aufnimmt, gilt die Anfrage
selbst als „mutmaßliche Einwilligung". Vor dem ersten automatisierten Anruf sollte
ein Mitarbeiter dennoch manuell prüfen und freigeben.

---

## Pflicht-Workflow vor Live-Schaltung einer Kunden-Kampagne

1. ☐ Kunde bekommt diesen Mustertext
2. ☐ Kunde baut den Text als Pflicht-Checkbox in sein Lead-Form ein
3. ☐ Kunde signiert AV-Vertrag mit Axano (siehe [`../Vertraege/README.md`](../Vertraege/README.md))
4. ☐ Test-Lead durchlaufen lassen — Einwilligungstext muss vor Submit sichtbar sein
5. ☐ Kampagne in Axano LeadFlow auf „aktiv" setzen, erst dann Anrufe scharf

---

## Aktualisierungshistorie

| Datum | Änderung |
|---|---|
| 29.04.2026 | Erststellung — anwaltlich freigegeben |
