import { saveCertTemplate, getCertTemplate, deleteCertTemplate, generateId } from '../store.js';
import { renderNavbar, showToast, escapeHtml } from '../utils.js';
import { requireAdmin } from '../auth.js';

let template = null, selectedId = null, isDragging = false, dragStart = { x: 0, y: 0 }, elStart = { x: 0, y: 0 };

export async function renderCertDesigner(app, params) {
  if (!requireAdmin()) return;

  const id = params[0];
  if (id && id !== 'new') {
    template = await getCertTemplate(id);
    if (!template) { window.location.hash = '#/admin'; return; }
  } else if (id === 'new') {
    template = defaultTemplate();
  } else {
    window.location.hash = '#/admin';
    return;
  }
  selectedId = null;
  renderDesigner(app);
}

function defaultTemplate() {
  return {
    id: generateId(),
    name: "Gyan International Excellence Certificate",
    backgroundColor: '#fffdf7',
    borderColor: '#c8a96e',
    borderStyle: 'double',
    borderWidth: 8,
    elements: [
      { id: generateId(), type: 'image', src: 'logo.png', x: 390, y: 35, width: 120, height: 100 },
      el('CERTIFICATE OF EXCELLENCE', 150, 145, 34, '#c8a96e', "'Playfair Display',serif", '700', 'center', 600),
      el('PROUDLY PRESENTED TO', 250, 195, 14, '#8a7a5a', "'Outfit',sans-serif", '600', 'center', 400),
      el('{{name}}', 150, 245, 40, '#0284c7', "'Great Vibes',cursive", '400', 'center', 600),
      el('─────────────────────────', 200, 305, 14, '#c8a96e', 'serif', 'normal', 'center', 500),
      el('for outstanding achievement in', 200, 340, 14, '#666', "'Outfit',sans-serif", '400', 'center', 500),
      el('{{quiz_title}}', 150, 375, 24, '#1e293b', "'Playfair Display',serif", '700', 'center', 600),
      el('Final Score: {{score}} / {{total}} ({{percent}})', 200, 430, 16, '#555', "'Outfit',sans-serif", '500', 'center', 500),
      el('Date: {{date}}', 120, 520, 14, '#888', "'Outfit',sans-serif", '400', 'center', 250),
      el('________________________\nAuthorized Controller', 530, 505, 13, '#888', "'Outfit',sans-serif", '400', 'center', 250),
    ],
    createdAt: new Date().toISOString()
  };
}

function el(content, x, y, fontSize, color, fontFamily, fontWeight, textAlign, width, fontStyle = 'normal') {
  return { id: generateId(), type: 'text', content, x, y, fontSize, color, fontFamily, fontWeight, fontStyle, textAlign, width };
}

