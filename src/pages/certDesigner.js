import { saveCertTemplate, getCertTemplate, generateId, uploadPptxTemplate } from '../store.js';
import { renderNavbar, showToast, escapeHtml, bindNavbar } from '../utils.js';
import { requireAdmin } from '../auth.js';
import { Icon, Btn, Field, Sel, Badge } from '../components.js';

let template = null;
let selectedId = null;
let previewObjectUrl = null;
let activeTab = 'pptx'; // 'pptx' or 'image'

export async function renderCertDesigner(app, params) {
  if (!requireAdmin()) return;

  if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }

  const id = params[0];
  if (id && id !== 'new') {
    template = await getCertTemplate(id);
    if (!template) { window.location.hash = '#/admin'; return; }
    activeTab = template.type === 'pptx' ? 'pptx' : 'image';
  } else {
    template = {
      id: generateId(),
      name: '',
      type: 'pptx',
      backgroundImage: '',
      pptxFile: null,
      pptxFilename: '',
      elements: [],
      createdAt: new Date().toISOString()
    };
    activeTab = 'pptx';
  }
  selectedId = null;
  renderPage(app);
}

function renderPage(app) {
  if (!template.elements) template.elements = [];
  const sel = selectedId ? template.elements.find(e => e.id === selectedId) : null;
  const hasImageUpload = !!template.backgroundImage || !!previewObjectUrl;
  const hasPptx = !!template.pptxFile || !!template.pptxFilename;

  const sampleValues = {
    '{{name}}': 'Rishit Singh Chhabra',
    '{{quiz_title}}': 'General Science Evaluation',
    '{{score}}': '20', '{{total}}': '20', '{{percent}}': '100%',
    '{{date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    '{{email}}': 'student@gyan.edu', '{{org}}': 'Class 10-A'
  };

  app.innerHTML = `
    ${renderNavbar()}
    <div class="page fade-in">
      <div class="container" style="max-width:1200px; padding-top:8px">

        <div class="page-head" style="display:flex; justify-content:space-between; align-items:flex-end; flex-wrap:wrap; gap:16px">
          <div>
            <a href="#/admin" class="btn btn-ghost btn-sm" style="margin-bottom:12px">${Icon('arrow-left', 14)}<span>Back to Dashboard</span></a>
            <div class="eyebrow">${Icon('layers', 14)}<span>Certificate Template</span></div>
            <h1 class="page-title" style="font-size:28px">${escapeHtml(template.name || 'Untitled Template')}</h1>
          </div>
          <div class="page-head-actions">
            ${Badge(template.type === 'pptx' ? 'PowerPoint' : 'Image overlay', { tone: 'blue' })}
          </div>
        </div>

        <!-- Tab Selector -->
        <div class="tabs" style="margin-bottom:24px">
          <button class="tab-btn ${activeTab === 'pptx' ? 'active' : ''}" id="tab-pptx">${Icon('file-text', 15)}<span>PPTX Template</span></button>
          <button class="tab-btn ${activeTab === 'image' ? 'active' : ''}" id="tab-image">${Icon('image', 15)}<span>Image + Text Overlay</span></button>
        </div>

        ${activeTab === 'pptx' ? renderPptxTab(hasPptx) : renderImageTab(sel, hasImageUpload, sampleValues)}

      </div>
    </div>
  `;

  if (activeTab === 'image' && hasImageUpload) {
    const bgImg = document.getElementById('cert-canvas-bg');
    if (bgImg) bgImg.src = previewObjectUrl || template.backgroundImage;
  }

  bindNavbar(app);
  bindEvents(app);
}

