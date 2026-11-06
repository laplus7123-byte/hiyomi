/* HIYOMI: 鑑定結果の表示だけを8枚の要点レポートに組み直す。 */
(function () {
  'use strict';
  var cleanup = null;
  function el(tag, cls, value) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (value != null) n.textContent = value;
    return n;
  }
  function all(root, selector) { return Array.from(root.querySelectorAll(selector)); }
  function text(root, selector) { var n = root && root.querySelector(selector); return n ? n.textContent.trim() : ''; }
  function sentence(value) { var i = value.indexOf('。'); return i < 0 ? value : value.slice(0, i + 1); }
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
    track.setAttribute('aria-label', '鑑定結果の要点レポート');
    track.setAttribute('aria-roledescription', 'カルーセル');
    var fullReport = el('div', 'report-full');
    fullReport.hidden = true;
    function listen(node, type, fn, options) { node.addEventListener(type, fn, options); listeners.push(function () { node.removeEventListener(type, fn, options); }); }
    function section(id) { return report.querySelector('#sec-' + id); }
    function art(src) {
      var img = el('img', 'poster-art'); img.src = src; img.alt = '';
      img.width = 1200; img.height = 800; img.decoding = 'async';
      return img;
    }
    function scene(key) { return 'assets/img/report-scenes/' + key + '.webp'; }
    function hero(title, description, image, label) {
      var copy = el('div', 'poster-intro');
      if (label) copy.appendChild(el('p', 'poster-eyebrow', label));
      copy.appendChild(el('h3', 'poster-headline', title));
      if (description) copy.appendChild(el('p', 'poster-deck', description));
      return wrap('div', 'poster-hero', [copy, image ? art(image) : null]);
    }
    function panel(label, value, note) {
      return wrap('div', 'poster-panel', [el('p', 'poster-label', label), el('p', 'poster-emphasis', value), note ? el('p', 'poster-note', note) : null]);
    }
    function facts(rows, cls) {
      var dl = el('dl', cls || 'poster-facts');
      rows.filter(function (r) { return r[1]; }).forEach(function (r) {
        dl.appendChild(wrap('div', '', [el('dt', '', r[0]), el('dd', '', r[1])]));
      });
      return dl;
    }
    function detailButton(label, id) {
      var b = el('button', 'poster-detail', label + ' →');
      b.type = 'button'; b.dataset.fullSection = id; return b;
    }
    function slide(id, topic, title, lead, nodes, kind, sourceId, detailLabel) {
      var s = el('section', 'swipe-slide poster-slide');
      s.id = 'brief-' + id; s.dataset.kind = kind;
      var body = el('div', 'swipe-slide-body'); body.tabIndex = 0;
      var heading = el('header', 'swipe-slide-heading');
      var h = el(slides.length ? 'h2' : 'h1', 'swipe-title', title); h.id = 'swipe-title-' + slides.length;
      heading.appendChild(wrap('div', 'poster-heading-copy', [el('p', 'swipe-topic', topic), h]));
      var badge = el('span', 'poster-page-badge'); badge.setAttribute('aria-hidden', 'true');
      badge.appendChild(el('b', '', String(slides.length + 1).padStart(2, '0')));
      heading.appendChild(badge);
      body.setAttribute('aria-labelledby', h.id);
      body.appendChild(heading);
      body.appendChild(wrap('div', 'poster-content', [lead, wrap('div', 'poster-copy', nodes)]));
      body.appendChild(wrap('footer', 'poster-footer', [detailButton(detailLabel || '詳しい説明を読む', sourceId || id)]));
      s.appendChild(body); s.setAttribute('role', 'group'); s.setAttribute('aria-roledescription', 'スライド');
      aliases[id] = slides.length;
      slides.push({node: s, body: body, title: title, topic: topic, sourceId: sourceId || id});
      track.appendChild(s);
      return slides.length - 1;
    }
    function adviceItems(sceneSection, adviceSection) {
      var scenes = all(sceneSection, '.zure-list > li'), tips = all(adviceSection, '.advice-list > li');
      var list = el('ol', 'poster-advice');
      scenes.forEach(function (item, i) {
        var li = el('li');
        li.appendChild(el('span', 'poster-step', String(i + 1).padStart(2, '0')));
        li.appendChild(wrap('div', '', [el('p', 'poster-situation', text(item, 'h3')), el('p', 'poster-action', text(tips[i], 'h3'))]));
        list.appendChild(li);
      });
      return list;
    }
    try {
      var roleImage = overview.querySelector('.sheet-art').getAttribute('src');
      var typeName = text(overview, '.sheet-type-name');
      var faces = all(section('seikaku'), '.face');
      var values = all(section('kachikan'), '.value-block');
      var work = values[0], love = values[1], life = values[2];
      var years = section('nenpyo'), past = all(years, '.tl-past'), now = years.querySelector('.tl-now'), flow = years.querySelector('.current-flow');
      var summary = section('matome'), tips = all(section('jogen'), '.advice-list h3');
      var pair = section('relations');
      var yearNames = past.map(function (y) { return text(y, '.node'); }).join('・');
      var workRole = work.querySelector('.value-extra');
      var roleCopy = workRole ? Array.from(workRole.childNodes).filter(function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent; }).join('').trim() : '';
      slide('overview', 'あなたの鑑定レポート', 'まず、あなたの全体像',
        hero(typeName, text(overview, '.type-definition'), roleImage, text(overview, '.sheet-title')),
        [panel('あなたの強み', text(section('kachikan'), '.chapter-key-text').replace(/^あなたの強みは、/, '')),
          facts([['振り返る年', yearNames || 'これまでと今年'], ['今の流れ', text(flow, 'h3') || text(now, 'h3')]])], 'cover', 'overview', '鑑定情報・名前の画数を見る');
      slides[0].body.querySelector('.poster-detail').dataset.fullSection = 'info';

      if (pair) {
        var viewpoints = all(pair, '.viewpoint');
        var pairFigures = all(pair, '.pair figure');
        var pairArt = el('div', 'poster-pair-art');
        pairFigures.forEach(function (figure) {
          var image = figure.querySelector('img');
          var caption = figure.querySelector('figcaption');
          var name = Array.from(caption.childNodes).filter(function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent; }).join('').trim();
          pairArt.appendChild(wrap('figure', '', [art(image.getAttribute('src')), wrap('figcaption', '', [el('span', '', name), el('b', '', text(caption, 'b'))])]));
        });
        var pairHero = hero(sentence(text(pair, '.chapter-key-text')), text(pair, '.sec-lead'), null, '二人の関係の特徴');
        pairHero.appendChild(pairArt);
        var pairIndex = slide('relations', '相性のレポート', '二人の関係をひと目で', pairHero,
          [facts(viewpoints.map(function (v) { return [text(v, '.viewpoint-label'), text(v, '.viewpoint-value')]; }))], 'pair', 'relations', '二人の価値観・相性を詳しく読む');
        aliases['relations-katachi'] = aliases['relations-ii'] = pairIndex;
        var pairAdvice = slide('relations-zure', '二人のコミュニケーション', '関係を育てる、小さな工夫',
          hero('違いに気づくことから。', '気になる場面を選んで、一つずつ試してみてください。', scene('dialogue')),
          [adviceItems(section('relations-zure'), section('relations-mukiai'))], 'advice', 'relations-zure', '二人のすれ違いと対処法を詳しく読む');
        aliases['relations-mukiai'] = pairAdvice;
      }

      slide('seikaku', '性格と価値観', '外から見える顔、内側の思い',
        hero('あなたらしさを、3つの視点で。', '', scene('self')),
        [facts([[text(faces[0], 'h3'), sentence(text(faces[0], '.face-text'))],
          [text(faces[1], 'h3'), sentence(text(faces[1], '.face-text'))]]),
          panel('人生で大切にすること', text(life, 'h3'))], 'personality', 'seikaku', '性格と価値観を詳しく読む');
      var workIndex = slide('kachikan', '仕事の強み', 'あなたの力が出る働き方',
        hero(text(work, 'h3'), sentence(text(work, 'p:not(.value-label):not(.value-extra):not(.reading-source)')), scene('work')),
        [panel('力が出る役回り', roleCopy), facts([['持ち味', text(section('kachikan'), '.chapter-key-text').replace(/^あなたの強みは、/, '')]])], 'work', 'kachikan', '仕事・人生の価値観を詳しく読む');
      aliases['work-role'] = workIndex;

      var people = el('dl', 'poster-people');
      var nature = ['tree', 'sun', 'mountain', 'sword', 'sea'];
      all(section('kakawari'), '.kakawari-table tbody tr').forEach(function (row, i) {
        var th = row.querySelector('th');
        var label = Array.from(th.childNodes).filter(function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent; }).join('').replace('の生まれ', '');
        var dt = wrap('dt', '', [art('assets/img/kami_' + nature[i] + '.webp'), el('span', '', label)]);
        people.appendChild(wrap('div', '', [dt, el('dd', '', text(row, 'td b'))]));
      });
      var relationshipIndex = slide('kakawari', '恋愛と人間関係', '恋愛と人との関わり方',
        hero(text(love, 'h3'), '', scene('love')),
        [wrap('div', 'poster-people-block', [el('p', 'poster-label', '相手のタイプ別・あなたとの関わり'), people])], 'people', 'kakawari', '恋愛と対人関係を詳しく読む');
      aliases.partner = relationshipIndex;

      var timeline = el('ol', 'poster-timeline');
      past.forEach(function (year) {
        timeline.appendChild(wrap('li', '', [wrap('div', 'poster-year', [el('b', '', text(year, '.node')), el('span', '', text(year, '.year-age'))]),
          wrap('div', 'poster-event', [el('h3', '', text(year, '.year-content h3')), el('p', '', sentence(text(year, '.year-lead')))])]));
      });
      if (!past.length) timeline.appendChild(el('li', 'poster-note', '15歳以降の節目は、これから年表に並びます。今年のテーマは次のページで確認できます。'));
      slide('nenpyo', '人生の年表', 'これまでの節目を、一枚に',
        hero('どんな変化が、ありましたか。', '', scene('life')),
        [timeline], 'timeline', 'nenpyo', '詳しい年表で「心当たり」を振り返る');
      var nowImage = now.querySelector('.photo');
      var nowTheme = nowImage ? nowImage.getAttribute('src') : '';
      var nowScene = /go\.webp/.test(nowTheme) ? 'dialogue' : /fukugin/.test(nowTheme) ? 'self' : 'life';
      slide('nenpyo-flow', '今年と10年の流れ', '今、意識しておきたいテーマ',
        hero(text(now, '.year-content h3'), sentence(text(now, '.year-lead')), scene(nowScene), text(now, '.node') + '・' + text(now, '.year-age')),
        [panel(flow ? '今の10年間のテーマ' : '今年のテーマ', text(flow, 'h3') || text(now, 'h3'), text(flow, '.flow-period') || text(now, '.tl-period')),
          facts([['今年の対象期間', text(now, '.tl-period')]])], 'flow', 'nenpyo-now', '今年と10年の流れを詳しく読む');
      var adviceIndex = slide('zure', '日常で試せること', 'つまずきを、次の工夫に',
        hero('気になるものを、ひとつから。', '', scene('dialogue')),
        [adviceItems(section('zure'), section('jogen'))], 'advice', 'zure', 'つまずきの理由と工夫を詳しく読む');
      aliases.jogen = adviceIndex;
      var takeaways = el('ul', 'poster-takeaways');
      all(summary, '.matome-list li').filter(function (li) { return !/^\s*\d{4}年/.test(li.textContent); }).forEach(function (li) { takeaways.appendChild(el('li', '', li.textContent)); });
      var actions = el('div', 'poster-links');
      actions.appendChild(detailButton('鑑定情報・名前の画数', 'info'));
      var nextLink = el('a', 'poster-link', pair ? '保存・会員機能について' : '気になる人との相性を見る');
      nextLink.href = pair ? '#join' : '#aisho'; actions.appendChild(nextLink);
      var end = slide('matome', 'レポートのまとめ', 'あなたらしい次の一歩',
        hero(typeName, '', roleImage),
        [takeaways, panel('まず試してみること', tips[0] ? tips[0].textContent : text(summary, '.matome-end')), actions], 'summary', 'reading', '全文・この鑑定の読み方を見る');
      aliases.korekara = aliases.reading = aliases.info = aliases.name = end;
      slides.forEach(function (s) { s.node.querySelector('.poster-page-badge').appendChild(el('small', '', '/ ' + String(slides.length).padStart(2, '0'))); });
      // 全文は元のノードを一度だけ保持する。年表の回答ボタン・根拠・鑑定情報を複製しない。
      while (report.firstChild) fullReport.appendChild(report.firstChild);
      report.appendChild(track); report.appendChild(fullReport);

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
          ? '左右で項目を切り替え · 上下で続きを見る' : '左右にスワイプ · 詳細は「全文で読む」';
      }
      function update() {
        slides.forEach(function (s, i) {
          var hidden = reading || i !== active;
          if (hidden && s.node.contains(document.activeElement)) toggle.focus({ preventScroll: true });
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
        if (reading) fullTarget(slides[active].sourceId).scrollIntoView({ behavior: 'instant', block: 'start' });
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
      function fullTarget(key) {
        if (key === 'info' || key === 'name') return fullReport.querySelector('.sheet-supplements') || fullReport;
        if (key === 'nenpyo-now') return fullReport.querySelector('.tl-now') || fullReport;
        return fullReport.querySelector('#sec-' + key) || fullReport;
      }
      function setReading(value, key) {
        reading = value;
        track.hidden = reading; fullReport.hidden = !reading;
        result.classList.toggle('swipe-mode', !reading); result.classList.toggle('reading-mode', reading);
        toggle.textContent = reading ? '要点で読む' : '全文で読む'; toggle.setAttribute('aria-pressed', String(reading));
        syncVisibility(); update();
        if (reading) fullTarget(key || slides[active].sourceId).scrollIntoView({ behavior: 'instant', block: 'start' });
        else { window.scrollTo(0, 0); go(active, true); }
      }
      listen(toggle, 'click', function () { setReading(!reading); });
      listen(result, 'click', function (e) {
        var full = e.target.closest('[data-full-section]');
        if (full) { e.preventDefault(); e.stopPropagation(); setReading(true, full.dataset.fullSection); return; }
        var a = e.target.closest('[data-jump], #toc [data-sec]');
        if (!a) return;
        var key = a.dataset.jump || a.dataset.sec;
        if (aliases[key] == null) return;
        e.preventDefault(); e.stopPropagation();
        if (reading) fullTarget(key).scrollIntoView({ behavior: 'instant', block: 'start' });
        else { go(aliases[key], true); slides[active].body.focus({ preventScroll: true }); }
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
