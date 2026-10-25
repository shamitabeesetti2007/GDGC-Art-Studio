/* ==========================================================================
   DATA STORE & STATE MANAGEMENT (LOCAL STORAGE PERSISTENCE)
   ========================================================================== */

const STORE_KEY_PREFIX = 'art_editorial_';

const DEFAULT_PAINTINGS = [
  {
    id: 'p-101',
    title: 'Earth & Cadmium No. 4',
    artist: 'Helena Vance',
    year: '2025',
    medium: 'Oil, raw pigment, and pumice on Belgian linen',
    dimensions: '140 × 105 cm',
    price: 3400,
    status: 'available',
    image: 'assets/images/painting_hero.jpg',
    aspect: 'landscape',
    description: 'An expansive investigation into terrestrial weight and gestural cadence. Vance applies thick impasto layers of burnt sienna, umber, and chalk, allowing the raw linen edges to converse with the surrounding architecture.',
    provenance: 'Studio inventory, London',
    framing: 'Float-framed in natural oiled walnut'
  },
  {
    id: 'p-102',
    title: 'Concentric Solitude I & II',
    artist: 'Julian Ortiz',
    year: '2024',
    medium: 'Terracotta wash and Chinese ink on heavy gesso',
    dimensions: '120 × 90 cm',
    price: 2850,
    status: 'available',
    image: 'assets/images/painting_01.jpg',
    aspect: 'portrait',
    description: 'Two interlocking elliptical gestures rendered in raw ochre and soot. Ortiz reflects upon cyclical monastic rituals and temporal permanence in interior spaces.',
    provenance: 'Exhibited at Frieze Masters Editions (2024)',
    framing: 'Raw oak tray frame with museum glass'
  },
  {
    id: 'p-103',
    title: 'Coastline in Rain',
    artist: 'Astrid Lindholm',
    year: '2025',
    medium: 'Mineral pigments, distemper, and graphite on cotton rag',
    dimensions: '110 × 80 cm',
    price: 2100,
    status: 'sold',
    image: 'assets/images/painting_02.jpg',
    aspect: 'landscape',
    description: 'A quiet, atmospheric exploration of the Scandinavian shoreline. Sweeps of wet-on-wet sage green and charcoal mist capture the weight of low coastal clouds.',
    provenance: 'Private Collection, Stockholm',
    framing: 'Custom floated on archival linen mat'
  },
  {
    id: 'p-104',
    title: 'Plaster, Bone & Raw Charcoal',
    artist: 'Helena Vance',
    year: '2025',
    medium: 'Charcoal, lime wash, and cold wax on linen',
    dimensions: '135 × 110 cm',
    price: 3100,
    status: 'available',
    image: 'assets/images/painting_03.jpg',
    aspect: 'landscape',
    description: 'Textural dialogue between solid monolithic forms and delicate graphite linear interventions. Conceived as a focal grounding element for open-plan residential interiors.',
    provenance: 'Studio Collection, London',
    framing: 'Unframed with wrapped raw linen edges'
  },
  {
    id: 'p-105',
    title: 'Gesture Toward Evening',
    artist: 'Julian Ortiz',
    year: '2024',
    medium: 'Walnut ink, raw umber, and shellac on canvas',
    dimensions: '150 × 100 cm',
    price: 3950,
    status: 'available',
    image: 'assets/images/painting_04.jpg',
    aspect: 'portrait',
    description: 'Energetic calligraphic sweeps that negotiate density and void. The piece draws upon traditional East Asian brushwork translated through brutalist European abstraction.',
    provenance: 'Studio Archive',
    framing: 'Slim blackened steel angle frame'
  },
  {
    id: 'p-106',
    title: 'Terracotta Monolith IX',
    artist: 'Astrid Lindholm',
    year: '2025',
    medium: 'Layered gesso, iron oxide, and sand on panel',
    dimensions: '95 × 75 cm',
    price: 1950,
    status: 'reserved',
    image: '', // Will test deterministic SVG fallback
    aspect: 'portrait',
    description: 'Rich tectonic impasto with stratified textural bands. The surface evokes ancient architectural facades weathered by wind and coastal salinity.',
    provenance: 'Studio Inventory',
    framing: 'Hand-rubbed wax beech frame'
  }
];

