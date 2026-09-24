// ==========================================
// 电话号码管理系统
// ==========================================

let currentPage = 1;
let pageSize = 10;
let totalRecords = 0;
let accessPassword = sessionStorage.getItem('accessPassword') || '';
let activeLoadController = null;

document.addEventListener('DOMContentLoaded', () => {
    loadData();

    document.getElementById('search-input').addEventListener('input', debounce(() => { currentPage = 1; loadData(); }, 300));
    document.getElementById('status-filter').addEventListener('change', () => { currentPage = 1; loadData(); });
    document.getElementById('page-size-select').addEventListener('change', (e) => { pageSize = +e.target.value; currentPage = 1; loadData(); });

    document.getElementById('first-btn').addEventListener('click', () => goToPage(1));
    document.getElementById('prev-btn').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('next-btn').addEventListener('click', () => goToPage(currentPage + 1));
    document.getElementById('last-btn').addEventListener('click', () => { const tp = Math.ceil(totalRecords / pageSize) || 1; goToPage(tp); });

    document.getElementById('upload-btn').addEventListener('click', handleUpload);
    document.getElementById('excel-file').addEventListener('change', handleFileSelect);
    document.getElementById('table-body').addEventListener('click', handleTableClick);
});

// ─── 数据加载 ───────────────────────────────

async function loadData() {
    const keyword = document.getElementById('search-input').value.trim();
    const status = document.getElementById('status-filter').value;

    const params = new URLSearchParams({ page: currentPage, pageSize, keyword, status });
    if (activeLoadController) {
        activeLoadController.abort();
    }
    activeLoadController = new AbortController();

    let res;
    try {
        res = await apiFetch('/api/numbers?' + params, { signal: activeLoadController.signal });
    } catch (error) {
        if (error.name === 'AbortError') return;
        showToast('网络错误，请稍后重试', 'error');
        return;
    }

    const json = await res.json();

    if (json.code !== 0) { showToast(json.message, 'error'); return; }

    const { list, total, unused, used, totalPages } = json.data;
    totalRecords = total;

    renderTable(list);
    updatePagination(totalPages, total);
    updateStats(unused, used, total);
}

// ─── 渲染 ───────────────────────────────────

