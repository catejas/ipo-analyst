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
  'Listing':'લિસ્ટિંગ', 'Anchor':'એન્કર', 'Unofficial':'બિનસત્તાવાર',
  /* balance sheet and earnings-quality ratings */
  'Healthy':'સ્વસ્થ', 'Stretched':'ખેંચાયેલું', 'Red flag':'ચેતવણી સંકેત',
  'High':'ઊંચું', 'Low':'નીચું',
  /* issue structure verdicts */
  'Growth capital':'વૃદ્ધિ મૂડી', 'Balance-sheet repair':'સરવૈયા સુધારણા',
  'Partial exit':'આંશિક એક્ઝિટ', 'Primarily shareholder exit':'મુખ્યત્વે શેરહોલ્ડર એક્ઝિટ',
  /* litigation status and forum party */
  'Under appeal':'અપીલ હેઠળ', 'Resolved in favour':'તરફેણમાં ઉકેલાયું',
  'Resolved against':'વિરુદ્ધ ઉકેલાયું', 'Settled':'સમાધાન થયું',
  'Unquantified':'રકમ નક્કી નથી', 'Company':'કંપની', 'Subsidiary':'પેટાકંપની',
  'Promoter':'પ્રમોટર', 'Director':'નિયામક', 'Group company':'જૂથ કંપની',
  /* group structure basis */
  'Step-down subsidiary':'પેટા-પેટાકંપની', 'Joint venture':'સંયુક્ત સાહસ',
  'Associate':'સહયોગી',
  /* credit */
  'Upgrade':'અપગ્રેડ', 'Downgrade':'ડાઉનગ્રેડ', 'Watch':'નિરીક્ષણ હેઠળ',
  'Assigned':'સોંપાયું', 'Upgraded':'અપગ્રેડ થયું', 'Downgraded':'ડાઉનગ્રેડ થયું',
  'Reaffirmed':'પુનઃપુષ્ટિ', 'Cash credit':'કેશ ક્રેડિટ', 'Term loan':'ટર્મ લોન',
  'Bank guarantee':'બેંક ગેરંટી', 'Letter of credit':'લેટર ઓફ ક્રેડિટ',
  'Unallocated':'ફાળવેલ નથી',
  /* cash flow verdicts */
  'Self-funding':'સ્વ-ભંડોળ', 'Partially self-funding':'આંશિક સ્વ-ભંડોળ',
  'Dependent on external capital':'બાહ્ય મૂડી પર નિર્ભર',
  'Serious':'ગંભીર',
  /* reconciliation results */
  'Ties':'મેળ ખાય છે', 'Does not tie':'મેળ ખાતું નથી', 'Could not test':'ચકાસી શકાયું નથી',
  /* margin profile */
  'Above average':'સરેરાશથી ઉપર', 'Average':'સરેરાશ', 'Below average':'સરેરાશથી નીચે',
  /* reported tag */
  'Reported':'નોંધાયેલ', 'Partly':'આંશિક રીતે',
  /* listing-gain component factors — short labels the app can own */
  'Market mood':'બજારનો મિજાજ', 'Sector mood':'ક્ષેત્રનો મિજાજ', 'Scarcity':'દુર્લભતા',
  'Valuation support':'મૂલ્યાંકન ટેકો', 'Anchors':'એન્કર', 'Anchor':'એન્કર',
  'Subscription':'સબસ્ક્રિપ્શન', 'Subscription / Demand':'સબસ્ક્રિપ્શન / માંગ',
  'Grey market premium':'ગ્રે માર્કેટ પ્રીમિયમ', 'Retail':'રિટેલ',
  /* due-diligence status, including the new completed-check value */
  'Verified — no reportable findings':'ચકાસાયેલ — નોંધપાત્ર કંઈ મળ્યું નથી',
  'Verified - no reportable findings':'ચકાસાયેલ — નોંધપાત્ર કંઈ મળ્યું નથી',
  'No reportable findings':'નોંધપાત્ર કંઈ મળ્યું નથી'
};

/* ---------------------------------------------------------------------------
   TERM_GU — business, financial and product English that the payload keeps
   writing in Latin no matter how firmly the contract asks for Gujarati.

   VOCAB_GU above covers the app's own enum words. This covers the running
   vocabulary of the reports: what a company makes, what a segment is called,
   what a line of a balance sheet is. It is consulted phrase-first, so
   "industrial instrumentation" is translated as a unit rather than as two
   unrelated words.
   -------------------------------------------------------------------------- */
var TERM_GU = {
  'ind as':'Ind AS',
  'institutional':'સંસ્થાકીય',
  'institutional research report':'સંસ્થાકીય સંશોધન રિપોર્ટ',
  'research':'સંશોધન',
  'research report':'સંશોધન રિપોર્ટ',
  /* corporate suffixes and forms */
  'limited':'લિમિટેડ', 'ltd':'લિમિટેડ', 'private limited':'પ્રાઇવેટ લિમિટેડ',
  'private':'પ્રાઇવેટ', 'public limited':'પબ્લિક લિમિટેડ', 'incorporated':'ઇન્કોર્પોરેટેડ',
  'corporation':'કોર્પોરેશન', 'industries':'ઇન્ડસ્ટ્રીઝ', 'enterprises':'એન્ટરપ્રાઇઝિસ',
  'holdings':'હોલ્ડિંગ્સ', 'ventures':'વેન્ચર્સ', 'solutions':'સોલ્યુશન્સ',
  'technologies':'ટેક્નોલોજીસ', 'systems':'સિસ્ટમ્સ', 'services':'સેવાઓ',
  'group':'જૂથ', 'india':'ઇન્ડિયા', 'the':'',
  /* instrumentation, engineering and manufacturing */
  'industrial instrumentation':'ઔદ્યોગિક ઉપકરણ',
  'instrumentation':'ઉપકરણ પ્રણાલી', 'instruments':'ઉપકરણો', 'instrument':'ઉપકરણ',
  'temperature sensors':'તાપમાન સેન્સર', 'temperature sensor':'તાપમાન સેન્સર',
  'thermocouples':'થર્મોકપલ', 'thermocouple':'થર્મોકપલ',
  'resistance temperature detectors':'રેઝિસ્ટન્સ તાપમાન ડિટેક્ટર',
  'heating elements':'હીટિંગ તત્ત્વો', 'heating element':'હીટિંગ તત્ત્વ',
  'cables':'કેબલ', 'cable':'કેબલ', 'wires':'વાયર', 'wire':'વાયર',
  'calibration':'કેલિબ્રેશન', 'sensors':'સેન્સર', 'sensor':'સેન્સર',
  'transmitters':'ટ્રાન્સમીટર', 'transmitter':'ટ્રાન્સમીટર',
  'valves':'વાલ્વ', 'valve':'વાલ્વ', 'pumps':'પંપ', 'pump':'પંપ',
  'castings':'કાસ્ટિંગ', 'forgings':'ફોર્જિંગ', 'machining':'મશીનિંગ',
  'engineering':'એન્જિનિયરિંગ', 'manufacturing':'ઉત્પાદન', 'fabrication':'ફેબ્રિકેશન',
  'automation':'ઓટોમેશન', 'components':'ઘટકો', 'component':'ઘટક',
  'equipment':'સાધનો', 'machinery':'યંત્રસામગ્રી', 'spare parts':'છૂટા ભાગો',
  'raw material':'કાચો માલ', 'raw materials':'કાચો માલ',
  'finished goods':'તૈયાર માલ', 'work in progress':'ચાલુ કામ',
  /* sectors */
  'pharmaceuticals':'ફાર્માસ્યુટિકલ્સ', 'chemicals':'રસાયણો', 'speciality chemicals':'વિશેષ રસાયણો',
  'textiles':'કાપડ', 'apparel':'વસ્ત્રો', 'jewellery':'ઝવેરાત', 'jewelry':'ઝવેરાત',
  'retail':'રિટેલ', 'logistics':'લોજિસ્ટિક્સ', 'infrastructure':'માળખાગત સુવિધા',
  'construction':'બાંધકામ', 'real estate':'રિયલ એસ્ટેટ', 'hospitality':'આતિથ્ય',
  'healthcare':'આરોગ્ય સંભાળ', 'education':'શિક્ષણ', 'agriculture':'કૃષિ',
  'automotive':'ઓટોમોટિવ', 'renewable energy':'નવીનીકરણીય ઊર્જા', 'power':'વીજળી',
  'oil and gas':'તેલ અને ગેસ', 'metals':'ધાતુઓ', 'steel':'સ્ટીલ', 'cement':'સિમેન્ટ',
  'banking':'બેંકિંગ', 'insurance':'વીમો', 'defence':'સંરક્ષણ', 'defense':'સંરક્ષણ',
  'aerospace':'એરોસ્પેસ', 'electronics':'ઇલેક્ટ્રોનિક્સ', 'semiconductor':'સેમિકન્ડક્ટર',
  'food processing':'ખાદ્ય પ્રક્રિયા', 'packaging':'પેકેજિંગ', 'plastics':'પ્લાસ્ટિક',
  'paper':'કાગળ', 'shipping':'શિપિંગ', 'aviation':'ઉડ્ડયન', 'telecom':'ટેલિકોમ',
  /* financial statement lines */
  'face value':'દર્શની કિંમત', 'book value':'બુક વેલ્યુ', 'market capitalisation':'બજાર મૂડી',
  'market capitalization':'બજાર મૂડી', 'market cap':'બજાર મૂડી',
  'revenue':'આવક', 'revenue from operations':'કામકાજમાંથી આવક', 'total income':'કુલ આવક',
  'other income':'અન્ય આવક', 'expenses':'ખર્ચ', 'total expenses':'કુલ ખર્ચ',
  'employee cost':'કર્મચારી ખર્ચ', 'finance cost':'નાણાકીય ખર્ચ',
  'depreciation':'ઘસારો', 'amortisation':'પરિશોધન', 'amortization':'પરિશોધન',
  'profit before tax':'કરવેરા પહેલાંનો નફો', 'profit after tax':'કરવેરા પછીનો નફો',
  'net profit':'ચોખ્ખો નફો', 'gross profit':'કુલ નફો', 'operating profit':'કામકાજનો નફો',
  'margin':'માર્જિન', 'margins':'માર્જિન', 'operating margin':'કામકાજનું માર્જિન',
  'net margin':'ચોખ્ખું માર્જિન', 'gross margin':'કુલ માર્જિન',
  'net worth':'ચોખ્ખી સંપત્તિ', 'reserves':'અનામત', 'share capital':'શેર મૂડી',
  'equity':'ઇક્વિટી', 'debt':'દેવું', 'borrowings':'ઉધાર', 'total debt':'કુલ દેવું',
  'net debt':'ચોખ્ખું દેવું', 'cash':'રોકડ', 'cash and equivalents':'રોકડ અને સમકક્ષ',
  'inventory':'સ્ટોક', 'inventories':'સ્ટોક',
  'trade receivables':'વેપારી લેણાં', 'receivables':'લેણાં',
  'trade payables':'વેપારી દેવાં', 'payables':'દેવાં',
  'working capital':'કાર્યકારી મૂડી', 'current assets':'ચાલુ મિલકતો',
  'current liabilities':'ચાલુ જવાબદારીઓ', 'fixed assets':'સ્થાયી મિલકતો',
  'total assets':'કુલ મિલકતો', 'contingent liabilities':'આકસ્મિક જવાબદારીઓ',
  'capital expenditure':'મૂડી ખર્ચ', 'capex':'મૂડી ખર્ચ',
  'free cash flow':'મુક્ત રોકડ પ્રવાહ', 'cash flow':'રોકડ પ્રવાહ',
  'operating cash flow':'કામકાજનો રોકડ પ્રવાહ',
  'investing':'રોકાણ', 'financing':'ધિરાણ', 'dividend':'ડિવિડન્ડ',
  'earnings per share':'શેર દીઠ કમાણી', 'return on equity':'ઇક્વિટી પર વળતર',
  'return on capital employed':'રોકાયેલી મૂડી પર વળતર',
  'interest coverage':'વ્યાજ આવરણ', 'debt to equity':'દેવું-ઇક્વિટી',
  'asset turnover':'મિલકત ટર્નઓવર', 'turnover':'ટર્નઓવર',
  'order book':'ઓર્ડર બુક', 'capacity utilisation':'ક્ષમતા વપરાશ',
  'capacity utilization':'ક્ષમતા વપરાશ', 'installed capacity':'સ્થાપિત ક્ષમતા',
  /* issue and market words */
  'price band':'ભાવ પટ્ટો', 'issue size':'ઇશ્યૂ કદ', 'lot size':'લોટ કદ',
  'fresh issue':'નવો ઇશ્યૂ', 'offer for sale':'વેચાણ માટેની ઓફર',
  'offer':'ઓફર', 'issue':'ઇશ્યૂ', 'listing gain':'લિસ્ટિંગ ગેઇન',
  'subscription':'સબસ્ક્રિપ્શન', 'allotment':'ફાળવણી', 'refund':'રિફંડ',
  'lock-in':'લોક-ઇન', 'lock in':'લોક-ઇન', 'anchor investors':'એન્કર રોકાણકારો',
  'anchor investor':'એન્કર રોકાણકાર', 'book running lead manager':'બુક રનિંગ લીડ મેનેજર',
  'registrar':'રજિસ્ટ્રાર', 'underwriter':'અન્ડરરાઇટર',
  'shareholding':'શેરહોલ્ડિંગ', 'shareholders':'શેરધારકો', 'shareholder':'શેરધારક',
  'promoters':'પ્રમોટરો', 'promoter group':'પ્રમોટર જૂથ',
  'dilution':'મંદન', 'valuation':'મૂલ્યાંકન', 'peers':'સમકક્ષો', 'peer':'સમકક્ષ',
  'grey market premium':'ગ્રે માર્કેટ પ્રીમિયમ', 'grey market':'ગ્રે માર્કેટ',
  /* governance and legal */
  'board of directors':'નિયામક મંડળ', 'board':'બોર્ડ',
  'independent director':'સ્વતંત્ર નિયામક', 'independent directors':'સ્વતંત્ર નિયામકો',
  'managing director':'વ્યવસ્થાપકીય નિયામક', 'chairman':'અધ્યક્ષ',
  'chief executive officer':'મુખ્ય કારોબારી અધિકારી',
  'chief financial officer':'મુખ્ય નાણાકીય અધિકારી',
  'whole-time director':'પૂર્ણ-સમય નિયામક', 'auditor':'હિસાબ-તપાસનીસ', 'auditors':'હિસાબ-તપાસનીસો',
  'audit committee':'હિસાબ-તપાસ સમિતિ', 'related party':'સંબંધિત પક્ષ',
  'related party transactions':'સંબંધિત પક્ષ વ્યવહારો',
  'litigation':'મુકદ્દમા', 'penalty':'દંડ', 'demand':'માંગણું', 'notice':'નોટિસ',
  'income tax':'આવકવેરો', 'appeal':'અપીલ', 'tribunal':'ટ્રિબ્યુનલ',
  'high court':'હાઈકોર્ટ', 'supreme court':'સુપ્રીમ કોર્ટ', 'court':'અદાલત',
  'compliance':'પાલન', 'regulatory':'નિયમનકારી', 'approval':'મંજૂરી',
  'licence':'લાઇસન્સ', 'license':'લાઇસન્સ',
  /* generic business prose */
  'customers':'ગ્રાહકો', 'customer':'ગ્રાહક', 'clients':'ગ્રાહકો',
  'suppliers':'સપ્લાયર્સ', 'supplier':'સપ્લાયર', 'vendors':'વિક્રેતાઓ',
  'employees':'કર્મચારીઓ', 'plants':'પ્લાન્ટ', 'plant':'પ્લાન્ટ',
  'facilities':'સુવિધાઓ', 'facility':'સુવિધા', 'factory':'કારખાનું',
  'exports':'નિકાસ', 'export':'નિકાસ', 'imports':'આયાત', 'domestic':'સ્થાનિક',
  'market share':'બજાર હિસ્સો', 'competition':'સ્પર્ધા', 'competitors':'સ્પર્ધકો',
  'growth':'વૃદ્ધિ', 'demand':'માંગ', 'supply':'પુરવઠો', 'pricing':'ભાવ નિર્ધારણ',
  'concentration':'કેન્દ્રીકરણ', 'diversification':'વૈવિધ્યકરણ',
  'segment':'વિભાગ', 'segments':'વિભાગો', 'product':'ઉત્પાદન', 'products':'ઉત્પાદનો',
  'brand':'બ્રાન્ડ', 'brands':'બ્રાન્ડ', 'patent':'પેટન્ટ', 'patents':'પેટન્ટ',
  'research and development':'સંશોધન અને વિકાસ', 'quality':'ગુણવત્તા',
  'certification':'પ્રમાણપત્ર', 'standard':'ધોરણ', 'and':'અને', 'of':'ના',
  'for':'માટે', 'in':'માં', 'with':'સાથે', 'to':'થી', 'per':'દીઠ',
  'others':'અન્ય', 'other':'અન્ય', 'total':'કુલ', 'net':'ચોખ્ખું', 'gross':'કુલ'
};

/* Common English that keeps turning up in payload prose. Without it the sweep
   has nothing to translate a sentence with, and a transliterated English
   sentence is unreadable in a way the English itself is not. */
var COMMON_GU = {
  'abroad':'વિદેશમાં',
  'achievable':'પ્રાપ્ય',
  'africa':'આફ્રિકા',
  'ambitious':'મહત્વાકાંક્ષી',
  'assumption':'ધારણા',
  'assumptions':'ધારણાઓ',
  'audited':'ઓડિટ કરેલ',
  'australia':'ઓસ્ટ્રેલિયા',
  'barrier':'અવરોધ',
  'barriers':'અવરોધો',
  'bn':'અબજ',
  'britain':'બ્રિટન',
  'buying':'ખરીદી',
  'coming':'આવી રહ્યું',
  'comparable':'તુલનાત્મક',
  'comparables':'તુલનાત્મક કંપનીઓ',
  'countries':'દેશો',
  'country':'દેશ',
  'cr':'કરોડ',
  'cr.':'કરોડ',
  'crore':'કરોડ',
  'crores':'કરોડ',
  'cross selling':'ક્રોસ-વેચાણ',
  'cross-selling':'ક્રોસ-વેચાણ',
  'crs':'કરોડ',
  'decade':'દાયકો',
  'defensible':'બચાવી શકાય તેવું',
  'derived':'વ્યુત્પન્ન',
  'driver':'ચાલક',
  'drivers':'ચાલકો',
  'entry':'પ્રવેશ',
  'european':'યુરોપિયન',
  'exit':'એક્ઝિટ',
  'far east':'દૂર પૂર્વ',
  'forecast':'આગાહી',
  'forecasts':'આગાહીઓ',
  'france':'ફ્રાન્સ',
  'german':'જર્મન',
  'global':'વૈશ્વિક',
  'gulf':'અખાતી દેશો',
  'horizon':'સમયગાળો',
  'illustrative':'દૃષ્ટાંતરૂપ',
  'implied':'સૂચિત',
  'ind':'ઇન્ડ',
  'indigenisation':'સ્વદેશીકરણ',
  'indigenization':'સ્વદેશીકરણ',
  'indigenous':'સ્વદેશી',
  'inr':'રૂ.',
  'international':'આંતરરાષ્ટ્રીય',
  'italy':'ઇટાલી',
  'lac':'લાખ',
  'lacs':'લાખ',
  'lakhs':'લાખ',
  'measurement':'માપન',
  'mexican':'મેક્સિકન',
  'mexico':'મેક્સિકો',
  'middle east':'મધ્ય પૂર્વ',
  'mn':'મિલિયન',
  'n.a.':'લાગુ નથી',
  'na':'લાગુ નથી',
  'nil':'શૂન્ય',
  'nm':'અર્થપૂર્ણ નથી',
  'north america':'ઉત્તર અમેરિકા',
  'overseas':'વિદેશી',
  'poland':'પોલેન્ડ',
  'polish':'પોલિશ',
  'proxy':'અવેજી',
  'recovers':'સુધરે છે',
  'recovery':'સુધારો',
  'region':'પ્રદેશ',
  'regions':'પ્રદેશો',
  'replacement':'બદલી',
  'required':'જરૂરી',
  'restated':'પુનઃગણતરી કરેલ',
  'rs':'રૂ.',
  'rs.':'રૂ.',
  'rupee':'રૂપિયો',
  'rupees':'રૂપિયા',
  'russia':'રશિયા',
  'scarcity':'દુર્લભતા',
  'shorten':'ટૂંકા થાય',
  'shortens':'ટૂંકા થાય છે',
  'south america':'દક્ષિણ અમેરિકા',
  'south east asia':'દક્ષિણ-પૂર્વ એશિયા',
  'south-east asia':'દક્ષિણ-પૂર્વ એશિયા',
  'spain':'સ્પેન',
  'starting':'પ્રારંભિક',
  'uk':'બ્રિટન',
  'unaudited':'ઓડિટ વગરનું',
  'worldwide':'વિશ્વભરમાં',
  'access':'પ્રવેશ',
  'accounts':'હિસ્સો ધરાવે છે',
  'accrual':'ઉપાર્જન',
  'acquired':'હસ્તગત',
  'acquisition':'હસ્તાંતરણ',
  'acquisitions':'હસ્તાંતરણો',
  'ahead':'આગળ',
  'already':'પહેલેથી',
  'aluminium':'એલ્યુમિનિયમ',
  'amalgamation':'એકીકરણ',
  'amounts':'રકમો',
  'appellate':'અપીલ',
  'asia':'એશિયા',
  'assembly':'એસેમ્બલી',
  'back':'પાછું',
  'backward':'પાછળનું',
  'backwards':'પાછળ',
  'bank':'બેંક',
  'becomes':'બને છે',
  'benchmarking':'માપદંડ સરખામણી',
  'beyond':'ઉપરાંત',
  'bidding':'બિડિંગ',
  'broader':'વ્યાપક',
  'broadly':'વ્યાપક રીતે',
  'calibrators':'કેલિબ્રેટર',
  'camera':'કેમેરો',
  'cameras':'કેમેરા',
  'capital-employed':'રોકાયેલી મૂડી',
  'cartridge':'કાર્ટ્રિજ',
  'ceiling':'મર્યાદા',
  'certified':'પ્રમાણિત',
  'clearly':'સ્પષ્ટપણે',
  'closes':'બંધ થાય છે',
  'comparable':'સરખાવવા યોગ્ય',
  'composition':'રચના',
  'compressing':'સંકોચાતું',
  'confirming':'પુષ્ટિ કરતું',
  'conflict':'વિરોધાભાસ',
  'consecutive':'સળંગ',
  'consolidated':'એકીકૃત',
  'contractor':'કોન્ટ્રાક્ટર',
  'contractors':'કોન્ટ્રાક્ટરો',
  'control':'નિયંત્રણ',
  'conversion':'રૂપાંતરણ',
  'copper':'તાંબુ',
  'count':'સંખ્યા',
  'course':'ક્રમ',
  'coverage':'આવરણ',
  'cuts':'કાપ',
  'cycles':'ચક્રો',
  'data':'માહિતી',
  'de-rating':'ડી-રેટિંગ',
  'dealings':'વ્યવહારો',
  'debt-funded':'દેવા-આધારિત',
  'decelerated':'ધીમું પડ્યું',
  'definition':'વ્યાખ્યા',
  'delivered':'આપ્યું',
  'designations':'હોદ્દા',
  'deteriorated':'બગડ્યું',
  'direct':'સીધું',
  'directly':'સીધું',
  'disappointment':'નિરાશા',
  'distribution':'વિતરણ',
  'distributor':'વિતરક',
  'distributors':'વિતરકો',
  'does':'કરે છે',
  'dropped':'ઘટ્યું',
  'duty':'ડ્યુટી',
  'earnings':'કમાણી',
  'easing':'હળવું થવું',
  'east':'પૂર્વ',
  'employee':'કર્મચારી',
  'entities':'સંસ્થાઓ',
  'entity':'સંસ્થા',
  'entry':'પ્રવેશ',
  'equity-accounted':'ઇક્વિટી-આધારિત',
  'euro':'યુરો',
  'even':'પણ',
  'everything':'બધું',
  'exact':'ચોક્કસ',
  'exist':'અસ્તિત્વ ધરાવે છે',
  'expires':'સમાપ્ત થાય છે',
  'explained':'સમજાવેલ',
  'expressed':'વ્યક્ત',
  'facilities':'સુવિધાઓ',
  'factor':'પરિબળ',
  'factors':'પરિબળો',
  'falling':'ઘટતું',
  'family':'પરિવાર',
  'flagged':'ચિહ્નિત',
  'flow':'પ્રવાહ',
  'fragmented':'વિખરાયેલ',
  'franchise':'ફ્રેન્ચાઇઝી',
  'fully':'સંપૂર્ણપણે',
  'furnace':'ભઠ્ઠી',
  'furnaces':'ભઠ્ઠીઓ',
  'gauge':'ગેજ',
  'gauges':'ગેજ',
  'general':'સામાન્ય',
  'generation':'નિર્માણ',
  'genuinely':'ખરેખર',
  'grown':'વધ્યું',
  'guarantee':'ગેરંટી',
  'guarantees':'ગેરંટી',
  'headroom':'અવકાશ',
  'heat-trace':'હીટ-ટ્રેસ',
  'heater':'હીટર',
  'heaters':'હીટર',
  'here':'અહીં',
  'historic':'ઐતિહાસિક',
  'identification':'ઓળખ',
  'imager':'ઇમેજર',
  'imagers':'ઇમેજર',
  'imaging':'ઇમેજિંગ',
  'immersion':'ઇમર્શન',
  'implied':'સૂચિત',
  'import':'આયાત',
  'inception':'શરૂઆત',
  'income-tax':'આવકવેરો',
  'indian':'ભારતીય',
  'industrial-goods':'ઔદ્યોગિક માલ',
  'inferred':'અનુમાનિત',
  'infrared':'ઇન્ફ્રારેડ',
  'integration':'એકીકરણ',
  'intensity':'તીવ્રતા',
  'interest':'વ્યાજ',
  'involving':'સંડોવતા',
  'jump':'ઉછાળો',
  'jumps':'ઉછળે છે',
  'just':'માત્ર',
  'korean':'કોરિયન',
  'laboratory':'પ્રયોગશાળા',
  'leverage':'લિવરેજ',
  'list':'યાદી',
  'live':'ચાલુ',
  'maintenance':'જાળવણી',
  'manufacturer':'ઉત્પાદક',
  'marathon':'મેરેથોન',
  'marketing':'માર્કેટિંગ',
  'matching':'મેળ ખાતું',
  'matters':'બાબતો',
  'meaningful':'અર્થપૂર્ણ',
  'measurement':'માપન',
  'merger':'વિલય',
  'met':'પૂરું થયું',
  'mid-cap':'મિડ-કેપ',
  'middle':'મધ્ય',
  'mineral-insulated':'ખનિજ-ઇન્સ્યુલેટેડ',
  'minority':'લઘુમતી',
  'multi-billion':'બહુ-અબજ',
  'multiple':'ગુણાંક',
  'multiples':'ગુણાંકો',
  'named':'નામિત',
  'names':'નામો',
  'narrower':'સાંકડું',
  'needs':'જરૂર છે',
  'net-worth':'ચોખ્ખી સંપત્તિ',
  'nickel':'નિકલ',
  'nil':'શૂન્ય',
  'non-contact':'બિન-સંપર્ક',
  'norms':'ધોરણો',
  'object':'ઉદ્દેશ',
  'objects':'ઉદ્દેશો',
  'once':'એકવાર',
  'opens':'ખૂલે છે',
  'ordinary':'સામાન્ય',
  'organic':'સજીવ',
  'organised':'સંગઠિત',
  'out':'બહાર',
  'outlier':'અપવાદ',
  'parent':'મૂળ કંપની',
  'pass-through':'પસાર',
  'passed':'પસાર થયું',
  'paying':'ચૂકવતું',
  'plant-wise':'પ્લાન્ટવાર',
  'platinum':'પ્લેટિનમ',
  'player':'ખેલાડી',
  'players':'ખેલાડીઓ',
  'policy':'નીતિ',
  'pop':'ઉછાળો',
  'post-issue':'ઇશ્યૂ પછી',
  'post-listing':'લિસ્ટિંગ પછી',
  'pressure':'દબાણ',
  'process':'પ્રક્રિયા',
  'process-monitoring':'પ્રક્રિયા દેખરેખ',
  'project':'પ્રોજેક્ટ',
  'prospectus':'પ્રોસ્પેક્ટસ',
  'push':'દબાણ',
  'pyrometer':'પાયરોમીટર',
  'pyrometers':'પાયરોમીટર',
  'rather':'બદલે',
  're-accelerating':'ફરી વેગ પકડતું',
  're-rate':'પુનઃમૂલ્યાંકન',
  'recorded':'નોંધાયેલ',
  'related-party':'સંબંધિત પક્ષ',
  'reproduced':'પુનઃપ્રસ્તુત',
  'rerate':'પુનઃમૂલ્યાંકન',
  'restated':'પુનઃગણતરી કરેલ',
  'retained':'જાળવેલ',
  'retention':'જાળવણી',
  'revival':'પુનરુત્થાન',
  'rewarding':'લાભદાયી',
  'rhodium':'રોડિયમ',
  'role':'ભૂમિકા',
  'roles':'ભૂમિકાઓ',
  'run':'ચલાવવું',
  'runs':'ચલાવે છે',
  'rupee':'રૂપિયો',
  'safety':'સલામતી',
  'sanctioned':'મંજૂર',
  'scheme':'યોજના',
  'selling':'વેચાણ',
  'sentiment':'ભાવના',
  'sharp':'તીવ્ર',
  'sharply':'તીવ્રપણે',
  'showing':'દર્શાવતું',
  'skids':'સ્કિડ',
  'slowdown':'મંદી',
  'spend':'ખર્ચ',
  'spike':'ઉછાળો',
  'stainless':'સ્ટેનલેસ',
  'standalone':'સ્વતંત્ર',
  'steady':'સ્થિર',
  'strain':'તાણ',
  'stretch':'ખેંચાણ',
  'stripping':'બાદ કરીને',
  'subsequent':'ત્યારપછીનું',
  'sum':'સરવાળો',
  'supports':'ટેકો આપે છે',
  'sustained':'ટકાઉ',
  'there':'ત્યાં',
  'thermal':'થર્મલ',
  'thermowell':'થર્મોવેલ',
  'thermowells':'થર્મોવેલ',
  'though':'જોકે',
  'thousand-plus':'હજારથી વધુ',
  'toward':'તરફ',
  'tracker':'ટ્રેકર',
  'trade-policy':'વેપાર નીતિ',
  'transaction':'વ્યવહાર',
  'transactions':'વ્યવહારો',
  'triggers':'પ્રેરે છે',
  'tubular':'ટ્યુબ્યુલર',
  'turns':'વળે છે',
  'underlying':'મૂળભૂત',
  'undrawn':'બિનવપરાયેલ',
  'unexplained':'અસ્પષ્ટ',
  'unorganised':'અસંગઠિત',
  'unresolved':'વણઉકેલાયેલ',
  'utilisation':'વપરાશ',
  'utilization':'વપરાશ',
  'verification':'ચકાસણી',
  'weaken':'નબળું પડવું',
  'went':'ગયું',
  'whose':'જેની',
  'working-capital':'કાર્યકારી મૂડી',
  'above':'ઉપર',
  'across':'સર્વત્ર',
  'around':'આસપાસ',
  'band':'પટ્ટો',
  'based':'આધારિત',
  'between':'વચ્ચે',
  'billion':'બિલિયન',
  'bonus':'બોનસ',
  'bought':'ખરીદાયું',
  'broad':'વ્યાપક',
  'build':'બાંધવું',
  'built':'બાંધેલ',
  'bulk':'મોટા ભાગ',
  'buys':'ખરીદે છે',
  'cap':'મૂડી',
  'categories':'શ્રેણીઓ',
  'category':'શ્રેણી',
  'cent':'ટકા',
  'close':'નજીક',
  'closer':'નજીક',
  'clustered':'કેન્દ્રિત',
  'component':'ઘટક',
  'contact':'સંપર્ક',
  'crore':'કરોડ',
  'cut':'ઘટાડાયું',
  'deep':'ઊંડું',
  'depend':'આધાર રાખવો',
  'depends':'આધાર રાખે છે',
  'document':'દસ્તાવેજ',
  'domestic':'સ્થાનિક',
  'draft':'ડ્રાફ્ટ',
  'driven':'સંચાલિત',
  'drives':'ચલાવે છે',
  'eight':'આઠ',
  'eighty':'એંસી',
  'electrical':'વિદ્યુત',
  'excluding':'બાદ કરતાં',
  'existing':'હાલના',
  'fall':'ઘટવું',
  'fast':'ઝડપી',
  'fell':'ઘટ્યું',
  'figure':'આંકડો',
  'figures':'આંકડા',
  'final':'અંતિમ',
  'five':'પાંચ',
  'four':'ચાર',
  'fresh':'નવો',
  'further':'વધુ',
  'give':'આપવું',
  'gives':'આપે છે',
  'grew':'વધ્યું',
  'grow':'વધવું',
  'growing':'વધતું',
  'heating':'હીટિંગ',
  'heavy':'ભારે',
  'holder':'ધારક',
  'holders':'ધારકો',
  'holds':'ધરાવે છે',
  'hundred':'સો',
  'implies':'સૂચિત કરે છે',
  'improved':'સુધર્યું',
  'include':'સમાવવું',
  'includes':'સમાવે છે',
  'including':'સહિત',
  'indicates':'સૂચવે છે',
  'item':'બાબત',
  'items':'બાબતો',
  'keep':'રાખવું',
  'kept':'રાખેલ',
  'lakh':'લાખ',
  'larger':'મોટું',
  'left':'બાકી',
  'light':'હળવું',
  'line':'લીટી',
  'lines':'લીટીઓ',
  'lower':'નીચું',
  'lowered':'ઘટાડ્યું',
  'made':'બનાવેલ',
  'make':'બનાવવું',
  'maker':'ઉત્પાદક',
  'makers':'ઉત્પાદકો',
  'makes':'બનાવે છે',
  'means':'અર્થ',
  'million':'મિલિયન',
  'moved':'ખસેડાયું',
  'multiple':'બહુવિધ',
  'multiple of':'ગુણાંક',
  'narrow':'સાંકડું',
  'nine':'નવ',
  'ninety':'નેવું',
  'non-contact':'બિન-સંપર્ક',
  'now':'હવે',
  'number':'સંખ્યા',
  'numbers':'સંખ્યાઓ',
  'over':'ઉપર',
  'page':'પાનું',
  'peer':'સમકક્ષ',
  'per cent':'ટકા',
  'percent':'ટકા',
  'percentage':'ટકાવારી',
  'planned':'આયોજિત',
  'point':'મુદ્દો',
  'points':'મુદ્દા',
  'put':'મૂકેલ',
  'raise':'ઊભું કરવું',
  'raised':'વધારાયું',
  'reduce':'ઘટાડવું',
  'reduces':'ઘટાડે છે',
  'reflects':'પ્રતિબિંબિત કરે છે',
  'remain':'રહેવું',
  'remains':'રહે છે',
  'report':'અહેવાલ',
  'reports':'અહેવાલો',
  'rise':'વધવું',
  'rose':'વધ્યું',
  'sale':'વેચાણ',
  'sanity':'ચકાસણી',
  'section':'વિભાગ',
  'sells':'વેચે છે',
  'sensing':'સેન્સિંગ',
  'set':'નિર્ધારિત',
  'seven':'સાત',
  'several':'કેટલાક',
  'show':'દર્શાવવું',
  'shows':'દર્શાવે છે',
  'single':'એકલ',
  'six':'છ',
  'slow':'ધીમું',
  'slowed':'ધીમું પડ્યું',
  'sold':'વેચાયું',
  'solution':'ઉકેલ',
  'solutions':'ઉકેલો',
  'spanning':'ફેલાયેલ',
  'stays':'રહે છે',
  'suggests':'સૂચવે છે',
  'table':'કોષ્ટક',
  'take':'લેવું',
  'takes':'લે છે',
  'ten':'દસ',
  'than':'કરતાં',
  'thin':'પાતળું',
  'thousand':'હજાર',
  'unit':'એકમ',
  'units':'એકમો',
  'upper':'ઉપલો',
  'various':'વિવિધ',
  'vertical':'ઊભો વિભાગ',
  'verticals':'ઊભા વિભાગો',
  'way':'રીત',
  'ways':'રીતો',
  'weighted':'ભારિત',
  'while':'જ્યારે',
  'wide':'વ્યાપક',
  'worsened':'બગડ્યું',
  'worth':'સંપત્તિ',
  'about':'વિશે',
  'above':'ઉપર',
  'across':'સર્વત્ર',
  'adverse':'પ્રતિકૂળ',
  'after':'પછી',
  'against':'સામે',
  'all':'બધા',
  'also':'પણ',
  'amount':'રકમ',
  'any':'કોઈ',
  'are':'છે',
  'as':'તરીકે',
  'associated':'સંકળાયેલ',
  'at':'ખાતે',
  'available':'ઉપલબ્ધ',
  'average':'સરેરાશ',
  'background':'પૃષ્ઠભૂમિ',
  'basis':'આધાર',
  'be':'હોવું',
  'because':'કારણ કે',
  'been':'રહ્યું',
  'before':'પહેલાં',
  'being':'હોવાથી',
  'below':'નીચે',
  'between':'વચ્ચે',
  'both':'બંને',
  'business':'વ્યવસાય',
  'businesses':'વ્યવસાયો',
  'but':'પરંતુ',
  'buyers':'ખરીદદારો',
  'by':'દ્વારા',
  'can':'શકે',
  'capacity':'ક્ષમતા',
  'capital':'મૂડી',
  'case':'કિસ્સો',
  'cases':'કિસ્સા',
  'change':'ફેરફાર',
  'changes':'ફેરફારો',
  'check':'ચકાસણી',
  'checks':'ચકાસણી',
  'clean':'સ્વચ્છ',
  'clear':'સ્પષ્ટ',
  'closed':'બંધ',
  'companies':'કંપનીઓ',
  'company':'કંપની',
  'confirmed':'પુષ્ટિ થયેલ',
  'contingent':'આકસ્મિક',
  'core':'મુખ્ય',
  'cost':'ખર્ચ',
  'costs':'ખર્ચ',
  'could':'શકે',
  'current':'ચાલુ',
  'cycle':'ચક્ર',
  'date':'તારીખ',
  'decrease':'ઘટાડો',
  'defaulter':'ડિફોલ્ટર',
  'dependence':'નિર્ભરતા',
  'dependent':'નિર્ભર',
  'designation':'હોદ્દો',
  'did':'કર્યું',
  'disclosed':'જાહેર કરેલ',
  'disclosure':'જાહેરાત',
  'do':'કરે',
  'does':'કરે',
  'during':'દરમિયાન',
  'each':'દરેક',
  'each of':'દરેક',
  'early':'વહેલું',
  'enforcement':'અમલ',
  'established':'સ્થાપિત',
  'estimated':'અંદાજિત',
  'every':'દરેક',
  'evidence':'પુરાવો',
  'expense':'ખર્ચ',
  'experience':'અનુભવ',
  'exposure':'સંપર્ક',
  'filing':'ફાઇલિંગ',
  'filings':'ફાઇલિંગ',
  'finance':'નાણાં',
  'financial':'નાણાકીય',
  'first':'પ્રથમ',
  'fixed':'સ્થાયી',
  'flag':'સંકેત',
  'flags':'સંકેત',
  'found':'મળ્યું',
  'free':'મુક્ત',
  'from':'માંથી',
  'fund':'ભંડોળ',
  'funds':'ભંડોળ',
  'future':'ભાવિ',
  'gross':'કુલ',
  'had':'હતું',
  'has':'ધરાવે છે',
  'have':'ધરાવે છે',
  'higher':'ઊંચું',
  'history':'ઇતિહાસ',
  'however':'જોકે',
  'identified':'ઓળખાયેલ',
  'if':'જો',
  'impact':'અસર',
  'income':'આવક',
  'incorporated':'સ્થપાયેલ',
  'incorporation':'સ્થાપના',
  'increase':'વધારો',
  'industry':'ઉદ્યોગ',
  'information':'માહિતી',
  'insolvency':'નાદારી',
  'into':'માં',
  'investment':'રોકાણ',
  'investments':'રોકાણો',
  'investor':'રોકાણકાર',
  'investors':'રોકાણકારો',
  'is':'છે',
  'issue':'ઇશ્યૂ',
  'issues':'મુદ્દા',
  'it':'તે',
  'its':'તેની',
  'key':'મુખ્ય',
  'large':'મોટું',
  'largest':'સૌથી મોટું',
  'last':'છેલ્લું',
  'late':'મોડું',
  'leadership':'નેતૃત્વ',
  'leading':'અગ્રણી',
  'least':'ઓછામાં ઓછું',
  'legal':'કાયદાકીય',
  'less':'ઓછું',
  'level':'સ્તર',
  'levels':'સ્તર',
  'likely':'સંભવિત',
  'listed':'લિસ્ટેડ',
  'long':'લાંબું',
  'loss':'નુકસાન',
  'losses':'નુકસાન',
  'lower':'નીચું',
  'main':'મુખ્ય',
  'major':'મોટું',
  'management':'સંચાલન',
  'market':'બજાર',
  'markets':'બજારો',
  'material':'નોંધપાત્ર',
  'may':'શકે',
  'minor':'નાનું',
  'mix':'મિશ્રણ',
  'month':'મહિનો',
  'months':'મહિના',
  'more':'વધુ',
  'most':'મોટા ભાગના',
  'must':'આવશ્યક',
  'net':'ચોખ્ખું',
  'new':'નવું',
  'next':'આગામી',
  'no':'કોઈ',
  'none':'કોઈ નહીં',
  'nor':'ન',
  'not':'નથી',
  'note':'નોંધ',
  'notes':'નોંધ',
  'old':'જૂનું',
  'on':'પર',
  'one':'એક',
  'one of':'એક',
  'ongoing':'ચાલુ',
  'only':'માત્ર',
  'open':'ખુલ્લું',
  'operating':'કામકાજ',
  'operations':'કામકાજ',
  'or':'અથવા',
  'order':'આદેશ',
  'orders':'આદેશો',
  'over':'ઉપર',
  'overall':'એકંદરે',
  'past':'ભૂતકાળ',
  'pending':'બાકી',
  'per':'દીઠ',
  'performance':'કામગીરી',
  'period':'સમયગાળો',
  'plan':'યોજના',
  'plans':'યોજનાઓ',
  'pledge':'ગીરો',
  'pledges':'ગીરો',
  'possible':'શક્ય',
  'post':'પછી',
  'potential':'સંભાવના',
  'pre':'પહેલાં',
  'present':'વર્તમાન',
  'pressure':'દબાણ',
  'price':'ભાવ',
  'prices':'ભાવ',
  'proceeding':'કાર્યવાહી',
  'proceedings':'કાર્યવાહી',
  'proceeds':'રકમ',
  'profit':'નફો',
  'profits':'નફો',
  'public':'જાહેર',
  'quarter':'ત્રિમાસિક',
  'rate':'દર',
  'rates':'દર',
  'ratio':'ગુણોત્તર',
  'ratios':'ગુણોત્તર',
  'reason':'કારણ',
  'record':'નોંધ',
  'records':'નોંધો',
  'regulatory':'નિયમનકારી',
  'reliable':'વિશ્વસનીય',
  'reported':'નોંધાયેલ',
  'required':'જરૂરી',
  'resolved':'ઉકેલાયેલ',
  'result':'પરિણામ',
  'results':'પરિણામો',
  'return':'વળતર',
  'returns':'વળતર',
  'revenue growth':'આવક વૃદ્ધિ',
  'review':'સમીક્ષા',
  'reviewed':'સમીક્ષા કરેલ',
  'risk':'જોખમ',
  'risks':'જોખમો',
  'sales':'વેચાણ',
  'same':'સમાન',
  'scale':'સ્તર',
  'search':'શોધ',
  'searched':'શોધાયેલ',
  'second':'બીજું',
  'sector':'ક્ષેત્ર',
  'segment':'વિભાગ',
  'sellers':'વેચાણકારો',
  'settled':'સમાધાન થયેલ',
  'share':'શેર',
  'share of':'હિસ્સો',
  'shares':'શેર',
  'short':'ટૂંકું',
  'should':'જોઈએ',
  'significant':'નોંધપાત્ર',
  'since':'થી',
  'size':'કદ',
  'small':'નાનું',
  'so':'તેથી',
  'some':'કેટલાક',
  'source':'સ્રોત',
  'sources':'સ્રોતો',
  'specific':'ચોક્કસ',
  'stable':'સ્થિર',
  'staff':'સ્ટાફ',
  'stated':'જણાવેલ',
  'status':'સ્થિતિ',
  'statutory':'વૈધાનિક',
  'still':'હજુ',
  'stock':'સ્ટોક',
  'strategy':'વ્યૂહરચના',
  'strong':'મજબૂત',
  'substitution':'અવેજી',
  'supply':'પુરવઠો',
  'support':'ટેકો',
  'target':'લક્ષ્ય',
  'targets':'લક્ષ્યાંકો',
  'tax':'કર',
  'taxes':'કર',
  'team':'ટીમ',
  'term':'મુદત',
  'than':'કરતાં',
  'that':'તે',
  'their':'તેમની',
  'therefore':'તેથી',
  'these':'આ',
  'third':'ત્રીજું',
  'this':'આ',
  'those':'તે',
  'three':'ત્રણ',
  'through':'મારફતે',
  'time':'સમય',
  'total':'કુલ',
  'trend':'વલણ',
  'trends':'વલણ',
  'two':'બે',
  'unavailable':'અનુપલબ્ધ',
  'under':'હેઠળ',
  'unlikely':'અસંભવિત',
  'unlisted':'બિનલિસ્ટેડ',
  'until':'સુધી',
  'unverified':'ચકાસાયેલ નથી',
  'upcoming':'આગામી',
  'use':'ઉપયોગ',
  'used':'વપરાયેલ',
  'uses':'ઉપયોગો',
  'value':'મૂલ્ય',
  'values':'મૂલ્યો',
  'verdict':'ચુકાદો',
  'verified':'ચકાસાયેલ',
  'very':'ખૂબ',
  'volatility':'અસ્થિરતા',
  'volume':'જથ્થો',
  'was':'હતું',
  'weak':'નબળું',
  'well':'સારી રીતે',
  'were':'હતા',
  'what':'શું',
  'when':'ક્યારે',
  'where':'જ્યાં',
  'which':'જે',
  'while':'જ્યારે',
  'who':'જે',
  'whose':'જેની',
  'wilful':'ઇરાદાપૂર્વક',
  'will':'રહેશે',
  'willful':'ઇરાદાપૂર્વક',
  'within':'અંદર',
  'without':'વગર',
  'would':'રહેશે',
  'year':'વર્ષ',
  'years':'વર્ષ',
  'yet':'છતાં',
  'yield':'ઉપજ'
};

