// WEB interactions added on top of the Figma prototype:
// sticky header, GNB mega menus, live search (typing / suggestions / results),
// quick-service modals, hero carousel controls, and links for buttons without a Figma connection.
import { loadScreen } from './loader.js';

const GREEN = '#009178';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let winScroll = null; // active window scroll handler (one screen at a time)
let winKey = null;

/* ---------- helpers ---------- */
function texts(root) { return [...root.querySelectorAll('svg.T')]; }
function labelOf(svg) { return (svg.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim(); }
function boxIn(el, inner, k) {
  const a = el.getBoundingClientRect(), b = inner.getBoundingClientRect();
  return { x: (a.left - b.left) / k, y: (a.top - b.top) / k, w: a.width / k, h: a.height / k };
}
// nearest ancestor (with data-id) whose size fits, used as the click target for a text label
function hostFor(svg, inner, k, maxW = 420, maxH = 160) {
  let best = svg; let e = svg.parentElement;
  while (e && e !== inner) {
    if (e.hasAttribute && e.hasAttribute('data-id')) {
      const b = boxIn(e, inner, k);
      if (b.w > maxW || b.h > maxH) break;
      best = e;
    }
    e = e.parentElement;
  }
  return best;
}

/* ---------- toast ---------- */
function toast(text) {
  let t = document.querySelector('.wx-toast');
  if (!t) { t = document.createElement('div'); t.className = 'wx-toast'; document.body.appendChild(t); }
  t.textContent = text;
  t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('on'), 1800);
}

/* ---------- modal ---------- */
function modal(title, body, opts = {}) {
  closeModal();
  const m = document.createElement('div');
  m.className = 'wx-modal';
  m.innerHTML = `<div class="wx-dim"></div><div class="wx-dialog" style="width:${opts.w || 520}px">
    <div class="wx-mhead"><b>${title}</b><button class="wx-x" aria-label="닫기">×</button></div>
    <div class="wx-mbody">${body}</div></div>`;
  document.body.appendChild(m);
  requestAnimationFrame(() => m.classList.add('on'));
  m.querySelector('.wx-dim').addEventListener('click', closeModal);
  m.querySelector('.wx-x').addEventListener('click', closeModal);
  return m;
}
function closeModal() {
  const m = document.querySelector('.wx-modal'); if (!m) return;
  m.classList.remove('on'); setTimeout(() => m.remove(), 200);
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeSearch && closeSearch(); } });

const RATES = [['미국 USD', '1,382.50', '+2.30'], ['일본 JPY(100)', '912.44', '-1.12'], ['유럽 EUR', '1,503.18', '+4.05'], ['중국 CNY', '190.27', '+0.21'], ['호주 AUD', '912.03', '-0.84'], ['영국 GBP', '1,752.66', '+3.10']];
const ACCOUNTS = [['입출금 자립예탁금', '000-0000-0000', '346,698원'], ['하나 적금', '111-222222-33333', '1,200,000원'], ['3·6·9 정기예금', '444-555555-66666', '10,000,000원']];
let curGo = null;