function renderDesigner(app) {
  const sel = selectedId ? template.elements.find(e => e.id === selectedId) : null;
  const isText = sel && sel.type !== 'image';

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page" style="padding-top: 60px">
      
      <!-- Top Toolbar -->
      <div class="designer-toolbar">
        <div style="display:flex; align-items:center; gap: 0.75rem">
          <a href="#/admin" class="btn btn-ghost btn-sm">← Admin Portal</a>
          <input type="text" id="tmpl-name" value="${escapeHtml(template.name)}" class="toolbar-name-input" placeholder="Template Name" style="font-weight:700">
        </div>

        <div style="display:flex; align-items:center; gap: 0.5rem; flex-wrap:wrap">
          ${isText ? `
            <select id="tb-font" class="toolbar-select">${fontOptions(sel.fontFamily)}</select>
            <input type="number" id="tb-size" value="${sel.fontSize || 16}" min="8" max="120" class="toolbar-num" title="Font Size">
            <input type="color" id="tb-color" value="${sel.color || '#333333'}" class="toolbar-color" title="Text Color">
            <button id="tb-bold" class="toolbar-btn ${sel.fontWeight === '700' || sel.fontWeight === 'bold' ? 'active' : ''}"><b>B</b></button>
            <button id="tb-italic" class="toolbar-btn ${sel.fontStyle === 'italic' ? 'active' : ''}"><i>I</i></button>
            <button id="tb-left" class="toolbar-btn ${sel.textAlign === 'left' ? 'active' : ''}">◧</button>
            <button id="tb-center" class="toolbar-btn ${sel.textAlign === 'center' ? 'active' : ''}">◫</button>
            <button id="tb-right" class="toolbar-btn ${sel.textAlign === 'right' ? 'active' : ''}">◨</button>
            <button id="tb-dup" class="toolbar-btn" title="Duplicate">📋</button>
            <button id="tb-del" class="toolbar-btn" title="Delete" style="color:var(--clay-danger)">🗑️</button>
          ` : sel && sel.type === 'image' ? `
            <span style="font-size:0.85rem; font-weight:700; color:var(--clay-primary)">📷 Image Element Selected</span>
            <button id="tb-dup" class="toolbar-btn" title="Duplicate">📋</button>
            <button id="tb-del" class="toolbar-btn" title="Delete" style="color:var(--clay-danger)">🗑️</button>
          ` : `
            <span style="font-size:0.8rem; color:var(--text-sub)">Select element on canvas to format</span>
          `}
          
          <button class="btn btn-secondary btn-sm" id="btn-add-el">+ Add Text Box</button>
          <button class="btn btn-secondary btn-sm" id="btn-add-img" style="background:#e0f2fe; color:#0284c7">+ Add Image / Logo</button>
          <button class="btn btn-primary btn-sm" id="btn-save">💾 Save Template</button>
        </div>
      </div>

      <!-- Main Designer 3-Panel Layout -->
      <div class="designer-layout">
        
        <!-- Left Panel: Canvas Settings & Layers -->
        <div class="designer-left-panel">
          <h4 style="font-size:0.8rem; font-weight:800; text-transform:uppercase; color:var(--text-muted); letter-spacing:1px; margin-bottom: 0.75rem">Canvas Settings</h4>
          
          <div class="form-group" style="margin-bottom: 0.75rem">
            <label class="form-label" style="font-size:0.75rem">Background Color</label>
            <input type="color" id="bg-color" value="${template.backgroundColor || '#fffdf7'}" class="toolbar-color" style="width:100%; height:34px">
          </div>
          
          <div class="form-group" style="margin-bottom: 0.75rem">
            <label class="form-label" style="font-size:0.75rem">Border Style & Color</label>
            <div style="display:flex; gap: 0.4rem">
              <input type="color" id="bd-color" value="${template.borderColor || '#c8a96e'}" class="toolbar-color" style="width:34px; height:34px">
              <select id="bd-style" class="toolbar-select" style="flex:1">${borderOptions(template.borderStyle)}</select>
            </div>
          </div>

          <hr style="border:none; border-top:1px solid rgba(160,195,230,0.3); margin: 1.25rem 0">

          <h4 style="font-size:0.8rem; font-weight:800; text-transform:uppercase; color:var(--text-muted); letter-spacing:1px; margin-bottom: 0.75rem">Elements / Layers</h4>
          <div id="layers-list">
            ${template.elements.map((e, i) => `
              <div class="layer-item ${e.id === selectedId ? 'active' : ''}" data-elid="${e.id}">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1">
                  ${e.type === 'image' ? '📷 [Image/Logo]' : escapeHtml(e.content).substring(0, 20) || 'Empty Text'}
                </span>
                <span style="font-size:0.7rem; opacity:0.7">#${i + 1}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Middle Canvas Area -->
        <div class="designer-canvas-area" id="canvas-area">
          <div class="cert-canvas" id="cert-canvas" style="background:${template.backgroundColor}; border:${template.borderWidth || 8}px ${template.borderStyle || 'double'} ${template.borderColor || '#c8a96e'}">
            ${template.elements.map(e => {
              if (e.type === 'image') {
                return `
                  <div class="cert-el ${e.id === selectedId ? 'selected' : ''}" data-elid="${e.id}"
                    style="left:${e.x}px; top:${e.y}px; width:${e.width || 100}px; height:${e.height || 100}px">
                    <img src="${e.src}" style="width:100%; height:100%; object-fit:contain; pointer-events:none">
                  </div>`;
              }
              return `
                <div class="cert-el ${e.id === selectedId ? 'selected' : ''}" data-elid="${e.id}"
                  style="left:${e.x}px; top:${e.y}px; font-size:${e.fontSize || 16}px; color:${e.color || '#333'}; font-family:${e.fontFamily || "'Playfair Display',serif"}; font-weight:${e.fontWeight || 'normal'}; font-style:${e.fontStyle || 'normal'}; text-align:${e.textAlign || 'center'}; ${e.width ? `width:${e.width}px;` : ''} white-space:pre-wrap; line-height:1.4">
                  ${e.content}
                </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Right Panel: Active Element Properties -->
        <div class="designer-right-panel">
          ${sel ? `
            <h4 style="font-size:0.8rem; font-weight:800; text-transform:uppercase; color:var(--text-muted); letter-spacing:1px; margin-bottom: 0.75rem">
              ${sel.type === 'image' ? '📷 Image Properties' : '✏️ Text Properties'}
            </h4>
            
            ${sel.type === 'image' ? `
              <div class="form-group">
                <label class="form-label" style="font-size:0.75rem">Image Source URL / Path</label>
                <input type="text" class="form-input" id="prop-img-src" value="${escapeHtml(sel.src)}" style="font-size:0.8rem">
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem">
                <div class="form-group">
                  <label class="form-label" style="font-size:0.75rem">Width (px)</label>
                  <input type="number" class="form-input" id="prop-w" value="${sel.width || 100}">
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size:0.75rem">Height (px)</label>
                  <input type="number" class="form-input" id="prop-h" value="${sel.height || 100}">
                </div>
              </div>
            ` : `
              <div class="form-group">
                <label class="form-label" style="font-size:0.75rem">Text Content</label>
                <textarea class="form-textarea" id="prop-content" rows="3" style="font-size:0.85rem">${escapeHtml(sel.content)}</textarea>
                <div style="font-size:0.65rem; color:var(--text-muted); margin-top: 0.4rem; line-height:1.4">
                  Placeholders: <b>{{name}}</b>, <b>{{quiz_title}}</b>, <b>{{score}}</b>, <b>{{total}}</b>, <b>{{percent}}</b>, <b>{{date}}</b>
                </div>
              </div>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem">
                <div class="form-group">
                  <label class="form-label" style="font-size:0.75rem">Width (px)</label>
                  <input type="number" class="form-input" id="prop-w" value="${sel.width || ''}" placeholder="Auto">
                </div>
                <div class="form-group">
                  <label class="form-label" style="font-size:0.75rem">Font Size (px)</label>
                  <input type="number" class="form-input" id="prop-fs" value="${sel.fontSize || 16}">
                </div>
              </div>
            `}

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem">
              <div class="form-group">
                <label class="form-label" style="font-size:0.75rem">X Position (px)</label>
                <input type="number" class="form-input" id="prop-x" value="${sel.x}">
              </div>
              <div class="form-group">
                <label class="form-label" style="font-size:0.75rem">Y Position (px)</label>
                <input type="number" class="form-input" id="prop-y" value="${sel.y}">
              </div>
            </div>
          ` : `
            <div style="text-align:center; padding: 2rem 0; color:var(--text-sub)">
              <div style="font-size: 2rem; margin-bottom: 0.5rem">👆</div>
              <p style="font-size: 0.85rem">Click on any text or image on canvas to customize.</p>
            </div>
          `}
        </div>

      </div>
    </div>
  `;

  bindDesignerEvents(app);
}

function fontOptions(current) {
  const fonts = [["'Outfit',sans-serif", "Outfit"], ["'Inter',sans-serif", "Inter"], ["'Playfair Display',serif", "Playfair Display"], ["'Great Vibes',cursive", "Great Vibes"], ["serif", "Serif"], ["monospace", "Monospace"]];
  return fonts.map(([v, l]) => `<option value="${v}" ${current?.includes(l.split(' ')[0]) ? 'selected' : ''}>${l}</option>`).join('');
}

function borderOptions(current) {
  return ['double', 'solid', 'dashed', 'groove', 'ridge', 'none'].map(s => `<option value="${s}" ${current === s ? 'selected' : ''}>${s}</option>`).join('');
}

function bindDesignerEvents(app) {
  const canvas = document.getElementById('cert-canvas');

  document.querySelectorAll('.cert-el').forEach(domEl => {
    domEl.addEventListener('mousedown', e => {
      e.stopPropagation();
      selectedId = domEl.dataset.elid;
      const elData = template.elements.find(x => x.id === selectedId);
      if (elData) {
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        elStart = { x: elData.x, y: elData.y };
      }
      renderDesigner(app);
    });
  });

  canvas?.addEventListener('mousedown', e => {
    if (e.target === canvas) { selectedId = null; renderDesigner(app); }
  });

  const onMove = (e) => {
    if (!isDragging || !selectedId) return;
    const dx = e.clientX - dragStart.x, dy = e.clientY - dragStart.y;
    const elData = template.elements.find(x => x.id === selectedId);
    if (elData) {
      elData.x = Math.max(0, Math.round(elStart.x + dx));
      elData.y = Math.max(0, Math.round(elStart.y + dy));
      const domEl = canvas?.querySelector(`[data-elid="${selectedId}"]`);
      if (domEl) { domEl.style.left = elData.x + 'px'; domEl.style.top = elData.y + 'px'; }
      const px = document.getElementById('prop-x'), py = document.getElementById('prop-y');
      if (px) px.value = elData.x; if (py) py.value = elData.y;
    }
  };
  const onUp = () => { isDragging = false; };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  document.querySelectorAll('.layer-item').forEach(item => {
    item.addEventListener('click', () => { selectedId = item.dataset.elid; renderDesigner(app); });
  });

  const sel = selectedId ? template.elements.find(e => e.id === selectedId) : null;
  if (sel) {
    const bind = (id, prop, tx) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => { sel[prop] = tx ? tx(el.value) : el.value; updateCanvasEl(sel); });
      el.addEventListener('change', () => { sel[prop] = tx ? tx(el.value) : el.value; renderDesigner(app); });
    };
    if (sel.type === 'image') {
      bind('prop-img-src', 'src');
      bind('prop-w', 'width', v => parseInt(v) || 100);
      bind('prop-h', 'height', v => parseInt(v) || 100);
    } else {
      bind('tb-font', 'fontFamily');
      bind('tb-size', 'fontSize', v => parseInt(v) || 16);
      bind('tb-color', 'color');
      bind('prop-content', 'content');
      bind('prop-w', 'width', v => parseInt(v) || null);
      bind('prop-fs', 'fontSize', v => parseInt(v) || 16);

      document.getElementById('tb-bold')?.addEventListener('click', () => {
        sel.fontWeight = (sel.fontWeight === '700' || sel.fontWeight === 'bold') ? 'normal' : '700'; renderDesigner(app);
      });
      document.getElementById('tb-italic')?.addEventListener('click', () => {
        sel.fontStyle = sel.fontStyle === 'italic' ? 'normal' : 'italic'; renderDesigner(app);
      });
      ['left', 'center', 'right'].forEach(a => {
        document.getElementById(`tb-${a}`)?.addEventListener('click', () => { sel.textAlign = a; renderDesigner(app); });
      });
    }

    bind('prop-x', 'x', v => parseInt(v) || 0);
    bind('prop-y', 'y', v => parseInt(v) || 0);

    document.getElementById('tb-dup')?.addEventListener('click', () => {
      const dup = JSON.parse(JSON.stringify(sel)); dup.id = generateId(); dup.x += 20; dup.y += 20;
      template.elements.push(dup); selectedId = dup.id; renderDesigner(app);
    });
    document.getElementById('tb-del')?.addEventListener('click', () => {
      template.elements = template.elements.filter(e => e.id !== selectedId); selectedId = null; renderDesigner(app);
    });
  }

  document.getElementById('bg-color')?.addEventListener('input', e => {
    template.backgroundColor = e.target.value; canvas.style.background = e.target.value;
  });
  document.getElementById('bd-color')?.addEventListener('input', e => {
    template.borderColor = e.target.value; canvas.style.borderColor = e.target.value;
  });
  document.getElementById('bd-style')?.addEventListener('change', e => {
    template.borderStyle = e.target.value; canvas.style.borderStyle = e.target.value;
  });

  document.getElementById('btn-add-el')?.addEventListener('click', () => {
    const ne = el('New Text Box', 300, 300, 18, '#333', "'Outfit',sans-serif", '400', 'center', 250);
    template.elements.push(ne); selectedId = ne.id; renderDesigner(app);
  });

  // ADD IMAGE MODAL DIALOG
  document.getElementById('btn-add-img')?.addEventListener('click', () => {
    const o = document.createElement('div');
    o.className = 'modal-overlay active';
    o.innerHTML = `<div class="modal-clay scale-in" style="max-width: 500px">
      <h3 style="font-size: 1.3rem; margin-bottom: 1rem; font-weight:800">📷 Add Image or Logo to Certificate</h3>
      
      <div style="display:flex; flex-direction:column; gap:0.75rem; text-align:left; margin-bottom: 1.5rem">
        <button class="btn btn-secondary" id="btn-use-school-logo" style="justify-content:flex-start">
          🏫 Use Gyan International School Logo (logo.png)
        </button>
        
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Upload Local Image File</label>
          <input type="file" id="img-file-input" accept="image/*" class="form-input">
        </div>
        
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Or Image URL</label>
          <input type="text" id="img-url-input" class="form-input" placeholder="https://example.com/logo.png">
        </div>
      </div>

      <div style="display:flex; gap: 0.75rem; justify-content: center">
        <button class="btn btn-secondary btn-sm" id="modal-img-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="modal-img-confirm">Add Image</button>
      </div>
    </div>`;
    document.body.appendChild(o);

    const addImgObj = (src) => {
      const imgEl = { id: generateId(), type: 'image', src, x: 380, y: 50, width: 120, height: 100 };
      template.elements.push(imgEl); selectedId = imgEl.id;
      o.remove();
      renderDesigner(app);
    };

    o.querySelector('#btn-use-school-logo').onclick = () => addImgObj('logo.png');
    o.querySelector('#modal-img-cancel').onclick = () => o.remove();
    o.querySelector('#modal-img-confirm').onclick = () => {
      const fileInput = o.querySelector('#img-file-input');
      const urlInput = o.querySelector('#img-url-input');
      if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = e => addImgObj(e.target.result);
        reader.readAsDataURL(fileInput.files[0]);
      } else if (urlInput.value.trim()) {
        addImgObj(urlInput.value.trim());
      } else {
        showToast('Please select a file or enter a URL', 'error');
      }
    };
  });

  document.getElementById('btn-save')?.addEventListener('click', async () => {
    template.name = document.getElementById('tmpl-name')?.value || 'Untitled Certificate';
    await saveCertTemplate(template);
    showToast('Certificate template saved! 🎨');
  });
}

function updateCanvasEl(data) {
  const domEl = document.querySelector(`.cert-el[data-elid="${data.id}"]`);
  if (!domEl) return;
  domEl.style.left = data.x + 'px'; domEl.style.top = data.y + 'px';
  if (data.type === 'image') {
    domEl.style.width = (data.width || 100) + 'px';
    domEl.style.height = (data.height || 100) + 'px';
    const img = domEl.querySelector('img');
    if (img) img.src = data.src;
  } else {
    domEl.style.fontSize = (data.fontSize || 16) + 'px'; domEl.style.color = data.color || '#333';
    domEl.style.fontFamily = data.fontFamily; domEl.style.fontWeight = data.fontWeight;
    domEl.style.fontStyle = data.fontStyle; domEl.style.textAlign = data.textAlign;
    if (data.width) domEl.style.width = data.width + 'px'; else domEl.style.width = '';
    domEl.textContent = data.content;
  }
}