function renderPptxTab(hasPptx) {
  const placeholders = [
    ['{{name}}', 'Student Full Name'],
    ['{{quiz_title}}', 'Quiz / Assessment Title'],
    ['{{score}}', 'Earned Score Points'],
    ['{{total}}', 'Total Possible Points'],
    ['{{percent}}', 'Score Percentage'],
    ['{{date}}', 'Certificate Date'],
    ['{{email}}', 'Student Email'],
    ['{{org}}', 'Class / Institution']
  ];
  return `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; align-items:start">

      <div style="display:flex; flex-direction:column; gap:20px">
        <div class="card card-pad">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:14px">Template name</h3>
          ${Field({
            label: 'Name',
            htmlFor: 'tmpl-name',
            control: `<input type="text" class="input" id="tmpl-name" value="${escapeHtml(template.name)}" placeholder="e.g. Science Quiz Achievement Certificate">`
          })}
        </div>

        <div class="card card-pad">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:6px">Upload PowerPoint (.pptx)</h3>
          <p class="muted sm" style="margin-bottom:16px">Design in PowerPoint, Google Slides or Canva, type placeholder tags like <code>{{name}}</code>, export as .pptx and upload.</p>

          <div style="border:2px dashed ${hasPptx ? 'var(--green-border)' : 'var(--border-strong)'}; border-radius:var(--r-md); padding:32px 20px; text-align:center; background:${hasPptx ? 'var(--green-soft)' : 'var(--surface-subtle)'}; cursor:pointer; transition:all .15s var(--ease)" id="pptx-drop-zone">
            ${hasPptx ? `
              <div class="empty-icon" style="margin:0 auto 12px; background:var(--surface); color:var(--green)">${Icon('check-circle', 26)}</div>
              <div style="font-weight:700; color:var(--green); margin-bottom:4px">PPTX template uploaded</div>
              <div class="xs muted">${template.pptxFile ? escapeHtml(template.pptxFile.name) : escapeHtml(template.pptxFilename || 'Saved on server')}</div>
              <div class="xs text-3 mt" >Click to replace file</div>
            ` : `
              <div class="empty-icon" style="margin:0 auto 12px">${Icon('upload', 26)}</div>
              <div style="font-weight:600; margin-bottom:4px">Click to upload, or drag & drop here</div>
              <div class="xs muted">Max 20MB .pptx file</div>
            `}
            <input type="file" id="pptx-upload" accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation" style="display:none">
          </div>

          ${hasPptx ? `
            <button class="btn btn-danger-outline btn-sm" id="btn-remove-pptx" style="width:100%; margin-top:12px">${Icon('trash', 14)}<span>Remove Uploaded PPTX</span></button>
          ` : ''}
        </div>

        ${Btn('Save PPTX Certificate Template', { icon: 'save', size: 'lg', cls: 'btn-block', attrs: `id="btn-save-pptx" ${!hasPptx ? 'disabled' : ''}` })}
      </div>

      <div style="display:flex; flex-direction:column; gap:20px">
        <div class="card card-pad" style="background:var(--blue-soft); border-color:var(--blue-border)">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:12px; color:var(--blue-strong)">How PPTX certificates work</h3>
          <div class="info" style="background:var(--surface); border-color:var(--border)">
            ${Icon('info', 15)}<div style="display:flex; flex-direction:column; gap:6px; font-size:13.5px">
              <span><strong>1.</strong> Design your certificate in PowerPoint, Slides or Canva.</span>
              <span><strong>2.</strong> Type tags (e.g. <code>{{name}}</code>) in text boxes where info should appear.</span>
              <span><strong>3.</strong> Export as <strong>.pptx</strong> and upload here.</span>
              <span><strong>4.</strong> When a student passes, the system replaces tags with real values automatically.</span>
            </div>
          </div>
          <p class="xs muted" style="margin-top:12px">Keep each tag as one continuous string inside a single text box.</p>
        </div>

        <div class="card card-pad">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:4px">Placeholder tags</h3>
          <p class="muted sm" style="margin-bottom:14px">Type these exact tags in your design — they are replaced with live student data.</p>
          <div style="display:flex; flex-direction:column; gap:8px">
            ${placeholders.map(([code, desc]) => `
              <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; padding:8px 12px; background:var(--surface-subtle); border-radius:var(--r-sm)">
                <code style="font-size:13px; font-weight:700; color:var(--blue)">${code}</code>
                <span class="sm muted">${desc}</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderImageTab(sel, hasImageUpload, sampleValues) {
  return `
    <div style="display:grid; grid-template-columns:340px 1fr; gap:20px; align-items:start">

      <div style="display:flex; flex-direction:column; gap:20px">
        <div class="card card-pad">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:14px">Template name</h3>
          ${Field({ label: 'Name', htmlFor: 'tmpl-name', control: `<input type="text" class="input" id="tmpl-name" value="${escapeHtml(template.name)}" placeholder="e.g. Science Quiz Certificate">` })}
        </div>

        <div class="card card-pad">
          <h3 style="font-size:15px; font-weight:700; margin-bottom:6px">Upload background design</h3>
          <p class="muted sm" style="margin-bottom:14px">PNG, JPG or WebP. Text blocks overlay on top.</p>
          <div style="border:2px dashed ${hasImageUpload ? 'var(--green-border)' : 'var(--border-strong)'}; border-radius:var(--r-md); padding:24px 16px; text-align:center; background:${hasImageUpload ? 'var(--green-soft)' : 'var(--surface-subtle)'}; cursor:pointer" id="upload-drop-zone">
            ${hasImageUpload ? `
              <div style="font-weight:700; color:var(--green); font-size:14px; margin-bottom:4px">${Icon('check-circle', 16)} Background uploaded</div>
              <div class="xs muted">Click to replace</div>
            ` : `
              <div class="empty-icon" style="margin:0 auto 10px">${Icon('image', 22)}</div>
              <div style="font-weight:600; font-size:13.5px">Upload background image</div>
            `}
            <input type="file" id="cert-upload" accept="image/png,image/jpeg,image/webp" style="display:none">
          </div>
          ${hasImageUpload ? `<button class="btn btn-danger-outline btn-sm" id="btn-remove-upload" style="width:100%; margin-top:10px">${Icon('trash', 14)}<span>Remove Background</span></button>` : ''}
        </div>

        <div class="card card-pad">
          <div class="flex justify-between items-center" style="margin-bottom:12px">
            <h3 style="font-size:15px; font-weight:700">Text blocks</h3>
            <button class="btn btn-secondary btn-sm" id="btn-add-text">${Icon('plus', 14)}<span>Add</span></button>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; max-height:200px; overflow-y:auto">
            ${template.elements.length > 0 ? template.elements.map(e => `
              <div class="q-item layer-item" data-elid="${e.id}" role="button" tabindex="0" style="${e.id === selectedId ? 'background:var(--blue-soft)' : ''}">
                <span class="q-index">${Icon('file-text', 12)}</span>
                <span class="q-item-copy">
                  <span class="q-item-text">${escapeHtml(e.content)}</span>
                  <span class="q-item-meta">(${e.x}, ${e.y}) · ${e.fontSize || 16}px</span>
                </span>
              </div>
            `).join('') : '<p class="xs muted" style="text-align:center; padding:8px">No text blocks yet. Click “Add” to place one on the canvas.</p>'}
          </div>
        </div>

        ${sel ? `
          <div class="card card-pad" style="border-color:var(--blue)">
            <div class="flex justify-between items-center" style="margin-bottom:14px">
              <h3 style="font-size:13px; font-weight:700; color:var(--blue-strong); text-transform:uppercase; letter-spacing:0.02em">Edit text block</h3>
              <button class="icon-btn icon-btn-secondary icon-btn-danger del-el" data-elid="${sel.id}" aria-label="Delete text block">${Icon('trash', 15)}</button>
            </div>
            ${Field({ label: 'Content', htmlFor: 'prop-content', control: `<input type="text" class="input" id="prop-content" value="${escapeHtml(sel.content)}" style="font-size:14px">` })}
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
              ${Field({ label: 'Font size', htmlFor: 'prop-fs', control: `<input type="number" class="input" id="prop-fs" value="${sel.fontSize || 16}" style="font-size:14px">` })}
              ${Field({ label: 'Color', htmlFor: 'prop-color', control: `<input type="color" class="input" id="prop-color" value="${sel.color || '#333333'}" style="height:48px; padding:4px">` })}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
              ${Field({ label: 'Font', htmlFor: 'prop-font', control: Sel({ id: 'prop-font', value: sel.fontFamily || "'Playfair Display',serif", options: [
                { value: "'Playfair Display',serif", label: 'Playfair Display' },
                { value: "'Great Vibes',cursive", label: 'Great Vibes' },
                { value: "'Outfit',sans-serif", label: 'Outfit' },
                { value: "'Inter',sans-serif", label: 'Inter' }
              ] }) })}
              ${Field({ label: 'Align', htmlFor: 'prop-align', control: Sel({ id: 'prop-align', value: sel.textAlign || 'center', options: ['center', 'left', 'right'] }) })}
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px">
              ${Field({ label: 'X', control: `<input type="number" class="input" id="prop-x" value="${sel.x}" style="font-size:14px">` })}
              ${Field({ label: 'Y', control: `<input type="number" class="input" id="prop-y" value="${sel.y}" style="font-size:14px">` })}
              ${Field({ label: 'Width', control: `<input type="number" class="input" id="prop-w" value="${sel.width || 800}" style="font-size:14px">` })}
            </div>
            <div class="info" style="margin-top:12px">${Icon('edit', 15)}<span>Drag the block on the canvas to reposition.</span></div>
          </div>
        ` : `
          <div class="card" style="padding:16px; text-align:center">
            <span class="xs muted">Select a text block on the canvas to edit it.</span>
          </div>
        `}

        ${Btn('Save Image Template', { icon: 'save', tone: 'primary', cls: 'btn-block', attrs: 'id="btn-save"' })}
      </div>

      <div class="card card-pad">
        <div class="flex justify-between items-center" style="margin-bottom:16px">
          <h3 style="font-size:15px; font-weight:700">Live canvas preview</h3>
          <button class="btn btn-secondary btn-sm" id="btn-add-placeholder">${Icon('plus', 14)}<span>Add Text Block</span></button>
        </div>
        <div style="overflow:auto; display:flex; justify-content:center; background:var(--surface-subtle); padding:24px; border-radius:var(--r-lg)">
          <div id="cert-canvas" style="width:900px; min-width:760px; height:636px; position:relative; background:${template.backgroundColor || '#fffdf7'}; border:${template.borderWidth || 8}px ${template.borderStyle || 'double'} ${template.borderColor || '#c8a96e'}; box-shadow:var(--shadow-lg); text-align:left; user-select:none; overflow:hidden; flex:none">
            <img id="cert-canvas-bg" style="position:absolute; left:0; top:0; width:100%; height:100%; object-fit:cover; pointer-events:none; ${hasImageUpload ? '' : 'display:none'}">
            ${template.elements.map(e => {
              const isSel = e.id === selectedId;
              let txt = e.content || '';
              for (const [k, v] of Object.entries(sampleValues)) txt = txt.replaceAll(k, v);
              return `
                <div class="cert-el ${isSel ? 'selected' : ''}" data-elid="${e.id}"
                  style="position:absolute; left:${e.x}px; top:${e.y}px; font-size:${e.fontSize || 16}px; color:${e.color || '#333'}; font-family:${e.fontFamily || "'Playfair Display',serif"}; font-weight:${e.fontWeight || 'normal'}; text-align:${e.textAlign || 'center'}; ${e.width ? `width:${e.width}px;` : ''} white-space:pre-wrap; line-height:1.4; cursor:move; outline:${isSel ? '2px solid var(--blue)' : '1px dashed transparent'}; padding:2px">
                  ${escapeHtml(txt)}
                </div>
              `;
            }).join('')}
          </div>
        </div>
        <p class="xs muted" style="margin-top:12px; text-align:center">Drag text blocks to position them. Type {{name}}, {{quiz_title}}, {{score}} etc. for dynamic values.</p>
      </div>

    </div>
  `;
}

function bindEvents(app) {
  app.querySelector('#tab-pptx')?.addEventListener('click', () => { activeTab = 'pptx'; template.type = 'pptx'; renderPage(app); });
  app.querySelector('#tab-image')?.addEventListener('click', () => {
    activeTab = 'image';
    template.type = 'image';
    if (!template.elements || template.elements.length === 0) {
      template.elements = [
        { id: generateId(), type: 'text', content: '{{quiz_title}}', x: 50, y: 165, fontSize: 24, color: '#1e293b', fontFamily: "'Playfair Display',serif", fontWeight: '700', textAlign: 'center', width: 800 },
        { id: generateId(), type: 'text', content: '{{name}}', x: 50, y: 255, fontSize: 36, color: '#d97706', fontFamily: "'Great Vibes',cursive", fontWeight: '700', textAlign: 'center', width: 800 },
        { id: generateId(), type: 'text', content: 'Score: {{score}}/{{total}} ({{percent}})', x: 50, y: 330, fontSize: 14, color: '#475569', fontFamily: "'Outfit',sans-serif", fontWeight: '400', textAlign: 'center', width: 800 },
        { id: generateId(), type: 'text', content: 'Date: {{date}}', x: 100, y: 460, fontSize: 13, color: '#64748b', fontFamily: "'Outfit',sans-serif", fontWeight: '500', textAlign: 'center', width: 250 }
      ];
    }
    renderPage(app);
  });

  if (activeTab === 'pptx') {
    bindPptxEvents(app);
  } else {
    bindImageEvents(app);
  }
}

function bindPptxEvents(app) {
  const dropZone = app.querySelector('#pptx-drop-zone');
  const fileInput = app.querySelector('#pptx-upload');

  dropZone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) handlePptxFile(file, app);
  });
  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--blue)'; });
  dropZone?.addEventListener('dragleave', () => { dropZone.style.borderColor = ''; });
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.style.borderColor = '';
    const file = e.dataTransfer?.files[0];
    if (file) handlePptxFile(file, app);
  });

  app.querySelector('#btn-remove-pptx')?.addEventListener('click', () => {
    template.pptxFile = null;
    template.pptxFilename = '';
    showToast('PPTX file removed');
    renderPage(app);
  });

  app.querySelector('#btn-save-pptx')?.addEventListener('click', async () => {
    const name = app.querySelector('#tmpl-name')?.value?.trim();
    if (!name) { showToast('Please enter a template name', 'error'); return; }
    if (!template.pptxFile && !template.pptxFilename) { showToast('Please upload a PPTX file first', 'error'); return; }

    const btn = app.querySelector('#btn-save-pptx');
    btn.disabled = true;
    btn.innerHTML = '<span class="icon-spin"></span>Uploading & saving…';

    try {
      if (template.pptxFile) {
        await uploadPptxTemplate(template.pptxFile, name, template.id);
      } else {
        template.name = name;
        await saveCertTemplate(template);
      }
      showToast('PPTX certificate template saved');
      window.location.hash = '#/admin';
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save: ' + (err.message || 'Server error'), 'error');
      btn.disabled = false;
      btn.textContent = 'Save PPTX Template';
    }
  });
}