const DEFAULT_POTTERY = [
  {
    id: 'pot-01',
    title: 'Stoneware Pouring Vessel',
    type: 'Vessel',
    glaze: 'Ash Glaze',
    price: 240,
    dimensions: '22 × 14 cm',
    status: 'available',
    description: 'Hand-thrown reduction-fired stoneware with wood-ash drips and matte unglazed foot.',
    image: 'assets/images/pottery_hero.jpg'
  },
  {
    id: 'pot-02',
    title: 'Fluted Offering Bowl',
    type: 'Bowl',
    glaze: 'Speckled Chalk',
    price: 185,
    dimensions: '28 × 9 cm',
    status: 'available',
    description: 'Pinched rim bowl with iron-speckled chalk glaze, designed for centerpiece or fruit storage.',
    image: 'assets/images/pottery_hero.jpg'
  },
  {
    id: 'pot-03',
    title: 'Chiseled Column Vase',
    type: 'Vase',
    glaze: 'Matte Terracotta',
    price: 310,
    dimensions: '32 × 12 cm',
    status: 'available',
    description: 'Architectural faceted cylinder crafted from coarse grogged black clay with terracotta slip.',
    image: 'assets/images/pottery_hero.jpg'
  }
];

const DEFAULT_ORDERS = [
  {
    id: 'ORD-7821',
    date: '2026-09-18',
    itemTitle: 'Coastline in Rain',
    artist: 'Astrid Lindholm',
    type: 'Original Painting',
    amount: 2100,
    status: 'Delivered',
    recipient: 'Eleanor Vance',
    address: '42 Cheyne Walk, London SW3 5HJ',
    tracking: 'DHL-EX-99238120'
  }
];

const DEFAULT_BOOKINGS = [
  {
    id: 'WB-2026-04',
    date: '2026-11-12',
    roomType: 'Primary Living Room',
    areaSqm: 18,
    surface: 'Smooth Lime Plaster',
    estimatedPrice: 1600,
    status: 'Design Draft in Review',
    clientName: 'Julian & Claire Sterling',
    address: '7 Royal Crescent, Bath BA1 2LR',
    notes: 'Subtle atmospheric wash matching morning light from eastern bay windows.'
  }
];

const DEFAULT_POTTERY_REQUESTS = [
  {
    id: 'POT-REQ-09',
    itemType: 'Custom Dinnerware Set (8 place settings)',
    glaze: 'Speckled Chalk',
    quantity: 8,
    requiredDate: '2026-12-05',
    status: 'Wheel Throwing',
    clientName: 'Marcus Holloway',
    contact: 'marcus@hollowaystudio.co.uk',
    notes: 'Low rim plates with slightly uneven organic contour.'
  }
];

class Store {
  constructor() {
    this.init();
  }

  init() {
    if (!localStorage.getItem(STORE_KEY_PREFIX + 'paintings')) {
      localStorage.setItem(STORE_KEY_PREFIX + 'paintings', JSON.stringify(DEFAULT_PAINTINGS));
    }
    if (!localStorage.getItem(STORE_KEY_PREFIX + 'pottery')) {
      localStorage.setItem(STORE_KEY_PREFIX + 'pottery', JSON.stringify(DEFAULT_POTTERY));
    }
    if (!localStorage.getItem(STORE_KEY_PREFIX + 'orders')) {
      localStorage.setItem(STORE_KEY_PREFIX + 'orders', JSON.stringify(DEFAULT_ORDERS));
    }
    if (!localStorage.getItem(STORE_KEY_PREFIX + 'bookings')) {
      localStorage.setItem(STORE_KEY_PREFIX + 'bookings', JSON.stringify(DEFAULT_BOOKINGS));
    }
    if (!localStorage.getItem(STORE_KEY_PREFIX + 'pottery_requests')) {
      localStorage.setItem(STORE_KEY_PREFIX + 'pottery_requests', JSON.stringify(DEFAULT_POTTERY_REQUESTS));
    }
  }

  // --- Paintings ---
  getPaintings(filter = 'all') {
    const list = JSON.parse(localStorage.getItem(STORE_KEY_PREFIX + 'paintings') || '[]');
    if (filter === 'all') return list;
    if (filter === 'available') return list.filter(p => p.status === 'available');
    if (filter === 'sold') return list.filter(p => p.status === 'sold');
    return list;
  }

  getPaintingById(id) {
    const list = this.getPaintings();
    return list.find(p => p.id === id);
  }

