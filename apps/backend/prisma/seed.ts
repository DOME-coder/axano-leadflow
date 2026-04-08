import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function seed() {
  console.log('Starte Seed-Vorgang...');

  // Admin-Benutzer erstellen
  const passwortHash = await bcrypt.hash('admin123!', 12);

  const admin = await prisma.benutzer.upsert({
    where: { email: 'admin@axano.de' },
    update: {},
    create: {
      email: 'admin@axano.de',
      passwortHash,
      vorname: 'Admin',
      nachname: 'Axano',
      rolle: 'admin',
    },
  });

  console.log(`Admin-Benutzer erstellt: ${admin.email}`);

  console.log('Seed-Vorgang abgeschlossen.');
}

seed()
  .catch((fehler) => {
    console.error('Seed-Fehler:', fehler);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
