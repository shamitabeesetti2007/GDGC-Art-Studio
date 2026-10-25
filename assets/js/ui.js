/* ==========================================================================
   UI UTILITIES — MODALS, TOASTS, VISUAL RENDERERS
   ========================================================================== */

const UI = {
  lastFocusedElement: null,
  // --- Formatters ---
  formatCurrency(num) {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(num);
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  },

  // --- Artwork Visual Renderer (Image or Deterministic SVG fallback) ---
  renderArtworkVisual(painting, extraClass = '') {
    if (painting.image && painting.image.trim() !== '') {
      return `
        <div class="artwork-image-container ${painting.aspect || 'landscape'} ${extraClass}">
          <img src="${painting.image}" 
               alt="${painting.title} by ${painting.artist}" 
               loading="lazy" 
               onerror="this.parentElement.innerHTML = window.generateDeterministicSvg('${painting.id}', '${painting.title}');" />
        </div>
      `;
    } else {
      // Deterministic SVG fallback
      const svg = window.generateDeterministicSvg(painting.id, painting.title);
      return `
        <div class="artwork-image-container ${painting.aspect || 'portrait'} ${extraClass}">
          ${svg}
        </div>
      `;
    }
  },

  // --- Toast Notifications ---
  toast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    const marker = document.createElement('span');
    marker.textContent = '•';
    marker.style.color = 'var(--color-soft-clay)';
    marker.style.fontSize = '1.1rem';
    const content = document.createElement('div');
    content.style.flexGrow = '1';
    content.textContent = String(message);
    toast.append(marker, content);

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 240ms ease';
      setTimeout(() => toast.remove(), 260);
    }, 4200);
  },

  // --- Confirmation & Alert Modals ---
  confirm({ title, message, confirmText = 'Confirm Acquisition', cancelText = 'Return', onConfirm }) {
    const backdrop = document.getElementById('global-modal-backdrop');
    const dialog = document.getElementById('global-modal-dialog');
    if (!backdrop || !dialog) return;
    this.lastFocusedElement = document.activeElement;

    dialog.innerHTML = `
      <button type="button" class="modal-close-btn" aria-label="Close dialog" onclick="UI.closeModal()">&times;</button>
      <span class="editorial-kicker">Confirmation</span>
      <h3 class="modal-title">${title}</h3>
      <p style="margin-top: 12px; margin-bottom: 24px; color: var(--color-muted-text); line-height: 1.6;">${message}</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="UI.closeModal()">${cancelText}</button>
        <button class="btn btn-primary" id="modal-confirm-btn">${confirmText}</button>
      </div>
    `;
    const dialogTitle = dialog.querySelector('.modal-title');
    if (dialogTitle) {
      dialogTitle.id = 'active-dialog-title';
      backdrop.setAttribute('aria-labelledby', dialogTitle.id);
    }

    backdrop.classList.add('open');
    backdrop.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';

    const confirmBtn = document.getElementById('modal-confirm-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        UI.closeModal();
        if (typeof onConfirm === 'function') onConfirm();
      });
      confirmBtn.focus();
    }
  },

  openModal(htmlContent) {
    const backdrop = document.getElementById('global-modal-backdrop');
    const dialog = document.getElementById('global-modal-dialog');
    if (!backdrop || !dialog) return;
    this.lastFocusedElement = document.activeElement;

    dialog.innerHTML = `
      <button type="button" class="modal-close-btn" aria-label="Close dialog" onclick="UI.closeModal()">&times;</button>
      ${htmlContent}
    `;

    backdrop.classList.add('open');
    backdrop.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    const title = dialog.querySelector('h1, h2, h3');
    if (title) {
      title.id = 'active-dialog-title';
      backdrop.setAttribute('aria-labelledby', title.id);
    }
    const firstControl = dialog.querySelector('input, select, textarea, button');
    if (firstControl) firstControl.focus();
  },

  closeModal() {
    const backdrop = document.getElementById('global-modal-backdrop');
    if (backdrop) {
      backdrop.classList.remove('open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
    if (this.lastFocusedElement && this.lastFocusedElement.isConnected) this.lastFocusedElement.focus();
    this.lastFocusedElement = null;
  },

  trapFocus(event) {
    const dialog = document.getElementById('global-modal-dialog');
    if (!dialog) return;
    const controls = Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(control => control.getClientRects().length > 0);
    if (!controls.length) {
      event.preventDefault();
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
};

window.UI = UI;