const MODALS = {
  '빠른조회': () => modal('빠른조회', `<p class="wx-sub">김하나님의 계좌 잔액이에요.</p>${ACCOUNTS.map((a) => `<div class="wx-acc"><div><b>${a[0]}</b><span>${a[1]}</span></div><strong>${a[2]}</strong></div>`).join('')}
    <div class="wx-btns"><button class="wx-btn2" data-close>닫기</button><button class="wx-btn" data-go="1:34218">마이페이지에서 보기</button></div>`),
  '이체': () => {
    const m = modal('이체', `<label class="wx-l">출금계좌</label><div class="wx-in ro">입출금 자립예탁금 000-0000-0000 · 잔액 346,698원</div>
      <label class="wx-l">받는 분 은행</label><select class="wx-in"><option>하나은행</option><option>KB국민은행</option><option>신한은행</option><option>우리은행</option><option>NH농협은행</option><option>카카오뱅크</option><option>토스뱅크</option></select>
      <label class="wx-l">받는 분 계좌번호</label><input class="wx-in" inputmode="numeric" placeholder="'-' 없이 숫자만 입력" data-acct>
      <label class="wx-l">이체 금액</label><input class="wx-in" inputmode="numeric" placeholder="0원" data-amt>
      <div class="wx-quick">${['1만', '5만', '10만', '100만'].map((q) => `<button data-add="${parseInt(q, 10) * 10000}">+${q}</button>`).join('')}</div>
      <div class="wx-btns"><button class="wx-btn2" data-close>취소</button><button class="wx-btn" data-send>이체하기</button></div>`);
    const amt = m.querySelector('[data-amt]'), acct = m.querySelector('[data-acct]');
    let v = 0; const show = () => { amt.value = v ? v.toLocaleString('ko-KR') + '원' : ''; };
    amt.addEventListener('input', () => { v = +amt.value.replace(/\D/g, '') || 0; show(); });
    acct.addEventListener('input', () => { acct.value = acct.value.replace(/\D/g, '').slice(0, 14); });
    m.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => { v += +b.dataset.add; show(); amt.classList.remove('pop'); void amt.offsetWidth; amt.classList.add('pop'); }));
    m.querySelector('[data-send]').addEventListener('click', () => {
      if (acct.value.length < 10) { acct.classList.remove('shake'); void acct.offsetWidth; acct.classList.add('shake'); acct.focus(); return; }
      if (!v) { amt.classList.remove('shake'); void amt.offsetWidth; amt.classList.add('shake'); amt.focus(); return; }
      const bank = m.querySelector('select').value, acctNo = acct.value;
      const body = m.querySelector('.wx-mbody');
      body.innerHTML = '<div class="wx-busy"><div class="wx-spin"></div>이체하고 있어요</div>';
      setTimeout(() => {
        body.innerHTML = `<div class="wx-done"><svg width="64" height="64" viewBox="0 0 72 72"><circle cx="36" cy="36" r="36" fill="${GREEN}"/><path class="wx-check" d="M22 37l10 10 18-20" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          <b>이체가 완료되었어요</b><span>${esc(bank)} ${esc(acctNo)} 계좌로 ${v.toLocaleString('ko-KR')}원을 보냈어요</span></div>
          <div class="wx-btns"><button class="wx-btn" data-close>확인</button></div>`;
        body.querySelector('[data-close]').addEventListener('click', closeModal);
      }, 900);
    });
    acct.focus();
  },
  '환율': () => modal('오늘의 환율', `<p class="wx-sub">매매기준율 · ${new Date().toLocaleDateString('ko-KR')} 기준</p>
    <table class="wx-table"><tr><th>통화</th><th>매매기준율</th><th>전일대비</th></tr>${RATES.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="${r[2][0] === '+' ? 'up' : 'dn'}">${r[2][0] === '+' ? '▲' : '▼'} ${r[2].slice(1)}</td></tr>`).join('')}</table>
    <div class="wx-btns"><button class="wx-btn" data-toast="환전 신청 화면으로 연결돼요">환전 신청하기</button></div>`),
  '공과금': () => modal('공과금 납부', `${[['지로/생활요금', '전기·가스·수도 요금 납부'], ['국세/관세', '종합소득세, 부가세 납부'], ['지방세', '자동차세, 재산세 납부'], ['4대보험', '국민연금, 건강보험 납부']].map((r) => `<div class="wx-row" data-toast="${r[0]} 납부 화면으로 연결돼요"><div><b>${r[0]}</b><span>${r[1]}</span></div><i>›</i></div>`).join('')}`),
  '오픈뱅킹': () => modal('오픈뱅킹', `<p class="wx-sub">연결된 다른 은행 계좌예요.</p>${[['KB국민은행', '123-45-678901', '520,000원'], ['카카오뱅크', '3333-01-2345678', '88,400원']].map((a) => `<div class="wx-acc"><div><b>${a[0]}</b><span>${a[1]}</span></div><strong>${a[2]}</strong></div>`).join('')}
    <div class="wx-btns"><button class="wx-btn" data-toast="다른 은행 계좌를 연결할 수 있어요">계좌 연결하기</button></div>`),
  '고객센터': () => modal('고객센터', `<div class="wx-call"><span>대표번호</span><b>1588-1111 / 1599-1111</b></div><div class="wx-call"><span>해외</span><b>+82-42-520-2500</b></div>
    <p class="wx-sub">평일 09:00 ~ 18:00 상담원 연결 · 분실/사고 신고는 24시간 가능해요.</p>
    <div class="wx-btns"><button class="wx-btn2" data-toast="채팅 상담을 시작해요">채팅 상담</button><button class="wx-btn" data-go="1:32222">상담 예약</button></div>`),
  '인증센터': () => modal('인증센터', `${[['하나인증서', '비밀번호 6자리로 간편하게'], ['금융인증서', '클라우드에 저장하는 인증서'], ['공동인증서', '기존 공인인증서'], ['OTP 관리', '보안매체 등록·해지']].map((r) => `<div class="wx-row" data-toast="${r[0]} 화면으로 연결돼요"><div><b>${r[0]}</b><span>${r[1]}</span></div><i>›</i></div>`).join('')}`),
  '영업점 찾기': () => modal('영업점 찾기', `<input class="wx-in" placeholder="지역, 영업점명 검색" value="서울 중구"><div style="height:10px"></div>${[['서울터미널', '서울 중구 을지로 35 · 1.2km'], ['명동금융센터', '서울 중구 명동길 · 1.6km'], ['을지로3가', '서울 중구 을지로 · 2.0km']].map((r) => `<div class="wx-row" data-toast="${r[0]} 상세 정보를 보여드려요"><div><b>${r[0]}</b><span>${r[1]}</span></div><i>›</i></div>`).join('')}`),
  '자주 묻는 질문': () => {
    const qs = [['적금 중도해지 시 이자는 어떻게 되나요?', '중도해지 시에는 가입 기간에 따른 중도해지이율이 적용돼요.'], ['비대면으로 가입한 상품도 영업점에서 해지할 수 있나요?', '네, 신분증을 가지고 가까운 영업점을 방문하시면 해지할 수 있어요.'], ['우대금리는 언제 적용되나요?', '만기 해지 시 우대 조건 충족 여부를 확인한 뒤 적용돼요.']];
    const m = modal('자주 묻는 질문', qs.map((q) => `<div class="wx-faq"><div class="wx-q">${q[0]}<i>⌄</i></div><div class="wx-a">${q[1]}</div></div>`).join(''));
    m.querySelectorAll('.wx-faq').forEach((f) => f.querySelector('.wx-q').addEventListener('click', () => f.classList.toggle('open')));
  },
  '약관보기': () => modal('약관', `<div class="wx-terms">제1조 (목적) 이 약관은 주식회사 하나은행(이하 "은행")과 거래처(이하 "손님") 사이의 예금거래에 관한 기본적인 사항을 정함으로써 거래를 원활하게 하는 것을 목적으로 합니다.<br><br>제2조 (실명거래) ① 손님은 실명으로 거래하여야 합니다. ② 은행은 손님의 실명확인을 위하여 주민등록증·사업자등록증 등 실명확인증표 또는 그 밖에 필요한 서류의 제시나 제출을 요구할 수 있습니다.<br><br>제3조 (거래장소) 손님은 계좌를 개설한 영업점에서 모든 예금거래를 합니다. 다만, 은행이 정하는 바에 따라 다른 영업점이나 다른 금융기관, 또는 현금자동지급기 등을 통하여 거래할 수 있습니다.</div>
    <div class="wx-btns"><button class="wx-btn" data-close>확인</button></div>`),
  '추천 근거 보기': () => modal('추천 근거', `<p class="wx-sub">김하나님의 금융 정보를 바탕으로 추천했어요.</p>${[['예상 자금 운용 기간', '12개월 이상'], ['우대 금리 조건', '급여이체, 카드 실적'], ['희망 수익률', '연 3.5% 이상']].map((r) => `<div class="wx-call"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('')}`),
};
MODALS['조회'] = MODALS['빠른조회'];
MODALS['조회하기'] = MODALS['빠른조회'];
MODALS['환전지갑'] = MODALS['환율'];
MODALS['외화 관리'] = MODALS['환율'];
MODALS['상품공시실'] = MODALS['약관보기'];
MODALS['서식·약관자료실'] = MODALS['약관보기'];
MODALS['금리안내'] = () => modal('금리안내', `<table class="wx-table"><tr><th>상품</th><th>기간</th><th>기본금리</th><th>최고금리</th></tr>${[['3·6·9 정기예금', '12개월', '연 3.10%', '연 4.10%'], ['날아라 해외로 적금', '12개월', '연 3.00%', '연 4.10%'], ['급여하나 월복리 적금', '36개월', '연 3.15%', '연 4.15%'], ['주택청약종합저축', '-', '연 2.80%', '연 2.80%']].map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>`, { w: 600 });
MODALS['영업점찾기'] = MODALS['영업점 찾기'];
MODALS['손님의소리'] = () => modal('손님의소리', `<label class="wx-l">유형</label><select class="wx-in"><option>칭찬</option><option>제안</option><option>불만</option></select><label class="wx-l">내용</label><textarea class="wx-in" rows="4" placeholder="의견을 남겨주세요"></textarea><div class="wx-btns"><button class="wx-btn" data-toast="소중한 의견이 접수되었어요" data-close>등록하기</button></div>`);

