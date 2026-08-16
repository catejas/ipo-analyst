/* ============================================================================
   IPO Analyst — document renderer
   Turns one payload (schema ipo-analyst/3) into three designed documents:
     buildReport(p, lang)  -> 10-page A4 research report
     buildExec(p, lang)    -> 4-page executive summary
     buildVisual(p, lang)  -> 2-page visual summary
   Every builder returns a complete standalone HTML string.
   Headers, footers, page numbers and financial abbreviations stay in English
   in every language edition; only reader-facing analysis is translated.
   ========================================================================== */
(function (global) {
'use strict';

/* ---------- helpers ---------- */
function e(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){
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
    if(ok && cur != null && cur !== '') return cur;
  }
  return fallback;
}
function toneClass(t){ return t==='good'?'tn-good':t==='bad'?'tn-bad':t==='warn'?'tn-warn':''; }
function sevClass(s){ s=String(s||'').toUpperCase();
  return s==='CRITICAL'?'sv-crit':s==='HIGH'?'sv-high':s==='MEDIUM'?'sv-med':'sv-low'; }
function bandOf(v){ v=Number(v)||0;
  return v>=85?'Exceptional':v>=75?'Strong':v>=65?'Attractive':v>=55?'Selective':v>=45?'Weak':'Avoid'; }
function bandColour(v){ v=Number(v)||0;
  return v>=75?'var(--good)':v>=65?'var(--teal)':v>=55?'var(--warn)':v>=45?'var(--amber)':'var(--bad)'; }

/* ---------- shared chrome ---------- */
var CSS = `
@page{ size:A4; margin:0; }
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --navy:#0F2C52; --navy2:#1B4370; --teal:#00736C; --teal2:#E6F1F0;
  --ink:#12161C; --ink2:#3D4653; --ink3:#6B7480; --ink4:#9AA2AD;
  --rule:#DEDAD2; --rule2:#EDEAE4; --paper:#FFFFFF; --panel:#F7F5F1; --panel2:#FBFAF7;
  --good:#146C43; --teal-b:#00736C; --warn:#8A6100; --amber:#B7791F; --bad:#A32017; --crit:#6E1210;
}
html,body{ background:#E9E7E1; }
body{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; color:var(--ink);
      font-size:8.5pt; line-height:1.45; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
body.gu{ font-family:"Noto Sans Gujarati","Shruti","Gujarati Sangam MN",Helvetica,Arial,sans-serif;
         font-size:8.9pt; line-height:1.72; }
body.gu .en{ font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; line-height:1.4; }
.page{ width:210mm; height:297mm; background:var(--paper); position:relative; overflow:hidden;
       page-break-after:always; display:flex; flex-direction:column; margin:0 auto 8mm; }
.page:last-child{ page-break-after:auto; margin-bottom:0; }
@media print{ html,body{background:#fff;} .page{ margin:0; box-shadow:none; } }
.pad{ padding:0 15mm; }
.body{ flex:1; display:flex; flex-direction:column; padding:0 15mm; overflow:hidden; }

/* running head */
.rh{ display:flex; justify-content:space-between; align-items:center;
     padding:7mm 15mm 3.5mm; border-bottom:.6pt solid var(--rule); }
.rh .l{ font-size:7pt; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--navy); }
.rh .r{ font-size:6.8pt; color:var(--ink3); letter-spacing:.05em; }
.rf{ display:flex; justify-content:space-between; align-items:center;
     padding:3mm 15mm 7mm; border-top:.6pt solid var(--rule); font-size:6.4pt; color:var(--ink4); }
.rf b{ color:var(--ink2); font-weight:700; }

/* type */
h1{ font-size:22pt; line-height:1.1; letter-spacing:-.025em; font-weight:700; }
h2{ font-size:12.5pt; letter-spacing:-.015em; font-weight:700; color:var(--navy); margin-bottom:1mm; }
.sec{ display:flex; align-items:baseline; gap:3mm; margin:5mm 0 2.5mm; }
.sec .no{ font-size:7pt; font-weight:800; color:var(--teal); letter-spacing:.1em; }
.sec .ti{ font-size:10.5pt; font-weight:700; letter-spacing:-.01em; color:var(--navy); }
.sec .ln{ flex:1; height:.6pt; background:var(--rule); }
.lead{ font-size:9pt; line-height:1.55; color:var(--ink2); }
.mut{ font-size:7pt; color:var(--ink3); line-height:1.4; }
.eyebrow{ font-size:6.6pt; font-weight:800; letter-spacing:.19em; text-transform:uppercase; color:var(--teal); }

/* tables */
table{ width:100%; border-collapse:collapse; font-size:7.4pt; }
th{ text-align:left; font-size:6.3pt; font-weight:800; letter-spacing:.09em; text-transform:uppercase;
    color:var(--ink3); padding:2mm 2mm; border-bottom:.9pt solid var(--navy); white-space:nowrap; }
td{ padding:1.9mm 2mm; border-bottom:.5pt solid var(--rule2); vertical-align:top; }
td.n,th.n{ text-align:right; font-variant-numeric:tabular-nums;
           font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; }
tr.hi td{ background:var(--teal2); font-weight:600; }
tr.tot td{ border-top:.9pt solid var(--navy); font-weight:700; background:var(--panel); }

/* verdict + tiles */
.vb{ border:1.4pt solid var(--navy); border-radius:2mm; overflow:hidden; }
.vb .h{ background:var(--navy); color:#fff; padding:2.4mm 4mm; font-size:6.6pt; font-weight:800;
        letter-spacing:.17em; text-transform:uppercase; }
.vb .c{ padding:4mm; }
.vb .v{ font-size:15.5pt; font-weight:700; letter-spacing:-.02em; line-height:1.15; color:var(--navy); }
.tiles{ display:flex; gap:2.5mm; }
.tile{ flex:1; border:.6pt solid var(--rule); border-top:2pt solid var(--navy); border-radius:1mm;
       padding:2.6mm 3mm; background:var(--panel2); }
.tile .k{ font-size:5.9pt; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--ink3); }
.tile .v{ font-size:17pt; font-weight:700; letter-spacing:-.03em; line-height:1.05; margin-top:.6mm;
          font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; }
.tile .v small{ font-size:7.5pt; color:var(--ink4); font-weight:600; }
.tile .s{ font-size:6.4pt; color:var(--ink2); margin-top:.4mm; }

/* bars */
.bar{ display:flex; align-items:center; gap:2.5mm; margin:1.5mm 0; font-size:7.2pt; }
.bar .bl{ flex:0 0 40mm; color:var(--ink2); }
.bar .bt{ flex:1; height:3.1mm; background:var(--rule2); border-radius:.8mm; overflow:hidden; position:relative; }
.bar .bf{ height:100%; background:var(--navy2); border-radius:0 .8mm .8mm 0; }
.bar .bv{ flex:0 0 16mm; text-align:right; font-weight:700; font-variant-numeric:tabular-nums;
          font-family:"Helvetica Neue",Helvetica,Arial,sans-serif; }
.bar .tick{ position:absolute; top:0; bottom:0; width:.5pt; background:#fff; opacity:.9; }

/* misc */
.grid2{ display:grid; grid-template-columns:1fr 1fr; gap:5mm; }
.grid3{ display:grid; grid-template-columns:repeat(3,1fr); gap:3mm; }
.grid4{ display:grid; grid-template-columns:repeat(4,1fr); gap:2.5mm; }
.kv{ border:.6pt solid var(--rule); border-radius:1mm; padding:2.4mm 2.8mm; background:var(--panel2); }
.kv .k{ font-size:5.9pt; font-weight:800; letter-spacing:.1em; text-transform:uppercase;
        color:var(--ink3); line-height:1.3; min-height:6mm; }
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
.note.bad{ border-left-color:var(--bad); background:#FBEEEC; }
.note.good{ border-left-color:var(--good); background:#EDF5F0; }
.note b{ display:block; margin-bottom:.5mm; }
ul{ margin-left:4mm; } li{ margin:.9mm 0; }
.blist li{ font-size:7.4pt; line-height:1.45; }
.blist b{ color:var(--navy); }
.donut{ width:32mm; height:32mm; border-radius:50%; flex:0 0 32mm; }
.dlegend{ font-size:7pt; line-height:1.7; }
.dlegend i{ display:inline-block; width:2.4mm; height:2.4mm; border-radius:.5mm; margin-right:1.6mm; }
.grow{ flex:1; }
`;

function shell(title, bodyCls, pages){
  return '<!DOCTYPE html><html lang="'+(bodyCls==='gu'?'gu':'en')+'"><head><meta charset="utf-8">'
    + '<title>'+e(title)+'</title><style>'+CSS+'</style></head><body class="'+bodyCls+'">'
    + pages + '</body></html>';
}
function head(p, label){
  return '<div class="rh"><div class="l en">'+e(p.meta.short_name||p.meta.company)+'</div>'
       + '<div class="r en">'+e(label)+'</div></div>';
}
function foot(p, i, total){
  return '<div class="rf en"><div>IPO Company Research Report &nbsp;·&nbsp; '
       + e(p.meta.analysis_datetime||'') + ' &nbsp;·&nbsp; Research only, not investment advice</div>'
       + '<div><b>'+i+'</b> / '+total+'</div></div>';
}
function page(p, i, total, label, inner){
  return '<section class="page">'+head(p,label)+'<div class="body">'+inner+'</div>'+foot(p,i,total)+'</section>';
}
function sec(no, title){
  return '<div class="sec"><span class="no en">'+e(no)+'</span><span class="ti">'+e(title)+'</span><span class="ln"></span></div>';
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

/* score model, mirrors the app worksheet */
var BLOCKS = [
  ['Business Quality', 20, ['business_model','competitive_advantage','industry_attractiveness','growth_runway','revenue_quality'],
    ['Business Model','Competitive Advantage','Industry Attractiveness','Growth Runway','Revenue Quality'], [4,4,4,4,4]],
  ['Financial Quality', 20, ['revenue_growth','profit_growth','margins','roce_roe','cash_flow','balance_sheet'],
    ['Revenue Growth','Profit Growth','Margins','ROCE / ROE','Cash Flow','Balance Sheet'], [4,4,3,3,3,3]],
  ['Management & Governance', 15, ['promoter_track_record','governance','capital_allocation'],
    ['Promoter Track Record','Governance','Capital Allocation'], [5,5,5]],
  ['Valuation', 20, ['absolute_valuation','peer_valuation','growth_adjusted_valuation','margin_of_safety'],
    ['Absolute Valuation','Peer Valuation','Growth-Adjusted Valuation','Margin Of Safety'], [5,5,5,5]],
  ['IPO Structure', 10, ['fresh_issue_quality','use_of_proceeds','ofs_exit_structure'],
    ['Fresh Issue Quality','Use Of Proceeds','OFS / Exit Structure'], [4,3,3]],
  ['Risk', 10, ['business_risks','financial_risks','governance_risks','regulatory_risks'],
    ['Business Risks','Financial Risks','Governance Risks','Regulatory / Industry Risks'], [3,3,2,2]],
  ['Market Signals', 5, ['gmp','anchor_quality','subscription_demand'],
    ['GMP','Anchor Quality','Subscription / Demand'], [2,1,2]]
];
function blockScore(p, b){
  var t=0; b[2].forEach(function(k){ t += Number((p.score_lines||{})[k])||0; }); return t;
}

/* ============================ COVER ============================ */
function cover(p, lang, docTitle, pages){
  var v = p.verdict||{}, m = p.meta||{}, ipo = p.ipo||{};
  var sc = v.scores||{}, bands = v.score_bands||{};
  var headline = pick(p, lang, 'verdict.headline', v.headline||'');
  var oneLiner = pick(p, lang, 'verdict.one_liner', v.one_liner||'');
  var thesis = pick(p, lang, 'verdict.thesis', arr(v.thesis));
  var snap = [
    ['Issue period', e(m.open_date||'—')+' to '+e(m.close_date||'—')],
    ['Price band / issue price', '₹'+e(ipo.price_band||'—')+' · issue at ₹'+n(ipo.issue_price)],
    ['Issue size', cr(ipo.issue_size_cr)+' · fresh '+cr(ipo.fresh_cr)+' · OFS '+cr(ipo.ofs_cr)],
    ['Subscription', (ipo.subscription&&ipo.subscription.overall!=null? n(ipo.subscription.overall,1)+'×':'—')
      + (ipo.subscription&&ipo.subscription.qib!=null?' · QIB '+n(ipo.subscription.qib,2)+'×':'')
      + (ipo.subscription&&ipo.subscription.retail!=null?' · Retail '+n(ipo.subscription.retail,2)+'×':'')],
    ['Grey market premium', (ipo.gmp&&ipo.gmp.value!=null? '₹'+n(ipo.gmp.value)+' ('+pct(ipo.gmp.pct)+')':'—')+' — unofficial'],
    ['Market capitalisation', cr(ipo.market_cap_cr)],
    ['Promoter holding', p.people&&p.people.promoter_holding_pre!=null
        ? pct(p.people.promoter_holding_pre)+' → '+pct(p.people.promoter_holding_post)+' post issue' : '—'],
    ['Listing', e(m.listing_date||'—')+' on '+e(m.exchanges||'NSE, BSE')]
  ];
  var inner =
    '<div style="height:7mm"></div>'
    + '<div class="eyebrow en">'+e(docTitle)+' &nbsp;·&nbsp; '+e(m.ipo_type||'Mainboard')+' &nbsp;·&nbsp; India</div>'
    + '<h1 class="en" style="margin-top:2mm">'+e(m.company||'')+'</h1>'
    + '<div class="mut en" style="margin-top:1mm;font-size:8pt">'+e(m.sector||'')
      + (m.sector?' &nbsp;·&nbsp; ':'')+'Analysis updated as of '+e(m.analysis_datetime||'')+'</div>'
    + '<div style="height:2.5mm;background:var(--teal);width:26mm;border-radius:1mm;margin:4mm 0 5mm"></div>'
    + '<div class="vb"><div class="h en">Final recommendation</div><div class="c">'
      + '<div class="v">'+e(headline)+'</div>'
      + (oneLiner?'<div class="lead" style="margin-top:2mm">'+e(oneLiner)+'</div>':'')
      + '</div></div>'
    + '<div class="tiles" style="margin-top:5mm">'
      + ['ipo_quality|IPO Quality|/100','long_term|Long Term|/100','listing_gain|Listing Gain|/100'].map(function(t){
          var k=t.split('|');
          return '<div class="tile"><div class="k en">'+k[1]+'</div><div class="v">'+n(sc[k[0]],1)
            +'<small>'+k[2]+'</small></div><div class="s en">'+e(bands[k[0]]||bandOf(sc[k[0]]))+'</div></div>';
        }).join('')
      + '<div class="tile"><div class="k en">Allocation</div><div class="v">'+e(v.allocation_band||'—')
        +'</div><div class="s en">of portfolio</div></div>'
    + '</div>'
    + sec('01','Investment thesis')
    + '<div class="lead">'+arr(thesis).map(function(t){ return '<p style="margin-bottom:1.6mm">'+e(t)+'</p>'; }).join('')+'</div>'
    + sec('02','IPO snapshot')
    + tbl(['Parameter','Detail'], snap.map(function(r){ return [ '<span class="en" style="color:var(--ink3)">'+r[0]+'</span>', '<span class="en">'+r[1]+'</span>' ]; }))
    + '<div class="grow"></div>'
    + '<div class="mut" style="border-top:.6pt solid var(--rule);padding-top:2.5mm">'
      + 'Independent research. Not investment advice, not a personal recommendation, and not an offer or '
      + 'solicitation. Figures are labelled Official, Derived or Estimated. Grey market premium data is '
      + 'unofficial and unregulated. Equity investment carries the risk of permanent capital loss.</div>';
  return page(p, 1, pages, 'Verdict', inner);
}

/* ============================ REPORT ============================ */
function buildReport(p, lang){
  lang = lang || 'en';
  var TOT = 10, out = '';
  var m = p.meta||{}, f = p.financials||{}, c = p.company||{}, pe = p.people||{}, d = p.decision||{}, ipo = p.ipo||{};

  out += cover(p, lang, 'IPO Company Research Report', TOT);

  /* --- 2 scorecard --- */
  var sl = p.score_lines||{}, sb = p.score_basis||{};
  var blocks = BLOCKS.map(function(b){
    var got = blockScore(p,b);
    return '<div style="margin-bottom:3mm">'
      + barRow(b[0], got/b[1]*100, got.toFixed(1)+' / '+b[1], 'var(--navy)')
      + b[2].map(function(k,i){
          var v = Number(sl[k])||0, mx = b[4][i];
          return '<div class="bar" style="margin-left:6mm"><div class="bl" style="flex:0 0 34mm;font-size:6.7pt;color:var(--ink3)">'
            + e(b[3][i]) + '</div><div class="bt" style="height:2.1mm"><div class="bf" style="width:'
            + (v/mx*100) + '%;background:var(--teal)"></div></div><div class="bv en" style="flex:0 0 13mm;font-size:6.7pt">'
            + v.toFixed(1) + '<span style="color:var(--ink4)">/'+mx+'</span></div></div>';
        }).join('')
      + '</div>';
  }).join('');
  var lg = ipo.listing_gain||{};
  out += page(p, 2, TOT, 'Scorecard', sec('03','The 100-point score')
    + blocks
    + '<div class="note"><b>How to read this</b>Market signals are capped at 5 of 100 on purpose, so grey '
      + 'market premium and subscription can never outweigh business quality, financial quality, valuation '
      + 'and governance. Bands: 85+ exceptional · 75–84 strong · 65–74 attractive · 55–64 selective · '
      + '45–54 weak · below 45 avoid.</div>'
    + sec('04','Listing-gain assessment')
    + tbl(['Component','Max','Score','Basis'], arr(lg.components).map(function(x){
        return { cells:[e(x.factor), n(x.max), '<b>'+n(x.score,0)+'</b>', '<span class="mut">'+e(x.note)+'</span>'] }; })
        .concat([{ __cls:'tot', cells:['Listing-gain score','100','<b>'+n(lg.score,0)+'</b>',
                  e(lg.score>=80?'Very positive':lg.score>=65?'Positive':lg.score>=50?'Neutral':'Negative')] }]),
        { num:[1,2] })
    + (lg.verdict?'<div class="note" style="margin-top:2mm">'+e(lg.verdict)+'</div>':'')
    + '<div class="grow"></div>');

  /* --- 3 the IPO --- */
  var fresh = Number(ipo.fresh_cr)||0, ofs = Number(ipo.ofs_cr)||0, tot = fresh+ofs;
  var fpct = tot? (fresh/tot*100) : 0;
  out += page(p, 3, TOT, 'The IPO', sec('05','Issue structure')
    + '<div style="display:flex;gap:6mm;align-items:center;margin-bottom:3mm">'
      + '<div class="donut" style="background:conic-gradient(var(--teal) 0 '+fpct.toFixed(1)+'%, var(--navy) '+fpct.toFixed(1)+'% 100%)"></div>'
      + '<div class="dlegend en"><div><i style="background:var(--teal)"></i><b>Fresh issue</b> '+cr(fresh)+' · '+pct(fpct,1)+'</div>'
      + '<div><i style="background:var(--navy)"></i><b>Offer for sale</b> '+cr(ofs)+' · '+pct(100-fpct,1)+'</div>'
      + '<div style="margin-top:1.5mm;color:var(--ink3)">Total '+cr(tot)+' · lot '+n(ipo.lot_size)
      + ' shares · min ₹'+n(ipo.min_investment)+'</div></div>'
      + '<div style="flex:1"></div></div>'
    + '<div class="note'+(ipo.structure_verdict&&/exit/i.test(ipo.structure_verdict)?' bad':'')+'">'
      + '<b>'+e(ipo.structure_verdict||'—')+'</b>'+e(ipo.structure_note||'')+'</div>'
    + sec('06','Where the money goes')
    + tbl(['Use of fresh proceeds','₹ crore','Assessment'], arr(ipo.objects).map(function(o){
        return { cells:[e(o.use), n(o.amount_cr,2), '<span class="mut">'+e(o.verdict)+'</span>'] }; }), { num:[1] })
    + sec('07','Who is selling')
    + tbl(['Selling shareholder','Type','₹ crore'], arr(ipo.selling_shareholders).map(function(x){
        return { cells:[e(x.name), e(x.type), n(x.amount_cr,2)] }; }), { num:[2] })
    + sec('08','Anchor investors')
    + tbl(['Anchor','Type','₹ crore'], arr((ipo.anchors||{}).top).map(function(x){
        return { cells:[e(x.name), e(x.type), x.amount_cr==null?'not disclosed':n(x.amount_cr,2)] }; }), { num:[2] })
    + '<div class="mut" style="margin-top:1.5mm">Total anchor book '+cr((ipo.anchors||{}).total_cr)
      + ' · lock-in '+e((ipo.anchors||{}).lockin||'—')+'. '+e((ipo.anchors||{}).note||'')
      + ' Anchor participation is a confidence signal, not proof of investment quality.</div>'
    + '<div class="grow"></div>');

  /* --- 4 the company --- */
  var segs = arr(c.segments);
  out += page(p, 4, TOT, 'The Company', sec('09','What the business actually does')
    + '<div class="lead">'+e(pick(p,lang,'company.what_it_does', c.what_it_does))+'</div>'
    + '<div class="grid2" style="margin-top:3mm">'
      + '<div><div class="eyebrow en">How it earns</div><div class="mut" style="font-size:7.4pt;margin-top:1mm">'
        + e(pick(p,lang,'company.how_it_earns', c.how_it_earns))+'</div></div>'
      + '<div><div class="eyebrow en">Why customers stay</div><div class="mut" style="font-size:7.4pt;margin-top:1mm">'
        + e(pick(p,lang,'company.why_customers_stay', c.why_customers_stay))+'</div></div></div>'
    + sec('10','Revenue mix')
    + segs.map(function(s){ return barRow(s.name, Number(s.revenue_pct)||0, pct(s.revenue_pct,1), 'var(--teal)'); }).join('')
    + tbl(['Segment','Share','Growth','Note'], segs.map(function(s){
        return { cells:[e(s.name), pct(s.revenue_pct,1), s.growth_pct==null?'—':pct(s.growth_pct,1),
                 '<span class="mut">'+e(s.note)+'</span>'] }; }), { num:[1,2] })
    + sec('11','Operating metrics')
    + '<div class="grid4">'+arr(c.operating_metrics).slice(0,8).map(function(x){
        return '<div class="kv"><div class="k en">'+e(x.label)+'</div><div class="v en">'+e(x.value)+'</div></div>';
      }).join('')+'</div>'
    + '<div class="grow"></div>');

  /* --- 5 industry & moat --- */
  var ind = c.industry||{}, moat = c.moat||{};
  out += page(p, 5, TOT, 'Industry & Moat', sec('12','Industry')
    + '<div class="grid3" style="margin-bottom:3mm">'
      + '<div class="kv"><div class="k en">Classification</div><div class="v" style="font-size:9.5pt">'+e(ind.classification||'—')+'</div></div>'
      + '<div class="kv"><div class="k en">Pricing power</div><div class="v" style="font-size:9.5pt">'+e(ind.pricing_power||'—')+'</div></div>'
      + '<div class="kv"><div class="k en">Moat rating</div><div class="v" style="font-size:9.5pt">'+e(moat.rating||'—')+'</div></div>'
    + '</div>'
    + '<div class="lead">'+e(ind.growth_note||'')+'</div>'
    + '<div class="eyebrow en" style="margin-top:3mm">Demand drivers</div>'
    + '<ul class="blist" style="margin-top:1mm">'+arr(ind.drivers).map(function(x){ return '<li>'+e(x)+'</li>'; }).join('')+'</ul>'
    + (ind.market_share_note?'<div class="note" style="margin-top:2mm">'+e(ind.market_share_note)+'</div>':'')
    + sec('13','Competitive advantage')
    + tbl(['Source of advantage','Verdict','Evidence'], arr(moat.sources).map(function(x){
        return { cells:[e(x.source),
          '<span class="pill '+(x.verdict==='Real'?'sv-low':x.verdict==='None'?'sv-high':'sv-med')
            +'" style="background:'+(x.verdict==='Real'?'var(--good)':x.verdict==='None'?'#9AA2AD':'var(--amber)')+'">'
            +e(x.verdict)+'</span>',
          '<span class="mut">'+e(x.evidence)+'</span>'] }; }))
    + (moat.note?'<div class="note" style="margin-top:2mm">'+e(moat.note)+'</div>':'')
    + '<div class="grow"></div>');

  /* --- 6 financials --- */
  var yrs = arr(f.years), rows = arr(f.rows);
  out += page(p, 6, TOT, 'Financials', sec('14','Three-year financials')
    + tbl(['₹ crore'].concat(yrs).concat(['Trend']), rows.map(function(r){
        return { __cls: r.highlight?'hi':'',
          cells:[e(r.label)].concat(arr(r.values).map(function(v){ return typeof v==='number'? n(v, Math.abs(v)<100?2:0) : e(v); }))
                 .concat(['<span class="mut">'+e(r.trend)+'</span>']) };
      }), { num:[1,2,3] })
    + (f.note?'<div class="mut" style="margin-top:1.5mm">'+e(f.note)+'</div>':'')
    + sec('15','Key ratios')
    + '<div class="grid4">'+arr(f.ratios).slice(0,8).map(function(r){
        return '<div class="kv"><div class="k en">'+e(r.label)+'</div><div class="v en '+toneClass(r.tone)+'">'
          + e(r.value)+'</div><div class="s en">'+e(r.direction||'')+'</div></div>';
      }).join('')+'</div>'
    + '<div class="grow"></div>');

  /* --- 7 cash & balance sheet --- */
  var eq = f.earnings_quality||{}, bs = f.balance_sheet||{};
  var cfoBar = '';
  if(eq.cfo_pat != null){
    var v = Number(eq.cfo_pat);
    cfoBar = barRow('CFO / PAT', Math.min(100, v/1.5*100), v.toFixed(2)+'×',
                    v>=1?'var(--good)':v>=0.7?'var(--amber)':'var(--bad)', 66.7);
  }
  out += page(p, 7, TOT, 'Cash & Balance Sheet', sec('16','Does profit turn into cash?')
    + '<div class="grid3" style="margin-bottom:3mm">'
      + '<div class="kv"><div class="k en">Earnings quality</div><div class="v" style="font-size:9.5pt">'+e(eq.rating||'—')+'</div></div>'
      + '<div class="kv"><div class="k en">CFO / PAT</div><div class="v en '+(eq.cfo_pat!=null&&eq.cfo_pat<0.7?'tn-bad':'tn-good')+'">'
        + (eq.cfo_pat==null?'—':Number(eq.cfo_pat).toFixed(2)+'×')+'</div></div>'
      + '<div class="kv"><div class="k en">FCF / PAT</div><div class="v en '+(eq.fcf_pat!=null&&eq.fcf_pat<0?'tn-bad':'')+'">'
        + (eq.fcf_pat==null?'—':Number(eq.fcf_pat).toFixed(2)+'×')+'</div></div>'
    + '</div>'
    + cfoBar + (cfoBar?'<div class="mut" style="margin-bottom:2mm">White marker is 1.0× — profit fully converting into cash.</div>':'')
    + (arr(eq.flags).length?'<ul class="blist">'+arr(eq.flags).map(function(x){ return '<li>'+e(x)+'</li>'; }).join('')+'</ul>':'')
    + '<div class="note'+(eq.rating==='Low'||eq.rating==='Red flag'?' bad':'')+'" style="margin-top:2mm">'
      + e(pick(p,lang,'financials.earnings_quality_note', eq.note))+'</div>'
    + sec('17','Balance sheet')
    + '<div class="eyebrow en" style="margin-bottom:1.5mm">Rating: '+e(bs.rating||'—')+'</div>'
    + tbl(['Item','Position'], arr(bs.items).map(function(x){
        return { cells:[e(x.label), '<span class="'+toneClass(x.tone)+'">'+e(x.value)+'</span>'] }; }))
    + '<div class="grow"></div>');

  /* --- 8 valuation & peers --- */
  var val = f.valuation||{}, peers = f.peers||{}, scn = f.scenarios||{};
  var cases = arr(scn.cases), maxV = Math.max.apply(null, cases.map(function(x){ return Number(x.value_per_share)||0; }).concat([1]));
  out += page(p, 8, TOT, 'Valuation', sec('18','Valuation at the issue price')
    + '<div class="eyebrow en" style="margin-bottom:1.5mm">Verdict: '+e(val.verdict||'—')+'</div>'
    + tbl(['Multiple','Value','Denominator and method'], arr(val.multiples).map(function(x){
        return { cells:[e(x.label), '<b>'+e(x.value)+'</b>',
          '<span class="mut">'+e(x.basis)+(x.label_tag?' <i style="font-style:normal;color:var(--teal)">['+e(x.label_tag)+']</i>':'')+'</span>'] };
      }), { num:[1] })
    + (val.note?'<div class="note" style="margin-top:2mm">'+e(pick(p,lang,'financials.valuation_note', val.note))+'</div>':'')
    + sec('19','Peer comparison')
    + tbl(arr(peers.columns), arr(peers.rows).map(function(r){
        return { __cls: r.is_subject?'hi':'', cells: arr(r.cells).map(e) };
      }), { num:[1,2,3,4,5,6,7,8] })
    + (peers.note?'<div class="mut" style="margin-top:1.5mm">'+e(pick(p,lang,'financials.peers_note', peers.note))+'</div>':'')
    + sec('20','Three-year scenarios'+(scn.horizon?' to '+scn.horizon:''))
    + cases.map(function(x){
        var col = x.case==='Bear'?'var(--bad)':x.case==='Bull'?'var(--good)':'var(--navy2)';
        return barRow(x.case, (Number(x.value_per_share)||0)/maxV*100, '₹'+n(x.value_per_share), col);
      }).join('')
    + tbl(['Case','Value / share','vs issue','vs listing','Key assumption'], cases.map(function(x){
        var col = (Number(x.vs_issue_pct)||0) < 0 ? 'var(--bad)' : 'var(--good)';
        return { cells:['<b>'+e(x.case)+'</b>', '₹'+n(x.value_per_share),
          '<span style="color:'+col+'">'+pct(x.vs_issue_pct,0)+'</span>',
          '<span style="color:'+((Number(x.vs_listing_pct)||0)<0?'var(--bad)':'var(--good)')+'">'+pct(x.vs_listing_pct,0)+'</span>',
          '<span class="mut">'+e(x.assumption)+'</span>'] };
      }), { num:[1,2,3] })
    + (scn.note?'<div class="mut" style="margin-top:1.5mm">'+e(pick(p,lang,'financials.scenarios_note', scn.note))
       +' Scenario values are illustrative assumptions, not forecasts.</div>':'')
    + '<div class="grow"></div>');

  /* --- 9 people --- */
  var gov = pe.governance||{};
  out += page(p, 9, TOT, 'Promoters & Governance', sec('21','Promoters')
    + (pe.has_promoter===false
        ? '<div class="note bad"><b>No identifiable promoter</b>The company declares no promoter and no '
          + 'promoter group. There is no lock-in, no controlling shareholder to hold accountable, and no '
          + 'single party bearing reputational cost for a governance failure.</div>'
        : '<div class="mut" style="margin-bottom:2mm">Promoter holding '+pct(pe.promoter_holding_pre)
          +' before the issue, '+pct(pe.promoter_holding_post)+' after.</div>')
    + tbl(['Name','Role','Background'], arr(pe.promoters).map(function(x){
        return { cells:['<b class="en">'+e(x.name)+'</b>', e(x.role), '<span class="mut">'+e(x.background)+'</span>'] }; }))
    + sec('22','Background checks')
    + tbl(['Check','Finding','Standard'], arr(pe.due_diligence).map(function(x){
        return { cells:[e(x.check), '<span class="mut">'+e(x.finding)+'</span>',
          '<span class="pill" style="background:'+(x.standard==='Verified'?'var(--good)':x.standard==='Allegation'?'var(--amber)':'#7C838C')+'">'
          +e(x.standard)+'</span>'] }; }))
    + '<div class="mut" style="margin-top:1.5mm">'+e(pick(p,lang,'people.dd_note', pe.dd_note))+'</div>'
    + sec('23','Corporate governance — '+n(gov.score_10,1)+' / 10')
    + tbl(['Parameter','Finding','Flag'], arr(gov.items).map(function(x){
        return { cells:[e(x.parameter), '<span class="mut">'+e(x.finding)+'</span>',
          '<span class="pill '+sevClass(x.flag==='Clean'?'LOW':x.flag)+'" style="'
          +(x.flag==='Clean'?'background:var(--good)':'')+'">'+e(x.flag)+'</span>'] }; }))
    + '<div class="grow"></div>');

  /* --- 10 decision --- */
  out += page(p, 10, TOT, 'The Decision', sec('24','Strengths and weaknesses')
    + '<div class="grid2">'
      + '<div><div class="eyebrow en" style="color:var(--good)">Strengths</div><ul class="blist" style="margin-top:1mm">'
        + arr(pick(p,lang,'decision.strengths', d.strengths)).map(function(x,i){
            var en = arr(d.strengths)[i]||{};
            return '<li><b>'+e(x.title||en.title)+'</b> — '+e(x.evidence||en.evidence)+'</li>'; }).join('')
        + '</ul></div>'
      + '<div><div class="eyebrow en" style="color:var(--bad)">Weaknesses</div><ul class="blist" style="margin-top:1mm">'
        + arr(pick(p,lang,'decision.weaknesses', d.weaknesses)).map(function(x,i){
            var en = arr(d.weaknesses)[i]||{};
            return '<li><b>'+e(x.title||en.title)+'</b> — '+e(x.evidence||en.evidence)+'</li>'; }).join('')
        + '</ul></div></div>'
    + sec('25','Red flags')
    + tbl(['Red flag','Evidence','Severity'], arr(d.red_flags).map(function(x,i){
        var g = arr(pick(p,lang,'decision.red_flags', []))[i]||{};
        return { cells:['<b>'+e(g.flag||x.flag)+'</b>', '<span class="mut">'+e(g.evidence||x.evidence)+'</span>',
          '<span class="pill '+sevClass(x.severity)+'">'+e(x.severity)+'</span>'] }; }))
    + sec('26','Quarterly monitoring')
    + tbl(['Metric','Current','Desired trend','Warning level'], arr(d.monitoring).map(function(x){
        return { cells:[e(x.metric), '<b>'+e(x.current)+'</b>', '<span class="mut">'+e(x.desired)+'</span>',
                 '<span class="mut">'+e(x.warning)+'</span>'] }; }), { num:[1] })
    + sec('27','Allocation and price levels')
    + '<div class="grid2"><div>'
      + tbl(['Action','Price','Rationale'], arr(d.levels).map(function(x){
          return { cells:[e(x.action), '<b>'+e(x.price)+'</b>', '<span class="mut">'+e(x.rationale)+'</span>'] }; }), { num:[1] })
      + '</div><div class="note"><b>Suggested allocation: '+e((p.verdict||{}).allocation_band||'—')+'</b>'
      + e(pick(p,lang,'decision.allocation_note', d.allocation_note))+'</div></div>'
    + (d.watch_number ? '<div class="note good" style="margin-top:3mm"><b>The one number to watch — '
        + e(pick(p,lang,'decision.watch_number.title', d.watch_number.title))+'</b>'
        + e(pick(p,lang,'decision.watch_number.body', d.watch_number.body))+'</div>' : '')
    + '<div class="grow"></div>'
    + '<div class="mut" style="border-top:.6pt solid var(--rule);padding-top:2mm">'
      + '<b class="en">Sources.</b> Primary: '+arr((p.sources||{}).primary).map(e).join(' · ')
      + '. Secondary: '+arr((p.sources||{}).secondary).map(e).join(' · ')
      + (arr((p.sources||{}).missing).length ? '. <b class="en">Not reliably available from the sources reviewed:</b> '
          + arr(p.sources.missing).map(e).join(' · ') : '') + '.</div>');

  return shell((m.company||'IPO')+' — IPO Company Research Report', lang==='gu'?'gu':'', out);
}

/* ======================= EXECUTIVE SUMMARY ======================= */
function buildExec(p, lang){
  lang = lang || 'en';
  var TOT = 4, out = '', f = p.financials||{}, d = p.decision||{}, m = p.meta||{};
  out += cover(p, lang, 'Executive Summary', TOT);

  var yrs = arr(f.years);
  out += page(p, 2, TOT, 'The Numbers', sec('03','Three-year financials')
    + tbl(['₹ crore'].concat(yrs).concat(['Trend']), arr(f.rows).slice(0,9).map(function(r){
        return { __cls:r.highlight?'hi':'', cells:[e(r.label)]
          .concat(arr(r.values).map(function(v){ return typeof v==='number'? n(v,Math.abs(v)<100?2:0):e(v); }))
          .concat(['<span class="mut">'+e(r.trend)+'</span>']) }; }), { num:[1,2,3] })
    + sec('04','Key ratios')
    + '<div class="grid4">'+arr(f.ratios).slice(0,8).map(function(r){
        return '<div class="kv"><div class="k en">'+e(r.label)+'</div><div class="v en '+toneClass(r.tone)+'">'
          +e(r.value)+'</div></div>'; }).join('')+'</div>'
    + sec('05','Valuation')
    + tbl(['Multiple','Value','Basis'], arr((f.valuation||{}).multiples).slice(0,7).map(function(x){
        return { cells:[e(x.label), '<b>'+e(x.value)+'</b>', '<span class="mut">'+e(x.basis)+'</span>'] }; }), { num:[1] })
    + sec('06','Peers')
    + tbl(arr((f.peers||{}).columns), arr((f.peers||{}).rows).map(function(r){
        return { __cls:r.is_subject?'hi':'', cells:arr(r.cells).map(e) }; }), { num:[1,2,3,4,5,6,7,8] })
    + '<div class="grow"></div>');

  var cases = arr((f.scenarios||{}).cases);
  var maxV = Math.max.apply(null, cases.map(function(x){ return Number(x.value_per_share)||0; }).concat([1]));
  out += page(p, 3, TOT, 'The Risk', sec('07','Strengths and weaknesses')
    + '<div class="grid2">'
      + '<div><div class="eyebrow en" style="color:var(--good)">Strengths</div><ul class="blist" style="margin-top:1mm">'
        + arr(pick(p,lang,'decision.strengths', d.strengths)).slice(0,5).map(function(x,i){
            var en=arr(d.strengths)[i]||{}; return '<li><b>'+e(x.title||en.title)+'</b> — '+e(x.evidence||en.evidence)+'</li>'; }).join('')
      + '</ul></div><div><div class="eyebrow en" style="color:var(--bad)">Weaknesses</div><ul class="blist" style="margin-top:1mm">'
        + arr(pick(p,lang,'decision.weaknesses', d.weaknesses)).slice(0,5).map(function(x,i){
            var en=arr(d.weaknesses)[i]||{}; return '<li><b>'+e(x.title||en.title)+'</b> — '+e(x.evidence||en.evidence)+'</li>'; }).join('')
      + '</ul></div></div>'
    + sec('08','Red flags')
    + tbl(['Red flag','Evidence','Severity'], arr(d.red_flags).map(function(x,i){
        var g = arr(pick(p,lang,'decision.red_flags', []))[i]||{};
        return { cells:['<b>'+e(g.flag||x.flag)+'</b>','<span class="mut">'+e(g.evidence||x.evidence)+'</span>',
          '<span class="pill '+sevClass(x.severity)+'">'+e(x.severity)+'</span>'] }; }))
    + sec('09','Scenarios')
    + cases.map(function(x){
        var col = x.case==='Bear'?'var(--bad)':x.case==='Bull'?'var(--good)':'var(--navy2)';
        return barRow(x.case+' · ₹'+n(x.value_per_share), (Number(x.value_per_share)||0)/maxV*100,
                      pct(x.vs_issue_pct,0)+' vs issue', col); }).join('')
    + '<div class="mut" style="margin-top:1.5mm">Illustrative assumptions, not forecasts.</div>'
    + '<div class="grow"></div>');

  out += page(p, 4, TOT, 'The Decision', sec('10','Recommendation')
    + '<div class="vb"><div class="h en">'+e((p.verdict||{}).recommendation||'')+'</div><div class="c">'
      + '<div class="lead">'+e(pick(p,lang,'verdict.one_liner',(p.verdict||{}).one_liner))+'</div></div></div>'
    + sec('11','Allocation')
    + '<div class="note"><b>'+e((p.verdict||{}).allocation_band||'—')+'</b>'
      + e(pick(p,lang,'decision.allocation_note', d.allocation_note))+'</div>'
    + sec('12','Price levels')
    + tbl(['Action','Price','Rationale'], arr(d.levels).map(function(x){
        return { cells:[e(x.action),'<b>'+e(x.price)+'</b>','<span class="mut">'+e(x.rationale)+'</span>'] }; }), { num:[1] })
    + sec('13','Quarterly monitoring')
    + tbl(['Metric','Current','Desired','Warning'], arr(d.monitoring).slice(0,6).map(function(x){
        return { cells:[e(x.metric),'<b>'+e(x.current)+'</b>','<span class="mut">'+e(x.desired)+'</span>',
                 '<span class="mut">'+e(x.warning)+'</span>'] }; }), { num:[1] })
    + (d.watch_number ? '<div class="note good" style="margin-top:3mm"><b>'
        + e(pick(p,lang,'decision.watch_number.title', d.watch_number.title))+'</b>'
        + e(pick(p,lang,'decision.watch_number.body', d.watch_number.body))+'</div>' : '')
    + '<div class="grow"></div>'
    + '<div class="mut" style="border-top:.6pt solid var(--rule);padding-top:2mm">'
      + 'Independent research prepared for the purpose of evaluating an initial public offering. Not '
      + 'investment advice, not a personal recommendation, and not an offer or solicitation. The author is '
      + 'not a SEBI-registered investment adviser or research analyst. Figures are labelled Official, Derived '
      + 'or Estimated; where data was unavailable this is stated rather than estimated. Scenario valuations '
      + 'are illustrative assumptions, not forecasts. Grey market premium data is unofficial and unregulated. '
      + 'Equity investment carries the risk of permanent capital loss.</div>');

  return shell((m.company||'IPO')+' — Executive Summary', lang==='gu'?'gu':'', out);
}

/* ========================= VISUAL SUMMARY ========================= */
function buildVisual(p, lang){
  lang = lang || 'en';
  var v = p.verdict||{}, sc = v.scores||{}, f = p.financials||{}, d = p.decision||{}, ipo = p.ipo||{}, m = p.meta||{};
  var cases = arr((f.scenarios||{}).cases);
  var maxV = Math.max.apply(null, cases.map(function(x){ return Number(x.value_per_share)||0; }).concat([1]));
  var vcss = `
  .vpage{ width:1240px; height:1754px; background:#fff; padding:52px 56px 60px; position:relative;
          display:flex; flex-direction:column; page-break-after:always; }
  .vpage:last-child{ page-break-after:auto; }
  .vmast{ display:flex; justify-content:space-between; align-items:flex-end;
          border-bottom:4px solid var(--navy); padding-bottom:14px; }
  .vmast h1{ font-size:36px; letter-spacing:-.02em; color:var(--navy); }
  .vmast .s{ font-size:15px; color:var(--ink3); margin-top:5px; }
  .vmast .r{ text-align:right; font-size:13px; color:var(--ink3); line-height:1.6; }
  .vsec{ font-size:13px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:var(--ink3);
         margin:26px 0 12px; display:flex; align-items:center; gap:12px; }
  .vsec::after{ content:""; flex:1; height:1px; background:var(--rule); }
  .vhero{ border:2px solid var(--navy); border-radius:14px; overflow:hidden; margin-top:22px; }
  .vhero .h{ background:var(--navy); color:#fff; padding:12px 20px; font-size:14px; font-weight:800;
             letter-spacing:.16em; text-transform:uppercase; }
  .vhero .c{ padding:20px; }
  .vhero .v{ font-size:34px; font-weight:800; letter-spacing:-.02em; color:var(--navy); line-height:1.15; }
  .vhero p{ font-size:17px; color:var(--ink2); margin-top:10px; line-height:1.5; }
  .vtiles{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-top:20px; }
  .vtile{ border:1px solid var(--rule); border-top:5px solid var(--navy); border-radius:10px; padding:16px 18px;
          background:var(--panel2); }
  .vtile .k{ font-size:12px; font-weight:800; letter-spacing:.12em; text-transform:uppercase; color:var(--ink3); }
  .vtile .v{ font-size:40px; font-weight:800; letter-spacing:-.03em; line-height:1.05; margin-top:6px; }
  .vtile .v small{ font-size:17px; color:var(--ink4); }
  .vtile .s{ font-size:13px; color:var(--ink2); margin-top:3px; }
  .vkpis{ display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
  .vkpi{ border:1px solid var(--rule); border-radius:10px; padding:14px 16px; }
  .vkpi .k{ font-size:11.5px; font-weight:800; letter-spacing:.1em; text-transform:uppercase; color:var(--ink3);
            line-height:1.3; height:30px; }
  .vkpi .v{ font-size:29px; font-weight:800; letter-spacing:-.03em; line-height:1.1; margin-top:4px; }
  .vkpi .s{ font-size:12px; color:var(--ink3); margin-top:3px; }
  .vbar{ display:flex; align-items:center; gap:14px; margin:9px 0; font-size:15px; }
  .vbar .l{ flex:0 0 210px; color:var(--ink2); }
  .vbar .t{ flex:1; height:20px; background:var(--rule2); border-radius:5px; overflow:hidden; }
  .vbar .f{ height:100%; border-radius:0 5px 5px 0; }
  .vbar .v{ flex:0 0 92px; text-align:right; font-weight:800; font-variant-numeric:tabular-nums; }
  .vtab{ width:100%; border-collapse:collapse; font-size:14.5px; }
  .vtab th{ font-size:11.5px; text-transform:uppercase; letter-spacing:.09em; color:var(--ink3);
            border-bottom:2px solid var(--navy); padding:9px 10px; text-align:left; }
  .vtab td{ border-bottom:1px solid var(--rule2); padding:10px; vertical-align:top; }
  .vpill{ display:inline-block; font-size:11.5px; font-weight:800; padding:3px 11px; border-radius:12px;
          color:#fff; letter-spacing:.05em; }
  .vfoot{ margin-top:auto; border-top:1px solid var(--rule); padding-top:14px; font-size:12px;
          color:var(--ink4); display:flex; justify-content:space-between; }
  `;
  function vmast(sub, right){
    return '<div class="vmast"><div><h1 class="en">'+e(m.company||'')+'</h1>'
      + '<div class="s en">'+e(sub)+'</div></div><div class="r en">'+right+'</div></div>';
  }
  function vfoot(i){
    return '<div class="vfoot en"><span>Research only · not investment advice · GMP is unofficial and '
      + 'unregulated · scenario figures are illustrative assumptions</span><span><b>'+i+' / 2</b></span></div>';
  }

  var p1 = '<div class="vpage">'
    + vmast((m.sector||'')+' · '+(m.ipo_type||'Mainboard')+' IPO',
            'IPO Company Research<br><b style="color:#12161C">'+e(m.analysis_datetime||'')+'</b><br>Page 1 of 2 — Verdict')
    + '<div class="vhero"><div class="h en">Final recommendation</div><div class="c">'
      + '<div class="v">'+e(pick(p,lang,'verdict.headline', v.headline))+'</div>'
      + '<p>'+e(pick(p,lang,'verdict.one_liner', v.one_liner))+'</p></div></div>'
    + '<div class="vtiles">'
      + ['ipo_quality|IPO Quality|/100','long_term|Long Term|/100','listing_gain|Listing Gain|/100'].map(function(t){
          var k=t.split('|');
          return '<div class="vtile"><div class="k en">'+k[1]+'</div><div class="v en" style="color:'
            + bandColour(sc[k[0]])+'">'+n(sc[k[0]],1)+'<small>'+k[2]+'</small></div>'
            + '<div class="s en">'+e((v.score_bands||{})[k[0]]||bandOf(sc[k[0]]))+'</div></div>'; }).join('')
      + '<div class="vtile"><div class="k en">Allocation</div><div class="v en">'+e(v.allocation_band||'—')
        + '</div><div class="s en">of portfolio</div></div></div>'
    + '<div class="vsec en">Scorecard — out of 100</div>'
    + BLOCKS.map(function(b){ var got = blockScore(p,b);
        return '<div class="vbar"><div class="l">'+e(b[0])+'</div><div class="t"><div class="f" style="width:'
          + (got/b[1]*100)+'%;background:'+(got/b[1]>=0.65?'var(--good)':got/b[1]>=0.5?'var(--teal)':'var(--amber)')
          + '"></div></div><div class="v en">'+got.toFixed(1)+'<span style="color:var(--ink4);font-size:12px">/'
          + b[1]+'</span></div></div>'; }).join('')
    + '<div class="vsec en">Key numbers</div>'
    + '<div class="vkpis">'+arr(f.ratios).slice(0,8).map(function(r){
        return '<div class="vkpi"><div class="k en">'+e(r.label)+'</div><div class="v en '+toneClass(r.tone)+'">'
          + e(r.value)+'</div><div class="s en">'+e(r.direction||'')+'</div></div>'; }).join('')+'</div>'
    + vfoot(1) + '</div>';

  var p2 = '<div class="vpage">'
    + vmast('Risk, scenarios and the decision',
            'IPO Company Research<br><b style="color:#12161C">'+e(m.analysis_datetime||'')+'</b><br>Page 2 of 2 — Risk & Action')
    + '<div class="vsec en">Three-year scenarios</div>'
    + cases.map(function(x){
        var col = x.case==='Bear'?'var(--bad)':x.case==='Bull'?'var(--good)':'var(--navy2)';
        return '<div class="vbar"><div class="l">'+e(x.case)+'</div><div class="t"><div class="f" style="width:'
          + ((Number(x.value_per_share)||0)/maxV*100)+'%;background:'+col+'"></div></div>'
          + '<div class="v en">₹'+n(x.value_per_share)+'</div></div>'; }).join('')
    + '<div style="font-size:13px;color:var(--ink3);margin-top:6px">'
      + e(pick(p,lang,'financials.scenarios_note',(f.scenarios||{}).note))+'</div>'
    + '<div class="vsec en">Red flags</div>'
    + '<table class="vtab"><thead><tr><th>Flag</th><th>Evidence</th><th style="width:130px">Severity</th></tr></thead><tbody>'
      + arr(d.red_flags).slice(0,7).map(function(x,i){
          var g = arr(pick(p,lang,'decision.red_flags', []))[i]||{};
          return '<tr><td><b>'+e(g.flag||x.flag)+'</b></td><td style="color:var(--ink2)">'
            + e(g.evidence||x.evidence)+'</td><td><span class="vpill '+sevClass(x.severity)+'" style="background:'
            + (String(x.severity).toUpperCase()==='CRITICAL'?'var(--crit)':String(x.severity).toUpperCase()==='HIGH'?'var(--bad)'
              :String(x.severity).toUpperCase()==='MEDIUM'?'var(--amber)':'#7C838C')+'">'+e(x.severity)+'</span></td></tr>'; }).join('')
      + '</tbody></table>'
    + '<div class="vsec en">What to do</div>'
    + '<div style="border:2px solid var(--navy);border-radius:14px;overflow:hidden">'
      + '<div style="background:var(--navy);color:#fff;padding:11px 18px;font-size:15px;font-weight:800">'
        + e(v.recommendation||'')+' · '+e(v.allocation_band||'')+'</div>'
      + '<div style="padding:16px 18px;font-size:15px;line-height:1.55;color:var(--ink2)">'
        + e(pick(p,lang,'decision.allocation_note', d.allocation_note))+'</div></div>'
    + '<div class="vsec en">Price levels</div>'
    + '<table class="vtab"><tbody>'+arr(d.levels).map(function(x){
        return '<tr><td style="width:34%">'+e(x.action)+'</td><td style="width:18%"><b>'+e(x.price)
          + '</b></td><td style="color:var(--ink2)">'+e(x.rationale)+'</td></tr>'; }).join('')+'</tbody></table>'
    + (d.watch_number ? '<div style="margin-top:20px;border-left:5px solid var(--good);background:#EDF5F0;'
        + 'padding:14px 18px;border-radius:0 10px 10px 0"><div style="font-size:12px;font-weight:800;'
        + 'letter-spacing:.1em;text-transform:uppercase;color:var(--ink3)">The one number to watch</div>'
        + '<div style="font-size:16px;font-weight:800;margin-top:4px">'
        + e(pick(p,lang,'decision.watch_number.title', d.watch_number.title))+'</div>'
        + '<div style="font-size:14px;line-height:1.55;margin-top:6px;color:var(--ink2)">'
        + e(pick(p,lang,'decision.watch_number.body', d.watch_number.body))+'</div></div>' : '')
    + vfoot(2) + '</div>';

  return '<!DOCTYPE html><html lang="'+(lang==='gu'?'gu':'en')+'"><head><meta charset="utf-8">'
    + '<title>'+e(m.company||'')+' — Visual Summary</title><style>'+CSS+vcss+'</style></head>'
    + '<body class="'+(lang==='gu'?'gu':'')+'" style="background:#E9E7E1">'+p1+p2+'</body></html>';
}

global.IPODocs = { buildReport:buildReport, buildExec:buildExec, buildVisual:buildVisual, BLOCKS:BLOCKS };
})(window);
