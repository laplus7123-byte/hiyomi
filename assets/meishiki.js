/* 命式・タイプ・九星・大運・年表・相性の計算。
   正本は .cursor/skills/ekigaku-kantei/scripts/meishiki.py。ルールを変えるときは両方を直し、
   tools/check_calc.py で一致を確かめる。 */
(function (root) {
  'use strict';

  var Solar = root.Solar;
  var LunarUtil = root.LunarUtil;

  var JA = { '比肩': '比肩', '劫财': '劫財', '食神': '食神', '伤官': '傷官', '偏财': '偏財', '正财': '正財',
    '七杀': '偏官', '正官': '正官', '偏印': '偏印', '正印': '印綬' };
  var GROUP = { '比肩': '比劫', '劫财': '比劫', '食神': '食傷', '伤官': '食傷', '偏财': '財', '正财': '財',
    '七杀': '官', '正官': '官', '偏印': '印', '正印': '印' };
  var ROLE = { '財': '開拓者', '食傷': '表現者', '印': '賢者', '官': '統率者', '比劫': '独立者' };
  var TEN_NAME = { '偏财': '攻めの開拓者', '正财': '守りの開拓者', '伤官': '攻めの表現者', '食神': '守りの表現者',
    '偏印': 'ひらめきの賢者', '正印': '学びの賢者', '七杀': '攻めの統率者', '正官': '守りの統率者',
    '劫财': '攻めの独立者', '比肩': '守りの独立者' };
  var SHIN = { '甲': '大樹神', '乙': '草花神', '丙': '太陽神', '丁': '灯火神', '戊': '山神',
    '己': '田畑神', '庚': '剣神', '辛': '宝石神', '壬': '大海神', '癸': '雨神' };
  var GOD = { '甲': ['大樹', '久久能智神', 'くくのちのかみ'], '乙': ['草花', '木花咲耶姫', 'このはなさくやひめ'],
    '丙': ['太陽', '天照大御神', 'あまてらすおおみかみ'], '丁': ['灯火', '火之迦具土神', 'ひのかぐつちのかみ'],
    '戊': ['山', '大山津見神', 'おおやまつみのかみ'], '己': ['田畑', '宇迦之御魂神', 'うかのみたまのかみ'],
    '庚': ['剣', '経津主神', 'ふつぬしのかみ'], '辛': ['宝石', '玉祖命', 'たまのおやのみこと'],
    '壬': ['海', '綿津見神', 'わたつみのかみ'], '癸': ['雨', '罔象女神', 'みつはのめのかみ'] };
  var DISHI = { '长生': '長生', '沐浴': '沐浴', '冠带': '冠帯', '临官': '臨官', '帝旺': '帝旺', '衰': '衰',
    '病': '病', '死': '死', '墓': '墓', '绝': '絶', '胎': '胎', '养': '養' };
  var KYUSEI = { 1: '一白水星', 2: '二黒土星', 3: '三碧木星', 4: '四緑木星', 5: '五黄土星',
    6: '六白金星', 7: '七赤金星', 8: '八白土星', 9: '九紫火星' };
  var LON = { '北海道': 141.35, '青森': 140.74, '岩手': 141.15, '宮城': 140.87, '秋田': 140.10, '山形': 140.36,
    '福島': 140.47, '茨城': 140.45, '栃木': 139.88, '群馬': 139.06, '埼玉': 139.65, '千葉': 140.12,
    '東京': 139.69, '神奈川': 139.64, '新潟': 139.02, '富山': 137.21, '石川': 136.63, '福井': 136.22,
    '山梨': 138.57, '長野': 138.18, '岐阜': 136.72, '静岡': 138.38, '愛知': 136.91, '三重': 136.51,
    '滋賀': 135.87, '京都': 135.76, '大阪': 135.52, '兵庫': 135.18, '奈良': 135.83, '和歌山': 135.17,
    '鳥取': 134.24, '島根': 133.05, '岡山': 133.93, '広島': 132.46, '山口': 131.47, '徳島': 134.56,
    '香川': 134.04, '愛媛': 132.77, '高知': 133.53, '福岡': 130.42, '佐賀': 130.30, '長崎': 129.87,
    '熊本': 130.74, '大分': 131.61, '宮崎': 131.42, '鹿児島': 130.56, '沖縄': 127.68 };

  var KANGO = [['甲', '己'], ['乙', '庚'], ['丙', '辛'], ['丁', '壬'], ['戊', '癸']];
  var RIKUGO = [['子', '丑'], ['寅', '亥'], ['卯', '戌'], ['辰', '酉'], ['巳', '申'], ['午', '未']];
  var CHU = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
  var SANGO = [[['申', '子', '辰'], '水'], [['亥', '卯', '未'], '木'], [['寅', '午', '戌'], '火'], [['巳', '酉', '丑'], '金']];

  var GAN_YOMI = { '甲': 'きのえ', '乙': 'きのと', '丙': 'ひのえ', '丁': 'ひのと', '戊': 'つちのえ',
    '己': 'つちのと', '庚': 'かのえ', '辛': 'かのと', '壬': 'みずのえ', '癸': 'みずのと' };
  var ZHI_YOMI = { '子': 'ね', '丑': 'うし', '寅': 'とら', '卯': 'う', '辰': 'たつ', '巳': 'み',
    '午': 'うま', '未': 'ひつじ', '申': 'さる', '酉': 'とり', '戌': 'いぬ', '亥': 'い' };

  function inPairs(list, a, b) {
    if (a === b) return false;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if ((p[0] === a && p[1] === b) || (p[0] === b && p[1] === a)) return true;
    }
    return false;
  }
  function mod(n, m) { return ((n % m) + m) % m; }
  function cmpMD(m1, d1, m2, d2) { return m1 < m2 || (m1 === m2 && d1 < d2); }
  function ageOn(b, y, m, d) { return y - b.y - (cmpMD(m, d, b.m, b.d) ? 1 : 0); }
  function yearGz(y) { return Solar.fromYmd(y, 6, 1).getLunar().getYearInGanZhiByLiChun(); }
  function star(dg, g) { return JA[LunarUtil.SHI_SHEN[dg + g]]; }
  function yomi(gz) { return GAN_YOMI[gz.charAt(0)] + ZHI_YOMI[gz.charAt(1)]; }

  function parseYmd(ymd) {
    var p = ymd.split('-').map(Number);
    return { y: p[0], m: p[1], d: p[2] };
  }

  function solarTime(b, hm, lon) {
    var t = hm.split(':').map(Number);
    var start = Date.UTC(b.y, 0, 1);
    var cur = Date.UTC(b.y, b.m - 1, b.d);
    var n = Math.round((cur - start) / 86400000) + 1;
    var rad = (360 / 365 * (n - 81)) * Math.PI / 180;
    var eot = 9.87 * Math.sin(2 * rad) - 7.53 * Math.cos(rad) - 1.5 * Math.sin(rad);
    var diff = (lon - 135) * 4 + eot;
    var dt = new Date(Date.UTC(b.y, b.m - 1, b.d, t[0], t[1]) + Math.trunc(diff * 60000));
    return {
      y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate(),
      h: dt.getUTCHours(), mi: dt.getUTCMinutes(), diff: Math.round(diff * 10) / 10
    };
  }

  function kyusei(y, m, d) {
    var s = Solar.fromYmd(y, m, d);
    var ly = s.getLunar().getYearInGanZhiByLiChun();
    var yy = ly === yearGz(y) ? y : y - 1;
    var k = mod(11 - mod(yy, 9), 9) || 9;
    var start = { 1: 8, 4: 8, 7: 8, 3: 5, 6: 5, 9: 5, 2: 2, 5: 2, 8: 2 }[k];
    var zhi = s.getLunar().getEightChar().getMonth().charAt(1);
    var idx = '寅卯辰巳午未申酉戌亥子丑'.indexOf(zhi);
    var mk = mod(start - idx - 1, 9) + 1;
    return { hon: KYUSEI[k], getsu: KYUSEI[mk] };
  }

  /* 年表：大運の切り替わり2・日支とぶつかる年2・日柱と同じ干支の年2・日支と結びつく年1。
     過去は15歳以上から点の高い順に3つ（同点は新しい年）。今年と次の節目（2点以上）も出す。 */
  function makeNenpyo(b, dayPillar, dz, yun, today) {
    var st = yun.getStartSolar();
    var starts = {};
    for (var k = 0; k < 9; k++) {
      var y0 = st.getYear() + 10 * k;
      starts[y0] = { m: st.getMonth(), d: Math.min(st.getDay(), 28) };
    }
    var rows = [];
    for (var y = b.y + 1; y < today.y + 16; y++) {
      var gz = yearGz(y);
      var kinds = [], pt = 0;
      if (starts[y]) { kinds.push('kirikae'); pt += 2; }
      if (inPairs(CHU, gz.charAt(1), dz)) { kinds.push('chu'); pt += 2; }
      if (gz === dayPillar) { kinds.push('fukugin'); pt += 2; }
      if (inPairs(RIKUGO, gz.charAt(1), dz)) { kinds.push('go'); pt += 1; }
      if (!pt) continue;
      var period = starts[y]
        ? y + '年' + starts[y].m + '月' + starts[y].d + '日〜'
        : y + '年2月〜' + (y + 1) + '年1月';
      rows.push({
        year: y, gz: gz, pt: pt, period: period,
        age: ageOn(b, y, 2, 4) + '〜' + ageOn(b, y + 1, 1, 31) + '歳', kinds: kinds
      });
    }
    var past = rows.filter(function (r) { return r.year < today.y && ageOn(b, r.year, 2, 4) >= 15; });
    past.sort(function (p, q) { return (q.pt - p.pt) || (q.year - p.year); });
    past = past.slice(0, 3);
    var now = null, next = null;
    for (var i = 0; i < rows.length; i++) {
      if (!now && rows[i].year === today.y) now = rows[i];
      if (!next && rows[i].year > today.y && rows[i].pt >= 2) next = rows[i];
    }
    if (!now) {
      now = { year: today.y, gz: yearGz(today.y), pt: 0, period: today.y + '年2月〜' + (today.y + 1) + '年1月',
        age: ageOn(b, today.y, 2, 4) + '〜' + ageOn(b, today.y + 1, 1, 31) + '歳', kinds: [] };
    }
    return { past: past, now: now, next: next };
  }

  function chart(opt) {
    var name = opt.name || '';
    var b = parseYmd(opt.date);
    var sex = (opt.sex || 'M').toUpperCase().charAt(0) === 'M' ? 'M' : 'F';
    var now = opt.today ? parseYmd(opt.today) : (function () {
      var t = new Date(); return { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
    })();
    var hasTime = !!opt.time;
    var note = [];
    var s;
    if (hasTime) {
      var lon = opt.lon != null ? opt.lon : (LON[(opt.place || '').replace(/県|都|府/g, '')] || 135.0);
      var st = solarTime(b, opt.time, lon);
      note.push('太陽時補正 ' + (st.diff >= 0 ? '+' : '') + st.diff.toFixed(1) + '分（経度' + lon + '）');
      s = Solar.fromYmdHms(st.y, st.m, st.d, st.h, st.mi, 0);
    } else {
      s = Solar.fromYmdHms(b.y, b.m, b.d, 12, 0, 0);
    }
    var e = s.getLunar().getEightChar();
    var dg = e.getDayGan();
    var pillars = { '年柱': e.getYear(), '月柱': e.getMonth(), '日柱': e.getDay() };
    if (hasTime) pillars['時柱'] = e.getTime();

    var gan = { '年干': JA[e.getYearShiShenGan()], '月干': JA[e.getMonthShiShenGan()] };
    var zhi = { '年支': JA[e.getYearShiShenZhi()[0]], '月支': JA[e.getMonthShiShenZhi()[0]], '日支': JA[e.getDayShiShenZhi()[0]] };
    var dishi = { '年': DISHI[e.getYearDiShi()], '月': DISHI[e.getMonthDiShi()], '日': DISHI[e.getDayDiShi()] };
    var hide = { '年支': e.getYearHideGan(), '月支': e.getMonthHideGan(), '日支': e.getDayHideGan() };
    if (hasTime) {
      gan['時干'] = JA[e.getTimeShiShenGan()];
      zhi['時支'] = JA[e.getTimeShiShenZhi()[0]];
      dishi['時'] = DISHI[e.getTimeDiShi()];
      hide['時支'] = e.getTimeHideGan();
    }

    /* タイプ判定：年干・月干・年支・月支・日支（本気）。同数は月支→月干→日支→年支→年干 */
    var items = [['年干', e.getYearShiShenGan()], ['月干', e.getMonthShiShenGan()], ['年支', e.getYearShiShenZhi()[0]],
      ['月支', e.getMonthShiShenZhi()[0]], ['日支', e.getDayShiShenZhi()[0]]];
    var cnt = {}, order = [];
    items.forEach(function (it) {
      var g = GROUP[it[1]];
      if (!(g in cnt)) { cnt[g] = 0; order.push(g); }
      cnt[g]++;
    });
    var top = Math.max.apply(null, order.map(function (g) { return cnt[g]; }));
    var dd = {};
    items.forEach(function (it) { dd[it[0]] = it[1]; });
    var deciding = ['月支', '月干', '日支', '年支', '年干'].filter(function (o) { return cnt[GROUP[dd[o]]] === top; })[0];
    var grp = GROUP[dd[deciding]];
    var god = GOD[dg];
    var ky = kyusei(b.y, b.m, b.d);
    var yun = e.getYun(sex === 'M' ? 1 : 0);
    var dayun = yun.getDaYun().slice(1, 9).map(function (dy) {
      var gz = dy.getGanZhi();
      return { start: dy.getStartYear(), age: dy.getStartYear() - b.y, gz: gz, star: star(dg, gz.charAt(0)) };
    });
    var dz = pillars['日柱'].charAt(1);
    var nenpyo = makeNenpyo(b, pillars['日柱'], dz, yun, now);
    var branches = {};
    Object.keys(pillars).forEach(function (k) { branches[k.replace('柱', '支')] = pillars[k].charAt(1); });

    return {
      name: name, date: opt.date, time: opt.time || null, sex: sex, note: note, birth: b, today: now,
      pillars: pillars, ganStar: gan, zhiStar: zhi, dishi: dishi, hide: hide,
      count: cnt, countOrder: order,
      type: {
        dg: dg, material: god[0], shin: SHIN[dg], god: god[1], godYomi: god[2],
        origin: '日本神話では' + god[1] + '（' + god[2] + '）にあたる生まれ',
        group: grp, role: ROLE[grp], ten: TEN_NAME[dd[deciding]], tenStar: JA[dd[deciding]],
        title: SHIN[dg] + 'の' + ROLE[grp], deciding: deciding
      },
      kyusei: ky, dayun: dayun, nenpyo: nenpyo,
      thisYear: { gz: yearGz(now.y), star: star(dg, yearGz(now.y).charAt(0)) },
      _raw: { dg: dg, dz: dz, branches: branches }
    };
  }

  function compat(a, b) {
    var ra = a._raw, rb = b._raw;
    var out = {
      aToB: star(ra.dg, rb.dg), bToA: star(rb.dg, ra.dg),
      aToBGroup: null, bToAGroup: null,
      kango: inPairs(KANGO, ra.dg, rb.dg), rel: []
    };
    Object.keys(ra.branches).forEach(function (pi) {
      var x = ra.branches[pi];
      Object.keys(rb.branches).forEach(function (pj) {
        var y = rb.branches[pj], tag = null, el = null;
        if (inPairs(RIKUGO, x, y)) tag = '支合';
        else if (inPairs(CHU, x, y)) tag = '冲';
        else if (x === y) tag = '同じ支';
        else {
          SANGO.forEach(function (sg) {
            if (sg[0].indexOf(x) >= 0 && sg[0].indexOf(y) >= 0) { tag = '半会'; el = sg[1]; }
          });
        }
        if (tag) out.rel.push({ a: pi, b: pj, x: x, y: y, tag: tag, el: el });
      });
    });
    var sa = values(ra.branches), sb = values(rb.branches);
    out.sango = [];
    SANGO.forEach(function (sg) {
      var g = sg[0];
      var all = g.every(function (z) { return sa.indexOf(z) >= 0 || sb.indexOf(z) >= 0; });
      var anyA = g.some(function (z) { return sa.indexOf(z) >= 0; });
      var anyB = g.some(function (z) { return sb.indexOf(z) >= 0; });
      var fullA = g.every(function (z) { return sa.indexOf(z) >= 0; });
      var fullB = g.every(function (z) { return sb.indexOf(z) >= 0; });
      if (all && anyA && anyB && !fullA && !fullB) out.sango.push({ zhi: g.slice().sort().join(''), el: sg[1] });
    });
    out.tenchi = out.kango && inPairs(RIKUGO, ra.dz, rb.dz);
    var inv = {};
    Object.keys(JA).forEach(function (k) { inv[JA[k]] = GROUP[k]; });
    out.aToBGroup = inv[out.aToB];
    out.bToAGroup = inv[out.bToA];
    return out;
  }

  function values(o) { return Object.keys(o).map(function (k) { return o[k]; }); }

  root.Meishiki = {
    chart: chart, compat: compat, yomi: yomi, yearGz: yearGz, star: star,
    GROUP_OF_STAR: (function () { var m = {}; Object.keys(JA).forEach(function (k) { m[JA[k]] = GROUP[k]; }); return m; })(),
    ROLE: ROLE, PREFS: Object.keys(LON)
  };
})(this);