// generic modal buttons
document.addEventListener('click', (e) => {
  const t = e.target.closest && e.target.closest('.wx-modal [data-close], .wx-modal [data-go], .wx-modal [data-toast]');
  if (!t) return;
  if (t.dataset.toast) toast(t.dataset.toast);
  if (t.dataset.go) { closeModal(); curGo && curGo(t.dataset.go); }
  if (t.hasAttribute('data-close')) closeModal();
});

/* ---------- label actions for buttons without a Figma connection ---------- */
const NAV = {
  '가입하기': '1:32376', '상세보기': '1:31635', '자세히 보기': '1:33805', '자세히보기': '1:33805', '비교하기': '1:31471', '상품 비교하기': '1:31471',
  '목록보기': '1:31012', '상담 예약': '1:32222', '예적금': '1:31012', '펀드': '1:31012', '퇴직연금': '1:31012', '대출': '1:31012',
  '인기 상품 확인': '1:33805', '여유자금 관리': '1:33805', '대출 조건 비교': '1:31471', '상품&가입': '1:31012', '상품상세정보': '1:31635',
  '예금': '1:34704',
};
const TOASTS = { '비교 담기': '상품비교함에 담았어요', '하나소비자세상': '하나소비자세상으로 연결돼요', '전체동의': '모든 약관에 동의했어요', '선택해제': '선택을 해제했어요',
  '저장': '저장되었어요', '총 잔액 보이기': '잔액을 표시해요', '총 잔액 숨기기': '잔액을 숨겼어요', '일정등록': '일정 등록 화면으로 연결돼요', '전체 일정 보기': '전체 일정을 보여드려요',
  '하나머니': '하나머니로 연결돼요', '이용자 비밀번호 변경하기': '비밀번호 변경 화면으로 연결돼요', '+ 더보기': '새소식 전체 목록을 보여드려요', '더보기': '새소식 전체 목록을 보여드려요',
  '하나더넥스트': '하나더넥스트로 연결돼요', '취소': null };