/* ---------------------------------------------------------------------------
   NAME_GU -- Indian given names, surnames and places, spelled properly.

   Romanisation loses vowel length: "Kumar" and "Nirmal" look identical in
   Latin but are કુમાર and નિર્મલ in Gujarati, and no rule can tell them apart.
   The names that actually appear in promoter tables and plant addresses are
   therefore written out here, and the transliterator below is the fallback for
   everything else.
   -------------------------------------------------------------------------- */
var NAME_GU = {
  'abb':'ABB',
  'emerson':'એમર્સન',
  'endress':'એન્ડ્રેસ',
  'honeywell':'હનીવેલ',
  'siemens':'સિમેન્સ',
  'yokogawa':'યોકોગાવા',
  'abhishek':'અભિષેક',
  'aditya':'આદિત્ય',
  'arjun':'અર્જુન',
  'ashwin':'અશ્વિન',
  'behari':'બિહારી',
  'bhupesh':'ભૂપેશ',
  'dev':'દેવ',
  'dhaval':'ધવલ',
  'hardik':'હાર્દિક',
  'harsh':'હર્ષ',
  'ishan':'ઈશાન',
  'jayesh':'જયેશ',
  'jewellery mart':'જ્વેલરી માર્ટ',
  'kailash':'કૈલાશ',
  'kartik':'કાર્તિક',
  'kaushik':'કૌશિક',
  'krunal':'ક્રુણાલ',
  'lal':'લાલ',
  'lalithaa':'લલિતા',
  'maulik':'મૌલિક',
  'nimesh':'નિમેષ',
  'pratap':'પ્રતાપ',
  'pratik':'પ્રતીક',
  'pyrosens':'પાયરોસેન્સ',
  'rathi':'રાઠી',
  'rohan':'રોહન',
  'rushabh':'ઋષભ',
  'shiprocket':'શિપરોકેટ',
  'siddharth':'સિદ્ધાર્થ',
  'talesara':'તલેસરા',
  'tempsens':'ટેમ્પસેન્સ',
  'tushar':'તુષાર',
  'udaipur':'ઉદયપુર',
  'vinay':'વિનય',
  'viral':'વિરલ',
  'virendra':'વીરેન્દ્ર',
  'yash':'યશ',
  'aarti':'આરતી',
  'abhijit':'અભિજિત',
  'adani':'અદાણી',
  'agarwal':'અગ્રવાલ',
  'agarwala':'અગ્રવાલા',
  'aggarwal':'અગ્રવાલ',
  'agrawal':'અગ્રવાલ',
  'ahmedabad':'અમદાવાદ',
  'ajay':'અજય',
  'akhil':'અખિલ',
  'alok':'આલોક',
  'ambani':'અંબાણી',
  'amin':'અમીન',
  'amit':'અમિત',
  'anand':'આણંદ',
  'anil':'અનિલ',
  'anita':'અનિતા',
  'anjali':'અંજલિ',
  'ankit':'અંકિત',
  'ankleshwar':'અંકલેશ્વર',
  'arora':'અરોડા',
  'arun':'અરુણ',
  'arvind':'અરવિંદ',
  'asha':'આશા',
  'ashish':'આશિષ',
  'ashok':'અશોક',
  'assam':'આસામ',
  'bajaj':'બજાજ',
  'banerjee':'બેનર્જી',
  'bangalore':'બેંગલુરુ',
  'bansal':'બંસલ',
  'baroda':'વડોદરા',
  'bengaluru':'બેંગલુરુ',
  'bharuch':'ભરૂચ',
  'bhatt':'ભટ્ટ',
  'bhavesh':'ભાવેશ',
  'bhavna':'ભાવના',
  'bhavnagar':'ભાવનગર',
  'bhopal':'ભોપાલ',
  'bhupendra':'ભૂપેન્દ્ર',
  'bihar':'બિહાર',
  'birla':'બિરલા',
  'bose':'બોઝ',
  'chandra':'ચંદ્ર',
  'chatterjee':'ચેટર્જી',
  'chaturvedi':'ચતુર્વેદી',
  'chavan':'ચવ્હાણ',
  'chennai':'ચેન્નઈ',
  'china':'ચીન',
  'chirag':'ચિરાગ',
  'chokshi':'ચોકસી',
  'chopra':'ચોપડા',
  'coimbatore':'કોઇમ્બતૂર',
  'das':'દાસ',
  'dave':'દવે',
  'deepa':'દીપા',
  'deepak':'દીપક',
  'delhi':'દિલ્હી',
  'desai':'દેસાઈ',
  'deshmukh':'દેશમુખ',
  'devendra':'દેવેન્દ્ર',
  'dinesh':'દિનેશ',
  'doshi':'દોશી',
  'dubai':'દુબઈ',
  'dubey':'દુબે',
  'dutta':'દત્તા',
  'europe':'યુરોપ',
  'falguni':'ફાલ્ગુની',
  'gaikwad':'ગાયકવાડ',
  'gandhi':'ગાંધી',
  'gandhinagar':'ગાંધીનગર',
  'garg':'ગર્ગ',
  'gaurav':'ગૌરવ',
  'geeta':'ગીતા',
  'germany':'જર્મની',
  'ghosh':'ઘોષ',
  'girish':'ગિરીશ',
  'godrej':'ગોદરેજ',
  'gopal':'ગોપાલ',
  'govind':'ગોવિંદ',
  'goyal':'ગોયલ',
  'gujarat':'ગુજરાત',
  'gupta':'ગુપ્તા',
  'hari':'હરિ',
  'harish':'હરીશ',
  'haryana':'હરિયાણા',
  'hema':'હેમા',
  'hetal':'હેતલ',
  'hitesh':'હિતેશ',
  'hyderabad':'હૈદરાબાદ',
  'india':'ભારત',
  'indore':'ઇન્દોર',
  'iyengar':'આયંગર',
  'iyer':'ઐયર',
  'jadhav':'જાધવ',
  'jai':'જય',
  'jain':'જૈન',
  'jaipur':'જયપુર',
  'jamnagar':'જામનગર',
  'japan':'જાપાન',
  'jatin':'જતિન',
  'jhaveri':'ઝવેરી',
  'jignesh':'જિજ્ઞેશ',
  'jindal':'જિંદાલ',
  'jitendra':'જિતેન્દ્ર',
  'jodhpur':'જોધપુર',
  'joshi':'જોષી',
  'joshi ':'જોષી',
  'junagadh':'જૂનાગઢ',
  'jyoti':'જ્યોતિ',
  'kamal':'કમલ',
  'kanpur':'કાનપુર',
  'kapoor':'કપૂર',
  'karan':'કરણ',
  'karnataka':'કર્ણાટક',
  'kaur':'કૌર',
  'kavita':'કવિતા',
  'kerala':'કેરળ',
  'keyur':'કેયૂર',
  'khanna':'ખન્ના',
  'kiran':'કિરણ',
  'kochi':'કોચી',
  'kolkata':'કોલકાતા',
  'komal':'કોમલ',
  'korea':'કોરિયા',
  'kothari':'કોઠારી',
  'krishna':'કૃષ્ણ',
  'krishnan':'કૃષ્ણન',
  'kuldeep':'કુલદીપ',
  'kulkarni':'કુલકર્ણી',
  'kumar':'કુમાર',
  'kunal':'કુણાલ',
  'lata':'લતા',
  'lucknow':'લખનૌ',
  'madhav':'માધવ',
  'madhya pradesh':'મધ્ય પ્રદેશ',
  'maharashtra':'મહારાષ્ટ્ર',
  'mahavir':'મહાવીર',
  'mahendra':'મહેન્દ્ર',
  'mahesh':'મહેશ',
  'malhotra':'મલ્હોત્રા',
  'manish':'મનીષ',
  'manish kumar':'મનીષ કુમાર',
  'manoj':'મનોજ',
  'meena':'મીના',
  'mehsana':'મહેસાણા',
  'mehta':'મહેતા',
  'menon':'મેનન',
  'mihir':'મિહિર',
  'mishra':'મિશ્રા',
  'mittal':'મિત્તલ',
  'modi':'મોદી',
  'mohit':'મોહિત',
  'more':'મોરે',
  'mukesh':'મુકેશ',
  'mukherjee':'મુખર્જી',
  'mumbai':'મુંબઈ',
  'murali':'મુરલી',
  'murthy':'મૂર્તિ',
  'nadar':'નાડર',
  'nagpur':'નાગપુર',
  'naidu':'નાયડુ',
  'nair':'નાયર',
  'narendra':'નરેન્દ્ર',
  'naresh':'નરેશ',
  'nashik':'નાશિક',
  'natarajan':'નટરાજન',
  'neha':'નેહા',
  'new delhi':'નવી દિલ્હી',
  'nikhil':'નિખિલ',
  'nilesh':'નિલેશ',
  'nirmal':'નિર્મલ',
  'nisha':'નિશા',
  'nitin':'નીતિન',
  'odisha':'ઓડિશા',
  'om':'ઓમ',
  'pande':'પાંડે',
  'pandey':'પાંડે',
  'pandya':'પંડ્યા',
  'pankaj':'પંકજ',
  'parag':'પરાગ',
  'paresh':'પરેશ',
  'parikh':'પરીખ',
  'patel':'પટેલ',
  'patil':'પાટીલ',
  'payal':'પાયલ',
  'pillai':'પિલ્લઈ',
  'pooja':'પૂજા',
  'pradeep':'પ્રદીપ',
  'prakash':'પ્રકાશ',
  'preeti':'પ્રીતિ',
  'premji':'પ્રેમજી',
  'priya':'પ્રિયા',
  'pune':'પુણે',
  'punit':'પુનિત',
  'punjab':'પંજાબ',
  'rahul':'રાહુલ',
  'rajasthan':'રાજસ્થાન',
  'rajendra':'રાજેન્દ્ર',
  'rajesh':'રાજેશ',
  'rajkot':'રાજકોટ',
  'rakesh':'રાકેશ',
  'rakhi':'રાખી',
  'ram':'રામ',
  'raman':'રામન',
  'ramanathan':'રામનાથન',
  'ramesh':'રમેશ',
  'ranjit':'રણજિત',
  'rao':'રાવ',
  'raval':'રાવલ',
  'ravi':'રવિ',
  'reddy':'રેડ્ડી',
  'reema':'રીમા',
  'rekha':'રેખા',
  'ritesh':'રિતેશ',
  'ritu':'રિતુ',
  'rohit':'રોહિત',
  'roy':'રોય',
  'sachin':'સચિન',
  'samir':'સમીર',
  'sandeep':'સંદીપ',
  'sanghvi':'સંઘવી',
  'sanjay':'સંજય',
  'sarosh':'સરોશ',
  'satish':'સતીશ',
  'saurabh':'સૌરભ',
  'seema':'સીમા',
  'sen':'સેન',
  'sethi':'સેઠી',
  'shah':'શાહ',
  'shailesh':'શૈલેષ',
  'sharma':'શર્મા',
  'shinde':'શિંદે',
  'shiv':'શિવ',
  'shweta':'શ્વેતા',
  'shyam':'શ્યામ',
  'singapore':'સિંગાપોર',
  'singh':'સિંહ',
  'singhal':'સિંઘલ',
  'sita':'સીતા',
  'sneha':'સ્નેહા',
  'sonal':'સોનલ',
  'soni':'સોની',
  'srinivas':'શ્રીનિવાસ',
  'subramanian':'સુબ્રમણ્યન',
  'sudhir':'સુધીર',
  'sumit':'સુમિત',
  'sunil':'સુનીલ',
  'sunita':'સુનીતા',
  'surat':'સુરત',
  'surendra':'સુરેન્દ્ર',
  'suresh':'સુરેશ',
  'sushil':'સુશીલ',
  'swati':'સ્વાતિ',
  'talesara':'તલેસરા',
  'tamil nadu':'તમિલનાડુ',
  'tarun':'તરુણ',
  'tata':'ટાટા',
  'telangana':'તેલંગાણા',
  'thakkar':'ઠક્કર',
  'tiwari':'તિવારી',
  'trivedi':'ત્રિવેદી',
  'uae':'યુએઈ',
  'udaipur':'ઉદયપુર',
  'usa':'અમેરિકા',
  'usha':'ઉષા',
  'uttar pradesh':'ઉત્તર પ્રદેશ',
  'vadodara':'વડોદરા',
  'vaibhav':'વૈભવ',
  'vapi':'વાપી',
  'varun':'વરુણ',
  'venkat':'વેંકટ',
  'verma':'વર્મા',
  'vijay':'વિજય',
  'vimal':'વિમલ',
  'vipul':'વિપુલ',
  'virendra':'વીરેન્દ્ર',
  'vishal':'વિશાલ',
  'vivek':'વિવેક',
  'vora':'વોરા',
  'vyas':'વ્યાસ',
  'west bengal':'પશ્ચિમ બંગાળ',
  'yadav':'યાદવ',
  'yogesh':'યોગેશ'
};

/* ---------------------------------------------------------------------------
   Latin -> Gujarati transliteration, for proper nouns only.

   A promoter's name has no translation; it has a spelling. Gujarati financial
   writing renders "Amit Talesara" as અમિત તલેસરા, and a reader of the Gujarati
   edition should not be dropped back into Latin script for the one word on the
   page that names a person. The model is asked to supply these in the `gu`
   payload, where it does the job well; this is the net beneath that, so a
   missed name still comes out in Gujarati rather than in English.
   -------------------------------------------------------------------------- */
var GU_CONS = [
  ['chh','છ'], ['sch','સ્ક'], ['shr','શ્ર'], ['tch','ચ'],
  ['kh','ખ'], ['gh','ઘ'], ['ch','ચ'], ['jh','ઝ'], ['th','થ'], ['dh','ધ'],
  ['ph','ફ'], ['bh','ભ'], ['sh','શ'], ['zh','ઝ'], ['ck','ક'], ['kk','ક્ક'],
  ['tt','ટ્ટ'], ['dd','ડ્ડ'], ['nn','ન્ન'], ['ll','લ્લ'], ['ss','સ્સ'],
  ['mm','મ્મ'], ['pp','પ્પ'], ['bb','બ્બ'], ['gg','ગ્ગ'], ['jj','જ્જ'],
  ['k','ક'], ['g','ગ'], ['c','ક'], ['j','જ'], ['t','ત'], ['d','દ'],
  ['n','ન'], ['p','પ'], ['b','બ'], ['m','મ'], ['y','ય'], ['r','ર'],
  ['l','લ'], ['v','વ'], ['w','વ'], ['s','સ'], ['h','હ'], ['z','ઝ'],
  ['f','ફ'], ['q','ક'], ['x','ક્સ']
];
var GU_VOW = [
  ['aai',['આઈ','ાઈ']], ['aa',['આ','ા']], ['ai',['ઐ','ૈ']], ['au',['ઔ','ૌ']],
  ['ee',['ઈ','ી']], ['ii',['ઈ','ી']], ['ea',['ઈ','ી']], ['oo',['ઊ','ૂ']],
  ['uu',['ઊ','ૂ']], ['ou',['ઔ','ૌ']], ['ei',['એ','ે']], ['ie',['ઈ','ી']],
  ['a',['અ','']], ['i',['ઇ','િ']], ['e',['એ','ે']], ['u',['ઉ','ુ']], ['o',['ઓ','ો']]
];
/* The longest run the app will translate on its own. Above this it is prose,
   not a label, and prose needs the model's translation or none. */
var GU_PHRASE_MAX = 4;
/* An English function word inside a run is the giveaway that it is prose rather
   than a label: "Market cap at Rs 300" translated word for word gives Gujarati
   words in English syntax. Runs carrying one of these are handed back in English
   unless a phrase dictionary matched the whole thing. */
var GU_PROSE_MARKERS = (function(){
  var o = {};
  ('a an the is are was were be been being has have had will would may might can '
 + 'could should must do does did at to in with by on from for of into over under '
 + 'about through than as its their which who whose where when what while because '
 + 'so if then that this these those it he she they we you not no nor but or and'
  ).split(' ').forEach(function(w){ o[w] = 1; });
  return o;
})();
var GU_HALANT = '્', GU_ANUSVARA = 'ં';
/* A nasal is written as the anusvara dot only before a homorganic stop --
   Mumbai, Chandra, Pande. Before a fricative or a liquid it stays a full
   consonant, so Tempsens is ટેમ્પસેન્સ and not ટેંપસેંસ. */
var GU_NASAL_NEXT = {
  n: ['kh','gh','ch','jh','th','dh','k','g','c','j','t','d','q'],
  m: ['bh','b']
};

function matchList(list, s, i){
  for(var k = 0; k < list.length; k++){
    var key = list[k][0];
    if(s.substr(i, key.length) === key) return list[k];
  }
  return null;
}
function translitWordGu(w){
  var s = w.toLowerCase(), out = '', i = 0, openCons = false, clusterLen = 0, lastCons = '';
  while(i < s.length){
    var v = matchList(GU_VOW, s, i);
    if(v){
      var isFinal = (i + v[0].length) >= s.length;
      if(v[0] === 'ai' && isFinal && openCons){
        out += 'ઈ'; openCons = false; clusterLen = 0; i += 2; continue;
      }
      /* A word-final bare "a" is the inherent vowel in most positions, but a
         name ending "-ara" or "-ma" carries a long aa. The exception is a glide
         cluster (Chandra, Mitra), where the final a really is inherent. */
      if(v[0] === 'a' && isFinal && openCons){
        var glide = clusterLen > 1 && (lastCons === 'r' || lastCons === 'y' || lastCons === 'v');
        if(!glide) out += 'ા';
      } else {
        out += openCons ? v[1][1] : v[1][0];
      }
      openCons = false; clusterLen = 0;
      i += v[0].length;
      continue;
    }
    var c = matchList(GU_CONS, s, i);
    if(c){
      /* n or m directly before another consonant is a nasal, written as the
         anusvara dot rather than as a full conjunct. */
      if((c[0] === 'n' || c[0] === 'm') && openCons === false && out){
        var after = matchList(GU_CONS, s, i + c[0].length);
        if(after && !matchList(GU_VOW, s, i + c[0].length)
           && GU_NASAL_NEXT[c[0]].indexOf(after[0]) >= 0){
          out += GU_ANUSVARA;
          i += c[0].length;
          continue;
        }
      }
      if(openCons) out += GU_HALANT, clusterLen++;
      else clusterLen = 1;
      out += c[1];
      lastCons = c[0].charAt(c[0].length - 1);
      openCons = true;
      i += c[0].length;
      continue;
    }
    i++;                                   /* apostrophe, hyphen inside a word */
  }
  return out;
}
/* Cache: the same twenty names are transliterated on every page of a report. */
var GU_TR_CACHE = {};
function translitGu(w){
  if(GU_TR_CACHE[w] !== undefined) return GU_TR_CACHE[w];
  var r = translitWordGu(w) || w;
  GU_TR_CACHE[w] = r;
  return r;
}

/* Financial shorthand that stays English by design, per section 51.1. */
var KEEP_EN = ['PAT','EBITDA','EBIT','ROE','ROCE','ROA','CFO','FCF','GMP','OFS','IPO','DRHP','RHP',
  'QIB','NII','HNI','UHNI','CAGR','PEG','SEBI','NSE','BSE','GST','MF','FPI','SME','EV','P/E','P/B',
  'D/E','YoY','NAV','AUM','WC','TTM'];

