/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Pflicht-Routen fuer DSGVO Art. 13 / TMG §5: Datenschutzerklaerung und Impressum
  // werden auf die zentrale Axano-Hauptseite weitergeleitet (selber Verantwortlicher).
  // Der LeadFlow-spezifische Abschnitt (Subprocessor VAPI/Anthropic/Calendly etc.)
  // wird auf der Hauptseite ergaenzt.
  async redirects() {
    return [
      {
        source: '/datenschutz',
        destination: 'https://axano.com/datenschutz',
        permanent: false, // 307: solange wir leadflow-spezifische Inhalte ggf. spaeter eigenstaendig zeigen wollen
      },
      {
        source: '/impressum',
        destination: 'https://axano.com/impressum',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