const FILTERS = ['예금/신탁', '정기예금', '적금', '입출금이 자유로운 예금', '외화상품', '신탁', '한시상품/ELD', '내 조건 기준', '온라인 가입상품', '출시순', '인기순', '금리순', '내 조건 기준으로 보기', '조건 다시 보기', '기본 목록으로 보기', '통장', '카드', '보험', '주식', '투자', '외환', '계좌관리', '외화/외화신탁', '예금/신탁/ISA', '보험/공제'];

function actionFor(label) {
  if (MODALS[label]) return () => MODALS[label]();
  if (NAV[label]) return { kind: 'nav', to: NAV[label] };
  if (label in TOASTS) return TOASTS[label] === null ? { kind: 'back' } : () => toast(TOASTS[label]);
  if (FILTERS.includes(label)) return () => toast(`'${label}' 조건으로 보여드려요`);
  return () => toast(`'${label}' 화면은 준비 중이에요`);
}

/* ---------- GNB mega menus ---------- */
const GNB = ['조회', '이체', '공과금', '외환', '금융상품'];
const MENUS = {
  '조회': [['계좌조회', ['전체계좌조회', '거래내역조회', '휴면계좌조회']], ['증명서', ['잔액증명서', '거래내역확인서']], ['수표', ['자기앞수표조회', '수표·어음조회']]],
  '이체': [['이체', ['계좌이체', '다계좌이체', '예약이체', '자동이체']], ['이체관리', ['이체결과조회', '이체한도 조회/변경', '자주쓰는계좌']], ['오픈뱅킹', ['오픈뱅킹 이체', '계좌 연결 관리']]],
  '공과금': [['납부', ['지로/생활요금', '국세/관세', '지방세', '4대보험']], ['조회', ['납부결과조회', '자동납부 관리']], ['기타', ['등록금', '아파트관리비']]],
  '외환': [['환율', ['환율조회', '환율알림']], ['환전', ['환전지갑', '외화 환전 신청', '환전내역 조회']], ['해외송금', ['해외송금 보내기', '해외송금 조회']], ['외화예금', ['외화예금 상품', '외화예금 조회']]],
};
const MENU_ACT = { '전체계좌조회': '빠른조회', '거래내역조회': '빠른조회', '계좌이체': '이체', '다계좌이체': '이체', '예약이체': '이체', '지로/생활요금': '공과금', '국세/관세': '공과금', '지방세': '공과금', '4대보험': '공과금', '환율조회': '환율', '환전지갑': '환율', '외화 환전 신청': '환율', '오픈뱅킹 이체': '오픈뱅킹', '계좌 연결 관리': '오픈뱅킹', '외화예금 상품': null };

let closeSearch = null;

