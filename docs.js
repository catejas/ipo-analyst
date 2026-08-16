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
  var k = kind==='report' ? 'IPO_Company_Research_Report'
        : kind==='exec' ? 'IPO_Executive_Summary'
        : (kind==='score'||kind==='scorepng') ? 'IPO_Score_Card' : 'IPO_Investment_Summary';
  return nm + '_' + k + '_' + lang.toUpperCase();
}
function buildHTML(p, kind, lang){
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

/* ---------- PDF: print (vector, best quality) ---------- */
function openForPrint(html){
  var w = window.open('', '_blank');
  if(!w){ msg('Allow pop-ups for this site, then tap Generate PDF again.', true); return false; }
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(function(){ try{ w.focus(); w.print(); }catch(e){} }, 700);
  return true;
}

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
function share(files, title){
  if(navigator.canShare && navigator.canShare({ files:files })){
    return navigator.share({ files:files, title:title }).then(function(){ return true; })
      .catch(function(){ return false; });
  }
  return Promise.resolve(false);
}

function needPayload(){
  var p = currentPayload();
  if(!p){
    msg('Select a saved analysis first — and it must be a v3 data block imported with Import Data.', true);
    return null;
  }
  return p;
}

/* ---------- one delegated handler for every document row ---------- */
function doAction(kind, act, msgTarget){
  MSG_EL = msgTarget || '#docMsg';
  var p = needPayload(); if(!p) return;
  var langs = langsWanted();

  if(act === 'make' && !isPng(kind)){
    msg('Opening the print view — choose <b>Save as PDF</b> as the destination.');
    langs.forEach(function(lg, i){
      setTimeout(function(){ openForPrint(buildHTML(p, kind, lg)); }, i * 1200);
    });
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
      return share(files, IPODocs.S(p.meta.company)).then(function(ok){
        if(!ok){ files.forEach(function(f,i){ download(blobs[i], f.name); });
                 msg('Sharing is not available in this browser, so the images were downloaded instead.'); }
        else msg('Shared.');
      });
    }).catch(function(err){ msg('Could not render the images: '+err.message, true); });
  } else {
    msg('Building the PDF…');
    htmlToPdfBlob(buildHTML(p, kind, lg), selFor(kind)).then(function(blob){
      var name = fileBase(p, kind, lg)+'.pdf';
      var file = new File([blob], name, { type:'application/pdf' });
      return share([file], IPODocs.S(p.meta.company)).then(function(ok){
        if(!ok){ download(blob, name); msg('Sharing is not available in this browser, so the file was downloaded instead.'); }
        else msg('Shared.');
      });
    }).catch(function(err){ msg('Could not build the PDF: '+err.message, true); });
  }
}

document.addEventListener('DOMContentLoaded', function(){
  document.addEventListener('click', function(ev){
    var b = ev.target.closest && ev.target.closest('[data-doc]');
    if(!b) return;
    var inScore = !!(b.closest('#scDocs'));
    doAction(b.dataset.doc, b.dataset.act, inScore ? '#scMsg' : '#docMsg');
  });
});

window.IPODocTools = { currentPayload:currentPayload, buildHTML:buildHTML, doAction:doAction,
                       htmlToPngBlobs:htmlToPngBlobs, htmlToPdfBlob:htmlToPdfBlob };
})();
