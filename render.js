/* ============================================================================
   IPO Analyst — document renderer  v3.1
     buildReport(p,lang)    10-page A4 research report
     buildExec(p,lang)       4-page executive summary
     buildVisual(p,lang)     2-page visual summary (A4 raster)
     buildScorecard(p,lang)  1-page score card
   Gujarati editions translate everything except the document title header.
   ========================================================================== */
(function (global) {
'use strict';

/* ---------- safe coercion: an AI may hand back an object where a string
     was asked for, which is what produced "[object Object]" on screen ---------- */
function S(v){
  if(v==null) return '';
  if(typeof v === 'string') return v;
  if(typeof v === 'number' || typeof v === 'boolean') return String(v);
  if(Array.isArray(v)) return v.map(S).filter(Boolean).join(', ');
  if(typeof v === 'object'){
    var keys = ['name','company','legal_name','full_name','value','text','title','label','en'];
    for(var i=0;i<keys.length;i++){ if(typeof v[keys[i]] === 'string' && v[keys[i]]) return v[keys[i]]; }
    for(var k in v){ if(typeof v[k] === 'string' && v[k]) return v[k]; }
  }
  return '';
}
/* Gujarati digits (૦-૯) back to Western Arabic. Section 51.1 requires figures
   in 2026 form, not ૨૦૨૬, because financial readers scan numbers — and a model
   that writes ૯૨ instead of 92 also breaks the figure-parity check, which would
   silently cost it the whole translation. Enforced here rather than hoped for. */
var GU_DIGITS = /[\u0AE6-\u0AEF]/g;
function westernDigits(t){
  if(!t || !GU_DIGITS.test(t)) return t;
  return t.replace(GU_DIGITS, function(c){ return String(c.charCodeAt(0) - 0x0AE6); });
}
function e(s){ return westernDigits(S(s)).replace(/[&<>"]/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
function n(v, dp){ if(v==null||v===''||isNaN(v)) return '—';
  return Number(v).toLocaleString('en-IN',{minimumFractionDigits:dp||0,maximumFractionDigits:dp||0}); }
function cr(v){ return v==null||isNaN(v) ? '—' : '₹'+n(v, Math.abs(v)<100?2:0)+' cr'; }
function pct(v,dp){ return v==null||isNaN(v) ? '—' : Number(v).toFixed(dp==null?1:dp)+'%'; }
function arr(a){ return Array.isArray(a) ? a : []; }
function pick(p, lang, path, fallback){
  if(lang === 'gu'){
    var cur = p.gu, ok = true;
    path.split('.').forEach(function(k){ if(!ok||cur==null){ ok=false; return; } cur = cur[k]; });
    if(ok && cur != null && cur !== '' && !(Array.isArray(cur) && !cur.length)){
      /* same rule as tr(): a translation that lost a figure is not used */
      if(typeof cur === 'string' && typeof fallback === 'string') return safeTr(fallback, cur);
      if(Array.isArray(cur) && Array.isArray(fallback)){
        return cur.map(function(x, i){
          var en = fallback[i];
          if(typeof x === 'string' && typeof en === 'string') return safeTr(en, x);
          return x;
        });
      }
      return cur;
    }
  }
  return fallback;
}
/* Any label the payload supplies can be translated through gu.labels, so the
   Gujarati edition is complete rather than half-English. */

/* ---------------------------------------------------------------------------
   Fixed vocabulary, translated by the app itself.

   These words come from the APP, not from the payload — score bands, severity
   pills, evidence standards, recommendation verdicts, trend and assessment
   words. Asking the model to translate them through gu.labels was unreliable,
   and a miss left English scattered through a Gujarati document. The app owns
   them now, so they are right every time regardless of what the model sends.
   -------------------------------------------------------------------------- */
var VOCAB_GU = {
  /* score bands */
  'Exceptional':'અસાધારણ', 'Strong':'મજબૂત', 'Attractive':'આકર્ષક',
  'Selective':'પસંદગીયુક્ત', 'Weak':'નબળું', 'Avoid':'ટાળો',
  /* recommendations */
  'STRONG SUBSCRIBE':'મજબૂત સબસ્ક્રાઇબ', 'SUBSCRIBE':'સબસ્ક્રાઇબ', 'APPLY':'અરજી કરો',
  'SELECTIVE':'પસંદગીયુક્ત', 'WAIT FOR BETTER VALUATION':'સારા મૂલ્યાંકનની રાહ જુઓ',
  'LISTING GAIN ONLY':'માત્ર લિસ્ટિંગ ગેઇન', 'AVOID':'ટાળો', 'NEUTRAL':'તટસ્થ',
  /* severity */
  'CRITICAL':'ગંભીર', 'HIGH':'ઊંચું', 'MEDIUM':'મધ્યમ', 'LOW':'નીચું',
  /* evidence standard */
  'Official':'સત્તાવાર', 'Derived':'વ્યુત્પન્ન', 'Estimated':'અંદાજિત',
  'Unverified':'ચકાસાયેલ નથી', 'Verified':'ચકાસાયેલ',
  /* trend and direction */
  'Improving':'સુધરી રહ્યું', 'Stable':'સ્થિર', 'Deteriorating':'બગડી રહ્યું',
  'Declining':'ઘટી રહ્યું', 'Rising':'વધી રહ્યું', 'Flat':'સપાટ', 'Mixed':'મિશ્ર',
  'Volatile':'અસ્થિર', 'Up':'ઉપર', 'Down':'નીચે', 'Turned positive':'હકારાત્મક બન્યું',
  'Positive':'હકારાત્મક', 'Negative':'નકારાત્મક',
  /* assessments */
  'Strong positive':'મજબૂત હકારાત્મક', 'Adequate':'પર્યાપ્ત', 'Inadequate':'અપર્યાપ્ત',
  'Good':'સારું', 'Poor':'નબળું', 'Clear':'સ્પષ્ટ', 'Clean':'સ્વચ્છ',
  'Concern':'ચિંતા', 'Moderate':'મધ્યમ', 'Minor':'નાનું', 'Major':'મોટું',
  'Yes':'હા', 'No':'ના', 'None':'કોઈ નહીં', 'Not disclosed':'જાહેર કરેલ નથી',
  'Not applicable':'લાગુ પડતું નથી', 'Pending':'બાકી', 'Ongoing':'ચાલુ',
  'Real':'વાસ્તવિક', 'Allegation':'આરોપ', 'Disclosed':'જાહેર કરેલ',
  'Partial':'આંશિક', 'Full':'સંપૂર્ણ', 'Limited':'મર્યાદિત', 'Extensive':'વ્યાપક',
  'Above':'ઉપર', 'Below':'નીચે', 'In line':'સમાન', 'At par':'સમકક્ષ',
  'Not meaningful':'અર્થપૂર્ણ નથી', 'Not available':'ઉપલબ્ધ નથી', 'Not comparable':'સરખાવી શકાય નહીં',
  'Moderate positive':'મધ્યમ હકારાત્મક', 'Moderate negative':'મધ્યમ નકારાત્મક',
  'Strong negative':'મજબૂત નકારાત્મક', 'Neutral':'તટસ્થ', 'Cautious':'સાવચેત',
  'Expensive':'મોંઘું', 'Cheap':'સસ્તું', 'Fair':'વાજબી', 'Rich':'ઊંચું',
  'Premium':'પ્રીમિયમ', 'Discount':'ડિસ્કાઉન્ટ', 'Sector':'ક્ષેત્ર',
  /* scenario cases */
  'Bear':'મંદી', 'Base':'આધાર', 'Bull':'તેજી',
  /* cadence */
  'Quarterly':'ત્રિમાસિક', 'Monthly':'માસિક', 'Annual':'વાર્ષિક', 'Weekly':'સાપ્તાહિક',
  'Half-yearly':'અર્ધવાર્ષિક', 'Daily':'દૈનિક',
  /* investor and issue words that are not abbreviations */
  'Retail':'રિટેલ', 'Mainboard':'મેઇનબોર્ડ', 'Fresh issue':'નવો ઇશ્યૂ',
  'Listing':'લિસ્ટિંગ', 'Anchor':'એન્કર', 'Unofficial':'બિનસત્તાવાર'
};

/* Financial shorthand that stays English by design, per section 51.1. */
var KEEP_EN = ['PAT','EBITDA','EBIT','ROE','ROCE','ROA','CFO','FCF','GMP','OFS','IPO','DRHP','RHP',
  'QIB','NII','HNI','UHNI','CAGR','PEG','SEBI','NSE','BSE','GST','MF','FPI','SME','EV','P/E','P/B',
  'D/E','YoY','NAV','AUM','WC','TTM'];

/* Look a string up in the app vocabulary, case-insensitively, and handle
   "Improving, still negative" style compounds by translating the head word. */
function vocab(t){
  if(!t) return null;
  if(VOCAB_GU[t]) return VOCAB_GU[t];
  var keys = Object.keys(VOCAB_GU);
  for(var i = 0; i < keys.length; i++){
    if(keys[i].toLowerCase() === t.toLowerCase()) return VOCAB_GU[keys[i]];
  }
  return null;
}


/* A translation that loses a figure is worse than no translation: the two
   editions would then disagree on the numbers, which is the one thing they can
   never do. If a Gujarati string drops a number its English source carried, the
   English is kept for that string. */
function numsOf(t){
  return (westernDigits(String(t)).match(/\d[\d,]*\.?\d*/g) || [])
    .map(function(x){ return x.replace(/,/g,'').replace(/\.$/,''); })
    .filter(function(x){ return x.length > 1; });
}
function keepsFigures(en, gu){
  var a = numsOf(en);
  if(!a.length) return true;
  var b = numsOf(gu);
  for(var i = 0; i < a.length; i++) if(b.indexOf(a[i]) < 0) return false;
  return true;
}
function safeTr(en, gu){ return keepsFigures(en, gu) ? gu : en; }

function tr(p, lang, v){
  var t = S(v);
  if(lang !== 'gu' || !t) return t;
  var d = (p.gu && p.gu.labels) || {};
  if(d[t]) return safeTr(t, S(d[t]));
  var k = t.trim();
  if(d[k]) return safeTr(t, S(d[k]));
  var tx = (p.gu && p.gu.text) || {};
  if(tx[t]) return safeTr(t, S(tx[t]));
  if(tx[k]) return safeTr(t, S(tx[k]));
  var vg = vocab(k);
  if(vg) return vg;
  /* "Improving, still negative" -> translate the head, keep the qualifier */
  var m = k.match(/^([A-Za-z][A-Za-z \-]*?)(,|\u2014|\u2013| - )([\s\S]+)$/);
  if(m){ var head = vocab(m[1].trim()); if(head) return head + m[2] + m[3]; }
  return t;
}

/* Words the app itself prints — bands, severities, evidence standards — go
   through here so they never depend on what the model chose to send. */
function A(lang, t){
  if(lang !== 'gu') return S(t);
  return vocab(S(t)) || S(t);
}
function toneClass(t){ return t==='good'?'tn-good':t==='bad'?'tn-bad':t==='warn'?'tn-warn':''; }
function sevClass(s){ s=S(s).toUpperCase();
  return s==='CRITICAL'?'sv-crit':s==='HIGH'?'sv-high':s==='MEDIUM'?'sv-med':'sv-low'; }
function bandOf(v){ v=Number(v)||0;
  return v>=85?'Exceptional':v>=75?'Strong':v>=65?'Attractive':v>=55?'Selective':v>=45?'Weak':'Avoid'; }
function bandColour(v){ v=Number(v)||0;
  return v>=75?'var(--good)':v>=65?'var(--teal)':v>=55?'var(--warn)':v>=45?'var(--amber)':'var(--bad)'; }

/* ---------- every label the renderer emits, in both languages ---------- */
var T = {
  verdict_h:      ['Final recommendation','અંતિમ ભલામણ'],
  ipo_quality:    ['IPO Quality','IPO ગુણવત્તા'],
  long_term:      ['Long Term','લાંબા ગાળે'],
  listing_gain:   ['Listing Gain','લિસ્ટિંગ લાભ'],
  allocation:     ['Allocation','ફાળવણી'],
  of_portfolio:   ['of portfolio','પોર્ટફોલિયોનો'],
  thesis:         ['Investment thesis','રોકાણ થીસીસ'],
  snapshot:       ['IPO snapshot','IPO ઝલક'],
  parameter:      ['Parameter','માપદંડ'],
  detail:         ['Detail','વિગત'],
  issue_period:   ['Issue period','ઇશ્યૂ સમયગાળો'],
  price_band:     ['Price band / issue price','ભાવ પટ્ટી / ઇશ્યૂ ભાવ'],
  issue_size:     ['Issue size','ઇશ્યૂ કદ'],
  subscription:   ['Subscription','સબ્સ્ક્રિપ્શન'],
  gmp:            ['Grey market premium','ગ્રે માર્કેટ પ્રીમિયમ'],
  market_cap:     ['Market capitalisation','બજાર મૂડી'],
  promoter_hold:  ['Promoter holding','પ્રમોટર હિસ્સો'],
  listing:        ['Listing','લિસ્ટિંગ'],
  post_issue:     ['post issue','ઇશ્યૂ પછી'],
  issue_at:       ['issue at','ઇશ્યૂ ભાવ'],
  fresh:          ['fresh','નવો'],
  unofficial:     ['unofficial','અનધિકૃત'],
  score_100:      ['The 100-point score','100-ગુણનો સ્કોર'],
  how_to_read:    ['How to read this','આ કેવી રીતે વાંચવું'],
  how_to_read_b:  ['Market signals are capped at 5 of 100 on purpose, so grey market premium and subscription can never outweigh business quality, financial quality, valuation and governance. Bands: 85+ exceptional, 75-84 strong, 65-74 attractive, 55-64 selective, 45-54 weak, below 45 avoid.',
                   'બજાર સંકેતો ઇરાદાપૂર્વક 100માંથી 5 ગુણ સુધી મર્યાદિત છે, જેથી ગ્રે માર્કેટ પ્રીમિયમ અને સબ્સ્ક્રિપ્શન ક્યારેય વ્યવસાય ગુણવત્તા, નાણાકીય ગુણવત્તા, મૂલ્યાંકન અને ગવર્નન્સ કરતાં ભારે ન પડે. શ્રેણી: 85+ ઉત્તમ, 75-84 મજબૂત, 65-74 આકર્ષક, 55-64 પસંદગીયુક્ત, 45-54 નબળું, 45થી નીચે ટાળો.'],
  listing_assess: ['Listing-gain assessment','લિસ્ટિંગ લાભ આકારણી'],
  component:      ['Component','ઘટક'],
  max:            ['Max','મહત્તમ'],
  score:          ['Score','ગુણ'],
  basis:          ['Basis','આધાર'],
  lg_score:       ['Listing-gain score','લિસ્ટિંગ લાભ સ્કોર'],
  issue_struct:   ['Issue structure','ઇશ્યૂ માળખું'],
  fresh_issue:    ['Fresh issue','નવો ઇશ્યૂ'],
  ofs:            ['Offer for sale','ઓફર ફોર સેલ'],
  total:          ['Total','કુલ'],
  lot:            ['lot','લોટ'],
  shares_min:     ['shares, min','શેર, ન્યૂનતમ'],
  money_goes:     ['Where the money goes','પૈસા ક્યાં જાય છે'],
  use_proceeds:   ['Use of fresh proceeds','નવા ભંડોળનો ઉપયોગ'],
  rs_crore:       ['₹ crore','₹ કરોડ'],
  assessment:     ['Assessment','આકારણી'],
  who_selling:    ['Who is selling','કોણ વેચી રહ્યું છે'],
  seller:         ['Selling shareholder','વેચનાર શેરધારક'],
  type:           ['Type','પ્રકાર'],
  anchors:        ['Anchor investors','એન્કર રોકાણકારો'],
  anchor:         ['Anchor','એન્કર'],
  not_disclosed:  ['not disclosed','જાહેર નથી'],
  anchor_total:   ['Total anchor book','કુલ એન્કર બુક'],
  lockin:         ['lock-in','લોક-ઇન'],
  anchor_caveat:  ['Anchor participation is a confidence signal, not proof of investment quality.',
                   'એન્કર ભાગીદારી વિશ્વાસનો સંકેત છે, રોકાણ ગુણવત્તાનો પુરાવો નથી.'],
  what_does:      ['What the business actually does','વ્યવસાય ખરેખર શું કરે છે'],
  how_earns:      ['How it earns','કેવી રીતે કમાય છે'],
  why_stay:       ['Why customers stay','ગ્રાહકો કેમ ટકે છે'],
  rev_mix:        ['Revenue mix','આવક વિભાજન'],
  segment:        ['Segment','વિભાગ'],
  share_pc:       ['Share','હિસ્સો'],
  growth:         ['Growth','વૃદ્ધિ'],
  note:           ['Note','નોંધ'],
  op_metrics:     ['Operating metrics','સંચાલન માપદંડ'],
  industry:       ['Industry','ઉદ્યોગ'],
  classification: ['Classification','વર્ગીકરણ'],
  pricing_power:  ['Pricing power','ભાવ શક્તિ'],
  moat_rating:    ['Moat rating','સ્પર્ધાત્મક લાભ'],
  drivers:        ['Demand drivers','માંગના ચાલકો'],
  comp_adv:       ['Competitive advantage','સ્પર્ધાત્મક લાભ'],
  source_adv:     ['Source of advantage','લાભનો સ્રોત'],
  verdict:        ['Verdict','ચુકાદો'],
  evidence:       ['Evidence','પુરાવો'],
  three_yr:       ['Three-year financials','ત્રણ વર્ષના નાણાકીય આંકડા'],
  trend:          ['Trend','વલણ'],
  key_ratios:     ['Key ratios','મુખ્ય ગુણોત્તર'],
  profit_cash:    ['Does profit turn into cash?','નફો રોકડમાં ફેરવાય છે?'],
  earn_quality:   ['Earnings quality','નફાની ગુણવત્તા'],
  cfo_marker:     ['White marker is 1.0x — profit fully converting into cash.',
                   'સફેદ નિશાની 1.0x છે — નફો સંપૂર્ણપણે રોકડમાં ફેરવાય છે.'],
  bal_sheet:      ['Balance sheet','સરવૈયું'],
  rating:         ['Rating','રેટિંગ'],
  item:           ['Item','બાબત'],
  position:       ['Position','સ્થિતિ'],
  valuation_at:   ['Valuation at the issue price','ઇશ્યૂ ભાવે મૂલ્યાંકન'],
  multiple:       ['Multiple','ગુણોત્તર'],
  value:          ['Value','મૂલ્ય'],
  denom:          ['Denominator and method','છેદ અને પદ્ધતિ'],
  peers:          ['Peer comparison','સમકક્ષ સરખામણી'],
  scenarios:      ['Three-year scenarios','ત્રણ વર્ષના પરિદૃશ્ય'],
  to_:            ['to','સુધી'],
  case_:          ['Case','પરિદૃશ્ય'],
  val_share:      ['Value / share','મૂલ્ય / શેર'],
  vs_issue:       ['vs issue','ઇશ્યૂ સામે'],
  vs_listing:     ['vs listing','લિસ્ટિંગ સામે'],
  key_assum:      ['Key assumption','મુખ્ય ધારણા'],
  scen_caveat:    ['Scenario values are illustrative assumptions, not forecasts.',
                   'પરિદૃશ્ય મૂલ્યો દૃષ્ટાંતરૂપ ધારણાઓ છે, આગાહી નથી.'],
  promoters:      ['Promoters','પ્રમોટરો'],
  no_promoter:    ['No identifiable promoter','કોઈ ઓળખી શકાય તેવા પ્રમોટર નથી'],
  no_promoter_b:  ['The company declares no promoter and no promoter group. There is no lock-in, no controlling shareholder to hold accountable, and no single party bearing reputational cost for a governance failure.',
                   'કંપની કોઈ પ્રમોટર કે પ્રમોટર જૂથ જાહેર કરતી નથી. લોક-ઇન નથી, જવાબદાર ઠેરવી શકાય તેવો નિયંત્રક શેરધારક નથી, અને ગવર્નન્સ નિષ્ફળતાની પ્રતિષ્ઠાકીય કિંમત ચૂકવનાર કોઈ એક પક્ષ નથી.'],
  holding_pre:    ['Promoter holding','પ્રમોટર હિસ્સો'],
  before_issue:   ['before the issue','ઇશ્યૂ પહેલાં'],
  after_:         ['after','પછી'],
  name_:          ['Name','નામ'],
  role_:          ['Role','ભૂમિકા'],
  background:     ['Background','પૃષ્ઠભૂમિ'],
  bg_checks:      ['Background checks','પૃષ્ઠભૂમિ ચકાસણી'],
  check_:         ['Check','ચકાસણી'],
  finding:        ['Finding','તારણ'],
  standard:       ['Standard','ધોરણ'],
  governance:     ['Corporate governance','કોર્પોરેટ ગવર્નન્સ'],
  flag_:          ['Flag','સંકેત'],
  str_weak:       ['Strengths and weaknesses','મજબૂતાઈ અને નબળાઈ'],
  strengths:      ['Strengths','મજબૂતાઈ'],
  weaknesses:     ['Weaknesses','નબળાઈ'],
  opportunities:  ['Opportunities','તકો'],
  threats:        ['Threats','જોખમો'],
  red_flags:      ['Red flags','ચેતવણી સંકેત'],
  red_flag:       ['Red flag','ચેતવણી સંકેત'],
  severity:       ['Severity','ગંભીરતા'],
  monitoring:     ['Quarterly monitoring','ત્રિમાસિક દેખરેખ'],
  metric:         ['Metric','માપદંડ'],
  current:        ['Current','વર્તમાન'],
  desired:        ['Desired trend','ઇચ્છિત વલણ'],
  warning:        ['Warning level','ચેતવણી સ્તર'],
  alloc_levels:   ['Allocation and price levels','ફાળવણી અને ભાવ સ્તર'],
  action:         ['Action','પગલું'],
  price:          ['Price','ભાવ'],
  rationale:      ['Rationale','કારણ'],
  sugg_alloc:     ['Suggested allocation','સૂચિત ફાળવણી'],
  watch_one:      ['The one number to watch','જોવા જેવો એક આંકડો'],
  sources:        ['Sources','સ્રોત'],
  primary:        ['Primary','પ્રાથમિક'],
  secondary:      ['Secondary','ગૌણ'],
  missing:        ['Not reliably available from the sources reviewed','સમીક્ષા કરેલા સ્રોતોમાંથી વિશ્વસનીય રીતે ઉપલબ્ધ નથી'],
  recommendation: ['Recommendation','ભલામણ'],
  ipo_basics:     ['IPO at a glance','એક નજરે IPO'],
  objective:      ['Objective of the issue','ઇશ્યૂનો ઉદ્દેશ'],
  swot:           ['SWOT summary','SWOT સારાંશ'],
  scorecard:      ['Score Card','સ્કોર કાર્ડ'],
  block:          ['Block','વિભાગ'],
  line_item:      ['Line item','પેટા બાબત'],
  india:          ['India','ભારત'],
  score_card:     ['Score Card','સ્કોર કાર્ડ'],
  total_score:    ['Total Score By Section','વિભાગવાર કુલ ગુણ'],
  section:        ['Section','વિભાગ'],
  band:           ['Share Of Maximum','મહત્તમનો હિસ્સો'],
  fundamentals:   ['Fundamentals','મૂળભૂત'],
  market_signals: ['Market signals','બજાર સંકેત'],
  disclaimer:     ['Independent research. Not investment advice, not a personal recommendation, and not an offer or solicitation. Figures are labelled Official, Derived or Estimated. Grey market premium data is unofficial and unregulated. Equity investment carries the risk of permanent capital loss.',
                   'સ્વતંત્ર સંશોધન. આ રોકાણ સલાહ નથી, વ્યક્તિગત ભલામણ નથી, અને ખરીદ-વેચાણની ઓફર નથી. આંકડા સત્તાવાર, વ્યુત્પન્ન કે અંદાજિત તરીકે લેબલ કરેલા છે. GMP માહિતી અનધિકૃત અને અનિયંત્રિત છે. ઇક્વિટી રોકાણમાં કાયમી મૂડી નુકસાનનું જોખમ છે.'],
  research_only:  ['Research only, not investment advice','માત્ર સંશોધન, રોકાણ સલાહ નથી'],
  /* Supplied verbatim by the author; it appears in the footer of every page of
     every document. Do not paraphrase the English. */
  footnote:       ['Report is Generated by an AI research tool developed by CA Tejas Desai, who is not a SEBI-registered investment adviser. Reports are prepared for solely for the academic purposes and private circulation only and it is not investment advice, not a recommendation and not an offer to buy or sell. Verify every figure against the RHP and exchange filings before acting',
                   'આ રિપોર્ટ CA તેજસ દેસાઈ દ્વારા વિકસાવવામાં આવેલા AI સંશોધન સાધન દ્વારા તૈયાર કરવામાં આવ્યો છે, જેઓ SEBI-રજિસ્ટર્ડ રોકાણ સલાહકાર નથી. આ રિપોર્ટ ફક્ત શૈક્ષણિક હેતુ અને ખાનગી પરિભ્રમણ માટે જ તૈયાર કરવામાં આવ્યો છે; આ રોકાણ સલાહ નથી, ભલામણ નથી અને ખરીદ-વેચાણની ઓફર નથી. કોઈપણ પગલું લેતાં પહેલાં દરેક આંકડો RHP અને એક્સચેન્જ ફાઇલિંગ સામે ચકાસો']
};
function L(lang, k){ var r = T[k]; return r ? (lang==='gu' ? r[1] : r[0]) : k; }

/* ---------- shared stylesheet ---------- */
var CSS = `
@page{ size:A4; margin:0; }
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --navy:#0F2C52; --navy2:#1B4370; --teal:#00736C; --teal2:#E6F1F0;
  --ink:#12161C; --ink2:#3D4653; --ink3:#6B7480; --ink4:#9AA2AD;
  --rule:#DEDAD2; --rule2:#EDEAE4; --paper:#FFFFFF; --panel:#F7F5F1; --panel2:#FBFAF7;
  --good:#146C43; --warn:#8A6100; --amber:#B7791F; --bad:#A32017; --crit:#6E1210;
}
html,body{ background:#E9E7E1; }
body{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:var(--ink);
      font-size:8.5pt; line-height:1.45; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body.gu{ font-family:"Noto Sans Gujarati","Shruti","Gujarati Sangam MN",Helvetica,Arial,sans-serif;
         font-size:8.7pt; line-height:1.7; }
body.gu .en{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; line-height:1.4; }
.page{ width:210mm; height:297mm; background:var(--paper); position:relative; overflow:hidden;
       page-break-after:always; display:flex; flex-direction:column; margin:0 auto 8mm; }
.page:last-child{ page-break-after:auto; margin-bottom:0; }
@media print{ html,body{background:#fff;} .page{ margin:0; } }
.body{ flex:1; display:flex; flex-direction:column; padding:0 15mm; overflow:hidden; }
.rh{ display:flex; justify-content:space-between; align-items:center;
     padding:7mm 15mm 3.5mm; border-bottom:.6pt solid var(--rule); }
.rh .l{ font-size:7pt; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--navy); }
.rh .r{ font-size:6.8pt; color:var(--ink3); letter-spacing:.05em; }
.rfw{ border-top:.6pt solid var(--rule); }
.rfn{ padding:2.2mm 15mm 0; font-size:5.4pt; line-height:1.42; color:var(--ink4);
      text-align:justify; }
body.gu .rfn{ font-size:5.5pt; line-height:1.55; }
.rfw .rf{ border-top:0; padding-top:1.6mm; }
.rf{ display:flex; justify-content:space-between; align-items:center;
     padding:3mm 15mm 7mm; border-top:.6pt solid var(--rule); font-size:6.4pt; color:var(--ink4); }
.rf b{ color:var(--ink2); font-weight:700; }
h1{ font-size:22pt; line-height:1.1; letter-spacing:-.025em; font-weight:700; }
.sec{ display:flex; align-items:baseline; gap:3mm; margin:5mm 0 2.5mm; }
.sec .no{ font-size:7pt; font-weight:800; color:var(--teal); letter-spacing:.1em; }
.sec .ti{ font-size:10.5pt; font-weight:700; letter-spacing:-.01em; color:var(--navy); }
.sec .ln{ flex:1; height:.6pt; background:var(--rule); }
.lead{ font-size:9pt; line-height:1.55; color:var(--ink2); }
body.gu .lead{ line-height:1.75; }
.mut{ font-size:7pt; color:var(--ink3); line-height:1.4; }
body.gu .mut{ line-height:1.65; }
.eyebrow{ font-size:6.6pt; font-weight:800; letter-spacing:.19em; text-transform:uppercase; color:var(--teal); }
body.gu .eyebrow{ letter-spacing:.06em; }
table{ width:100%; border-collapse:collapse; font-size:7.4pt; }
th{ text-align:left; font-size:6.3pt; font-weight:800; letter-spacing:.09em; text-transform:uppercase;
    color:var(--ink3); padding:2mm; border-bottom:.9pt solid var(--navy); white-space:nowrap; }
body.gu th{ font-size:6.9pt; letter-spacing:.02em; }
td{ padding:1.9mm 2mm; border-bottom:.5pt solid var(--rule2); vertical-align:top; }
td.n,th.n{ text-align:right; font-variant-numeric:tabular-nums;
           font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; }
tr.hi td{ background:var(--teal2); font-weight:600; }
tr.tot td{ border-top:.9pt solid var(--navy); font-weight:700; background:var(--panel); }
.vb{ border:1.4pt solid var(--navy); border-radius:2mm; overflow:hidden; }
.vb .h{ background:var(--navy); color:#fff; padding:2.4mm 4mm; font-size:6.6pt; font-weight:800;
        letter-spacing:.17em; text-transform:uppercase; }
body.gu .vb .h{ letter-spacing:.05em; font-size:7.4pt; }
.vb .c{ padding:4mm; }
.vb .v{ font-size:15.5pt; font-weight:700; letter-spacing:-.02em; line-height:1.2; color:var(--navy); }
.tiles{ display:flex; gap:2.5mm; }
.tile{ flex:1; border:.6pt solid var(--rule); border-top:2pt solid var(--navy); border-radius:1mm;
       padding:2.6mm 3mm; background:var(--panel2); }
.tile .k{ font-size:5.9pt; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--ink3); }
body.gu .tile .k{ letter-spacing:.03em; font-size:6.6pt; }
.tile .v{ font-size:17pt; font-weight:700; letter-spacing:-.03em; line-height:1.05; margin-top:.6mm;
          font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; }
.tile .v small{ font-size:7.5pt; color:var(--ink4); font-weight:600; }
.tile .s{ font-size:6.4pt; color:var(--ink2); margin-top:.4mm; }
.bar{ display:flex; align-items:center; gap:2.5mm; margin:1.5mm 0; font-size:7.2pt; }
.bar .bl{ flex:0 0 40mm; color:var(--ink2); }
.bar .bt{ flex:1; height:3.1mm; background:var(--rule2); border-radius:.8mm; overflow:hidden; position:relative; }
.bar .bf{ height:100%; background:var(--navy2); border-radius:0 .8mm .8mm 0; }
.bar .bv{ flex:0 0 16mm; text-align:right; font-weight:700; font-variant-numeric:tabular-nums;
          font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; }
.bar .tick{ position:absolute; top:0; bottom:0; width:.5pt; background:#fff; opacity:.9; }
.grid2{ display:grid; grid-template-columns:1fr 1fr; gap:5mm; }
.grid3{ display:grid; grid-template-columns:repeat(3,1fr); gap:3mm; }
.grid4{ display:grid; grid-template-columns:repeat(4,1fr); gap:2.5mm; }
.kv{ border:.6pt solid var(--rule); border-radius:1mm; padding:2.4mm 2.8mm; background:var(--panel2); }
.kv .k{ font-size:5.9pt; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
        color:var(--ink3); line-height:1.3; min-height:6mm; }
body.gu .kv .k{ letter-spacing:.02em; font-size:6.6pt; }
.kv .v{ font-size:12.5pt; font-weight:700; letter-spacing:-.02em; line-height:1.1; margin-top:.5mm;
        font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; }
.kv .s{ font-size:6.2pt; color:var(--ink3); margin-top:.5mm; }
.tn-good{ color:var(--good); } .tn-bad{ color:var(--bad); } .tn-warn{ color:var(--amber); }
.pill{ display:inline-block; font-size:5.9pt; font-weight:800; letter-spacing:.07em;
       text-transform:uppercase; color:#fff; padding:.5mm 1.8mm; border-radius:2.5mm; white-space:nowrap;
       font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; }
.sv-crit{ background:var(--crit); } .sv-high{ background:var(--bad); }
.sv-med{ background:var(--amber); } .sv-low{ background:#7C838C; }
.note{ border-left:1.6pt solid var(--teal); background:var(--teal2); padding:2.4mm 3mm;
       border-radius:0 1mm 1mm 0; font-size:7.3pt; line-height:1.5; }
body.gu .note{ line-height:1.7; }
.note.bad{ border-left-color:var(--bad); background:#FBEEEC; }
.note.good{ border-left-color:var(--good); background:#EDF5F0; }
.note b{ display:block; margin-bottom:.5mm; }
ul{ margin-left:4mm; } li{ margin:.9mm 0; }
.blist li{ font-size:7.4pt; line-height:1.45; }
body.gu .blist li{ line-height:1.68; }
.blist b{ color:var(--navy); }
.donut{ width:32mm; height:32mm; border-radius:50%; flex:0 0 32mm; }
.dlegend{ font-size:7pt; line-height:1.7; }
.dlegend i{ display:inline-block; width:2.4mm; height:2.4mm; border-radius:.5mm; margin-right:1.6mm; }
.grow{ flex:1; }
`;

function shell(title, bodyCls, pages, extraCss){
  return '<!DOCTYPE html><html lang="'+(bodyCls==='gu'?'gu':'en')+'"><head><meta charset="utf-8">'
    + '<title>'+e(title)+'</title><style>'+CSS+(extraCss||'')+'</style></head><body class="'+bodyCls+'">'
    + pages + '</body></html>';
}
/* The document title header stays English in every edition, by design. */
function head(p, label){
  return '<div class="rh"><div class="l en">'+e(S(p.meta.short_name)||S(p.meta.company))+'</div>'
       + '<div class="r en">'+e(label)+'</div></div>';
}
function foot(p, i, total, lang){
  return '<div class="rfw">'
       + '<div class="rfn">'+e(L(lang,'footnote'))+'</div>'
       + '<div class="rf"><div><span class="en">IPO Company Research Report &nbsp;·&nbsp; '
       + e(p.meta.analysis_datetime||'') + '</span> &nbsp;·&nbsp; ' + e(L(lang,'research_only'))
       + '</div><div class="en"><b class="pgnum">'+i+'</b> / <span class="pgtot">'+total+'</span></div></div>'
       + '</div>';
}
function page(p, i, total, label, inner, lang){
  return '<section class="page">'+head(p,label)+'<div class="body">'+inner+'</div>'
       + foot(p,i,total,lang)+'</section>';
}
function sec(no, title){
  return '<div class="sec"><span class="no en">'+e(no)+'</span><span class="ti">'+e(title)
       + '</span><span class="ln"></span></div>';
}
function tbl(cols, rows, opts){
  opts = opts || {};
  var num = opts.num || [];
  var h = cols.map(function(c,i){ return '<th'+(num.indexOf(i)>=0?' class="n en"':'')+'>'+e(c)+'</th>'; }).join('');
  var b = rows.map(function(r){
    var cls = r.__cls ? ' class="'+r.__cls+'"' : '';
    var cells = (r.cells||r).map(function(c,i){
      return '<td'+(num.indexOf(i)>=0?' class="n en"':'')+'>'+(c==null?'—':c)+'</td>'; }).join('');
    return '<tr'+cls+'>'+cells+'</tr>';
  }).join('');
  return '<table><thead><tr>'+h+'</tr></thead><tbody>'+b+'</tbody></table>';
}
function barRow(label, pctW, value, colour, tick){
  return '<div class="bar"><div class="bl">'+e(label)+'</div><div class="bt">'
    + '<div class="bf" style="width:'+Math.max(0,Math.min(100,pctW))+'%;background:'+(colour||'var(--navy2)')+'"></div>'
    + (tick!=null?'<div class="tick" style="left:'+tick+'%"></div>':'')
    + '</div><div class="bv en">'+e(value)+'</div></div>';
}

var BLOCKS = [
  ['Business Quality','વ્યવસાય ગુણવત્તા',20,
   ['business_model','competitive_advantage','industry_attractiveness','growth_runway','revenue_quality'],
   ['Business Model','Competitive Advantage','Industry Attractiveness','Growth Runway','Revenue Quality'],
   ['વ્યવસાય મોડેલ','સ્પર્ધાત્મક લાભ','ઉદ્યોગ આકર્ષણ','વૃદ્ધિની તક','આવક ગુણવત્તા'],[4,4,4,4,4]],
  ['Financial Quality','નાણાકીય ગુણવત્તા',20,
   ['revenue_growth','profit_growth','margins','roce_roe','cash_flow','balance_sheet'],
   ['Revenue Growth','Profit Growth','Margins','ROCE / ROE','Cash Flow','Balance Sheet'],
   ['આવક વૃદ્ધિ','નફા વૃદ્ધિ','માર્જિન','ROCE / ROE','રોકડ પ્રવાહ','સરવૈયું'],[4,4,3,3,3,3]],
  ['Management & Governance','સંચાલન અને ગવર્નન્સ',15,
   ['promoter_track_record','governance','capital_allocation'],
   ['Promoter Track Record','Governance','Capital Allocation'],
   ['પ્રમોટર ટ્રેક રેકોર્ડ','ગવર્નન્સ','મૂડી ફાળવણી'],[5,5,5]],
  ['Valuation','મૂલ્યાંકન',20,
   ['absolute_valuation','peer_valuation','growth_adjusted_valuation','margin_of_safety'],
   ['Absolute Valuation','Peer Valuation','Growth-Adjusted Valuation','Margin Of Safety'],
   ['સંપૂર્ણ મૂલ્યાંકન','સમકક્ષ મૂલ્યાંકન','વૃદ્ધિ-સમાયોજિત મૂલ્યાંકન','સલામતી માર્જિન'],[5,5,5,5]],
  ['IPO Structure','IPO માળખું',10,
   ['fresh_issue_quality','use_of_proceeds','ofs_exit_structure'],
   ['Fresh Issue Quality','Use Of Proceeds','OFS / Exit Structure'],
   ['નવા ઇશ્યૂની ગુણવત્તા','ભંડોળનો ઉપયોગ','OFS / એક્ઝિટ માળખું'],[4,3,3]],
  ['Risk','જોખમ',10,
   ['business_risks','financial_risks','governance_risks','regulatory_risks'],
   ['Business Risks','Financial Risks','Governance Risks','Regulatory / Industry Risks'],
   ['વ્યવસાય જોખમ','નાણાકીય જોખમ','ગવર્નન્સ જોખમ','નિયમનકારી જોખમ'],[3,3,2,2]],
  ['Market Signals','બજાર સંકેત',5,
   ['gmp','anchor_quality','subscription_demand'],
   ['GMP','Anchor Quality','Subscription / Demand'],
   ['GMP','એન્કર ગુણવત્તા','સબ્સ્ક્રિપ્શન / માંગ'],[2,1,2]]
];
function bName(b,lang){ return lang==='gu'? b[1] : b[0]; }
function bItems(b,lang){ return lang==='gu'? b[5] : b[4]; }
function blockScore(p,b){ var t=0; b[3].forEach(function(k){ t += Number((p.score_lines||{})[k])||0; }); return t; }

/* ============================ COVER ============================ */
function cover(p, lang, docTitle, pages){
  var v = p.verdict||{}, m = p.meta||{}, ipo = p.ipo||{};
  var sc = v.scores||{}, bands = v.score_bands||{};
  var snap = [
    [L(lang,'issue_period'), e(m.open_date||'—')+' — '+e(m.close_date||'—')],
    [L(lang,'price_band'), '₹'+e(ipo.price_band||'—')+' · '+L(lang,'issue_at')+' ₹'+n(ipo.issue_price)],
    [L(lang,'issue_size'), cr(ipo.issue_size_cr)+' · '+L(lang,'fresh')+' '+cr(ipo.fresh_cr)+' · OFS '+cr(ipo.ofs_cr)],
    [L(lang,'subscription'), (ipo.subscription&&ipo.subscription.overall!=null? n(ipo.subscription.overall,1)+'×':'—')
      + (ipo.subscription&&ipo.subscription.qib!=null?' · QIB '+n(ipo.subscription.qib,2)+'×':'')
      + (ipo.subscription&&ipo.subscription.retail!=null?' · Retail '+n(ipo.subscription.retail,2)+'×':'')],
    [L(lang,'gmp'), (ipo.gmp&&ipo.gmp.value!=null? '₹'+n(ipo.gmp.value)+' ('+pct(ipo.gmp.pct)+')':'—')+' — '+L(lang,'unofficial')],
    [L(lang,'market_cap'), cr(ipo.market_cap_cr)],
    [L(lang,'promoter_hold'), p.people&&p.people.promoter_holding_pre!=null
        ? pct(p.people.promoter_holding_pre)+' → '+pct(p.people.promoter_holding_post)+' '+L(lang,'post_issue') : '—'],
    [L(lang,'listing'), e(m.listing_date||'—')+' · '+e(m.exchanges||'NSE, BSE')]
  ];
  var inner =
    '<div style="height:7mm"></div>'
    + '<div class="eyebrow en">'+e(docTitle)+' &nbsp;·&nbsp; '+e(A(lang,m.ipo_type||'Mainboard'))+' &nbsp;·&nbsp; '+e(L(lang,'india'))+'</div>'
    + '<h1 class="en" style="margin-top:2mm">'+e(m.company||'')+'</h1>'
    + '<div class="mut" style="margin-top:1mm;font-size:8pt">'+e(tr(p,lang,m.sector||''))
      + (m.sector?' &nbsp;·&nbsp; ':'')+e(m.analysis_datetime||'')+'</div>'
    + '<div style="height:2.5mm;background:var(--teal);width:26mm;border-radius:1mm;margin:4mm 0 5mm"></div>'
    + '<div class="vb"><div class="h">'+e(L(lang,'verdict_h'))+'</div><div class="c">'
      + '<div class="v">'+e(pick(p,lang,'verdict.headline', v.headline))+'</div>'
      + '<div class="lead" style="margin-top:2mm">'+e(pick(p,lang,'verdict.one_liner', v.one_liner))+'</div>'
      + '</div></div>'
    + '<div class="tiles" style="margin-top:5mm">'
      + [['ipo_quality','/100'],['long_term','/100'],['listing_gain','/100']].map(function(t){
          return '<div class="tile"><div class="k">'+e(L(lang,t[0]))+'</div><div class="v">'+n(sc[t[0]],1)
            +'<small>'+t[1]+'</small></div><div class="s">'+e(A(lang, bands[t[0]]||bandOf(sc[t[0]])))+'</div></div>';
        }).join('')
      + '<div class="tile"><div class="k">'+e(L(lang,'allocation'))+'</div><div class="v">'
        + e(v.allocation_band||'—')+'</div><div class="s">'+e(L(lang,'of_portfolio'))+'</div></div>'
    + '</div>'
    + sec('01', L(lang,'thesis'))
    + '<div class="lead">'+arr(pick(p,lang,'verdict.thesis', arr(v.thesis))).map(function(t){
        return '<p style="margin-bottom:1.6mm">'+e(t)+'</p>'; }).join('')+'</div>'
    + sec('02', L(lang,'snapshot'))
    + tbl([L(lang,'parameter'), L(lang,'detail')], snap.map(function(r){
        return [ '<span style="color:var(--ink3)">'+e(r[0])+'</span>', '<span class="en">'+r[1]+'</span>' ]; }))
    + '<div class="grow"></div>'
    + '<div class="mut" style="border-top:.6pt solid var(--rule);padding-top:2.5mm">'
      + e(L(lang,'disclaimer'))+'</div>';
  return page(p, 1, pages, 'Verdict', inner, lang);
}

/* ============================ REPORT ============================ */
/* A payload that lost sections to truncation must still render. Every renderer
   normalises first, so a missing block becomes an empty one rather than a
   thrown error that leaves the user with no documents at all. */
function safePayload(p){
  p = (p && typeof p === 'object') ? p : {};
  p.meta = p.meta || {};
  p.verdict = p.verdict || {};
  p.verdict.scores = p.verdict.scores || {};
  p.verdict.score_bands = p.verdict.score_bands || {};
  p.ipo = p.ipo || {};
  p.company = (p.company && typeof p.company === 'object') ? p.company : {};
  p.financials = p.financials || {};
  p.people = p.people || {};
  p.decision = p.decision || {};
  p.score_lines = p.score_lines || {};
  p.score_basis = p.score_basis || {};
  p.gu = p.gu || {};
  if(!S(p.meta.company)) p.meta.company = S(p.meta.short_name) || 'IPO';
  if(!S(p.meta.short_name)) p.meta.short_name = S(p.meta.company);
  return p;
}

function buildReport(p, lang){
  p = safePayload(p);
  lang = lang || 'en';
  var TOT = 10, out = '';
  var m = p.meta||{}, f = p.financials||{}, c = p.company||{}, pe = p.people||{}, d = p.decision||{}, ipo = p.ipo||{};
  out += cover(p, lang, 'IPO Company Research Report', TOT);

  var sl = p.score_lines||{};
  out += page(p, 2, TOT, 'Scorecard', sec('03', L(lang,'score_100'))
    + BLOCKS.map(function(b){
        var got = blockScore(p,b), items = bItems(b,lang);
        return '<div style="margin-bottom:3mm">'
          + barRow(bName(b,lang), got/b[2]*100, got.toFixed(1)+' / '+b[2], 'var(--navy)')
          + b[3].map(function(k,i){
              var val = Number(sl[k])||0, mx = b[6][i];
              return '<div class="bar" style="margin-left:6mm"><div class="bl" style="flex:0 0 36mm;font-size:6.7pt;color:var(--ink3)">'
                + e(items[i]) + '</div><div class="bt" style="height:2.1mm"><div class="bf" style="width:'
                + (val/mx*100) + '%;background:var(--teal)"></div></div><div class="bv en" style="flex:0 0 13mm;font-size:6.7pt">'
                + val.toFixed(1) + '<span style="color:var(--ink4)">/'+mx+'</span></div></div>';
            }).join('') + '</div>';
      }).join('')
    + '<div class="note"><b>'+e(L(lang,'how_to_read'))+'</b>'+e(L(lang,'how_to_read_b'))+'</div>'
    + sec('04', L(lang,'listing_assess'))
    + tbl([L(lang,'component'),L(lang,'max'),L(lang,'score'),L(lang,'basis')],
        arr((ipo.listing_gain||{}).components).map(function(x){
          return { cells:[e(tr(p,lang,x.factor)), n(x.max), '<b>'+n(x.score,0)+'</b>', '<span class="mut">'+e(tr(p,lang,x.note))+'</span>'] }; })
        .concat([{ __cls:'tot', cells:[L(lang,'lg_score'),'100','<b>'+n((ipo.listing_gain||{}).score,0)+'</b>','' ] }]),
        { num:[1,2] })
    + ((ipo.listing_gain||{}).verdict?'<div class="note" style="margin-top:2mm">'+e(ipo.listing_gain.verdict)+'</div>':'')
    + '<div class="grow"></div>', lang);

  var fresh = Number(ipo.fresh_cr)||0, ofs = Number(ipo.ofs_cr)||0, tot = fresh+ofs;
  var fpct = tot? (fresh/tot*100) : 0;
  out += page(p, 3, TOT, 'The IPO', sec('05', L(lang,'issue_struct'))
    + '<div style="display:flex;gap:6mm;align-items:center;margin-bottom:3mm">'
      + '<div class="donut" style="background:conic-gradient(var(--teal) 0 '+fpct.toFixed(1)+'%, var(--navy) '+fpct.toFixed(1)+'% 100%)"></div>'
      + '<div class="dlegend"><div><i style="background:var(--teal)"></i><b>'+e(L(lang,'fresh_issue'))+'</b> <span class="en">'+cr(fresh)+' · '+pct(fpct,1)+'</span></div>'
      + '<div><i style="background:var(--navy)"></i><b>'+e(L(lang,'ofs'))+'</b> <span class="en">'+cr(ofs)+' · '+pct(100-fpct,1)+'</span></div>'
      + '<div style="margin-top:1.5mm;color:var(--ink3)">'+e(L(lang,'total'))+' <span class="en">'+cr(tot)+' · '+L(lang,'lot')+' '+n(ipo.lot_size)
      + ' '+L(lang,'shares_min')+' ₹'+n(ipo.min_investment)+'</span></div></div><div style="flex:1"></div></div>'
    + '<div class="note'+(/exit/i.test(S(ipo.structure_verdict))?' bad':'')+'">'
      + '<b>'+e(ipo.structure_verdict||'—')+'</b>'+e(pick(p,lang,'ipo.structure_note', ipo.structure_note))+'</div>'
    + sec('06', L(lang,'money_goes'))
    + tbl([L(lang,'use_proceeds'),L(lang,'rs_crore'),L(lang,'assessment')], arr(ipo.objects).map(function(o){
        return { cells:[e(tr(p,lang,o.use)), n(o.amount_cr,2), '<span class="mut">'+e(tr(p,lang,o.verdict))+'</span>'] }; }), { num:[1] })
    + sec('07', L(lang,'who_selling'))
    + tbl([L(lang,'seller'),L(lang,'type'),L(lang,'rs_crore')], arr(ipo.selling_shareholders).map(function(x){
        return { cells:['<span class="en">'+e(x.name)+'</span>', e(tr(p,lang,x.type)), n(x.amount_cr,2)] }; }), { num:[2] })
    + sec('08', L(lang,'anchors'))
    + tbl([L(lang,'anchor'),L(lang,'type'),L(lang,'rs_crore')], arr((ipo.anchors||{}).top).map(function(x){
        return { cells:['<span class="en">'+e(x.name)+'</span>', e(tr(p,lang,x.type)),
                 x.amount_cr==null?L(lang,'not_disclosed'):n(x.amount_cr,2)] }; }), { num:[2] })
    + '<div class="mut" style="margin-top:1.5mm">'+e(L(lang,'anchor_total'))+' <span class="en">'
      + cr((ipo.anchors||{}).total_cr)+'</span> · '+e(L(lang,'lockin'))+' '+e((ipo.anchors||{}).lockin||'—')+'. '
      + e((ipo.anchors||{}).note||'')+' '+e(L(lang,'anchor_caveat'))+'</div>'
    + '<div class="grow"></div>', lang);

  var segs = arr(c.segments);
  out += page(p, 4, TOT, 'The Company', sec('09', L(lang,'what_does'))
    + '<div class="lead">'+e(pick(p,lang,'company.what_it_does', c.what_it_does))+'</div>'
    + '<div class="grid2" style="margin-top:3mm">'
      + '<div><div class="eyebrow">'+e(L(lang,'how_earns'))+'</div><div class="mut" style="font-size:7.4pt;margin-top:1mm">'
        + e(pick(p,lang,'company.how_it_earns', c.how_it_earns))+'</div></div>'
      + '<div><div class="eyebrow">'+e(L(lang,'why_stay'))+'</div><div class="mut" style="font-size:7.4pt;margin-top:1mm">'
        + e(pick(p,lang,'company.why_customers_stay', c.why_customers_stay))+'</div></div></div>'
    + sec('10', L(lang,'rev_mix'))
    + segs.map(function(s){ return barRow(tr(p,lang,s.name), Number(s.revenue_pct)||0, pct(s.revenue_pct,1), 'var(--teal)'); }).join('')
    + tbl([L(lang,'segment'),L(lang,'share_pc'),L(lang,'growth'),L(lang,'note')], segs.map(function(s){
        return { cells:[e(tr(p,lang,s.name)), pct(s.revenue_pct,1), s.growth_pct==null?'—':pct(s.growth_pct,1),
                 '<span class="mut">'+e(tr(p,lang,s.note))+'</span>'] }; }), { num:[1,2] })
    + sec('11', L(lang,'op_metrics'))
    + '<div class="grid4">'+arr(c.operating_metrics).slice(0,8).map(function(x){
        return '<div class="kv"><div class="k">'+e(tr(p,lang,x.label))+'</div><div class="v en">'+e(x.value)+'</div></div>';
      }).join('')+'</div>'
    + '<div class="grow"></div>', lang);

  var ind = c.industry||{}, moat = c.moat||{};
  out += page(p, 5, TOT, 'Industry & Moat', sec('12', L(lang,'industry'))
    + '<div class="grid3" style="margin-bottom:3mm">'
      + '<div class="kv"><div class="k">'+e(L(lang,'classification'))+'</div><div class="v" style="font-size:9.5pt">'+e(ind.classification||'—')+'</div></div>'
      + '<div class="kv"><div class="k">'+e(L(lang,'pricing_power'))+'</div><div class="v" style="font-size:9.5pt">'+e(ind.pricing_power||'—')+'</div></div>'
      + '<div class="kv"><div class="k">'+e(L(lang,'moat_rating'))+'</div><div class="v" style="font-size:9.5pt">'+e(moat.rating||'—')+'</div></div></div>'
    + '<div class="lead">'+e(pick(p,lang,'company.industry_growth_note', ind.growth_note))+'</div>'
    + '<div class="eyebrow" style="margin-top:3mm">'+e(L(lang,'drivers'))+'</div>'
    + '<ul class="blist" style="margin-top:1mm">'+arr(pick(p,lang,'company.drivers', arr(ind.drivers))).map(function(x){
        return '<li>'+e(x)+'</li>'; }).join('')+'</ul>'
    + (ind.market_share_note?'<div class="note" style="margin-top:2mm">'+e(ind.market_share_note)+'</div>':'')
    + sec('13', L(lang,'comp_adv'))
    + tbl([L(lang,'source_adv'),L(lang,'verdict'),L(lang,'evidence')], arr(moat.sources).map(function(x){
        return { cells:[e(tr(p,lang,x.source)),
          '<span class="pill" style="background:'+(x.verdict==='Real'?'var(--good)':x.verdict==='None'?'#9AA2AD':'var(--amber)')+'">'
            +e(A(lang,x.verdict))+'</span>', '<span class="mut">'+e(tr(p,lang,x.evidence))+'</span>'] }; }))
    + (moat.note?'<div class="note" style="margin-top:2mm">'+e(pick(p,lang,'company.moat_note', moat.note))+'</div>':'')
    + '<div class="grow"></div>', lang);

  out += page(p, 6, TOT, 'Financials', sec('14', L(lang,'three_yr'))
    + tbl([L(lang,'rs_crore')].concat(arr(f.years)).concat([L(lang,'trend')]), arr(f.rows).map(function(r){
        return { __cls: r.highlight?'hi':'', cells:[e(tr(p,lang,r.label))]
          .concat(arr(r.values).map(function(x){ return typeof x==='number'? n(x, Math.abs(x)<100?2:0) : e(x); }))
          .concat(['<span class="mut">'+e(tr(p,lang,r.trend))+'</span>']) }; }), { num:[1,2,3] })
    + (f.note?'<div class="mut" style="margin-top:1.5mm">'+e(f.note)+'</div>':'')
    + sec('15', L(lang,'key_ratios'))
    + '<div class="grid4">'+arr(f.ratios).slice(0,8).map(function(r){
        return '<div class="kv"><div class="k">'+e(tr(p,lang,r.label))+'</div><div class="v en '+toneClass(r.tone)+'">'
          + e(r.value)+'</div><div class="s">'+e(tr(p,lang,r.direction))+'</div></div>'; }).join('')+'</div>'
    + '<div class="grow"></div>', lang);

  var eq = f.earnings_quality||{}, bs = f.balance_sheet||{};
  var cfoBar = '';
  if(eq.cfo_pat != null){
    var cv = Number(eq.cfo_pat);
    cfoBar = barRow('CFO / PAT', Math.min(100, cv/1.5*100), cv.toFixed(2)+'×',
                    cv>=1?'var(--good)':cv>=0.7?'var(--amber)':'var(--bad)', 66.7);
  }
  out += page(p, 7, TOT, 'Cash & Balance Sheet', sec('16', L(lang,'profit_cash'))
    + '<div class="grid3" style="margin-bottom:3mm">'
      + '<div class="kv"><div class="k">'+e(L(lang,'earn_quality'))+'</div><div class="v" style="font-size:9.5pt">'+e(eq.rating||'—')+'</div></div>'
      + '<div class="kv"><div class="k en">CFO / PAT</div><div class="v en '+(eq.cfo_pat!=null&&eq.cfo_pat<0.7?'tn-bad':'tn-good')+'">'
        + (eq.cfo_pat==null?'—':Number(eq.cfo_pat).toFixed(2)+'×')+'</div></div>'
      + '<div class="kv"><div class="k en">FCF / PAT</div><div class="v en '+(eq.fcf_pat!=null&&eq.fcf_pat<0?'tn-bad':'')+'">'
        + (eq.fcf_pat==null?'—':Number(eq.fcf_pat).toFixed(2)+'×')+'</div></div></div>'
    + cfoBar + (cfoBar?'<div class="mut" style="margin-bottom:2mm">'+e(L(lang,'cfo_marker'))+'</div>':'')
    + (arr(pick(p,lang,'financials.eq_flags', arr(eq.flags))).length
        ? '<ul class="blist">'+arr(pick(p,lang,'financials.eq_flags', arr(eq.flags))).map(function(x){
            return '<li>'+e(x)+'</li>'; }).join('')+'</ul>' : '')
    + '<div class="note'+(eq.rating==='Low'||eq.rating==='Red flag'?' bad':'')+'" style="margin-top:2mm">'
      + e(pick(p,lang,'financials.earnings_quality_note', eq.note))+'</div>'
    + sec('17', L(lang,'bal_sheet'))
    + '<div class="eyebrow" style="margin-bottom:1.5mm">'+e(L(lang,'rating'))+': '+e(bs.rating||'—')+'</div>'
    + tbl([L(lang,'item'),L(lang,'position')], arr(bs.items).map(function(x){
        return { cells:[e(tr(p,lang,x.label)), '<span class="en '+toneClass(x.tone)+'">'+e(tr(p,lang,x.value))+'</span>'] }; }))
    + '<div class="grow"></div>', lang);

  var val = f.valuation||{}, peers = f.peers||{}, scn = f.scenarios||{};
  var cases = arr(scn.cases), maxV = Math.max.apply(null, cases.map(function(x){ return Number(x.value_per_share)||0; }).concat([1]));
  out += page(p, 8, TOT, 'Valuation', sec('18', L(lang,'valuation_at'))
    + '<div class="eyebrow" style="margin-bottom:1.5mm">'+e(L(lang,'verdict'))+': '+e(val.verdict||'—')+'</div>'
    + tbl([L(lang,'multiple'),L(lang,'value'),L(lang,'denom')], arr(val.multiples).map(function(x){
        return { cells:['<span class="en">'+e(tr(p,lang,x.label))+'</span>', '<b class="en">'+e(x.value)+'</b>',
          '<span class="mut">'+e(tr(p,lang,x.basis))+(x.label_tag?' <i style="font-style:normal;color:var(--teal)">['+e(tr(p,lang,x.label_tag))+']</i>':'')+'</span>'] };
      }), { num:[1] })
    + (val.note?'<div class="note" style="margin-top:2mm">'+e(pick(p,lang,'financials.valuation_note', val.note))+'</div>':'')
    + sec('19', L(lang,'peers'))
    + tbl(arr(peers.columns), arr(peers.rows).map(function(r){
        return { __cls: r.is_subject?'hi':'', cells: arr(r.cells).map(function(x){ return '<span class="en">'+e(x)+'</span>'; }) };
      }), { num:[1,2,3,4,5,6,7,8] })
    + (peers.note?'<div class="mut" style="margin-top:1.5mm">'+e(pick(p,lang,'financials.peers_note', peers.note))+'</div>':'')
    + sec('20', L(lang,'scenarios')+(scn.horizon?' '+L(lang,'to_')+' '+scn.horizon:''))
    + cases.map(function(x){
        var col = x.case==='Bear'?'var(--bad)':x.case==='Bull'?'var(--good)':'var(--navy2)';
        return barRow(A(lang,S(x.case)), (Number(x.value_per_share)||0)/maxV*100, '₹'+n(x.value_per_share), col); }).join('')
    + tbl([L(lang,'case_'),L(lang,'val_share'),L(lang,'vs_issue'),L(lang,'vs_listing'),L(lang,'key_assum')],
        cases.map(function(x){
          var c1 = (Number(x.vs_issue_pct)||0) < 0 ? 'var(--bad)' : 'var(--good)';
          var c2 = (Number(x.vs_listing_pct)||0) < 0 ? 'var(--bad)' : 'var(--good)';
          return { cells:['<b>'+e(A(lang,x.case))+'</b>', '₹'+n(x.value_per_share),
            '<span style="color:'+c1+'">'+pct(x.vs_issue_pct,0)+'</span>',
            '<span style="color:'+c2+'">'+pct(x.vs_listing_pct,0)+'</span>',
            '<span class="mut">'+e(tr(p,lang,x.assumption))+'</span>'] }; }), { num:[1,2,3] })
    + '<div class="mut" style="margin-top:1.5mm">'+e(pick(p,lang,'financials.scenarios_note', scn.note))
      + ' '+e(L(lang,'scen_caveat'))+'</div>'
    + '<div class="grow"></div>', lang);

  var gov = pe.governance||{};
  out += page(p, 9, TOT, 'Promoters & Governance', sec('21', L(lang,'promoters'))
    + (pe.has_promoter===false
        ? '<div class="note bad"><b>'+e(L(lang,'no_promoter'))+'</b>'+e(L(lang,'no_promoter_b'))+'</div>'
        : '<div class="mut" style="margin-bottom:2mm">'+e(L(lang,'holding_pre'))+' <span class="en">'
          + pct(pe.promoter_holding_pre)+'</span> '+e(L(lang,'before_issue'))+', <span class="en">'
          + pct(pe.promoter_holding_post)+'</span> '+e(L(lang,'after_'))+'.</div>')
    + tbl([L(lang,'name_'),L(lang,'role_'),L(lang,'background')], arr(pe.promoters).map(function(x){
        return { cells:['<b class="en">'+e(x.name)+'</b>', e(tr(p,lang,x.role)), '<span class="mut">'+e(tr(p,lang,x.background))+'</span>'] }; }))
    + sec('22', L(lang,'bg_checks'))
    + tbl([L(lang,'check_'),L(lang,'finding'),L(lang,'standard')], arr(pe.due_diligence).map(function(x){
        return { cells:[e(tr(p,lang,x.check)), '<span class="mut">'+e(tr(p,lang,x.finding))+'</span>',
          '<span class="pill" style="background:'+(x.standard==='Verified'?'var(--good)':x.standard==='Allegation'?'var(--amber)':'#7C838C')+'">'
          +e(A(lang,x.standard))+'</span>'] }; }))
    + '<div class="mut" style="margin-top:1.5mm">'+e(pick(p,lang,'people.dd_note', pe.dd_note))+'</div>'
    + sec('23', L(lang,'governance')+' — '+n(gov.score_10,1)+' / 10')
    + tbl([L(lang,'parameter'),L(lang,'finding'),L(lang,'flag_')], arr(gov.items).map(function(x){
        return { cells:[e(tr(p,lang,x.parameter)), '<span class="mut">'+e(tr(p,lang,x.finding))+'</span>',
          '<span class="pill" style="background:'+(x.flag==='Clean'?'var(--good)':x.flag==='High'?'var(--bad)':x.flag==='Medium'?'var(--amber)':'#7C838C')+'">'
          +e(A(lang,x.flag))+'</span>'] }; }))
    + '<div class="grow"></div>', lang);

  out += page(p, 10, TOT, 'The Decision', sec('24', L(lang,'str_weak'))
    + '<div class="grid2">'
      + '<div><div class="eyebrow" style="color:var(--good)">'+e(L(lang,'strengths'))+'</div><ul class="blist" style="margin-top:1mm">'
        + arr(pick(p,lang,'decision.strengths', arr(d.strengths))).map(function(x,i){
            var en = arr(d.strengths)[i]||{};
            return '<li><b>'+e(safeTr(S(en.title), S(x.title)||S(en.title)))+'</b> — '+e(safeTr(S(en.evidence), S(x.evidence)||S(en.evidence)))+'</li>'; }).join('')
        + '</ul></div>'
      + '<div><div class="eyebrow" style="color:var(--bad)">'+e(L(lang,'weaknesses'))+'</div><ul class="blist" style="margin-top:1mm">'
        + arr(pick(p,lang,'decision.weaknesses', arr(d.weaknesses))).map(function(x,i){
            var en = arr(d.weaknesses)[i]||{};
            return '<li><b>'+e(safeTr(S(en.title), S(x.title)||S(en.title)))+'</b> — '+e(safeTr(S(en.evidence), S(x.evidence)||S(en.evidence)))+'</li>'; }).join('')
        + '</ul></div></div>'
    + sec('25', L(lang,'red_flags'))
    + tbl([L(lang,'red_flag'),L(lang,'evidence'),L(lang,'severity')], arr(d.red_flags).map(function(x,i){
        var g = arr(pick(p,lang,'decision.red_flags', []))[i]||{};
        return { cells:['<b>'+e(safeTr(S(x.flag), S(g.flag)||S(x.flag)))+'</b>', '<span class="mut">'+e(safeTr(S(x.evidence), S(g.evidence)||S(x.evidence)))+'</span>',
          '<span class="pill '+sevClass(x.severity)+'">'+e(A(lang,x.severity))+'</span>'] }; }))
    + sec('26', L(lang,'monitoring'))
    + tbl([L(lang,'metric'),L(lang,'current'),L(lang,'desired'),L(lang,'warning')], arr(d.monitoring).map(function(x){
        return { cells:[e(tr(p,lang,x.metric)), '<b class="en">'+e(tr(p,lang,x.current))+'</b>',
                 '<span class="mut">'+e(tr(p,lang,x.desired))+'</span>',
                 '<span class="mut">'+e(tr(p,lang,x.warning))+'</span>'] }; }), { num:[1] })
    + sec('27', L(lang,'alloc_levels'))
    + '<div class="grid2"><div>'
      + tbl([L(lang,'action'),L(lang,'price'),L(lang,'rationale')], levelsOf(p,lang,d).map(function(x){
          return { cells:[e(tr(p,lang,x.action)), '<b class="en">'+e(x.price)+'</b>', '<span class="mut">'+e(tr(p,lang,x.rationale))+'</span>'] }; }), { num:[1] })
      + '</div><div class="note"><b>'+e(L(lang,'sugg_alloc'))+': '+e((p.verdict||{}).allocation_band||'—')+'</b>'
      + e(pick(p,lang,'decision.allocation_note', d.allocation_note))+'</div></div>'
    + (d.watch_number ? '<div class="note good" style="margin-top:3mm"><b>'+e(L(lang,'watch_one'))+' — '
        + e(pick(p,lang,'decision.watch_number.title', d.watch_number.title))+'</b>'
        + e(pick(p,lang,'decision.watch_number.body', d.watch_number.body))+'</div>' : '')
    + '<div class="grow"></div>'
    + '<div class="mut" style="border-top:.6pt solid var(--rule);padding-top:2mm">'
      + '<b>'+e(L(lang,'sources'))+'.</b> '+e(L(lang,'primary'))+': <span class="en">'
      + arr((p.sources||{}).primary).map(e).join(' · ')+'</span>. '+e(L(lang,'secondary'))+': <span class="en">'
      + arr((p.sources||{}).secondary).map(e).join(' · ')+'</span>'
      + (arr((p.sources||{}).missing).length ? '. <b>'+e(L(lang,'missing'))+':</b> '
          + arr(p.sources.missing).map(e).join(' · ') : '') + '.</div>', lang);

  return shell(S(m.company)+' — IPO Company Research Report', lang==='gu'?'gu':'', out);
}

/* ======================= EXECUTIVE SUMMARY ======================= */
function buildExec(p, lang){
  p = safePayload(p);
  lang = lang || 'en';
  var TOT = 4, out = '', f = p.financials||{}, d = p.decision||{}, m = p.meta||{};
  out += cover(p, lang, 'Executive Summary', TOT);

  out += page(p, 2, TOT, 'The Numbers', sec('03', L(lang,'three_yr'))
    + tbl([L(lang,'rs_crore')].concat(arr(f.years)).concat([L(lang,'trend')]), arr(f.rows).slice(0,9).map(function(r){
        return { __cls:r.highlight?'hi':'', cells:[e(tr(p,lang,r.label))]
          .concat(arr(r.values).map(function(v){ return typeof v==='number'? n(v,Math.abs(v)<100?2:0):e(v); }))
          .concat(['<span class="mut">'+e(tr(p,lang,r.trend))+'</span>']) }; }), { num:[1,2,3] })
    + sec('04', L(lang,'key_ratios'))
    + '<div class="grid4">'+arr(f.ratios).slice(0,8).map(function(r){
        return '<div class="kv"><div class="k">'+e(tr(p,lang,r.label))+'</div><div class="v en '+toneClass(r.tone)+'">'
          +e(r.value)+'</div></div>'; }).join('')+'</div>'
    + sec('05', L(lang,'valuation_at'))
    + tbl([L(lang,'multiple'),L(lang,'value'),L(lang,'basis')], arr((f.valuation||{}).multiples).slice(0,7).map(function(x){
        return { cells:['<span class="en">'+e(tr(p,lang,x.label))+'</span>', '<b class="en">'+e(x.value)+'</b>',
                 '<span class="mut">'+e(tr(p,lang,x.basis))+'</span>'] }; }), { num:[1] })
    + sec('06', L(lang,'peers'))
    + tbl(arr((f.peers||{}).columns), arr((f.peers||{}).rows).map(function(r){
        return { __cls:r.is_subject?'hi':'', cells:arr(r.cells).map(function(x){ return '<span class="en">'+e(x)+'</span>'; }) };
      }), { num:[1,2,3,4,5,6,7,8] })
    + '<div class="grow"></div>', lang);

  var cases = arr((f.scenarios||{}).cases);
  var maxV = Math.max.apply(null, cases.map(function(x){ return Number(x.value_per_share)||0; }).concat([1]));
  out += page(p, 3, TOT, 'The Risk', sec('07', L(lang,'str_weak'))
    + '<div class="grid2">'
      + '<div><div class="eyebrow" style="color:var(--good)">'+e(L(lang,'strengths'))+'</div><ul class="blist" style="margin-top:1mm">'
        + arr(pick(p,lang,'decision.strengths', arr(d.strengths))).slice(0,5).map(function(x,i){
            var en=arr(d.strengths)[i]||{}; return '<li><b>'+e(safeTr(S(en.title), S(x.title)||S(en.title)))+'</b> — '+e(safeTr(S(en.evidence), S(x.evidence)||S(en.evidence)))+'</li>'; }).join('')
      + '</ul></div><div><div class="eyebrow" style="color:var(--bad)">'+e(L(lang,'weaknesses'))+'</div><ul class="blist" style="margin-top:1mm">'
        + arr(pick(p,lang,'decision.weaknesses', arr(d.weaknesses))).slice(0,5).map(function(x,i){
            var en=arr(d.weaknesses)[i]||{}; return '<li><b>'+e(safeTr(S(en.title), S(x.title)||S(en.title)))+'</b> — '+e(safeTr(S(en.evidence), S(x.evidence)||S(en.evidence)))+'</li>'; }).join('')
      + '</ul></div></div>'
    + sec('08', L(lang,'red_flags'))
    + tbl([L(lang,'red_flag'),L(lang,'evidence'),L(lang,'severity')], arr(d.red_flags).map(function(x,i){
        var g = arr(pick(p,lang,'decision.red_flags', []))[i]||{};
        return { cells:['<b>'+e(safeTr(S(x.flag), S(g.flag)||S(x.flag)))+'</b>','<span class="mut">'+e(safeTr(S(x.evidence), S(g.evidence)||S(x.evidence)))+'</span>',
          '<span class="pill '+sevClass(x.severity)+'">'+e(A(lang,x.severity))+'</span>'] }; }))
    + sec('09', L(lang,'scenarios'))
    + cases.map(function(x){
        var col = x.case==='Bear'?'var(--bad)':x.case==='Bull'?'var(--good)':'var(--navy2)';
        return barRow(A(lang,S(x.case))+' · ₹'+n(x.value_per_share), (Number(x.value_per_share)||0)/maxV*100,
                      pct(x.vs_issue_pct,0), col); }).join('')
    + '<div class="mut" style="margin-top:1.5mm">'+e(L(lang,'scen_caveat'))+'</div>'
    + '<div class="grow"></div>', lang);

  out += page(p, 4, TOT, 'The Decision', sec('10', L(lang,'recommendation'))
    + '<div class="vb"><div class="h">'+e(A(lang,(p.verdict||{}).recommendation||''))+'</div><div class="c">'
      + '<div class="lead">'+e(pick(p,lang,'verdict.one_liner',(p.verdict||{}).one_liner))+'</div></div></div>'
    + sec('11', L(lang,'allocation'))
    + '<div class="note"><b>'+e((p.verdict||{}).allocation_band||'—')+'</b>'
      + e(pick(p,lang,'decision.allocation_note', d.allocation_note))+'</div>'
    + sec('12', L(lang,'alloc_levels'))
    + tbl([L(lang,'action'),L(lang,'price'),L(lang,'rationale')], levelsOf(p,lang,d).map(function(x){
        return { cells:[e(tr(p,lang,x.action)),'<b class="en">'+e(x.price)+'</b>','<span class="mut">'+e(tr(p,lang,x.rationale))+'</span>'] }; }), { num:[1] })
    + sec('13', L(lang,'monitoring'))
    + tbl([L(lang,'metric'),L(lang,'current'),L(lang,'desired'),L(lang,'warning')], arr(d.monitoring).slice(0,6).map(function(x){
        return { cells:[e(tr(p,lang,x.metric)),'<b class="en">'+e(tr(p,lang,x.current))+'</b>',
                 '<span class="mut">'+e(tr(p,lang,x.desired))+'</span>',
                 '<span class="mut">'+e(tr(p,lang,x.warning))+'</span>'] }; }), { num:[1] })
    + (d.watch_number ? '<div class="note good" style="margin-top:3mm"><b>'
        + e(pick(p,lang,'decision.watch_number.title', d.watch_number.title))+'</b>'
        + e(pick(p,lang,'decision.watch_number.body', d.watch_number.body))+'</div>' : '')
    + '<div class="grow"></div>'
    + '<div class="mut" style="border-top:.6pt solid var(--rule);padding-top:2mm">'+e(L(lang,'disclaimer'))+'</div>', lang);

  return shell(S(m.company)+' — Executive Summary', lang==='gu'?'gu':'', out);
}

/* SWOT: use the payload's own block if present, otherwise derive it. */

/* Some arrays carry prose that must be translated but has no natural label to
   look up — price levels are the clearest case. The Gujarati block may supply a
   parallel array; overlay it positionally and fall back per field. */
function levelsOf(p, lang, d){
  var base = arr(d.levels);
  if(lang !== 'gu') return base;
  var g = (p.gu && p.gu.decision && Array.isArray(p.gu.decision.levels)) ? p.gu.decision.levels : [];
  return base.map(function(x, i){
    var o = g[i] || {};
    return { action: o.action || x.action, price: x.price, rationale: o.rationale || x.rationale };
  });
}
function swotOf(p, lang){
  var d = p.decision||{}, sw = d.swot||{};
  var gsw = (p.gu||{}).decision ? ((p.gu.decision||{}).swot||{}) : {};
  function take(list, keyA, keyB){
    return arr(list).slice(0,3).map(function(x){ return S(x[keyA]) || S(x[keyB]) || S(x); });
  }
  var g = lang==='gu' ? gsw : {};
  return {
    s: arr(g.strengths).length ? arr(g.strengths).slice(0,3)
       : (arr(sw.strengths).length ? arr(sw.strengths).slice(0,3)
          : take(pick(p,lang,'decision.strengths', arr(d.strengths)),'title','flag')),
    w: arr(g.weaknesses).length ? arr(g.weaknesses).slice(0,3)
       : (arr(sw.weaknesses).length ? arr(sw.weaknesses).slice(0,3)
          : take(pick(p,lang,'decision.weaknesses', arr(d.weaknesses)),'title','flag')),
    o: arr(g.opportunities).length ? arr(g.opportunities).slice(0,3)
       : (arr(sw.opportunities).length ? arr(sw.opportunities).slice(0,3)
          : take(arr(d.catalysts),'catalyst','mechanism')),
    t: arr(g.threats).length ? arr(g.threats).slice(0,3)
       : (arr(sw.threats).length ? arr(sw.threats).slice(0,3)
          : take(arr(d.failure_modes),'scenario','warning_sign'))
  };
}

/* ========================= VISUAL SUMMARY =========================
   Type is deliberately large: messaging apps downscale images hard, so
   a 15px caption becomes unreadable after WhatsApp recompresses it. */
var VCSS = `
.vpage{ width:1240px; height:1754px; background:#fff; padding:50px 54px 56px; position:relative;
        display:flex; flex-direction:column; page-break-after:always; font-size:19px; line-height:1.5; }
.vpage:last-child{ page-break-after:auto; }
.vpage > *{ flex:0 0 auto; }
.vpage .vfoot{ flex:0 0 auto; }
.vpage .vfootw{ flex:0 0 auto; }
body.gu .vpage{ font-size:19px; line-height:1.72; }
.vmast{ display:flex; justify-content:space-between; align-items:flex-end;
        border-bottom:5px solid var(--navy); padding-bottom:14px; }
.vmast h1{ font-size:40px; letter-spacing:-.02em; color:var(--navy); line-height:1.08; }
.vmast .s{ font-size:19px; color:var(--ink3); margin-top:6px; }
.vmast .r{ text-align:right; font-size:16px; color:var(--ink3); line-height:1.6; }
.vsec{ font-size:17px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; color:var(--navy);
       margin:22px 0 11px; display:flex; align-items:center; gap:12px; }
body.gu .vsec{ letter-spacing:.04em; font-size:19px; }
.vsec::after{ content:""; flex:1; height:2px; background:var(--rule); }
.vhero{ border:3px solid var(--navy); border-radius:14px; overflow:hidden; margin-top:20px; }
.vhero .h{ background:var(--navy); color:#fff; padding:11px 20px; font-size:17px; font-weight:800;
           letter-spacing:.12em; text-transform:uppercase; }
body.gu .vhero .h{ letter-spacing:.04em; font-size:18px; }
.vhero .c{ padding:18px 20px; }
.vhero .v{ font-size:37px; font-weight:800; letter-spacing:-.02em; color:var(--navy); line-height:1.2; }
.vhero p{ font-size:20px; color:var(--ink2); margin-top:10px; line-height:1.5; }
.vtiles{ display:grid; grid-template-columns:repeat(4,1fr); gap:13px; margin-top:18px; }
.vtile{ border:2px solid var(--rule); border-top:7px solid var(--navy); border-radius:10px; padding:14px 16px;
        background:var(--panel2); }
.vtile .k{ font-size:15px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--ink3); }
body.gu .vtile .k{ letter-spacing:.02em; font-size:16px; }
.vtile .v{ font-size:44px; font-weight:800; letter-spacing:-.03em; line-height:1.05; margin-top:5px; }
.vtile .v small{ font-size:19px; color:var(--ink4); }
.vtile .s{ font-size:16px; color:var(--ink2); margin-top:3px; }
.vinfo{ display:grid; grid-template-columns:repeat(4,1fr); gap:13px; margin-top:13px; }
.vinfo .c{ border:2px solid var(--rule); border-radius:10px; padding:12px 15px; }
.vinfo .k{ font-size:14px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--ink3); }
body.gu .vinfo .k{ letter-spacing:.02em; font-size:15px; }
.vinfo .v{ font-size:24px; font-weight:800; letter-spacing:-.02em; margin-top:4px; line-height:1.2; }
.vinfo .s{ font-size:15px; color:var(--ink3); margin-top:2px; }
.vobj{ border:2px solid var(--rule); border-left:8px solid var(--teal); border-radius:0 10px 10px 0;
       padding:13px 17px; margin-top:13px; background:var(--teal2); }
.vobj .k{ font-size:14px; font-weight:800; letter-spacing:.07em; text-transform:uppercase; color:var(--ink3); }
.vobj .b{ font-size:19px; margin-top:5px; line-height:1.5; color:var(--ink); }
.vbar{ display:flex; align-items:center; gap:14px; margin:9px 0; font-size:19px; }
.vbar .l{ flex:0 0 250px; color:var(--ink2); }
.vbar .t{ flex:1; height:22px; background:var(--rule2); border-radius:6px; overflow:hidden; }
.vbar .f{ height:100%; border-radius:0 6px 6px 0; }
.vbar .v{ flex:0 0 104px; text-align:right; font-weight:800; font-variant-numeric:tabular-nums; }
.vtab{ width:100%; border-collapse:collapse; font-size:18px; }
.vtab th{ font-size:15px; text-transform:uppercase; letter-spacing:.07em; color:var(--ink3);
          border-bottom:3px solid var(--navy); padding:9px 10px; text-align:left; font-weight:800; }
body.gu .vtab th{ letter-spacing:.02em; font-size:16px; }
.vtab td{ border-bottom:1.5px solid var(--rule2); padding:10px; vertical-align:top; }
.vtab td.n, .vtab th.n{ text-align:right; font-variant-numeric:tabular-nums;
                        font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; }
.vtab tr.hi td{ background:var(--teal2); font-weight:700; }
.vpill{ display:inline-block; font-size:14px; font-weight:800; padding:3px 12px; border-radius:13px;
        color:#fff; letter-spacing:.04em; }
.vswot{ display:grid; grid-template-columns:1fr 1fr; gap:15px; }
.vswot .q{ border:2px solid var(--rule); border-radius:12px; overflow:hidden; }
.vswot .q h4{ font-size:16px; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
              padding:9px 15px; color:#fff; }
body.gu .vswot .q h4{ letter-spacing:.03em; font-size:17px; }
.vswot .q ul{ margin:0; padding:11px 15px 13px 32px; }
.vswot .q li{ font-size:18px; line-height:1.45; margin:6px 0; }
body.gu .vswot .q li{ line-height:1.65; }
.vfootw{ margin-top:auto; border-top:2px solid var(--rule); padding-top:12px; }
.vfootn{ font-size:13px; line-height:1.4; color:var(--ink4); text-align:justify;
         margin-bottom:8px; }
body.gu .vfootn{ font-size:13px; line-height:1.55; }
.vfoot{ border-top:0; padding-top:0; font-size:14px;
        color:var(--ink4); display:flex; justify-content:space-between; gap:20px; }
`;

function buildVisual(p, lang){
  p = safePayload(p);
  lang = lang || 'en';
  var v = p.verdict||{}, sc = v.scores||{}, f = p.financials||{}, d = p.decision||{},
      ipo = p.ipo||{}, m = p.meta||{};
  var cases = arr((f.scenarios||{}).cases);
  var maxV = Math.max.apply(null, cases.map(function(x){ return Number(x.value_per_share)||0; }).concat([1]));
  function vmast(sub, right){
    return '<div class="vmast"><div><h1 class="en">'+e(m.company||'')+'</h1>'
      + '<div class="s">'+e(sub)+'</div></div><div class="r en">'+right+'</div></div>';
  }
  function vfoot(i){
    return '<div class="vfootw">'
         + '<div class="vfootn">'+e(L(lang,'footnote'))+'</div>'
         + '<div class="vfoot"><span>'+e(L(lang,'disclaimer'))+'</span>'
         + '<span class="en"><b>'+i+' / 2</b></span></div></div>';
  }
  var topObject = arr(ipo.objects).slice().sort(function(a,b){
    return (Number(b.amount_cr)||0)-(Number(a.amount_cr)||0); })[0];
  var objText = arr(ipo.objects).slice(0,3).map(function(o){
    return tr(p,lang,o.use)+' '+cr(o.amount_cr); }).join('  ·  ');

  var p1 = '<div class="vpage">'
    + vmast(tr(p,lang,S(m.sector))+' · '+A(lang,S(m.ipo_type||'Mainboard'))+' IPO',
        'IPO Company Research<br><b style="color:#12161C">'+e(m.analysis_datetime||'')+'</b><br>Page 1 of 2')
    + '<div class="vhero"><div class="h">'+e(L(lang,'verdict_h'))+'</div><div class="c">'
      + '<div class="v">'+e(pick(p,lang,'verdict.headline', v.headline))+'</div>'
      + '<p>'+e(pick(p,lang,'verdict.one_liner', v.one_liner))+'</p></div></div>'
    + '<div class="vtiles">'
      + [['ipo_quality','/100'],['long_term','/100'],['listing_gain','/100']].map(function(t){
          return '<div class="vtile"><div class="k">'+e(L(lang,t[0]))+'</div><div class="v en" style="color:'
            + bandColour(sc[t[0]])+'">'+n(sc[t[0]],1)+'<small>'+t[1]+'</small></div>'
            + '<div class="s">'+e(A(lang, (v.score_bands||{})[t[0]]||bandOf(sc[t[0]])))+'</div></div>'; }).join('')
      + '<div class="vtile"><div class="k">'+e(L(lang,'allocation'))+'</div><div class="v en">'
        + e(v.allocation_band||'—')+'</div><div class="s">'+e(L(lang,'of_portfolio'))+'</div></div></div>'
    /* --- NEW: IPO basics + GMP --- */
    + '<div class="vsec">'+e(L(lang,'ipo_basics'))+'</div>'
    + '<div class="vinfo">'
      + '<div class="c"><div class="k">'+e(L(lang,'price_band'))+'</div><div class="v en">₹'+e(ipo.price_band||'—')
        + '</div><div class="s en">'+L(lang,'issue_at')+' ₹'+n(ipo.issue_price)+'</div></div>'
      + '<div class="c"><div class="k">'+e(L(lang,'issue_size'))+'</div><div class="v en">'+cr(ipo.issue_size_cr)
        + '</div><div class="s en">'+L(lang,'fresh')+' '+cr(ipo.fresh_cr)+' · OFS '+cr(ipo.ofs_cr)+'</div></div>'
      + '<div class="c"><div class="k">'+e(L(lang,'subscription'))+'</div><div class="v en">'
        + (ipo.subscription&&ipo.subscription.overall!=null? n(ipo.subscription.overall,1)+'×':'—')
        + '</div><div class="s en">QIB '+n((ipo.subscription||{}).qib,2)+'× · Retail '+n((ipo.subscription||{}).retail,2)+'×</div></div>'
      + '<div class="c" style="border-color:var(--teal)"><div class="k">'+e(L(lang,'gmp'))+'</div><div class="v en" style="color:var(--teal)">'
        + (ipo.gmp&&ipo.gmp.value!=null? '₹'+n(ipo.gmp.value):'—')+'</div><div class="s en">'
        + pct((ipo.gmp||{}).pct)+' · '+L(lang,'unofficial')+'</div></div></div>'
    + '<div class="vobj"><div class="k">'+e(L(lang,'objective'))+'</div><div class="b"><span class="en">'
      + e(objText||'—')+'</span>'+(topObject?' — '+e(tr(p,lang,topObject.verdict)):'')+'</div></div>'
    /* --- scorecard --- */
    + '<div class="vsec">'+e(L(lang,'scorecard'))+'</div>'
    + BLOCKS.map(function(b){ var got = blockScore(p,b);
        return '<div class="vbar"><div class="l">'+e(bName(b,lang))+'</div><div class="t"><div class="f" style="width:'
          + (got/b[2]*100)+'%;background:'+(got/b[2]>=0.65?'var(--good)':got/b[2]>=0.5?'var(--teal)':'var(--amber)')
          + '"></div></div><div class="v en">'+got.toFixed(1)+'<span style="color:var(--ink4);font-size:15px">/'
          + b[2]+'</span></div></div>'; }).join('')
    /* --- NEW: three-year financials --- */
    + '<div class="vsec">'+e(L(lang,'three_yr'))+'</div>'
    + '<table class="vtab"><thead><tr><th>'+e(L(lang,'rs_crore'))+'</th>'
      + arr(f.years).map(function(y){ return '<th class="n en">'+e(y)+'</th>'; }).join('')
      + '<th class="n">'+e(L(lang,'trend'))+'</th></tr></thead><tbody>'
      + arr(f.rows).slice(0,5).map(function(r){
          return '<tr'+(r.highlight?' class="hi"':'')+'><td>'+e(tr(p,lang,r.label))+'</td>'
            + arr(r.values).map(function(x){ return '<td class="n en">'
                + (typeof x==='number'? n(x, Math.abs(x)<100?2:0) : e(x))+'</td>'; }).join('')
            + '<td class="n" style="color:var(--ink3);font-size:16px">'+e(tr(p,lang,r.trend))+'</td></tr>'; }).join('')
      + '</tbody></table>'
    + vfoot(1) + '</div>';

  var sw = swotOf(p, lang);
  function quad(title, items, colour){
    return '<div class="q"><h4 style="background:'+colour+'">'+e(title)+'</h4><ul>'
      + arr(items).slice(0,3).map(function(x){ return '<li>'+e(x)+'</li>'; }).join('')+'</ul></div>';
  }
  var p2 = '<div class="vpage">'
    + vmast(L(lang,'swot')+' · '+L(lang,'scenarios')+' · '+L(lang,'red_flags'),
        'IPO Company Research<br><b style="color:#12161C">'+e(m.analysis_datetime||'')+'</b><br>Page 2 of 2')
    /* --- NEW: SWOT --- */
    + '<div class="vsec">'+e(L(lang,'swot'))+'</div>'
    + '<div class="vswot">'
      + quad(L(lang,'strengths'), sw.s, 'var(--good)')
      + quad(L(lang,'weaknesses'), sw.w, 'var(--bad)')
      + quad(L(lang,'opportunities'), sw.o, 'var(--teal)')
      + quad(L(lang,'threats'), sw.t, 'var(--amber)')
    + '</div>'
    + '<div class="vsec">'+e(L(lang,'scenarios'))+'</div>'
    + cases.map(function(x){
        var col = x.case==='Bear'?'var(--bad)':x.case==='Bull'?'var(--good)':'var(--navy2)';
        return '<div class="vbar"><div class="l">'+e(x.case)+'</div><div class="t"><div class="f" style="width:'
          + ((Number(x.value_per_share)||0)/maxV*100)+'%;background:'+col+'"></div></div>'
          + '<div class="v en">₹'+n(x.value_per_share)+'</div></div>'; }).join('')
    + '<div class="vsec">'+e(L(lang,'red_flags'))+'</div>'
    + '<table class="vtab"><thead><tr><th>'+e(L(lang,'red_flag'))+'</th><th>'+e(L(lang,'evidence'))
      + '</th><th style="width:150px">'+e(L(lang,'severity'))+'</th></tr></thead><tbody>'
      + arr(d.red_flags).slice(0,5).map(function(x,i){
          var g = arr(pick(p,lang,'decision.red_flags', []))[i]||{};
          var sv = S(x.severity).toUpperCase();
          return '<tr><td><b>'+e(safeTr(S(x.flag), S(g.flag)||S(x.flag)))+'</b></td><td style="color:var(--ink2)">'
            + e(safeTr(S(x.evidence), S(g.evidence)||S(x.evidence)))+'</td><td><span class="vpill" style="background:'
            + (sv==='CRITICAL'?'var(--crit)':sv==='HIGH'?'var(--bad)':sv==='MEDIUM'?'var(--amber)':'#7C838C')
            + '">'+e(A(lang,x.severity))+'</span></td></tr>'; }).join('')
      + '</tbody></table>'
    + '<div class="vsec">'+e(L(lang,'alloc_levels'))+'</div>'
    + '<div style="border:3px solid var(--navy);border-radius:14px;overflow:hidden">'
      + '<div style="background:var(--navy);color:#fff;padding:11px 18px;font-size:19px;font-weight:800">'
        + e(A(lang,v.recommendation||''))+' · '+e(v.allocation_band||'')+'</div>'
      + '<div style="padding:15px 18px;font-size:18px;line-height:1.55;color:var(--ink2)">'
        + e(pick(p,lang,'decision.allocation_note', d.allocation_note))+'</div></div>'
    + '<table class="vtab" style="margin-top:14px"><tbody>'+levelsOf(p,lang,d).slice(0,3).map(function(x){
        return '<tr><td style="width:34%">'+e(tr(p,lang,x.action))+'</td><td style="width:18%"><b class="en">'+e(x.price)
          + '</b></td><td style="color:var(--ink2)">'+e(tr(p,lang,x.rationale))+'</td></tr>'; }).join('')+'</tbody></table>'
    + vfoot(2) + '</div>';

  return '<!DOCTYPE html><html lang="'+(lang==='gu'?'gu':'en')+'"><head><meta charset="utf-8">'
    + '<title>'+e(m.company||'')+' — Investment Summary</title><style>'+CSS+VCSS+'</style></head>'
    + '<body class="'+(lang==='gu'?'gu':'')+'" style="background:#E9E7E1">'+p1+p2
    + '<script>(function(){' +
      '/* Fit each page to A4. Gujarati runs longer than English, so this is what' +
      ' keeps the two-page limit rather than hoping the translation happens to fit.' +
      ' The CONTENT is scaled, never the sheet: zooming the page box itself made' +
      ' the exported PNG narrower than A4, so pages came out at different widths' +
      ' and messaging apps stretched them. */' +
      'var MIN=0.66;' +
      'var ps=document.querySelectorAll(".vpage");' +
      'for(var i=0;i<ps.length;i++){ var el=ps[i];' +
        'var w=document.createElement("div");' +
        'w.className="vfit";' +
        'w.style.cssText="display:flex;flex-direction:column;flex:1 1 auto;min-height:0;width:100%";' +
        'while(el.firstChild) w.appendChild(el.firstChild);' +
        'el.appendChild(w);' +
        'var target=el.clientHeight - (parseFloat(getComputedStyle(el).paddingTop)||0)' +
          ' - (parseFloat(getComputedStyle(el).paddingBottom)||0);' +
        'var nat=w.scrollHeight;' +
        'if(nat>target){' +
          'var z=Math.max(MIN, Math.floor((target/nat)*1000)/1000);' +
          '/* transform, not zoom: html2canvas renders a CSS-zoomed box with the' +
          ' wrong advance widths, which makes Gujarati words overlap. */' +
          'var outer=document.createElement("div");' +
          'outer.style.cssText="height:"+target+"px;overflow:hidden;flex:0 0 auto;width:100%";' +
          'el.replaceChild(outer, w); outer.appendChild(w);' +
          'w.style.width=(100/z)+"%";' +
          'w.style.transformOrigin="top left";' +
          'w.style.transform="scale("+z+")";' +
        '}' +
      '}' +
    '})();<\/script>'

    + '</body></html>';
}

/* ========================= SCORE CARD ========================= */
function scBlock(p, b, lang){
  var sl = p.score_lines||{}, sb = p.score_basis||{};
  var gsb = (lang==='gu' && p.gu && p.gu.score_basis) ? p.gu.score_basis : {};
  var got = blockScore(p,b), items = bItems(b,lang);
  return sec('', bName(b,lang)+' — '+got.toFixed(1)+' / '+b[2])
    + tbl([L(lang,'line_item'),L(lang,'score'),L(lang,'max'),L(lang,'basis')], b[3].map(function(k,i){
        var val = Number(sl[k])||0;
        return { cells:[e(items[i]), '<b class="en">'+val.toFixed(1)+'</b>',
                        '<span class="en">'+b[6][i]+'</span>',
                        '<span class="mut">'+e(gsb[k] ? safeTr(S(sb[k]), S(gsb[k])) : (tr(p,lang,sb[k]) || ''))+'</span>'] }; }), { num:[1,2] });
}

/* The card is deliberately paginated. Every one of the 31 line items that make
   up the 100 marks has to appear, so the blocks are split across two A4 pages
   and each page is then auto-fitted — clipping is what used to lose half the
   marks. */
function buildScorecard(p, lang){
  p = safePayload(p);
  lang = lang || 'en';
  var v = p.verdict||{}, m = p.meta||{};
  var total = 0, mkt = 0;
  BLOCKS.forEach(function(b,i){ var g = blockScore(p,b); total += g; if(i===6) mkt = g; });

  var head = '<div class="sc-top"><div style="height:4mm"></div>'
    + '<div class="eyebrow">'+e(L(lang,'score_card'))+' &nbsp;·&nbsp; '+e(A(lang,m.ipo_type||'Mainboard'))+' &nbsp;·&nbsp; '+e(L(lang,'india'))+'</div>'
    + '<h1 class="en" style="margin-top:1.5mm;font-size:18pt">'+e(m.company||'')+'</h1>'
    + '<div class="mut en" style="margin-top:1mm">'+e(m.analysis_datetime||'')+'</div>'
    + '<div style="height:2.5mm;background:var(--teal);width:26mm;border-radius:1mm;margin:2.5mm 0 3.5mm"></div>'
    + '<div class="tiles">'
      + '<div class="tile"><div class="k">'+e(L(lang,'ipo_quality'))+'</div><div class="v">'+n(total,1)
        + '<small>/100</small></div><div class="s">'+e(A(lang,bandOf(total)))+'</div></div>'
      + '<div class="tile"><div class="k">'+e(L(lang,'fundamentals'))+'</div><div class="v">'+n(total-mkt,1)
        + '<small>/95</small></div></div>'
      + '<div class="tile"><div class="k">'+e(L(lang,'market_signals'))+'</div><div class="v">'+n(mkt,1)
        + '<small>/5</small></div></div>'
      + '<div class="tile"><div class="k">'+e(L(lang,'recommendation'))+'</div><div class="v" style="font-size:11pt">'
        + e(A(lang,v.recommendation)||'—')+'</div><div class="s">'+e(v.allocation_band||'')+'</div></div></div></div>';

  var body = BLOCKS.map(function(b){ return '<div class="sc-blk">'+scBlock(p,b,lang)+'</div>'; }).join('')
    + '<div class="sc-blk">' + sec('', L(lang,'total_score'))
    + tbl([L(lang,'section'),L(lang,'score'),L(lang,'max'),L(lang,'band')],
        BLOCKS.map(function(b){
          var g = blockScore(p,b), pc = b[2] ? (g/b[2])*100 : 0;
          return { cells:[ bName(b,lang), '<b class="en">'+g.toFixed(1)+'</b>',
                           '<span class="en">'+b[2]+'</span>',
                           barRow('', pc, Math.round(pc)+'%',
                                  pc>=70?'var(--teal)':pc>=50?'var(--amber)':'var(--red)') ] }; })
        .concat([{ __cls:'tot', cells:[ '<b>'+L(lang,'ipo_quality')+'</b>',
                   '<b class="en">'+total.toFixed(1)+'</b>', '<span class="en">100</span>',
                   '<b>'+e(A(lang,bandOf(total)))+'</b>' ] }]), { num:[1,2] }) + '</div>';

  var tail = '<div class="grow"></div>'
    + '<div class="mut sc-disc" style="border-top:.6pt solid var(--rule);padding-top:2.5mm">'
    + e(L(lang,'disclaimer'))+'</div>';

  /* Four shells are emitted; the script packs the blocks into as many as they
     actually need and removes the rest. Packing beats scaling: html2canvas
     renders a CSS-zoomed box with the wrong advance widths, which made Gujavati
     words on a scaled page overlap into each other. */
  var pages = page(p,1,4,'Score Card','<div class="sc-main">'+head+body+'</div>'+tail,lang)
            + page(p,2,4,'Score Card','<div class="sc-spill"></div>'+tail,lang)
            + page(p,3,4,'Score Card','<div class="sc-spill"></div>'+tail,lang)
            + page(p,4,4,'Score Card','<div class="sc-spill"></div>'+tail,lang);

  var CSS2 = '\n.sc-blk{break-inside:avoid}\n.sc-blk table{margin-bottom:0}\n'
           + '.sc-blk .sec{margin:6mm 0 2.5mm}\n.sc-blk .bar{margin:0}\n'
           + '.sc-blk td,.sc-blk th{padding-top:2.3mm;padding-bottom:2.3mm}\n'
           + '.sc-blk .ti{font-size:10.5pt}\n'
           + 'body.gu .sc-blk td,body.gu .sc-blk th{padding-top:1.9mm;padding-bottom:1.9mm}\n';

  var FIT = '<script>(function(){'
    + 'var ps=[].slice.call(document.querySelectorAll(".page"));'
    + 'var boxes=ps.map(function(el){ return el.querySelector(".sc-main")||el.querySelector(".sc-spill"); });'
    + 'function avail(el){ var bd=el.querySelector(".body"), d=bd.querySelector(".sc-disc");'
      + 'return bd.clientHeight - (d? d.offsetHeight+14 : 0); }'
    /* pack: push what does not fit onto the next page, page by page */
    + 'for(var i=0;i<ps.length-1;i++){'
      + 'var A=avail(ps[i]);'
      + 'var guard=0;'
      + 'while(boxes[i].scrollHeight>A && guard++<40){'
        + 'var kids=boxes[i].querySelectorAll(".sc-blk");'
        + 'if(kids.length<(i===0?2:1)) break;'
        + 'boxes[i+1].insertBefore(kids[kids.length-1], boxes[i+1].firstChild);'
      + '}'
    + '}'
    /* drop the shells nothing landed on */
    + 'for(var j=ps.length-1;j>=1;j--){'
      + 'if(!boxes[j].children.length) ps[j].parentNode.removeChild(ps[j]);'
    + '}'
    + 'var live=[].slice.call(document.querySelectorAll(".page"));'
    + 'for(var k=0;k<live.length-1;k++){ var dd=live[k].querySelector(".sc-disc");'
      + 'if(dd) dd.parentNode.removeChild(dd); }'
    + 'for(var n=0;n<live.length;n++){ var el=live[n];'
      + 'var t=el.querySelector(".pgtot"); if(t) t.textContent=live.length;'
      + 'var nm=el.querySelector(".pgnum"); if(nm) nm.textContent=(n+1);'
      + 'var bd=el.querySelector(".body");'
      + 'var box=bd.querySelector(".sc-main")||bd.querySelector(".sc-spill");'
      + 'var A2=avail(el);'
      /* last resort only: one block taller than a whole page. transform:scale is
         used rather than zoom because html2canvas reproduces it faithfully. */
      + 'if(box && box.scrollHeight>A2){'
        + 'var z=Math.max(0.60, Math.floor((A2/box.scrollHeight)*1000)/1000);'
        + 'var wrap=document.createElement("div");'
        + 'wrap.style.cssText="height:"+A2+"px;overflow:hidden";'
        + 'box.parentNode.insertBefore(wrap, box); wrap.appendChild(box);'
        + 'box.style.width=(100/z)+"%";'
        + 'box.style.transformOrigin="top left";'
        + 'box.style.transform="scale("+z+")";'
      + '}'
    + '}'
    + '})();<\/script>';

  return shell(S(m.company)+' — Score Card', lang==='gu'?'gu':'', pages, CSS2)
         .replace('</body>', FIT+'</body>');
}

global.IPODocs = { buildReport:buildReport, buildExec:buildExec, buildVisual:buildVisual,
                   buildScorecard:buildScorecard, BLOCKS:BLOCKS, S:S };
})(window);