function mountGnb(c, api, sticky) {
  const { inner } = c; const k = api.k;
  const items = texts(inner).filter((s) => GNB.includes(labelOf(s)) && boxIn(s, inner, k).y < 113);
  if (!items.length) return;
  // panel host
  const host = document.createElement('div');
  host.className = 'wx-mega';
  host.style.top = '113px';
  inner.appendChild(host);
  sticky.push(host);
  // underline indicator
  const bar = document.createElement('div');
  bar.className = 'wx-gnbbar';
  inner.appendChild(bar);
  sticky.push(bar);
  let figmaPanel = null;
  loadScreen('1_33208').then((d) => {
    if (!d) return; const t = document.createElement('div'); t.innerHTML = d.html;
    const p = t.querySelector('[data-id="1:33688"]'); if (p) { p.style.top = '0px'; figmaPanel = p; }
  });
  let open = null, timer = null;
  const show = (name, svg) => {
    clearTimeout(timer);
    const b = boxIn(svg, inner, k);
    Object.assign(bar.style, { left: (b.x - 6) + 'px', width: (b.w + 12) + 'px', top: '109px', opacity: 1 });
    if (open === name) return;
    open = name;
    let html;
    if (name === '금융상품' && figmaPanel) { host.innerHTML = ''; host.appendChild(figmaPanel); host.style.height = '483px'; }
    else {
      const cols = MENUS[name] || [];
      html = `<div class="wx-mega-in"><div class="wx-promo" data-go="1:33805"><b>지금 확인하면<br>좋은 금융 선택이 있어요</b><span>김하나님께 맞는 상품 보기 ›</span></div>
        ${cols.map((col) => `<div class="wx-col"><h4>${col[0]}</h4>${col[1].map((it) => `<a data-item="${it}">${it}</a>`).join('')}</div>`).join('')}</div>`;
      host.innerHTML = html; host.style.height = '300px';
      host.querySelectorAll('[data-item]').forEach((a) => a.addEventListener('click', (e) => {
        e.stopPropagation(); const it = a.dataset.item; hide(true);
        const m = MENU_ACT[it]; if (m && MODALS[m]) MODALS[m](); else toast(`'${it}' 화면은 준비 중이에요`);
      }));
      host.querySelector('.wx-promo').addEventListener('click', (e) => { e.stopPropagation(); hide(true); api.go('1:33805'); });
    }
    host.classList.add('on');
  };
  const hide = (now) => {
    clearTimeout(timer);
    timer = setTimeout(() => { host.classList.remove('on'); bar.style.opacity = 0; open = null; }, now ? 0 : 180);
  };
  items.forEach((svg) => {
    const name = labelOf(svg);
    const el = hostFor(svg, inner, k, 160, 80);
    el.addEventListener('mouseenter', () => show(name, svg));
    el.addEventListener('mouseleave', () => hide());
    api.link(el, () => { if (open === name) hide(true); else show(name, svg); }, true);
  });
  host.addEventListener('mouseenter', () => clearTimeout(timer));
  host.addEventListener('mouseleave', () => hide());
  // clicks inside the Figma 금융상품 panel
  host.addEventListener('click', (e) => {
    const s = e.target.closest('svg.T') || (e.target.closest('[data-id]') && e.target.closest('[data-id]').querySelector('svg.T'));
    if (!s || !figmaPanel || !figmaPanel.contains(s)) return;
    e.stopPropagation(); hide(true);
    const l = labelOf(s);
    if (/상품&가입|상품 가입|신탁 상품/.test(l)) api.go('1:31012');
    else if (/지금 확인하면/.test(l)) api.go('1:33805');
    else toast(`'${l}' 화면은 준비 중이에요`);
  });
}

/* ---------- search ---------- */
const PRODUCTS = [
  { n: '3·6·9 정기예금', t: '예금', d: '3개월마다 금리가 올라가는 정기예금', r: '연 4.1%', k: '예금 정기 369 정기예금' },
  { n: '날아라 해외로 적금', t: '적금', d: '여행 자금 모으는 적금', r: '연 4.1%', k: '적금 하나 적금 여행' },
  { n: '급여하나 월복리 적금', t: '적금', d: '급여 이체 시 우대금리 월복리', r: '연 4.15%', k: '하나 적금 적금 급여 월복리' },
  { n: '하나 적금', t: '적금', d: '누구나 가입하는 자유적립식 적금', r: '연 3.8%', k: '하나 적금 적금' },
  { n: '도전365 적금', t: '적금', d: '매일 저축 습관 만들기', r: '연 4.5%', k: '하나 적금 적금 도전' },
  { n: '주택청약종합저축', t: '청약', d: '내 집 마련의 첫걸음', r: '연 2.8%', k: '청약 주택 저축' },
  { n: '하나모임통장', t: '입출금', d: '모임 회비 관리 통장', r: '연 0.1%', k: '통장 모임 입출금' },
  { n: '트래블로그 외화통장', t: '외화', d: '환전 수수료 없는 외화 통장', r: '-', k: '외화 환전 여행 트래블' },
  { n: '하나 체크카드', t: '카드', d: '생활 할인 체크카드', r: '-', k: '카드 체크 하나' },
  { n: '하나 MULTI 신용카드', t: '카드', d: '포인트 적립 신용카드', r: '-', k: '카드 신용' },
];
const EXTRA = { '이벤트': [{ n: '하나원큐 이사하는 날', t: '이벤트', d: '100% 캐시&집들이 선물', r: '~2026.12.31', k: '이벤트', go: '1:33805' }],
  '인기 주식': [{ n: '삼성전자', t: '주식', d: '코스피 · 실시간 관심 1위', r: '▲ 2.1%', k: '주식' }, { n: 'SK하이닉스', t: '주식', d: '코스피 · 실시간 관심 2위', r: '▲ 1.4%', k: '주식' }] };
