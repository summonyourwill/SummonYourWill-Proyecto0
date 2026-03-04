/**
 * Full numeric pagination component (vanilla JS).
 * API: page (1-based), totalPages, pageSize, onPageChange(newPage), onPageSizeChange?(newSize).
 * Renders: « Prev, page numbers, Next » and optional page size selector (10, 20, 50).
 * When pageSize changes, parent should set page=1 and refresh.
 */

const PAGE_SIZES = [10, 20, 50];

/**
 * Compute page numbers to display.
 * If totalPages <= 7: show all.
 * If totalPages > 7: show 1, …, (page-1), page, (page+1), …, totalPages (no duplicates, bounded).
 * @param {number} page - current page (1-based)
 * @param {number} totalPages
 * @returns {Array<number|'ellipsis'>}
 */
function getPageNumbers(page, totalPages) {
  if (totalPages <= 0) return [];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set([1, totalPages]);
  if (page >= 1 && page <= totalPages) {
    pages.add(page);
    if (page > 1) pages.add(page - 1);
    if (page < totalPages) pages.add(page + 1);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis');
    out.push(sorted[i]);
  }
  return out;
}

/**
 * Render full pagination into a container.
 * @param {HTMLElement} container - element to render into (e.g. #hero-pagination)
 * @param {Object} options
 * @param {number} options.page - current page (1-based)
 * @param {number} options.totalPages
 * @param {number} options.pageSize
 * @param {(newPage: number) => void} options.onPageChange
 * @param {(newSize: number) => void} [options.onPageSizeChange]
 */
export function renderPagination(container, { page, totalPages, pageSize, onPageChange, onPageSizeChange }) {
  if (!container) return;
  container.innerHTML = '';
  container.className = 'pagination';

  const bar = document.createElement('div');
  bar.className = 'pagination-bar';

  // « Prev
  const prevBtn = document.createElement('button');
  prevBtn.type = 'button';
  prevBtn.className = 'pagination-btn pagination-btn-prev';
  prevBtn.textContent = '« Prev';
  prevBtn.setAttribute('aria-label', 'Previous page');
  prevBtn.disabled = page <= 1;
  if (page > 1) prevBtn.addEventListener('click', () => onPageChange(page - 1));
  bar.appendChild(prevBtn);

  // Page numbers
  const numbers = getPageNumbers(page, totalPages);
  for (const n of numbers) {
    if (n === 'ellipsis') {
      const span = document.createElement('span');
      span.className = 'pagination-ellipsis';
      span.setAttribute('aria-hidden', 'true');
      span.textContent = '…';
      bar.appendChild(span);
      continue;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pagination-btn pagination-btn-page' + (n === page ? ' active' : '');
    btn.textContent = String(n);
    btn.setAttribute('aria-label', `Page ${n}`);
    if (n === page) btn.setAttribute('aria-current', 'page');
    if (n !== page) btn.addEventListener('click', () => onPageChange(n));
    bar.appendChild(btn);
  }

  // Next »
  const nextBtn = document.createElement('button');
  nextBtn.type = 'button';
  nextBtn.className = 'pagination-btn pagination-btn-next';
  nextBtn.textContent = 'Next »';
  nextBtn.setAttribute('aria-label', 'Next page');
  nextBtn.disabled = page >= totalPages;
  if (page < totalPages) nextBtn.addEventListener('click', () => onPageChange(page + 1));
  bar.appendChild(nextBtn);

  container.appendChild(bar);

  // Page size selector (optional)
  if (typeof onPageSizeChange === 'function') {
    const sizeWrap = document.createElement('div');
    sizeWrap.className = 'pagination-size-wrap';
    const sizeLabel = document.createElement('label');
    sizeLabel.className = 'pagination-size-label';
    sizeLabel.textContent = 'Per page: ';
    const select = document.createElement('select');
    select.className = 'pagination-size-select';
    select.setAttribute('aria-label', 'Items per page');
    for (const size of PAGE_SIZES) {
      const opt = document.createElement('option');
      opt.value = String(size);
      opt.textContent = String(size);
      if (size === pageSize) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      const newSize = Number(select.value);
      onPageSizeChange(newSize);
    });
    sizeLabel.appendChild(select);
    sizeWrap.appendChild(sizeLabel);
    container.appendChild(sizeWrap);
  }
}

/**
 * Parse page and pageSize from URL search params.
 * @param {URLSearchParams} [params] - defaults to current window location
 * @returns {{ page: number, pageSize: number }}
 */
export function getPaginationParamsFromUrl(params = null) {
  const search = params || (typeof window !== 'undefined' && window.location && new URLSearchParams(window.location.search));
  if (!search) return { page: 1, pageSize: 10 };
  const page = Math.max(1, parseInt(search.get('page') || '1', 10) || 1);
  const pageSizeRaw = parseInt(search.get('pageSize') || '10', 10);
  const pageSize = [10, 20, 50].includes(pageSizeRaw) ? pageSizeRaw : 10;
  return { page, pageSize };
}

/**
 * Update URL query params for page and pageSize (no full navigation).
 * @param {number} page
 * @param {number} pageSize
 */
export function setPaginationParamsInUrl(page, pageSize) {
  if (typeof window === 'undefined' || !window.history || !window.location) return;
  const url = new URL(window.location.href);
  url.searchParams.set('page', String(page));
  url.searchParams.set('pageSize', String(pageSize));
  window.history.replaceState(null, '', url.toString());
}