function renderTable(list) {
    const tbody = document.getElementById('table-body');

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-state"><div class="empty-icon">📭</div><p>暂无数据</p></td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(item => `
        <tr class="main-row ${item.status === '已使用' ? 'row-used' : ''}" data-id="${item.id}">
            <td class="col-index" data-label="索引">${item.id}</td>
            <td data-label="国家">${escHtml(item.country)}</td>
            <td class="col-region" data-label="地区">${escHtml(item.region)}</td>
            <td data-label="号码"><strong>${escHtml(item.number)}</strong></td>
            <td data-label="状态"><span class="status-badge ${item.status === '已使用' ? 'status-used' : 'status-new'}">${item.status === '已使用' ? '已使用' : '未使用'}</span></td>
            <td class="col-time" data-label="使用时间">${escHtml(item.used_time)}</td>
            <td class="col-action">
                <button class="copy-btn"
                    data-action="copy"
                    data-id="${item.id}"
                    data-number="${escAttr(item.number)}"
                    ${item.status === '已使用' ? 'disabled' : ''}>
                    ${item.status === '已使用' ? '已复制' : '复制'}
                </button>
            </td>
        </tr>
        <tr class="detail-row hidden" id="detail-${item.id}" aria-hidden="true">
            <td colspan="7"><strong>地区：</strong>${escHtml(item.region)} &nbsp;&nbsp; <strong>使用时间：</strong>${escHtml(item.used_time)}</td>
        </tr>
    `).join('');
}

function handleTableClick(event) {
    const copyButton = event.target.closest('[data-action="copy"]');
    if (copyButton) {
        copyAndMark(Number(copyButton.dataset.id), copyButton.dataset.number, copyButton);
        return;
    }

    const row = event.target.closest('.main-row');
    if (row) {
        toggleDetail(Number(row.dataset.id));
    }
}

function toggleDetail(id) {
    const detailRow = document.getElementById('detail-' + id);
    if (!detailRow) return;
    if (detailRow.classList.contains('hidden')) {
        document.querySelectorAll('.detail-row').forEach(r => r.classList.add('hidden'));
        detailRow.classList.remove('hidden');
        detailRow.setAttribute('aria-hidden', 'false');
    } else {
        detailRow.classList.add('hidden');
        detailRow.setAttribute('aria-hidden', 'true');
    }
}

function updatePagination(totalPages, total) {
    document.getElementById('current-page').textContent = total === 0 ? 0 : currentPage;
    document.getElementById('total-pages').textContent = totalPages;
    document.getElementById('page-total').textContent = total;

    document.getElementById('first-btn').disabled = currentPage <= 1;
    document.getElementById('prev-btn').disabled = currentPage <= 1;
    document.getElementById('next-btn').disabled = currentPage >= totalPages;
    document.getElementById('last-btn').disabled = currentPage >= totalPages;

    const container = document.getElementById('page-numbers');
    container.innerHTML = '';
    if (totalPages <= 1) return;

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);
    if (end - start < 4) {
        if (start === 1) end = Math.min(totalPages, start + 4);
        else start = Math.max(1, end - 4);
    }
    for (let i = start; i <= end; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        if (i === currentPage) btn.classList.add('active');
        btn.addEventListener('click', () => goToPage(i));
        container.appendChild(btn);
    }
}

function updateStats(unused, used, total) {
    document.getElementById('total-count').textContent = total;
    document.getElementById('new-count').textContent = unused;
    document.getElementById('used-count').textContent = used;
}

function goToPage(p) {
    const tp = Math.ceil(totalRecords / pageSize) || 1;
    if (p < 1 || p > tp) return;
    currentPage = p;
    loadData();
    document.getElementById('phone-table').scrollIntoView({ block: 'start' });
}

// ─── 复制 + 标记 ────────────────────────────

async function copyAndMark(id, number, btn) {
    if (btn) { btn.textContent = '复制中…'; btn.classList.add('loading'); }

    // 复制
    const copied = await copyText(number);
    if (!copied) {
        showToast('❌ 复制失败，请长按手动复制', 'error');
        if (btn) { btn.textContent = '复制'; btn.classList.remove('loading'); }
        return;
    }

    // 标记已使用
    const res = await apiFetch(`/api/numbers/${id}/use`, { method: 'PUT' });
    const json = await res.json();

    if (json.code !== 0) {
        showToast(json.message, 'error');
        if (btn) { btn.textContent = '复制'; btn.classList.remove('loading'); }
        return;
    }

    loadData();
    showToast('✅ 已复制：' + number);
    if (navigator.vibrate) navigator.vibrate(50);
}

function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).then(() => true).catch(() => fallbackCopy(text));
    }
    return fallbackCopy(text);
}

function fallbackCopy(text) {
    return new Promise(resolve => {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
        ta.setAttribute('readonly', '');
        document.body.appendChild(ta);
        ta.contentEditable = 'true';
        ta.readOnly = false;
        if (/ipad|iphone/i.test(navigator.userAgent)) {
            const range = document.createRange();
            range.selectNodeContents(ta);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            ta.setSelectionRange(0, 999999);
        } else {
            ta.select();
            ta.setSelectionRange(0, 999999);
        }
        try {
            const ok = document.execCommand('copy');
            resolve(ok);
        } catch (e) {
            resolve(false);
        }
        document.body.removeChild(ta);
    });
}

// ─── 上传 ──────────────────────────────────

function handleFileSelect(e) {
    const file = e.target.files[0];
    const el = document.getElementById('upload-status');
    if (file) { el.textContent = '已选择: ' + file.name; el.style.color = '#28a745'; }
    else { el.textContent = ''; }
}

async function handleUpload() {
    const fileInput = document.getElementById('excel-file');
    const file = fileInput.files[0];
    const statusEl = document.getElementById('upload-status');

    if (!file) { statusEl.textContent = '⚠️ 请先选择Excel文件'; statusEl.style.color = '#dc3545'; return; }

    statusEl.textContent = '⏳ 正在导入...';
    statusEl.style.color = '#ffc107';
    const btn = document.getElementById('upload-btn');
    btn.disabled = true;
    btn.textContent = '导入中...';

    const form = new FormData();
    form.append('file', file);

    try {
        const res = await apiFetch('/api/numbers/upload', { method: 'POST', body: form });
        const json = await res.json();
        if (json.code === 0) {
            statusEl.textContent = '✅ ' + json.message;
            statusEl.style.color = '#28a745';
            currentPage = 1;
            loadData();
            showToast('✅ ' + json.message);
        } else {
            statusEl.textContent = '❌ ' + json.message;
            statusEl.style.color = '#dc3545';
            showToast(json.message, 'error');
        }
    } catch (e) {
        statusEl.textContent = '❌ 网络错误';
        statusEl.style.color = '#dc3545';
    }

    btn.disabled = false;
    btn.textContent = '上传导入';
    fileInput.value = '';
}

// ─── 工具 ──────────────────────────────────

function escHtml(s) {
    if (!s) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function escAttr(s) {
    return escHtml(s);
}

async function apiFetch(url, options) {
    options = options || {};
    options.headers = new Headers(options.headers || {});
    if (accessPassword) {
        options.headers.set('x-access-password', accessPassword);
    }

    let res = await fetch(url, options);
    if (res.status !== 401) {
        return res;
    }

    const password = window.prompt('请输入访问密码');
    if (!password) {
        return res;
    }

    accessPassword = password;
    sessionStorage.setItem('accessPassword', password);
    options.headers.set('x-access-password', password);
    res = await fetch(url, options);
    if (res.status === 401) {
        sessionStorage.removeItem('accessPassword');
        accessPassword = '';
    }
    return res;
}

function debounce(fn, ms) {
    let timer;
    return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), ms);
    };
}

function showToast(message, type) {
    type = type || 'success';
    const old = document.querySelector('.toast,.toast-overlay');
    if (old) old.remove();
    const oldO = document.querySelector('.toast-overlay');
    if (oldO) oldO.remove();

    const overlay = document.createElement('div');
    overlay.className = 'toast-overlay';
    document.body.appendChild(overlay);

    const toast = document.createElement('div');
    toast.className = 'toast' + (type === 'error' ? ' error' : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => { toast.remove(); overlay.remove(); }, 2000);
}