const SUGGEST = ['하나 적금', '하나 정기예금', '하나 체크카드', '하나모임통장', '적금 금리 비교', '주택청약종합저축', '청약 1순위 조건', '환율 조회', '외화 환전', '인기 주식', '이벤트', '카드 발급', '대출 금리'];

function search(q) {
  const s = q.replace(/\s+/g, ' ').trim(); if (!s) return [];
  const extra = EXTRA[s] || [];
  const words = s.split(' ');
  const found = PRODUCTS.filter((p) => words.every((w) => (p.n + ' ' + p.k + ' ' + p.t).includes(w)) || (p.n + p.k).includes(s));
  return extra.concat(found.length ? found : PRODUCTS.filter((p) => words.some((w) => (p.n + p.k).includes(w))));
}

function mountSearch(c, api, sticky) {
  const { inner } = c; const k = api.k;
  // search icon in the header (Figma: 돋보기 -> 1:32702)
  const icon = [...inner.querySelectorAll('[data-id]')].find((e) => {
    const pi = e.getAttribute('data-pi'); if (pi == null) return false;
    return (c.s.actions[+pi] || []).some((a) => a.to === '1:32702');
  });
  const panel = document.createElement('div');
  panel.className = 'wx-search';
  panel.style.top = '113px';
  const dim = document.createElement('div');
  dim.className = 'wx-sdim';
  inner.appendChild(dim); inner.appendChild(panel);
  sticky.push(panel); sticky.push(dim);
  panel.innerHTML = `<div class="wx-sbox"><div class="wx-sfield"><input type="text" placeholder="검색어를 입력해주세요" autocomplete="off" spellcheck="false"><button class="wx-clear" aria-label="지우기">×</button><button class="wx-sbtn">검색</button></div>
    <div class="wx-suggest"></div>
    <div class="wx-chips"><span>추천 검색어</span>${['이벤트', '하나 적금', '인기 주식', '청약', '카드'].map((t) => `<button data-q="${t}">${t}</button>`).join('')}</div>
    <div class="wx-results"></div></div>`;
  const input = panel.querySelector('input'), sug = panel.querySelector('.wx-suggest'), res = panel.querySelector('.wx-results');
  let typing = null;
  const open = () => { panel.classList.add('on'); dim.classList.add('on'); setTimeout(() => input.focus(), 120); };
  const close = () => { panel.classList.remove('on'); dim.classList.remove('on'); sug.classList.remove('on'); input.blur(); };
  closeSearch = close;
  const renderSug = () => {
    const v = input.value.trim();
    const list = v ? SUGGEST.filter((s) => s.includes(v) || v.split('').every((ch) => s.includes(ch))).slice(0, 6) : [];
    sug.innerHTML = list.map((s) => `<div data-s="${s}">${s.replace(v, `<b>${esc(v)}</b>`)}</div>`).join('');
    sug.classList.toggle('on', !!list.length && document.activeElement === input);
  };
  const run = (q) => {
    sug.classList.remove('on');
    res.innerHTML = '<div class="wx-loading"><i></i><i></i><i></i></div>';
    res.classList.add('on');
    setTimeout(() => {
      const r = search(q);
      res.innerHTML = r.length ? `<div class="wx-rhead"><b>'${esc(q)}'</b> 검색결과 <em>${r.length}건</em></div>
        <div class="wx-rgrid">${r.slice(0, 6).map((p, i) => `<div class="wx-rcard" data-i="${i}" style="animation-delay:${i * 0.05}s"><span class="wx-tag">${p.t}</span><b>${p.n}</b><p>${p.d}</p><strong>${p.r}</strong>
          <div class="wx-rbtn"><button data-act="detail">상세보기</button>${['예금', '적금', '청약', '입출금', '외화'].includes(p.t) ? '<button data-act="join" class="pri">가입하기</button>' : ''}</div></div>`).join('')}</div>
        <div class="wx-rmenu">메뉴 바로가기 <a data-go="1:31012">상품 전체보기 ›</a><a data-go="1:31471">상품 비교 ›</a><a data-go="1:33805">맞춤 추천상품 ›</a></div>`
        : `<div class="wx-empty">'${esc(q)}'에 대한 검색결과가 없어요.<br>다른 검색어로 찾아보세요.</div>`;
      res.querySelectorAll('.wx-rcard').forEach((cd) => {
        const p = r[+cd.dataset.i];
        cd.addEventListener('click', (e) => {
          const act = e.target.closest('button') && e.target.closest('button').dataset.act;
          close();
          if (p.go) api.go(p.go);
          else if (p.t === '주식' || p.t === '카드') toast(`'${p.n}' 정보 화면으로 연결돼요`);
          else api.go(act === 'join' ? '1:32376' : '1:31635');
        });
      });
      res.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', () => { close(); api.go(a.dataset.go); }));
    }, 550);
  };
  // fake "typing" for recommended keywords
  const typeQ = (q) => {
    clearInterval(typing); input.value = ''; input.focus(); let i = 0;
    typing = setInterval(() => { i++; input.value = q.slice(0, i); renderSug(); if (i >= q.length) { clearInterval(typing); setTimeout(() => run(q), 250); } }, 85);
  };
  input.addEventListener('input', renderSug);
  input.addEventListener('focus', renderSug);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) run(input.value.trim()); });
  sug.addEventListener('mousedown', (e) => { const d = e.target.closest('[data-s]'); if (!d) return; e.preventDefault(); input.value = d.dataset.s; run(d.dataset.s); });
  panel.querySelector('.wx-sbtn').addEventListener('click', () => { if (input.value.trim()) run(input.value.trim()); else { input.classList.remove('shake'); void input.offsetWidth; input.classList.add('shake'); input.focus(); } });
  panel.querySelector('.wx-clear').addEventListener('click', () => { input.value = ''; res.classList.remove('on'); res.innerHTML = ''; renderSug(); input.focus(); });
  panel.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => typeQ(b.dataset.q)));
  dim.addEventListener('click', close);
  if (icon) api.link(icon, () => (panel.classList.contains('on') ? close() : open()), true);
  // on the Figma search frame itself, open immediately
  if (c.s.id === '1:32702') { const fp = inner.querySelector('[data-id="1:33182"]'); if (fp) fp.style.visibility = 'hidden'; open(); }
}