function bindImageEvents(app) {
  const dropZone = app.querySelector('#upload-drop-zone');
  const fileInput = app.querySelector('#cert-upload');

  dropZone?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', e => { const file = e.target.files[0]; if (file) handleImageFile(file, app); });
  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.style.borderColor = 'var(--blue)'; });
  dropZone?.addEventListener('drop', e => { e.preventDefault(); const file = e.dataTransfer?.files[0]; if (file) handleImageFile(file, app); });

  app.querySelector('#btn-remove-upload')?.addEventListener('click', () => {
    template.backgroundImage = '';
    if (previewObjectUrl) { URL.revokeObjectURL(previewObjectUrl); previewObjectUrl = null; }
    showToast('Background image removed');
    renderPage(app);
  });

  // Element selection (both canvas and layer list)
  app.querySelectorAll('.cert-el, .layer-item').forEach(el => {
    el.addEventListener('click', e => { e.stopPropagation(); selectedId = el.dataset.elid; renderPage(app); });
  });
  app.querySelector('#cert-canvas')?.addEventListener('click', () => { selectedId = null; renderPage(app); });

  const sel = selectedId ? template.elements.find(e => e.id === selectedId) : null;
  if (sel) {
    app.querySelector('#prop-content')?.addEventListener('input', e => { sel.content = e.target.value; updateCanvasEl(sel); });
    app.querySelector('#prop-fs')?.addEventListener('input', e => { sel.fontSize = parseInt(e.target.value) || 16; updateCanvasEl(sel); });
    app.querySelector('#prop-color')?.addEventListener('input', e => { sel.color = e.target.value; updateCanvasEl(sel); });
    app.querySelector('#prop-font')?.addEventListener('change', e => { sel.fontFamily = e.target.value; updateCanvasEl(sel); });
    app.querySelector('#prop-align')?.addEventListener('change', e => { sel.textAlign = e.target.value; updateCanvasEl(sel); });
    app.querySelector('#prop-x')?.addEventListener('input', e => { sel.x = parseInt(e.target.value) || 0; updateCanvasEl(sel); });
    app.querySelector('#prop-y')?.addEventListener('input', e => { sel.y = parseInt(e.target.value) || 0; updateCanvasEl(sel); });
    app.querySelector('#prop-w')?.addEventListener('input', e => { sel.width = parseInt(e.target.value) || 800; updateCanvasEl(sel); });

    const selDom = app.querySelector(`.cert-el[data-elid="${selectedId}"]`);
    if (selDom) {
      let dragging = false, dragStart = { x: 0, y: 0 }, elStart = { x: 0, y: 0 };
      selDom.addEventListener('mousedown', e => { e.stopPropagation(); dragging = true; dragStart = { x: e.clientX, y: e.clientY }; elStart = { x: sel.x, y: sel.y }; });
      window.addEventListener('mousemove', e => {
        if (!dragging) return;
        sel.x = Math.max(0, Math.min(850, elStart.x + e.clientX - dragStart.x));
        sel.y = Math.max(0, Math.min(600, elStart.y + e.clientY - dragStart.y));
        updateCanvasEl(sel);
        const ix = app.querySelector('#prop-x'); const iy = app.querySelector('#prop-y');
        if (ix) ix.value = sel.x; if (iy) iy.value = sel.y;
      });
      window.addEventListener('mouseup', () => { dragging = false; });
    }
  }

  // Delete element
  app.querySelectorAll('.del-el').forEach(btn => {
    btn.addEventListener('click', e => { e.stopPropagation(); template.elements = template.elements.filter(x => x.id !== btn.dataset.elid); if (selectedId === btn.dataset.elid) selectedId = null; renderPage(app); });
  });

  // Add text block
  const addHandler = () => {
    const newEl = { id: generateId(), type: 'text', content: '{{name}}', x: 50, y: 250, fontSize: 32, color: '#0284c7', fontFamily: "'Great Vibes',cursive", fontWeight: '700', textAlign: 'center', width: 800 };
    template.elements.push(newEl);
    selectedId = newEl.id;
    renderPage(app);
  };
  app.querySelector('#btn-add-placeholder')?.addEventListener('click', addHandler);
  app.querySelector('#btn-add-text')?.addEventListener('click', addHandler);

  // Save image template
  app.querySelector('#btn-save')?.addEventListener('click', async () => {
    const name = app.querySelector('#tmpl-name')?.value?.trim();
    if (!name) { showToast('Please enter a template name', 'error'); return; }
    template.name = name;
    template.type = 'image';
    const btn = app.querySelector('#btn-save');
    btn.disabled = true; btn.innerHTML = '<span class="icon-spin">…</span>Saving…';
    try {
      await saveCertTemplate(template);
      showToast('Certificate template saved');
      window.location.hash = '#/admin';
    } catch (err) {
      console.error(err);
      showToast('Save failed: ' + (err.message || 'Error'), 'error');
      btn.disabled = false; btn.textContent = 'Save Image Template';
    }
  });
}

