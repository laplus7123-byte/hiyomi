/* HIYOMI: 既存の鑑定結果を移動して組み直す表示層。計算や保存は行わない。 */
(function () {
  'use strict';
  var cleanup = null;
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  function all(root, selector) { return Array.from(root.querySelectorAll(selector)); }
  function text(root, selector) { var n = root.querySelector(selector); return n ? n.textContent.trim() : ''; }
  function wrap(tag, cls, nodes) { var n = el(tag, cls); nodes.filter(Boolean).forEach(function (x) { n.appendChild(x); }); return n; }
  function destroy() { if (cleanup) cleanup(); cleanup = null; }

  function mount() {
    destroy();
    var result = document.getElementById('result'), report = document.getElementById('report');
    var overview = report.querySelector('#sec-overview');
    if (!overview) return false;
    var source = report.innerHTML;
    var slides = [], aliases = {}, extraUI = [], listeners = [], observers = [];
    var active = 0, reading = false, frame = 0, resizeFrame = 0, announcementTimer = 0, pending = null;
    var track = el('div', 'swipe-viewport');
    track.id = 'swipeViewport';
    track.setAttribute('role', 'region');
    track.setAttribute('aria-label', '鑑定結果のカード');
    track.setAttribute('aria-roledescription', 'カルーセル');
    function listen(node, type, fn, options) { node.addEventListener(type, fn, options); listeners.push(function () { node.removeEventListener(type, fn, options); }); }
    function slide(id, topic, title, nodes, kind) {
      var s = el('section', 'swipe-slide');
      s.id = 'sec-' + id;
      s.dataset.kind = kind || 'info';
      var body = el('div', 'swipe-slide-body');
      body.tabIndex = 0;
      var heading = el('header', 'swipe-slide-heading');
      heading.appendChild(el('p', 'swipe-topic', topic));
      var h = el(slides.length ? 'h2' : 'h1', 'swipe-title', title);
      h.id = 'swipe-title-' + slides.length;
      heading.appendChild(h);
      body.setAttribute('aria-labelledby', h.id);
      body.appendChild(heading);
      body.appendChild(wrap('div', 'swipe-content', nodes));
      s.appendChild(body);
      s.appendChild(el('span', 'swipe-card-page', String(slides.length + 1).padStart(2, '0')));
      s.setAttribute('role', 'group');
      s.setAttribute('aria-roledescription', 'スライド');
      aliases[id] = slides.length;
      slides.push({ node: s, body: body, title: title, topic: topic });
      track.appendChild(s);
      return s;
    }
    function section(id) { return report.querySelector('#sec-' + id); }
    function contents(s) { return Array.from(s.children).filter(function (n) { return !n.matches('header, h2, .page-run, .page-no'); }); }
    function combined(sceneId, adviceId, topic) {
      var scenes = section(sceneId), advice = section(adviceId);
      if (!scenes || !advice) return;
      var items = all(scenes, '.zure-list > li'), tips = all(advice, '.advice-list > li');
      var first = slides.length;
      items.forEach(function (item, i) {
        var nodes = [wrap('ol', 'zure-list', [item])];
        if (tips[i]) nodes.push(wrap('ol', 'advice-list', [tips[i]]));
        var basis = item.querySelector('.zure-basis');
        if (basis) nodes.push(basis);
        slide(i ? sceneId + '-' + i : sceneId, topic + ' ' + (i + 1), text(item, 'h3'), nodes, 'advice');
      });
      aliases[adviceId] = first;
    }
    try {
      var supplements = overview.querySelector('.sheet-supplements');
      var coverTitle = text(overview, '.sheet-title');
      var typeCaption = overview.querySelector('.type-caption');
      var reportContext = overview.querySelector('.report-context');
      if (typeCaption) typeCaption.remove();
      slide('overview', 'あなたの鑑定レポート', coverTitle, [overview.querySelector('.sheet-type')], 'cover');
      var pair = section('relations');
      if (pair) {
        slide('relations', '二人の相性', '二人の関係の特徴', [pair.querySelector('.pair'), pair.querySelector('.chapter-key'), pair.querySelector('.sec-lead'), pair.querySelector('.caution')], 'pair');
        slide('relations-view', '二人の相性', 'お互いをどう感じる？', [pair.querySelector('.pair-viewpoints'), pair.querySelector('.reading-source')], 'pair');
        var comparison = section('relations-katachi');
        // 同じ行の二人分を並べる。比較の内容は変更しない。
        all(comparison, 'tbody tr').forEach(function (row, i) {
          var dl = el('dl', 'swipe-compare');
          all(row, 'td').forEach(function (cell) {
            var entry = el('div');
            entry.appendChild(el('dt', '', cell.dataset.label));
            var dd = el('dd'); while (cell.firstChild) dd.appendChild(cell.firstChild);
            entry.appendChild(dd); dl.appendChild(entry);
          });
          slide(i ? 'relations-katachi-' + i : 'relations-katachi', '二人の価値観', text(row, 'th'), [dl], 'comparison');
        });
        var good = section('relations-ii');
        all(good, '.goods li').forEach(function (li, i) {
          slide(i ? 'relations-ii-' + i : 'relations-ii', '二人の相性', '協力しやすいところ ' + (i + 1), [wrap('ul', 'goods', [li])], 'goods');
        });
        combined('relations-zure', 'relations-mukiai', 'すれ違いを減らす工夫');
      }
      all(section('seikaku'), '.face').forEach(function (face, i) {
        slide(i ? 'seikaku-inner' : 'seikaku', 'あなたの性格', text(face, 'h3'), [face], 'face');
      });
      all(section('kachikan'), '.value-block').forEach(function (value, i) {
        var role = value.querySelector('.value-extra');
        if (role) role.remove();
        slide(i ? 'kachikan-' + i : 'kachikan', 'あなたの価値観', ['仕事で大切にすること', '恋愛で大切にすること', '人生で大切にすること'][i], [value], 'value');
        if (role) slide('work-role', 'あなたの仕事', '力が出る役回り', [role], 'role');
      });
      var years = section('nenpyo');
      all(years, '.tl-year:not(.tl-next)').forEach(function (year, i) {
        slide(i ? 'nenpyo-' + i : 'nenpyo', year.classList.contains('tl-now') ? '今年のテーマ' : '人生の節目', text(year, '.node') + ' · ' + text(year, '.year-age'), [wrap('ol', 'tl', [year])], 'year');
      });
      var flow = years.querySelector('.current-flow');
      if (flow) slide('nenpyo-flow', '今の流れ', '今の10年間のテーマ', [flow, years.querySelector('#tally')], 'flow');
      else if (years.querySelector('#tally')) slides[slides.length - 1].body.querySelector('.swipe-content').appendChild(years.querySelector('#tally'));
      var relations = section('kakawari');
      all(relations, '.kakawari-table tbody tr').forEach(function (row, i) {
        var heading = row.querySelector('th'), description = row.querySelector('td');
        var note = heading.querySelector('small');
        if (note) note.remove();
        var resultText = el('div', 'relationship-result');
        while (description.firstChild) resultText.appendChild(description.firstChild);
        slide(i ? 'kakawari-' + i : 'kakawari', '人との関わり方', heading.textContent.trim(), [note, resultText], 'relationship');
      });
      combined('zure', 'jogen', 'つまずきと日常の工夫');
      slide('matome', 'レポートのまとめ', '振り返りと、次の一歩', contents(section('matome')), 'summary');
      var partnerPrompt = relations.querySelector('.profile-partner-prompt');
      if (partnerPrompt) slide('partner', '相性も見てみる', '気になる人との関係は？', [partnerPrompt], 'relations');
      var nameResult = supplements.querySelector('.kakusu');
      if (nameResult) nameResult.remove();
      slide('info', '鑑定情報', '鑑定に使った情報', [supplements], 'info');
      if (nameResult) slide('name', '名前の画数', '名前から見る5つの格', [nameResult], 'info');
      var method = section('reading');
      var methodNodes = contents(method);
      methodNodes.splice(1, 0, typeCaption, reportContext);
      slide('reading', 'HIYOMIについて', 'この鑑定の読み方', methodNodes, 'method');
      var future = section('korekara');
      slide('korekara', 'サービスのご案内', '無料で読める内容', [future.querySelector('.sec-lead'), future.querySelector('.service-free')], 'service');
      var plan = future.querySelector('.locked');
      var planNodes = [plan];
      if (pair) {
        var tail = section('relations-mukiai');
        var pairNotes = wrap('div', 'swipe-plan-detail', [tail.querySelector('.locked-pair'), tail.querySelector('.third-person'), relations.querySelector('.third-person')]);
        planNodes.push(pairNotes);
      }
      slide('korekara-plan', 'サービスのご案内', 'これからの流れを読む', planNodes, 'service');
      // 要点表示は文の区切りでまとめる。全文は同じDOMに残し、いつでも読める。
      all(track, '.zure-scene, .advice-copy > p:last-child, .value-block > p:not(.value-label):not(.reading-source):not(.value-extra), .year-lead').forEach(function (p) {
        var full = p.textContent, stop = full.indexOf('。');
        if (stop < 0 || !full.slice(stop + 1).trim()) return;
        p.replaceChildren(document.createTextNode(full.slice(0, stop + 1)), el('span', 'swipe-full-detail', full.slice(stop + 1)));
      });
      // 結果の意味に対応した挿絵を配置する。鑑定の値や判定には使わない。
      var roleImage = track.querySelector('.sheet-art').getAttribute('src');
      function scene(key) { return 'assets/img/report-scenes/' + key + '.webp'; }
      function addVisual(item, sources, compact) {
        var figure = el('figure', 'report-illustration');
        figure.setAttribute('aria-hidden', 'true');
        sources.forEach(function (src) {
          var img = el('img'); img.src = src; img.alt = '';
          img.width = sources.length > 1 ? 480 : 1200;
          img.height = sources.length > 1 ? 640 : 800;
          img.decoding = 'async'; figure.appendChild(img);
        });
        if (sources.length > 1) figure.classList.add('illustration-pair');
        item.body.insertBefore(figure, item.body.querySelector('.swipe-content'));
        item.node.classList.add('has-visual');
        if (compact) item.node.classList.add('visual-compact');
      }
      var nature = [['tree', 'flower'], ['sun', 'flame'], ['mountain', 'field'], ['sword', 'jewel'], ['sea', 'rain']];
      var natureIndex = 0;
      slides.forEach(function (item) {
        var id = item.node.id, kind = item.node.dataset.kind, image;
        if (kind === 'face') image = id === 'sec-seikaku' ? roleImage : scene('self');
        if (kind === 'value') image = scene(id === 'sec-kachikan' ? 'work' : id === 'sec-kachikan-1' ? 'love' : 'life');
        if (kind === 'role') image = roleImage;
        if (kind === 'flow' || kind === 'summary') image = scene('life');
        if (kind === 'advice') {
          image = scene(/本音|希望|自分/.test(item.title) ? 'self' : /予定|変え|進め/.test(item.title) ? 'life' : 'dialogue');
        }
        if (kind === 'year') {
          var oldImage = item.node.querySelector('.photo');
          var theme = oldImage ? oldImage.getAttribute('src') : '';
          image = scene(/go\.webp/.test(theme) ? 'dialogue' : /fukugin/.test(theme) ? 'self' : 'life');
        }
        if (kind === 'goods' || id === 'sec-partner') image = scene('dialogue');
        if (kind === 'relationship') {
          addVisual(item, nature[natureIndex++].map(function (key) { return 'assets/img/kami_' + key + '.webp'; }));
          return;
        }
        if (image) addVisual(item, [image], kind === 'advice' || kind === 'summary');
      });
      all(track, '.face-text').forEach(function (p) {
        var full = p.textContent, stop = full.indexOf('。');
        if (stop >= 0 && full.slice(stop + 1).trim()) p.replaceChildren(document.createTextNode(full.slice(0, stop + 1)), el('span', 'swipe-full-detail', full.slice(stop + 1)));
      });
      report.replaceChildren(track);

      var toggle = el('button', '', '全文で読む'); toggle.id = 'swipeModeToggle'; toggle.type = 'button';
      toggle.setAttribute('aria-controls', 'report'); toggle.setAttribute('aria-pressed', 'false');
      result.querySelector('.profile-masthead').appendChild(toggle); extraUI.push(toggle);
      var toolbar = el('div', 'swipe-toolbar');
      var label = el('label', 'swipe-select-label'); label.htmlFor = 'swipeSelect';
      label.appendChild(el('span', 'sr-only', '読みたい項目を選ぶ'));
      var select = el('select'); select.id = 'swipeSelect';
      slides.forEach(function (s, i) { var opt = el('option', '', (i + 1) + '. ' + s.title); opt.value = i; select.appendChild(opt); s.node.setAttribute('aria-label', (i + 1) + ' / ' + slides.length + '：' + s.title); });
      label.appendChild(select); toolbar.appendChild(label);
      var count = el('span', 'swipe-count'); count.id = 'swipeCount'; toolbar.appendChild(count);
      var progress = el('div', 'swipe-progress'), bar = el('span'); bar.id = 'swipeProgress'; progress.appendChild(bar); progress.setAttribute('aria-hidden', 'true');
      result.insertBefore(toolbar, report); result.insertBefore(progress, report); extraUI.push(toolbar, progress);
      var controls = el('footer', 'swipe-controls');
      var hint = el('p', 'swipe-hint'); hint.id = 'swipeHint'; controls.appendChild(hint);
      var actions = el('div', 'swipe-actions');
      var prev = el('button', 'swipe-prev', '← 前へ'); prev.id = 'swipePrev'; prev.type = 'button';
      var next = el('button', 'swipe-next'); next.id = 'swipeNext'; next.type = 'button';
      next.appendChild(el('span', 'swipe-next-label', '次へ →'));
      var nextTitle = el('small'); nextTitle.id = 'swipeNextTitle'; next.appendChild(nextTitle);
      [prev, next].forEach(function (b) { b.setAttribute('aria-controls', 'swipeViewport'); actions.appendChild(b); });
      controls.appendChild(actions); result.appendChild(controls); extraUI.push(controls);
      var announcement = el('p', 'sr-only'); announcement.id = 'swipeAnnouncement'; announcement.setAttribute('aria-live', 'polite'); announcement.setAttribute('aria-atomic', 'true');
      result.appendChild(announcement); extraUI.push(announcement);

      function syncVisibility() { document.body.classList.toggle('has-swipe-report', !result.hidden && !reading); }
      function updateHint() {
        var b = slides[active].body;
        hint.textContent = b.scrollHeight > b.clientHeight + 3 && b.scrollTop + b.clientHeight < b.scrollHeight - 3
          ? '左右で項目を切り替え · 詳細は「全文で読む」' : '左右にスワイプ · 詳細は「全文で読む」';
      }
      function update() {
        slides.forEach(function (s, i) {
          var hidden = !reading && i !== active;
          if (hidden && s.node.contains(document.activeElement)) next.focus({ preventScroll: true });
          s.node.inert = hidden;
          if (hidden) s.node.setAttribute('aria-hidden', 'true'); else s.node.removeAttribute('aria-hidden');
          s.node.classList.toggle('is-active', i === active);
        });
        select.value = String(active); count.textContent = (active + 1) + ' / ' + slides.length;
        bar.style.width = ((active + 1) / slides.length * 100) + '%';
        prev.disabled = active === 0; next.disabled = active === slides.length - 1;
        nextTitle.textContent = active < slides.length - 1 ? slides[active + 1].title : '最後のページ';
        updateHint();
        clearTimeout(announcementTimer);
        announcementTimer = setTimeout(function () { announcement.textContent = (active + 1) + ' / ' + slides.length + '、' + slides[active].title; }, 180);
      }
      function targetLeft(i) {
        var r = slides[i].node.getBoundingClientRect(), t = track.getBoundingClientRect();
        return track.scrollLeft + r.left - t.left - (track.clientWidth - r.width) / 2;
      }
      function go(i, instant) {
        active = Math.max(0, Math.min(slides.length - 1, i)); update();
        if (reading) slides[active].node.scrollIntoView({ behavior: 'instant', block: 'start' });
        else {
          pending = active;
          track.scrollTo({ left: targetLeft(active), behavior: instant || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        }
      }
      function nearest() {
        if (pending != null) {
          if (Math.abs(track.scrollLeft - targetLeft(pending)) < 2) pending = null;
          else return;
        }
        var center = track.getBoundingClientRect().left + track.clientWidth / 2, nearestIndex = active, distance = Infinity;
        slides.forEach(function (s, i) { var r = s.node.getBoundingClientRect(), d = Math.abs(r.left + r.width / 2 - center); if (d < distance) { distance = d; nearestIndex = i; } });
        if (active !== nearestIndex) { active = nearestIndex; update(); }
      }
      listen(track, 'scroll', function () { if (reading || frame) return; frame = requestAnimationFrame(function () { frame = 0; nearest(); }); }, { passive: true });
      listen(track, 'scrollend', function () { pending = null; if (!reading) nearest(); });
      listen(track, 'touchstart', function () { pending = null; }, { passive: true });
      listen(track, 'wheel', function () { pending = null; }, { passive: true });
      listen(prev, 'click', function () { go(active - 1); });
      listen(next, 'click', function () { go(active + 1); });
      listen(select, 'change', function () { go(Number(select.value), true); });
      listen(toggle, 'click', function () {
        reading = !reading;
        result.classList.toggle('swipe-mode', !reading); result.classList.toggle('reading-mode', reading);
        toggle.textContent = reading ? '要点で読む' : '全文で読む'; toggle.setAttribute('aria-pressed', String(reading));
        syncVisibility(); update();
        if (!reading) window.scrollTo(0, 0);
        go(active, true);
      });
      listen(result, 'click', function (e) {
        var a = e.target.closest('[data-jump], #toc [data-sec]');
        if (!a) return;
        var key = a.dataset.jump || a.dataset.sec;
        if (aliases[key] == null) return;
        e.preventDefault(); e.stopPropagation(); go(aliases[key], true);
        slides[active].body.focus({ preventScroll: true });
      }, true);
      listen(document, 'keydown', function (e) {
        if (reading || result.hidden || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.target.closest('input, select, textarea, [contenteditable]') || String(window.getSelection())) return;
        if (e.key === 'ArrowRight' && active < slides.length - 1) { e.preventDefault(); go(active + 1); }
        if (e.key === 'ArrowLeft' && active > 0) { e.preventDefault(); go(active - 1); }
      });
      slides.forEach(function (s) { listen(s.body, 'scroll', updateHint, { passive: true }); });
      listen(track, 'load', updateHint, true);
      var sizeObserver = new ResizeObserver(function () {
        cancelAnimationFrame(resizeFrame);
        resizeFrame = requestAnimationFrame(function () { if (!reading && !result.hidden) go(active, true); });
      });
      sizeObserver.observe(track); observers.push(sizeObserver);
      var visibilityObserver = new MutationObserver(syncVisibility);
      visibilityObserver.observe(result, { attributes: true, attributeFilter: ['hidden'] }); observers.push(visibilityObserver);
      result.classList.add('swipe-ready', 'swipe-mode'); syncVisibility(); update();
      cleanup = function () {
        listeners.forEach(function (remove) { remove(); }); observers.forEach(function (o) { o.disconnect(); });
        cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame); clearTimeout(announcementTimer);
        extraUI.forEach(function (n) { n.remove(); });
        result.classList.remove('swipe-ready', 'swipe-mode', 'reading-mode'); document.body.classList.remove('has-swipe-report');
      };
      return true;
    } catch (error) {
      listeners.forEach(function (remove) { remove(); }); observers.forEach(function (o) { o.disconnect(); }); extraUI.forEach(function (n) { n.remove(); });
      report.innerHTML = source;
      result.classList.remove('swipe-ready', 'swipe-mode', 'reading-mode'); document.body.classList.remove('has-swipe-report');
      console.error('カード表示を開始できなかったため、一覧を表示します。', error);
      return false;
    }
  }
  window.HiyomiSwipe = { mount: mount, destroy: destroy };
})();
