import { describe, it, expect } from 'vitest';
import { emailZumVorlesen } from './email.aussprache';

describe('emailZumVorlesen', () => {
  it('wandelt einfache E-Mail um', () => {
    expect(emailZumVorlesen('info@axano.de')).toBe('info Ätt axano Punkt de');
  });

  it('wandelt Punkt im lokalen Teil um', () => {
    expect(emailZumVorlesen('max.mustermann@allianz.de'))
      .toBe('max Punkt mustermann Ätt allianz Punkt de');
  });

  it('wandelt Bindestrich in Domain um', () => {
    expect(emailZumVorlesen('info@axano-leadflow.com'))
      .toBe('info Ätt axano Bindestrich leadflow Punkt com');
  });

  it('wandelt Unterstrich und Plus um', () => {
    expect(emailZumVorlesen('thomas_bauer+zahn@web.de'))
      .toBe('thomas Unterstrich bauer Plus zahn Ätt web Punkt de');
  });

  it('behandelt mehrere Punkte in Domain', () => {
    expect(emailZumVorlesen('a.b.c@d.co.uk'))
      .toBe('a Punkt b Punkt c Ätt d Punkt co Punkt uk');
  });

  it('gibt leere Zeichenkette bei leerer Eingabe zurueck', () => {
    expect(emailZumVorlesen('')).toBe('');
  });

  it('laesst Eingabe ohne Sonderzeichen unveraendert', () => {
    expect(emailZumVorlesen('hallo')).toBe('hallo');
  });

  it('trimmt Whitespace der Eingabe', () => {
    expect(emailZumVorlesen('   info@axano.de   ')).toBe('info Ätt axano Punkt de');
  });

  it('wandelt Schraegstrich um', () => {
    expect(emailZumVorlesen('a/b@x.de')).toBe('a Schrägstrich b Ätt x Punkt de');
  });

  it('komprimiert mehrfache Leerzeichen zu einem', () => {
    // Bei aufeinander folgenden Sonderzeichen entstehen mehrere Leerzeichen,
    // die auf eines reduziert werden sollen.
    expect(emailZumVorlesen('a..b@x.de')).toBe('a Punkt Punkt b Ätt x Punkt de');
  });
});