function updateCanvasEl(data) {
  const domEl = document.querySelector(`.cert-el[data-elid="${data.id}"]`);
  if (!domEl) return;
  domEl.style.left = data.x + 'px';
  domEl.style.top = data.y + 'px';
  domEl.style.fontSize = (data.fontSize || 16) + 'px';
  domEl.style.color = data.color || '#333';
  domEl.style.fontFamily = data.fontFamily || "'Playfair Display',serif";
  domEl.style.textAlign = data.textAlign || 'center';
  if (data.width) domEl.style.width = data.width + 'px';
}

function handlePptxFile(file, app) {
  if (file.size > 20 * 1024 * 1024) { showToast('File too large (Max 20MB)', 'error'); return; }
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext !== 'pptx') { showToast('Please upload a .pptx file', 'error'); return; }
  template.pptxFile = file;
  showToast('PPTX file selected');
  renderPage(app);
}

function handleImageFile(file, app) {
  if (file.size > 10 * 1024 * 1024) { showToast('File too large (Max 10MB)', 'error'); return; }
  if (!file.type.startsWith('image/')) { showToast('Upload a valid image file', 'error'); return; }
  if (previewObjectUrl) URL.revokeObjectURL(previewObjectUrl);
  previewObjectUrl = URL.createObjectURL(file);
  const reader = new FileReader();
  reader.onload = evt => { template.backgroundImage = evt.target.result; showToast('Background uploaded'); renderPage(app); };
  reader.readAsDataURL(file);
}