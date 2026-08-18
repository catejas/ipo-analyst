/* ============================================================================
   docs.js — generate, download and share the documents the app renders
   locally from an imported payload. PDF uses the browser's own vector print
   path where possible; PNG uses html2canvas at 3x for 450 DPI at A4.
   ========================================================================== */
(function(){
'use strict';
function $(s){ return document.querySelector(s); }

var A4_W = 1240, A4_H = 1754;               /* CSS px at 150 DPI */
var PNG_SCALE = 4;   /* 4960 x 7016 = 600 DPI at A4. Messaging apps downscale
                        hard, so we oversample and use large type in the layout. */

function currentPayload(){
  var id = $('#libSel') && $('#libSel').value;
  if(!id) return null;
  var lib = [];
  try{ lib = JSON.parse(localStorage.getItem('ipo.library')||'[]'); }catch(e){}
  var r = lib.filter(function(x){ return x.id===id; })[0];
  if(!r || !r.data) return null;
  return (r.data.schema === 'ipo-analyst/3' || r.data.meta) ? r.data : null;
}
function langsWanted(){
  var l = (typeof langCode === 'function') ? langCode() : 'both';
  return l === 'both' ? ['en','gu'] : [l];
}
function fileBase(p, kind, lang){
  var raw = (window.IPODocs && IPODocs.S) ? IPODocs.S(p.meta && (p.meta.short_name || p.meta.company)) : '';
  var nm = (raw || 'IPO').replace(/[^A-Za-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
  var k = kind==='inst' ? 'IPO_Institutional_Research_Report'
        : kind==='report' ? 'IPO_Company_Research_Report'
        : kind==='exec' ? 'IPO_Executive_Summary'
        : (kind==='score'||kind==='scorepng') ? 'IPO_Score_Card' : 'IPO_Investment_Summary';
  return nm + '_' + k + '_' + lang.toUpperCase();
}
function buildHTML(p, kind, lang){
  if(kind === 'inst')   return IPODocs.buildInstitutional(p, lang);
  if(kind === 'report') return IPODocs.buildReport(p, lang);
  if(kind === 'exec')   return IPODocs.buildExec(p, lang);
  if(kind === 'score' || kind === 'scorepng') return IPODocs.buildScorecard(p, lang);
  return IPODocs.buildVisual(p, lang);
}
function selFor(kind){ return kind==='visual' ? '.vpage' : '.page'; }
function isPng(kind){ return kind==='visual' || kind==='scorepng'; }
var MSG_EL = '#docMsg';
function msg(t, bad){
  var el = $(MSG_EL); if(!el) return;
  el.innerHTML = t ? (bad ? '<b style="color:var(--red)">'+t+'</b>' : t) : '';
}

/* hidden iframe so html2canvas has a real laid-out document to photograph */
function stage(html){
  return new Promise(function(res){
    var f = document.createElement('iframe');
    f.setAttribute('aria-hidden','true');
    f.style.cssText = 'position:fixed;left:-20000px;top:0;border:0;width:'+A4_W+'px;height:'+A4_H+'px;';
    document.body.appendChild(f);
    f.onload = function(){ setTimeout(function(){ res(f); }, 350); };
    f.srcdoc = html;
  });
}
function unstage(f){ try{ document.body.removeChild(f); }catch(e){} }

/* ---------- PDF: preview in-app, print from there ----------
   This used to be window.open(). Inside an installed PWA that new window has no
   browser chrome and no back gesture, so the only way out was to kill the app.
   The document is now shown in a full-screen panel with a Back button, and
   printing happens from inside it. */
function showPreview(html, title){
  var pv = $('#preview'), fr = $('#pvFrame');
  if(!pv || !fr){ return false; }
  $('#pvTitle').textContent = title || '';
  fr.srcdoc = html;
  pv.classList.remove('hidden');
  document.body.classList.add('previewing');
  /* so the phone's own Back gesture closes the preview instead of the app */
  try{ history.pushState({ preview:1 }, ''); }catch(e){}
  return true;
}
function closePreview(){
  var pv = $('#preview');
  if(!pv || pv.classList.contains('hidden')) return false;
  pv.classList.add('hidden');
  document.body.classList.remove('previewing');
  $('#pvFrame').srcdoc = '';
  return true;
}
function printPreview(){
  var fr = $('#pvFrame');
  try{
    if(fr && fr.contentWindow){ fr.contentWindow.focus(); fr.contentWindow.print(); return; }
  }catch(e){}
  window.print();
}
window.IPOPreview = { show:showPreview, close:closePreview, print:printPreview };

/* ---------- PDF as a real file, for sharing ---------- */
function htmlToPdfBlob(html, sel){
  return stage(html).then(function(f){
    var doc = f.contentDocument;
    var pages = Array.prototype.slice.call(doc.querySelectorAll(sel));
    var jsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    var pdf = new jsPDF({ orientation:'p', unit:'pt', format:'a4', compress:true });
    var W = pdf.internal.pageSize.getWidth(), H = pdf.internal.pageSize.getHeight();
    var chain = Promise.resolve();
    pages.forEach(function(el, i){
      chain = chain.then(function(){
        return html2canvas(el, { scale:2, backgroundColor:'#ffffff', useCORS:true,
                                 logging:false, windowWidth:el.offsetWidth })
          .then(function(cv){
            if(i) pdf.addPage();
            pdf.addImage(cv.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, W, H, undefined, 'FAST');
            msg('Rendering page '+(i+1)+' of '+pages.length+'…');
          });
      });
    });
    return chain.then(function(){ unstage(f); return pdf.output('blob'); })
                .catch(function(err){ unstage(f); throw err; });
  });
}

/* ---------- PNG at 450 DPI ---------- */
function htmlToPngBlobs(html, sel){
  return stage(html).then(function(f){
    var pages = Array.prototype.slice.call(f.contentDocument.querySelectorAll(sel));
    var outs = [], chain = Promise.resolve();
    pages.forEach(function(el, i){
      chain = chain.then(function(){
        msg('Rendering image '+(i+1)+' of '+pages.length+' at 450 DPI…');
        return html2canvas(el, { scale:PNG_SCALE, backgroundColor:'#ffffff', useCORS:true,
                                 logging:false, windowWidth:el.offsetWidth })
          .then(function(cv){
            return new Promise(function(r){ cv.toBlob(function(b){ outs.push(b); r(); }, 'image/png'); });
          });
      });
    });
    return chain.then(function(){ unstage(f); return outs; })
                .catch(function(err){ unstage(f); throw err; });
  });
}

function download(blob, name){
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); document.body.removeChild(a); }, 1500);
}
/* Sharing has to happen inside a live user gesture. Building a five-document set
   takes half a minute, so by the time the files exist the tap that started it has
   expired and iOS rejects navigator.share with NotAllowedError. The old code then
   fell back to downloading each file — and on iOS a programmatic download of a PDF
   blob opens it in a viewer rather than saving, so the last file in the batch (the
   score card) appeared on screen and nothing was shared. That is the bug.

   Now: try to share; if the gesture has gone, hold the finished files and offer a
   button. The user's tap on that button is a fresh gesture, and the share works. */
var PENDING_SHARE = null;

function canShareFiles(files){
  try{ return !!(navigator.canShare && navigator.canShare({ files:files })); }catch(e){ return false; }
}

function shareNow(files, title){
  if(!navigator.share) return Promise.resolve({ ok:false, reason:'unsupported' });
  if(!canShareFiles(files)) return Promise.resolve({ ok:false, reason:'unsupported' });
  return navigator.share({ files:files, title:title })
    .then(function(){ return { ok:true }; })
    .catch(function(err){
      var name = (err && err.name) || '';
      if(name === 'AbortError') return { ok:true, cancelled:true };     /* user closed the sheet */
      return { ok:false, reason: name === 'NotAllowedError' ? 'gesture' : 'failed', err:err };
    });
}

/* Offer a second tap rather than silently dumping five downloads. */
function offerShare(files, title, note){
  PENDING_SHARE = { files:files, title:title };
  msg((note || '') + '<button type="button" class="btn sm pri" id="btnShareNow" style="margin-top:10px;">'
    + 'TAP TO SHARE ' + files.length + ' FILE' + (files.length > 1 ? 'S' : '')
    + '</button><button type="button" class="btn sm" id="btnSaveInstead" style="margin-top:8px;">'
    + 'Save to this device instead</button>');
}

function share(files, title){
  return shareNow(files, title).then(function(r){ return r.ok; });
}

function needPayload(){
  var p = currentPayload();
  if(!p){
    msg('Select a saved analysis first — and it must be a v3 data block imported with Import Data.', true);
    return null;
  }
  return p;
}


/* ---------- All Reports: every document, one language, one tap ---------- */
var ALL_LANG = 'en';
var ALL_KINDS = [
  { kind:'inst',     ext:'pdf' },
  { kind:'report',   ext:'pdf' },
  { kind:'exec',     ext:'pdf' },
  { kind:'score',    ext:'pdf' },
  { kind:'visual',   ext:'png' }
];

/* PDFs are rasterised to a real file here rather than routed through the print
   dialog, because a batch cannot ask the user to drive five print sheets. */
function buildAllFiles(p, lang, onStep){
  var out = [], i = 0;
  var wanted = ALL_KINDS.slice();
  function next(){
    if(i >= wanted.length) return Promise.resolve(out);
    var k = wanted[i++];
    onStep(i, wanted.length, k.kind);
    var html = buildHTML(p, k.kind, lang), sel = selFor(k.kind);
    if(k.ext === 'png'){
      return htmlToPngBlobs(html, sel).then(function(blobs){
        blobs.forEach(function(b, n){
          out.push(new File([b], fileBase(p, k.kind, lang) + (blobs.length > 1 ? '_p'+(n+1) : '') + '.png',
                            { type:'image/png' }));
        });
        return next();
      });
    }
    return htmlToPdfBlob(html, sel).then(function(blob){
      out.push(new File([blob], fileBase(p, k.kind, lang) + '.pdf', { type:'application/pdf' }));
      return next();
    });
  }
  return next();
}

function doAll(act, msgTarget){
  MSG_EL = msgTarget || '#docMsg';
  var p = needPayload(); if(!p) return;
  var lang = ALL_LANG;
  var label = lang === 'gu' ? 'Gujarati' : 'English';
  var names = { inst:'institutional research report', report:'research report',
                exec:'executive summary', visual:'investment summary', score:'score card' };
  function step(n, total, kind){
    msg('Building the ' + label + ' set — ' + n + ' of ' + total + ': ' + (names[kind]||kind) + '…');
  }
  buildAllFiles(p, lang, step).then(function(files){
    if(act === 'share'){
      var title = IPODocs.S(p.meta.company) + ' — ' + label;
      return shareNow(files, title).then(function(r){
        if(r.ok){ msg(r.cancelled ? '' : 'Shared all ' + files.length + ' ' + label + ' files.'); return; }
        if(r.reason === 'gesture'){
          offerShare(files, title, '<b>' + files.length + ' ' + label + ' files are ready.</b> '
            + 'Building them took longer than the phone allows a share to stay open, so tap once more '
            + 'to send them. ');
          return;
        }
        files.forEach(function(f){ download(f, f.name); });
        msg('Sharing is not available in this browser, so all ' + files.length + ' '
          + label + ' files were saved instead.');
      });
    }
    files.forEach(function(f){ download(f, f.name); });
    msg('<b>Saved ' + files.length + ' ' + label + ' files</b> — institutional research report, '
      + 'research report, executive summary, investment summary and score card. '
      + 'Send images on WhatsApp as a <b>Document, not a Photo</b>.');
  }).catch(function(err){
    msg('Could not build the set: ' + err.message, true);
  });
}

/* ---------- one delegated handler for every document row ---------- */
function doAction(kind, act, msgTarget){
  if(kind === 'all') return doAll(act, msgTarget);
  MSG_EL = msgTarget || '#docMsg';
  var p = needPayload(); if(!p) return;
  var langs = langsWanted();

  if(act === 'make' && !isPng(kind)){
    var lg0 = langs[0];
    msg('Preview open. Tap <b>Save as PDF</b>, then <b>Back</b> to return to the app.'
      + (langs.length > 1 ? ' Switch the language and tap PDF again for the other edition.' : ''));
    showPreview(buildHTML(p, kind, lg0), fileBase(p, kind, lg0) + '.pdf');
    return;
  }
  if(act === 'make'){
    var run = function(ix){
      if(ix >= langs.length){
        msg('Saved at 600 DPI. <b>Send it on WhatsApp as a Document, not a Photo</b> — photo mode '
          + 'recompresses images and softens small type.');
        return;
      }
      var lg = langs[ix];
      htmlToPngBlobs(buildHTML(p, kind, lg), selFor(kind)).then(function(blobs){
        blobs.forEach(function(b, i){
          download(b, fileBase(p,kind,lg) + (blobs.length>1 ? '_p'+(i+1) : '') + '.png'); });
        run(ix+1);
      }).catch(function(err){ msg('Could not render the image: '+err.message, true); });
    };
    run(0);
    return;
  }

  /* share */
  var lg = langs[0];
  if(isPng(kind)){
    msg('Building the images…');
    htmlToPngBlobs(buildHTML(p, kind, lg), selFor(kind)).then(function(blobs){
      var files = blobs.map(function(b,i){
        return new File([b], fileBase(p,kind,lg)+(blobs.length>1?'_p'+(i+1):'')+'.png', { type:'image/png' }); });
      var ttl = IPODocs.S(p.meta.company);
      return shareNow(files, ttl).then(function(r){
        if(r.ok){ msg(r.cancelled ? '' : 'Shared.'); return; }
        if(r.reason === 'gesture'){
          offerShare(files, ttl, '<b>The images are ready.</b> Tap once more to send them. ');
          return;
        }
        files.forEach(function(f,i){ download(blobs[i], f.name); });
        msg('Sharing is not available in this browser, so the images were saved instead.');
      });
    }).catch(function(err){ msg('Could not render the images: '+err.message, true); });
  } else {
    msg('Building the PDF…');
    htmlToPdfBlob(buildHTML(p, kind, lg), selFor(kind)).then(function(blob){
      var name = fileBase(p, kind, lg)+'.pdf';
      var file = new File([blob], name, { type:'application/pdf' });
      var ttl2 = IPODocs.S(p.meta.company);
      return shareNow([file], ttl2).then(function(r){
        if(r.ok){ msg(r.cancelled ? '' : 'Shared.'); return; }
        if(r.reason === 'gesture'){
          offerShare([file], ttl2, '<b>The PDF is ready.</b> Tap once more to send it. ');
          return;
        }
        download(blob, name);
        msg('Sharing is not available in this browser, so the file was saved instead.');
      });
    }).catch(function(err){ msg('Could not build the PDF: '+err.message, true); });
  }
}

document.addEventListener('DOMContentLoaded', function(){
  document.addEventListener('click', function(ev){
    var t = ev.target;

    var lg = t.closest && t.closest('[data-alllang]');
    if(lg){
      ALL_LANG = lg.dataset.alllang;
      var row = lg.closest('.langseg');
      Array.prototype.forEach.call(row.querySelectorAll('.lg'), function(x){
        x.classList.toggle('on', x === lg); });
      return;
    }

    if(t.id === 'btnShareNow' && PENDING_SHARE){
      var ps = PENDING_SHARE;
      shareNow(ps.files, ps.title).then(function(r){
        if(r.ok){ PENDING_SHARE = null; msg(r.cancelled ? '' : 'Shared ' + ps.files.length + ' file(s).'); }
        else { ps.files.forEach(function(f){ download(f, f.name); });
               PENDING_SHARE = null;
               msg('That did not go through, so the files were saved to this device instead.'); }
      });
      return;
    }
    if(t.id === 'btnSaveInstead' && PENDING_SHARE){
      PENDING_SHARE.files.forEach(function(f){ download(f, f.name); });
      msg('Saved ' + PENDING_SHARE.files.length + ' file(s) to this device.');
      PENDING_SHARE = null;
      return;
    }

    var b = t.closest && t.closest('[data-doc]');
    if(!b) return;
    var inScore = !!(b.closest('#scDocs'));
    doAction(b.dataset.doc, b.dataset.act, inScore ? '#scMsg' : '#docMsg');
  });

  var back = $('#pvBack'), save = $('#pvSave');
  if(back) back.addEventListener('click', function(){ try{ history.back(); }catch(e){ closePreview(); } });
  if(save) save.addEventListener('click', printPreview);
  window.addEventListener('popstate', function(){ closePreview(); });
  document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') closePreview(); });
});

window.IPODocTools = { currentPayload:currentPayload, buildHTML:buildHTML, doAction:doAction,
                       htmlToPngBlobs:htmlToPngBlobs, htmlToPdfBlob:htmlToPdfBlob };
})();