/* ---------- hero carousel ---------- */
function mountHero(c, api) {
  const { inner } = c; const k = api.k;
  const counter = texts(inner).find((s) => /^0\d \/ 0\d$/.test(labelOf(s)));
  if (!counter) return;
  const wrap = counter.parentElement.closest('[data-id]').parentElement.closest('[data-id]');
  const btns = [...wrap.querySelectorAll('[data-id]')].filter((e) => Math.round(parseFloat(e.style.width)) === 40 && Math.round(parseFloat(e.style.height)) === 40);
  const bar = [...wrap.querySelectorAll('[data-id]')].find((e) => Math.round(parseFloat(e.style.height)) === 4);
  const cb = boxIn(counter, inner, k);
  counter.style.visibility = 'hidden';
  const num = document.createElement('div');
  num.className = 'wx-count';
  Object.assign(num.style, { left: cb.x + 'px', top: cb.y + 'px', height: cb.h + 'px', lineHeight: cb.h + 'px' });
  inner.appendChild(num);
  let i = 3, playing = true, t = null;
  const prog = document.createElement('div'); prog.className = 'wx-prog';
  if (bar) bar.appendChild(prog);
  
  const set = (n, dir) => {
    i = ((n - 1 + 4) % 4) + 1;
    num.innerHTML = `<b>0${i}</b> / 04`;
    prog.style.transition = 'none'; prog.style.width = '0%'; void prog.offsetWidth;
    if (playing) { prog.style.transition = 'width 5s linear'; prog.style.width = '100%'; }
    const hero = wrap.parentElement.querySelector('[data-id]');
    if (dir && hero) { hero.classList.remove('wx-slide-l', 'wx-slide-r'); void hero.offsetWidth; hero.classList.add(dir > 0 ? 'wx-slide-l' : 'wx-slide-r'); }
    clearTimeout(t); if (playing) t = setTimeout(() => set(i + 1, 1), 5000);
  };
  set(3);
  if (btns[0]) api.link(btns[0], () => set(i - 1, -1), true);
  if (btns[1]) api.link(btns[1], () => {
    playing = !playing; btns[1].classList.toggle('wx-paused', !playing);
    toast(playing ? '자동 넘김을 다시 시작해요' : '자동 넘김을 멈췄어요'); set(i);
  }, true);
  if (btns[2]) api.link(btns[2], () => set(i + 1, 1), true);
  c._cleanup = () => clearTimeout(t);
}