/* ---------------------------------------------------------------------------
   guSweep — the last pass over a finished Gujarati document.

   Everything upstream translates what it knows about: app labels through T,
   payload prose through gu.*, enum words through VOCAB_GU. What was left was
   the residue — a product name the model wrote in English, a promoter's name,
   a stray "Face value" in a chart caption. Auditing found 149 distinct English
   runs still on screen in one Gujarati report.

   This pass runs over the built HTML, outside tags and outside <script> and
   <style>, and converts every remaining Latin word run: a phrase dictionary
   first (longest phrase wins), then the app vocabulary, then transliteration
   for what must be a proper noun. Only the financial shorthand in KEEP_SET
   survives in Latin, because that is how Gujarati market copy actually reads.
   -------------------------------------------------------------------------- */
var KEEP_SET = (function(){
  var o = {};
  KEEP_EN.concat(['ESG','CEO','CFO','COO','MD','WACC','DCF','KPI','SWOT','RBI','MCA','NCLT',
    'IBBI','CCI','CDSL','NSDL','INR','USD','EUR','ISIN','PAN','TAN','CIN','LEI','UPI','ASBA',
    'NBFC','MSME','FDI','FII','DII','EPS','PBT','PAT','PBIT','NPA','CRAR','IRR','NPV','ARPU',
    'B2B','B2C','OEM','ODM','SKU','ERP','CRM','AI','ML','IT','ITES','BPO','KYC','AGM','EGM',
    'IFRS','GAAP','TDS','TCS','VAT','CST','MAT','ROIC','ROA','EBT','LTM','FYTD',
    'ICRA','CRISIL','CARE','ISO','BIS','CE','UL','ATEX','IEC','ASME','API'])
    .forEach(function(k){ o[k.toUpperCase()] = 1; });
  return o;
})();
function guKeepToken(t){
  if(KEEP_SET[t.toUpperCase()]) return true;
  if(/^(?:FY|Q[1-4]|H[12])[0-9'’]*$/i.test(t)) return true;
  if(t.length === 1) return true;                    /* A+, x, ×, footnote marks */
  return false;
}
/* Longest-phrase-first lookup across the two dictionaries. */
function guTerm(phrase){
  var k = phrase.toLowerCase().replace(/\s+/g,' ').trim();
  if(TERM_GU[k] !== undefined) return TERM_GU[k];
  if(NAME_GU[k] !== undefined) return NAME_GU[k];
  if(COMMON_GU[k] !== undefined) return COMMON_GU[k];
  var v = vocab(phrase);
  return v || null;
}
/* A word the dictionaries do not know is either a proper noun — which
   transliterates well — or an ordinary English word the model failed to
   translate, which transliterates into unreadable nonsense. Capitalisation is
   the only signal available, and it is a good one: promoter and brand names are
   capitalised, sentence vocabulary is not. */
function guProperish(tok, atStart){
  if(/^[A-Z]/.test(tok) && !atStart) return true;      /* capitalised mid-sentence */
  if(/^[A-Z]{2,}$/.test(tok)) return true;             /* an unrecognised acronym */
  return false;
}
/* The guard below decides sentence by sentence, not chunk by chunk. A table
   cell reading "Face value" and a paragraph the model never translated often
   arrive in the same text node, and reverting the whole node for the sake of
   the paragraph would drag a perfectly good label back into English with it. */
function guWords(text){
  /* Park the dotted abbreviations before the sentence splitter runs, or "n.a."
     is torn into two single letters by the full stops between them and each is
     kept as a one-letter token. */
  text = String(text).replace(/\bn\s*[.\/]\s*a\.?/gi, '\u0007NA\u0007');
  return text.split(/([.;:!?|\t\n]+|\u2014|\u2013)/).map(function(seg, i){
    return (i % 2) ? seg : guSegment(seg);
  }).join('');
}
function guSegment(text){
  if(!/[A-Za-z]/.test(text)) return text;

  /* tokens: Latin runs, everything else passes through untouched */
  var guessed = 0, unknown = 0, known = 0, prosey = 0;
  var parts = text.split(/([A-Za-z][A-Za-z'’]*)/);
  /* rebuild with phrase lookahead over word tokens */
  var out = '', i = 0;
  while(i < parts.length){
    var tok = parts[i];
    var isWord = (i % 2) === 1;
    if(!isWord){ out += tok; i++; continue; }
    /* try a 3-word then 2-word phrase, allowing only spaces between */
    var hit = null, span = 1;
    for(var n = 3; n >= 2; n--){
      var idx = i + (n - 1) * 2;
      if(idx >= parts.length) continue;
      var joiners = true, phrase = parts[i];
      for(var j = 1; j < n; j++){
        var sep = parts[i + j*2 - 1];
        if(!/^[ ]$/.test(sep)){ joiners = false; break; }
        phrase += ' ' + parts[i + j*2];
      }
      if(!joiners) continue;
      var t = guTerm(phrase);
      if(t !== null){ hit = t; span = n; break; }
    }
    if(hit !== null){ known++; }
    if(hit === null){
      if(GU_PROSE_MARKERS[tok.toLowerCase()]) prosey++;
      if(guKeepToken(tok)){ hit = tok; known++; }
      else {
        var one = guTerm(tok);
        if(one !== null){ hit = one; known++; }
        else {
          /* first word of the chunk, or first after a full stop, tells us
             nothing about whether the capital is a name or a sentence start */
          var atStart = (i === 1);
          if(guProperish(tok, atStart)){ guessed++; }
          else { unknown++; }
          hit = translitGu(tok);
        }
      }
    }
    out += hit;
    i += (span - 1) * 2 + 1;
  }
  /* Two or more ordinary English words that no dictionary could translate means
     this is a sentence the model left untranslated, not a name. Transliterating
     it produces sounds rather than meaning, which is strictly worse than the
     English — so the chunk is handed back as it came. The framework's gu.text
     sweep is what closes these properly. */
  var words = guessed + unknown + known;
  /* Word-by-word substitution is honest for a label, a table heading or a short
     noun phrase — "Face value", "Industrial instrumentation", a promoter's name.
     It cannot produce a grammatical Gujarati SENTENCE, because the word order is
     not the same: run it over a bull-case paragraph and you get Gujarati words
     in English syntax, which reads as nonsense and is strictly worse than the
     English it replaced. So a long run is translated only when the model
     supplied a translation for it upstream — gu.text and the gu.* keys — and is
     otherwise handed back untouched.

     Section 51 of the framework is what closes these properly; this is the line
     that refuses to fake it in the meantime. */
  function back(t){ return String(t).replace(/\u0007NA\u0007/g, 'n.a.')
                                    .replace(/\u0007NM\u0007/g, 'nm'); }
  if(words > GU_PHRASE_MAX) return back(text);
  if(prosey && words > 2) return back(text);
  if(unknown >= 2 && unknown > 0.35 * Math.max(words, 1)) return back(text);
  /* an emptied term ("the") can leave a double space behind */
  return out.replace(/  +/g,' ')
            .replace(/\u0007NA\u0007/g, '\u0AB2\u0ABE\u0A97\u0AC1 \u0AA8\u0AA5\u0AC0')
            .replace(/\u0007NM\u0007/g, '\u0A85\u0AB0\u0ACD\u0AA5\u0AAA\u0AC2\u0AB0\u0ACD\u0AA3 \u0AA8\u0AA5\u0AC0');
}
/* Text wrapped in EN() is left in English by the sweep. The running head and
   the footer are the case that matters: a Gujarati file forwarded to someone
   else still has to be recognisable as "Tempsens Instruments \u00B7 Institutional
   Research Report", and a reader searching a folder looks for that, not for a
   translation of it. */
var EN_OPEN = '\u0011', EN_CLOSE = '\u0012';
function EN(t){ return EN_OPEN + t + EN_CLOSE; }
function stripEnMarks(t){
  return String(t).replace(/[\u0011\u0012]/g, '');
}
function guSweep(html){
  /* Entities carry Latin letters that are markup, not words. Park them. */
  var ents = [];
  var s = String(html).replace(/&[#A-Za-z0-9]+;/g, function(m){
    ents.push(m); return '\u0001' + (ents.length - 1) + '\u0002'; });

  s = s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]*>|[^<]+/g, function(chunk){
    if(chunk.charAt(0) === '<') return chunk;        /* a tag or a skipped block */
    if(!/[A-Za-z]/.test(chunk)) return chunk;
    /* anything between the EN marks is handed back untouched */
    return chunk.split(/(\u0011[^\u0012]*\u0012)/).map(function(part){
      if(part.charAt(0) === '\u0011') return part;
      return /[A-Za-z]/.test(part) ? guWords(part) : part;
    }).join('');
  });

  return stripEnMarks(s.replace(/\u0001(\d+)\u0002/g, function(_, n){ return ents[Number(n)]; }));
}

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
/* Severity is a risk word, so it reads on the risk scale of the five-step
   ladder like every other judgement in the documents. */
function sevClass(v){ return ragClass(v, 'risk'); }
function bandOf(v){ v=Number(v)||0;
  return v>=85?'Exceptional':v>=75?'Strong':v>=65?'Attractive':v>=55?'Selective':v>=45?'Weak':'Avoid'; }
/* A pie beside its description rather than stacked above it. Used for the
   objects of the issue and for the issue-structure split, both of which read as
   a proportion first and a commentary second. */
var PIE_COLS = ['#1E4E8C','#0E7C66','#E08A1E','#7A5AA8','#2E9BC9','#C0552F','#5C8A2E','#B03060'];
function pieAside(slices, right, opts){
  opts = opts || {};
  var live = slices.filter(function(s){ return Number(s.value) > 0; });
  if(!live.length) return right || '';
  var tot = live.reduce(function(a,s){ return a + Number(s.value); }, 0) || 1;
  var data = live.map(function(s, i){
    return { value:Number(s.value), colour:s.colour || PIE_COLS[i % PIE_COLS.length] }; });
  var legend = '<div class="pie-lg">' + live.map(function(s, i){
      return '<div><i style="background:'+(s.colour || PIE_COLS[i % PIE_COLS.length])+'"></i>'
        + '<b>'+e(s.label)+'</b> <span class="en">'+pct(Number(s.value)/tot*100, 1)+'</span></div>'; }).join('')
    + '</div>';
  return '<div class="pie-row">'
    + '<div class="pie-l">' + chartDonut(data, { size:opts.size||96, hole:opts.hole,
        centre:opts.centre||'', centreSub:opts.centreSub||'' }) + legend + '</div>'
    + '<div class="pie-r">' + (right||'') + '</div></div>';
}
function bandColour(v){ v=Number(v)||0;
  return v>=75?'var(--good)':v>=65?'var(--teal)':v>=55?'var(--warn)':v>=45?'var(--amber)':'var(--bad)'; }

function ragClass(v, scale){ var r = rag5(v, scale); return 'rag'+(r+1); }

/* ---- the five-step scale ----
   Everything judged in these documents lands on the same ladder: 1 is the weak
   end, 5 the strong end. Percentages band at 35 / 50 / 65 / 80; words map by
   meaning, and the meaning depends on the column — HIGH is bad for a risk and
   good for a margin, so the caller names the scale. */
var PAL5     = ['var(--s5-1)','var(--s5-2)','var(--s5-3)','var(--s5-4)','var(--s5-5)'];
var PAL5_HEX = ['#C0392B','#E2703A','#D69A0E','#149C8B','#1F6FB2'];

function step5(pcv){ pcv = Number(pcv)||0;
  return pcv>=80 ? 4 : pcv>=65 ? 3 : pcv>=50 ? 2 : pcv>=35 ? 1 : 0; }
function ragBar(pcv){ return PAL5[step5(pcv)]; }
function ragBarHex(pcv){ return PAL5_HEX[step5(pcv)]; }

var W5 = {
  risk: [
    /^(critical)$/i,
    /^(high|serious|severe)$/i,
    /^(medium|moderate|low-med|watch|partial|partly)$/i,
    /^(low|minor)$/i,
    /^(none|nil|clean|clear)$/i
  ],
  quality: [
    /^(weak|poor|none|very low)$/i,
    /^(below average|low|limited)$/i,
    /^(average|moderate|medium|partial|partly|fair|stable|neutral)$/i,
    /^(above average|good|real|healthy|adequate|improving)$/i,
    /^(strong|exceptional|high|very strong|excellent)$/i
  ],
  status: [
    /^(unverified|not verified|adverse|resolved against|does not tie|red flag)$/i,
    /^(allegation|disputed|under appeal|pending|unquantified|estimated)$/i,
    /^(partially verified|reported|partial|partly|derived|could not test|settled|watch)$/i,
    /^(disclosed|clear|clean|no adverse)$/i,
    /* A completed search that turned up nothing is a finished check, not an
       unfinished one, and is coloured as such. */
    /^(verified|official|ties|resolved in favour|verified\s*[—-]\s*no reportable findings|no reportable findings)$/i
  ]
};
/* Words that carry a plain direction whichever column they sit in. */
var W5_ANY = [
  /^(avoid|very expensive|deteriorating|dependent on external capital|weak|critical|red flag|does not tie|unverified)$/i,
  /^(expensive|serious|high|below average|stretched|negative)$/i,
  /^(selective|fair|neutral|stable|moderate|average|medium|watch|partly|partial|could not test|reported|derived|estimated|partially self-funding)$/i,
  /^(attractive|good|positive|healthy|improving|low|adequate|above average|real|disclosed)$/i,
  /^(exceptional|strong|verified|official|ties|clean|clear|none|self-funding|undervalued|deeply undervalued|resolved in favour)$/i
];
function rag5(v, scale){
  var t = S(v).trim();
  if(!t) return 2;
  var table = W5[scale];
  var i;
  if(table){ for(i=0;i<5;i++) if(table[i].test(t)) return i; }
  for(i=0;i<5;i++) if(W5_ANY[i].test(t)) return i;
  return 2;
}
function rag(v, scale){
  var t = S(v).trim();
  if(!t) return '';
  var i = rag5(t, scale);
  return i<=1 ? 'bad' : i===2 ? 'warn' : 'good';
}
function ragHex(v, scale){ return PAL5[rag5(v, scale)]; }
/* A coloured pill, used wherever a judgement word appears in a table cell. */
function ragPill(v, lang, scale){
  var t = S(v); if(!t) return '';
  return '<span class="pill '+ragClass(t, scale)+'">'+e(A(lang, t))+'</span>';
}

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
  exchanges:      ['Exchanges','એક્સચેન્જ'],
  ir_products:    ['Products and services — what the company actually sells','ઉત્પાદનો અને સેવાઓ — કંપની ખરેખર શું વેચે છે'],
  ir_segments:    ['Revenue mix by segment','સેગમેન્ટ પ્રમાણે આવક મિશ્રણ'],
  irg_recommendation:['Final Recommendation','અંતિમ ભલામણ'],
  irg_ipo:        ['The IPO','આ IPO'],
  irg_valuation:  ['Valuation','મૂલ્યાંકન'],
  irg_company:    ['Company and Business','કંપની અને વ્યવસાય'],
  irg_financials: ['Financials','નાણાકીય'],
  irg_promoters:  ['Promoters and Governance','પ્રમોટર્સ અને ગવર્નન્સ'],
  irg_risks:      ['Thesis Drivers and Risks','થીસીસ ચાલકો અને જોખમો'],
  ir_litigation:  ['Litigation and disputed demands','મુકદ્દમા અને વિવાદિત માંગણીઓ'],
  ir_credit:      ['Credit profile and bank facilities','ધિરાણ પ્રોફાઇલ અને બેંક સુવિધાઓ'],
  ir_group:       ['Group structure','જૂથ માળખું'],
  ir_issue_kpi:   ['Issue structure and governance signals','ઇશ્યૂ માળખું અને ગવર્નન્સ સંકેતો'],
  ir_concentration:['Concentration risk','કેન્દ્રીકરણ જોખમ'],
  ir_cashflow:    ['Cash flow analysis','રોકડ પ્રવાહ વિશ્લેષણ'],
  forum:          ['Forum','મંચ'],
  against:        ['Against','વિરુદ્ધ'],
  matter:         ['Matter','બાબત'],
  disputed_total: ['Total disputed','કુલ વિવાદિત'],
  pct_net_worth:  ['Of net worth','નેટવર્થના'],
  pct_pat:        ['Of PAT','PAT ના'],
  rating_lbl:     ['Rating','રેટિંગ'],
  outlook_lbl:    ['Outlook','દૃષ્ટિકોણ'],
  facility:       ['Facility','સુવિધા'],
  limit_lbl:      ['Limit','મર્યાદા'],
  wc_intensity:   ['Working capital intensity','કાર્યકારી મૂડી તીવ્રતા'],
  upgrade_trig:   ['Upgrade trigger','અપગ્રેડ ટ્રિગર'],
  downgrade_trig: ['Downgrade trigger','ડાઉનગ્રેડ ટ્રિગર'],
  entity:         ['Entity','એન્ટિટી'],
  stake:          ['Stake','હિસ્સો'],
  basis_lbl:      ['Basis','આધાર'],
  activity:       ['Activity','પ્રવૃત્તિ'],
  cashout:        ['Promoter cash-out','પ્રમોટર કેશ-આઉટ'],
  fresh_of_mcap:  ['Fresh issue of market cap','માર્કેટ કેપમાં ફ્રેશ ઇશ્યૂ'],
  cost_of_acq:    ['Promoter cost of acquisition','પ્રમોટરની સંપાદન કિંમત'],
  drhp_delta:     ['DRHP to RHP change','DRHP થી RHP ફેરફાર'],
  input_lbl:      ['Input','ઇનપુટ'],
  of_purchases:   ['Of purchases','ખરીદીના'],
  end_market:     ['End market','અંતિમ બજાર'],
  of_revenue:     ['Of revenue','આવકના'],
  earnings_yield: ['Earnings yield','કમાણી ઉપજ'],
  gsec_10y:       ['10-year G-sec','10-વર્ષ G-sec'],
  peg_reported:   ['PEG on reported growth','નોંધાયેલ વૃદ્ધિ પર PEG'],
  peg_organic:    ['PEG on organic growth','ઓર્ગેનિક વૃદ્ધિ પર PEG'],
  reconciliation: ['Reconciliation checks','સમાધાન ચકાસણી'],
  check_lbl:      ['Check','ચકાસણી'],
  result_lbl:     ['Result','પરિણામ'],
  cfo_pat:        ['Cash conversion (CFO / PAT)','રોકડ રૂપાંતરણ (CFO / PAT)'],
  divergence:     ['Profit versus cash','નફો વિરુદ્ધ રોકડ'],
  funding_verdict:['Funding verdict','ભંડોળ ચુકાદો'],
  trigger_lbl:    ['Trigger','ટ્રિગર'],
  top10_customers:['Top 10 customers as a share of revenue','આવકમાં ટોચના 10 ગ્રાહકોનો હિસ્સો'],
  region_lbl:     ['Region','પ્રદેશ'],
  debt_repay:     ['Debt repayment','દેવાની ચુકવણી'],
  accrual_ratio:  ['Accrual ratio','ઉપચય ગુણોત્તર'],
  capex_intensity:['Capex intensity','કેપેક્સ તીવ્રતા'],
  wc_absorption:  ['Working capital absorption','કાર્યકારી મૂડી શોષણ'],
  trend:          ['Trend','વલણ'],
  ir_inflow:      ['Where the money comes from','પૈસા ક્યાંથી આવે છે'],
  ir_outflow:     ['Where the money goes','પૈસા ક્યાં જાય છે'],
  does_not_tie:   ['These do not tie.','આ મેળ ખાતું નથી.'],
  inflow_gap:     ['The parts differ from the stated issue size by','ભાગો જણાવેલ ઇશ્યૂ કદથી અલગ છે'],
  to_sellers:     ['Paid to selling shareholders','વેચનાર શેરહોલ્ડરોને ચૂકવેલ'],
  issue_expenses: ['Issue expenses and unallocated','ઇશ્યૂ ખર્ચ અને ફાળવેલ નથી'],
  balance_of_fresh:['Balance of the fresh issue not assigned to a stated object','નવા ઇશ્યૂની બાકી રકમ'],
  ofs_note:       ['Leaves the transaction; does not reach the company','વ્યવહારમાંથી બહાર જાય છે; કંપની સુધી પહોંચતું નથી'],
  ties_to_issue:  ['Ties to the issue size','ઇશ્યૂ કદ સાથે મેળ ખાય છે'],
  /* Running-header page labels. These were hard-coded English strings passed to
     page(), so they appeared untranslated on every page of the Gujarati
     editions — the single most frequent English in those documents. */
  pg_verdict:     ['Verdict','ચુકાદો'],
  pg_scorecard:   ['Scorecard','સ્કોર કાર્ડ'],
  pg_the_ipo:     ['The IPO','આ IPO'],
  pg_company:     ['The Company','કંપની'],
  pg_industry:    ['Industry & Moat','ઉદ્યોગ અને સ્પર્ધાત્મક લાભ'],
  pg_numbers:     ['The Numbers','આંકડા'],
  pg_cash:        ['Cash & Balance Sheet','રોકડ અને સરવૈયું'],
  pg_promoters:   ['Promoters & Governance','પ્રમોટર્સ અને ગવર્નન્સ'],
  pg_valuation:   ['Valuation','મૂલ્યાંકન'],
  pg_risk:        ['The Risk','જોખમ'],
  pg_decision:    ['The Decision','નિર્ણય'],
  pg_signals:     ['Key Signals','મુખ્ય સંકેતો'],
  pg_financials:  ['Financials','નાણાકીય'],
  /* Document names, which appear in the footer of every page. */
  doc_report:     ['IPO Company Research Report','IPO કંપની સંશોધન રિપોર્ટ'],
  doc_inst:       ['Institutional Research Report','સંસ્થાકીય સંશોધન રિપોર્ટ'],
  doc_exec:       ['Executive Summary','કાર્યકારી સારાંશ'],
  doc_score:      ['Score Card','સ્કોર કાર્ડ'],
  net_worth:      ['Net worth','નેટવર્થ'],
  total_borrowings:['Total borrowings','કુલ ઉધાર'],
  as_at:          ['as at','ના રોજ'],
  objects_split:  ['Objects','ઉદ્દેશ્યો'],
  mechanism:      ['How it plays out','તે કેવી રીતે થાય છે'],
  priority:       ['Priority','પ્રાથમિકતા'],
  scenario:       ['Scenario','પરિદૃશ્ય'],
  probability:    ['Probability','સંભાવના'],
  warning_sign:   ['Warning sign','ચેતવણી સંકેત'],
  ir_opmetrics:   ['Operating metrics — CAC, cash conversion and customer concentration','ઓપરેટિંગ મેટ્રિક્સ — CAC, રોકડ રૂપાંતરણ અને ગ્રાહક કેન્દ્રીકરણ'],
  ir_bsheet:      ['Balance sheet — assets, borrowings and working capital','બેલેન્સ શીટ — સંપત્તિ, ઉધાર અને કાર્યકારી મૂડી'],
  product:        ['Product / service','ઉત્પાદન / સેવા'],
  what_it_is:     ['What it is','તે શું છે'],
  customers:      ['Customers','ગ્રાહકો'],
  rev_share:      ['Revenue share','આવક હિસ્સો'],
  margin_profile: ['Margin profile','માર્જિન પ્રોફાઇલ'],
  assets_h:       ['Assets','સંપત્તિ'],
  borrowings_h:   ['Borrowings','ઉધાર'],
  debt_profile:   ['Debt profile','દેવાની પ્રોફાઇલ'],
  cost_of_debt:   ['Cost of debt','દેવાની કિંમત'],
  interest_cover: ['Interest cover','વ્યાજ કવર'],
  repaid_from_ipo:['Repaid from IPO','IPO માંથી ચૂકવણી'],
  value_lbl:      ['Value','મૂલ્ય'],
  basis_tag:      ['Basis','આધાર'],
  /* The GMP tile is deliberately labelled on the face of every report: the
     number is a street quote, not an exchange price. */
  unoff_unver:    ['Unofficial - Unverified','અનધિકૃત - અચકાસાયેલ'],
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
  ir_inflow:      ['Where the money comes from','પૈસા ક્યાંથી આવે છે'],
  ir_outflow:     ['Where the money goes','પૈસા ક્યાં જાય છે'],
  does_not_tie:   ['These do not tie.','આ મેળ ખાતું નથી.'],
  inflow_gap:     ['The parts differ from the stated issue size by','ભાગો જણાવેલ ઇશ્યૂ કદથી અલગ છે'],
  to_sellers:     ['Paid to selling shareholders','વેચનાર શેરહોલ્ડરોને ચૂકવેલ'],
  issue_expenses: ['Issue expenses and unallocated','ઇશ્યૂ ખર્ચ અને ફાળવેલ નથી'],
  balance_of_fresh:['Balance of the fresh issue not assigned to a stated object','નવા ઇશ્યૂની બાકી રકમ'],
  ofs_note:       ['Leaves the transaction; does not reach the company','વ્યવહારમાંથી બહાર જાય છે; કંપની સુધી પહોંચતું નથી'],
  ties_to_issue:  ['Ties to the issue size','ઇશ્યૂ કદ સાથે મેળ ખાય છે'],
  /* Running-header page labels. These were hard-coded English strings passed to
     page(), so they appeared untranslated on every page of the Gujarati
     editions — the single most frequent English in those documents. */
  pg_verdict:     ['Verdict','ચુકાદો'],
  pg_scorecard:   ['Scorecard','સ્કોર કાર્ડ'],
  pg_the_ipo:     ['The IPO','આ IPO'],
  pg_company:     ['The Company','કંપની'],
  pg_industry:    ['Industry & Moat','ઉદ્યોગ અને સ્પર્ધાત્મક લાભ'],
  pg_numbers:     ['The Numbers','આંકડા'],
  pg_cash:        ['Cash & Balance Sheet','રોકડ અને સરવૈયું'],
  pg_promoters:   ['Promoters & Governance','પ્રમોટર્સ અને ગવર્નન્સ'],
  pg_valuation:   ['Valuation','મૂલ્યાંકન'],
  pg_risk:        ['The Risk','જોખમ'],
  pg_decision:    ['The Decision','નિર્ણય'],
  pg_signals:     ['Key Signals','મુખ્ય સંકેતો'],
  pg_financials:  ['Financials','નાણાકીય'],
  /* Document names, which appear in the footer of every page. */
  doc_report:     ['IPO Company Research Report','IPO કંપની સંશોધન રિપોર્ટ'],
  doc_inst:       ['Institutional Research Report','સંસ્થાકીય સંશોધન રિપોર્ટ'],
  doc_exec:       ['Executive Summary','કાર્યકારી સારાંશ'],
  doc_score:      ['Score Card','સ્કોર કાર્ડ'],
  net_worth:      ['Net worth','નેટવર્થ'],
  total_borrowings:['Total borrowings','કુલ ઉધાર'],
  as_at:          ['as at','ના રોજ'],
  objects_split:  ['Objects','ઉદ્દેશ્યો'],
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
  str_weak:       ['SWOT Analysis','SWOT વિશ્લેષણ'],
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
  ipo_snapshot:   ['IPO snapshot','IPO ઝલક'],
  revenue_lbl:    ['Revenue (₹ cr)','આવક (₹ કરોડ)'],
  pat_lbl:        ['Profit after tax (₹ cr)','કરવેરા પછીનો નફો (₹ કરોડ)'],
  pe_compare:     ['P/E against peers','સમકક્ષો સામે P/E'],
  score_shape:    ['Where the score comes from','સ્કોર ક્યાંથી આવે છે'],
  what_it_does:   ['Business overview','વ્યવસાયની ઝાંખી'],
  amount:         ['Amount','રકમ'],
  as_of:          ['As of','તારીખે'],
  case:           ['Case','પરિદૃશ્ય'],
  catalyst:       ['Catalyst','ઉત્પ્રેરક'],
  check:          ['Check','ચકાસણી'],
  company:        ['Company','કંપની'],
  decision:       ['Decision','નિર્ણય'],
  direction:      ['Direction','દિશા'],
  driver:         ['Driver','ચાલક'],
  fair_value:     ['Fair value','વાજબી મૂલ્ય'],
  flag:           ['Flag','ચેતવણી'],
  frequency:      ['Frequency','આવર્તન'],
  implied_growth: ['Implied growth','સૂચિત વૃદ્ધિ'],
  margin:         ['Margin','માર્જિન'],
  mcap:           ['Market capitalisation','બજાર મૂડી'],
  mode:           ['Failure mode','નિષ્ફળતાનો પ્રકાર'],
  name:           ['Name','નામ'],
  object:         ['Object of the issue','ઇશ્યૂનો ઉદ્દેશ'],
  peer_median:    ['Peer median','સમકક્ષ મધ્યક'],
  point:          ['Point','મુદ્દો'],
  ratio:          ['Ratio','ગુણોત્તર'],
  result:         ['Result','પરિણામ'],
  rev_share:      ['Revenue share','આવક હિસ્સો'],
  role:           ['Role','ભૂમિકા'],
  threshold:      ['Threshold','મર્યાદા'],
  timing:         ['Timing','સમય'],
  trigger:        ['Trigger','કારણ'],
  upside:         ['Upside','સંભવિત વૃદ્ધિ'],
  primary:        ['Primary sources','પ્રાથમિક સ્રોત'],
  secondary:      ['Secondary sources','ગૌણ સ્રોત'],
  dp_unit:        ['Unit economics','એકમ અર્થશાસ્ત્ર'],
  dp_wc:          ['Working capital cycle','કાર્યકારી મૂડી ચક્ર'],
  dp_quarterly:   ['Quarterly trend','ત્રિમાસિક વલણ'],
  dp_capalloc:    ['Capital allocation history','મૂડી ફાળવણીનો ઇતિહાસ'],
  dp_rpt:         ['Related-party exposure','સંબંધિત-પક્ષ એક્સપોઝર'],
  dp_contingent:  ['Contingent liabilities','આકસ્મિક જવાબદારીઓ'],
  dp_regulatory:  ['Regulatory landscape','નિયમનકારી પરિદૃશ્ય'],
  dp_competition: ['Competitive positioning','સ્પર્ધાત્મક સ્થિતિ'],
  dp_rdcf:        ['Reverse DCF — what the price assumes','રિવર્સ DCF — ભાવ શું ધારે છે'],
  dp_sensitivity: ['Sensitivity grid','સંવેદનશીલતા ગ્રીડ'],
  dp_mgmt:        ['Management quality','સંચાલન ગુણવત્તા'],
  dp_cases:       ['The bull and bear cases in full','તેજી અને મંદીના કેસ સંપૂર્ણ'],
  dp_bull:        ['Bull case','તેજીનો કેસ'],
  dp_bear:        ['Bear case','મંદીનો કેસ'],
  dp_change_mind: ['What would change our mind','અમારો મત શું બદલશે'],
  dp_questions:   ['Questions for management','સંચાલન માટે પ્રશ્નો'],
  dp_implied_margin: ['Implied margin','સૂચિત માર્જિન'],
  dp_horizon:     ['Horizon (years)','સમયગાળો (વર્ષ)'],
  unit:           ['Unit','એકમ'],
  year:           ['Year','વર્ષ'],
  action:         ['Action','ક્રિયા'],
  outcome:        ['Outcome','પરિણામ'],
  party:          ['Party','પક્ષ'],
  nature:         ['Nature','પ્રકાર'],
  concern:        ['Concern','ચિંતા'],
  status:         ['Status','સ્થિતિ'],
  impact:         ['Impact','અસર'],
  pricing_power:  ['Pricing power','ભાવ નિર્ધારણ શક્તિ'],
  promoter_holding:['Promoter holding, pre to post','પ્રમોટર હિસ્સો, પહેલાં થી પછી'],
  ir_shareholding_x:['x','x'],
  ir_title:       ['Institutional Research Report','સંસ્થાકીય સંશોધન રિપોર્ટ'],
  ir_products:    ['Products and services','ઉત્પાદનો અને સેવાઓ'],
  ir_industry:    ['Industry analysis','ઉદ્યોગ વિશ્લેષણ'],
  ir_moat:        ['Competitive advantage','સ્પર્ધાત્મક લાભ'],
  ir_pl:          ['Three-year financial analysis','ત્રણ વર્ષનું નાણાકીય વિશ્લેષણ'],
  ir_fq:          ['Financial quality','નાણાકીય ગુણવત્તા'],
  ir_cash:        ['Cash flow and quality of earnings','રોકડ પ્રવાહ અને કમાણીની ગુણવત્તા'],
  ir_bs:          ['Balance sheet analysis','સરવૈયાનું વિશ્લેષણ'],
  ir_promoters:   ['Promoter background and due diligence','પ્રમોટર પૃષ્ઠભૂમિ અને ડ્યુ ડિલિજન્સ'],
  ir_gov:         ['Corporate governance','કોર્પોરેટ ગવર્નન્સ'],
  ir_anchors:     ['Anchor investors','એન્કર રોકાણકારો'],
  ir_objects:     ['IPO objectives — where the money goes','IPO ઉદ્દેશ્યો — નાણાં ક્યાં જાય છે'],
  ir_val:         ['Valuation — the decisive section','મૂલ્યાંકન — નિર્ણાયક વિભાગ'],
  ir_peers:       ['Peer comparison','સમકક્ષ સરખામણી'],
  ir_gmp:         ['Grey market premium analysis','ગ્રે માર્કેટ પ્રીમિયમ વિશ્લેષણ'],
  ir_scen:        ['Bull / base / bear scenarios','તેજી / આધાર / મંદી પરિદૃશ્ય'],
  ir_lg:          ['Listing-gain assessment','લિસ્ટિંગ ગેઇન મૂલ્યાંકન'],
  ir_lt:          ['Long-term investment assessment','લાંબા ગાળાનું રોકાણ મૂલ્યાંકન'],
  ir_alloc:       ['Allocation view','ફાળવણી દૃષ્ટિકોણ'],
  ir_catalysts:   ['Key catalysts','મુખ્ય ઉત્પ્રેરક'],
  ir_fail:        ['How this thesis fails','આ થીસીસ કેવી રીતે નિષ્ફળ જાય'],
  ir_monitor:     ['Quarterly monitoring checklist','ત્રિમાસિક દેખરેખ ચેકલિસ્ટ'],
  ir_score:       ['The 100-point score','100-પોઇન્ટ સ્કોર'],
  ir_verdict:     ['Final investment verdict','અંતિમ રોકાણ ચુકાદો'],
  ir_sources:     ['Source audit, conflicts and limitations','સ્રોત ઓડિટ, વિરોધાભાસ અને મર્યાદાઓ'],
  ir_segments:    ['Revenue by segment','સેગમેન્ટ પ્રમાણે આવક'],
  ir_metrics:     ['Operating metrics','સંચાલન માપદંડ'],
  ir_shareholding:['Shareholding and selling shareholders','શેરહોલ્ડિંગ અને વેચતા શેરહોલ્ડરો'],
  ir_conflict:    ['Where sources disagree','જ્યાં સ્રોતો અસંમત છે'],
  ir_missing:     ['What could not be verified','જે ચકાસી શકાયું નથી'],
  ir_contents:    ['Contents','અનુક્રમણિકા'],
  ir_none:        ['Not disclosed in the sources reviewed','સમીક્ષા કરેલા સ્રોતોમાં જાહેર કરેલ નથી'],
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
  footnote:       ['Generated by an AI research tool developed by CA Tejas Desai, who is not a SEBI-registered investment adviser. Prepared solely for academic purposes and private circulation, it is not investment advice, not a recommendation, and not an offer to buy or sell. Grey market premium figures are unofficial and unverified. Verify every figure against the RHP and exchange filings before acting.',
                   'આ રિપોર્ટ CA તેજસ દેસાઈ દ્વારા વિકસાવવામાં આવેલા AI સંશોધન સાધન દ્વારા તૈયાર કરવામાં આવ્યો છે, જેઓ SEBI-રજિસ્ટર્ડ રોકાણ સલાહકાર નથી. આ ફક્ત શૈક્ષણિક હેતુ અને ખાનગી પરિભ્રમણ માટે જ તૈયાર કરવામાં આવ્યો છે; આ રોકાણ સલાહ નથી, ભલામણ નથી, અને ખરીદ-વેચાણની ઓફર નથી. ગ્રે માર્કેટ પ્રીમિયમના આંકડા અનધિકૃત અને અચકાસાયેલ છે. કોઈપણ પગલું લેતાં પહેલાં દરેક આંકડો RHP અને એક્સચેન્જ ફાઇલિંગ સામે ચકાસો.']
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
  /* One five-step scale, worst to best, used for every judgement in every
     document: score bars, severity, priority, probability, impact, verdicts,
     statuses, assessments and the sensitivity grid. Warm for the weak end,
     cool for the strong end — chosen because red-versus-green alone is not
     legible to a colour-blind reader, and every band here also carries a word. */
  --s5-1:#C0392B; --s5-2:#E2703A; --s5-3:#D69A0E; --s5-4:#149C8B; --s5-5:#1F6FB2;
  --good:#149C8B; --warn:#D69A0E; --amber:#D69A0E; --bad:#C0392B; --crit:#8E2A20;
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
.ch{ margin:3mm 0 2mm; }
.ch svg{ display:block; max-width:100%; }
.chbars{ margin:2.5mm 0; }
.chbar{ display:flex; align-items:center; gap:3mm; margin:1.8mm 0; font-size:8.6pt; }
.chbar .cl{ flex:0 0 34mm; color:var(--ink2); }
.chbar .ct{ flex:1; height:4.2mm; background:#EEF1F5; border-radius:2mm; overflow:hidden; }
.chbar .ct i{ display:block; height:100%; border-radius:0 2mm 2mm 0; }
.chbar .cv{ flex:0 0 16mm; text-align:right; font-weight:700; }
.chbar.me .cl{ font-weight:800; color:var(--ink); }
.chheat{ width:100%; border-collapse:collapse; margin:2.5mm 0; font-size:8.4pt; }
.chheat th{ padding:1.8mm 2mm; text-align:left; color:var(--ink3); font-weight:700; }
.chheat td{ padding:2.2mm 2mm; text-align:center; font-weight:700; }
.chleg{ display:flex; flex-wrap:wrap; gap:4mm; margin-top:1.5mm; font-size:8.4pt; color:var(--ink2); }
.chleg i{ display:inline-block; width:3mm; height:3mm; border-radius:1mm; margin-right:1.5mm; vertical-align:-0.3mm; }
.sc2col{ column-count:2; column-gap:7mm; margin-top:1mm; }
.sc2blk{ break-inside:avoid; -webkit-column-break-inside:avoid; margin-bottom:3mm; }
.sc2hd{ display:flex; justify-content:space-between; align-items:baseline; font-size:7.6pt;
        font-weight:800; color:var(--navy); text-transform:uppercase; letter-spacing:.05em;
        border-bottom:.7pt solid var(--navy); padding-bottom:.8mm; margin-bottom:1mm; }
.sc2row{ display:flex; align-items:center; gap:2mm; padding:.7mm 0; font-size:7.4pt; }
.sc2row .l{ flex:1; color:var(--ink2); line-height:1.25; }
.sc2row .t{ flex:0 0 14mm; height:2mm; background:#EEF1F5; border-radius:1mm; overflow:hidden; }
.sc2row .t i{ display:block; height:100%; border-radius:0 1mm 1mm 0; }
.sc2row .v{ flex:0 0 11mm; text-align:right; font-weight:700; }
.sc2row .v em{ font-style:normal; color:var(--ink4); font-weight:500; font-size:6.4pt; }
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
/* SWOT is a 2x2: the second row needs a rule above it or the four quadrants
   read as one long double column instead of a matrix. */
.swotg{ row-gap:3.4mm; }
.swotg > div:nth-child(n+3){ border-top:.3mm solid var(--rule); padding-top:2.6mm; }
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
/* kept as aliases so any stray reference still lands on the five-step scale */
.sv-crit{ background:var(--s5-1); } .sv-high{ background:var(--s5-2); }
.sv-med{ background:var(--s5-3); } .sv-low{ background:var(--s5-4); }
.rag1{ background:var(--s5-1); } .rag2{ background:var(--s5-2); }
.rag3{ background:var(--s5-3); } .rag4{ background:var(--s5-4); }
.rag5{ background:var(--s5-5); }
.gov-a{ display:inline-block; min-width:17mm; }
.pie-row{ display:flex; gap:6mm; align-items:flex-start; margin:1mm 0 2mm; }
.pie-l{ flex:0 0 52mm; }
.pie-r{ flex:1; min-width:0; }
.pie-r table{ margin-top:0; }
.pie-lg{ margin-top:2mm; font-size:7.4pt; line-height:1.5; }
.pie-lg div{ display:flex; align-items:baseline; gap:1.6mm; }
.pie-lg i{ width:2.4mm; height:2.4mm; border-radius:.6mm; flex:0 0 auto; display:inline-block; }
.pie-lg b{ flex:1; font-weight:600; color:var(--ink2); }
/* The concentration tables were set a step down from everything else. */
.ir-conc table{ font-size:9pt; }
.ir-conc td, .ir-conc th{ padding-top:2.1mm; padding-bottom:2.1mm; }
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

/* Grey-market premium headline tile. Shared by every document so the figure,
   the bracketed percentage and the caveat are worded identically in all five. */
/* Industry classification. Translated when the payload carries Gujarati for it,
   otherwise tagged .en so it reads as a deliberate English term rather than a
   translation that was missed. */
function sectorText(p, lang){
  var raw = S((p.meta||{}).sector||'');
  return raw ? tr(p, lang, raw) : '';
}
function sectorHtml(p, lang){
  var raw = S((p.meta||{}).sector||'');
  if(!raw) return '';
  var t = sectorText(p, lang);
  return (lang==='gu' && S(t)===raw) ? '<span class="en">'+e(raw)+'</span>' : e(t);
}
function gmpTile(ipo, lang){
  var g = (ipo||{}).gmp || {};
  var has = g.value != null && g.value !== '';
  return '<div class="tile"><div class="k">'+e(L(lang,'gmp'))+'</div>'
    + '<div class="v en" style="color:var(--teal)">'+(has? '₹'+n(g.value) : '—')
    + (has && g.pct != null ? '<small> ('+pct(g.pct,1)+')</small>' : '')+'</div>'
    + '<div class="s">'+e(L(lang,'unoff_unver'))+'</div></div>';
}
/* Dates in the Indian format the reader expects.
   The payload carries ISO dates (2026-08-21) because that is unambiguous for a
   machine, and analysis_datetime arrives as "2026-08-19 21:30 IST". Everything
   printed is converted to DD-MM-YYYY here, in one place, so no renderer has to
   remember to do it and no document can disagree with another. */
function dmy(v){
  var t = S(v);
  if(!t) return '';
  /* An ISO date anywhere in the string, with whatever follows it left alone —
     that keeps the time and the IST suffix on the analysis stamp. */
  return t.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, function(_, y, mo, d){
    return d + '-' + mo + '-' + y; });
}
function shell(title, bodyCls, pages, extraCss){
  /* The Gujarati sweep runs on the page markup only — never on CSS or on the
     fitting script, which are Latin by necessity. */
  var ttl = e(title);
  if(bodyCls === 'gu'){ ttl = guSweep(ttl); pages = guSweep(pages); }
  else { ttl = stripEnMarks(ttl); pages = stripEnMarks(pages); }
  return '<!DOCTYPE html><html lang="'+(bodyCls==='gu'?'gu':'en')+'"><head><meta charset="utf-8">'
    + '<title>'+ttl+'</title><style>'+CSS+(extraCss||'')+'</style></head><body class="'+bodyCls+'">'
    + pages + '<!--FIT-->' + AUTOFIT + '</body></html>';
}

/* Universal last-resort guard. `.page` has overflow:hidden, so anything that
   runs past the bottom of `.body` is not merely ugly — it disappears from the
   PDF without a trace, which is how six scorecard line items went missing.
   This runs on every document after any document-specific packer and shrinks
   only the pages that actually overflow. transform:scale is used rather than
   zoom because html2canvas reproduces transform faithfully, while zoom
   corrupts Gujarati advance widths and makes the words overlap. */
var AUTOFIT = '<script>(function(){'
  + 'var MIN=0.60;'
  /* Documents marked data-spill grow a continuation page rather than being
     shrunk. Sections stay whole and a heading is never orphaned from the block
     it introduces. Fixed-length documents (score card, executive summary) are
     not marked and fall through to the scale guard below. */
  + 'if(document.body.hasAttribute("data-spill")){'
    + 'var guard=0;'
    + 'for(var q=0;q<document.querySelectorAll(".page").length && guard++<40;q++){'
      + 'var pgs=document.querySelectorAll(".page"), pg=pgs[q], bd=pg.querySelector(".body");'
      + 'if(!bd || bd.scrollHeight<=bd.clientHeight+1) continue;'
      + 'var np=pg.cloneNode(true), nbd=np.querySelector(".body");'
      + 'while(nbd.firstChild) nbd.removeChild(nbd.firstChild);'
      + 'pg.parentNode.insertBefore(np, pg.nextSibling);'
      + 'var g2=0;'
      + 'while(bd.scrollHeight>bd.clientHeight+1 && bd.children.length>1 && g2++<60){'
        + 'var last=bd.children[bd.children.length-1];'
        + 'nbd.insertBefore(last, nbd.firstChild);'
        + 'var prev=bd.children[bd.children.length-1];'
        + 'if(prev && prev.className && /(^| )sec( |$)/.test(prev.className))'
          + 'nbd.insertBefore(prev, nbd.firstChild);'
      + '}'
      + 'while(nbd.firstChild && nbd.firstChild.className==="grow") nbd.removeChild(nbd.firstChild);'
      + 'if(!nbd.children.length){ np.parentNode.removeChild(np); continue; }'
      + 'if(!bd.querySelector(".grow")){ var sp=document.createElement("div");'
        + 'sp.className="grow"; bd.appendChild(sp); }'
    + '}'
    + 'var live=document.querySelectorAll(".page");'
    + 'for(var r=0;r<live.length;r++){'
      + 'var t2=live[r].querySelector(".pgtot"); if(t2) t2.textContent=live.length;'
      + 'var nm=live[r].querySelector(".pgnum"); if(nm) nm.textContent=(r+1);'
    + '}'
  + '}'
  /* Box text that outgrows its box.
     Several tiles carry a sentence rather than a number — a verdict, a scenario
     comment, a group activity — and at the fixed tile size the words spilled or
     were clipped. Each box is measured and its type stepped down until the text
     fits, which keeps the box geometry identical across the row. */
  + 'var boxes=document.querySelectorAll(".tile .v, .tile .s, .vtile .v, .ir-toc-row b, .dlegend div, .kv .v");'
  + 'for(var q=0;q<boxes.length;q++){ var bx=boxes[q];'
    + 'if(!bx.textContent.trim()) continue;'
    + 'var lim=parseFloat(getComputedStyle(bx).fontSize), guard=0;'
    + 'while((bx.scrollHeight>bx.clientHeight+1 || bx.scrollWidth>bx.clientWidth+1)'
      + ' && lim>5.5 && guard++<24){ lim-=0.5; bx.style.fontSize=lim+"px";'
      + 'bx.style.lineHeight="1.25"; }'
  + '}'
  /* ONE scale for the whole document, not one per page.
     Scaling each page to its own needs made the type size differ from page to
     page — Strengths at full size, Weaknesses a step smaller, and nothing to
     explain why. The tightest page now sets the factor and every page adopts
     it, so the document reads at a single size throughout. */
  /* A document with its own packer has already grown pages and, if it truly had
     to, applied a single scale of its own. Running this pass over it as well
     produced a second, different factor — two type sizes in one document, which
     is the fault this pass exists to prevent. */
  + 'var bs=document.body.hasAttribute("data-fitted") ? []'
    + ' : [].slice.call(document.querySelectorAll(".page > .body"));'
  + 'var need=1;'
  + 'bs.forEach(function(bd){'
    + 'var t=bd.clientHeight; if(!t) return;'
    + 'if(bd.scrollHeight>t+1) need=Math.min(need, t/bd.scrollHeight);'
  + '});'
  + 'if(need<0.999){'
    + 'var Z=Math.max(MIN, Math.floor(need*1000)/1000);'
    + 'bs.forEach(function(bd){'
      + 'if(bd.getAttribute("data-fit")==="1") return;'
      + 'var t=bd.clientHeight; if(!t) return;'
      + 'var w=document.createElement("div");'
      + 'w.style.cssText="display:flex;flex-direction:column;flex:1 1 auto;min-height:0;width:100%";'
      + 'while(bd.firstChild) w.appendChild(bd.firstChild);'
      + 'var outer=document.createElement("div");'
      + 'outer.style.cssText="height:"+t+"px;overflow:hidden;flex:0 0 auto;width:100%";'
      + 'outer.appendChild(w); bd.appendChild(outer);'
      + 'w.style.width=(100/Z)+"%";'
      + 'w.style.transformOrigin="top left";'
      + 'w.style.transform="scale("+Z+")";'
      + 'bd.setAttribute("data-fit","1");'
    + '});'
  + '}'
+ '})();<\/script>';
/* The document title header stays English in every edition, by design. */
function head(p, label){
  /* The company name stays in Latin script — it is a proper noun. The page
     label does not: it is ours, and in the Gujarati edition it is Gujarati. */
  return '<div class="rh"><div class="l en">'+EN(e(S(p.meta.short_name)||S(p.meta.company)))+'</div>'
       + '<div class="r">'+EN(e(label))+'</div></div>';
}
function foot(p, i, total, lang, docName){
  return '<div class="rfw">'
       + '<div class="rfn">'+e(L(lang,'footnote'))+'</div>'
       + '<div class="rf"><div><span>'+EN(e(docName||L('en','doc_report')))+'</span><span class="en"> &nbsp;·&nbsp; '
       + e(dmy(p.meta.analysis_datetime)) + '</span> &nbsp;·&nbsp; ' + e(L(lang,'research_only'))
       + '</div><div class="en"><b class="pgnum">'+i+'</b> / <span class="pgtot">'+total+'</span></div></div>'
       + '</div>';
}
function page(p, i, total, label, inner, lang, docName){
  return '<section class="page">'+head(p,label)+'<div class="body">'+inner+'</div>'
       + foot(p,i,total,lang,docName)+'</section>';
}
function sec(no, title){
  return '<div class="sec"><span class="no en">'+e(no)+'</span><span class="ti">'+e(title)
       + '</span><span class="ln"></span></div>';
}
function tbl(cols, rows, opts){
  opts = opts || {};
  var num = opts.num || [];
  var h = cols.map(function(c,i){ return '<th'+(num.indexOf(i)>=0?' class="n en"':'')+'>'+e(c)+'</th>'; }).join('');
  /* A row whose every cell is empty is a row the payload never filled. Printing
     it produced three ruled lines carrying nothing but a dash under the
     earnings-quality flags — dead space that reads as a rendering fault. Total
     rows are exempt: a zero total is a real answer. */
  var live = rows.filter(function(r){
    if(r && r.__cls) return true;
    var cells = (r && r.cells) || r || [];
    return cells.some(function(c){
      var t = String(c == null ? '' : c).replace(/<[^>]*>/g,'').replace(/&[#A-Za-z0-9]+;/g,' ');
      return t.replace(/[\s\u2014\u2013.\-]/g,'') !== '';
    });
  });
  if(!live.length) return '';
  var b = live.map(function(r){
    var cls = r.__cls ? ' class="'+r.__cls+'"' : '';
    var cells = (r.cells||r).map(function(c,i){
      return '<td'+(num.indexOf(i)>=0?' class="n en"':'')+'>'+(c==null?'—':c)+'</td>'; }).join('');
    return '<tr'+cls+'>'+cells+'</tr>';
  }).join('');
  return '<table'+(opts.cls?' class="'+opts.cls+'"':'')+'><thead><tr>'+h+'</tr></thead><tbody>'
       + b+'</tbody></table>';
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
  ['Valuation','મૂલ્યાંકન',20,
   ['absolute_valuation','peer_valuation','growth_adjusted_valuation','margin_of_safety'],
   ['Absolute Valuation','Peer Valuation','Growth-Adjusted Valuation','Margin Of Safety'],
   ['સંપૂર્ણ મૂલ્યાંકન','સમકક્ષ મૂલ્યાંકન','વૃદ્ધિ-સમાયોજિત મૂલ્યાંકન','સલામતી માર્જિન'],[5,5,5,5]],
  ['Management & Governance','સંચાલન અને ગવર્નન્સ',15,
   ['promoter_track_record','governance','capital_allocation'],
   ['Promoter Track Record','Governance','Capital Allocation'],
   ['પ્રમોટર ટ્રેક રેકોર્ડ','ગવર્નન્સ','મૂડી ફાળવણી'],[5,5,5]],
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
    [L(lang,'issue_period'), e(dmy(m.open_date)||'—')+' — '+e(dmy(m.close_date)||'—')],
    [L(lang,'price_band'), '₹'+e(ipo.price_band||'—')+' · '+L(lang,'issue_at')+' ₹'+n(ipo.issue_price)],
    [L(lang,'issue_size'), cr(ipo.issue_size_cr)+' · '+L(lang,'fresh')+' '+cr(ipo.fresh_cr)+' · OFS '+cr(ipo.ofs_cr)],
    [L(lang,'subscription'), (ipo.subscription&&ipo.subscription.overall!=null? n(ipo.subscription.overall,1)+'×':'—')
      + (ipo.subscription&&ipo.subscription.qib!=null?' · QIB '+n(ipo.subscription.qib,2)+'×':'')
      + (ipo.subscription&&ipo.subscription.retail!=null?' · Retail '+n(ipo.subscription.retail,2)+'×':'')],
    [L(lang,'gmp'), (ipo.gmp&&ipo.gmp.value!=null? '₹'+n(ipo.gmp.value)+' ('+pct(ipo.gmp.pct)+')':'—')+' — '+L(lang,'unofficial')],
    [L(lang,'market_cap'), cr(ipo.market_cap_cr)],
    [L(lang,'promoter_hold'), p.people&&p.people.promoter_holding_pre!=null
        ? pct(p.people.promoter_holding_pre)+' → '+pct(p.people.promoter_holding_post)+' '+L(lang,'post_issue') : '—'],
    [L(lang,'listing'), e(dmy(m.listing_date)||'—')+' · '+e(m.exchanges||'NSE, BSE')]
  ];
  var inner =
    '<div style="height:7mm"></div>'
    + '<div class="eyebrow en">'+EN(e(docTitle))+' &nbsp;·&nbsp; '+e(A(lang,m.ipo_type||'Mainboard'))+' &nbsp;·&nbsp; '+e(L(lang,'india'))+'</div>'
    + '<h1 class="en" style="margin-top:2mm">'+e(m.company||'')+'</h1>'
    + '<div class="mut" style="margin-top:1mm;font-size:8pt">'+sectorHtml(p,lang)
      + (m.sector?' &nbsp;·&nbsp; ':'')+e(dmy(m.analysis_datetime))+'</div>'
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
      /* 4th tile, by request: the grey-market quote, in rupees with the premium
         to the issue price beside it, and flagged on its face as a street
         number rather than an exchange one. */
      + gmpTile(ipo, lang)
      + '<div class="tile"><div class="k">'+e(L(lang,'allocation'))+'</div><div class="v">'
        + e(v.allocation_band||'—')+'</div><div class="s">'+e(L(lang,'of_portfolio'))+'</div></div>'
    + '</div>'
    + sec('01', L(lang,'thesis'))
    + '<div class="lead">'+arr(pick(p,lang,'verdict.thesis', arr(v.thesis))).map(function(t){
        return '<p style="margin-bottom:1.6mm">'+e(t)+'</p>'; }).join('')+'</div>'
    + sec('02', L(lang,'snapshot'))
    + tbl([L(lang,'parameter'), L(lang,'detail')], snap.map(function(r){
        return [ '<span style="color:var(--ink3)">'+e(r[0])+'</span>', '<span class="en">'+r[1]+'</span>' ]; }))
    + '<div class="grow"></div>';
  return page(p, 1, pages, L(lang,'pg_verdict'), inner, lang, docTitle);
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
  escalateLitigation(p);
  linkSegmentsAndProducts(p);
  return p;
}

/* Many issuers publish one revenue split, not two. When only the product list
   carries shares, the segment chart used to come out empty beside a populated
   products table — the same numbers, one of them thrown away. Either side now
   fills from the other. */
function linkSegmentsAndProducts(p){
  var c = p.company || {};
  var segs = arr(c.segments), prods = arr(c.products);
  function hasPct(list){ return list.some(function(x){ return x && x.revenue_pct != null; }); }
  if(!hasPct(segs) && hasPct(prods)){
    c.segments = prods.filter(function(x){ return x.revenue_pct != null; })
      .map(function(x){ return { name:x.name, revenue_pct:x.revenue_pct,
                                 growth_pct:null, note:x.growth_note || x.margin_profile }; });
  } else if(!hasPct(prods) && hasPct(segs) && prods.length === 0){
    c.products = segs.filter(function(x){ return x.revenue_pct != null; })
      .map(function(x){ return { name:x.name, what_it_is:x.note, customers:'',
                                 revenue_pct:x.revenue_pct, growth_note:'',
                                 margin_profile:'Not disclosed' }; });
  }
}

/* A disputed demand worth more than a tenth of net worth is a red flag whether
   or not the model chose to call it one. The app adds it so it cannot be
   talked down, and it is marked as added by the app rather than by the tool. */
function escalateLitigation(p){
  var lit = (p.deep && p.deep.litigation) || {};
  var pctNW = Number(lit.pct_of_net_worth);
  if(!isFinite(pctNW) || pctNW < 10) return;
  p.decision = p.decision || {};
  var flags = p.decision.red_flags = arr(p.decision.red_flags);
  var already = flags.some(function(x){
    return /litigation|dispute|demand|tax|gst/i.test(S(x.flag) + ' ' + S(x.evidence)); });
  if(already) return;
  var total = lit.disputed_total_cr != null ? '₹' + n(lit.disputed_total_cr) + ' cr' : 'The disputed amount';
  flags.unshift({
    flag: 'Disputed demands are large against net worth',
    evidence: total + ' under dispute, ' + n(pctNW, 1) + '% of net worth'
            + (lit.pct_of_pat != null ? ' and ' + n(lit.pct_of_pat, 1) + '% of annual profit' : '')
            + '. Flagged automatically from the litigation record.',
    severity: pctNW >= 25 ? 'CRITICAL' : 'HIGH'
  });
}

/* The 100-point score, rendered once and used by both the company report and
   the institutional report. They had two implementations that drifted apart;
   sharing one means a change lands in both and they cannot disagree again.
   Gauge and block bars on the left, spider on the right, then the line items in
   a two-column grid with the basis carried inline. */
function scoreSection(p, lang){
  var sl = p.score_lines||{};
  var total = 0; BLOCKS.forEach(function(bk){ total += blockScore(p,bk); });
  return '<div style="display:flex;gap:5mm;align-items:center;margin:1mm 0 2.5mm">'
      + '<div style="flex:1;min-width:0">'
        + chartGauge(total, lang)
        + '<div style="margin-top:2mm">'+BLOCKS.map(function(bk){
            var g = blockScore(p,bk);
            return barRow(bName(bk,lang), bk[2]?g/bk[2]*100:0, g.toFixed(1)+' / '+bk[2],
                          ragBar(bk[2]?g/bk[2]*100:0)); }).join('')+'</div>'
      + '</div>'
      + '<div style="flex:0 0 62mm;display:flex;align-items:center">'+chartRadar(p, lang)+'</div></div>'
    + '<div class="sc2col">'+BLOCKS.map(function(bk){
        var items = bItems(bk,lang), g = blockScore(p,bk);
        return '<div class="sc2blk"><div class="sc2hd">'+e(bName(bk,lang))
          + '<span class="en">'+g.toFixed(1)+'/'+bk[2]+'</span></div>'
          + bk[3].map(function(k,i){
              var vv = Number(sl[k])||0, mx = bk[6][i];
              return '<div class="sc2row"><span class="l">'+e(items[i])+'</span>'
                + '<span class="t"><i style="width:'+(mx?vv/mx*100:0).toFixed(0)+'%;background:'
                + ragBarHex(mx?vv/mx*100:0)+'"></i></span>'
                + '<span class="v en">'+vv.toFixed(1)+'<em>/'+mx+'</em></span></div>';
            }).join('') + '</div>';
      }).join('')+'</div>'
    + '<div class="note" style="margin-top:3mm"><b>'+e(L(lang,'how_to_read'))+'</b>'
      + e(L(lang,'how_to_read_b'))+'</div>';
}
/* A group heading, the same one the institutional report uses, so the two
   documents announce their sections identically. */
function grpHead(lang, key){
  return '<div class="ir-grp" style="margin:0 0 3mm"><div class="ir-grph">'
       + e(L(lang, key)) + '</div></div>';
}

function buildReport(p, lang){
  p = safePayload(p);
  lang = lang || 'en';
  var TOT = 10, out = '';
  var m = p.meta||{}, f = p.financials||{}, c = p.company||{}, pe = p.people||{}, d = p.decision||{}, ipo = p.ipo||{};
  out += cover(p, lang, L('en','doc_report'), TOT);

  /* Every derived value used by the sections is declared here, once. The
     sections are emitted in reading order rather than the order they were
     written in, so a declaration sitting just above its own page would be
     read before it was assigned. */
  var sl = p.score_lines||{};
  var segs = arr(c.segments);
  var ind = c.industry||{}, moat = c.moat||{};
  var eq = f.earnings_quality||{}, bs = f.balance_sheet||{};
  var val = f.valuation||{}, peers = f.peers||{}, scn = f.scenarios||{};
  var cases = arr(scn.cases), maxV = Math.max.apply(null, cases.map(function(x){ return Number(x.value_per_share)||0; }).concat([1]));
  var peerCh = chartPeers(p, lang);
  var gov = pe.governance||{};
  var fresh = Number(ipo.fresh_cr)||0, ofs = Number(ipo.ofs_cr)||0, tot = fresh+ofs;
  var fpct = tot? (fresh/tot*100) : 0;
  var cfoBar = '';
  var scTotal = 0; BLOCKS.forEach(function(bk){ scTotal += blockScore(p,bk); });
  /* All 28 line items must be visible on this page. The previous layout —
     a bar per item stacked under a bar per block — ran past the bottom of the
     page and six items were silently cut off. This is a two-column compact
     grid that fits with room to spare. */
  out += page(p, 2, TOT, L(lang,'pg_the_ipo'), grpHead(lang,'irg_ipo') + sec('03', L(lang,'issue_struct'))
    + '<div style="display:flex;gap:6mm;align-items:center;margin-bottom:3mm">'
      /* was a CSS conic-gradient, which html2canvas draws as nothing — every
         exported PDF and PNG had a blank circle here. SVG rasterises. */
      + chartDonut([{ value:fresh, colour:PAL5_HEX[3] }, { value:ofs, colour:PAL5_HEX[4] }],
                   { size:112, centre:pct(fpct,0), centreSub:L(lang,'fresh_issue') })
      + '<div class="dlegend"><div><i style="background:var(--s5-4)"></i><b>'+e(L(lang,'fresh_issue'))+'</b> <span class="en">'+cr(fresh)+' · '+pct(fpct,1)+'</span></div>'
      + '<div><i style="background:var(--s5-5)"></i><b>'+e(L(lang,'ofs'))+'</b> <span class="en">'+cr(ofs)+' · '+pct(100-fpct,1)+'</span></div>'
      + '<div style="margin-top:1.5mm;color:var(--ink3)">'+e(L(lang,'total'))+' <span class="en">'+cr(tot)+' · '+L(lang,'lot')+' '+n(ipo.lot_size)
      + ' '+L(lang,'shares_min')+' ₹'+n(ipo.min_investment)+'</span></div></div><div style="flex:1"></div></div>'
    + '<div class="note'+(/exit/i.test(S(ipo.structure_verdict))?' bad':'')+'">'
      + '<b>'+e(ipo.structure_verdict? A(lang, tr(p,lang,ipo.structure_verdict)) : '—')+'</b>'+e(pick(p,lang,'ipo.structure_note', ipo.structure_note))+'</div>'
    + sec('04', L(lang,'money_goes'))
    + tbl([L(lang,'use_proceeds'),L(lang,'rs_crore'),L(lang,'assessment')], arr(ipo.objects).map(function(o){
        return { cells:[e(tr(p,lang,o.use)), n(o.amount_cr,2), '<span class="mut">'+e(tr(p,lang,o.verdict))+'</span>'] }; }), { num:[1] })
    + sec('05', L(lang,'who_selling'))
    + tbl([L(lang,'seller'),L(lang,'type'),L(lang,'rs_crore')], arr(ipo.selling_shareholders).map(function(x){
        return { cells:['<span class="en">'+e(x.name)+'</span>', e(tr(p,lang,x.type)), n(x.amount_cr,2)] }; }), { num:[2] })
    + sec('06', L(lang,'anchors'))
    + tbl([L(lang,'anchor'),L(lang,'type'),L(lang,'rs_crore')], arr((ipo.anchors||{}).top).map(function(x){
        return { cells:['<span class="en">'+e(x.name)+'</span>', e(tr(p,lang,x.type)),
                 x.amount_cr==null?L(lang,'not_disclosed'):n(x.amount_cr,2)] }; }), { num:[2] })
    + '<div class="mut" style="margin-top:1.5mm">'+e(L(lang,'anchor_total'))+' <span class="en">'
      + cr((ipo.anchors||{}).total_cr)+'</span> · '+e(L(lang,'lockin'))+' '+e((ipo.anchors||{}).lockin||'—')+'. '
      + e(tr(p,lang,(ipo.anchors||{}).note||''))+' '+e(L(lang,'anchor_caveat'))+'</div>'
    + '<div class="grow"></div>', lang);

  /* The signals that do not need the prospectus — credit, litigation exposure,
     cash conversion, and what the issue structure says about intent. */
  var kdp = p.deep||{}, klit = kdp.litigation||{}, kcr = kdp.credit||{},
      kis = kdp.issue_structure||{}, kcf = (p.financials||{}).cash_flow||{},
      kcfk = kcf.kpis||{}, kdvg = kcf.divergence||{}, kcn = kdp.concentration||{};
  var kpiRows = [];
  function kpiRow(label, value, tone, note){
    if(value == null || value === '') return;
    kpiRows.push({ cells:[e(label), '<b class="en" style="color:'
      + (tone==='bad'?'var(--s5-1)':tone==='warn'?'var(--s5-3)':tone==='good'?'var(--s5-4)':'var(--ink)')
      + '">'+value+'</b>', '<span class="mut">'+e(note||'')+'</span>'] });
  }
  kpiRow(L(lang,'rating_lbl'), S(kcr.rating)||null, 'plain', A(lang,kcr.outlook));
  kpiRow(L(lang,'disputed_total'), klit.disputed_total_cr!=null? cr(klit.disputed_total_cr):null,
         Number(klit.pct_of_net_worth)>=10?'bad':'plain',
         klit.pct_of_net_worth!=null? pct(klit.pct_of_net_worth,1)+' '+L(lang,'pct_net_worth'):'');
  (arr(kcfk.cfo_pat).slice(-1)).forEach(function(x){
    kpiRow(L(lang,'cfo_pat'), pct(x.value,0), Number(x.value)<60?'bad':Number(x.value)<85?'warn':'good', S(x.year)); });
  kpiRow(L(lang,'divergence'), S(kdvg.flag)? A(lang,kdvg.flag):null,
         /serious/i.test(S(kdvg.flag))?'bad':/watch/i.test(S(kdvg.flag))?'warn':'good', '');
  kpiRow(L(lang,'cashout'), kis.promoter_cashout_pct!=null? pct(kis.promoter_cashout_pct,1):null,
         Number(kis.promoter_cashout_pct)>=70?'bad':'plain', '');
  kpiRow(L(lang,'cost_of_acq'), (kis.promoter_cost_of_acquisition||{}).multiple!=null
         ? n(kis.promoter_cost_of_acquisition.multiple,1)+'x' : null, 'plain',
         tr(p,lang,(kis.promoter_cost_of_acquisition||{}).note));
  kpiRow(L(lang,'wc_intensity'), arr(kcr.wc_intensity).length
         ? pct(arr(kcr.wc_intensity).slice(-1)[0].nwc_pct_of_income,1) : null, 'plain', '');
  kpiRow(L(lang,'top10_customers'), arr(kcn.customers).length
         ? pct(arr(kcn.customers).slice(-1)[0].top10_pct,1) : null, 'plain', '');
  if(kpiRows.length){
    /* The page-total in every footer is corrected by the packer at render time,
       so appending a page here does not leave page 1 saying "of 10". */
    TOT = 11;
    out += page(p, 3, TOT, L(lang,'pg_signals'), sec('07', L(lang,'ir_issue_kpi'))
      + tbl([L(lang,'parameter'), L(lang,'value_lbl'), L(lang,'note')], kpiRows, { num:[1] })
      + '<div class="grow"></div>', lang);
  }


  out += page(p, 4, TOT, L(lang,'pg_company'), grpHead(lang,'irg_company') + sec('08', L(lang,'what_does'))
    + '<div class="lead">'+e(pick(p,lang,'company.what_it_does', c.what_it_does))+'</div>'
    + '<div class="grid2" style="margin-top:3mm">'
      + '<div><div class="eyebrow">'+e(L(lang,'how_earns'))+'</div><div class="mut" style="font-size:7.4pt;margin-top:1mm">'
        + e(pick(p,lang,'company.how_it_earns', c.how_it_earns))+'</div></div>'
      + '<div><div class="eyebrow">'+e(L(lang,'why_stay'))+'</div><div class="mut" style="font-size:7.4pt;margin-top:1mm">'
        + e(pick(p,lang,'company.why_customers_stay', c.why_customers_stay))+'</div></div></div>'
    + sec('09', L(lang,'rev_mix'))
    + segs.map(function(s,si){ return barRow(tr(p,lang,s.name), Number(s.revenue_pct)||0,
        pct(s.revenue_pct,1), PAL5[si % 5]); }).join('')
    + tbl([L(lang,'segment'),L(lang,'share_pc'),L(lang,'growth'),L(lang,'note')], segs.map(function(s){
        return { cells:[e(tr(p,lang,s.name)), pct(s.revenue_pct,1), s.growth_pct==null?'—':pct(s.growth_pct,1),
                 '<span class="mut">'+e(tr(p,lang,s.note))+'</span>'] }; }), { num:[1,2] })
    + (arr(c.products).length ? sec('10', L(lang,'ir_products'))
        + tbl([L(lang,'product'),L(lang,'what_it_is'),L(lang,'customers'),L(lang,'rev_share'),L(lang,'margin_profile')],
            arr(c.products).map(function(x){
              return { cells:['<b>'+e(tr(p,lang,x.name))+'</b>',
                       '<span class="mut">'+e(tr(p,lang,x.what_it_is))+'</span>',
                       '<span class="mut">'+e(tr(p,lang,x.customers))+'</span>',
                       x.revenue_pct!=null? pct(x.revenue_pct,1):'—',
                       '<span class="mut">'+e(A(lang,x.margin_profile))+'</span>'] }; }), { num:[3] }) : '')
    + sec('11', L(lang,'op_metrics'))
    + '<div class="grid4">'+arr(c.operating_metrics).slice(0,8).map(function(x){
        return '<div class="kv"><div class="k">'+e(tr(p,lang,x.label))+'</div><div class="v en">'+e(x.value)+'</div></div>';
      }).join('')+'</div>'
    + '<div class="grow"></div>', lang);

  out += page(p, 5, TOT, L(lang,'pg_industry'), sec('12', L(lang,'industry'))
    + '<div class="grid3" style="margin-bottom:3mm">'
      + '<div class="kv"><div class="k">'+e(L(lang,'classification'))+'</div><div class="v" style="font-size:9.5pt">'+e(A(lang,ind.classification)||'—')+'</div></div>'
      + '<div class="kv"><div class="k">'+e(L(lang,'pricing_power'))+'</div><div class="v" style="font-size:9.5pt;color:'
        + ragHex(ind.pricing_power,'quality')+'">'+e(A(lang,ind.pricing_power)||'—')+'</div></div>'
      + '<div class="kv"><div class="k">'+e(L(lang,'moat_rating'))+'</div><div class="v" style="font-size:9.5pt;color:'
        + ragHex(moat.rating,'quality')+'">'+e(A(lang,moat.rating)||'—')+'</div></div></div>'
    + '<div class="lead">'+e(pick(p,lang,'company.industry_growth_note', ind.growth_note))+'</div>'
    + '<div class="eyebrow" style="margin-top:3mm">'+e(L(lang,'drivers'))+'</div>'
    + '<ul class="blist" style="margin-top:1mm">'+arr(pick(p,lang,'company.drivers', arr(ind.drivers))).map(function(x){
        return '<li>'+e(x)+'</li>'; }).join('')+'</ul>'
    + (ind.market_share_note?'<div class="note" style="margin-top:2mm">'+e(tr(p,lang,ind.market_share_note))+'</div>':'')
    + sec('13', L(lang,'comp_adv'))
    + tbl([L(lang,'source_adv'),L(lang,'verdict'),L(lang,'evidence')], arr(moat.sources).map(function(x){
        return { cells:[e(tr(p,lang,x.source)),
          ragPill(x.verdict, lang), '<span class="mut">'+e(tr(p,lang,x.evidence))+'</span>'] }; }))
    + (moat.note?'<div class="note" style="margin-top:2mm">'+e(pick(p,lang,'company.moat_note', moat.note))+'</div>':'')
    + '<div class="grow"></div>', lang);

  out += page(p, 6, TOT, L(lang,'pg_promoters'), grpHead(lang,'irg_promoters') + sec('14', L(lang,'promoters'))
    + (pe.has_promoter===false
        ? '<div class="note bad"><b>'+e(L(lang,'no_promoter'))+'</b>'+e(L(lang,'no_promoter_b'))+'</div>'
        : '<div class="mut" style="margin-bottom:2mm">'+e(L(lang,'holding_pre'))+' <span class="en">'
          + pct(pe.promoter_holding_pre)+'</span> '+e(L(lang,'before_issue'))+', <span class="en">'
          + pct(pe.promoter_holding_post)+'</span> '+e(L(lang,'after_'))+'.</div>')
    + tbl([L(lang,'name_'),L(lang,'role_'),L(lang,'background')], arr(pe.promoters).map(function(x){
        return { cells:['<b class="en">'+e(x.name)+'</b>', e(tr(p,lang,x.role)), '<span class="mut">'+e(tr(p,lang,x.background))+'</span>'] }; }))
    + sec('15', L(lang,'bg_checks'))
    + tbl([L(lang,'check_'),L(lang,'finding'),L(lang,'standard')], arr(pe.due_diligence).map(function(x){
        return { cells:[e(tr(p,lang,x.check)), '<span class="mut">'+e(tr(p,lang,x.finding))+'</span>',
          ragPill(x.standard, lang, 'status')] }; }))
    + '<div class="mut" style="margin-top:1.5mm">'+e(pick(p,lang,'people.dd_note', pe.dd_note))+'</div>'
    + sec('16', L(lang,'governance')+' — '+n(gov.score_10,1)+' / 10')
    + tbl([L(lang,'parameter'),L(lang,'finding'),L(lang,'flag_')], arr(gov.items).map(function(x){
        return { cells:[e(tr(p,lang,x.parameter)), '<span class="mut">'+e(tr(p,lang,x.finding))+'</span>',
          ragPill(x.flag, lang, 'risk')] }; }))
    + '<div class="grow"></div>', lang);

  out += page(p, 7, TOT, L(lang,'pg_financials'), grpHead(lang,'irg_financials') + sec('17', L(lang,'three_yr'))
    + chartFinancials(p, lang)
    + tbl([L(lang,'rs_crore')].concat(arr(f.years)).concat([L(lang,'trend')]), arr(f.rows).map(function(r){
        return { __cls: r.highlight?'hi':'', cells:[e(tr(p,lang,r.label))]
          .concat(arr(r.values).map(function(x){ return typeof x==='number'? n(x, Math.abs(x)<100?2:0) : e(x); }))
          .concat(['<span class="mut">'+e(tr(p,lang,r.trend))+'</span>']) }; }), { num:[1,2,3] })
    + (f.note?'<div class="mut" style="margin-top:1.5mm">'+e(tr(p,lang,f.note))+'</div>':'')
    + sec('18', L(lang,'key_ratios'))
    + '<div class="grid4">'+arr(f.ratios).slice(0,8).map(function(r){
        return '<div class="kv"><div class="k">'+e(tr(p,lang,r.label))+'</div><div class="v en '+toneClass(r.tone)+'">'
          + e(r.value)+'</div><div class="s">'+e(tr(p,lang,r.direction))+'</div></div>'; }).join('')+'</div>'
    + '<div class="grow"></div>', lang);

  if(eq.cfo_pat != null){
    var cv = Number(eq.cfo_pat);
    cfoBar = barRow('CFO / PAT', Math.min(100, cv/1.5*100), cv.toFixed(2)+'×',
                    ragBar(Math.min(100, cv/1.5*100)), 66.7);
  }
  out += page(p, 8, TOT, L(lang,'pg_cash'), sec('19', L(lang,'profit_cash'))
    + '<div class="grid3" style="margin-bottom:3mm">'
      + '<div class="kv"><div class="k">'+e(L(lang,'earn_quality'))+'</div><div class="v" style="font-size:9.5pt;color:'
        + ragHex(eq.rating,'quality')+'">'+e(A(lang,eq.rating)||'—')+'</div></div>'
      + '<div class="kv"><div class="k en">CFO / PAT</div><div class="v en '+(eq.cfo_pat!=null&&eq.cfo_pat<0.7?'tn-bad':'tn-good')+'">'
        + (eq.cfo_pat==null?'—':Number(eq.cfo_pat).toFixed(2)+'×')+'</div></div>'
      + '<div class="kv"><div class="k en">FCF / PAT</div><div class="v en '+(eq.fcf_pat!=null&&eq.fcf_pat<0?'tn-bad':'')+'">'
        + (eq.fcf_pat==null?'—':Number(eq.fcf_pat).toFixed(2)+'×')+'</div></div></div>'
    + cfoBar + (cfoBar?'<div class="mut" style="margin-bottom:2mm">'+e(L(lang,'cfo_marker'))+'</div>':'')
    /* The derived cash flow the institutional report carries belongs here too:
       this is the page about profit versus cash, and it was showing ratios with
       none of the cash flow they come from. */
    + (function(){
        var cf = f.cash_flow||{}, rows = arr(cf.rows), k = cf.kpis||{}, dv = cf.divergence||{};
        if(!rows.length && !S(dv.flag)) return '';
        return (rows.length
            ? tbl([L(lang,'line_item')].concat(arr(f.years).length?arr(f.years):['FY24','FY25','FY26']),
                rows.map(function(x){
                  var v = arr(x.values);
                  return { __cls:x.highlight?'hi':'',
                           cells:[e(tr(p,lang,x.label)), n(v[0],2), n(v[1],2), n(v[2],2)] }; }),
                { num:[1,2,3] })
            : '')
          + (arr(k.cfo_pat).length
            ? '<div class="grid3" style="margin:2mm 0">'+arr(k.cfo_pat).slice(-3).map(function(x){
                return '<div class="kv"><div class="k en">'+e(S(x.year))+' '+e(L(lang,'cfo_pat'))
                  + '</div><div class="v" style="color:'+ragBar(x.value)+'">'+pct(x.value,0)+'</div></div>';
              }).join('')+'</div>' : '')
          + (S(dv.flag) ? '<div class="note'+(/serious/i.test(S(dv.flag))?' bad':'')+'"><b>'
              + e(L(lang,'divergence'))+' — '+e(A(lang,dv.flag))+'</b> '+e(tr(p,lang,dv.note))+'</div>' : '')
          + (S(cf.funding_verdict) ? '<div class="note"><b>'+e(L(lang,'funding_verdict'))+' — '
              + e(A(lang,cf.funding_verdict))+'</b> '+e(tr(p,lang,cf.funding_note))+'</div>' : '');
      })()
    + (arr(pick(p,lang,'financials.eq_flags', arr(eq.flags))).length
        ? '<ul class="blist">'+arr(pick(p,lang,'financials.eq_flags', arr(eq.flags))).map(function(x){
            return '<li>'+e(x)+'</li>'; }).join('')+'</ul>' : '')
    + '<div class="note'+(eq.rating==='Low'||eq.rating==='Red flag'?' bad':'')+'" style="margin-top:2mm">'
      + e(pick(p,lang,'financials.earnings_quality_note', eq.note))+'</div>'
    + sec('20', L(lang,'bal_sheet'))
    + '<div class="eyebrow" style="margin-bottom:1.5mm">'+e(L(lang,'rating'))+': <span style="color:'
      + ragHex(bs.rating,'quality')+'">'+e(A(lang,bs.rating)||'—')+'</span></div>'
    + tbl([L(lang,'item'),L(lang,'position')], arr(bs.items).map(function(x){
        return { cells:[e(tr(p,lang,x.label)), '<span class="en '+toneClass(x.tone)+'">'+e(tr(p,lang,x.value))+'</span>'] }; }))
    + '<div class="grow"></div>', lang);

  out += page(p, 9, TOT, L(lang,'pg_valuation'), grpHead(lang,'irg_valuation') + sec('21', L(lang,'valuation_at'))
    + (peerCh ? '<div class="mut" style="margin-bottom:1mm">'+e(L(lang,'pe_compare'))+'</div>'+peerCh : '')
    + '<div class="eyebrow" style="margin-bottom:1.5mm">'+e(L(lang,'verdict'))+': <span style="color:'
      + ragHex(val.verdict)+'">'+e(A(lang,val.verdict)||'—')+'</span></div>'
    + tbl([L(lang,'multiple'),L(lang,'value'),L(lang,'denom')], arr(val.multiples).map(function(x){
        return { cells:['<span class="en">'+e(tr(p,lang,x.label))+'</span>', '<b class="en">'+e(x.value)+'</b>',
          '<span class="mut">'+e(tr(p,lang,x.basis))+(x.label_tag?' <i style="font-style:normal;color:var(--teal)">['+e(tr(p,lang,x.label_tag))+']</i>':'')+'</span>'] };
      }), { num:[1] })
    + (val.note?'<div class="note" style="margin-top:2mm">'+e(pick(p,lang,'financials.valuation_note', val.note))+'</div>':'')
    + sec('22', L(lang,'peers'))
    + tbl(arr(peers.columns), arr(peers.rows).map(function(r){
        return { __cls: r.is_subject?'hi':'', cells: arr(r.cells).map(function(x){ return '<span class="en">'+e(x)+'</span>'; }) };
      }), { num:[1,2,3,4,5,6,7,8] })
    + (peers.note?'<div class="mut" style="margin-top:1.5mm">'+e(pick(p,lang,'financials.peers_note', peers.note))+'</div>':'')
    + sec('23', L(lang,'scenarios')+(scn.horizon?' '+L(lang,'to_')+' '+scn.horizon:''))
    + cases.map(function(x){
        var col = x.case==='Bear'?'var(--s5-1)':x.case==='Bull'?'var(--s5-5)':'var(--s5-3)';
        return barRow(A(lang,S(x.case)), (Number(x.value_per_share)||0)/maxV*100, '₹'+n(x.value_per_share), col); }).join('')
    + tbl([L(lang,'case_'),L(lang,'val_share'),L(lang,'vs_issue'),L(lang,'vs_listing'),L(lang,'key_assum')],
        cases.map(function(x){
          var c1 = (Number(x.vs_issue_pct)||0) < 0 ? 'var(--s5-1)' : 'var(--s5-5)';
          var c2 = (Number(x.vs_listing_pct)||0) < 0 ? 'var(--s5-1)' : 'var(--s5-5)';
          return { cells:['<b>'+e(A(lang,x.case))+'</b>', '₹'+n(x.value_per_share),
            '<span style="color:'+c1+'">'+pct(x.vs_issue_pct,0)+'</span>',
            '<span style="color:'+c2+'">'+pct(x.vs_listing_pct,0)+'</span>',
            '<span class="mut">'+e(tr(p,lang,x.assumption))+'</span>'] }; }), { num:[1,2,3] })
    + '<div class="mut" style="margin-top:1.5mm">'+e(pick(p,lang,'financials.scenarios_note', scn.note))
      + ' '+e(L(lang,'scen_caveat'))+'</div>'
    + sec('24', L(lang,'listing_assess'))
    + tbl([L(lang,'component'),L(lang,'max'),L(lang,'score'),L(lang,'basis')],
        arr((ipo.listing_gain||{}).components).map(function(x){
          return { cells:[e(tr(p,lang,x.factor)), n(x.max), '<b>'+n(x.score,0)+'</b>', '<span class="mut">'+e(tr(p,lang,x.note))+'</span>'] }; })
        .concat([{ __cls:'tot', cells:[L(lang,'lg_score'),'100','<b>'+n((ipo.listing_gain||{}).score,0)+'</b>','' ] }]),
        { num:[1,2] })
    + ((ipo.listing_gain||{}).verdict?'<div class="note" style="margin-top:2mm">'+e(tr(p,lang,ipo.listing_gain.verdict))+'</div>':'')
    + '<div class="grow"></div>', lang);

  out += page(p, 10, TOT, L(lang,'pg_decision'), grpHead(lang,'irg_risks') + sec('25', L(lang,'str_weak'))
    + swotGrid(p, lang, 5)
    + sec('26', L(lang,'red_flags'))
    + tbl([L(lang,'red_flag'),L(lang,'evidence'),L(lang,'severity')], arr(d.red_flags).map(function(x,i){
        var g = arr(pick(p,lang,'decision.red_flags', []))[i]||{};
        return { cells:['<b>'+e(safeTr(S(x.flag), S(g.flag)||S(x.flag)))+'</b>', '<span class="mut">'+e(safeTr(S(x.evidence), S(g.evidence)||S(x.evidence)))+'</span>',
          '<span class="pill '+sevClass(x.severity)+'">'+e(A(lang,x.severity))+'</span>'] }; }))
    + sec('27', L(lang,'monitoring'))
    + tbl([L(lang,'metric'),L(lang,'current'),L(lang,'desired'),L(lang,'warning')], arr(d.monitoring).map(function(x){
        return { cells:[e(tr(p,lang,x.metric)), '<b class="en">'+e(tr(p,lang,x.current))+'</b>',
                 '<span class="mut">'+e(tr(p,lang,x.desired))+'</span>',
                 '<span class="mut">'+e(tr(p,lang,x.warning))+'</span>'] }; }), { num:[1] })
    + sec('28', L(lang,'alloc_levels'))
    + '<div class="grid2"><div>'
      + tbl([L(lang,'action'),L(lang,'price'),L(lang,'rationale')], levelsOf(p,lang,d).map(function(x){
          return { cells:[e(tr(p,lang,x.action)), '<b class="en">'+e(x.price)+'</b>', '<span class="mut">'+e(tr(p,lang,x.rationale))+'</span>'] }; }), { num:[1] })
      + '</div><div class="note"><b>'+e(L(lang,'sugg_alloc'))+': '+e((p.verdict||{}).allocation_band||'—')+'</b>'
      + e(pick(p,lang,'decision.allocation_note', d.allocation_note))+'</div></div>'
    + (d.watch_number ? '<div class="note good" style="margin-top:3mm"><b>'+e(L(lang,'watch_one'))+' — '
        + e(pick(p,lang,'decision.watch_number.title', d.watch_number.title))+'</b>'
        + e(pick(p,lang,'decision.watch_number.body', d.watch_number.body))+'</div>' : '')
    + (arr(klit.matters).length ? sec('29', L(lang,'ir_litigation'))
        + tbl([L(lang,'forum'), L(lang,'matter'), L(lang,'amount'), L(lang,'status')],
              arr(klit.matters).map(function(x){
                return { cells:['<span class="en">'+e(S(x.forum))+'</span>',
                         '<span class="mut">'+e(tr(p,lang,x.matter))+'</span>',
                         '<b class="en">'+cr(x.amount_cr)+'</b>',
                         '<span class="mut">'+e(A(lang,x.status))+'</span>'] }; }), { num:[2] })
          + (S(klit.verdict)? '<div class="note" style="margin-top:2mm">'+e(tr(p,lang,klit.verdict))+'</div>' : '')
      : '')
    + '<div class="grow"></div>'
    + '<div class="mut" style="border-top:.6pt solid var(--rule);padding-top:2mm">'
      + '<b>'+e(L(lang,'sources'))+'.</b> '+e(L(lang,'primary'))+': <span class="en">'
      + arr((p.sources||{}).primary).map(e).join(' · ')+'</span>. '+e(L(lang,'secondary'))+': <span class="en">'
      + arr((p.sources||{}).secondary).map(e).join(' · ')+'</span>'
      + (arr((p.sources||{}).missing).length ? '. <b>'+e(L(lang,'missing'))+':</b> '
          + arr(p.sources.missing).map(function(x){ return e(tr(p,lang,x)); }).join(' · ') : '') + '.</div>', lang);


  out += page(p, 11, TOT, L(lang,'pg_scorecard'), sec('30', L(lang,'score_100'))
    + scoreSection(p, lang)
    + '<div class="grow"></div>', lang);

  return shell(S(m.company)+' — IPO Company Research Report', lang==='gu'?'gu':'', out)
         .replace('<body class=', '<body data-spill="1" class=');
}

/* ======================= EXECUTIVE SUMMARY ======================= */
function buildExec(p, lang){
  p = safePayload(p);
  lang = lang || 'en';
  var TOT = 4, out = '', f = p.financials||{}, d = p.decision||{}, m = p.meta||{};
  out += cover(p, lang, L('en','doc_exec'), TOT);

  out += page(p, 2, TOT, L(lang,'pg_numbers'), sec('03', L(lang,'three_yr'))
    + chartFinancials(p, lang)
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
    + chartPeers(p, lang)
    + tbl(arr((f.peers||{}).columns), arr((f.peers||{}).rows).map(function(r){
        return { __cls:r.is_subject?'hi':'', cells:arr(r.cells).map(function(x){ return '<span class="en">'+e(x)+'</span>'; }) };
      }), { num:[1,2,3,4,5,6,7,8] })
    + '<div class="grow"></div>', lang);

  var cases = arr((f.scenarios||{}).cases);
  var maxV = Math.max.apply(null, cases.map(function(x){ return Number(x.value_per_share)||0; }).concat([1]));
  out += page(p, 3, TOT, L(lang,'pg_risk'), sec('07', L(lang,'str_weak'))
    + swotGrid(p, lang, 4)
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

  out += page(p, 4, TOT, L(lang,'pg_decision'), sec('10', L(lang,'recommendation'))
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
    + '<div class="grow"></div>', lang);

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
/* Full four-quadrant SWOT for the two long reports. Strengths and weaknesses
   keep their rich title/evidence pairs; opportunities and threats use
   decision.swot when the model supplied it and otherwise fall back to
   catalysts and failure modes, which carry the same meaning. */
function swotRich(p, lang, cap){
  cap = cap || 4;
  var d = p.decision||{}, sw = d.swot||{};
  var gsw = ((p.gu||{}).decision||{}).swot||{};
  function pair(enList, keyA, keyB, path){
    var g = arr(pick(p, lang, path, arr(enList)));
    return arr(enList).slice(0, cap).map(function(en, i){
      var x = g[i] || {};
      return { t: safeTr(S(en[keyA]), S(x[keyA])||S(tr(p,lang,en[keyA]))),
               e: safeTr(S(en[keyB]), S(x[keyB])||S(tr(p,lang,en[keyB]))) };
    });
  }
  function plain(en, gu){
    var src = arr(en);
    if(!src.length) return null;
    var g = lang==='gu' ? arr(gu) : [];
    return src.slice(0, cap).map(function(s, i){
      var t = lang==='gu' ? (S(g[i]) ? safeTr(S(s), S(g[i])) : S(tr(p,lang,s))) : S(s);
      return { t: t, e: '' };
    });
  }
  return {
    s: pair(arr(d.strengths),  'title', 'evidence', 'decision.strengths'),
    w: pair(arr(d.weaknesses), 'title', 'evidence', 'decision.weaknesses'),
    o: plain(sw.opportunities, gsw.opportunities)
       || pair(arr(d.catalysts), 'catalyst', 'mechanism', 'decision.catalysts'),
    t: plain(sw.threats, gsw.threats)
       || pair(arr(d.failure_modes), 'scenario', 'warning_sign', 'decision.failure_modes')
  };
}
function swotGrid(p, lang, cap){
  var q = swotRich(p, lang, cap);
  function panel(title, items, col){
    return '<div><div class="eyebrow" style="color:'+col+'">'+e(title)+'</div>'
      + '<ul class="blist" style="margin-top:1mm">'
      + arr(items).map(function(x){
          return '<li>'+(x.t?'<b>'+e(x.t)+'</b>':'')+(x.t&&x.e?' — ':'')+(x.e?e(x.e):'')+'</li>';
        }).join('')
      + '</ul></div>';
  }
  return '<div class="grid2 swotg">'
    + panel(L(lang,'strengths'),     q.s, 'var(--s5-5)')
    + panel(L(lang,'weaknesses'),    q.w, 'var(--s5-1)')
    + panel(L(lang,'opportunities'), q.o, 'var(--s5-4)')
    + panel(L(lang,'threats'),       q.t, 'var(--s5-2)')
    + '</div>';
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
         + '<div class="vfoot"><span>'+e(L(lang,'research_only'))+'</span>'
         + '<span class="en"><b>'+i+' / 2</b></span></div></div>';
  }
  var topObject = arr(ipo.objects).slice().sort(function(a,b){
    return (Number(b.amount_cr)||0)-(Number(a.amount_cr)||0); })[0];
  var objText = arr(ipo.objects).slice(0,3).map(function(o){
    return tr(p,lang,o.use)+' '+cr(o.amount_cr); }).join('  ·  ');

  var p1 = '<div class="vpage">'
    + vmast(sectorText(p,lang)+' · '+A(lang,S(m.ipo_type||'Mainboard'))+' IPO',
        'IPO Company Research<br><b style="color:#12161C">'+e(dmy(m.analysis_datetime))+'</b><br>Page 1 of 2')
    + '<div class="vhero"><div class="h">'+e(L(lang,'verdict_h'))+'</div><div class="c">'
      + '<div class="v">'+e(pick(p,lang,'verdict.headline', v.headline))+'</div>'
      + '<p>'+e(pick(p,lang,'verdict.one_liner', v.one_liner))+'</p></div></div>'
    + '<div class="vtiles">'
      + [['ipo_quality','/100'],['long_term','/100'],['listing_gain','/100']].map(function(t){
          return '<div class="vtile"><div class="k">'+e(L(lang,t[0]))+'</div><div class="v en" style="color:'
            + ragBar(sc[t[0]])+'">'+n(sc[t[0]],1)+'<small>'+t[1]+'</small></div>'
            + '<div class="s">'+e(A(lang, (v.score_bands||{})[t[0]]||bandOf(sc[t[0]])))+'</div></div>'; }).join('')
      + '<div class="vtile"><div class="k">'+e(L(lang,'gmp'))+'</div><div class="v en" style="color:var(--teal)">'
        + ((ipo.gmp&&ipo.gmp.value!=null)? '₹'+n(ipo.gmp.value)
             + ((ipo.gmp.pct!=null)? '<small> ('+pct(ipo.gmp.pct,1)+')</small>' : '') : '—')
        + '</div><div class="s">'+e(L(lang,'unoff_unver'))+'</div></div>'
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
        + pct((ipo.gmp||{}).pct)+' · '+L(lang,'unoff_unver')+'</div></div></div>'
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
        'IPO Company Research<br><b style="color:#12161C">'+e(dmy(m.analysis_datetime))+'</b><br>Page 2 of 2')
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
        return '<div class="vbar"><div class="l">'+e(A(lang,x.case))+'</div><div class="t"><div class="f" style="width:'
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

  var vttl = e(m.company||'')+' — Investment Summary';
  if(lang === 'gu'){ vttl = guSweep(vttl); p1 = guSweep(p1); p2 = guSweep(p2); }
  else { vttl = stripEnMarks(vttl); p1 = stripEnMarks(p1); p2 = stripEnMarks(p2); }
  return '<!DOCTYPE html><html lang="'+(lang==='gu'?'gu':'en')+'"><head><meta charset="utf-8">'
    + '<title>'+vttl+'</title><style>'+CSS+VCSS+'</style></head>'
    + '<body class="'+(lang==='gu'?'gu':'')+'" style="background:#E9E7E1">'+p1+p2
    + '<script>(function(){' +
      '/* Fit each page to A4. Gujarati runs longer than English, so this is what' +
      ' keeps the two-page limit rather than hoping the translation happens to fit.' +
      ' The CONTENT is scaled, never the sheet: zooming the page box itself made' +
      ' the exported PNG narrower than A4, so pages came out at different widths' +
      ' and messaging apps stretched them. */' +
      '/* The floor was 0.66, which was not low enough for Gujarati: page 1 needed'
      + ' about 0.61 and was clamped, so the surplus was clipped by the wrapper'
      + ' and the last lines of the objective simply vanished. Losing text is'
      + ' worse than small text, so the floor is lower and a second measurement'
      + ' below confirms what actually fits. */' +
      'var MIN=0.50;' +
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
          '/* Measure again. The first pass scales on the natural height, but a'
          + ' narrower box re-wraps its text and can grow taller than predicted,'
          + ' so one correction is applied where it still does not fit. */' +
          'for(var t=0;t<4 && w.scrollHeight*z>target+1;t++){' +
            'z=Math.max(MIN, Math.floor((target/w.scrollHeight)*1000)/1000);' +
            'w.style.width=(100/z)+"%";' +
            'w.style.transform="scale("+z+")";' +
          '}' +
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
  /* A bar before the mark, on the five-step scale, so the shape of the score is
     readable before the number is. Column widths are fixed in CSS rather than
     sized to content, because every block was otherwise auto-sizing its own and
     the SCORE column landed in a different place in each one. */
  return sec('', bName(b,lang)+' — '+got.toFixed(1)+' / '+b[2])
    + tbl([L(lang,'line_item'),'',L(lang,'score'),L(lang,'max'),L(lang,'basis')], b[3].map(function(k,i){
        var val = Number(sl[k])||0, mx = b[6][i], pcv = mx ? val/mx*100 : 0;
        return { cells:[e(items[i]),
                        '<span class="scbar"><i style="width:'+pcv.toFixed(0)+'%;background:'
                          + ragBarHex(pcv)+'"></i></span>',
                        '<b class="en">'+val.toFixed(1)+'</b>',
                        '<span class="en">'+mx+'</span>',
                        '<span class="mut">'+e(gsb[k] ? safeTr(S(sb[k]), S(gsb[k])) : (tr(p,lang,sb[k]) || ''))+'</span>'] }; }),
        { num:[2,3], cls:'sctab' });
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
    + '<div class="mut en" style="margin-top:1mm">'+e(dmy(m.analysis_datetime))+'</div>'
    + '<div style="height:2.5mm;background:var(--teal);width:26mm;border-radius:1mm;margin:2.5mm 0 3.5mm"></div>'
    + '<div class="tiles">'
      + '<div class="tile"><div class="k">'+e(L(lang,'ipo_quality'))+'</div><div class="v">'+n(total,1)
        + '<small>/100</small></div><div class="s">'+e(A(lang,bandOf(total)))+'</div></div>'
      + '<div class="tile"><div class="k">'+e(L(lang,'fundamentals'))+'</div><div class="v">'+n(total-mkt,1)
        + '<small>/95</small></div></div>'
      + '<div class="tile"><div class="k">'+e(L(lang,'market_signals'))+'</div><div class="v">'+n(mkt,1)
        + '<small>/5</small></div></div>'
      + gmpTile(p.ipo||{}, lang)
      + '<div class="tile"><div class="k">'+e(L(lang,'recommendation'))+'</div><div class="v" style="font-size:11pt">'
        + e(A(lang,v.recommendation)||'—')+'</div><div class="s">'+e(v.allocation_band||'')+'</div></div></div></div>';

  var body = BLOCKS.map(function(b){ return '<div class="sc-blk">'+scBlock(p,b,lang)+'</div>'; }).join('')
    + '<div class="sc-blk">' + sec('', L(lang,'total_score'))
    /* Same shape as the line-item tables above it: bar, then mark, then max. */
    + tbl([L(lang,'section'),'',L(lang,'score'),L(lang,'max'),L(lang,'band')],
        BLOCKS.map(function(b){
          var g = blockScore(p,b), pc = b[2] ? (g/b[2])*100 : 0;
          return { cells:[ bName(b,lang),
                           '<span class="scbar"><i style="width:'+pc.toFixed(0)+'%;background:'
                             + ragBarHex(pc)+'"></i></span>',
                           '<b class="en">'+g.toFixed(1)+'</b>',
                           '<span class="en">'+b[2]+'</span>',
                           '<span class="en">'+Math.round(pc)+'%</span>' ] }; })
        .concat([{ __cls:'tot', cells:[ '<b>'+L(lang,'ipo_quality')+'</b>',
                   '<span class="scbar"><i style="width:'+total.toFixed(0)+'%;background:'
                     + ragBarHex(total)+'"></i></span>',
                   '<b class="en">'+total.toFixed(1)+'</b>', '<span class="en">100</span>',
                   '<b>'+e(A(lang,bandOf(total)))+'</b>' ] }]),
        { num:[2,3], cls:'sctab' }) + '</div>';

  /* The long disclaimer used to sit here and nowhere else, which is why the
     PDF and the PNG carried different wording. Every document now says exactly
     one thing, in the running footer of every page: L('footnote'). */
  var tail = '<div class="grow"></div>';

  /* Four shells are emitted; the script packs the blocks into as many as they
     actually need and removes the rest. Packing beats scaling: html2canvas
     renders a CSS-zoomed box with the wrong advance widths, which made Gujavati
     words on a scaled page overlap into each other. */
  var pages = page(p,1,2,L('en','doc_score'),'<div class="sc-main">'+head+body+'</div>'+tail,lang,L('en','doc_score'))
            + page(p,2,2,L('en','doc_score'),'<div class="sc-spill"></div>'+tail,lang,L('en','doc_score'));

  /* Fixed geometry for every scoring table, so LINE ITEM, the bar, SCORE, MAX
     and BASIS sit at identical positions in every block and on both pages. */
  var CSS2 = '\n.sctab{ table-layout:fixed; width:100%; }\n'
           + '.sctab th:nth-child(1),.sctab td:nth-child(1){ width:42mm; }\n'
           + '.sctab th:nth-child(2),.sctab td:nth-child(2){ width:20mm; }\n'
           + '.sctab th:nth-child(3),.sctab td:nth-child(3){ width:13mm; text-align:right; }\n'
           + '.sctab th:nth-child(4),.sctab td:nth-child(4){ width:11mm; text-align:right; }\n'
           + '.sctab td:nth-child(5){ width:auto; }\n'
           + '.scbar{ display:block; height:2.6mm; background:#EEF1F5; border-radius:1.3mm;'
           + ' overflow:hidden; margin-top:.6mm; }\n'
           + '.scbar i{ display:block; height:100%; border-radius:0 1.3mm 1.3mm 0; }\n'
           + '\n.sc-blk{break-inside:avoid}\n.sc-blk table{margin-bottom:0}\n'
           + '.sc-blk .sec{margin:6mm 0 2.5mm}\n.sc-blk .bar{margin:0}\n'
           + '.sc-blk td,.sc-blk th{padding-top:2.3mm;padding-bottom:2.3mm}\n'
           + '.sc-blk .ti{font-size:10.5pt}\n'
           + 'body.gu .sc-blk td,body.gu .sc-blk th{padding-top:1.9mm;padding-bottom:1.9mm}\n'
           /* The card is contractually two pages. Rather than spilling onto a
              third, the type is stepped down one notch at a time until all
              seven blocks plus the totals table fit. Four notches is enough
              for every payload tested, English and Gujarati. */
           + '[data-dense="1"] .sc-blk td,[data-dense="1"] .sc-blk th,'
           + 'body.gu[data-dense="1"] .sc-blk td,body.gu[data-dense="1"] .sc-blk th{padding-top:1.6mm;padding-bottom:1.6mm}\n'
           + '[data-dense="1"] .sc-blk .sec{margin:4mm 0 2mm}\n'
           + '[data-dense="2"] .sc-blk td,[data-dense="2"] .sc-blk th,'
           + 'body.gu[data-dense="2"] .sc-blk td,body.gu[data-dense="2"] .sc-blk th{padding-top:1.15mm;padding-bottom:1.15mm}\n'
           + '[data-dense="2"] .sc-blk .sec{margin:3mm 0 1.6mm}\n'
           + '[data-dense="2"] .sc-blk .ti{font-size:9.6pt}\n'
           + '[data-dense="2"] .sc-blk td,[data-dense="2"] .sc-blk th{font-size:8.1pt}\n'
           + '[data-dense="3"] .sc-blk td,[data-dense="3"] .sc-blk th,'
           + 'body.gu[data-dense="3"] .sc-blk td,body.gu[data-dense="3"] .sc-blk th{padding-top:.85mm;padding-bottom:.85mm;font-size:7.5pt}\n'
           + '[data-dense="3"] .sc-blk .sec{margin:2.2mm 0 1.2mm}\n'
           + '[data-dense="3"] .sc-blk .ti{font-size:9pt}\n'
           + '[data-dense="3"] .sc-top .tile .v{font-size:15pt}\n'
           + '[data-dense="3"] .sc-top h1{font-size:16pt}\n';

  var FIT = '<script>(function(){'
    /* This document packs itself; the generic guard must not scale it again. */
    + 'document.body.setAttribute("data-fitted","1");'
    + 'var ps=[].slice.call(document.querySelectorAll(".page"));'
    + 'var boxes=ps.map(function(el){ return el.querySelector(".sc-main")||el.querySelector(".sc-spill"); });'
    + 'function avail(el){ var bd=el.querySelector(".body"), d=bd.querySelector(".sc-disc");'
      + 'return bd.clientHeight - (d? d.offsetHeight+14 : 0); }'
    /* Blocks are remembered in document order so each density attempt starts
       from the same layout instead of compounding the previous one. */
    + 'var ORDER=[].slice.call(boxes[0].querySelectorAll(".sc-blk"));'
    + 'function reset(){ ORDER.forEach(function(el){ boxes[0].appendChild(el); }); }'
    + 'function pack(){'
      + 'for(var i=0;i<ps.length-1;i++){'
        + 'var A=avail(ps[i]), guard=0;'
        + 'while(boxes[i].scrollHeight>A && guard++<40){'
          + 'var kids=boxes[i].querySelectorAll(".sc-blk");'
          + 'if(kids.length<(i===0?2:1)) break;'
          + 'boxes[i+1].insertBefore(kids[kids.length-1], boxes[i+1].firstChild);'
        + '}'
      + '}'
      + 'var last=boxes[boxes.length-1];'
      + 'return last.scrollHeight<=avail(ps[ps.length-1]);'
    + '}'
    + 'var fits=pack();'
    + 'for(var d=1; d<=3 && !fits; d++){'
      + 'document.body.setAttribute("data-dense", d); reset(); fits=pack();'
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
         .replace('<!--FIT-->', FIT);
}



/* ============================ CHARTS ============================
   Everything here is inline SVG or plain divs, because that is what the
   rasteriser behind the PDF and PNG can actually draw. CSS conic-gradient
   silently renders as nothing through html2canvas — the donut in earlier
   builds was blank in every exported file — so nothing here relies on it.
   ============================================================== */
/* Chart colours draw from the same five-step scale, so a bar in a chart and a
   pill in a table beside it never disagree about what amber means. */
var CH = { teal:'#149C8B', navy:'#1F6FB2', navy2:'#2E6BB8', amber:'#D69A0E',
           gold:'#E2703A', red:'#C0392B', green:'#149C8B', grey:'#C9CFD8', ink:'#1B2430' };

function chNum(v){ return (v==null || isNaN(v)) ? null : Number(v); }
function chMax(a){ var m = 0; a.forEach(function(x){ if(chNum(x)!=null) m = Math.max(m, Math.abs(Number(x))); }); return m || 1; }
/* A chart with nothing plottable must draw nothing at all. Returning an empty
   SVG instead left a full-height blank rectangle holding space in the middle of
   the page — which is what put a chart-shaped hole above the cash-flow table
   when a payload carried no FY24 figures and no investing or financing lines. */
function chHasData(){
  for(var i = 0; i < arguments.length; i++){
    var a = arguments[i];
    if(!Array.isArray(a)) continue;
    for(var j = 0; j < a.length; j++){ if(chNum(a[j]) != null) return true; }
  }
  return false;
}

/* Column chart with a value label on each bar. Negative values drop below the axis. */
function chartColumns(labels, values, opts){
  opts = opts || {};
  if(!chHasData(values)) return '';
  var W = opts.w || 520, H = opts.h || 150, pad = 22;
  var vals = values.map(chNum);
  var hasNeg = vals.some(function(v){ return v != null && v < 0; });
  var mx = chMax(vals);
  var n = vals.length || 1;
  var slot = (W - pad*2) / n, bw = Math.min(slot*0.58, 46);
  var zeroY = hasNeg ? H*0.62 : H - 26;
  var avail = hasNeg ? Math.min(zeroY - 16, H - zeroY - 16) : zeroY - 16;
  var bars = '', labs = '';
  vals.forEach(function(v, i){
    var x = pad + slot*i + slot/2;
    if(v == null){
      labs += '<text x="'+x.toFixed(1)+'" y="'+(H-8)+'" font-size="10" fill="'+CH.grey+'" text-anchor="middle">—</text>';
      return;
    }
    var h = Math.abs(v)/mx*avail;
    var y = v >= 0 ? zeroY - h : zeroY;
    var col = opts.colour || (v < 0 ? CH.red : CH.teal);
    bars += '<rect x="'+(x-bw/2).toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)
         +'" height="'+Math.max(h,1.5).toFixed(1)+'" rx="2" fill="'+col+'"/>';
    bars += '<text x="'+x.toFixed(1)+'" y="'+(v>=0 ? y-5 : y+h+13).toFixed(1)
         +'" font-size="11" font-weight="700" fill="'+CH.ink+'" text-anchor="middle">'
         + e(opts.fmt ? opts.fmt(v) : n2(v)) + '</text>';
  });
  labels.forEach(function(t, i){
    var x = pad + slot*i + slot/2;
    labs += '<text x="'+x.toFixed(1)+'" y="'+(H-6)+'" font-size="10.5" fill="'+CH.ink+'" text-anchor="middle">'+e(S(t))+'</text>';
  });
  return '<div class="ch"><svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="xMidYMid meet">'
    + '<line x1="'+pad+'" y1="'+zeroY+'" x2="'+(W-pad)+'" y2="'+zeroY+'" stroke="'+CH.grey+'" stroke-width="1"/>'
    + bars + labs + '</svg></div>';
}

/* Columns plus a line on a second scale — revenue bars with a margin line. */
function chartColumnsLine(labels, bars, line, opts){
  opts = opts || {};
  if(!chHasData(bars, line)) return '';
  var W = opts.w || 520, H = opts.h || 165, pad = 24;
  var bv = bars.map(chNum), lv = line.map(chNum);
  var bmx = chMax(bv), lmx = chMax(lv);
  var n = bv.length || 1, slot = (W - pad*2)/n, bw = Math.min(slot*0.5, 40);
  var base = H - 28, top = 24, avail = base - top;
  var out = '', pts = [];
  bv.forEach(function(v,i){
    var x = pad + slot*i + slot/2;
    if(v == null) return;
    var h = Math.abs(v)/bmx*avail*0.92;
    out += '<rect x="'+(x-bw/2).toFixed(1)+'" y="'+(base-h).toFixed(1)+'" width="'+bw.toFixed(1)
        +'" height="'+Math.max(h,1.5).toFixed(1)+'" rx="2" fill="'+(opts.barColour||CH.navy2)+'"/>';
    out += '<text x="'+x.toFixed(1)+'" y="'+(base-h-5).toFixed(1)+'" font-size="10.5" font-weight="700" fill="'
        + CH.ink+'" text-anchor="middle">'+e(opts.barFmt?opts.barFmt(v):n2(v))+'</text>';
  });
  lv.forEach(function(v,i){
    if(v == null) return;
    var x = pad + slot*i + slot/2;
    var y = base - (v/lmx)*avail*0.68 - 6;
    pts.push([x,y]);
  });
  if(pts.length > 1){
    out += '<polyline points="'+pts.map(function(q){ return q[0].toFixed(1)+','+q[1].toFixed(1); }).join(' ')
        + '" fill="none" stroke="'+(opts.lineColour||CH.gold)+'" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
    pts.forEach(function(q,i){
      out += '<circle cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="4" fill="'+(opts.lineColour||CH.gold)+'"/>';
      out += '<text x="'+q[0].toFixed(1)+'" y="'+(q[1]-9).toFixed(1)+'" font-size="9.5" fill="'+(opts.lineColour||CH.gold)
          + '" text-anchor="middle">'+e(opts.lineFmt?opts.lineFmt(lv[i]):n2(lv[i]))+'</text>';
    });
  }
  labels.forEach(function(t,i){
    var x = pad + slot*i + slot/2;
    out += '<text x="'+x.toFixed(1)+'" y="'+(H-8)+'" font-size="10.5" fill="'+CH.ink+'" text-anchor="middle">'+e(S(t))+'</text>';
  });
  return '<div class="ch"><svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="xMidYMid meet">'
    + '<line x1="'+pad+'" y1="'+base+'" x2="'+(W-pad)+'" y2="'+base+'" stroke="'+CH.grey+'" stroke-width="1"/>'
    + out + '</svg></div>';
}

/* Donut, drawn as a stroked circle because conic-gradient does not rasterise. */
function chartDonut(parts, opts){
  opts = opts || {};
  var size = opts.size || 132, R = size*0.38, C = 2*Math.PI*R, cx = size/2, cy = size/2;
  var total = parts.reduce(function(a,x){ return a + (Number(x.value)||0); }, 0) || 1;
  var acc = 0, rings = '';
  parts.forEach(function(x){
    var frac = (Number(x.value)||0)/total;
    rings += '<circle cx="'+cx+'" cy="'+cy+'" r="'+R.toFixed(1)+'" fill="none" stroke="'+x.colour
          + '" stroke-width="'+(size*0.20).toFixed(1)+'" stroke-dasharray="'+(C*frac).toFixed(2)+' '+C.toFixed(2)
          + '" stroke-dashoffset="'+(-C*acc).toFixed(2)+'" transform="rotate(-90 '+cx+' '+cy+')"/>';
    acc += frac;
  });
  var centre = opts.centre
    ? '<text x="'+cx+'" y="'+(cy+2)+'" font-size="'+(size*0.15).toFixed(0)+'" font-weight="700" fill="'
      + CH.ink+'" text-anchor="middle">'+e(opts.centre)+'</text>'
      + (opts.centreSub ? '<text x="'+cx+'" y="'+(cy+size*0.15).toFixed(0)+'" font-size="'+(size*0.085).toFixed(0)
         +'" fill="'+CH.grey+'" text-anchor="middle">'+e(opts.centreSub)+'</text>' : '')
    : '';
  return '<svg viewBox="0 0 '+size+' '+size+'" width="'+size+'" height="'+size+'">'+rings+centre+'</svg>';
}

/* Horizontal comparison bars — the subject highlighted against its peers. */
function chartPeerBars(rows, opts){
  opts = opts || {};
  var mx = chMax(rows.map(function(r){ return r.value; }));
  return '<div class="chbars">' + rows.map(function(r){
    var v = chNum(r.value);
    var w = v == null ? 0 : Math.abs(v)/mx*100;
    return '<div class="chbar'+(r.me?' me':'')+'">'
      + '<span class="cl">'+e(S(r.label))+'</span>'
      + '<span class="ct"><i style="width:'+w.toFixed(1)+'%;background:'
      + (r.me ? CH.gold : CH.navy2)+'"></i></span>'
      + '<span class="cv en">'+e(v==null?'—':(opts.fmt?opts.fmt(v):n2(v)))+'</span></div>';
  }).join('') + '</div>';
}

/* Scenario ladder: bear / base / bull against the issue price. */
function chartLadder(cases, issuePrice, lang){
  var vals = cases.map(function(c){ return chNum(c.value_per_share != null ? c.value_per_share : c.fair_value); });
  var all = vals.concat([chNum(issuePrice)]).filter(function(x){ return x != null; });
  if(!all.length) return '';
  var lo = Math.min.apply(null, all)*0.9, hi = Math.max.apply(null, all)*1.05;
  var span = (hi - lo) || 1;
  var W = 520, H = 130, pad = 28, base = H - 24;
  var slot = (W - pad*2)/(cases.length || 1);
  var out = '';
  var ipY = base - ((chNum(issuePrice) - lo)/span)*(base - 26);
  if(chNum(issuePrice) != null){
    out += '<line x1="'+pad+'" y1="'+ipY.toFixed(1)+'" x2="'+(W-pad)+'" y2="'+ipY.toFixed(1)
        + '" stroke="'+CH.gold+'" stroke-width="2" stroke-dasharray="6 4"/>'
        + '<text x="'+(W-pad)+'" y="'+(ipY-6).toFixed(1)+'" font-size="10" fill="'+CH.gold
        + '" text-anchor="end">'+e(L(lang,'issue_at'))+' '+n(issuePrice)+'</text>';
  }
  cases.forEach(function(c,i){
    var v = vals[i]; if(v == null) return;
    var x = pad + slot*i + slot/2;
    var y = base - ((v - lo)/span)*(base - 26);
    var col = /bear|મંદી/i.test(S(c.case)) ? CH.red : /bull|તેજી/i.test(S(c.case)) ? CH.green : CH.navy2;
    out += '<rect x="'+(x-26)+'" y="'+y.toFixed(1)+'" width="52" height="'+(base-y).toFixed(1)+'" rx="3" fill="'+col+'" fill-opacity="0.85"/>'
        + '<text x="'+x+'" y="'+(y-6).toFixed(1)+'" font-size="11.5" font-weight="700" fill="'+CH.ink
        + '" text-anchor="middle">₹'+n(v)+'</text>'
        + '<text x="'+x+'" y="'+(H-6)+'" font-size="10.5" fill="'+CH.ink+'" text-anchor="middle">'+e(A(lang,c.case))+'</text>';
  });
  return '<div class="ch"><svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="xMidYMid meet">'
    + '<line x1="'+pad+'" y1="'+base+'" x2="'+(W-pad)+'" y2="'+base+'" stroke="'+CH.grey+'" stroke-width="1"/>'
    + out + '</svg></div>';
}

/* Radar over the seven scoring blocks. */
function chartRadar(p, lang){
  /* The viewBox is wider than it is tall so the axis labels at 3 and 9 o'clock
     have room; at equal width they were being cut off mid-word. */
  var W = 330, H = 250, cx = W/2, cy = H/2 + 4, R = 74;
  var pts = [], axes = '', labs = '';
  BLOCKS.forEach(function(b, i){
    var frac = b[2] ? Math.max(0, Math.min(1, blockScore(p,b)/b[2])) : 0;
    var ang = -Math.PI/2 + (2*Math.PI*i)/BLOCKS.length;
    var ax = cx + Math.cos(ang)*R, ay = cy + Math.sin(ang)*R;
    axes += '<line x1="'+cx+'" y1="'+cy+'" x2="'+ax.toFixed(1)+'" y2="'+ay.toFixed(1)+'" stroke="'+CH.grey+'" stroke-width="0.8"/>';
    pts.push([(cx + Math.cos(ang)*R*frac).toFixed(1), (cy + Math.sin(ang)*R*frac).toFixed(1)]);
    var lx = cx + Math.cos(ang)*(R+15), ly = cy + Math.sin(ang)*(R+15);
    var anchor = Math.abs(Math.cos(ang)) < 0.3 ? 'middle' : (Math.cos(ang) > 0 ? 'start' : 'end');
    var nm = S(bName(b,lang));
    if(nm.length > 22) nm = nm.slice(0,21)+'…';
    labs += '<text x="'+lx.toFixed(1)+'" y="'+(ly+3).toFixed(1)+'" font-size="8.5" fill="'+CH.ink
         + '" text-anchor="'+anchor+'">'+e(nm)+'</text>';
  });
  var rings = [0.25,0.5,0.75,1].map(function(f){
    var poly = BLOCKS.map(function(b,i){
      var ang = -Math.PI/2 + (2*Math.PI*i)/BLOCKS.length;
      return (cx+Math.cos(ang)*R*f).toFixed(1)+','+(cy+Math.sin(ang)*R*f).toFixed(1); }).join(' ');
    return '<polygon points="'+poly+'" fill="none" stroke="'+CH.grey+'" stroke-width="0.7"/>';
  }).join('');
  return '<div class="ch"><svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="xMidYMid meet">'
    + rings + axes
    + '<polygon points="'+pts.map(function(q){ return q[0]+','+q[1]; }).join(' ')
    + '" fill="'+CH.navy2+'" fill-opacity="0.30" stroke="'+CH.navy+'" stroke-width="2.5"/>'
    + labs + '</svg></div>';
}

/* Simple horizontal gauge for a 0-100 score. */
function chartGauge(value, lang){
  var W = 520, H = 54, pad = 12, v = Math.max(0, Math.min(100, Number(value)||0));
  var bands = [[0,35,PAL5_HEX[0]],[35,50,PAL5_HEX[1]],[50,65,PAL5_HEX[2]],
               [65,80,PAL5_HEX[3]],[80,100,PAL5_HEX[4]]];
  var track = bands.map(function(b){
    var x = pad + (W-pad*2)*b[0]/100, w = (W-pad*2)*(b[1]-b[0])/100;
    return '<rect x="'+x.toFixed(1)+'" y="18" width="'+w.toFixed(1)+'" height="14" fill="'+b[2]+'" fill-opacity="0.30"/>';
  }).join('');
  var x = pad + (W-pad*2)*v/100;
  return '<div class="ch"><svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="xMidYMid meet">'
    + track
    + '<rect x="'+pad+'" y="18" width="'+((W-pad*2)*v/100).toFixed(1)+'" height="14" fill="'+ragBarHex(v)+'"/>'
    + '<polygon points="'+x.toFixed(1)+',14 '+(x-6).toFixed(1)+',4 '+(x+6).toFixed(1)+',4" fill="'+CH.ink+'"/>'
    + '<text x="'+x.toFixed(1)+'" y="46" font-size="12" font-weight="700" fill="'+CH.ink
    + '" text-anchor="middle">'+v.toFixed(1)+' / 100</text>'
    + '</svg></div>';
}
function bandColourHex(v){ v=Number(v)||0;
  return v>=75?CH.green:v>=65?CH.teal:v>=55?CH.amber:v>=45?CH.gold:CH.red; }

/* Waterfall for use of proceeds. */
function chartWaterfall(items, lang){
  if(!items.length) return '';
  if(!chHasData(items.map(function(x){ return x.amount_cr; }))) return '';
  var W = 520, H = 150, pad = 20, base = H - 34;
  var mx = chMax(items.map(function(x){ return x.amount_cr; }));
  var slot = (W - pad*2)/items.length, bw = Math.min(slot*0.6, 54);
  var out = '';
  items.forEach(function(x,i){
    var v = chNum(x.amount_cr); if(v == null) return;
    var h = Math.abs(v)/mx*(base-30);
    var cx2 = pad + slot*i + slot/2;
    out += '<rect x="'+(cx2-bw/2).toFixed(1)+'" y="'+(base-h).toFixed(1)+'" width="'+bw.toFixed(1)
        + '" height="'+Math.max(h,2).toFixed(1)+'" rx="2" fill="'+CH.navy2+'"/>'
        + '<text x="'+cx2.toFixed(1)+'" y="'+(base-h-5).toFixed(1)+'" font-size="10.5" font-weight="700" fill="'
        + CH.ink+'" text-anchor="middle">'+n(v)+'</text>';
    var words = S(tr(items[i].__p||{}, lang, x.use)).split(/\s+/).slice(0,3).join(' ');
    out += '<text x="'+cx2.toFixed(1)+'" y="'+(base+14)+'" font-size="8.5" fill="'+CH.ink
        + '" text-anchor="middle">'+e(words)+'</text>';
  });
  return '<div class="ch"><svg viewBox="0 0 '+W+' '+H+'" width="100%" height="'+H+'" preserveAspectRatio="xMidYMid meet">'
    + '<line x1="'+pad+'" y1="'+base+'" x2="'+(W-pad)+'" y2="'+base+'" stroke="'+CH.grey+'" stroke-width="1"/>'
    + out + '</svg></div>';
}

/* Heat row for a sensitivity grid. */
function chartHeat(cols, rows, lang){
  if(!rows.length) return '';
  var all = [];
  rows.forEach(function(r){ arr(r.cells).forEach(function(c){ var v=chNum(c); if(v!=null) all.push(v); }); });
  if(!all.length) return '';
  var lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), span = (hi-lo)||1;
  /* Five bands, matching the score scale exactly, so a cell in this grid means
     the same thing as a bar of the same colour anywhere else in the report. */
  function col(v){ return PAL5_HEX[step5(((v-lo)/span)*100)]; }
  return '<table class="chheat"><thead><tr><th></th>'
    + cols.map(function(c){ return '<th>'+e(S(c))+'</th>'; }).join('')+'</tr></thead><tbody>'
    + rows.map(function(r){
        return '<tr><th>'+e(S(r.label))+'</th>'
          + arr(r.cells).map(function(c){
              var v = chNum(c);
              return '<td style="background:'+(v==null?CH.grey:col(v))+';color:#fff">'+(v==null?'—':n(v))+'</td>'; }).join('')
          + '</tr>'; }).join('')
    + '</tbody></table>';
}
function n2(v){ return n(v, Math.abs(Number(v))<100 ? 1 : 0); }


/* Pull a numeric series out of financials.rows by matching its label. */
function rowSeries(f, re){
  var hit = arr(f.rows).filter(function(r){ return re.test(S(r.label)); })[0];
  return hit ? arr(hit.values).map(function(v){ return (v==null||isNaN(v))?null:Number(v); }) : [];
}
function chartLegend(items){
  return '<div class="chleg">'+items.map(function(x){
    return '<span><i style="background:'+x.colour+'"></i>'+e(x.label)+'</span>'; }).join('')+'</div>';
}
/* Revenue columns with the profit line over them — the single most useful
   picture in the whole document, and it replaces reading three table rows. */
function chartFinancials(p, lang){
  var f = p.financials||{};
  var years = arr(f.years).length ? arr(f.years) : ['FY24','FY25','FY26'];
  var rev = rowSeries(f, /revenue|turnover|આવક/i);
  var pat = rowSeries(f, /profit after tax|\bPAT\b|net profit|નફો/i);
  if(!rev.filter(function(x){return x!=null;}).length) return '';
  var out = chartColumnsLine(years, rev, pat, {
    barColour:'#2E6BB8', lineColour:'#E08A1E',
    barFmt:function(v){ return n(v,0); }, lineFmt:function(v){ return n(v,0); } });
  return out + chartLegend([{ label:L(lang,'revenue_lbl'), colour:'#2E6BB8' },
                            { label:L(lang,'pat_lbl'), colour:'#E08A1E' }]);
}
/* Peer multiple comparison with the subject highlighted. */
function chartPeers(p, lang){
  var f = p.financials||{}, pr = f.peers||{};
  var rows = [];
  if(Array.isArray(pr.rows) && pr.rows.length){
    var cols = arr(pr.columns).map(function(c){ return S(c).toLowerCase(); });
    var peIx = cols.findIndex(function(c){ return /p\/e|pe/.test(c); });
    if(peIx > 0){
      pr.rows.forEach(function(r){
        var cells = arr(r.cells);
        rows.push({ label:S(cells[0]), value:parseFloat(String(cells[peIx]).replace(/[^\d.\-]/g,'')),
                    me:!!r.is_subject });
      });
    }
  } else if(Array.isArray(f.peers)){
    f.peers.forEach(function(x){ rows.push({ label:S(x.name), value:chNum(x.pe), me:!!x.is_subject }); });
  }
  rows = rows.filter(function(r){ return r.value != null && !isNaN(r.value); });
  if(rows.length < 2) return '';
  return chartPeerBars(rows, { fmt:function(v){ return n(v,1)+'×'; } });
}

/* ==================== INSTITUTIONAL RESEARCH REPORT ====================
   The long-form edition: all 30 research sections at full depth, rendered
   from the same imported payload as every other document. Sections are
   emitted as self-contained blocks and packed into pages by measurement, so
   Gujarati — which runs materially longer than English — paginates itself
   instead of being squeezed or clipped.
   ===================================================================== */
function irSec(no, title, body){
  return '<div class="ir-blk">' + sec(no, title) + body + '</div>';
}
function irNote(t){ return t ? '<div class="note">'+e(t)+'</div>' : ''; }
function irNone(lang){ return '<div class="note mut">'+e(L(lang,'ir_none'))+'</div>'; }
function irList(items){
  if(!items.length) return '';
  return '<ul class="ir-ul">'+items.map(function(x){ return '<li>'+x+'</li>'; }).join('')+'</ul>';
}

function buildInstitutional(p, lang){
  p = safePayload(p);
  lang = lang || 'en';
  var m=p.meta||{}, f=p.financials||{}, c=p.company||{}, pe=p.people||{}, d=p.decision||{},
      ipo=p.ipo||{}, v=p.verdict||{}, src=p.sources||{}, sl=p.score_lines||{}, sb=p.score_basis||{},
      dp=p.deep||{};
  var ind = c.industry||{}, moat = c.moat||{}, val = f.valuation||{},
      eq = f.earnings_quality||{}, peers = f.peers||{}, scn = f.scenarios||{};

/* Which sections exist is decided ONCE, from the English pass, and both
   editions then render exactly that set. Deciding per language produced a
   Gujarati report with sections the English one did not have — the two
   editions must never disagree on structure any more than on figures. */
/* The institutional report's reading order, grouped. Keys are the T[] label
   keys used by the section builders, so renaming a heading never breaks this. */
var IR_GROUPS = [
  ['irg_recommendation', ['verdict_h']],
  ['irg_ipo',            ['ipo_snapshot','ir_issue_kpi','ir_objects','ir_shareholding',
                          'ir_anchors','capital_allocation']],
  ['irg_company',        ['what_it_does','ir_group','ir_products','ir_segments','ir_metrics',
                          'ir_industry','ir_moat','dp_competition','ir_concentration',
                          'swot_analysis']],
  ['irg_promoters',      ['ir_promoters','management_quality','ir_gov']],
  ['irg_financials',     ['ir_pl','ir_fq','ir_cash','ir_cashflow','ir_opmetrics','ir_credit']],
  ['irg_valuation',      ['ir_val','dp_rdcf','ir_peers','ir_scen','dp_cases',
                          'dp_sensitivity','ir_lg']],
  ['irg_risks',          ['red_flags','ir_catalysts','ir_fail','ir_monitor','regulatory',
                          'ir_litigation','dp_change_mind','dp_questions','ir_alloc','ir_score',
                          'ir_sources']]
];

function irSections(lang, gate){
  var gsb = (lang==='gu' && p.gu && p.gu.score_basis) ? p.gu.score_basis : {};
  var B = [], BLK = [], NO = 0, IX = 0, present = [];

  /* A section is emitted only when it has something to say. Printing a heading
     over "Not disclosed" was the single biggest source of dead space in the
     previous build — it filled pages with nothing. */
  /* A "data section" — one whose point is a table, a chart or a list — is only
     worth a numbered heading if it actually carries rows. Several sections were
     printing a heading over a single sentence explaining that the figure could
     not be found; that is dead space, and the limitation belongs in the source
     audit instead. Prose sections (the bear case, what would change our mind)
     are unaffected: they pass no count and are judged on their text. */
  function push(key, title, body, badge, count){
    var ix = IX++;
    var has = !!(body && S(String(body).replace(/<[^>]*>/g,'')).trim());
    if(count !== undefined && !count) has = false;
    present[ix] = has;
    if(gate ? !gate[ix] : !has) return;
    BLK.push({ key:key, title:title + (badge? ' — '+badge : ''), body:body||'' });
  }
  var TITLES = [];
  function T2(cols, rows, opts){ return rows.length ? tbl(cols, rows, opts) : ''; }
  function note(t){ t = S(t); return t ? '<div class="note">'+e(t)+'</div>' : ''; }
  function lead(t){ t = S(t); return t ? '<div class="lead">'+e(t)+'</div>' : ''; }
  function ul(items){ items = items.filter(Boolean);
    return items.length ? '<ul class="ir-ul">'+items.map(function(x){ return '<li>'+x+'</li>'; }).join('')+'</ul>' : ''; }
  function kv(pairs){
    pairs = pairs.filter(function(x){ return x[1] != null && x[1] !== '' && x[1] !== '—'; });
    return pairs.length ? tbl([L(lang,'line_item'), L(lang,'value')],
      pairs.map(function(x){ return { cells:[x[0], x[1]] }; })) : '';
  }

  /* 01 verdict */
  push('verdict_h', L(lang,'verdict_h'),
      '<div class="vb"><div class="h">'+e(A(lang, v.recommendation||''))+'</div><div class="c">'
    + '<div class="v">'+e(pick(p,lang,'verdict.headline', v.headline))+'</div>'
    + '<div class="lead" style="margin-top:2mm">'+e(pick(p,lang,'verdict.one_liner', v.one_liner))+'</div></div></div>'
    + ul(arr(pick(p,lang,'verdict.thesis', arr(v.thesis))).map(function(t){ return e(S(t)); })));

  /* 02 IPO snapshot with the fresh/OFS split */
  var fresh = Number(ipo.fresh_cr)||0, ofs = Number(ipo.ofs_cr)||0, tot = fresh+ofs;
  push('ipo_snapshot', L(lang,'ipo_snapshot'),
      /* Figures and commentary only, as in the company report's own snapshot.
         The fresh-versus-OFS split is a section of its own further down, where
         it sits beside the outflow that mirrors it. */
      kv([
        [L(lang,'issue_period'), '<span class="en">'+e(dmy(m.open_date)||'—')+' — '+e(dmy(m.close_date)||'—')+'</span>'],
        [L(lang,'price_band'), '<span class="en">₹'+e(S(ipo.price_band)||'—')+' · '+L(lang,'issue_at')+' ₹'+n(ipo.issue_price)+'</span>'],
        [L(lang,'issue_size'), '<span class="en">'+cr(ipo.issue_size_cr)+'</span>'],
        [L(lang,'lot'), '<span class="en">'+n(ipo.lot_size)+' · ₹'+n(ipo.min_investment)+'</span>'],
        [L(lang,'subscription'), (ipo.subscription&&ipo.subscription.overall!=null)
          ? '<span class="en">'+n(ipo.subscription.overall,2)+'×'
            + (ipo.subscription.qib!=null?' · QIB '+n(ipo.subscription.qib,2)+'×':'')
            + (ipo.subscription.retail!=null?' · Retail '+n(ipo.subscription.retail,2)+'×':'')+'</span>' : null],
        [L(lang,'gmp'), (ipo.gmp&&ipo.gmp.value!=null)
          ? '<span class="en">₹'+n(ipo.gmp.value)+' ('+pct(ipo.gmp.pct)+')</span>' : null],
        [L(lang,'exchanges'), S(m.exchanges)||S(m.exchange) ? '<span class="en">'+e(S(m.exchanges)||S(m.exchange))+'</span>' : null],
        [L(lang,'listing'), S(m.listing_date) ? '<span class="en">'+e(dmy(m.listing_date))+'</span>' : null]
      ])
    + (S(ipo.structure_verdict) || S(ipo.structure_note)
      ? '<div class="note'+(/exit/i.test(S(ipo.structure_verdict))?' bad':'')+'"><b>'
        + e(A(lang, tr(p,lang,ipo.structure_verdict)))+'</b> '+e(pick(p,lang,'ipo.structure_note', ipo.structure_note))+'</div>' : ''));

  /* 03 business */
  push('what_it_does', L(lang,'what_it_does'),
      lead(pick(p,lang,'company.what_it_does', c.what_it_does))
    + note(pick(p,lang,'company.how_it_earns', c.how_it_earns))
    + note(pick(p,lang,'company.why_customers_stay', c.why_customers_stay)));

  /* 04 segments — the reported split. The product-by-product breakdown is a
     separate section further down. */
  var segs = arr(c.segments);
  push('ir_segments', L(lang,'ir_segments'),
      T2([L(lang,'segment'), L(lang,'rev_share'), L(lang,'growth'), L(lang,'note')],
        segs.map(function(x){
          return { cells:[e(tr(p,lang,x.name)), pct(x.revenue_pct), pct(x.growth_pct),
                   '<span class="mut">'+e(tr(p,lang,x.note))+'</span>'] }; }), { num:[1,2] }), '', segs.length);

  /* 05 operating metrics — {label, value} */
  var om = arr(c.operating_metrics);
  push('ir_metrics', L(lang,'ir_metrics'),
    om.length ? '<div class="grid4">'+om.slice(0,12).map(function(x){
      return '<div class="kv"><div class="k">'+e(tr(p,lang,x.label))+'</div><div class="v en">'
        + e(S(x.value))+'</div></div>'; }).join('')+'</div>' : '');

  /* 06 industry — drivers are plain strings */
  push('ir_industry', L(lang,'ir_industry'),
      (S(ind.classification) ? '<div class="pill" style="background:var(--navy2)">'
        + e(A(lang,ind.classification))+'</div>' : '')
    + note(pick(p,lang,'company.industry_growth_note', ind.growth_note))
    + ul(arr(pick(p,lang,'company.drivers', arr(ind.drivers))).map(function(x){ return e(S(x)); }))
    + kv([[L(lang,'pricing_power'), S(ind.pricing_power) ? e(A(lang,ind.pricing_power)) : null]])
    + note(tr(p,lang,ind.market_share_note)));

  /* 07 moat — moat.sources */
  push('ir_moat', L(lang,'ir_moat') + (S(moat.rating) ? '' : ''),
      note(pick(p,lang,'company.moat_note', moat.note))
    + T2([L(lang,'source_adv'), L(lang,'verdict'), L(lang,'evidence')],
        arr(moat.sources).map(function(x){
          return { cells:[e(tr(p,lang,x.source)),
            ragPill(x.verdict, lang),
            '<span class="mut">'+e(tr(p,lang,x.evidence))+'</span>'] }; })),
    S(moat.rating) ? A(lang,moat.rating) : '');

  /* 08 three-year financials */
  push('ir_pl', L(lang,'ir_pl'),
      chartFinancials(p, lang)
    + T2([L(lang,'rs_crore')].concat(arr(f.years)).concat([L(lang,'trend')]),
        arr(f.rows).map(function(r){
          return { __cls:r.highlight?'hi':'', cells:[e(tr(p,lang,r.label))]
            .concat(arr(r.values).map(function(x){ return typeof x==='number'? n(x, Math.abs(x)<100?2:0) : e(S(x)||'—'); }))
            .concat(['<span class="mut">'+e(tr(p,lang,r.trend))+'</span>']) }; }), { num:[1,2,3] })
    + note(tr(p,lang,f.note)));

  /* 09 ratios — {label, value, direction} */
  var rt = arr(f.ratios);
  push('ir_fq', L(lang,'ir_fq'),
    rt.length ? '<div class="grid4">'+rt.slice(0,12).map(function(r){
      return '<div class="kv"><div class="k">'+e(tr(p,lang,r.label))+'</div><div class="v en '+toneClass(r.tone)+'">'
        + e(S(r.value))+'</div><div class="s">'+e(tr(p,lang,r.direction))+'</div></div>'; }).join('')+'</div>' : '');

  /* 10 cash flow and earnings quality */
  push('ir_cash', L(lang,'ir_cash'),
      kv([
        [L(lang,'earn_quality'), S(eq.rating) ? e(A(lang,eq.rating)) : null],
        ['CFO / PAT', eq.cfo_pat!=null ? '<span class="en">'+Number(eq.cfo_pat).toFixed(2)+'×</span>' : null],
        ['FCF / PAT', eq.fcf_pat!=null ? '<span class="en">'+Number(eq.fcf_pat).toFixed(2)+'×</span>' : null]
      ])
    + note(pick(p,lang,'financials.earnings_quality_note', eq.note || f.earnings_quality_note))
    + T2([L(lang,'flag'), L(lang,'severity'), L(lang,'note')],
        arr(eq.flags||f.eq_flags).map(function(x,i){
          var g = arr(pick(p,lang,'financials.eq_flags', []))[i]||{};
          return { cells:['<b>'+e(S(g.flag)||tr(p,lang,x.flag))+'</b>',
            '<span class="pill '+sevClass(x.severity)+'">'+e(A(lang,x.severity))+'</span>',
            '<span class="mut">'+e(S(g.note)||tr(p,lang,x.note))+'</span>'] }; })));

  /* Cash flow, properly. Profit rising while operating cash falls is the most
     useful warning an IPO gives, so it is stated as a verdict, not buried. */
  var cf = f.cash_flow||{}, cfr = arr(cf.rows), cfk = cf.kpis||{}, dvg = cf.divergence||{};
  push('ir_cashflow', L(lang,'ir_cashflow'),
      note(tr(p,lang,cf.note))
    + (cfr.length ? chartColumns(arr(f.years).length?arr(f.years):['FY24','FY25','FY26'],
        (rowSeries(cfr, /operat/i)||[]), { h:140, colour:CH.teal, fmt:function(x){ return n(x,0); } }) : '')
    + T2([L(lang,'line_item')].concat(arr(f.years).length?arr(f.years):['FY24','FY25','FY26'])
          .concat([L(lang,'trend')]),
        cfr.map(function(x){
          var v = arr(x.values);
          return { __cls:x.highlight?'hi':'',
                   cells:[e(tr(p,lang,x.label)), n(v[0],2), n(v[1],2), n(v[2],2),
                          '<span class="mut">'+e(tr(p,lang,x.trend))+'</span>'] }; }), { num:[1,2,3] })
    + (arr(cfk.cfo_pat).length
      ? '<div class="tiles">'+arr(cfk.cfo_pat).map(function(x){
          var v = Number(x.value);
          return '<div class="tile"><div class="k">'+e(S(x.year))+' '+e(L(lang,'cfo_pat'))
            + '</div><div class="v" style="color:'+(v<60?'var(--bad)':v<85?'var(--amber)':'var(--good)')
            + '">'+pct(x.value,0)+'</div></div>'; }).join('')+'</div>' : '')
    + kv([[L(lang,'accrual_ratio'), cfk.accrual_ratio!=null? n(cfk.accrual_ratio,3) : null],
          [L(lang,'capex_intensity'), cfk.capex_pct_of_revenue!=null? pct(cfk.capex_pct_of_revenue,1) : null],
          [L(lang,'wc_absorption'), cfk.wc_absorption_pct_of_incremental_revenue!=null
            ? pct(cfk.wc_absorption_pct_of_incremental_revenue,1) : null]])
    + (S(dvg.flag) ? '<div class="note'+(/serious/i.test(S(dvg.flag))?' bad':/watch/i.test(S(dvg.flag))?' warn':'')
        + '"><b>'+e(L(lang,'divergence'))+' — '+e(A(lang,dvg.flag))+'</b> '+e(tr(p,lang,dvg.note))+'</div>' : '')
    + (S(cf.funding_verdict) ? '<div class="note"><b>'+e(L(lang,'funding_verdict'))+' — '
        + e(A(lang,cf.funding_verdict))+'</b> '+e(tr(p,lang,cf.funding_note))+'</div>' : ''),
    '', cfr.length);

  /* 11 balance sheet */
  var bs = f.balance_sheet||{};
  /* This printed only the scalar keys and silently ignored bs.items, so the
     section came out as a single word — the rating — and nothing else. */
  var bsItems = arr(bs.items);
  push('ir_bs', L(lang,'ir_bs') + (S(bs.rating) ? ' — ' + A(lang, bs.rating) : ''),
      T2([L(lang,'line_item'), L(lang,'value_lbl')], bsItems.map(function(x){
        var t = S(x.tone).toLowerCase();
        return { cells:[e(tr(p,lang,x.label)),
                 '<b class="en" style="color:'
                   + (t==='good'?'var(--good)':t==='bad'?'var(--bad)':t==='warn'?'var(--amber)':'var(--ink)')
                   + '">'+e(S(x.value))+'</b>'] }; }))
    + kv(Object.keys(bs).filter(function(k){
          return typeof bs[k] !== 'object' && bs[k] != null && k !== 'rating' && k !== 'note'; })
        .slice(0,8).map(function(k){
          return [e(tr(p,lang,k.replace(/_/g,' '))), '<span class="en">'+e(S(bs[k]))+'</span>']; }))
    + note(tr(p,lang,bs.note)), '', bsItems.length);

  /* 12 promoters */
  push('ir_promoters', L(lang,'ir_promoters'),
      kv([
        [L(lang,'promoter_holding'), pe.promoter_holding_pre!=null
          ? '<span class="en">'+pct(pe.promoter_holding_pre)+' → '+pct(pe.promoter_holding_post)+'</span>' : null]
      ])
    + note(pick(p,lang,'people.dd_note', pe.dd_note))
    + T2([L(lang,'name'), L(lang,'role'), L(lang,'background')],
        arr(pe.promoters).map(function(x){
          return { cells:['<b class="en">'+e(S(x.name))+'</b>', e(tr(p,lang,x.role)),
                   '<span class="mut">'+e(tr(p,lang,x.background||x.note))+'</span>'] }; }))
    /* The Note column read x.note, but the payload field is `finding` — so the
       column was blank in every report ever produced. The pill is also coloured
       by the result now instead of being uniformly navy. */
    + T2([L(lang,'check'), L(lang,'status'), L(lang,'note')],
        arr(pe.due_diligence||pe.dd_checks).map(function(x){
          return { cells:[e(tr(p,lang,x.check)), ragPill(x.result||x.standard, lang),
            '<span class="mut">'+e(tr(p,lang,x.note||x.finding))+'</span>'] }; })));

  /* 13 governance */
  var gov = pe.governance||{};
  push('ir_gov', L(lang,'ir_gov'),
      note(pick(p,lang,'people.governance_note', gov.note || pe.governance_note))
    + T2([L(lang,'parameter'), L(lang,'assessment'), L(lang,'note')],
        arr(gov.items||pe.governance_params).map(function(x){
          /* The assessment column was as wide as the note, which left the
             observation cramped. It is narrowed here and the note takes the
             room, falling back to the finding when no note was supplied. */
          return { cells:[e(tr(p,lang,x.parameter||x.item)),
            '<span class="gov-a">'+ragPill(x.assessment||x.flag, lang, 'risk')+'</span>',
            '<span class="mut">'+e(tr(p,lang,x.note||x.finding||x.observation))+'</span>'] }; })));

  /* 14 anchors */
  var an = ipo.anchors||{};
  push('ir_anchors', L(lang,'ir_anchors'),
      kv([[L(lang,'total'), an.total_cr!=null?'<span class="en">'+cr(an.total_cr)+'</span>':null],
          ['MF share', an.mf_share_pct!=null?'<span class="en">'+pct(an.mf_share_pct)+'</span>':null],
          ['Lock-in', S(an.lockin)?e(S(an.lockin)):null]])
    + T2([L(lang,'anchor'), L(lang,'type'), L(lang,'rs_crore')],
        arr(an.top||an.names).map(function(x){
          if(typeof x === 'string') return { cells:['<span class="en">'+e(x)+'</span>','','']};
          return { cells:['<span class="en">'+e(S(x.name))+'</span>', e(tr(p,lang,x.type)),
                   x.amount_cr==null?'—':n(x.amount_cr,2)] }; }), { num:[2] }));

  /* 15 objects */
  arr(ipo.objects).forEach(function(o){ o.__p = p; });
  /* The two sides of the transaction. Declared once, used by both sections, so
     the inflow pie and the outflow pie can never disagree about the totals. */
  var freshCr = Number(ipo.fresh_cr)||0, ofsCr = Number(ipo.ofs_cr)||0;
  var issueCr = Number(ipo.issue_size_cr) || (freshCr + ofsCr);
  var inflowGap = Math.abs(issueCr - (freshCr + ofsCr));

  /* Where the money goes. The mirror of the inflow: every object of the fresh
     issue, plus the offer for sale, which is money leaving the transaction to
     the selling shareholders rather than entering the company. The two sides
     tie to the same total, and any gap is stated instead of hidden. */
  var objs = arr(ipo.objects);
  var objTot = objs.reduce(function(a,o){ return a+(Number(o.amount_cr)||0); }, 0);
  var unallocated = freshCr - objTot;
  var outSlices = objs.map(function(o){
      return { label:S(tr(p,lang,o.use)), value:Number(o.amount_cr)||0 }; });
  if(unallocated > 0.5) outSlices.push({ label:S(L(lang,'issue_expenses')), value:unallocated });
  if(ofsCr > 0) outSlices.push({ label:S(L(lang,'to_sellers')), value:ofsCr });
  var outTot = outSlices.reduce(function(a,x){ return a+x.value; }, 0);
  var outGap = Math.abs(outTot - issueCr);
  push('ir_objects', L(lang,'ir_outflow'),
      pieAside(outSlices,
        T2([L(lang,'use_proceeds'), L(lang,'rs_crore'), L(lang,'assessment')],
          objs.map(function(o){
            return { cells:[e(tr(p,lang,o.use)), n(o.amount_cr,2),
                     '<span class="mut">'+e(tr(p,lang,o.verdict||o.note))+'</span>'] }; })
          .concat(unallocated > 0.5 ? [{ cells:[e(L(lang,'issue_expenses')), n(unallocated,2),
                     '<span class="mut">'+e(L(lang,'balance_of_fresh'))+'</span>'] }] : [])
          .concat(ofsCr > 0 ? [{ cells:['<b>'+e(L(lang,'to_sellers'))+'</b>', '<b>'+n(ofsCr,2)+'</b>',
                     '<span class="mut">'+e(L(lang,'ofs_note'))+'</span>'] }] : [])
          .concat([{ __cls:'tot', cells:['<b>'+e(L(lang,'total'))+'</b>', '<b>'+n(outTot,2)+'</b>',
                     outGap > 0.5 ? '<b style="color:var(--s5-1)">'+e(L(lang,'does_not_tie'))+'</b>'
                                  : '<span class="mut">'+e(L(lang,'ties_to_issue'))+'</span>'] }]),
          { num:[1] }),
        { centre:cr(outTot), centreSub:L(lang,'ir_outflow') }),
    '', outSlices.length);

  /* 16 selling shareholders */
  push('ir_shareholding', L(lang,'ir_shareholding'),
    T2([L(lang,'seller'), L(lang,'type'), L(lang,'rs_crore')],
      arr(ipo.selling_shareholders).map(function(x){
        return { cells:['<span class="en">'+e(S(x.name))+'</span>', e(tr(p,lang,x.type)), n(x.amount_cr,2)] }; }),
      { num:[2] }));

  /* 17 valuation — multiples[] */
  push('ir_val', L(lang,'ir_val') + '',
      note(pick(p,lang,'financials.valuation_note', val.note))
    + T2([L(lang,'multiple'), L(lang,'value'), L(lang,'basis')],
        arr(val.multiples).map(function(x){
          return { cells:['<span class="en">'+e(tr(p,lang,x.label))+'</span>',
                   '<b class="en">'+e(S(x.value))+'</b>',
                   '<span class="mut">'+e(tr(p,lang,x.basis))+'</span>'] }; }), { num:[1] })
    /* Anchors: what the buyer gives up against a risk-free alternative, and
       whether the growth being paid for is real or was acquired. */
    + (function(){ var a = val.anchors||{};
        if(a.earnings_yield_pct==null && a.peg_reported==null && a.implied_growth_pct==null) return '';
        return '<div class="tiles">'
          + '<div class="tile"><div class="k">'+e(L(lang,'earnings_yield'))+'</div><div class="v">'
            + pct(a.earnings_yield_pct,2)+'</div><div class="s">'+e(L(lang,'gsec_10y'))+' '
            + pct(a.gsec_10y_pct,2)+'</div></div>'
          + (a.peg_reported!=null ? '<div class="tile"><div class="k">'+e(L(lang,'peg_reported'))
              + '</div><div class="v en">'+n(a.peg_reported,2)+'</div></div>' : '')
          + (a.peg_organic!=null ? '<div class="tile"><div class="k">'+e(L(lang,'peg_organic'))
              + '</div><div class="v en" style="color:'+(Number(a.peg_organic)>2?'var(--bad)':'var(--ink)')
              + '">'+n(a.peg_organic,2)+'</div></div>' : '')
          + (a.implied_growth_pct!=null ? '<div class="tile"><div class="k">'+e(L(lang,'implied_growth'))
              + '</div><div class="v">'+pct(a.implied_growth_pct,1)+'</div></div>' : '')
          + '</div>'
          + (S(a.yield_gap_note)? note(tr(p,lang,a.yield_gap_note)) : '')
          + (S(a.peg_note)? note(tr(p,lang,a.peg_note)) : '');
      })()
    /* The reconciliation ladder. A check that does not tie is a finding. */
    + (arr(val.reconciliation).length
      ? '<div class="ir-sub">'+e(L(lang,'reconciliation'))+'</div>'
        + T2([L(lang,'check_lbl'), L(lang,'result_lbl'), L(lang,'note')],
            arr(val.reconciliation).map(function(x){
              var bad = /does not tie/i.test(S(x.result));
              return { cells:['<span class="en">'+e(tr(p,lang,x.check))+'</span>',
                       ragPill(x.result, lang),
                       '<span class="mut">'+e(tr(p,lang,x.note))+'</span>'] }; }))
      : '')
    /* The contract calls these question / answer / evidence. The old code read
       test / label / verdict / value, so the column was blank. */
    + (arr(val.discipline).length
      ? T2([L(lang,'parameter'), L(lang,'assessment'), L(lang,'evidence')], arr(val.discipline).map(function(x){
          return { cells:[e(tr(p,lang,x.question||x.test||x.label)),
                   '<b>'+e(A(lang,x.answer||x.verdict||x.value))+'</b>',
                   '<span class="mut">'+e(tr(p,lang,x.evidence))+'</span>'] }; }))
      : ''),
    S(val.verdict) ? A(lang,val.verdict) : '');

  /* 18 peers — columns/rows/cells */
  push('ir_peers', L(lang,'ir_peers'),
      (chartPeers(p, lang) ? '<div class="mut" style="margin-bottom:1mm">'+e(L(lang,'pe_compare'))+'</div>'+chartPeers(p, lang) : '')
    + T2(arr(peers.columns).map(function(x){ return tr(p,lang,x); }), arr(peers.rows).map(function(r){
        return { __cls:r.is_subject?'hi':'', cells:arr(r.cells).map(function(x){ return '<span class="en">'+e(S(x))+'</span>'; }) };
      }), { num:[1,2,3,4,5,6,7] })
    + note(pick(p,lang,'financials.peers_note', peers.note)));

  /* 19 scenarios */
  var cases = arr(scn.cases);
  push('ir_scen', L(lang,'ir_scen'),
      (cases.length ? chartLadder(cases, ipo.issue_price, lang) : '')
    + T2([L(lang,'case'), L(lang,'fair_value'), L(lang,'upside'), L(lang,'note')],
        cases.map(function(x){
          return { cells:['<b>'+e(A(lang,x.case))+'</b>',
                   '<span class="en">₹'+n(x.value_per_share)+'</span>',
                   pct(x.vs_issue_pct), '<span class="mut">'+e(tr(p,lang,x.assumption))+'</span>'] }; }), { num:[1,2] })
    + note(pick(p,lang,'financials.scenarios_note', scn.note)));

  /* 20 listing gain */
  var lg = ipo.listing_gain||{};
  push('ir_lg', L(lang,'ir_lg'),
      T2([L(lang,'component'), L(lang,'max'), L(lang,'score'), L(lang,'basis')],
        arr(lg.components).map(function(x){
          return { cells:[e(tr(p,lang,x.factor)), n(x.max), '<b>'+n(x.score,0)+'</b>',
                   '<span class="mut">'+e(tr(p,lang,x.note))+'</span>'] }; })
        .concat(arr(lg.components).length ? [{ __cls:'tot', cells:[L(lang,'lg_score'),'100','<b>'+n(lg.score,0)+'</b>',''] }] : []),
        { num:[1,2] })
    + note(tr(p,lang,lg.verdict)));

  /* 21 SWOT analysis / red flags */
  push('swot_analysis', L(lang,'str_weak'), swotGrid(p, lang, 6));
  push('red_flags', L(lang,'red_flags'),
    T2([L(lang,'red_flag'), L(lang,'evidence'), L(lang,'severity')], arr(d.red_flags).map(function(x,i){
      var gg = arr(pick(p,lang,'decision.red_flags', []))[i]||{};
      return { cells:['<b>'+e(safeTr(S(x.flag), S(gg.flag)||S(x.flag)))+'</b>',
        '<span class="mut">'+e(safeTr(S(x.evidence), S(gg.evidence)||S(x.evidence)))+'</span>',
        '<span class="pill '+sevClass(x.severity)+'">'+e(A(lang,x.severity))+'</span>'] }; })));

  /* 22 catalysts, failure modes, monitoring */
  /* These three tables read field names that the contract never had — timing,
     trigger, frequency, threshold — so their columns came out blank in every
     institutional report. They now read the contract's own names, with the old
     ones kept as fallbacks. */
  push('ir_catalysts', L(lang,'ir_catalysts'),
    T2([L(lang,'catalyst'), L(lang,'mechanism'), L(lang,'priority')], arr(d.catalysts).map(function(x){
      return { cells:['<b>'+e(tr(p,lang,x.catalyst))+'</b>',
               '<span class="mut">'+e(tr(p,lang,x.mechanism||x.note))+'</span>',
               ragPill(x.priority||x.timing, lang, 'quality')] }; })),
    '', arr(d.catalysts).length);
  push('ir_fail', L(lang,'ir_fail'),
    T2([L(lang,'scenario'), L(lang,'probability'), L(lang,'impact'), L(lang,'warning_sign')],
      arr(d.failure_modes).map(function(x){
        return { cells:['<b>'+e(tr(p,lang,x.scenario||x.mode||x.path))+'</b>',
                 ragPill(x.probability, lang, 'risk'),
                 ragPill(x.impact, lang, 'risk'),
                 '<span class="mut">'+e(tr(p,lang,x.warning_sign||x.trigger||x.note))+'</span>'] }; })),
    '', arr(d.failure_modes).length);
  push('ir_monitor', L(lang,'ir_monitor'),
    T2([L(lang,'metric'), L(lang,'current'), L(lang,'desired'), L(lang,'warning')],
      arr(d.monitoring).map(function(x){
        return { cells:[e(tr(p,lang,x.metric)),
                 '<b class="en">'+e(tr(p,lang,x.current))+'</b>',
                 '<span class="mut">'+e(tr(p,lang,x.desired||x.threshold))+'</span>',
                 '<span class="mut">'+e(tr(p,lang,x.warning))+'</span>'] }; })),
    '', arr(d.monitoring).length);

  /* 23 allocation and levels */
  push('ir_alloc', L(lang,'ir_alloc'),
      note(pick(p,lang,'decision.allocation_note', d.allocation_note))
    + T2([L(lang,'action'), L(lang,'price'), L(lang,'rationale')], levelsOf(p,lang,d).map(function(x){
        return { cells:[e(tr(p,lang,x.action)), '<b class="en">'+e(S(x.price))+'</b>',
                 '<span class="mut">'+e(tr(p,lang,x.rationale))+'</span>'] }; })));

  /* ---------------- deep research ---------------- */
  function deepTable(key, title, cols, rowsFn, opts){
    var blk = dp[key]||{};
    var rows = rowsFn(blk);
    /* No rows means no section. A heading over a sentence saying the figure was
       not found is dead space; the limitation belongs in the source audit. */
    push(key, title, note(tr(p,lang,blk.note)) + T2(cols, rows, opts), '', rows.length);
  }

  /* Litigation — the section most likely to change a decision, and the one
     that used to depend on the prospectus. Indian Kanoon and the tribunal
     portals carry the material matters, so it is sourced from the web now. */
  var lit = dp.litigation||{}, lmat = arr(lit.matters);
  push('ir_litigation', L(lang,'ir_litigation'),
      note(tr(p,lang,lit.note))
    + ((lit.disputed_total_cr!=null || lit.pct_of_net_worth!=null)
      ? '<div class="tiles">'
        + '<div class="tile"><div class="k">'+e(L(lang,'disputed_total'))+'</div><div class="v en">'
          + cr(lit.disputed_total_cr)+'</div></div>'
        + '<div class="tile"><div class="k">'+e(L(lang,'pct_net_worth'))+'</div><div class="v" style="color:'
          + (Number(lit.pct_of_net_worth)>=10?'var(--bad)':'var(--ink)')+'">'+pct(lit.pct_of_net_worth,1)+'</div></div>'
        + '<div class="tile"><div class="k">'+e(L(lang,'pct_pat'))+'</div><div class="v">'+pct(lit.pct_of_pat,1)+'</div></div></div>'
      : '')
    + T2([L(lang,'forum'), L(lang,'against'), L(lang,'matter'), L(lang,'amount'), L(lang,'status')],
        lmat.map(function(x){
          return { cells:['<span class="en">'+e(S(x.forum))+'</span>', e(A(lang,x.against)),
                   '<span class="mut">'+e(tr(p,lang,x.matter))+'</span>',
                   '<b class="en">'+cr(x.amount_cr)+'</b>',
                   ragPill(x.status, lang)] }; }), { num:[3] })
    + note(tr(p,lang,lit.verdict)), '', lmat.length);

  /* Credit profile — the rating agency sees things the accounts do not show. */
  var cr_ = dp.credit||{}, fac = arr(cr_.facilities), sens = arr(cr_.sensitivities);
  /* Fixed reading order for the credit lines: what the agency says, then the
     size of the balance sheet, then how geared it is, then how comfortably the
     interest is covered. Net worth and borrowings are pulled from the financial
     block so the section stands on its own. */
  var latestYr = arr(f.years).length ? S(arr(f.years).slice(-1)[0]) : '';
  var nwSeries = rowSeries(arr(f.rows), /net\s*worth|shareholders.? funds|total equity/i) || [];
  var dbSeries = rowSeries(arr(f.rows), /total borrowings|total debt|borrowings/i) || [];
  var netWorth = nwSeries.length ? nwSeries[nwSeries.length-1] : null;
  var totDebt  = dbSeries.length ? dbSeries[dbSeries.length-1] : null;
  if(totDebt == null) arr(cr_.facilities), (function(){
    var tb = arr((dp.balance_sheet||{}).borrowings).filter(function(x){ return /total borrowings/i.test(S(x.label)); })[0];
    if(tb) totDebt = tb.fy26 != null ? tb.fy26 : (tb.fy25 != null ? tb.fy25 : tb.fy24);
  })();
  var dEq = (dp.issue_structure||{}).debt_equity;
  if(dEq == null && netWorth && totDebt != null) dEq = totDebt / netWorth;
  push('ir_credit', L(lang,'ir_credit'),
      note(tr(p,lang,cr_.note))
    + kv([[L(lang,'rating_lbl'), S(cr_.rating)? '<span class="en">'+e(S(cr_.rating))+'</span>' : null],
          [L(lang,'outlook_lbl'), S(cr_.outlook)? e(A(lang,cr_.outlook)) : null],
          [L(lang,'net_worth'), netWorth!=null? '<span class="en">'+cr(netWorth)+'</span>' : null],
          [L(lang,'total_borrowings') + (latestYr? ' '+L(lang,'as_at')+' '+latestYr : ''),
            totDebt!=null? '<span class="en">'+cr(totDebt)+'</span>' : null],
          ['D / E', dEq!=null? '<span class="en">'+n(dEq,2)+'x</span>' : null],
          ['Debt / EBITDA', cr_.debt_ebitda!=null? '<span class="en">'+n(cr_.debt_ebitda,2)+'x</span>' : null],
          [L(lang,'interest_cover'), cr_.interest_cover!=null? '<span class="en">'+n(cr_.interest_cover,2)+'x</span>' : null]])
    + (fac.length ? T2([L(lang,'facility'), L(lang,'limit_lbl'), L(lang,'note')], fac.map(function(x){
        return { cells:[e(A(lang,x.type)), '<b class="en">'+cr(x.limit_cr)+'</b>',
                 '<span class="mut">'+e(tr(p,lang,x.note))+'</span>'] }; }), { num:[1] }) : '')
    + (sens.length ? T2([L(lang,'parameter'), L(lang,'trigger_lbl')], sens.map(function(x){
        return { cells:['<span class="pill '+(/upgr/i.test(S(x.direction))?'rag5':'rag1')+'">'
                   + e(A(lang,x.direction))+'</span>',
                 '<span class="mut">'+e(tr(p,lang,x.trigger))+'</span>'] }; })) : ''),
    '', fac.length + sens.length + (S(cr_.rating)?1:0));

  /* Group structure — replaces the related-party amounts, which are RHP-only. */
  var grp = dp.group_structure||{}, ents = arr(grp.entities);
  push('ir_group', L(lang,'ir_group'),
      note(tr(p,lang,grp.note))
    + T2([L(lang,'entity'), L(lang,'stake'), L(lang,'basis_lbl'), L(lang,'activity')],
        ents.map(function(x){
          return { cells:['<b class="en">'+e(S(x.name))+'</b>', pct(x.stake_pct,2),
                   e(A(lang,x.basis)), '<span class="mut">'+e(tr(p,lang,x.activity))+'</span>'] }; }),
        { num:[1] })
    + note(tr(p,lang,grp.related_party_note)), '', ents.length);

  /* Issue structure signals — arithmetic on figures already in the payload. */
  var isk = dp.issue_structure||{}, osp = isk.objects_split||{}, pca = isk.promoter_cost_of_acquisition||{},
      dlt = isk.drhp_delta||{};
  /* Where the money comes FROM. The issue is a cash inflow, and its two parts
     must add to the issue size — if they do not, the report says so rather than
     drawing a pie that quietly disagrees with the snapshot above it. */
  push('ir_issue_kpi', L(lang,'ir_inflow'),
      pieAside([
        { label:S(L(lang,'fresh_issue')), value:freshCr },
        { label:S(L(lang,'ofs')),         value:ofsCr }],
        note(tr(p,lang,isk.note))
        + kv([[L(lang,'issue_size'), '<span class="en">'+cr(issueCr)+'</span>'],
              [L(lang,'fresh_issue'), '<span class="en">'+cr(freshCr)+'</span>'],
              [L(lang,'ofs'), '<span class="en">'+cr(ofsCr)+'</span>'],
              [L(lang,'cashout'), isk.promoter_cashout_pct!=null
                ? '<b style="color:'+(Number(isk.promoter_cashout_pct)>=70?'var(--s5-1)':'var(--ink)')+'">'
                  + pct(isk.promoter_cashout_pct,1)+'</b>'
                : (issueCr ? '<b>'+pct(ofsCr/issueCr*100,1)+'</b>' : null)],
              [L(lang,'fresh_of_mcap'), isk.fresh_pct_of_market_cap!=null
                ? pct(isk.fresh_pct_of_market_cap,1) : null],
              [L(lang,'cost_of_acq'), pca.multiple!=null
                ? '<span class="en">'+n(pca.multiple,1)+'x  (₹'+n(pca.weighted_avg)+' → ₹'+n(pca.issue_price)+')</span>'
                : null]])
        + (inflowGap > 0.5 ? '<div class="note bad"><b>'+e(L(lang,'does_not_tie'))+'</b> '
            + e(L(lang,'inflow_gap'))+' <span class="en">'+cr(inflowGap)+'</span></div>' : '')
        + (S(pca.note)? note(tr(p,lang,pca.note)) : '')
        + (dlt.changed ? '<div class="note"><b>'+e(L(lang,'drhp_delta'))+'</b> '+e(tr(p,lang,dlt.note))+'</div>' : '')
        + (S(isk.recent_bonus_or_placement)? note(tr(p,lang,isk.recent_bonus_or_placement)) : ''),
        { centre:cr(issueCr), centreSub:L(lang,'issue_size') }),
    '', (freshCr + ofsCr) > 0 ? 1 : 0);

  /* Concentration — what replaces the top-1 and top-5 customer detail. */
  var cn = dp.concentration||{};
  function cnTable(list, cols, k1, k2){
    return arr(list).length ? T2(cols, arr(list).map(function(x){
      return { cells:[e(tr(p,lang,x[k1])), pct(x[k2],1)] }; }), { num:[1] }) : '';
  }
  push('ir_concentration', L(lang,'ir_concentration'),
      '<div class="ir-conc">' + note(tr(p,lang,cn.note))
    + (arr(cn.customers).length
      ? T2([L(lang,'year'), L(lang,'top10_customers')], arr(cn.customers).map(function(x){
          return { cells:['<span class="en">'+e(S(x.year))+'</span>', pct(x.top10_pct,1)] }; }), { num:[1] })
      : '')
    + cnTable(cn.raw_materials, [L(lang,'input_lbl'), L(lang,'of_purchases')], 'input', 'pct_of_purchases')
    + cnTable(cn.end_markets, [L(lang,'end_market'), L(lang,'of_revenue')], 'market', 'pct_of_revenue')
    + cnTable(cn.geography, [L(lang,'region_lbl'), L(lang,'of_revenue')], 'region', 'pct_of_revenue')
    + '</div>',
    '', arr(cn.customers).length + arr(cn.raw_materials).length
        + arr(cn.end_markets).length + arr(cn.geography).length);

  /* Products and services — the breakdown, not the reporting segments. */
  var prods = arr(c.products);
  push('ir_products', L(lang,'ir_products'),
      (prods.length && prods.some(function(x){ return x.revenue_pct != null; })
        ? chartPeerBars(prods.filter(function(x){ return x.revenue_pct != null; })
            .map(function(x){ return { label:S(tr(p,lang,x.name)), value:Number(x.revenue_pct)||0 }; }),
            { suffix:'%', h:Math.max(90, prods.length*22) })
        : '')
    + T2([L(lang,'product'), L(lang,'what_it_is'), L(lang,'customers'),
          L(lang,'rev_share'), L(lang,'margin_profile')],
        prods.map(function(x){
          return { cells:['<b>'+e(tr(p,lang,x.name))+'</b>',
                   '<span class="mut">'+e(tr(p,lang,x.what_it_is))+'</span>',
                   '<span class="mut">'+e(tr(p,lang,x.customers))+'</span>',
                   x.revenue_pct!=null? pct(x.revenue_pct,1) : '—',
                   '<span class="mut">'+e(A(lang,x.margin_profile))+'</span>'] }; }), { num:[3] }), '', prods.length);

  /* Operating metrics — CAC, cash conversion cycle, customer concentration. */
  var om = dp.operating_metrics||{}, omr = arr(om.rows);
  push('ir_opmetrics', L(lang,'ir_opmetrics'),
      note(tr(p,lang,om.note))
    + T2([L(lang,'metric'), L(lang,'value_lbl')]
          .concat(arr(f.years).length?arr(f.years):['FY24','FY25','FY26'])
          .concat([L(lang,'basis_tag')]),
        omr.map(function(x){
          return { cells:['<b>'+e(tr(p,lang,x.metric))+'</b>',
                   '<span class="en">'+e(S(x.value)||'—')+'</span>',
                   n(x.fy24,2), n(x.fy25,2), n(x.fy26,2),
                   '<span class="mut">'+e(A(lang,x.tag||''))
                     + (S(x.note)? ' — '+e(tr(p,lang,x.note)) : '')+'</span>'] }; }),
        { num:[2,3,4] }), '', omr.length);

  /* Balance sheet — assets, borrowings, and what the debt actually costs. */
  var bs = dp.balance_sheet||{}, bsa = arr(bs.assets), bsb = arr(bs.borrowings), dpf = bs.debt_profile||{};
  var yrs = arr(f.years).length?arr(f.years):['FY24','FY25','FY26'];
  function bsRows(list){
    return list.map(function(x){
      return { cells:[e(tr(p,lang,x.label)), n(x.fy24,2), n(x.fy25,2), n(x.fy26,2),
               '<span class="mut">'+e(tr(p,lang,x.note))+'</span>'] }; });
  }
  push('ir_bsheet', L(lang,'ir_bsheet'),
      note(tr(p,lang,bs.note))
    + (bsa.length ? '<div class="ir-sub">'+e(L(lang,'assets_h'))+'</div>'
        + chartColumns(bsa.map(function(x){ return S(tr(p,lang,x.label)); }),
            bsa.map(function(x){ return x.fy26; }),
            { h:150, colour:CH.navy2, fmt:function(x){ return n(x,0); } })
        + T2([L(lang,'assets_h')].concat(yrs).concat([L(lang,'basis')]), bsRows(bsa), { num:[1,2,3] }) : '')
    + (bsb.length ? '<div class="ir-sub">'+e(L(lang,'borrowings_h'))+'</div>'
        + T2([L(lang,'borrowings_h')].concat(yrs).concat([L(lang,'basis')]), bsRows(bsb), { num:[1,2,3] }) : '')
    + ((dpf.cost_of_debt_pct!=null || dpf.debt_equity!=null || dpf.interest_cover!=null
        || dpf.repayment_from_ipo_cr!=null || S(dpf.note))
      ? '<div class="ir-sub">'+e(L(lang,'debt_profile'))+'</div>'
        + kv([[L(lang,'cost_of_debt'), dpf.cost_of_debt_pct!=null? pct(dpf.cost_of_debt_pct,2):null],
              ['D / E', dpf.debt_equity!=null? n(dpf.debt_equity,2)+'x':null],
              [L(lang,'interest_cover'), dpf.interest_cover!=null? n(dpf.interest_cover,2)+'x':null],
              [L(lang,'repaid_from_ipo'), dpf.repayment_from_ipo_cr!=null? cr(dpf.repayment_from_ipo_cr):null]])
        + note(tr(p,lang,dpf.note))
      : '')
    + note(tr(p,lang,bs.working_capital_note)),
    '', bsa.length + bsb.length);

  var ue = dp.unit_economics||{};
  push('dp_unit', L(lang,'dp_unit'),
      note(tr(p,lang,ue.note))
    + T2([L(lang,'metric')].concat(arr(f.years).length?arr(f.years):['FY24','FY25','FY26']).concat([L(lang,'unit')]),
        arr(ue.rows).map(function(x){
          return { cells:[e(tr(p,lang,x.metric)), n(x.fy24,2), n(x.fy25,2), n(x.fy26,2),
                   '<span class="mut en">'+e(S(x.unit))+'</span>'] }; }), { num:[1,2,3] }), '', arr(ue.rows).length);

  var wc = dp.working_capital||{}, wd = arr(wc.days);
  push('dp_wc', L(lang,'dp_wc'),
      note(tr(p,lang,wc.note))
    + (wd.length ? chartColumns(wd.map(function(x){ return S(tr(p,lang,x.label)).split(' ')[0]; }),
        wd.map(function(x){ return x.fy26; }), { h:140, colour:CH.navy2, fmt:function(x){ return n(x,0); } }) : '')
    + T2([L(lang,'metric')].concat(arr(f.years).length?arr(f.years):['FY24','FY25','FY26']),
        wd.map(function(x){
          return { cells:[e(tr(p,lang,x.label)), n(x.fy24,0), n(x.fy25,0), n(x.fy26,0)] }; }), { num:[1,2,3] }),
    '', wd.filter(function(x){ return x.fy24!=null || x.fy25!=null || x.fy26!=null; }).length);

  var qt = dp.quarterly||{};
  push('dp_quarterly', L(lang,'dp_quarterly'),
      note(tr(p,lang,qt.note))
    + (arr(qt.periods).length
      ? chartColumnsLine(arr(qt.periods), arr(qt.revenue), arr(qt.pat),
          { barColour:CH.navy2, lineColour:CH.gold, h:165 })
        + chartLegend([{ label:L(lang,'revenue_lbl'), colour:CH.navy2 },
                       { label:L(lang,'pat_lbl'), colour:CH.gold }]) : ''), '', arr(qt.periods).length);

  deepTable('capital_allocation', L(lang,'dp_capalloc'),
    [L(lang,'year'), L(lang,'action'), L(lang,'amount'), L(lang,'outcome')],
    function(b){ return arr(b.history).map(function(x){
      return { cells:['<span class="en">'+e(S(x.year))+'</span>', e(tr(p,lang,x.action)),
               '<span class="en">'+cr(x.amount_cr)+'</span>',
               '<span class="mut">'+e(tr(p,lang,x.outcome))+'</span>'] }; }); }, { num:[2] });

  deepTable('related_party', L(lang,'dp_rpt'),
    [L(lang,'party'), L(lang,'nature'), L(lang,'amount'), L(lang,'concern')],
    function(b){ return arr(b.items).map(function(x){
      var cc = S(x.concern).toUpperCase();
      return { cells:['<b>'+e(tr(p,lang,x.party))+'</b>', e(tr(p,lang,x.nature)),
        '<span class="en">'+cr(x.amount_cr)+'</span>',
        ragPill(x.concern, lang, 'risk')] }; }); }, { num:[2] });

  deepTable('contingent', L(lang,'dp_contingent'),
    [L(lang,'line_item'), L(lang,'amount'), L(lang,'status')],
    function(b){ return arr(b.items).map(function(x){
      return { cells:[e(tr(p,lang,x.item)), '<span class="en">'+cr(x.amount_cr)+'</span>',
               '<span class="mut">'+e(tr(p,lang,x.status))+'</span>'] }; }); }, { num:[1] });

  deepTable('regulatory', L(lang,'dp_regulatory'),
    [L(lang,'parameter'), L(lang,'impact'), L(lang,'note')],
    function(b){ return arr(b.items).map(function(x){
      var im = S(x.impact);
      return { cells:[e(tr(p,lang,x.rule)),
        ragPill(x.impact, lang),
        '<span class="mut">'+e(tr(p,lang,x.note))+'</span>'] }; }); });

  var cmx = (dp.competition||{}).matrix||{};
  push('dp_competition', L(lang,'dp_competition'),
      note(tr(p,lang,(dp.competition||{}).note))
    + T2(arr(cmx.columns).map(function(x){ return tr(p,lang,x); }), arr(cmx.rows).map(function(r){
        return { __cls:r.is_subject?'hi':'', cells:['<b class="en">'+e(S(r.name))+'</b>']
          .concat(arr(r.cells).map(function(x){ return '<span class="mut">'+e(tr(p,lang,x))+'</span>'; })) }; })),
    '', arr(cmx.rows).length);

  var rd = dp.reverse_dcf||{};
  push('dp_rdcf', L(lang,'dp_rdcf'),
      note(tr(p,lang,rd.note))
    + ((rd.implied_growth_pct!=null || rd.implied_margin_pct!=null)
      ? '<div class="tiles">'
        + '<div class="tile"><div class="k">'+e(L(lang,'implied_growth'))+'</div><div class="v">'+pct(rd.implied_growth_pct)+'</div></div>'
        + '<div class="tile"><div class="k">'+e(L(lang,'dp_implied_margin'))+'</div><div class="v">'+pct(rd.implied_margin_pct)+'</div></div>'
        + '<div class="tile"><div class="k">'+e(L(lang,'dp_horizon'))+'</div><div class="v en">'+n(rd.horizon_years,0)+'</div></div></div>' : '')
    + T2([L(lang,'driver'), L(lang,'value'), L(lang,'note')], arr(rd.assumptions).map(function(x){
        return { cells:[e(tr(p,lang,x.driver)), '<b class="en">'+e(S(x.value))+'</b>',
                 '<span class="mut">'+e(tr(p,lang,x.comment))+'</span>'] }; }))
    + note(tr(p,lang,rd.verdict)),
    '', (rd.implied_growth_pct!=null || rd.implied_margin_pct!=null) ? 1 : arr(rd.assumptions).length);

  var sen = dp.sensitivity||{};
  push('dp_sensitivity', L(lang,'dp_sensitivity'),
      note(tr(p,lang,sen.note))
    + (arr(sen.rows).length ? chartHeat(arr(sen.columns), arr(sen.rows).map(function(r){
        return { label:S(tr(p,lang,r.label)), cells:arr(r.cells) }; }), lang)
      + '<div class="mut" style="font-size:8.4pt">'+e(S(tr(p,lang,sen.row_label)))+' × '
        + e(S(tr(p,lang,sen.col_label)))+'</div>' : ''), '', arr(sen.rows).length);

  deepTable('management_quality', L(lang,'dp_mgmt'),
    [L(lang,'parameter'), L(lang,'assessment'), L(lang,'evidence')],
    function(b){ return arr(b.items).map(function(x){
      return { cells:[e(tr(p,lang,x.trait)),
        ragPill(x.assessment, lang, 'quality'),
        '<span class="mut">'+e(tr(p,lang,x.evidence))+'</span>'] }; }); });

  push('dp_cases', L(lang,'dp_cases'),
      (S(dp.bull_case_detail) ? '<div class="note ok"><b>'+e(L(lang,'dp_bull'))+'</b><br>'+e(tr(p,lang,dp.bull_case_detail))+'</div>' : '')
    + (S(dp.bear_case_detail) ? '<div class="note bad" style="margin-top:2.5mm"><b>'+e(L(lang,'dp_bear'))+'</b><br>'+e(tr(p,lang,dp.bear_case_detail))+'</div>' : ''));
  push('dp_change_mind', L(lang,'dp_change_mind'), ul(arr(dp.what_would_change_our_mind).map(function(x){ return e(tr(p,lang,x)); })));
  push('dp_questions', L(lang,'dp_questions'), ul(arr(dp.key_questions_for_management).map(function(x){ return e(tr(p,lang,x)); })));

  /* ---------------- the 100-point score ----------------
     Emitted as one visual block plus one small table per scoring group, so it
     flows across pages instead of being a single slab that cannot be split.
     Two pages, not three. Basis is the last column, as asked. */
  var total = 0; BLOCKS.forEach(function(bk){ total += blockScore(p,bk); });
  /* The institutional report uses the same 100-point section as the company
     report — one implementation, so the two cannot drift apart again. The
     per-block basis tables it used to print are replaced by the compact
     grid, which carries the marks inline. */
  push('ir_score', L(lang,'ir_score'), scoreSection(p, lang), '', 1);

  push('ir_sources', L(lang,'ir_sources'),
      (arr(src.primary).length ? '<div class="note"><b>'+e(L(lang,'primary'))+'</b> '
        + arr(src.primary).map(function(x){ return '<span class="en">'+e(S(x))+'</span>'; }).join(' · ')+'</div>' : '')
    + (arr(src.secondary).length ? '<div class="note"><b>'+e(L(lang,'secondary'))+'</b> '
        + arr(src.secondary).map(function(x){ return '<span class="en">'+e(S(x))+'</span>'; }).join(' · ')+'</div>' : '')
    + T2([L(lang,'point'), 'A', 'B', L(lang,'decision')], arr(src.conflicts).map(function(x){
        return { cells:[e(tr(p,lang,x.point)), e(tr(p,lang,x.a)), e(tr(p,lang,x.b)),
                 '<span class="mut">'+e(tr(p,lang,x.decision))+'</span>'] }; }))
    + (arr(src.missing).length ? '<div class="mut" style="margin-top:2mm"><b>'+e(L(lang,'ir_missing'))+'</b></div>'
        + ul(arr(src.missing).map(function(x){ return e(tr(p,lang,x)); })) : ''));

  /* ---------------- assemble in the reading order ----------------
     Sections are built above in whatever order the data happens to sit in the
     payload, then emitted here grouped under headings. The order below is the
     one the report is meant to read in: what the issue is, what it is worth,
     what the business is, what the numbers say, who runs it, and what could
     go wrong. Anything not named here is deliberately not printed — the
     framework still gathers it and the payload still carries it. */
  var byKey = {};
  BLK.forEach(function(x){ byKey[x.key] = x; });

  IR_GROUPS.forEach(function(grp){
    var members = grp[1].map(function(k){ return byKey[k]; }).filter(Boolean);
    if(!members.length) return;
    /* The heading travels with the first section under it. On its own it was a
       block the packer could leave stranded at the foot of a page, which is
       where the empty strip after "The IPO" came from. */
    TITLES.push({ heading: L(lang, grp[0]) });
    var pending = '<div class="ir-grp"><div class="ir-grph">'+e(L(lang, grp[0]))+'</div></div>';
    members.forEach(function(m){
      NO++;
      var no = (NO<10?'0':'')+NO;
      B.push('<div class="ir-blk" id="s'+no+'">' + pending + sec(no, m.title) + m.body + '</div>');
      pending = '';
      TITLES.push({ no:no, title:m.title });
      delete byKey[m.key];
    });
  });
  return { B:B, TITLES:TITLES, present:present };
}

  /* one canonical pass in English decides the structure; then render */
  var probe = irSections('en', null);
  var built = (lang === 'en') ? probe : irSections(lang, probe.present);
  var B = built.B, TITLES = built.TITLES;

  /* Contents is the first page, so it doubles as the cover: masthead, the four
     headline tiles, then the sections grouped under their headings with the
     page number each one lands on. Rows are anchors, so a click in the PDF
     jumps to the section. */
  var sc0 = (p.verdict||{}).scores||{}, bands0 = (p.verdict||{}).score_bands||{};
  var tocPage = '<div style="height:3mm"></div>'
    + '<div class="eyebrow en">'+EN(e(L('en','ir_title')))+' &nbsp;·&nbsp; '
      + e(A(lang,m.ipo_type||'Mainboard'))+' &nbsp;·&nbsp; '+e(L(lang,'india'))+'</div>'
    + '<h1 class="en" style="margin-top:1.5mm;font-size:19pt">'+e(m.company||'')+'</h1>'
    + '<div class="mut" style="margin-top:1mm;font-size:8pt">'+sectorHtml(p,lang)
      + (m.sector?' &nbsp;·&nbsp; ':'')+e(dmy(m.analysis_datetime))+'</div>'
    + '<div style="height:2.5mm;background:var(--gold);width:26mm;border-radius:1mm;margin:3mm 0 4mm"></div>'
    + '<div class="tiles">'
      + [['ipo_quality','/100'],['long_term','/100'],['listing_gain','/100']].map(function(t){
          return '<div class="tile"><div class="k">'+e(L(lang,t[0]))+'</div><div class="v">'+n(sc0[t[0]],1)
            +'<small>'+t[1]+'</small></div><div class="s">'+e(A(lang, bands0[t[0]]||bandOf(sc0[t[0]])))+'</div></div>';
        }).join('')
      + gmpTile(p.ipo||{}, lang)
      + '<div class="tile"><div class="k">'+e(L(lang,'allocation'))+'</div><div class="v">'
        + e((p.verdict||{}).allocation_band||'—')+'</div><div class="s">'+e(L(lang,'of_portfolio'))+'</div></div>'
    + '</div>'
    + sec('', L(lang,'ir_contents'))
    + '<div class="ir-toc">' + TITLES.map(function(t){
        return t.heading
          ? '<div class="ir-toc-grp">'+e(t.heading)+'</div>'
          : '<a class="ir-toc-row" href="#s'+t.no+'"><span class="en">'+t.no+'</span>'
            + '<b>'+e(t.title)+'</b><i class="ir-toc-pg en" data-for="s'+t.no+'"></i></a>';
      }).join('') + '</div>';

  var shells = page(p, 1, 25, L('en','ir_title'),
      '<div class="ir-toc-page">'+tocPage+'</div><div class="grow"></div>',
      lang, L('en','doc_inst'));
  for(var i = 2; i <= 34; i++){
    shells += page(p, i, 25, L('en','ir_title'),
      '<div class="ir-box">' + (i === 2 ? B.join('') : '') + '</div><div class="grow"></div>',
      lang, L('en','doc_inst'));
  }

  var CSS2 = '\n.ir-blk{ break-inside:avoid; margin-bottom:4.5mm; }\n'
    + '.ir-blk table{ margin-bottom:1.5mm; font-size:8.8pt; }\n'
    + '.ir-blk td,.ir-blk th{ padding-top:2.1mm; padding-bottom:2.1mm; }\n'
    + 'body.gu .ir-blk td,body.gu .ir-blk th{ padding-top:1.8mm; padding-bottom:1.8mm; }\n'
    + '.ir-blk .sec{ margin:5mm 0 2.5mm; }\n'
    + '.ir-blk .ti{ font-size:11.5pt; }\n'
    + '.ir-blk .note{ font-size:9pt; line-height:1.55; margin-top:2mm; }\n'
    + 'body.gu .ir-blk .note{ line-height:1.72; }\n'
    + '.ir-blk .lead{ font-size:10pt; line-height:1.55; }\n'
    + '.ir-ul{ margin:2mm 0 2.5mm 5mm; padding:0; }\n'
    + '.ir-ul li{ margin:1.9mm 0; line-height:1.55; font-size:9.2pt; }\n'
    + 'body.gu .ir-ul li{ line-height:1.75; }\n'
    + '.ir-grp{ break-inside:avoid; margin:5mm 0 1mm; }\n'
    + '.ir-grp:first-child{ margin-top:0; }\n'
    + '.ir-grph{ font-size:15pt; font-weight:800; letter-spacing:-.01em; color:var(--gold);'
    + ' padding-bottom:2mm; border-bottom:1.6pt solid var(--gold); }\n'
    + 'body.gu .ir-grph{ font-size:14pt; }\n'
    + '.ir-sub{ font-size:8.6pt; font-weight:800; color:var(--navy); letter-spacing:.03em;'
    + ' text-transform:uppercase; margin:3.5mm 0 1.5mm; }\n'
    + '.ir-toc{ margin-top:2mm; column-count:2; column-gap:8mm; }\n'
    + '.ir-toc-row{ display:flex; gap:3mm; align-items:baseline; padding:1.15mm 0;'
    + ' border-bottom:.4pt solid var(--rule); font-size:8pt; text-decoration:none; color:inherit;'
    + ' break-inside:avoid; -webkit-column-break-inside:avoid; }\n'
    + '.ir-toc-row span{ color:var(--ink4); font-weight:700; flex:0 0 6.5mm; }\n'
    + '.ir-toc-row b{ flex:1; font-weight:600; }\n'
    + '.ir-toc-row .ir-toc-pg{ font-style:normal; color:var(--ink4); font-weight:700;'
    + ' flex:0 0 6mm; text-align:right; }\n'
    + '.ir-toc-grp{ font-size:9.2pt; font-weight:800; color:var(--gold); letter-spacing:.02em;'
    + ' margin:3mm 0 1mm; padding-bottom:.8mm; border-bottom:1pt solid var(--gold);'
    + ' break-inside:avoid; -webkit-column-break-inside:avoid; }\n'
    + '.ir-toc-grp:first-child{ margin-top:0; }\n'
    + '.ir-scoreblk{ margin-bottom:2.5mm; }\n'
    + '.ir-scorehd{ display:flex; justify-content:space-between; align-items:baseline;'
    + ' font-size:9.4pt; font-weight:800; color:var(--navy); padding:1.5mm 0 1mm;'
    + ' border-bottom:.8pt solid var(--navy); }\n'
    + '.ir-score{ width:100%; border-collapse:collapse; font-size:8.2pt; }\n'
    + '.ir-score td{ padding:1.3mm 2mm; border-bottom:.4pt solid var(--rule); vertical-align:top; }\n'
    + '.ir-score td.nm{ width:33mm; }\n'
    + '.ir-score td.bar-c{ width:22mm; }\n'
    + '.ir-score td.n{ text-align:right; white-space:nowrap; width:15mm; font-weight:700; }\n'
    + '.ir-score td.n .mx{ color:var(--ink4); font-weight:500; font-size:7.2pt; }\n'
    + '.ir-score .mini{ display:block; height:2.4mm; background:#EEF1F5; border-radius:1.2mm;'
    + ' overflow:hidden; }\n'
    + '.ir-score .mini i{ display:block; height:100%; border-radius:0 1.2mm 1.2mm 0; }\n'
    + '.ir-score tr.tot td{ background:#EAF0F6; font-weight:800; border-bottom:0; }\n'
    /* Gujarati sets taller than English at the same point size, which pushed the
       scoring section onto a third page. Tightening only the scoring tables
       keeps it to the two pages the brief calls for without touching the rest
       of the document. */
    + 'body.gu .ir-score{ font-size:7.6pt; }\n'
    + 'body.gu .ir-score td{ padding:.85mm 1.6mm; line-height:1.42; }\n'
    + 'body.gu .ir-scorehd{ font-size:8.8pt; padding:1mm 0 .7mm; }\n'
    + 'body.gu .ir-scoreblk{ margin-bottom:1.8mm; }\n'
    + '.ir-box{ display:block; }\n';

  var FIT = '<script>(function(){'
    /* This document packs itself; the generic guard must not scale it again. */
    + 'document.body.setAttribute("data-fitted","1");'
    + 'var ps=[].slice.call(document.querySelectorAll(".page")).slice(1);'
    + 'var boxes=ps.map(function(el){ return el.querySelector(".ir-box"); });'
    + 'function avail(el){ return el.querySelector(".body").clientHeight - 4; }'
    /* Move whatever will not fit on page i onto page i+1. A block taller than a
       whole page is divided at its own child boundaries rather than being left
       to spill, so a long table continues instead of losing its tail. */
    + 'function drain(i){'
      + 'var A=avail(ps[i]), guard=0;'
      + 'while(boxes[i].scrollHeight>A && guard++<600){'
        + 'var kids=boxes[i].querySelectorAll(".ir-blk");'
        + 'if(!kids.length) return false;'
        + 'if(kids.length===1){'
          + 'var only=kids[0];'
          + 'if(only.children.length<2) return false;'
          + 'var carry=document.createElement("div"); carry.className="ir-blk";'
          + 'while(only.scrollHeight>A-8 && only.children.length>1){'
            + 'carry.insertBefore(only.children[only.children.length-1], carry.firstChild); }'
          + 'if(!carry.children.length) return false;'
          + 'boxes[i+1].insertBefore(carry, boxes[i+1].firstChild);'
          + 'continue;'
        + '}'
        + 'boxes[i+1].insertBefore(kids[kids.length-1], boxes[i+1].firstChild);'
      + '}'
      + 'return boxes[i].scrollHeight<=A;'
    + '}'
    + 'for(var i=0;i<ps.length-1;i++) drain(i);'
    /* Grow the document rather than squeeze it. The shells are written before
       anything is measured, so a payload with more prose than usual can fill
       every one of them and still have blocks left over — and `.page` is
       overflow:hidden, which means the surplus does not merely look bad, it is
       gone from the PDF without a trace. A fresh shell is cloned from the last
       one and the overflow drains into it, as many times as it takes. */
    + 'var grow=0;'
    + 'while(boxes[boxes.length-1].scrollHeight>avail(ps[ps.length-1]) && grow++<40){'
      + 'var lastPg=ps[ps.length-1];'
      + 'var np=lastPg.cloneNode(true);'
      + 'var nb=np.querySelector(".ir-box");'
      + 'if(!nb) break;'
      + 'while(nb.firstChild) nb.removeChild(nb.firstChild);'
      + 'lastPg.parentNode.insertBefore(np, lastPg.nextSibling);'
      + 'ps.push(np); boxes.push(nb);'
      + 'if(!drain(ps.length-2)) break;'
    + '}'
    + 'for(var j=ps.length-1;j>=0;j--){'
      + 'if(!boxes[j].children.length) ps[j].parentNode.removeChild(ps[j]);'
    + '}'
    + 'var live=[].slice.call(document.querySelectorAll(".page"));'
    + 'for(var k=0;k<live.length;k++){'
      + 'var t=live[k].querySelector(".pgtot"); if(t) t.textContent=live.length;'
      + 'var nm=live[k].querySelector(".pgnum"); if(nm) nm.textContent=(k+1);'
    + '}'
    /* Last resort, for the one block that is taller than a page and cannot be
       divided. transform:scale is used rather than zoom because html2canvas
       reproduces transform faithfully and zoom corrupts Gujarati advance
       widths. Nothing should reach this now, but overflow:hidden means a page
       that does would lose text silently, so the guard stays. */
    /* ONE factor for the whole document, not one per page. Scaling each page by
       whatever it happened to need is what made type sizes differ from page to
       page — the tightest page sets the factor and every page uses it, so the
       document reads as one document. */
    /* Page 1 carries the contents rather than an .ir-box, so it was outside the
       packer entirely — and a contents list one line too long ran into the
       footer. Every page now offers something scalable: its .ir-box where it has
       one, and otherwise its body content wrapped for the purpose. */
    + 'function target(pg){'
      + 'var bd=pg.querySelector(".body"); if(!bd) return null;'
      + 'var box=bd.querySelector(".ir-box");'
      + 'if(box) return box;'
      + 'if(bd.children.length===1 && bd.firstElementChild.className==="ir-fitwrap")'
        + 'return bd.firstElementChild;'
      + 'var w=document.createElement("div"); w.className="ir-fitwrap";'
      + 'while(bd.firstChild) w.appendChild(bd.firstChild);'
      + 'bd.appendChild(w); return w;'
    + '}'
    + 'var need=1;'
    + 'live.forEach(function(pg){'
      + 'var bd=pg.querySelector(".body"); if(!bd) return;'
      + 'var box=target(pg); if(!box) return;'
      + 'var A=bd.clientHeight-2;'
      + 'if(box.scrollHeight<=A) return;'
      + 'need=Math.min(need, A/box.scrollHeight);'
    + '});'
    + 'if(need<1){'
      + 'var z=Math.max(0.35, Math.floor(need*1000)/1000);'
      + 'live.forEach(function(pg){'
        + 'var bd=pg.querySelector(".body"); if(!bd) return;'
        + 'var box=target(pg); if(!box) return;'
        + 'var A=bd.clientHeight-2;'
        + 'var wrap=document.createElement("div");'
        + 'wrap.style.cssText="height:"+A+"px;overflow:hidden";'
        + 'box.parentNode.insertBefore(wrap, box); wrap.appendChild(box);'
        + 'box.style.width=(100/z)+"%";'
        + 'box.style.transformOrigin="top left";'
        + 'box.style.transform="scale("+z+")";'
      + '});'
    + '}'
    /* Fill the contents with the page each section actually landed on. The
       packing above decides that, so it cannot be known when the HTML is
       written — it has to be measured here, after the blocks have settled. */
    + 'live.forEach(function(pg, idx){'
      + 'pg.querySelectorAll("[id^=s]").forEach(function(el){'
        + 'var cell=document.querySelector(\'.ir-toc-pg[data-for="\'+el.id+\'"]\');'
        + 'if(cell) cell.textContent=(idx+1);'
      + '});'
    + '});'
    + '})();<\/script>';

  return shell(S(m.company)+' — '+L(lang,'ir_title'), lang==='gu'?'gu':'',
    shells, CSS2)
    .replace('<!--FIT-->', FIT);
}

global.IPODocs = { buildReport:buildReport, buildExec:buildExec, buildVisual:buildVisual,
                   buildInstitutional:buildInstitutional,
                   charts:{ financials:chartFinancials, radar:chartRadar, gauge:chartGauge,
                            peers:chartPeers, donut:chartDonut, ladder:chartLadder,
                            columns:chartColumns, columnsLine:chartColumnsLine,
                            waterfall:chartWaterfall, heat:chartHeat },
                   buildScorecard:buildScorecard, BLOCKS:BLOCKS, S:S,
                   guSweep:guSweep, translitGu:translitGu, guWords:guWords };
})(window);
