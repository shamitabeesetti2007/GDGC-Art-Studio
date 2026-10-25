/* ==========================================================================
   APP ROUTER & VIEW RENDERERS — CONTEMPORARY ART EDITORIAL
   Backend-integrated SPA with authentication, API calls, and role-based routing.
   ========================================================================== */

const App = {
  currentRoute: 'home',
  routeParam: null,
  user: null,            // Current authenticated user (null if logged out)
  meta: null,            // Cached metadata from /api/meta
  paintings: [],         // Cached paintings list
  takenDates: [],        // Cached taken booking dates

  // ---- Initialization ----
  async init() {
    this.bindEvents();
    await this.restoreSession();
    this.updateNavigation();
    this.handleRoute();
  },

  async restoreSession() {
    try {
      this.user = await AuthApi.getCurrentUser();
    } catch (err) {
      this.user = null;
    }
    // Preload metadata
    try {
      this.meta = await MetaApi.getMeta();
    } catch (err) {
      // Meta not available yet
    }
  },

  bindEvents() {
    window.addEventListener('hashchange', () => this.handleRoute());

    // Mobile nav toggle
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    if (mobileBtn && navLinks) {
      mobileBtn.addEventListener('click', () => {
        const isVisible = window.getComputedStyle(navLinks).display !== 'none';
        navLinks.style.display = isVisible ? 'none' : 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = 'var(--header-height)';
        navLinks.style.left = '0';
        navLinks.style.right = '0';
        navLinks.style.backgroundColor = 'var(--color-gallery-ivory)';
        navLinks.style.padding = '20px 24px';
        navLinks.style.borderBottom = '1px solid var(--color-fine-border)';
      });
    }

    // Close modal on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') UI.closeModal();
    });
  },

  // ---- Navigation update based on auth state ----
  updateNavigation() {
    const navLinks = document.getElementById('nav-links');
    const navActions = document.querySelector('.nav-actions');
    if (!navLinks || !navActions) return;

    if (!this.user) {
      // Logged out
      navLinks.innerHTML = `
        <li><a href="#home" class="nav-link">Home</a></li>
        <li><a href="#login" class="nav-link">Login</a></li>
        <li><a href="#register" class="nav-link">Register</a></li>
      `;
      navActions.innerHTML = `
        <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle navigation menu">
          <span></span><span></span><span></span>
        </button>
      `;
      this.bindMobileMenu();
    } else if (this.user.role === 'admin') {
      // Admin
      navLinks.innerHTML = `
        <li><a href="#studio" class="nav-link">Dashboard</a></li>
        <li><a href="#studio/paintings" class="nav-link">Paintings</a></li>
        <li><a href="#studio/orders" class="nav-link">Orders</a></li>
        <li><a href="#studio/bookings" class="nav-link">Bookings</a></li>
        <li><a href="#studio/pottery" class="nav-link">Pottery</a></li>
      `;
      navActions.innerHTML = `
        <span style="font-size:0.8rem;color:var(--color-warm-taupe);">Admin</span>
        <button class="btn btn-secondary btn-sm" onclick="App.handleLogout()">Logout</button>
        <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle navigation menu">
          <span></span><span></span><span></span>
        </button>
      `;
      this.bindMobileMenu();
    } else {
      // Customer
      navLinks.innerHTML = `
        <li><a href="#home" class="nav-link">Home</a></li>
        <li><a href="#gallery" class="nav-link">Gallery</a></li>
        <li><a href="#book-wall" class="nav-link">Wall Painting</a></li>
        <li><a href="#request-pottery" class="nav-link">Pottery</a></li>
        <li><a href="#account/orders" class="nav-link">My Account</a></li>
      `;
      navActions.innerHTML = `
        <span style="font-size:0.8rem;color:var(--color-warm-taupe);">${this.user.name}</span>
        <button class="btn btn-secondary btn-sm" onclick="App.handleLogout()">Logout</button>
        <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Toggle navigation menu">
          <span></span><span></span><span></span>
        </button>
      `;
      this.bindMobileMenu();
    }
  },

  bindMobileMenu() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    if (mobileBtn && navLinks) {
      mobileBtn.addEventListener('click', () => {
        const isVisible = window.getComputedStyle(navLinks).display !== 'none';
        navLinks.style.display = isVisible ? 'none' : 'flex';
        navLinks.style.flexDirection = 'column';
        navLinks.style.position = 'absolute';
        navLinks.style.top = 'var(--header-height)';
        navLinks.style.left = '0';
        navLinks.style.right = '0';
        navLinks.style.backgroundColor = 'var(--color-gallery-ivory)';
        navLinks.style.padding = '20px 24px';
        navLinks.style.borderBottom = '1px solid var(--color-fine-border)';
      });
    }
  },

  // ---- Route guard ----
  requireAuth() {
    if (!this.user) {
      window.location.hash = '#login';
      return false;
    }
    return true;
  },

  requireCustomer() {
    if (!this.user || this.user.role !== 'customer') {
      if (!this.user) {
        window.location.hash = '#login';
      } else {
        window.location.hash = '#studio';
      }
      return false;
    }
    return true;
  },

  requireAdmin() {
    if (!this.user || this.user.role !== 'admin') {
      if (!this.user) {
        window.location.hash = '#login';
      } else {
        window.location.hash = '#home';
      }
      return false;
    }
    return true;
  },

  handleRoute() {
    const hash = window.location.hash.slice(1) || 'home';
    const parts = hash.split('/');
    this.currentRoute = parts[0] || 'home';
    this.routeParam = parts[1] || null;

    // Update active nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href') || '';
      if (href === `#${this.currentRoute}` || href === `#${hash}`) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Route table
    switch (this.currentRoute) {
      case 'home':
        this.renderHome();
        break;
      case 'login':
        this.renderLogin();
        break;
      case 'register':
        this.renderRegister();
        break;
      case 'gallery':
        if (this.requireCustomer()) this.renderGallery();
        break;
      case 'artwork':
        if (this.requireCustomer()) this.renderArtworkDetail(this.routeParam);
        break;
      case 'book-wall':
        if (this.requireCustomer()) this.renderWallPainting();
        break;
      case 'request-pottery':
        if (this.requireCustomer()) this.renderPottery();
        break;
      case 'account':
        if (this.requireCustomer()) this.renderAccount(this.routeParam || 'orders');
        break;
      case 'studio':
        if (this.requireAdmin()) this.renderStudio(this.routeParam || 'dashboard');
        break;
      default:
        if (this.user) this.renderHome();
        else window.location.hash = '#home';
    }
  },

  // ---- Logout ----
  async handleLogout() {
    try {
      await AuthApi.logout();
    } catch (err) { /* ignore */ }
    this.user = null;
    this.updateNavigation();
    window.location.hash = '#home';
    UI.toast('Logged out successfully.');
  },

  // -------------------------------------------------------
  // 1. LANDING PAGE
  // -------------------------------------------------------
  async renderHome() {
    const main = document.getElementById('app-main');
    main.innerHTML = this.renderLoadingHtml();

    try {
      let paintings = [];
      if (this.user) {
        paintings = await PaintingsApi.listPaintings();
      }
      const featured = paintings.slice(0, 4);

      const ctaLogin = !this.user
        ? `<a href="#login" class="btn btn-primary">Sign In to Browse</a>`
        : `<a href="#gallery" class="btn btn-primary">Explore the Gallery</a>`;

      const ctaService = !this.user
        ? `<a href="#login" class="btn btn-secondary">Sign In to Book</a>`
        : `<a href="#book-wall" class="btn btn-secondary">Discover Studio Services</a>`;

      const potteryCta = !this.user
        ? `<a href="#login" class="btn btn-primary">Sign In to Request</a>`
        : `<a href="#request-pottery" class="btn btn-primary">Request Commissioned Pottery</a>`;

      const galleryLink = !this.user ? `href="#login"` : `href="#gallery"`;

      main.innerHTML = `
        <section class="hero-section">
          <div class="container">
            <div class="hero-grid">
              <div class="hero-content">
                <span class="editorial-kicker">Studio & Gallery Collection · Autumn 2026</span>
                <h1 class="hero-title">Art that makes a space your own.</h1>
                <p class="hero-lead">
                  Original paintings, considered spaces, and handmade pottery — created to bring character into everyday life.
                </p>
                <div class="hero-ctas">
                  ${ctaLogin}
                  ${ctaService}
                </div>
                <div class="hero-editorial-note">
                  <span class="hero-editorial-line"></span>
                  <span class="editorial-caption">A collection of original works and objects.</span>
                </div>
              </div>
              <div class="hero-art-composition">
                <div class="art-frame-primary">
                  <img src="assets/images/painting_hero.jpg" alt="Earth & Cadmium No. 4" />
                </div>
                <div class="art-frame-secondary">
                  <img src="assets/images/painting_01.jpg" alt="Concentric Solitude" />
                </div>
                <span class="art-frame-caption">Works by Helena Vance & Julian Ortiz (Studio London)</span>
              </div>
            </div>
          </div>
        </section>

        <hr class="section-divider" />

        <section class="section-editorial">
          <div class="container">
            <div class="section-header-editorial">
              <div>
                <span class="editorial-kicker">Selected Works</span>
                <h2>Original Studio Paintings</h2>
              </div>
              <a ${galleryLink} class="btn-text">View Full Inventory &rarr;</a>
            </div>
            <div class="gallery-grid">
              ${featured.length ? featured.map(p => this.renderArtworkCardHtml(p)).join('') : '<p>No paintings available yet.</p>'}
            </div>
          </div>
        </section>

        <section class="section-editorial wall-painting-feature">
          <div class="container">
            <div class="wall-painting-grid">
              <div class="wall-visual-frame">
                <img src="assets/images/painting_03.jpg" alt="Architectural Wall Painting" />
              </div>
              <div>
                <span class="editorial-kicker">Architectural Commission</span>
                <h2>Custom Wall Painting Services</h2>
                <p style="margin-top: 14px;">
                  We collaborate with architects, interior designers, and private collectors to develop site-specific wall murals.
                </p>
                <ul class="wall-spec-list">
                  <li class="wall-spec-item"><span class="wall-spec-dot"></span><span>Direct site visits & hand-mixed mineral wash pigment</span></li>
                  <li class="wall-spec-item"><span class="wall-spec-dot"></span><span>Transparent pricing per square foot</span></li>
                  <li class="wall-spec-item"><span class="wall-spec-dot"></span><span>Compatibility with lime plaster, linen, and raw timber</span></li>
                </ul>
                ${!this.user ? `<a href="#login" class="btn btn-terracotta">Sign In to Book</a>` : `<a href="#book-wall" class="btn btn-terracotta">Book Wall Consultation</a>`}
              </div>
            </div>
          </div>
        </section>

        <section class="section-editorial">
          <div class="container">
            <div class="pottery-feature-grid">
              <div>
                <span class="editorial-kicker">Studio Ceramics</span>
                <h2>Handmade Pottery & Vessels</h2>
                <p style="margin-top: 14px;">
                  Thrown in small batches from high-fire stoneware and local coarse clays.
                </p>
                <div class="pottery-pill-tags">
                  <span class="pottery-pill">Wood Ash Glaze</span>
                  <span class="pottery-pill">Matte Terracotta</span>
                  <span class="pottery-pill">Speckled Chalk</span>
                </div>
                ${potteryCta}
              </div>
              <div class="pottery-visual-frame">
                <img src="assets/images/pottery_hero.jpg" alt="Artisan ceramic vessels" />
              </div>
            </div>
          </div>
        </section>

        <section class="philosophy-section">
          <div class="container-editorial">
            <span class="editorial-kicker">Studio Philosophy</span>
            <blockquote class="philosophy-quote">
              "Art is not merely placed within an interior; it engages in continuous dialogue with light, silence, and the rhythms of everyday shelter."
            </blockquote>
            <cite class="philosophy-attribution">— The Editorial Studio Journal</cite>
          </div>
        </section>
      `;
    } catch (err) {
      main.innerHTML = this.renderErrorHtml('Failed to load page.', err.message);
    }
  },

  // -------------------------------------------------------
  // LOGIN PAGE
  // -------------------------------------------------------
  renderLogin() {
    const main = document.getElementById('app-main');
    main.innerHTML = `
      <section class="section-editorial">
        <div class="container" style="max-width:480px;">
          <div style="text-align:center;margin-bottom:40px;">
            <span class="editorial-kicker">Client Portal</span>
            <h1>Welcome Back</h1>
            <p style="margin-top:8px;">Sign in to access your acquisitions and commissions.</p>
          </div>
          <form id="login-form" onsubmit="App.handleLoginSubmit(event)" class="booking-calculator-card">
            <div id="login-error" class="form-error" style="display:none;"></div>
            <div class="form-group">
              <label class="form-label" for="login-email">Email Address</label>
              <input type="email" id="login-email" class="form-control" required placeholder="you@example.com" autocomplete="email" />
            </div>
            <div class="form-group">
              <label class="form-label" for="login-password">Password</label>
              <input type="password" id="login-password" class="form-control" required placeholder="••••••••" autocomplete="current-password" />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;" id="login-submit-btn">Sign In</button>
          </form>
          <p style="text-align:center;margin-top:24px;font-size:0.875rem;">
            Don't have an account? <a href="#register" class="btn-text">Create one</a>
          </p>
        </div>
      </section>
    `;
  },

  async handleLoginSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('login-submit-btn');
    const errEl = document.getElementById('login-error');
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    btn.disabled = true;
    btn.textContent = 'Signing in…';
    if (errEl) errEl.style.display = 'none';

    try {
      const user = await AuthApi.login(email, password);
      this.user = user;
      this.updateNavigation();
      UI.toast(`Welcome back, ${user.name}.`);
      window.location.hash = '#home';
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  },

  // -------------------------------------------------------
  // REGISTER PAGE
  // -------------------------------------------------------
  renderRegister() {
    const main = document.getElementById('app-main');
    main.innerHTML = `
      <section class="section-editorial">
        <div class="container" style="max-width:480px;">
          <div style="text-align:center;margin-bottom:40px;">
            <span class="editorial-kicker">Create Account</span>
            <h1>Join the Studio</h1>
            <p style="margin-top:8px;">Register to acquire paintings and commission services.</p>
          </div>
          <form id="register-form" onsubmit="App.handleRegisterSubmit(event)" class="booking-calculator-card">
            <div id="register-error" class="form-error" style="display:none;"></div>
            <div class="form-group">
              <label class="form-label" for="reg-name">Full Name</label>
              <input type="text" id="reg-name" class="form-control" required placeholder="Eleanor Vance" autocomplete="name" />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-email">Email Address</label>
              <input type="email" id="reg-email" class="form-control" required placeholder="you@example.com" autocomplete="email" />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-password">Password</label>
              <input type="password" id="reg-password" class="form-control" required placeholder="At least 6 characters" autocomplete="new-password" minlength="6" />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-password-confirm">Confirm Password</label>
              <input type="password" id="reg-password-confirm" class="form-control" required placeholder="Repeat password" autocomplete="new-password" />
            </div>
            <button type="submit" class="btn btn-primary" style="width:100%;" id="reg-submit-btn">Create Account</button>
          </form>
          <p style="text-align:center;margin-top:24px;font-size:0.875rem;">
            Already have an account? <a href="#login" class="btn-text">Sign in</a>
          </p>
        </div>
      </section>
    `;
  },

  async handleRegisterSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('reg-submit-btn');
    const errEl = document.getElementById('register-error');
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-password-confirm').value;

    if (password !== confirm) {
      if (errEl) { errEl.textContent = 'Passwords do not match.'; errEl.style.display = 'block'; }
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Creating account…';
    if (errEl) errEl.style.display = 'none';

    try {
      const user = await AuthApi.signup(name, email, password);
      this.user = user;
      this.updateNavigation();
      UI.toast(`Welcome, ${user.name}. Your account is ready.`);
      window.location.hash = '#home';
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.style.display = 'block';
      }
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  },

  // -------------------------------------------------------
  // 2. GALLERY PAGE
  // -------------------------------------------------------
  async renderGallery(filter = 'all') {
    const main = document.getElementById('app-main');
    main.innerHTML = this.renderLoadingHtml();

    try {
      const all = await PaintingsApi.listPaintings();
      this.paintings = all;

      let filtered = all;
      if (filter === 'available') filtered = all.filter(p => p.available);
      else if (filter === 'sold') filtered = all.filter(p => !p.available);

      const total = all.length;
      const avail = all.filter(p => p.available).length;
      const sold = total - avail;

      main.innerHTML = `
        <section class="section-editorial">
          <div class="container">
            <div class="section-header-editorial">
              <div>
                <span class="editorial-kicker">Gallery Collection</span>
                <h1>Paintings & Works on Linen</h1>
                <p style="margin-top: 8px; max-width: 580px;">
                  Each work is an original, single-edition piece. Available works ship museum-crated worldwide.
                </p>
              </div>
            </div>
            <div class="gallery-filter-bar">
              <div class="filter-pills">
                <button class="filter-btn ${filter === 'all' ? 'active' : ''}" onclick="App.renderGallery('all')">All Works (${total})</button>
                <button class="filter-btn ${filter === 'available' ? 'active' : ''}" onclick="App.renderGallery('available')">Available Now (${avail})</button>
                <button class="filter-btn ${filter === 'sold' ? 'active' : ''}" onclick="App.renderGallery('sold')">Archive / Sold (${sold})</button>
              </div>
              <div style="font-size: 0.8125rem; color: var(--color-warm-taupe);">
                Displaying ${filtered.length} pieces
              </div>
            </div>
            <div class="gallery-grid">
              ${filtered.length
                ? filtered.map(p => this.renderArtworkCardHtml(p)).join('')
                : '<div class="empty-state"><h3>No paintings found</h3><p>Try a different filter or check back later.</p></div>'}
            </div>
          </div>
        </section>
      `;
    } catch (err) {
      main.innerHTML = this.renderErrorHtml('Failed to load gallery.', err.message);
    }
  },

  renderArtworkCardHtml(p) {
    const statusBadge = p.available
      ? `<span class="badge badge-available">Available</span>`
      : `<span class="badge badge-sold">Sold</span>`;

    // Map backend fields to the visual format
    const visual = {
      id: p.id,
      title: p.title,
      artist: p.artist,
      image: p.image_url || '',
      price: p.price,
      aspect: 'landscape'
    };

    return `
      <article class="artwork-card" onclick="window.location.hash='#artwork/${p.id}'" role="button" tabindex="0" aria-label="${p.title} by ${p.artist}">
        ${UI.renderArtworkVisual(visual)}
        <div class="artwork-info">
          <div class="artwork-header-row">
            <h3 class="artwork-title">${p.title}</h3>
            <span class="artwork-price">${UI.formatCurrency(p.price)}</span>
          </div>
          <div class="artwork-artist">${p.artist}</div>
          <div class="artwork-meta-row">
            <span class="artwork-medium">Original</span>
            ${statusBadge}
          </div>
        </div>
      </article>
    `;
  },

  // -------------------------------------------------------
  // 3. ARTWORK DETAIL VIEW
  // -------------------------------------------------------
  async renderArtworkDetail(id) {
    const main = document.getElementById('app-main');
    main.innerHTML = this.renderLoadingHtml();

    try {
      const painting = await PaintingsApi.getPainting(id);

      const visual = {
        id: painting.id,
        title: painting.title,
        artist: painting.artist,
        image: painting.image_url || '',
        price: painting.price,
        aspect: 'landscape'
      };

      const isAvailable = painting.available;

      main.innerHTML = `
        <section class="section-editorial">
          <div class="container">
            <div style="margin-bottom: 24px;">
              <a href="#gallery" class="btn-text">&larr; Return to Collection</a>
            </div>
            <div class="artwork-detail-layout">
              <div class="artwork-detail-visual">
                <div class="detail-image-frame" id="detail-frame">
                  ${UI.renderArtworkVisual(visual)}
                </div>
                <div class="wall-sim-view" id="wall-sim-view">
                  <div class="wall-sim-inner">
                    ${painting.image_url
                      ? `<img src="${painting.image_url}" alt="${painting.title}" />`
                      : window.generateDeterministicSvg(painting.id, painting.title, 400, 300)}
                  </div>
                  <div class="wall-sim-bench"></div>
                </div>
                <div style="display: flex; justify-content: flex-end;">
                  <button class="btn btn-secondary btn-sm" onclick="App.toggleWallSimulator()">
                    View in Room
                  </button>
                </div>
              </div>
              <div class="artwork-detail-info">
                <div class="artwork-detail-header">
                  <span class="editorial-kicker">Original Work</span>
                  <h1 style="font-size: clamp(2rem, 3.8vw, 3rem); margin-bottom: 8px;">${painting.title}</h1>
                  <p style="font-size: 1.1rem; color: var(--color-charcoal-ink);">${painting.artist}</p>
                  <div class="detail-price-row">
                    <div class="detail-price-tag">${UI.formatCurrency(painting.price)}</div>
                    <div>
                      ${isAvailable
                        ? `<span class="badge badge-available" style="font-size: 0.85rem; padding: 6px 14px;">Available</span>`
                        : `<span class="badge badge-sold" style="font-size: 0.85rem; padding: 6px 14px;">Acquired</span>`}
                    </div>
                  </div>
                </div>
                <p style="line-height: 1.8; margin-bottom: 24px;">${painting.description}</p>
                <div style="margin-top: 16px;">
                  ${isAvailable
                    ? `<button class="btn btn-primary" style="width:100%;padding:16px;" onclick="App.promptPurchase('${painting.id}', '${painting.title}', ${painting.price})">
                        Acquire Original Work — ${UI.formatCurrency(painting.price)}
                      </button>
                      <p class="form-hint" style="text-align:center;margin-top:10px;">Includes insured delivery.</p>`
                    : `<button class="btn btn-secondary" style="width:100%;padding:16px;" disabled>
                        This piece has been acquired
                      </button>`}
                </div>
              </div>
            </div>
          </div>
        </section>
      `;
    } catch (err) {
      if (err.status === 404) {
        main.innerHTML = `
          <div class="container section-editorial">
            <div class="empty-state">
              <h3>Artwork Not Found</h3>
              <p>The requested artwork does not exist or has been archived.</p>
              <a href="#gallery" class="btn btn-primary">Return to Gallery</a>
            </div>
          </div>
        `;
      } else {
        main.innerHTML = this.renderErrorHtml('Failed to load artwork.', err.message);
      }
    }
  },

  toggleWallSimulator() {
    const wallSim = document.getElementById('wall-sim-view');
    const frame = document.getElementById('detail-frame');
    if (!wallSim || !frame) return;
    if (wallSim.classList.contains('active')) {
      wallSim.classList.remove('active');
      frame.style.display = 'block';
    } else {
      wallSim.classList.add('active');
      frame.style.display = 'none';
    }
  },

  promptPurchase(paintingId, title, price) {
    UI.confirm({
      title: `Acquire "${title}"`,
      message: `Total: ${UI.formatCurrency(price)}. This will place an order for this original work.`,
      confirmText: 'Confirm Purchase',
      cancelText: 'Cancel',
      onConfirm: () => App.handlePurchase(paintingId)
    });
  },

  async handlePurchase(paintingId) {
    try {
      const order = await OrdersApi.createOrder(paintingId);
      UI.toast(`Order placed! Reference: ${order.id}`);
      window.location.hash = '#account/orders';
    } catch (err) {
      if (err.code === 'DOUBLE_SELL') {
        UI.toast(err.message, 'error');
        this.renderArtworkDetail(paintingId);
      } else {
        UI.toast(err.message || 'Purchase failed.', 'error');
      }
    }
  },

  // -------------------------------------------------------
  // 4. WALL PAINTING COMMISSION PAGE & CALCULATOR
  // -------------------------------------------------------
  renderWallPainting() {
    const main = document.getElementById('app-main');

    main.innerHTML = `
      <section class="section-editorial">
        <div class="container">
          <div class="section-header-editorial">
            <div>
              <span class="editorial-kicker">Architectural Commission</span>
              <h1>Custom Wall Painting Services</h1>
              <p style="margin-top: 10px; max-width: 640px;">
                Our studio creates custom mural interventions and textural wash treatments directly on interior surfaces. Each project begins with a scale consultation and bespoke pigment test tiles.
              </p>
            </div>
          </div>

          <div class="wall-painting-grid">
            <!-- Left: Description and visual -->
            <div>
              <div class="wall-visual-frame" style="margin-bottom: 24px;">
                <img src="assets/images/painting_03.jpg" alt="Interior wall painting example" />
              </div>
              <h3 style="margin-bottom: 12px;">The Consultation Process</h3>
              <p style="margin-bottom: 16px;">
                1. <strong>Spatial Assessment</strong> — We analyze daylight angles, ambient humidity, and surface substrate characteristics.
              </p>
              <p style="margin-bottom: 16px;">
                2. <strong>Material Palette</strong> — Mineral pigments, slaked lime wash, and natural binders selected to age naturally with your architecture.
              </p>
              <p>
                3. <strong>Execution</strong> — Hand-applied over 2 to 5 studio working days with minimal disruption to the residence.
              </p>
            </div>

            <!-- Right: Interactive Booking & Live Price Preview -->
            <div class="booking-calculator-card">
              <span class="editorial-kicker">Interactive Estimate</span>
              <h3 style="margin-bottom: 20px;">Book a Wall Consultation</h3>

              <div class="calculator-price-preview">
                <div>
                  <span class="price-preview-label">Estimated Project Total</span>
                  <div class="form-hint">Includes design, consultation & materials</div>
                </div>
                <div class="price-preview-amount" id="wall-price-preview">£850</div>
              </div>

              <form id="wall-booking-form" onsubmit="App.handleWallBookingSubmit(event)">
                <div class="form-group">
                  <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <label class="form-label" for="wall-area-slider">Wall Area (Square Meters)</label>
                    <span id="wall-area-display" style="font-weight: 600; color: var(--color-burnt-terracotta);">8 m²</span>
                  </div>
                  <input type="range" id="wall-area-slider" class="range-slider" min="4" max="50" value="8" step="1" oninput="App.updateWallPrice()" />
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="wall-surface">Wall Surface</label>
                    <select id="wall-surface" class="form-control" onchange="App.updateWallPrice()">
                      <option value="Lime Plaster">Smooth Lime Plaster</option>
                      <option value="Raw Drywall">Prepped Drywall / Gesso</option>
                      <option value="Masonry">Textured Brick / Masonry (+£120)</option>
                      <option value="Wood Panel">Linen Stretched Panel (+£180)</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="wall-room">Room Type</label>
                    <select id="wall-room" class="form-control">
                      <option value="Living Room">Primary Living Room</option>
                      <option value="Dining Hall">Dining Room</option>
                      <option value="Foyer">Entry Foyer / Stairwell</option>
                      <option value="Bedroom">Private Bedroom</option>
                      <option value="Studio">Creative Studio / Office</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="wall-date">Preferred Consultation Date</label>
                  <input type="date" id="wall-date" class="form-control" required min="2026-10-26" />
                </div>

                <div class="form-group">
                  <label class="form-label" for="wall-client-name">Your Name</label>
                  <input type="text" id="wall-client-name" class="form-control" required placeholder="e.g. Julian Sterling" />
                </div>

                <div class="form-group">
                  <label class="form-label" for="wall-address">Site Location / Address</label>
                  <input type="text" id="wall-address" class="form-control" required placeholder="Street address, city & postcode" />
                </div>

                <div class="form-group">
                  <label class="form-label" for="wall-notes">Special Intentions or Architectural Notes (Optional)</label>
                  <textarea id="wall-notes" class="form-control" placeholder="Describe sunlight orientation, color preferences, or architect intentions..."></textarea>
                </div>

                <button type="submit" class="btn btn-terracotta" style="width: 100%;">
                  Submit Consultation Booking
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>
    `;

    this.updateWallPrice();
  },

  updateWallPrice() {
    const slider = document.getElementById('wall-area-slider');
    const areaDisplay = document.getElementById('wall-area-display');
    const surfaceSelect = document.getElementById('wall-surface');
    const preview = document.getElementById('wall-price-preview');

    if (!slider || !preview) return;

    const sqm = parseInt(slider.value, 10);
    if (areaDisplay) areaDisplay.textContent = `${sqm} m²`;

    let surfaceAdd = 0;
    if (surfaceSelect) {
      if (surfaceSelect.value === 'Masonry') surfaceAdd = 120;
      if (surfaceSelect.value === 'Wood Panel') surfaceAdd = 180;
    }

    // Formula: £250 base fee + £75 per sqm + surface premium
    const total = 250 + (sqm * 75) + surfaceAdd;
    preview.textContent = UI.formatCurrency(total);
  },

  handleWallBookingSubmit(e) {
    e.preventDefault();
    const sqm = parseInt(document.getElementById('wall-area-slider').value, 10);
    const surface = document.getElementById('wall-surface').value;
    const room = document.getElementById('wall-room').value;
    const date = document.getElementById('wall-date').value;
    const name = document.getElementById('wall-client-name').value;
    const address = document.getElementById('wall-address').value;
    const notes = document.getElementById('wall-notes').value;

    let surfaceAdd = surface === 'Masonry' ? 120 : (surface === 'Wood Panel' ? 180 : 0);
    const estimated = 250 + (sqm * 75) + surfaceAdd;

    const newBooking = window.ArtStore.createWallBooking({
      areaSqm: sqm,
      surface: surface,
      roomType: room,
      date: date,
      clientName: name,
      address: address,
      notes: notes,
      estimatedPrice: estimated
    });

    UI.toast(`Consultation requested! Ref: ${newBooking.id}`);
    window.location.hash = '#account/wall';
  },

  // -------------------------------------------------------
  // 5. POTTERY STUDIO PAGE & FORM
  // -------------------------------------------------------
  renderPottery() {
    const main = document.getElementById('app-main');
    const pottery = window.ArtStore.DEFAULT_POTTERY;

    main.innerHTML = `
      <section class="section-editorial">
        <div class="container">
          <div class="section-header-editorial">
            <div>
              <span class="editorial-kicker">Tactile Studio Works</span>
              <h1>Handmade Pottery & Ceramics</h1>
              <p style="margin-top: 10px; max-width: 600px;">
                Wheel-thrown and hand-pinched vessels created from stoneware clays and local ash formulations. Commission custom tableware or acquire singular sculptural objects.
              </p>
            </div>
          </div>

          <!-- Pottery Catalog Grid -->
          <div class="gallery-grid" style="margin-bottom: 60px;">
            ${pottery.map(item => `
              <div class="artwork-card">
                <div class="artwork-image-container">
                  <img src="${item.image}" alt="${item.title}" />
                </div>
                <div class="artwork-info">
                  <div class="artwork-header-row">
                    <h3 class="artwork-title">${item.title}</h3>
                    <span class="artwork-price">${UI.formatCurrency(item.price)}</span>
                  </div>
                  <div class="artwork-artist">${item.type} · ${item.glaze}</div>
                  <p style="font-size: 0.8125rem; margin-bottom: 12px;">${item.description}</p>
                  <div class="artwork-meta-row">
                    <span>${item.dimensions}</span>
                    <button class="btn btn-secondary btn-sm" onclick="App.selectPotteryForCommission('${item.title}', '${item.glaze}')">
                      Request Item
                    </button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Commission Request Form -->
          <div class="booking-calculator-card" id="pottery-request-section" style="max-width: 780px; margin: 0 auto;">
            <span class="editorial-kicker">Bespoke Wheel Throwing</span>
            <h3 style="margin-bottom: 14px;">Commission Studio Pottery</h3>
            <p style="margin-bottom: 24px; font-size: 0.9375rem;">
              Select an item category, specify your required glaze finish, and reserve your batch in the next kiln firing cycle.
            </p>

            <form id="pottery-form" onsubmit="App.handlePotterySubmit(event)">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="pot-item-type">Item Category</label>
                  <select id="pot-item-type" class="form-control" required>
                    <option value="Pouring Vessel">Pouring Vessel / Carafe</option>
                    <option value="Fluted Offering Bowl">Fluted Centerpiece Bowl</option>
                    <option value="Chiseled Column Vase">Chiseled Column Vase</option>
                    <option value="Complete Dinnerware Set (6 pieces)">Complete Dinnerware Set (6 pcs)</option>
                    <option value="Ikebana Planter">Ikebana Ceramic Planter</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="pot-quantity">Quantity</label>
                  <input type="number" id="pot-quantity" class="form-control" min="1" max="24" value="1" required />
                </div>
              </div>

              <!-- Glaze Selector Swatches -->
              <div class="form-group">
                <label class="form-label">Selected Glaze Finish</label>
                <input type="hidden" id="pot-glaze-input" value="Ash Glaze" />
                <div class="glaze-selector-grid">
                  <div class="glaze-card selected" onclick="App.selectGlaze(this, 'Ash Glaze')">
                    <div class="glaze-swatch swatch-ash"></div>
                    <div class="glaze-name">Wood Ash</div>
                  </div>
                  <div class="glaze-card" onclick="App.selectGlaze(this, 'Matte Terracotta')">
                    <div class="glaze-swatch swatch-terracotta"></div>
                    <div class="glaze-name">Terracotta Slip</div>
                  </div>
                  <div class="glaze-card" onclick="App.selectGlaze(this, 'Raw Sand')">
                    <div class="glaze-swatch swatch-sand"></div>
                    <div class="glaze-name">Raw Sand</div>
                  </div>
                  <div class="glaze-card" onclick="App.selectGlaze(this, 'Speckled Chalk')">
                    <div class="glaze-swatch swatch-speckled"></div>
                    <div class="glaze-name">Speckled Chalk</div>
                  </div>
                  <div class="glaze-card" onclick="App.selectGlaze(this, 'Smoked Charcoal')">
                    <div class="glaze-swatch swatch-charcoal"></div>
                    <div class="glaze-name">Smoked Black</div>
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="pot-date">Required Completion Date</label>
                  <input type="date" id="pot-date" class="form-control" required min="2026-11-15" />
                  <span class="form-hint">Allow minimum 3 weeks for throw, cure, and 2-stage firing.</span>
                </div>
                <div class="form-group">
                  <label class="form-label" for="pot-client">Your Name & Contact</label>
                  <input type="text" id="pot-client" class="form-control" required placeholder="Name, Email / Telephone" />
                </div>
              </div>

              <div class="form-group">
                <label class="form-label" for="pot-notes">Special Specifications or Dimensions</label>
                <textarea id="pot-notes" class="form-control" placeholder="e.g. Unglazed bottom foot, extra heavy stoneware weight..."></textarea>
              </div>

              <button type="submit" class="btn btn-primary" style="width: 100%;">
                Submit Commission Request
              </button>
            </form>
          </div>
        </div>
      </section>
    `;
  },

  selectGlaze(cardEl, glazeName) {
    document.querySelectorAll('.glaze-card').forEach(c => c.classList.remove('selected'));
    cardEl.classList.add('selected');
    document.getElementById('pot-glaze-input').value = glazeName;
  },

  selectPotteryForCommission(title, glaze) {
    const itemSelect = document.getElementById('pot-item-type');
    const formSection = document.getElementById('pottery-request-section');
    if (itemSelect) itemSelect.value = title;
    if (formSection) formSection.scrollIntoView({ behavior: 'smooth' });
    UI.toast(`Pre-filled commission form for ${title}`);
  },

  handlePotterySubmit(e) {
    e.preventDefault();
    const itemType = document.getElementById('pot-item-type').value;
    const quantity = parseInt(document.getElementById('pot-quantity').value, 10);
    const glaze = document.getElementById('pot-glaze-input').value;
    const date = document.getElementById('pot-date').value;
    const client = document.getElementById('pot-client').value;
    const notes = document.getElementById('pot-notes').value;

    const newReq = window.ArtStore.createPotteryRequest({
      itemType: itemType,
      quantity: quantity,
      glaze: glaze,
      requiredDate: date,
      clientName: client,
      notes: notes
    });

    UI.toast(`Pottery request received! Ref: ${newReq.id}`);
    window.location.hash = '#account/pottery';
  },

  // -------------------------------------------------------
  // 6. CUSTOMER ACCOUNT PAGES (ORDERS, WALL, POTTERY)
  // -------------------------------------------------------
  renderAccount(tab = 'orders') {
    const main = document.getElementById('app-main');
    const orders = window.ArtStore.getOrders();
    const bookings = window.ArtStore.getWallBookings();
    const pottery = window.ArtStore.getPotteryRequests();

    main.innerHTML = `
      <section class="section-editorial">
        <div class="container">
          <div class="section-header-editorial">
            <div>
              <span class="editorial-kicker">Client Portal</span>
              <h1>My Account & Acquisitions</h1>
              <p style="margin-top: 8px;">Review acquired paintings, track custom wall consultations, and manage pottery commissions.</p>
            </div>
          </div>

          <!-- Account Tabs -->
          <div class="tab-nav">
            <button class="tab-btn ${tab === 'orders' ? 'active' : ''}" onclick="App.renderAccount('orders')">
              Artwork Acquisitions (${orders.length})
            </button>
            <button class="tab-btn ${tab === 'wall' ? 'active' : ''}" onclick="App.renderAccount('wall')">
              Wall Painting Consultations (${bookings.length})
            </button>
            <button class="tab-btn ${tab === 'pottery' ? 'active' : ''}" onclick="App.renderAccount('pottery')">
              Pottery Commissions (${pottery.length})
            </button>
          </div>

          <div id="account-tab-content">
            ${tab === 'orders' ? this.renderOrdersTable(orders) : ''}
            ${tab === 'wall' ? this.renderWallBookingsTable(bookings) : ''}
            ${tab === 'pottery' ? this.renderPotteryRequestsTable(pottery) : ''}
          </div>
        </div>
      </section>
    `;
  },

  renderOrdersTable(orders) {
    if (!orders || orders.length === 0) {
      return `
        <div class="empty-state">
          <h3>No Artwork Acquisitions Yet</h3>
          <p>You have not acquired any original paintings. Explore our current exhibition catalog to find works for your space.</p>
          <a href="#gallery" class="btn btn-primary">Browse Available Artworks</a>
        </div>
      `;
    }

    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Date</th>
              <th>Artwork Title & Artist</th>
              <th>Amount</th>
              <th>Tracking Reference</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td style="font-family: monospace; font-weight: 500;">${o.id}</td>
                <td>${UI.formatDate(o.date)}</td>
                <td>
                  <strong>${o.itemTitle}</strong><br />
                  <span style="font-size: 0.8rem; color: var(--color-muted-text);">${o.artist || 'Studio Artist'}</span>
                </td>
                <td style="font-weight: 500;">${UI.formatCurrency(o.amount)}</td>
                <td style="font-size: 0.8125rem; color: var(--color-warm-taupe);">${o.tracking}</td>
                <td>
                  <span class="badge ${o.status === 'Delivered' ? 'badge-available' : 'badge-reserved'}">
                    ${o.status}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderWallBookingsTable(bookings) {
    if (!bookings || bookings.length === 0) {
      return `
        <div class="empty-state">
          <h3>No Wall Consultations Scheduled</h3>
          <p>Our studio crafts site-specific wall murals designed directly for your interior dimensions.</p>
          <a href="#wall-painting" class="btn btn-terracotta">Schedule a Wall Consultation</a>
        </div>
      `;
    }

    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ref ID</th>
              <th>Scheduled Date</th>
              <th>Room & Surface</th>
              <th>Dimensions</th>
              <th>Estimate</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td style="font-family: monospace; font-weight: 500;">${b.id}</td>
                <td>${UI.formatDate(b.date)}</td>
                <td>
                  <strong>${b.roomType}</strong><br />
                  <span style="font-size: 0.8rem; color: var(--color-muted-text);">${b.surface}</span>
                </td>
                <td>${b.areaSqm} m²</td>
                <td style="font-weight: 500;">${UI.formatCurrency(b.estimatedPrice)}</td>
                <td>
                  <span class="badge badge-reserved">${b.status}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderPotteryRequestsTable(requests) {
    if (!requests || requests.length === 0) {
      return `
        <div class="empty-state">
          <h3>No Pottery Commissions</h3>
          <p>Request bespoke dinnerware or ceramic vessels thrown with wood-ash glazes.</p>
          <a href="#pottery" class="btn btn-primary">Request Custom Pottery</a>
        </div>
      `;
    }

    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Item Type</th>
              <th>Glaze Finish</th>
              <th>Qty</th>
              <th>Required Date</th>
              <th>Studio Status</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(r => `
              <tr>
                <td style="font-family: monospace; font-weight: 500;">${r.id}</td>
                <td><strong>${r.itemType}</strong></td>
                <td>${r.glaze}</td>
                <td>${r.quantity}</td>
                <td>${UI.formatDate(r.requiredDate)}</td>
                <td>
                  <span class="badge badge-reserved">${r.status}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  // -------------------------------------------------------
  // 7. STUDIO DASHBOARD (ADMIN WORKSPACE)
  // -------------------------------------------------------
  renderDashboard(tab = 'artworks') {
    const main = document.getElementById('app-main');
    const stats = window.ArtStore.getDashboardStats();
    const paintings = window.ArtStore.getPaintings();
    const orders = window.ArtStore.getOrders();
    const bookings = window.ArtStore.getWallBookings();
    const pottery = window.ArtStore.getPotteryRequests();

    main.innerHTML = `
      <section class="section-editorial">
        <div class="container">
          <div class="section-header-editorial">
            <div>
              <span class="editorial-kicker">Studio Management</span>
              <h1>Editorial Studio Workspace</h1>
              <p style="margin-top: 8px;">Direct inventory controls, live commissions, and collector acquisition tracking.</p>
            </div>
            <div>
              <button class="btn btn-primary btn-sm" onclick="App.openAddPaintingModal()">+ Add New Artwork</button>
            </div>
          </div>

          <!-- Real KPI Stats Grid -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Artworks</div>
              <div class="stat-value">${stats.totalArtworks}</div>
              <div class="form-hint">${stats.availableArtworks} Available for Sale</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Acquired Revenue</div>
              <div class="stat-value" style="color: var(--color-burnt-terracotta);">${UI.formatCurrency(stats.totalRevenue)}</div>
              <div class="form-hint">${stats.totalOrders} Verified Collector Orders</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Active Wall Consults</div>
              <div class="stat-value">${stats.activeWallBookings}</div>
              <div class="form-hint">Architectural Inquiries</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Pottery Queue</div>
              <div class="stat-value">${stats.potteryInquiries}</div>
              <div class="form-hint">Kiln Commission Requests</div>
            </div>
          </div>

          <!-- Dashboard Tabs -->
          <div class="tab-nav">
            <button class="tab-btn ${tab === 'artworks' ? 'active' : ''}" onclick="App.renderDashboard('artworks')">
              Painting Inventory (${paintings.length})
            </button>
            <button class="tab-btn ${tab === 'orders' ? 'active' : ''}" onclick="App.renderDashboard('orders')">
              Collector Orders (${orders.length})
            </button>
            <button class="tab-btn ${tab === 'bookings' ? 'active' : ''}" onclick="App.renderDashboard('bookings')">
              Wall Bookings (${bookings.length})
            </button>
            <button class="tab-btn ${tab === 'pottery' ? 'active' : ''}" onclick="App.renderDashboard('pottery')">
              Pottery Queue (${pottery.length})
            </button>
          </div>

          <div id="dashboard-tab-content">
            ${tab === 'artworks' ? this.renderDashboardPaintingsTable(paintings) : ''}
            ${tab === 'orders' ? this.renderDashboardOrdersTable(orders) : ''}
            ${tab === 'bookings' ? this.renderDashboardBookingsTable(bookings) : ''}
            ${tab === 'pottery' ? this.renderDashboardPotteryTable(pottery) : ''}
          </div>
        </div>
      </section>
    `;
  },

  renderDashboardPaintingsTable(paintings) {
    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Artwork</th>
              <th>Artist</th>
              <th>Dimensions</th>
              <th>Price</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${paintings.map(p => `
              <tr>
                <td style="font-family: monospace;">${p.id}</td>
                <td>
                  <strong>${p.title}</strong><br />
                  <span style="font-size: 0.75rem; color: var(--color-muted-text);">${p.medium}</span>
                </td>
                <td>${p.artist} (${p.year})</td>
                <td>${p.dimensions}</td>
                <td style="font-weight: 500;">${UI.formatCurrency(p.price)}</td>
                <td>
                  <span class="badge ${p.status === 'available' ? 'badge-available' : (p.status === 'sold' ? 'badge-sold' : 'badge-reserved')}">
                    ${p.status}
                  </span>
                </td>
                <td>
                  <button class="btn btn-secondary btn-sm" onclick="App.togglePaintingStatus('${p.id}')">
                    ${p.status === 'available' ? 'Mark Sold' : 'Mark Available'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderDashboardOrdersTable(orders) {
    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Collector</th>
              <th>Artwork</th>
              <th>Amount</th>
              <th>Shipping Address</th>
              <th>Status Control</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td style="font-family: monospace;">${o.id}</td>
                <td>
                  <strong>${o.recipient}</strong><br />
                  <span style="font-size: 0.75rem; color: var(--color-muted-text);">${o.email || ''}</span>
                </td>
                <td>${o.itemTitle}</td>
                <td style="font-weight: 500;">${UI.formatCurrency(o.amount)}</td>
                <td style="font-size: 0.8125rem;">${o.address}</td>
                <td>
                  <select class="form-control" style="padding: 6px; font-size: 0.8rem;" onchange="App.handleOrderStatusChange('${o.id}', this.value)">
                    <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="Preparing for Dispatch" ${o.status === 'Preparing for Dispatch' ? 'selected' : ''}>Preparing Dispatch</option>
                    <option value="In Transit" ${o.status === 'In Transit' ? 'selected' : ''}>In Transit</option>
                    <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderDashboardBookingsTable(bookings) {
    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Booking ID</th>
              <th>Client</th>
              <th>Date</th>
              <th>Area / Room</th>
              <th>Estimate</th>
              <th>Status Update</th>
            </tr>
          </thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td style="font-family: monospace;">${b.id}</td>
                <td>
                  <strong>${b.clientName}</strong><br />
                  <span style="font-size: 0.75rem; color: var(--color-muted-text);">${b.address}</span>
                </td>
                <td>${b.date}</td>
                <td>${b.areaSqm} m² · ${b.roomType}</td>
                <td style="font-weight: 500;">${UI.formatCurrency(b.estimatedPrice)}</td>
                <td>
                  <select class="form-control" style="padding: 6px; font-size: 0.8rem;" onchange="App.handleBookingStatusChange('${b.id}', this.value)">
                    <option value="Consultation Booked" ${b.status === 'Consultation Booked' ? 'selected' : ''}>Consultation Booked</option>
                    <option value="Design Draft in Review" ${b.status === 'Design Draft in Review' ? 'selected' : ''}>Draft in Review</option>
                    <option value="Confirmed" ${b.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="Completed" ${b.status === 'Completed' ? 'selected' : ''}>Completed</option>
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  renderDashboardPotteryTable(requests) {
    return `
      <div class="data-table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Client</th>
              <th>Item / Glaze</th>
              <th>Qty</th>
              <th>Required</th>
              <th>Kiln Progress</th>
            </tr>
          </thead>
          <tbody>
            ${requests.map(r => `
              <tr>
                <td style="font-family: monospace;">${r.id}</td>
                <td><strong>${r.clientName}</strong></td>
                <td>${r.itemType} (${r.glaze})</td>
                <td>${r.quantity}</td>
                <td>${r.requiredDate}</td>
                <td>
                  <select class="form-control" style="padding: 6px; font-size: 0.8rem;" onchange="App.handlePotteryStatusChange('${r.id}', this.value)">
                    <option value="Drafting" ${r.status === 'Drafting' ? 'selected' : ''}>Drafting</option>
                    <option value="Wheel Throwing" ${r.status === 'Wheel Throwing' ? 'selected' : ''}>Wheel Throwing</option>
                    <option value="Bisque Firing" ${r.status === 'Bisque Firing' ? 'selected' : ''}>Bisque Firing</option>
                    <option value="Glaze Firing" ${r.status === 'Glaze Firing' ? 'selected' : ''}>Glaze Firing</option>
                    <option value="Ready" ${r.status === 'Ready' ? 'selected' : ''}>Ready for Collection</option>
                  </select>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  togglePaintingStatus(id) {
    const p = window.ArtStore.getPaintingById(id);
    if (!p) return;
    const newStatus = p.status === 'available' ? 'sold' : 'available';
    window.ArtStore.updatePainting(id, { status: newStatus });
    UI.toast(`Status updated: “${p.title}” is now ${newStatus}`);
    this.renderDashboard('artworks');
  },

  handleOrderStatusChange(orderId, status) {
    window.ArtStore.updateOrderStatus(orderId, status);
    UI.toast(`Order ${orderId} updated to ${status}`);
  },

  handleBookingStatusChange(bookingId, status) {
    window.ArtStore.updateBookingStatus(bookingId, status);
    UI.toast(`Booking ${bookingId} updated to ${status}`);
  },

  handlePotteryStatusChange(requestId, status) {
    window.ArtStore.updatePotteryStatus(requestId, status);
    UI.toast(`Pottery request ${requestId} updated to ${status}`);
  },

  openAddPaintingModal() {
    UI.openModal(`
      <span class="editorial-kicker">New Inventory</span>
      <h3 class="modal-title">Add Original Artwork</h3>
      <form id="add-painting-form" onsubmit="App.handleAddPaintingSubmit(event)">
        <div class="form-group">
          <label class="form-label" for="new-p-title">Artwork Title</label>
          <input type="text" id="new-p-title" class="form-control" required placeholder="e.g. Ochre Strata No. 7" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="new-p-artist">Artist</label>
            <input type="text" id="new-p-artist" class="form-control" required placeholder="Helena Vance" />
          </div>
          <div class="form-group">
            <label class="form-label" for="new-p-price">Price (£)</label>
            <input type="number" id="new-p-price" class="form-control" required min="100" placeholder="2800" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="new-p-dimensions">Dimensions</label>
            <input type="text" id="new-p-dimensions" class="form-control" required placeholder="120 × 90 cm" />
          </div>
          <div class="form-group">
            <label class="form-label" for="new-p-medium">Medium</label>
            <input type="text" id="new-p-medium" class="form-control" required placeholder="Oil and raw pigment on linen" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-p-desc">Editorial Description</label>
          <textarea id="new-p-desc" class="form-control" required placeholder="Notes on technique, light, surface..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" for="new-p-image">Image File / Path (Leave blank for auto-generated deterministic abstract SVG)</label>
          <input type="text" id="new-p-image" class="form-control" placeholder="assets/images/painting_01.jpg" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-secondary" onclick="UI.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save to Inventory</button>
        </div>
      </form>
    `);
  },

  handleAddPaintingSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('new-p-title').value;
    const artist = document.getElementById('new-p-artist').value;
    const price = parseInt(document.getElementById('new-p-price').value, 10);
    const dimensions = document.getElementById('new-p-dimensions').value;
    const medium = document.getElementById('new-p-medium').value;
    const desc = document.getElementById('new-p-desc').value;
    const image = document.getElementById('new-p-image').value.trim();

    const created = window.ArtStore.addPainting({
      title: title,
      artist: artist,
      price: price,
      dimensions: dimensions,
      medium: medium,
      description: desc,
      image: image,
      provenance: 'Contemporary Studio Inventory',
      framing: 'Float-framed in natural oiled walnut'
    });

    UI.closeModal();
    UI.toast(`Added “${created.title}” to studio inventory!`);
    this.renderDashboard('artworks');
  }
};

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

window.App = App;
