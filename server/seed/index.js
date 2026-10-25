const db = require('../db/init');
const bcrypt = require('bcryptjs');

const paintings = [
  {
    title: 'Earth & Cadmium No. 4',
    artist: 'Helena Vance',
    description: 'An expansive investigation into terrestrial weight and gestural cadence. Vance applies thick impasto layers of burnt sienna, umber, and chalk, allowing the raw linen edges to converse with the surrounding architecture.',
    price: 3400,
    image_url: 'assets/images/painting_hero.jpg'
  },
  {
    title: 'Concentric Solitude I & II',
    artist: 'Julian Ortiz',
    description: 'Two interlocking elliptical gestures rendered in raw ochre and soot. Ortiz reflects upon cyclical monastic rituals and temporal permanence in interior spaces.',
    price: 2850,
    image_url: 'assets/images/painting_01.jpg'
  },
  {
    title: 'Coastline in Rain',
    artist: 'Astrid Lindholm',
    description: 'A quiet, atmospheric exploration of the Scandinavian shoreline. Sweeps of wet-on-wet sage green and charcoal mist capture the weight of low coastal clouds.',
    price: 2100,
    image_url: 'assets/images/painting_02.jpg'
  },
  {
    title: 'Plaster, Bone & Raw Charcoal',
    artist: 'Helena Vance',
    description: 'Textural dialogue between solid monolithic forms and delicate graphite linear interventions. Conceived as a focal grounding element for open-plan residential interiors.',
    price: 3100,
    image_url: 'assets/images/painting_03.jpg'
  },
  {
    title: 'Gesture Toward Evening',
    artist: 'Julian Ortiz',
    description: 'Energetic calligraphic sweeps that negotiate density and void. The piece draws upon traditional East Asian brushwork translated through brutalist European abstraction.',
    price: 3950,
    image_url: 'assets/images/painting_04.jpg'
  },
  {
    title: 'Terracotta Monolith IX',
    artist: 'Astrid Lindholm',
    description: 'Rich tectonic impasto with stratified textural bands. The surface evokes ancient architectural facades weathered by wind and coastal salinity.',
    price: 1950,
    image_url: ''
  }
];

// Seed data metadata
const wallPaintingRate = 75; // per sq ft
const potteryItems = [
  'Pouring Vessel',
  'Fluted Offering Bowl',
  'Chiseled Column Vase',
  'Complete Dinnerware Set',
  'Ikebana Planter'
];
const glazes = [
  { name: 'Ash Glaze', color: '#8C867A' },
  { name: 'Matte Terracotta', color: '#B7654B' },
  { name: 'Raw Sand', color: '#D9C8B4' },
  { name: 'Speckled Chalk', color: '#E2DBD0' },
  { name: 'Smoked Charcoal', color: '#2F2D2A' }
];

function seedPaintings() {
  const insertPaintings = db.transaction(() => {
    const insertIfMissing = db.prepare(`
      INSERT INTO paintings (title, artist, description, price, image_url)
      SELECT ?, ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM paintings WHERE title = ? AND artist = ?
      )
    `);
    for (const painting of paintings) {
      insertIfMissing.run(
        painting.title,
        painting.artist,
        painting.description,
        painting.price,
        painting.image_url,
        painting.title,
        painting.artist
      );
    }
  });
  insertPaintings();
}

async function seed() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword || adminPassword === 'replace-with-a-strong-password') {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in the environment before seeding.');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('Set JWT_SECRET in the environment before seeding.');
  }

  const adminHash = await bcrypt.hash(adminPassword, 12);
  const insert = db.transaction(() => {
    const admin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail.trim().toLowerCase());
    if (!admin) {
      db.prepare(`
        INSERT INTO users (name, email, password_hash, role)
        VALUES (?, ?, ?, 'admin')
      `).run('Studio Admin', adminEmail.trim().toLowerCase(), adminHash);
    }

  });
  insert();
  seedPaintings();
  console.log('Seed data is ready. Existing records were preserved.');
}

// Export metadata for use in routes
module.exports = {
  wallPaintingRate,
  potteryItems,
  glazes,
  seedPaintings,
  seed
};

if (require.main === module) {
  seed().catch(err => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  });
}
