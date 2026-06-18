/* Śrīyantra Certified Plane Atlas — viewer logic.
 *
 * PRINCIPLE: the client performs NO geometry. Every coordinate drawn here comes
 * verbatim from the bundle the build script produced from the frozen engine.
 * This file only positions SVG elements at numbers it is given.
 *
 * DATA: fetches bundle/manifest.json and bundle/figures/<id>.json on demand.
 * If served without a bundle (e.g. the embedded preview), it falls back to
 * window.__SAMPLE_BUNDLE__ = { manifest, figures: { "<id>": <figureJSON> } }.
 */
(function () {
  'use strict';

  var SAMPLE = window.__SAMPLE_BUNDLE__ || null;
  var BASE = 'bundle';
  var VIEWER_URL = ''; // set to your deployed URL; falls back to the current page
  var app = document.getElementById('app');
  var manifest = null;
  var figCache = {};

  /* Rao's twenty plane constraints. Formulas transcribed verbatim from the frozen
   * engine (plane_chain.py, cons_full); descriptions and equation numbers from
   * Rao (1998) §3 (eqs 3.1-3.20). Reference data, not per-figure data: which
   * constraints apply to a given figure comes from its source_subsets (engine). */
  var CONSTRAINTS = {
    1:  { f: 'x\u2081\u2081 \u2212 x\u2081\u2081\u2090', short: 'concurrency at point 11', eq: '3.1',
          desc: 'Concurrency at point 11 \u2014 the two constructed locations of point 11 coincide (the essential concurrency condition of the figure).' },
    2:  { f: 'd \u2212 U\u2087 \u2212 r_T', short: 'concentricity', eq: '3.2',
          desc: 'Concentricity \u2014 the inscribed circle of the innermost triangle shares the centre of the circumscribing circle.' },
    3:  { f: '3\u00b7x\u2081\u2080\u00b2 \u2212 V\u2088\u00b2', short: 'P8 triangle equilateral', eq: '3.3',
          desc: 'The root triangle with vertex at P8 is equilateral.' },
    4:  { f: '3\u00b7x\u2081\u2083\u00b2 \u2212 (c+d+v\u2089\u2212v\u2081\u2082)\u00b2', short: 'P2 triangle equilateral', eq: '3.4',
          desc: 'The root triangle with vertex at P2 is equilateral.' },
    5:  { f: 'x\u2081\u2080 \u2212 x\u2081\u2083', short: 'equal base arcs 13 / 10', eq: '3.5',
          desc: 'Base arcs P6\u00b713 and P4\u00b710 are equal.' },
    6:  { f: '3\u00b7x\u2087\u00b2 \u2212 V\u2087\u00b2', short: 'P4 triangle equilateral', eq: '3.6',
          desc: 'The innermost secondary triangle with vertex at P4 is equilateral.' },
    7:  { f: 'x\u2081\u2088 \u2212 x\u2081\u2089', short: 'equal base arcs 18 / 19', eq: '3.7',
          desc: 'Base arcs P8\u00b718 and P2\u00b719 are equal.' },
    8:  { f: 'r \u2212 r\u2081\u2086', short: 'point 16 on circle', eq: '3.8',
          desc: 'Point 16 lies on the circumscribing circle.' },
    9:  { f: 'r \u2212 r\u2081\u2087', short: 'point 17 on circle', eq: '3.9',
          desc: 'Point 17 lies on the circumscribing circle.' },
    10: { f: 'b + c \u2212 d \u2212 2g \u2212 v\u2088', short: 'equal intercepts P1P4 / P4P8', eq: '3.10',
          desc: 'Intercepts P1\u00b7P4 and P4\u00b7P8 are equal.' },
    11: { f: 'c + d + v\u2089 \u2212 2\u00b7v\u2081\u2082 \u2212 e', short: 'equal intercepts P9P6 / P6P2', eq: '3.11',
          desc: 'Intercepts P9\u00b7P6 and P6\u00b7P2 are equal.' },
    12: { f: 'x\u2081\u2086 \u2212 x\u2081\u2087', short: 'equal base arcs 16 / 17', eq: '3.12',
          desc: 'Base arcs P9\u00b716 and P1\u00b717 are equal.' },
    13: { f: 'U\u2087 \u2212 (U\u2082\u2080\u2212v\u2088+v\u2081\u2082)/2', short: 'inner concurrency (P5)', eq: '3.13',
          desc: 'Inner concurrency \u2014 P5 is the midpoint of arc P6\u00b7P20 (point 20 = P8\u219210 \u2229 P2\u219213).' },
    14: { f: 'v\u2081\u2082 \u2212 (U\u2082\u2081\u2212e)/2', short: 'inner concurrency (P6)', eq: '3.14',
          desc: 'Inner concurrency \u2014 P6 is the midpoint of arc P7\u00b7P21 (point 21 = P1\u219218 \u2229 P9\u219219).' },
    15: { f: 'g + (d+e\u2212c\u2212U\u2082\u2081)/2', short: 'inner concurrency (P4)', eq: '3.15',
          desc: 'Inner concurrency \u2014 P4 is the midpoint of arc P3\u00b7P21.' },
    16: { f: 'r\u2081\u2086 \u2212 r\u2081\u2087', short: 'points 16, 17 equidistant', eq: '3.16',
          desc: 'Points 16 and 17 are equidistant from the centre.' },
    17: { f: 'r\u2081\u2088 \u2212 r\u2081\u2089', short: 'points 18, 19 equidistant', eq: '3.17',
          desc: 'Points 18 and 19 are equidistant from the centre.' },
    18: { f: 'r\u2081\u2086 \u2212 r\u2081\u2088', short: 'points 16, 18 equidistant', eq: '3.18',
          desc: 'Points 16 and 18 are equidistant from the centre.' },
    19: { f: 'r\u2081\u2087 \u2212 r\u2081\u2089', short: 'points 17, 19 equidistant', eq: '3.19',
          desc: 'Points 17 and 19 are equidistant from the centre.' },
    20: { f: 'c \u2212 d', short: 'symmetry (c = d)', eq: '3.20',
          desc: 'The outermost root triangles with vertices at P0 and P10 are identical \u2014 the up\u2013down symmetry constraint.' }
  };

  /* ----- data layer ----- */
  function getManifest() {
    if (SAMPLE) return Promise.resolve(SAMPLE.manifest);
    return fetch(BASE + '/manifest.json').then(function (r) {
      if (!r.ok) throw new Error('manifest ' + r.status);
      return r.json();
    });
  }
  function getFigure(id) {
    if (figCache[id]) return Promise.resolve(figCache[id]);
    if (SAMPLE) {
      var f = SAMPLE.figures[id];
      if (!f) return Promise.reject(new Error('figure ' + id + ' not in preview'));
      figCache[id] = f; return Promise.resolve(f);
    }
    return fetch(BASE + '/figures/' + id + '.json').then(function (r) {
      if (!r.ok) throw new Error('figure ' + id + ' ' + r.status);
      return r.json();
    }).then(function (f) { figCache[id] = f; return f; });
  }

  /* ----- figure drawing (precomputed coordinates only) ----- */
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(name, attrs) {
    var e = document.createElementNS(SVGNS, name);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  // Build an <svg>. opts: {mini, labels, base, axis, draw}
  function drawFigure(fig, opts) {
    opts = opts || {};
    var pad = 1.1;
    var svg = svgEl('svg', {
      viewBox: [-pad, -pad, 2 * pad, 2 * pad].join(' '),
      xmlns: SVGNS, 'data-figure-id': fig.id
    });
    // shapes layer flipped (math y up -> screen y down)
    var g = svgEl('g', { transform: 'scale(1,-1)' });
    var c = fig.circumcircle;
    g.appendChild(svgEl('circle', { class: 'fig-circle', cx: c.cx, cy: c.cy, r: c.r }));
    if (opts.axis) g.appendChild(svgEl('line', { class: 'fig-axis', x1: 0, y1: -c.r, x2: 0, y2: c.r }));
    fig.triangles.forEach(function (t) {
      var pts = t.polygon.map(function (p) { return p[0] + ',' + p[1]; }).join(' ');
      g.appendChild(svgEl('polygon', { class: 'fig-tri ' + t.kind, points: pts }));
    });
    if (!opts.mini) {
      ['20', '21'].forEach(function (k) {
        var p = fig.inner_feet[k];
        g.appendChild(svgEl('circle', { class: 'fig-foot', cx: p[0], cy: p[1], r: 0.013 }));
        g.appendChild(svgEl('circle', { class: 'fig-foot', cx: -p[0], cy: p[1], r: 0.013 }));
      });
      g.appendChild(svgEl('circle', { class: 'fig-bindu', cx: 0, cy: 0, r: 0.017 }));
      if (opts.base) {
        Object.keys(fig.points).forEach(function (lbl) {
          if (lbl[0] === 'P' && lbl.length <= 3) {
            var p = fig.points[lbl];
            g.appendChild(svgEl('circle', { class: 'fig-base', cx: p[0], cy: p[1], r: 0.01 }));
          }
        });
      }
    }
    svg.appendChild(g);
    // labels layer (unflipped so text is upright)
    if (opts.labels) {
      var gl = svgEl('g', {});
      Object.keys(fig.points).forEach(function (lbl) {
        var p = fig.points[lbl];
        g.appendChild(svgEl('circle', { class: 'fig-pt', cx: p[0], cy: p[1], r: 0.007 }));
        var t = svgEl('text', { class: 'fig-label', x: p[0] + 0.018, y: -p[1] - 0.012, 'font-size': 0.05 });
        t.textContent = lbl;
        gl.appendChild(t);
      });
      svg.appendChild(gl);
    }
    return svg;
  }

  /* ----- pan & zoom on a detail svg (viewBox math; strokes stay crisp) ----- */
  function attachPanZoom(svg) {
    var vb = svg.getAttribute('viewBox').split(' ').map(Number); // x y w h
    var drag = null;
    function apply() { svg.setAttribute('viewBox', vb.join(' ')); }
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var rect = svg.getBoundingClientRect();
      var mx = vb[0] + (e.clientX - rect.left) / rect.width * vb[2];
      var my = vb[1] + (e.clientY - rect.top) / rect.height * vb[3];
      var f = e.deltaY < 0 ? 0.88 : 1.137;
      f = Math.min(Math.max(f, 0.2 / vb[2] * vb[2]), 5); // clamp lightly
      var nw = vb[2] * f, nh = vb[3] * f;
      if (nw > 6 || nw < 0.12) return;
      vb[0] = mx - (mx - vb[0]) * f; vb[1] = my - (my - vb[1]) * f;
      vb[2] = nw; vb[3] = nh; apply();
    }, { passive: false });
    svg.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY }; svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var rect = svg.getBoundingClientRect();
      vb[0] -= (e.clientX - drag.x) / rect.width * vb[2];
      vb[1] -= (e.clientY - drag.y) / rect.height * vb[3];
      drag.x = e.clientX; drag.y = e.clientY; apply();
    });
    svg.addEventListener('pointerup', function () { drag = null; });
    svg.addEventListener('dblclick', function () {
      vb = [-1.1, -1.1, 2.2, 2.2]; apply();
    });
  }

  /* ----- export ----- */
  function download(name, blob) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function figURL(fig) { return (VIEWER_URL || location.href.split('#')[0]) + '#/fig/' + fig.id; }
  function provObject(fig) {
    return {
      figure: fig.id,
      engineCommit: fig.provenance.engine_commit,
      datasetDOI: fig.provenance.dataset_doi,
      gateResidual: fig.gate.worst_residual,
      gateTol: fig.gate.tol,
      root: fig.root,
      sourceSubsets: fig.provenance.source_subsets,
      viewer: figURL(fig)
    };
  }

  // Standalone, correctly-scaled SVG string. The displayed SVG keeps strokes crisp
  // with vector-effect:non-scaling-stroke, a rule that does NOT travel in the file,
  // so here strokes use real user-unit widths (viewBox is 2.2 units wide). Provenance
  // is embedded in <title>/<desc>/<metadata> — never drawn on the image. An optional
  // caption (off by default) adds one labeled line in a band beneath the figure.
  function serialize(svg, px, fig, caption) {
    var vbW = 2.2, vbH = caption ? 2.46 : 2.2;
    var clone = svg.cloneNode(true);
    clone.setAttribute('viewBox', '-1.1 -1.1 ' + vbW + ' ' + vbH);
    clone.setAttribute('width', px);
    clone.setAttribute('height', Math.round(px * vbH / vbW));
    clone.setAttribute('xmlns', SVGNS);
    var css =
      '.fig-circle{fill:none;stroke:#dcdad2;stroke-width:.004}' +
      '.fig-axis{fill:none;stroke:#e4e2da;stroke-width:.0035;stroke-dasharray:.02 .02}' +
      '.fig-tri{fill:none;stroke-width:.006;stroke-linejoin:round}' +
      '.fig-tri.sakti{stroke:#b23a48}.fig-tri.siva{stroke:#2e4374}' +
      '.fig-foot{fill:#9a7838}.fig-bindu{fill:#16181d}.fig-base{fill:#8b8d87}.fig-pt{fill:#4c4f57}';
    var style = document.createElementNS(SVGNS, 'style');
    style.textContent = css;
    Array.prototype.forEach.call(clone.querySelectorAll('.fig-label'), function (t) {
      t.setAttribute('font-size', '0.05');
      t.setAttribute('font-family', 'monospace');
      t.setAttribute('fill', '#4c4f57');
    });
    // embedded provenance (no visible mark)
    var p = fig.root;
    var title = document.createElementNS(SVGNS, 'title');
    title.textContent = 'Plane \u015Ar\u012B Yantra \u2014 plate ' + fig.id;
    var desc = document.createElementNS(SVGNS, 'desc');
    desc.textContent = 'Certified figure from Rao (1998) plane constraint system. Root b,c,d,e,g = ' +
      [p.b, p.c, p.d, p.e, p.g].map(function (v) { return (+v).toFixed(6); }).join(', ') +
      '. Engine commit ' + fig.provenance.engine_commit + '; dataset DOI ' + fig.provenance.dataset_doi +
      '; gate residual ' + Number(fig.gate.worst_residual).toExponential(2) +
      ' (tol ' + Number(fig.gate.tol).toExponential(0) + ').';
    var meta = document.createElementNS(SVGNS, 'metadata');
    meta.textContent = JSON.stringify(provObject(fig));
    clone.insertBefore(style, clone.firstChild);
    clone.insertBefore(meta, clone.firstChild);
    clone.insertBefore(desc, clone.firstChild);
    clone.insertBefore(title, clone.firstChild);
    if (caption) {
      var cap = document.createElementNS(SVGNS, 'text');
      cap.setAttribute('x', '0'); cap.setAttribute('y', '1.27');
      cap.setAttribute('text-anchor', 'middle');
      cap.setAttribute('font-family', "Georgia, 'Times New Roman', serif");
      cap.setAttribute('font-size', '0.052'); cap.setAttribute('fill', '#4c4f57');
      cap.textContent = 'Rao plane \u015Ar\u012B Yantra \u00b7 plate ' + fig.id +
        ' \u00b7 DOI ' + fig.provenance.dataset_doi;
      clone.appendChild(cap);
    }
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      new XMLSerializer().serializeToString(clone);
  }

  function exportSVG(fig, svg, caption) {
    download('sriyantra-' + fig.id + '.svg',
      new Blob([serialize(svg, 900, fig, caption)], { type: 'image/svg+xml' }));
  }

  /* PNG provenance is written as tEXt chunks (Latin-1) inserted after IHDR. */
  function crc32(bytes) {
    var t = crc32.t;
    if (!t) {
      t = crc32.t = new Uint32Array(256);
      for (var n = 0; n < 256; n++) {
        var c = n;
        for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c >>> 0;
      }
    }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) crc = t[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function textChunk(keyword, text) {
    var body = keyword + '\0' + text;
    var data = new Uint8Array(body.length);
    for (var i = 0; i < body.length; i++) data[i] = body.charCodeAt(i) & 0xFF;
    var td = new Uint8Array(4 + data.length);
    td[0] = 0x74; td[1] = 0x45; td[2] = 0x58; td[3] = 0x74; // 'tEXt'
    td.set(data, 4);
    var crc = crc32(td);
    var chunk = new Uint8Array(4 + td.length + 4), len = data.length;
    chunk[0] = (len >>> 24) & 255; chunk[1] = (len >>> 16) & 255; chunk[2] = (len >>> 8) & 255; chunk[3] = len & 255;
    chunk.set(td, 4);
    var q = 4 + td.length;
    chunk[q] = (crc >>> 24) & 255; chunk[q + 1] = (crc >>> 16) & 255; chunk[q + 2] = (crc >>> 8) & 255; chunk[q + 3] = crc & 255;
    return chunk;
  }
  function pngWithText(buf, pairs) {
    var src = new Uint8Array(buf), at = 33; // 8-byte sig + 25-byte IHDR (data always 13)
    var chunks = pairs.map(function (kv) { return textChunk(kv[0], kv[1]); });
    var extra = chunks.reduce(function (s, c) { return s + c.length; }, 0);
    var out = new Uint8Array(src.length + extra);
    out.set(src.subarray(0, at), 0);
    var off = at;
    chunks.forEach(function (c) { out.set(c, off); off += c.length; });
    out.set(src.subarray(at), off);
    return out;
  }
  function ascii(s) { return String(s).replace(/[^\x20-\x7E]/g, '-'); }
  function pngPairs(fig) {
    return [
      ['Title', ascii('Sri Yantra - plate ' + fig.id)],
      ['Software', 'Sri Yantra Certified Plane Atlas'],
      ['Source', 'doi:' + fig.provenance.dataset_doi],
      ['Provenance', ascii(JSON.stringify(provObject(fig)))]
    ];
  }

  function exportPNG(fig, svg, caption) {
    var W = 2000, vbH = caption ? 2.46 : 2.2, H = Math.round(W * vbH / 2.2);
    var blob = new Blob([serialize(svg, W, fig, caption)], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(blob);
    var img = new Image();
    img.onload = function () {
      var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var ctx = cv.getContext('2d'); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, 0, 0, W, H); URL.revokeObjectURL(url);
      cv.toBlob(function (b) {
        b.arrayBuffer().then(function (ab) {
          download('sriyantra-' + fig.id + '.png',
            new Blob([pngWithText(ab, pngPairs(fig))], { type: 'image/png' }));
        });
      }, 'image/png');
    };
    img.onerror = function () { URL.revokeObjectURL(url); };
    img.src = url;
  }

  /* ----- views ----- */
  function el(html) { var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  function renderMasthead() {
    var c = manifest.counts, p = manifest.provenance;
    var doi = p.dataset_doi;
    return '' +
      '<header class="masthead"><div class="wrap">' +
      '<p class="eyebrow">Rao (1998) · plane form · certified enumeration</p>' +
      '<h1 class="title">A certified atlas of the <em>plane Śrī Yantra</em></h1>' +
      '<p class="lede">Every figure here is the exact output of a frozen constraint engine, ' +
      'regenerated and re-checked vertex by vertex to machine precision before it was drawn. ' +
      'The viewer displays what was certified; it computes nothing itself.</p>' +
      '<div class="metarow">' +
      '<span class="count"><b>' + c.distinct_roots + '</b> distinct configurations</span>' +
      '<span>' + c.feasible_certified_roots + ' feasible certified roots</span>' +
      '<span>gate ≤ <span style="color:var(--ink)">' + fmtTol(p.gate_tolerance) + '</span></span>' +
      '<span>engine <span style="color:var(--ink)">' + p.engine_commit + '</span></span>' +
      '</div>' +
      '<p class="tau"><b>On the count.</b> ' + escapeHtml(manifest.tau_metric_note) + '</p>' +
      '</div></header>';
  }

  function fmtTol(t) { return Number(t).toExponential(0).replace('e+0', 'e').replace('e-', 'e\u2212'); }
  function fmtResid(r) { return r == null ? '—' : Number(r).toExponential(2).replace('e-', 'e\u2212').replace('e+', 'e+'); }
  function escapeHtml(s) { return String(s).replace(/[&<>]/g, function (m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[m]; }); }

  function renderFooter() {
    var p = manifest.provenance, doi = p.dataset_doi;
    return '<footer><div class="wrap">' +
      '<p class="cite">Data: Rao plane Śrī Yantra census · DOI ' +
      '<a class="brass" href="https://doi.org/' + doi + '">' + doi + '</a> · engine ' + p.engine_commit + '</p>' +
      '<p>Open data. The figures are the certified output of the enumeration; this viewer is a ' +
      'presentation layer and performs no geometry. Each figure carries its own gate report and provenance.</p>' +
      '</div></footer>';
  }

  function cItem(n, on) {
    var c = CONSTRAINTS[n];
    return '<div class="citem' + (on ? ' on' : '') + '">' +
      '<span class="cnum">F' + n + '</span>' +
      '<span class="cform">' + c.f + '</span>' +
      '<span class="cdesc">' + escapeHtml(c.desc) + ' <em>(' + c.eq + ')</em></span></div>';
  }

  function constraintsPanel(fig) {
    var subs = fig.provenance.source_subsets;
    var applic = {};
    subs.forEach(function (s) { s.forEach(function (n) { applic[n] = true; }); });
    var nums = Object.keys(applic).map(Number).sort(function (a, b) { return a - b; });
    var chips = subs.map(function (s) { return '<span class="chip">{' + s.join(',') + '}</span>'; }).join(' ');
    var here = nums.map(function (n) { return cItem(n, true); }).join('');
    var all = ''; for (var i = 1; i <= 20; i++) all += cItem(i, !!applic[i]);
    return '<details class="panel"><summary>Constraints</summary>' +
      '<p class="panel-intro">The five basic variables <em>b, c, d, e, g</em> set the base-line ' +
      'spacings along the axis. A configuration is the solution that satisfies one five-constraint ' +
      'subset drawn from Rao\u2019s twenty conditions. This plate is produced by ' +
      (subs.length > 1 ? subs.length + ' subsets that share its root' : 'one subset') + ': ' + chips + '</p>' +
      '<div class="clist">' + here + '</div>' +
      '<details class="panel sub"><summary>Show all twenty constraints</summary>' +
      '<div class="clist">' + all + '</div></details>' +
      '</details>';
  }

  function gallery() {
    app.innerHTML = renderMasthead() +
      '<main><div class="wrap">' +
      '<div class="gallery-head"><h2>The atlas</h2>' +
      '<span class="hint" id="ghint"></span></div>' +
      '<div class="filterbar" id="filterbar"></div>' +
      '<div class="grid" id="grid"></div></div></main>' + renderFooter();

    var all = manifest.figures;
    var grid = document.getElementById('grid');
    var hint = document.getElementById('ghint');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var card = en.target, id = card.dataset.id;
        io.unobserve(card);
        getFigure(id).then(function (fig) {
          var thumb = drawFigure(fig, { mini: true });
          thumb.setAttribute('class', 'thumb');
          var slot = card.querySelector('.thumb');
          if (slot) slot.replaceWith(thumb);
        }).catch(function () {});
      });
    }, { rootMargin: '200px' });

    function renderGrid(list) {
      grid.innerHTML = '';
      hint.textContent = list.length === all.length
        ? all.length + ' plates \u00b7 select one to inspect'
        : list.length + ' of ' + all.length + ' plates';
      list.forEach(function (f) {
        var card = el('<button class="card" data-id="' + f.id + '">' +
          '<div class="thumb"></div>' +
          '<div class="cap"><span class="id">' + f.id + '</span>' +
          '<span>' + f.n_subsets + (f.n_subsets > 1 ? ' subsets' : ' subset') + '</span></div>' +
          '</button>');
        card.addEventListener('click', function () { location.hash = '#/fig/' + f.id; });
        grid.appendChild(card); io.observe(card);
      });
    }

    var opts = '<option value="">all constraints</option>';
    for (var i = 1; i <= 20; i++) opts += '<option value="' + i + '">F' + i + ' \u2014 ' + escapeHtml(CONSTRAINTS[i].short) + '</option>';
    document.getElementById('filterbar').innerHTML =
      '<label>Show plates whose constraint subset includes <select id="fsel">' + opts + '</select></label>';
    document.getElementById('fsel').addEventListener('change', function (e) {
      var v = e.target.value;
      if (!v) return renderGrid(all);
      var n = Number(v);
      renderGrid(all.filter(function (f) {
        return f.source_subsets.some(function (s) { return s.indexOf(n) >= 0; });
      }));
    });

    renderGrid(all);
  }

  function detail(id) {
    getFigure(id).then(function (fig) {
      var idx = manifest.figures.filter(function (m) { return m.id === id; })[0] || {};
      var p = fig.provenance;
      app.innerHTML = renderMasthead() +
        '<main><div class="wrap">' +
        '<a class="back" href="#/">← all ' + manifest.counts.distinct_roots + ' plates</a>' +
        '<div class="detail">' +
        '<div><div class="stage" id="stage"><span class="zoomhint">scroll to zoom · drag to pan · double-click resets</span></div>' +
        '<div class="controls" id="controls"></div>' +
        '<div class="legend"><span class="s"><i></i>Śakti · downward · 5</span>' +
        '<span class="v"><i></i>Śiva · upward · 4</span></div></div>' +
        '<div class="specimen">' +
        '<h2>Plate ' + fig.id + '</h2>' +
        '<p class="sub">one distinct root · nine transverse arcs</p>' +
        '<div class="seal"><span class="mark">✓</span><span class="txt">' +
        'Certified: every vertex validates against engine <code>' + p.engine_commit + '</code> ' +
        'at <b>' + fmtResid(fig.gate.worst_residual) + '</b> (tol ' + fmtTol(fig.gate.tol) + ')</span></div>' +
        '<div class="field"><div class="k">Basic variables</div><div class="params">' +
        ['b', 'c', 'd', 'e', 'g'].map(function (n) {
          return '<div class="param"><div class="name">' + n + '</div><div class="val">' +
            fig.root[n].toFixed(6) + '</div></div>';
        }).join('') + '</div></div>' +
        '<div class="field"><div class="k">Provenance</div>' +
        '<div class="kv">census residual <span class="v">' + fmtResid(p.census_residual) + '</span></div>' +
        '<div class="kv" style="margin-top:4px">produced by</div>' +
        '<div class="subsets" style="margin-top:6px">' +
        p.source_subsets.map(function (s) { return '<span class="chip">{' + s.join(',') + '}</span>'; }).join('') +
        '</div></div>' + constraintsPanel(fig) +
        '<div class="field"><div class="k">Export</div>' +
        '<div class="export"><button class="btn" id="png">Download PNG</button>' +
        '<button class="btn ghost" id="svg">Download SVG</button>' +
        '<button class="toggle" id="cap" aria-pressed="false">Caption</button></div>' +
        '<p class="exp-note">Every file embeds its provenance \u2014 figure id, root, engine commit, ' +
        'DOI, gate residual \u2014 with no mark on the image. Caption adds one labeled line beneath the ' +
        'figure; off by default.</p>' +
        '</div>' +
        '</div></div></div></main>' + renderFooter();

      var state = { labels: false, base: false, axis: false };
      var stage = document.getElementById('stage');
      function paint(first) {
        var old = stage.querySelector('svg'); if (old) old.remove();
        var svg = drawFigure(fig, { labels: state.labels, base: state.base, axis: state.axis });
        if (first) svg.classList.add('fade-in');
        stage.insertBefore(svg, stage.firstChild);
        attachPanZoom(svg);
        return svg;
      }
      var cur = paint(true);

      var controls = document.getElementById('controls');
      [['labels', 'Point labels'], ['base', 'Base points'], ['axis', 'Axis']].forEach(function (t) {
        var btn = el('<button class="toggle" aria-pressed="false">' + t[1] + '</button>');
        btn.addEventListener('click', function () {
          state[t[0]] = !state[t[0]];
          btn.setAttribute('aria-pressed', String(state[t[0]]));
          cur = paint(false);
        });
        controls.appendChild(btn);
      });
      var captionOn = false;
      var capBtn = document.getElementById('cap');
      capBtn.addEventListener('click', function () {
        captionOn = !captionOn; capBtn.setAttribute('aria-pressed', String(captionOn));
      });
      document.getElementById('svg').addEventListener('click', function () { exportSVG(fig, cur, captionOn); });
      document.getElementById('png').addEventListener('click', function () { exportPNG(fig, cur, captionOn); });
      window.scrollTo(0, 0);
    }).catch(function (e) {
      app.innerHTML = renderMasthead() + '<main><div class="wrap"><a class="back" href="#/">← back</a>' +
        '<p style="font-family:var(--f-mono);color:var(--sakti)">Could not load plate ' + id + '. ' +
        escapeHtml(e.message) + '</p></div></main>';
    });
  }

  /* ----- router ----- */
  function route() {
    var h = location.hash;
    var m = h.match(/#\/fig\/(\w+)/);
    if (m) detail(m[1]); else gallery();
  }

  getManifest().then(function (mf) {
    manifest = mf;
    if (SAMPLE) {
      var b = document.getElementById('preview-banner');
      if (b) b.style.display = 'block';
    }
    window.addEventListener('hashchange', route);
    route();
  }).catch(function (e) {
    app.innerHTML = '<div class="wrap" style="padding:60px 28px;font-family:var(--f-mono)">' +
      '<p style="color:var(--sakti)">No bundle found.</p>' +
      '<p style="color:var(--ink-soft)">Generate it with <code>build_viewer_bundle.py</code> and serve ' +
      'this folder over HTTP (fetch needs http, not file://):<br><br>' +
      '<code>python3 -m http.server</code> then open <code>http://localhost:8000</code>.</p>' +
      '<p style="color:var(--ink-faint)">(' + escapeHtml(e.message) + ')</p></div>';
  });
})();
