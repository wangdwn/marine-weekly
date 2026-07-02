/* =========================================================================
 * 海洋经济与蓝色国土周报 · 静态刊物引擎
 * 架构：渲染壳 + data/ 目录。每期一个 JSON（data/issue-N.json），
 * 目录清单在 data/index.json。新增一期 = 丢一个 JSON + 追加一行清单。
 * ========================================================================= */
(function () {
  'use strict';

  /* ---------- 板块注册表 ----------
   * tab 的显示顺序、图标、桌面/移动端标签都在这里改。
   * 某期 JSON 里没有的 tab 会自动隐藏，所以每期板块可以不同。 */
  var TAB_REGISTRY = [
    { key: 'overview',   icon: '📊', label: '本周总览',     short: '总览' },
    { key: 'bluecarbon', icon: '🌿', label: '蓝碳与生态',   short: '蓝碳' },
    { key: 'coast',      icon: '🪨', label: '海岸带与地质安全', short: '海岸带' },
    { key: 'energy',     icon: '⚡', label: '海洋能源',     short: '能源' },
    { key: 'medicine',   icon: '🧬', label: '海洋生物医药', short: '医药' },
    { key: 'portship',   icon: '⚓', label: '港航与船舶',   short: '港航' },
    { key: 'tourism',    icon: '🏝️', label: '滨海旅游',     short: '旅游' },
    { key: 'nansha',     icon: '🌊', label: '南沙动态',     short: '南沙' },
    { key: 'suggest',    icon: '💼', label: '工作建议',     short: '建议' }
  ];

  var CN_NUMS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

  var state = { issues: [], currentIssue: null, currentTab: 'overview' };

  /* ======================================================================
   * 政务语义高亮引擎
   * 生成端只输出纯文本；"领导一眼抓重点"的排版由这里确定性兜底。
   * 与生成提示词协同：提示词引导 LLM 把关键结论装进这些信号句式。
   * ==================================================================== */
  var STRONG_RULES = [
    /(标志着[^。！？\n]+[。！？]?)/g,                                   // 定性判断句
    /(意味着[^。！？\n]+[。！？]?)/g,
    /((?:建议|需关注|应重点|加快推动|抢抓|把握|宜尽快)[^。！？\n]+[。！？]?)/g, // 行动指向句
    /((?:将带动|将推动|将促进|将形成)[^。！？\n]+[。！？]?)/g,           // 影响预判句
    /(打破[^。！？\n]{0,15}垄断[^。！？\n]{0,10}[。！？]?)/g,
    /(重要意义|重要支撑|关键支撑|重大突破)/g,
    /((?:全球|全国|国内|世界|我国|全省|全市)?首(?:艘|次|个|单|台|家|批|座|宗)(?:量产)?)/g, // 首创性
    /(创历史新高|历史性突破|填补(?:国内|省内|国际)?空白|稳居|全面突破)/g,
    /(量价齐升|超级周期|景气度高|需求旺盛|持续高位|高位运行|大幅反弹|持续火热)/g, // 行情信号
    /(全面开工|正式印发|正式施行|正式发布|获批|竣工验收|完成试航|全面启动|正式落地)/g, // 节点事件
    /(热点[一二三四五][：:])/g
  ];
  var NUM_RULE = /(\d[\d,.]*\s?(?:万|亿|千)?(?:元人民币|亿美元|万美元|亿元|万元|吨|万吨|艘|座|个泊位|千米|公里|平方公里|公顷|标准箱|万标箱|万人次|人次|亿千瓦时|万千瓦|兆瓦|吉瓦|亿立方米|米|元\/吨|班次|%|个百分点|倍|点|家|项|宗|个))/g;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** 高亮：先转义，再按规则注入标记 */
  function hl(text) {
    if (!text) return '';
    var s = esc(text);
    s = s.replace(/\[推断\]\s*/g, '<span class="tag-infer">推断</span>'); // 事实/研判分离标记
    STRONG_RULES.forEach(function (re) { s = s.replace(re, '<strong>$1</strong>'); });
    s = s.replace(NUM_RULE, '<span class="hl-num">$1</span>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  /* ======================================================================
   * 数据加载：data/index.json（目录）→ data/issue-N.json（懒加载）
   * ==================================================================== */
  function getJSON(url) {
    return fetch(url).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).catch(function (e) {
      throw new Error('数据加载失败（' + e.message + '）。若在本地打开，请用 python3 -m http.server 启动后访问。');
    });
  }

  function boot() {
    showLoading(true);
    getJSON('data/index.json').then(function (list) {
      state.issues = list;
      var n = parseInt(location.hash.replace('#issue-', ''), 10);
      if (!n || n < 1 || n > list.length) n = list[list.length - 1].issue;
      return loadIssue(n);
    }).catch(function (e) { showError(e.message); });
  }

  function loadIssue(n) {
    showLoading(true);
    var t0 = Date.now();
    return getJSON('data/issue-' + n + '.json')
      .then(function (data) {           // 最少展示 200ms，避免闪烁
        var wait = 200 - (Date.now() - t0);
        return wait > 0 ? new Promise(function (ok) { setTimeout(function () { ok(data); }, wait); }) : data;
      })
      .then(function (data) {
        state.currentIssue = data;
        renderIssue(data);
        showLoading(false);
        buildIssueDropdown();
      })
      .catch(function (e) { showLoading(false); showError(e.message); });
  }

  function gotoIssue(n) {
    closeDropdowns();
    if (state.currentIssue && n === state.currentIssue.issue) return;
    location.hash = 'issue-' + n;
    loadIssue(n);
  }

  /* ======================================================================
   * 整期渲染
   * ==================================================================== */
  function renderIssue(d) {
    // 刊头元信息
    document.getElementById('header-meta').innerHTML =
      '<span><span class="label">期号</span>' + esc(d.year || '') + '年第' + d.issue + '期（总第' + d.total + '期）</span>' +
      '<span><span class="label">数据区间</span>' + esc(d.dateRange) + '</span>' +
      '<span><span class="label">发布日期</span>' + esc(d.publishDate) + '</span>';
    document.title = (d.masthead && d.masthead.title ? d.masthead.title : '海洋经济与蓝色国土周报') + '（第' + d.issue + '期）';
    if (d.masthead) {
      if (d.masthead.title) document.getElementById('header-title').textContent = d.masthead.title;
      if (d.masthead.org)   document.getElementById('header-org').textContent = d.masthead.org;
    }
    document.getElementById('switcher-num').textContent = '第' + d.issue + '期';
    renderDots('switcher-dots', 'switcher-dot', d.issue);
    renderMobilePager(d);

    // 本期实际存在的 tab（按注册表顺序）
    var tabs = TAB_REGISTRY.filter(function (t) { return d.tabs && d.tabs[t.key]; });
    if (!tabs.some(function (t) { return t.key === state.currentTab; })) state.currentTab = tabs.length ? tabs[0].key : 'overview';
    renderNav(tabs);

    // 各 tab 页面
    var box = document.getElementById('content-container');
    box.innerHTML = '';
    tabs.forEach(function (t) {
      var page = document.createElement('div');
      page.className = 'tab-page';
      page.id = 'page-' + t.key;
      page.innerHTML = renderTab(d.tabs[t.key], d);
      box.appendChild(page);
    });

    switchTab(state.currentTab, true);
  }

  function renderDots(elId, cls, active) {
    var el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = '';
    state.issues.forEach(function (it) {
      var s = document.createElement('span');
      s.className = cls + (it.issue === active ? ' active' : '');
      el.appendChild(s);
    });
  }

  function renderMobilePager(d) {
    document.getElementById('mp-num').textContent = '第' + d.issue + '期';
    document.getElementById('mp-date').textContent =
      String(d.dateRange).replace(/月/g, '.').replace(/日/g, '').replace(/[—–]/g, '-');
    renderDots('mp-dots', 'mp-dot', d.issue);
  }

  /* ---------- 导航（顶部 tab + 移动端底栏），数据驱动 ---------- */
  function renderNav(tabs) {
    var top = document.getElementById('top-nav-tabs');
    var bar = document.getElementById('tab-bar');
    top.innerHTML = ''; bar.innerHTML = '';
    tabs.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'top-nav-link'; b.dataset.tab = t.key;
      b.innerHTML = '<span class="ico">' + t.icon + '</span>' + esc(t.label);
      b.addEventListener('click', function () { switchTab(t.key, false); });
      top.appendChild(b);

      var m = document.createElement('button');
      m.className = 'tab-bar-item'; m.dataset.tab = t.key;
      m.innerHTML = '<span class="ico">' + t.icon + '</span><span class="lbl">' + esc(t.short) + '</span>';
      m.addEventListener('click', function () { switchTab(t.key, false); });
      bar.appendChild(m);
    });
  }

  /* ======================================================================
   * 单个 tab 渲染。卡片编号规则：
   *   - kpis 存在 → 自动生成"一 · 核心数据"卡片
   *   - cards 依声明顺序编号（可自带 num 覆盖）
   *   - suggests 存在 → 末尾自动生成"工作建议"卡片
   * 渲染时顺带收集 [编号, 短标签]，供左侧锚点导航使用。
   * ==================================================================== */
  function renderTab(tab, issue) {
    var html = '', cardIdx = 0, anchors = [];
    function nextNum() { return CN_NUMS[Math.min(cardIdx++, CN_NUMS.length - 1)]; }

    if (tab.summary) {
      html += '<section class="section-card plain"><div class="section-card-head">' +
        '<span class="section-card-icon">📋</span><div><div class="section-card-title">本期概览</div></div></div>' +
        '<div class="section-card-body"><div class="briefing-content">' + hl(tab.summary) + '</div></div></section>';
    }

    if (tab.kpis && tab.kpis.length) {
      var num = nextNum();
      anchors.push([num, '核心数据']);
      html += '<section class="section-card" data-card-num="' + num + '">' + cardHead(num, '📈', '核心数据', 'Core Data') +
        '<div class="section-card-body"><div class="kpi-grid">';
      tab.kpis.forEach(function (k) {
        var dir = k.isUp ? 'up' : 'down', arrow = k.isUp ? '▲' : '▼';
        html += '<div class="kpi-card"><div class="kpi-label">' + esc(k.label) + '</div>' +
          '<div class="kpi-value">' + esc(k.value) + '<span class="kpi-unit">' + esc(k.unit || '') + '</span></div>' +
          (k.change ? '<div class="kpi-change ' + dir + '">' + arrow + ' ' + esc(k.change) + '</div>' : '') +
          '</div>';
      });
      html += '</div>' + (tab.tables || []).map(renderTable).join('') + '</div></section>';
    }

    (tab.briefings || []).forEach(function (b) {
      html += '<section class="section-card plain"><div class="section-card-head">' +
        '<span class="section-card-icon">📋</span><div><div class="section-card-title">' + esc(b.title) + '</div></div></div>' +
        '<div class="section-card-body"><div class="briefing-content">' + hl(b.content) + '</div></div></section>';
    });

    (tab.cards || []).forEach(function (c) {
      var num = c.num || nextNum();
      if (c.num) cardIdx = Math.max(cardIdx, CN_NUMS.indexOf(c.num) + 1);
      anchors.push([num, c.shortTitle || c.title]);
      html += '<section class="section-card" data-card-num="' + num + '">' +
        cardHead(num, c.icon || '📋', c.title, c.enTitle) + '<div class="section-card-body">';
      (c.items || []).forEach(function (it) {
        var color = it.badge && it.badge.color ? it.badge.color : 'blue';
        var text = it.badge && it.badge.text ? it.badge.text : '动态';
        html += '<article class="item-block"><div class="head">' +
          '<span class="badge badge-' + esc(color) + '">' + esc(text) + '</span>' +
          '<span class="title">' + esc(it.title) + '</span></div>' +
          '<div class="content">' + hl(it.content) + '</div>' +
          (it.impact ? '<div class="impact">' + hl(it.impact) + '</div>' : '') +
          (it.source ? '<div class="source"><strong>来源：</strong>' + hl(it.source) + '</div>' : '') +
          '</article>';
      });
      (c.tables || []).forEach(function (t) { html += renderTable(t); });
      html += '</div></section>';
    });

    if (tab.suggests && tab.suggests.length) {
      var num = nextNum();
      anchors.push([num, '工作建议']);
      html += '<section class="section-card suggest-card" data-card-num="' + num + '">' +
        cardHead(num, '💡', tab.suggestTitle || '工作建议', 'Recommendations') + '<div class="section-card-body">';
      tab.suggests.forEach(function (s) {
        html += '<article class="suggest-item"><div class="head"><span class="num">' + esc(s.num) + '</span>' +
          '<span class="stitle">' + esc(s.title) + '</span></div>' +
          '<div class="body">' + hl(s.body) + '</div>' +
          (s.basis ? '<div class="basis"><strong>依据</strong>' + hl(s.basis) + '</div>' : '') +
          '</article>';
      });
      html += '</div></section>';
    }

    html += '<footer class="footer-block"><strong>《' +
      esc(issue.masthead && issue.masthead.title ? issue.masthead.title : '海洋经济与蓝色国土周报') +
      '》</strong> · ' + esc(issue.year || '') + '年第' + issue.issue + '期（总第' + issue.total + '期）<br>' +
      '本报所引数据均来自公开发布信息，仅供内部参阅，不构成投资建议。</footer>';

    // 把锚点清单塞进隐藏节点，切 tab 时读取重建侧边栏
    html = '<script type="application/json" class="anchors-data">' + JSON.stringify(anchors) + '</scr' + 'ipt>' + html;
    return html;
  }

  function cardHead(num, icon, title, en) {
    return '<div class="section-card-head"><div class="section-card-num">' + num + '</div>' +
      '<span class="section-card-icon">' + icon + '</span>' +
      '<div><div class="section-card-title">' + esc(title) + '</div>' +
      (en ? '<div class="section-card-sub">' + esc(en) + '</div>' : '') + '</div></div>';
  }

  function renderTable(t) {
    var h = '<div class="table-wrap">' + (t.title ? '<div class="table-title">' + esc(t.title) + '</div>' : '') +
      '<div class="table-scroll"><table class="data-table"><thead><tr>';
    (t.headers || []).forEach(function (x) { h += '<th>' + esc(x) + '</th>'; });
    h += '</tr></thead><tbody>';
    (t.rows || []).forEach(function (row) {
      h += '<tr>';
      row.forEach(function (cell) {
        var c = String(cell).trim(), cls = '';
        if (c[0] === '+' || c[0] === '▲') cls = ' class="cell-up"';
        if (c[0] === '-' || c[0] === '▼') cls = ' class="cell-down"';
        h += '<td' + cls + '>' + esc(cell) + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody></table></div>' +
      (t.source ? '<div class="table-source"><strong>数据来源：</strong>' + esc(t.source) + '</div>' : '') + '</div>';
    return h;
  }

  /* ======================================================================
   * Tab 切换 + 左侧锚点导航（scroll-spy）
   * ==================================================================== */
  function switchTab(key, keepScroll) {
    state.currentTab = key;
    ['top-nav-link', 'tab-bar-item'].forEach(function (cls) {
      document.querySelectorAll('.' + cls).forEach(function (el) {
        el.classList.toggle('active', el.dataset.tab === key);
      });
    });
    document.querySelectorAll('.tab-page').forEach(function (p) {
      p.classList.toggle('active', p.id === 'page-' + key);
    });
    buildSidebar(key);
    if (!keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function buildSidebar(key) {
    var side = document.getElementById('sidebar-nav');
    var page = document.getElementById('page-' + key);
    var data = page && page.querySelector('.anchors-data');
    var anchors = [];
    try { anchors = data ? JSON.parse(data.textContent) : []; } catch (e) {}
    if (!anchors.length) { side.style.display = 'none'; return; }
    side.style.display = '';
    side.innerHTML = '<div class="sidebar-nav-inner">' + anchors.map(function (a) {
      return '<div class="sidebar-num" data-num="' + a[0] + '"><span class="circle">' + a[0] +
        '</span><span class="label">' + esc(shorten(a[1])) + '</span></div>';
    }).join('') + '</div>';
    side.querySelectorAll('.sidebar-num').forEach(function (el) {
      el.addEventListener('click', function () {
        var target = page.querySelector('[data-card-num="' + el.dataset.num + '"]');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    spy();
  }

  function shorten(s) { s = String(s || ''); return s.length > 6 ? s.slice(0, 6) : s; }

  var spyRaf = null;
  function spy() {
    if (spyRaf) cancelAnimationFrame(spyRaf);
    spyRaf = requestAnimationFrame(function () {
      var side = document.getElementById('sidebar-nav');
      if (!side || side.style.display === 'none') return;
      var page = document.querySelector('.tab-page.active');
      if (!page) return;
      var cards = page.querySelectorAll('[data-card-num]');
      var links = side.querySelectorAll('.sidebar-num');
      if (!cards.length || !links.length) return;
      var cur = null;
      cards.forEach(function (c) { if (c.getBoundingClientRect().top <= 130) cur = c.dataset.cardNum; });
      if (!cur) cur = links[0].dataset.num;
      links.forEach(function (l) { l.classList.toggle('active', l.dataset.num === cur); });
    });
  }

  /* ======================================================================
   * 期数下拉（桌面 + 移动）
   * ==================================================================== */
  function buildIssueDropdown() {
    var dd = document.getElementById('issue-dropdown');
    dd.innerHTML = '';
    state.issues.slice().reverse().forEach(function (it) {
      var d = document.createElement('div');
      d.className = 'issue-dropdown-item' + (state.currentIssue && it.issue === state.currentIssue.issue ? ' active' : '');
      d.textContent = it.title + ' · ' + it.dateRange;
      d.addEventListener('click', function (e) { e.stopPropagation(); gotoIssue(it.issue); });
      dd.appendChild(d);
    });
    var mpd = document.getElementById('mp-dropdown');
    mpd.innerHTML = '';
    state.issues.slice().reverse().forEach(function (it) {
      var act = state.currentIssue && it.issue === state.currentIssue.issue;
      var d = document.createElement('div');
      d.className = 'mpd-item' + (act ? ' active' : '');
      d.innerHTML = '<span>' + esc(it.title) + ' <span class="mpd-date">' + esc(it.dateRange) + '</span></span><span class="mpd-check">✓</span>';
      d.addEventListener('click', function (e) { e.stopPropagation(); mpd.classList.remove('open'); gotoIssue(it.issue); });
      mpd.appendChild(d);
    });
  }

  function toggleDesktopDropdown(e) {
    e.stopPropagation();
    var dd = document.getElementById('issue-dropdown');
    if (dd.classList.contains('open')) { dd.classList.remove('open'); return; }
    var r = document.getElementById('issue-dropdown-trigger').getBoundingClientRect();
    dd.style.top = (r.bottom + 6) + 'px';
    dd.style.left = Math.max(r.left - 40, 8) + 'px';
    dd.classList.add('open');
  }

  function closeDropdowns() {
    document.getElementById('issue-dropdown').classList.remove('open');
    var mpd = document.getElementById('mp-dropdown');
    if (mpd) mpd.classList.remove('open');
  }

  /* ---------- Loading / 错误 / 回到顶部 ---------- */
  function showLoading(on) {
    document.getElementById('loading-overlay').classList.toggle('hidden', !on);
  }
  function showError(msg) {
    document.getElementById('content-container').innerHTML =
      '<div class="error-box"><div class="icon">⚠️</div><p>' + esc(msg) + '</p>' +
      '<button onclick="location.reload()">重新加载</button></div>';
    showLoading(false);
  }

  /* ---------- 事件绑定 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('switcher-prev').addEventListener('click', function (e) {
      e.stopPropagation();
      if (state.currentIssue && state.currentIssue.issue > 1) gotoIssue(state.currentIssue.issue - 1);
    });
    document.getElementById('switcher-next').addEventListener('click', function (e) {
      e.stopPropagation();
      if (state.currentIssue && state.currentIssue.issue < state.issues.length) gotoIssue(state.currentIssue.issue + 1);
    });
    document.getElementById('issue-dropdown-trigger').addEventListener('click', toggleDesktopDropdown);

    document.getElementById('mp-prev').addEventListener('click', function (e) {
      e.stopPropagation();
      if (state.currentIssue && state.currentIssue.issue > 1) gotoIssue(state.currentIssue.issue - 1);
    });
    document.getElementById('mp-next').addEventListener('click', function (e) {
      e.stopPropagation();
      if (state.currentIssue && state.currentIssue.issue < state.issues.length) gotoIssue(state.currentIssue.issue + 1);
    });
    document.getElementById('mp-info').addEventListener('click', function (e) {
      e.stopPropagation();
      document.getElementById('mp-dropdown').classList.toggle('open');
    });

    document.addEventListener('click', closeDropdowns);

    var btt = document.getElementById('back-to-top');
    btt.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    window.addEventListener('scroll', function () {
      btt.style.display = window.scrollY > 300 ? 'flex' : 'none';
      document.getElementById('top-nav').classList.toggle('scrolled', window.scrollY > 10);
      spy();
    }, { passive: true });

    window.addEventListener('hashchange', function () {
      var n = parseInt(location.hash.replace('#issue-', ''), 10);
      if (n && state.currentIssue && n !== state.currentIssue.issue) loadIssue(n);
    });

    boot();
  });
})();