/* ---------- product card row arrows (요즘 20대가 가장 많이 찾는 …) ---------- */
function mountProductRow(c, api) {
  const { inner } = c; const k = api.k;
  const joins = texts(inner).filter((s) => labelOf(s) === '가입하기');
  if (joins.length < 3) return;
  // cards: walk up from each 가입하기 to a ~200x150 card
  const cards = joins.map((s) => hostFor(s, inner, k, 230, 200)).filter((e, i, a) => a.indexOf(e) === i);
  if (cards.length < 3) return;
  const row = cards[0].parentElement;
  const rb = boxIn(row, inner, k);
  // the < > arrows: small icon frames on the same vertical band, outside the cards
  const arrows = [...inner.querySelectorAll('[data-id]')].filter((e) => {
    if (e.hasAttribute('data-pi')) return false;
    const b = boxIn(e, inner, k); return b.w <= 40 && b.h <= 40 && b.w >= 12 && b.y > rb.y && b.y < rb.y + rb.h && (b.x < rb.x || b.x > rb.x + rb.w - 40) && !e.querySelector('svg.T');
  });
  let pos = 0;
  const shift = (d) => {
    pos = Math.max(-1, Math.min(1, pos + d));
    cards.forEach((cd) => { cd.style.transition = 'translate .35s cubic-bezier(.2,.8,.2,1), opacity .35s'; cd.style.translate = `${-pos * 24}px 0`; });
    cards.forEach((cd, i) => { cd.style.opacity = (pos > 0 && i === 0) || (pos < 0 && i === cards.length - 1) ? '.55' : '1'; });
  };
  arrows.sort((a, b) => boxIn(a, inner, k).x - boxIn(b, inner, k).x);
  if (arrows[0]) api.link(arrows[0], () => shift(-1));
  if (arrows.length > 1) api.link(arrows[arrows.length - 1], () => shift(1));
}

/* ---------- entry ---------- */
export function mountWeb(c, api) {
  curGo = (to) => api.go(to);
  const { inner } = c; const k = api.k;
  const sticky = [...inner.querySelectorAll('[data-hdr]')];
  const hdrMain = sticky.find((e) => /Main Header|Frame 993/.test(e.getAttribute('data-n') || '')) || sticky[sticky.length - 1];

  mountGnb(c, api, sticky);
  mountSearch(c, api, sticky);
  mountHero(c, api);
  mountProductRow(c, api);

  // labels without a Figma connection
  const seen = new Set();
  (c.s.enh && c.s.enh.dead || []).forEach((d) => {
    const el = inner.querySelector(`[data-id="${d.id}"]`); if (!el || GNB.includes(d.label)) return;
    seen.add(el); api.link(el, actionFor(d.label));
  });
  // known items that are not marked as buttons in Figma
  const EXTRA_LABELS = ['예적금', '펀드', '환전지갑', '퇴직연금', '대출', '인기 상품 확인', '여유자금 관리', '대출 조건 비교', '외화 관리', '+ 더보기',
    '상품공시실', '서식·약관자료실', '하나더넥스트', '손님의소리', '금리안내', '영업점찾기', '조회', '이체', '공과금', '환율', '오픈뱅킹', '빠른조회', '고객센터', '인증센터'];
  texts(inner).forEach((s) => {
    const l = labelOf(s); if (!EXTRA_LABELS.includes(l)) return;
    if (boxIn(s, inner, k).y < 113) return; // header
    const el = hostFor(s, inner, k, 320, 140);
    if (seen.has(el) || el.hasAttribute('data-pi')) return;
    seen.add(el); api.link(el, actionFor(l));
  });
  // 새소식 rows, footer links, app icons -> short message
  texts(inner).forEach((s) => {
    if (s.closest('[data-pi]')) return;
    const l = labelOf(s); const b = boxIn(s, inner, k);
    if (/^「|^\[|공고|안내$/.test(l) && b.w > 200 && b.h < 40) api.link(s, () => toast('공지 상세 내용을 보여드려요'));
  });
  const footer = inner.querySelector('[data-n="Footer"]');
  if (footer) texts(footer).forEach((s) => { const l = labelOf(s); if (l && l.length <= 16 && !/\d{3}/.test(l) && !s.closest('[data-pi]')) api.link(s, () => toast(`'${l}' 페이지로 연결돼요`)); });

  // sticky header: stays at the top while the page scrolls
  const ys = sticky.map((e) => ({ e, y: 0 }));
  const onScroll = () => {
    const d = Math.max(0, window.scrollY / (api.scale() || 1));
    ys.forEach((o) => { o.e.style.translate = `0 ${d}px`; });
    if (hdrMain) hdrMain.classList.toggle('wx-stuck', d > 4);
  };
  if (winScroll) window.removeEventListener('scroll', winScroll);
  winScroll = onScroll; winKey = c;
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
