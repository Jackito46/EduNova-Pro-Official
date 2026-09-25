/**
 * EduNova Pro - Assistant de Défilement Souris & Zones de Clic Ciblées
 * 
 * 1. Redirection de la molette verticale vers le défilement horizontal sur conteneurs custom-scrollbar.
 * 2. Glisser-déposer à la souris (Grab-to-scroll) sur conteneurs à défilement horizontal sans écran tactile.
 * 3. Support des touches clavier directionnelles.
 */

class MouseScrollEnhancer {
  private initialized = false;
  private enhancedContainers = new WeakSet<HTMLElement>();

  public init() {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    // Scan initial
    this.scanAndEnhance();

    // Observeur pour les nouveaux conteneurs ajoutés par React
    const observer = new MutationObserver(() => {
      this.scanAndEnhance();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Écouteur global pour la molette sur tout élément horizontal
    window.addEventListener('wheel', this.handleGlobalWheel, { passive: false });
  }

  public scanAndEnhance() {
    const targets = document.querySelectorAll<HTMLElement>(
      '.custom-scrollbar, .overflow-x-auto, [data-mouse-scroll="true"]'
    );

    targets.forEach((container) => {
      this.enhanceElement(container);
    });
  }

  public enhanceElement(container: HTMLElement) {
    if (this.enhancedContainers.has(container)) return;
    this.enhancedContainers.add(container);

    // 1. Redirection de la molette pour défilement horizontal
    container.addEventListener('wheel', (e: WheelEvent) => {
      if (e.deltaY !== 0 && !e.shiftKey) {
        const canScrollX = container.scrollWidth > container.clientWidth + 2;
        const canScrollY = container.scrollHeight > container.clientHeight + 2;

        if (canScrollX && !canScrollY) {
          e.preventDefault();
          container.scrollLeft += e.deltaY * 1.15;
        }
      }
    }, { passive: false });

    // 2. Glisser-déposer à la souris (Grab to scroll)
    this.setupGrabToScroll(container);
  }

  private setupGrabToScroll(container: HTMLElement) {
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let isDragging = false;

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('button, a, input, select, textarea, [role="button"], [role="checkbox"], .scroll-click-btn, [data-no-grab]')) {
        return;
      }

      const hasOverflowX = container.scrollWidth > container.clientWidth + 2;
      if (!hasOverflowX) return;

      isDown = true;
      isDragging = false;
      startX = e.pageX - container.offsetLeft;
      scrollLeft = container.scrollLeft;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDown) return;

      const x = e.pageX - container.offsetLeft;
      const walkX = x - startX;

      if (!isDragging && Math.abs(walkX) > 4) {
        isDragging = true;
        container.classList.add('mouse-grab-dragging');
      }

      if (isDragging) {
        e.preventDefault();
        container.scrollLeft = scrollLeft - walkX;
      }
    };

    const onMouseUp = () => {
      if (isDown) {
        isDown = false;
        container.classList.remove('mouse-grab-dragging');

        if (isDragging) {
          const captureClick = (ev: MouseEvent) => {
            ev.stopPropagation();
            ev.preventDefault();
            window.removeEventListener('click', captureClick, true);
          };
          window.addEventListener('click', captureClick, true);
          setTimeout(() => {
            window.removeEventListener('click', captureClick, true);
          }, 60);
        }
      }
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }

  private handleGlobalWheel = (e: WheelEvent) => {
    if (e.deltaY === 0 || e.shiftKey) return;

    let target = e.target as HTMLElement | null;
    while (target && target !== document.body) {
      const isCustomScrollbar = target.classList.contains('custom-scrollbar');
      const isOverflowX = target.classList.contains('overflow-x-auto');
      const hasHorizontal = target.scrollWidth > target.clientWidth + 4;
      const hasVertical = target.scrollHeight > target.clientHeight + 4;

      if ((isCustomScrollbar || isOverflowX) && hasHorizontal && !hasVertical) {
        e.preventDefault();
        target.scrollLeft += e.deltaY * 1.15;
        return;
      }
      target = target.parentElement;
    }
  };
}

export const mouseScrollEnhancer = new MouseScrollEnhancer();