  updatePainting(id, updates) {
    const list = this.getPaintings();
    const idx = list.findIndex(p => p.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updates };
      localStorage.setItem(STORE_KEY_PREFIX + 'paintings', JSON.stringify(list));
      return list[idx];
    }
    return null;
  }

  addPainting(painting) {
    const list = this.getPaintings();
    const newPainting = {
      id: 'p-' + Math.floor(100 + Math.random() * 900),
      status: 'available',
      year: new Date().getFullYear().toString(),
      ...painting
    };
    list.unshift(newPainting);
    localStorage.setItem(STORE_KEY_PREFIX + 'paintings', JSON.stringify(list));
    return newPainting;
  }

  // --- Orders ---
  getOrders() {
    return JSON.parse(localStorage.getItem(STORE_KEY_PREFIX + 'orders') || '[]');
  }

  createOrder(orderData) {
    const orders = this.getOrders();
    const newOrder = {
      id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
      date: new Date().toISOString().split('T')[0],
      status: 'Confirmed',
      tracking: 'DHL-EX-' + Math.floor(10000000 + Math.random() * 90000000),
      ...orderData
    };
    orders.unshift(newOrder);
    localStorage.setItem(STORE_KEY_PREFIX + 'orders', JSON.stringify(orders));

    // If order is for a painting, mark it as sold
    if (orderData.paintingId) {
      this.updatePainting(orderData.paintingId, { status: 'sold' });
    }

    return newOrder;
  }

  updateOrderStatus(orderId, status) {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx !== -1) {
      orders[idx].status = status;
      localStorage.setItem(STORE_KEY_PREFIX + 'orders', JSON.stringify(orders));
      return orders[idx];
    }
    return null;
  }

  // --- Wall Bookings ---
  getWallBookings() {
    return JSON.parse(localStorage.getItem(STORE_KEY_PREFIX + 'bookings') || '[]');
  }

  createWallBooking(bookingData) {
    const bookings = this.getWallBookings();
    const newBooking = {
      id: 'WB-2026-' + (bookings.length + 1).toString().padStart(2, '0'),
      status: 'Consultation Booked',
      ...bookingData
    };
    bookings.unshift(newBooking);
    localStorage.setItem(STORE_KEY_PREFIX + 'bookings', JSON.stringify(bookings));
    return newBooking;
  }

  updateBookingStatus(id, status) {
    const list = this.getWallBookings();
    const idx = list.findIndex(b => b.id === id);
    if (idx !== -1) {
      list[idx].status = status;
      localStorage.setItem(STORE_KEY_PREFIX + 'bookings', JSON.stringify(list));
      return list[idx];
    }
    return null;
  }

  // --- Pottery Requests ---
  getPotteryRequests() {
    return JSON.parse(localStorage.getItem(STORE_KEY_PREFIX + 'pottery_requests') || '[]');
  }

  createPotteryRequest(requestData) {
    const requests = this.getPotteryRequests();
    const newReq = {
      id: 'POT-REQ-' + (requests.length + 1).toString().padStart(2, '0'),
      status: 'Drafting',
      ...requestData
    };
    requests.unshift(newReq);
    localStorage.setItem(STORE_KEY_PREFIX + 'pottery_requests', JSON.stringify(requests));
    return newReq;
  }

  updatePotteryStatus(id, status) {
    const list = this.getPotteryRequests();
    const idx = list.findIndex(r => r.id === id);
    if (idx !== -1) {
      list[idx].status = status;
      localStorage.setItem(STORE_KEY_PREFIX + 'pottery_requests', JSON.stringify(list));
      return list[idx];
    }
    return null;
  }

  // --- Dashboard Stats ---
  getDashboardStats() {
    const paintings = this.getPaintings();
    const orders = this.getOrders();
    const bookings = this.getWallBookings();
    const pottery = this.getPotteryRequests();

    const revenue = orders.reduce((sum, o) => sum + (Number(o.amount) || 0), 0);
    const activeWall = bookings.filter(b => b.status !== 'Completed').length;
    const availablePaintings = paintings.filter(p => p.status === 'available').length;

    return {
      totalArtworks: paintings.length,
      availableArtworks: availablePaintings,
      totalOrders: orders.length,
      totalRevenue: revenue,
      activeWallBookings: activeWall,
      potteryInquiries: pottery.length
    };
  }
}

// Export singleton
window.ArtStore = new Store();
