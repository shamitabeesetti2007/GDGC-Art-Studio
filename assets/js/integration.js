/* Replaces the local demo interactions with authenticated API-backed routes. */
(function () {
  const App = window.App;
  const main = document.getElementById('app-main');
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const money = value => UI.formatCurrency(Number(value) || 0);
  const dateLabel = value => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return UI.formatDate(value);
  };
  const protectedCustomer = path => path === '/gallery' || path.startsWith('/gallery/') ||
    path.startsWith('/account/') || path === '/book-wall' || path === '/request-pottery';
  const studioPath = path => path === '/studio' || path.startsWith('/studio/');
  const statusBadge = status => `<span class="badge badge-${escapeHtml(status)}">${escapeHtml(status)}</span>`;

  App.user = null;
  App.authReady = false;
  App.galleryCache = [];

  function routeFromLocation() {
    const path = window.location.pathname.replace(/\/+$/, '') || '/';
    if (path !== '/') return path;
    const hash = window.location.hash.slice(1);
    if (!hash || hash === 'home') return '/';
    if (hash === 'wall-painting') return '/book-wall';
    if (hash === 'pottery') return '/request-pottery';
    if (hash === 'dashboard') return '/studio';
    if (hash.startsWith('dashboard/')) return `/studio/${hash.split('/')[1]}`;
    if (hash.startsWith('artwork/')) return `/gallery/${hash.split('/')[1]}`;
    if (hash.startsWith('account/')) {
      const section = hash.split('/')[1];
      return `/account/${section === 'wall' ? 'bookings' : section || 'orders'}`;
    }
    return `/${hash}`;
  }

  function navigate(path, replace = false) {
    let url = new URL(path, window.location.origin);
    if (url.origin !== window.location.origin) url = new URL('/', window.location.origin);
    if (replace) window.history.replaceState({}, '', url);
    else window.history.pushState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    App.handleRoute();
  }

  function setLoading(message = 'Loading the studio…') {
    main.innerHTML = `<section class="section-editorial"><div class="container"><div class="loading-state" role="status">${escapeHtml(message)}</div></div></section>`;
  }

  function setError(message, retry = true) {
    main.innerHTML = `<section class="section-editorial"><div class="container"><div class="empty-state" role="alert"><h2>We couldn’t load this page</h2><p>${escapeHtml(message)}</p>${retry ? '<button class="btn btn-secondary" data-action="retry">Try again</button>' : ''}</div></div></section>`;
  }

  function setHeader() {
    const list = document.getElementById('nav-links');
    const actions = document.querySelector('.nav-actions');
    const homeLink = document.getElementById('brand-wordmark');
    if (actions && (!document.getElementById('nav-dashboard-entry') ||
      !document.getElementById('nav-account-btn') || !document.getElementById('mobile-menu-btn'))) {
      actions.innerHTML = `
        <a href="/studio" class="nav-dashboard-link" id="nav-dashboard-entry" title="Open Studio Inventory &amp; Order Management" hidden>Studio Workspace</a>
        <a href="/login" class="nav-account-btn" id="nav-account-btn"><span>Log in</span></a>
        <button type="button" class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle navigation menu" aria-expanded="false"><span></span><span></span><span></span></button>
      `;
    }
    const dashboard = document.getElementById('nav-dashboard-entry');
    const account = document.getElementById('nav-account-btn');
    if (homeLink) homeLink.href = '/';
    if (dashboard) {
      dashboard.hidden = !App.user || App.user.role !== 'admin';
      dashboard.href = '/studio';
      dashboard.dataset.route = '';
    }
    if (account) {
      account.hidden = Boolean(App.user && App.user.role === 'admin');
      account.style.display = account.hidden ? 'none' : '';
      account.href = App.user ? (App.user.role === 'admin' ? '/studio' : '/account/orders') : '/login';
      account.dataset.route = '';
      account.innerHTML = App.user ? `<span>${App.user.role === 'admin' ? 'Studio' : 'My Account'}</span>` : '<span>Log in</span>';
    }
    if (!list) return;
    list.hidden = false;
    const links = !App.user
      ? [['Home', '/'], ['Log in', '/login'], ['Register', '/register']]
      : App.user.role === 'admin'
        ? [['Home', '/'], ['Studio overview', '/studio'], ['Paintings', '/studio/paintings'], ['Orders', '/studio/orders'], ['Bookings', '/studio/bookings'], ['Pottery', '/studio/pottery']]
        : [['Home', '/'], ['Gallery', '/gallery'], ['Book wall painting', '/book-wall'], ['Request pottery', '/request-pottery'], ['My orders', '/account/orders'], ['My bookings', '/account/bookings'], ['My pottery', '/account/pottery']];
    list.innerHTML = links.map(([label, href]) => `<li><a class="nav-link" data-route href="${href}">${label}</a></li>`).join('');
    if (App.user) {
      list.insertAdjacentHTML('beforeend', '<li><button class="nav-link" data-action="logout">Log out</button></li>');
    }
  }

  function imageMarkup(painting, extraClass = '') {
    const title = escapeHtml(painting.title);
    const artist = escapeHtml(painting.artist);
    const fallback = window.generateDeterministicSvg(String(painting.id), painting.title || 'Artwork');
    const image = painting.image_url || painting.image;
    const src = image && /^(https?:|\/)/i.test(image) ? image : image ? `/${image.replace(/^\.?\//, '')}` : '';
    return `<div class="artwork-image-container ${extraClass}">${src
      ? `<img src="${escapeHtml(src)}" alt="${title} by ${artist}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div class="artwork-fallback" hidden>${fallback}</div>`
      : `<div class="artwork-fallback">${fallback}</div>`}</div>`;
  }

  function artworkCard(painting) {
    const available = painting.available === true || painting.status === 'available';
    return `<a class="artwork-card" data-route href="/gallery/${encodeURIComponent(painting.id)}">
      ${imageMarkup(painting)}
      <div class="artwork-info"><div class="artwork-header-row"><h2 class="artwork-title">${escapeHtml(painting.title)}</h2><span class="artwork-price">${money(painting.price)}</span></div>
      <div class="artwork-artist">${escapeHtml(painting.artist)}</div><div class="artwork-meta-row">${statusBadge(available ? 'available' : 'sold')}</div></div>
    </a>`;
  }

  function shell(kicker, title, description, body) {
    return `<section class="section-editorial"><div class="container">
      <div class="section-header-editorial"><div><span class="editorial-kicker">${escapeHtml(kicker)}</span><h1>${escapeHtml(title)}</h1>${description ? `<p class="page-lead">${escapeHtml(description)}</p>` : ''}</div></div>
      ${body}
    </div></section>`;
  }

  function showPageError(error) {
    setError(error && error.message ? error.message : 'Please try again in a moment.');
  }

  function finishSession() {
    App.authReady = true;
    setHeader();
    App.handleRoute();
  }

  App.bindEvents = function () {};
  App.handleRoute = function () {
    const path = routeFromLocation();
    App.currentPath = path;
    if (!App.authReady) {
      setLoading('Restoring your studio session…');
      if (!App.sessionTask) {
        App.sessionTask = AuthApi.getCurrentUser()
          .then(user => { App.user = user; App.sessionError = null; })
          .catch(error => { App.user = null; App.sessionError = error; })
          .finally(() => { finishSession(); });
      }
      return;
    }
    if (App.sessionError) {
      return setError(App.sessionError.message, true);
    }
    setHeader();
    if (protectedCustomer(path) && !App.user) {
      return navigate(`/login?next=${encodeURIComponent(path)}`, true);
    }
    if (studioPath(path) && (!App.user || App.user.role !== 'admin')) {
      main.innerHTML = shell('Studio access', 'This area is for studio administrators.', 'Your account does not have permission to view studio records.', '<a class="btn btn-primary" data-route href="/">Return home</a>');
      return;
    }
    if (App.user && App.user.role === 'admin' && protectedCustomer(path)) {
      main.innerHTML = shell('Account access', 'Customer account required.', 'Studio administrator accounts cannot access customer purchase and booking actions.', '<a class="btn btn-secondary" data-route href="/studio">Go to the studio</a>');
      return;
    }

    const detail = path.match(/^\/gallery\/([^/]+)$/);
    if (path === '/') return App.renderHome();
    if (path === '/login') return App.renderAuth('login');
    if (path === '/register') return App.renderAuth('register');
    if (path === '/gallery') return App.renderGallery();
    if (detail) return App.renderArtwork(detail[1]);
    if (path === '/account/orders') return App.renderOrders();
    if (path === '/account/bookings') return App.renderBookings();
    if (path === '/account/pottery') return App.renderPotteryRequests();
    if (path === '/book-wall') return App.renderBookingForm();
    if (path === '/request-pottery') return App.renderPotteryForm();
    if (studioPath(path)) return App.renderStudio(path.split('/')[2] || 'overview');
    main.innerHTML = shell('Not found', 'This page is not in the collection.', '', '<a class="btn btn-primary" data-route href="/">Return home</a>');
  };

  App.renderHome = function () {
    main.innerHTML = `<section class="hero-section"><div class="container"><div class="hero-grid">
      <div class="hero-content"><span class="editorial-kicker">Independent studio &amp; gallery</span><h1 class="hero-title">Art that makes a space your own.</h1>
      <p class="hero-lead">Original paintings, considered spaces, and handmade pottery — created to bring character into everyday life.</p>
      <div class="hero-ctas"><a class="btn btn-primary" data-route href="${App.user ? (App.user.role === 'admin' ? '/studio' : '/gallery') : '/login'}">${App.user ? (App.user.role === 'admin' ? 'Enter the Studio' : 'Explore the Gallery') : 'Enter the collection'}</a>
      ${App.user && App.user.role === 'customer' ? '<a class="btn btn-secondary" data-route href="/book-wall">Book a wall painting</a>' : ''}</div>
      <div class="hero-editorial-note"><span class="hero-editorial-line"></span><span class="editorial-caption">A collection of original works and objects.</span></div></div>
      <div class="hero-art-composition"><div class="art-frame-primary"><img src="/assets/images/painting_hero.jpg" alt="Abstract original painting from the studio"></div><div class="art-frame-secondary"><img src="/assets/images/pottery_hero.jpg" alt="Handmade studio pottery"></div><span class="art-frame-caption">Paintings, architectural commissions &amp; studio ceramics</span></div>
      </div></div></section><hr class="section-divider"><section class="section-editorial"><div class="container"><div class="wall-painting-grid"><div><span class="editorial-kicker">A considered practice</span><h2>Material, gesture, and place.</h2></div><p>Explore original paintings and request a wall-painting commission or handmade pottery directly from the studio.</p></div><div class="hero-ctas" style="margin-top:24px"><a class="btn btn-secondary" data-route href="${App.user && App.user.role === 'customer' ? '/gallery' : '/login'}">View the gallery</a><a class="btn btn-secondary" data-route href="${App.user && App.user.role === 'customer' ? '/request-pottery' : '/login'}">Pottery requests</a></div></div></section>`;
  };

  App.renderAuth = function (mode) {
    const register = mode === 'register';
    const next = new URLSearchParams(window.location.search).get('next');
    main.innerHTML = shell('Client portal', register ? 'Create a collector account' : 'Welcome back', register ? 'Register as a customer to explore the collection and request studio services.' : 'Sign in to view the gallery and manage your studio requests.', `
      <div class="auth-card"><form data-form="${register ? 'register' : 'login'}" novalidate>
        ${register ? '<div class="form-group"><label class="form-label" for="auth-name">Name</label><input class="form-control" id="auth-name" name="name" autocomplete="name" required></div>' : ''}
        <div class="form-group"><label class="form-label" for="auth-email">Email</label><input class="form-control" id="auth-email" name="email" type="email" autocomplete="email" required></div>
        <div class="form-group"><label class="form-label" for="auth-password">Password</label><input class="form-control" id="auth-password" name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" required minlength="${register ? 8 : 1}"></div>
        ${register ? '<div class="form-group"><label class="form-label" for="auth-confirm">Confirm password</label><input class="form-control" id="auth-confirm" name="confirm" type="password" autocomplete="new-password" required></div>' : ''}
        <p class="form-error" data-error aria-live="polite"></p><button class="btn btn-primary" type="submit">${register ? 'Create account' : 'Log in'}</button>
      </form><p class="form-hint">${register ? 'Already registered? <a data-route href="/login">Log in</a>' : 'New to the studio? <a data-route href="/register">Create a customer account</a>'}</p></div>`);
  };

  App.renderGallery = async function () {
    setLoading('Loading the paintings collection…');
    try {
      App.galleryCache = await PaintingsApi.listPaintings();
      const availableCount = App.galleryCache.filter(item => item.available).length;
      const soldCount = App.galleryCache.length - availableCount;
      main.innerHTML = shell('Gallery collection', 'Paintings & works on linen', 'Original works from the studio. Sold works remain part of the archive.', `
        <div class="gallery-controls"><label class="form-group"><span class="form-label">Search title or artist</span><input class="form-control" id="gallery-search" type="search" placeholder="Search the collection"></label>
        <label class="form-group"><span class="form-label">Availability</span><select class="form-control" id="gallery-filter"><option value="all">All works (${App.galleryCache.length})</option><option value="available">Available (${availableCount})</option><option value="sold">Sold (${soldCount})</option></select></label></div>
        <div class="gallery-grid" id="api-gallery-grid"></div>`);
      App.updateGalleryGrid();
      document.getElementById('gallery-search').addEventListener('input', () => App.updateGalleryGrid());
      document.getElementById('gallery-filter').addEventListener('change', () => App.updateGalleryGrid());
    } catch (error) {
      showPageError(error);
    }
  };

  App.updateGalleryGrid = function () {
    const grid = document.getElementById('api-gallery-grid');
    if (!grid) return;
    const query = document.getElementById('gallery-search').value.trim().toLowerCase();
    const filter = document.getElementById('gallery-filter').value;
    const items = App.galleryCache.filter(item => {
      const matches = `${item.title} ${item.artist}`.toLowerCase().includes(query);
      return matches && (filter === 'all' || (filter === 'available' ? item.available : !item.available));
    });
    grid.innerHTML = items.length ? items.map(artworkCard).join('') : '<div class="empty-state"><h2>No matching works</h2><p>Try another search or availability filter.</p></div>';
  };

  App.renderArtwork = async function (id) {
    setLoading('Loading artwork details…');
    try {
      const p = await PaintingsApi.getPainting(id);
      const available = Boolean(p.available);
      main.innerHTML = shell('Artwork detail', p.title, p.artist, `<div class="artwork-detail-layout">
        <div class="detail-image-frame">${imageMarkup(p, 'portrait')}</div>
        <div class="artwork-detail-info"><div class="detail-price-row"><strong class="detail-price-tag">${money(p.price)}</strong>${statusBadge(available ? 'available' : 'sold')}</div>
        <p>${escapeHtml(p.description)}</p><dl class="detail-facts"><dt>Artist</dt><dd>${escapeHtml(p.artist)}</dd><dt>Availability</dt><dd>${available ? 'Available to purchase' : 'Sold'}</dd></dl>
        ${available ? '<button class="btn btn-primary" id="purchase-artwork">Purchase this painting</button>' : '<button class="btn btn-secondary" disabled>Sold</button>'}</div>
      </div>`);
      if (available) document.getElementById('purchase-artwork').addEventListener('click', () => {
        UI.confirm({
          title: `Purchase “${escapeHtml(p.title)}”?`,
          message: `The server will confirm the purchase at ${money(p.price)}. No payment will be taken here.`,
          confirmText: 'Confirm purchase',
          onConfirm: () => App.purchaseArtwork(p)
        });
      });
    } catch (error) {
      showPageError(error);
    }
  };

  App.purchaseArtwork = async function (painting) {
    try {
      const order = await OrdersApi.createOrder(painting.id);
      UI.toast(`Purchase confirmed by the studio. Order #${order.id}.`, 'success');
      navigate('/account/orders');
    } catch (error) {
      UI.toast(error.message, 'error');
      if (error.status === 409) App.handleRoute();
    }
  };

  App.renderOrders = async function () {
    setLoading('Loading your orders…');
    try {
      const orders = await OrdersApi.listOrders();
      const rows = orders.map(order => `<article class="data-row"><div class="data-row-image">${order.painting ? imageMarkup(order.painting) : ''}</div>
        <div class="data-row-main"><h2>${escapeHtml(order.painting ? order.painting.title : 'Archived artwork')}</h2><p>${escapeHtml(order.painting ? order.painting.artist : '')}</p><p>${dateLabel(order.created_at)} · ${statusBadge(order.status)}</p></div>
        <div class="data-row-action"><strong>${money(order.price)}</strong>${order.status === 'placed' ? `<button class="btn btn-secondary btn-sm" data-action="cancel-order" data-id="${order.id}">Cancel order</button>` : ''}</div></article>`).join('');
      main.innerHTML = shell('Client portal', 'My orders', 'Your purchase price is the snapshot recorded when the order was placed.', rows || '<div class="empty-state"><h2>No orders yet</h2><p>Your confirmed purchases will appear here.</p><a class="btn btn-primary" data-route href="/gallery">Explore the gallery</a></div>');
    } catch (error) { showPageError(error); }
  };

  App.renderBookings = async function () {
    setLoading('Loading your wall-painting bookings…');
    try {
      const [bookings, meta] = await Promise.all([BookingsApi.listBookings(), MetaApi.getMeta()]);
      const today = meta.wallPainting.today;
      const rows = bookings.map(booking => {
        const daysAway = calendarDays(booking.date, today);
        const canCancel = ['requested', 'confirmed'].includes(booking.status) && daysAway >= 3;
        return `<article class="data-row"><div class="data-row-main"><h2>${dateLabel(booking.date)}</h2><p>${booking.wall_sqft} sq ft · ${escapeHtml(booking.address)}</p><p>${money(booking.rate)} / sq ft · ${money(booking.total_price)} total</p><p>Requested ${dateLabel(booking.created_at)} · ${statusBadge(booking.status)}</p></div>
          ${canCancel ? `<div class="data-row-action"><button class="btn btn-secondary btn-sm" data-action="cancel-booking" data-id="${booking.id}">Cancel booking</button></div>` : ''}</article>`;
      }).join('');
      main.innerHTML = shell('Client portal', 'My wall-painting bookings', 'The server remains authoritative for booking status and cancellation eligibility.', rows || '<div class="empty-state"><h2>No bookings yet</h2><p>Choose a date to request a wall-painting consultation.</p><a class="btn btn-primary" data-route href="/book-wall">Request a booking</a></div>');
    } catch (error) { showPageError(error); }
  };

  App.renderBookingForm = async function () {
    setLoading('Loading booking availability and studio rates…');
    try {
      const [meta, taken] = await Promise.all([MetaApi.getMeta(), BookingsApi.getTakenDates()]);
      App.bookingMeta = meta.wallPainting;
      App.takenDates = taken;
      const days = Array.from({ length: meta.wallPainting.maxDaysAhead + 1 }, (_, index) => addCalendarDays(meta.wallPainting.today, index));
      main.innerHTML = shell('Architectural commission', 'Book a wall-painting consultation', 'Choose a date and share the wall area and service address. Your price preview is an estimate until the studio confirms the request.', `
        <div class="wall-painting-grid"><div><h2>Booking guidelines</h2><ul class="wall-spec-list"><li>Minimum wall area: ${meta.wallPainting.minSqft} sq ft</li><li>Maximum wall area: ${meta.wallPainting.maxSqft} sq ft</li><li>Dates: ${meta.wallPainting.minDaysAhead}–${meta.wallPainting.maxDaysAhead} days from today</li><li>Requested and confirmed bookings reserve their date.</li><li>Cancellation is allowed at least ${meta.wallPainting.cancelMinDaysAhead} days before the booking date.</li></ul>
        <div class="booking-calendar"><h3>Select a date</h3><div class="calendar-grid">${days.map((date, index) => {
          const invalid = index < meta.wallPainting.minDaysAhead || taken.includes(date);
          return `<button class="calendar-day" type="button" data-date="${date}" ${invalid ? 'disabled' : ''} aria-label="${date}${taken.includes(date) ? ', unavailable' : ''}">${date.slice(-2)}<small>${date.slice(5)}</small></button>`;
        }).join('')}</div></div></div>
        <div class="booking-calculator-card"><form data-form="booking"><input type="hidden" name="date" id="booking-date" required>
          <div class="form-group"><label class="form-label" for="booking-area">Wall area (sq ft)</label><input class="form-control" name="wall_sqft" id="booking-area" type="number" min="${meta.wallPainting.minSqft}" max="${meta.wallPainting.maxSqft}" step="1" required></div>
          <div class="form-group"><label class="form-label" for="booking-address">Service address</label><textarea class="form-control" name="address" id="booking-address" required></textarea></div>
          <div class="calculator-price-preview"><div><span class="price-preview-label">Estimated total</span><div class="form-hint">Rate: ${money(meta.wallPainting.ratePerSqft)} / sq ft</div><div id="booking-selected-date">Choose an available date</div></div><strong class="price-preview-amount" id="booking-estimate">—</strong></div>
          <p class="form-error" data-error aria-live="polite"></p><button class="btn btn-terracotta" type="submit">Submit booking request</button></form></div></div>`);
      main.querySelectorAll('.calendar-day:not([disabled])').forEach(button => button.addEventListener('click', () => {
        main.querySelectorAll('.calendar-day').forEach(day => day.classList.remove('selected'));
        button.classList.add('selected');
        document.getElementById('booking-date').value = button.dataset.date;
        document.getElementById('booking-selected-date').textContent = dateLabel(button.dataset.date);
      }));
      document.getElementById('booking-area').addEventListener('input', () => {
        const area = Number(document.getElementById('booking-area').value);
        document.getElementById('booking-estimate').textContent = area ? money(area * meta.wallPainting.ratePerSqft) : '—';
      });
    } catch (error) { showPageError(error); }
  };

  App.renderPotteryForm = async function () {
    setLoading('Loading studio pottery options…');
    try {
      const meta = await MetaApi.getMeta();
      const pottery = meta.pottery;
      const minDate = addCalendarDays(pottery.today, pottery.minDaysAhead);
      main.innerHTML = shell('Studio ceramics', 'Request handmade pottery', 'Select an item and glaze supplied by the studio. The request has no price until the studio provides one.', `<div class="booking-calculator-card" style="max-width:760px;margin:0 auto">
        <form data-form="pottery"><div class="form-row"><div class="form-group"><label class="form-label" for="pot-item">Pottery item</label><select class="form-control" name="item" id="pot-item" required>${pottery.items.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join('')}</select></div>
        <div class="form-group"><label class="form-label" for="pot-glaze">Glaze</label><select class="form-control" name="glaze" id="pot-glaze" required>${pottery.glazes.map(glaze => `<option value="${escapeHtml(glaze.name)}">${escapeHtml(glaze.name)}</option>`).join('')}</select></div></div>
        <div class="glaze-swatches">${pottery.glazes.filter(glaze => glaze.color).map(glaze => `<span class="glaze-swatch-item"><i style="background-color:${escapeHtml(glaze.color)}"></i>${escapeHtml(glaze.name)}</span>`).join('')}</div>
        <div class="form-row"><div class="form-group"><label class="form-label" for="pot-quantity">Quantity</label><input class="form-control" name="quantity" id="pot-quantity" type="number" min="${pottery.minQuantity}" max="${pottery.maxQuantity}" value="1" required></div>
        <div class="form-group"><label class="form-label" for="pot-date">Needed by</label><input class="form-control" name="needed_by" id="pot-date" type="date" min="${minDate}" required><span class="form-hint">At least ${pottery.minDaysAhead} days from today.</span></div></div>
        <p class="form-error" data-error aria-live="polite"></p><button class="btn btn-primary" type="submit">Send pottery request</button></form></div>`);
    } catch (error) { showPageError(error); }
  };

  App.renderPotteryRequests = async function () {
    setLoading('Loading your pottery requests…');
    try {
      const requests = await PotteryApi.listPotteryRequests();
      const rows = requests.map(item => `<article class="data-row"><div class="data-row-main"><h2>${escapeHtml(item.item)}</h2><p>${escapeHtml(item.glaze)} · Quantity ${item.quantity}</p><p>Needed by ${dateLabel(item.needed_by)} · Updated ${dateLabel(item.updated_at)}</p><p>${statusBadge(item.status)}</p></div>
        ${item.status === 'requested' ? `<div class="data-row-action"><button class="btn btn-secondary btn-sm" data-action="edit-pottery" data-id="${item.id}">Edit</button><button class="btn btn-secondary btn-sm" data-action="cancel-pottery" data-id="${item.id}">Cancel</button></div>` : ''}</article>`).join('');
      App.potteryCache = requests;
      main.innerHTML = shell('Client portal', 'My pottery requests', 'Requests can be edited or cancelled while they are still requested.', rows || '<div class="empty-state"><h2>No pottery requests yet</h2><p>Send the studio a custom pottery request.</p><a class="btn btn-primary" data-route href="/request-pottery">Make a request</a></div>');
    } catch (error) { showPageError(error); }
  };

  App.renderStudio = async function (section) {
    const valid = ['overview', 'paintings', 'orders', 'bookings', 'pottery'];
    const selected = valid.includes(section) ? section : 'overview';
    setLoading('Loading studio records…');
    try {
      const [paintings, orders, bookings, pottery] = await Promise.all([
        PaintingsApi.listPaintings(), OrdersApi.listOrders(), BookingsApi.listBookings(), PotteryApi.listPotteryRequests()
      ]);
      const tabs = `<nav class="studio-tabs" aria-label="Studio management">${valid.map(tab => `<a data-route class="${selected === tab ? 'active' : ''}" href="/studio${tab === 'overview' ? '' : `/${tab}`}">${tab[0].toUpperCase()}${tab.slice(1)}</a>`).join('')}</nav>`;
      const metrics = `<div class="stats-grid">
        <div class="stat-card"><div class="stat-label">Available paintings</div><div class="stat-value">${paintings.filter(item => item.available).length}</div></div>
        <div class="stat-card"><div class="stat-label">Placed orders</div><div class="stat-value">${orders.filter(item => item.status === 'placed').length}</div><div class="form-hint">${money(orders.filter(item => item.status === 'placed').reduce((sum, item) => sum + item.price, 0))} active order value</div></div>
        <div class="stat-card"><div class="stat-label">Pending bookings</div><div class="stat-value">${bookings.filter(item => item.status === 'requested').length}</div></div>
        <div class="stat-card"><div class="stat-label">Pending pottery</div><div class="stat-value">${pottery.filter(item => item.status === 'requested').length}</div></div></div>`;
      let content = '';
      if (selected === 'overview') content = `<p class="form-hint">Metrics above reflect current server records.</p>`;
      if (selected === 'paintings') content = `<div class="section-header-editorial"><h2>Paintings</h2><button class="btn btn-primary btn-sm" data-action="new-painting">Add painting</button></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Painting</th><th>Artist</th><th>Price</th><th>Availability</th><th></th></tr></thead><tbody>${paintings.map(item => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.artist)}</td><td>${money(item.price)}</td><td>${statusBadge(item.available ? 'available' : 'sold')}</td><td>${item.available ? `<button class="btn btn-secondary btn-sm" data-action="edit-painting" data-id="${item.id}">Edit</button>` : 'Unavailable works cannot be edited'}</td></tr>`).join('')}</tbody></table></div>`;
      if (selected === 'orders') content = `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Customer</th><th>Painting</th><th>Price snapshot</th><th>Status</th><th>Created</th></tr></thead><tbody>${orders.map(item => `<tr><td>${escapeHtml(item.customer_name || item.customer_email || `Customer #${item.customer_id}`)}</td><td>${escapeHtml(item.painting ? item.painting.title : 'Archived painting')}</td><td>${money(item.price)}</td><td>${statusBadge(item.status)}</td><td>${dateLabel(item.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
      if (selected === 'bookings') content = `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Customer</th><th>Date</th><th>Area</th><th>Address</th><th>Price</th><th>Status / actions</th></tr></thead><tbody>${bookings.map(item => `<tr><td>${escapeHtml(item.customer_name || `Customer #${item.customer_id}`)}</td><td>${dateLabel(item.date)}</td><td>${item.wall_sqft} sq ft</td><td>${escapeHtml(item.address)}</td><td>${money(item.total_price)}</td><td>${statusBadge(item.status)} ${item.status === 'requested' ? `<button class="btn btn-secondary btn-sm" data-action="booking-confirm" data-id="${item.id}">Confirm</button><button class="btn btn-secondary btn-sm" data-action="booking-decline" data-id="${item.id}">Decline</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
      if (selected === 'pottery') content = `<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Customer</th><th>Item</th><th>Glaze</th><th>Qty</th><th>Needed by</th><th>Status / actions</th></tr></thead><tbody>${pottery.map(item => `<tr><td>${escapeHtml(item.customer_name || `Customer #${item.customer_id}`)}</td><td>${escapeHtml(item.item)}</td><td>${escapeHtml(item.glaze)}</td><td>${item.quantity}</td><td>${dateLabel(item.needed_by)}</td><td>${statusBadge(item.status)} ${item.status === 'requested' ? `<button class="btn btn-secondary btn-sm" data-action="pottery-accept" data-id="${item.id}">Accept</button><button class="btn btn-secondary btn-sm" data-action="pottery-decline" data-id="${item.id}">Decline</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
      main.innerHTML = shell('Studio management', 'Studio workspace', '', `${selected === 'overview' ? metrics : ''}${tabs}${content}`);
      App.studioData = { paintings, orders, bookings, pottery };
    } catch (error) { showPageError(error); }
  };

  function addCalendarDays(isoDate, count) {
    const date = new Date(`${isoDate}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + count);
    return date.toISOString().slice(0, 10);
  }

  function calendarDays(date, base) {
    const left = Date.parse(`${date}T00:00:00Z`);
    const right = Date.parse(`${base}T00:00:00Z`);
    return Math.round((left - right) / 86400000);
  }

  function formError(form, message) {
    const node = form.querySelector('[data-error]');
    if (node) node.textContent = message;
  }

  function setPending(form, pending) {
    form.querySelectorAll('button[type="submit"]').forEach(button => {
      button.disabled = pending;
      if (pending) button.dataset.originalText = button.textContent;
      button.textContent = pending ? 'Please wait…' : (button.dataset.originalText || button.textContent);
    });
  }

  function showPaintingEditor(painting = null) {
    const form = `<span class="editorial-kicker">${painting ? 'Edit painting' : 'New painting'}</span><h2>${painting ? escapeHtml(painting.title) : 'Add a painting'}</h2>
      <form data-form="painting" data-id="${painting ? painting.id : ''}">
      <div class="form-group"><label class="form-label" for="painting-title">Title</label><input class="form-control" id="painting-title" name="title" value="${escapeHtml(painting ? painting.title : '')}" required></div>
      <div class="form-group"><label class="form-label" for="painting-artist">Artist</label><input class="form-control" id="painting-artist" name="artist" value="${escapeHtml(painting ? painting.artist : '')}" required></div>
      <div class="form-group"><label class="form-label" for="painting-price">Price</label><input class="form-control" id="painting-price" name="price" type="number" min="1" step="1" value="${escapeHtml(painting ? painting.price : '')}" required></div>
      <div class="form-group"><label class="form-label" for="painting-image">Image URL</label><input class="form-control" id="painting-image" name="image_url" value="${escapeHtml(painting ? painting.image_url : '')}"></div>
      <div class="form-group"><label class="form-label" for="painting-description">Description</label><textarea class="form-control" id="painting-description" name="description" required>${escapeHtml(painting ? painting.description : '')}</textarea></div>
      <p class="form-error" data-error aria-live="polite"></p><div class="modal-actions"><button class="btn btn-primary" type="submit">Save painting</button></div></form>`;
    UI.openModal(form);
  }

  async function submitForm(form) {
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form).entries());
    formError(form, '');
    setPending(form, true);
    try {
      if (form.dataset.form === 'login' || form.dataset.form === 'register') {
        if (form.dataset.form === 'register' && values.password !== values.confirm) {
          throw new Error('Passwords do not match.');
        }
        const user = form.dataset.form === 'login'
          ? await AuthApi.login(values.email, values.password)
          : await AuthApi.signup(values.name, values.email, values.password);
        App.user = user;
        App.authReady = true;
        App.sessionError = null;
        const desired = new URLSearchParams(window.location.search).get('next');
        const next = desired && desired.startsWith('/') && !desired.startsWith('//')
          ? desired
          : user.role === 'admin' ? '/studio' : '/gallery';
        navigate(next, true);
        return;
      }
      if (form.dataset.form === 'booking') {
        if (!values.date) throw new Error('Select an available booking date.');
        const booking = await BookingsApi.createBooking(values.date, Number(values.wall_sqft), values.address);
        UI.closeModal();
        UI.toast(`Booking request received for ${dateLabel(booking.date)}.`, 'success');
        navigate('/account/bookings');
        return;
      }
      if (form.dataset.form === 'pottery') {
        await PotteryApi.createPotteryRequest(values.item, values.glaze, Number(values.quantity), values.needed_by);
        UI.closeModal();
        UI.toast('Your pottery request was received by the studio.', 'success');
        navigate('/account/pottery');
        return;
      }
      if (form.dataset.form === 'painting') {
        const painting = {
          title: values.title.trim(), artist: values.artist.trim(), description: values.description.trim(),
          image_url: values.image_url.trim(), price: Number(values.price)
        };
        if (form.dataset.id) await PaintingsApi.updatePainting(form.dataset.id, painting);
        else await PaintingsApi.createPainting(painting.title, painting.artist, painting.description, painting.price, painting.image_url);
        UI.closeModal();
        UI.toast('Painting saved by the studio.', 'success');
        await App.renderStudio('paintings');
        return;
      }
      if (form.dataset.form === 'edit-pottery') {
        await PotteryApi.updatePotteryRequest(form.dataset.id, {
          item: values.item, glaze: values.glaze, quantity: Number(values.quantity), needed_by: values.needed_by
        });
        UI.closeModal();
        UI.toast('Pottery request updated.', 'success');
        navigate('/account/pottery');
      }
    } catch (error) {
      if (error.status === 409 && form.dataset.form === 'booking') {
        UI.toast(escapeHtml(error.message), 'error');
        await App.renderBookingForm();
        return;
      }
      formError(form, error.message);
    } finally {
      if (form.isConnected) setPending(form, false);
    }
  }

  async function actionClick(action, id) {
    try {
      if (action === 'logout') {
        await AuthApi.logout();
        App.user = null;
        App.authReady = true;
        App.sessionError = null;
        navigate('/', true);
        return;
      }
      if (action === 'cancel-order') {
        UI.confirm({ title: 'Cancel this order?', message: 'The server will update the order and release the painting if cancellation is accepted.', confirmText: 'Cancel order', onConfirm: async () => {
          try { const result = await OrdersApi.cancelOrder(id); UI.toast(`Order #${result.id} was ${result.status}.`, 'success'); await App.renderOrders(); }
          catch (error) { UI.toast(error.message, 'error'); await App.renderOrders(); }
        } });
      }
      if (action === 'cancel-booking') {
        UI.confirm({ title: 'Cancel this booking?', message: 'The studio will confirm whether this booking is still eligible for cancellation.', confirmText: 'Cancel booking', onConfirm: async () => {
          try { await BookingsApi.cancelBooking(id); UI.toast('Booking cancelled by the studio.', 'success'); await App.renderBookings(); }
          catch (error) { UI.toast(error.message, 'error'); await App.renderBookings(); }
        } });
      }
      if (action === 'cancel-pottery') {
        UI.confirm({ title: 'Cancel this pottery request?', message: 'Only requests that are still requested can be cancelled.', confirmText: 'Cancel request', onConfirm: async () => {
          try { await PotteryApi.cancelPotteryRequest(id); UI.toast('Pottery request cancelled.', 'success'); await App.renderPotteryRequests(); }
          catch (error) { UI.toast(error.message, 'error'); await App.renderPotteryRequests(); }
        } });
      }
      if (action === 'edit-pottery') {
        const item = App.potteryCache.find(request => String(request.id) === String(id));
        if (!item) return;
        const meta = await MetaApi.getMeta();
        UI.openModal(`<h2>Edit pottery request</h2><form data-form="edit-pottery" data-id="${item.id}">
          <div class="form-group"><label class="form-label">Item</label><select class="form-control" name="item">${meta.pottery.items.map(option => `<option ${option === item.item ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Glaze</label><select class="form-control" name="glaze">${meta.pottery.glazes.map(option => `<option ${option.name === item.glaze ? 'selected' : ''}>${escapeHtml(option.name)}</option>`).join('')}</select></div>
          <div class="form-group"><label class="form-label">Quantity</label><input class="form-control" type="number" name="quantity" min="1" max="${meta.pottery.maxQuantity}" value="${item.quantity}" required></div>
          <div class="form-group"><label class="form-label">Needed by</label><input class="form-control" type="date" name="needed_by" min="${addCalendarDays(meta.pottery.today, meta.pottery.minDaysAhead)}" value="${item.needed_by}" required></div>
          <p class="form-error" data-error aria-live="polite"></p><button class="btn btn-primary" type="submit">Save request</button></form>`);
      }
      if (action === 'new-painting') showPaintingEditor();
      if (action === 'edit-painting') {
        const painting = App.studioData.paintings.find(item => String(item.id) === String(id));
        if (painting && painting.available) showPaintingEditor(painting);
      }
      if (action === 'booking-confirm' || action === 'booking-decline') {
        if (action === 'booking-confirm') await BookingsApi.confirmBooking(id);
        else await BookingsApi.declineBooking(id);
        UI.toast('Booking status updated.', 'success');
        await App.renderStudio('bookings');
      }
      if (action === 'pottery-accept' || action === 'pottery-decline') {
        if (action === 'pottery-accept') await PotteryApi.acceptPotteryRequest(id);
        else await PotteryApi.declinePotteryRequest(id);
        UI.toast('Pottery request status updated.', 'success');
        await App.renderStudio('pottery');
      }
    } catch (error) {
      UI.toast(error.message, 'error');
    }
  }

  document.addEventListener('click', event => {
    const menu = event.target.closest('#mobile-menu-btn');
    if (menu) {
      const links = document.getElementById('nav-links');
      const expanded = links.classList.toggle('is-open');
      menu.setAttribute('aria-expanded', String(expanded));
      return;
    }
    const link = event.target.closest('a[data-route], a[href^="#"]');
    if (link) {
      if (link.getAttribute('href').startsWith('#')) {
        const hash = link.getAttribute('href').slice(1);
        const map = { home: '/', gallery: '/gallery', 'wall-painting': '/book-wall', pottery: '/request-pottery', account: '/account/orders', dashboard: '/studio' };
        const destination = hash.startsWith('account/')
          ? `/account/${hash.split('/')[1] === 'wall' ? 'bookings' : hash.split('/')[1]}`
          : hash.startsWith('artwork/')
            ? `/gallery/${hash.split('/')[1]}`
            : map[hash] || '/';
        event.preventDefault();
        navigate(destination);
        return;
      }
      event.preventDefault();
      navigate(link.getAttribute('href'));
      document.getElementById('nav-links').classList.remove('is-open');
      document.getElementById('mobile-menu-btn').setAttribute('aria-expanded', 'false');
      return;
    }
    const action = event.target.closest('[data-action]');
    if (action) {
      event.preventDefault();
      if (action.dataset.action === 'retry') {
        App.sessionError = null;
        App.authReady = false;
        App.sessionTask = null;
        App.handleRoute();
      } else {
        actionClick(action.dataset.action, action.dataset.id);
      }
    }
  });

  document.addEventListener('submit', event => {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    submitForm(form);
  });

  window.addEventListener('popstate', () => App.handleRoute());
  window.addEventListener('keydown', event => {
    const backdrop = document.getElementById('global-modal-backdrop');
    if (event.key === 'Escape') UI.closeModal();
    else if (event.key === 'Tab' && backdrop && backdrop.classList.contains('open')) UI.trapFocus(event);
  });
})();
