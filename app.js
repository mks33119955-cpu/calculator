(() => {
  const data=window.CALC_DATA||{}, transport=data.transport||[], expedition=data.expedition||{}, density=Number(data.density)||250;
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const money=n=>new Intl.NumberFormat('ru-RU').format(Math.round(Number(n)||0))+' ₽';
  const num=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(Number(n)||0);
  const historyKey='logistic-calculator-history-v3';
  let unit='kg';

  const from=$('#from'),to=$('#to'),weight=$('#cargoValue'),unitKg=$('#unitKg'),unitM3=$('#unitM3');
  const transportResult=$('#transportResult'), expeditionResult=$('#expeditionResult'),expCity=$('#expCity'),expWeight=$('#expWeight');

  [...new Set(transport.map(x=>x.from))].sort().forEach(c=>from.add(new Option(c,c)));
  Object.keys(expedition).sort().forEach(c=>expCity.add(new Option(c,c)));

  from.addEventListener('change',()=>{
    to.innerHTML='<option value="">Выберите город</option>';
    to.disabled=!from.value;
    if(from.value)[...new Set(transport.filter(x=>x.from===from.value).map(x=>x.to))].sort().forEach(c=>to.add(new Option(c,c)));
  });

  [unitKg,unitM3].forEach(b=>b.addEventListener('click',()=>{
    unit=b.dataset.unit;
    [unitKg,unitM3].forEach(x=>x.classList.toggle('active',x===b));
    $('#valueLabel').textContent=unit==='kg'?'Вес (кг)':'Объём (м³)';
    weight.placeholder=unit==='kg'?'Например: 500':'Например: 2.5';
  }));

  $$('.mode-btn').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));
  function switchMode(mode){
    $$('.mode-btn').forEach(x=>x.classList.toggle('active',x.dataset.mode===mode));
    $('#mode-transport').classList.toggle('active',mode==='transport');
    $('#mode-expedition').classList.toggle('active',mode==='expedition');
  }

  $('#calcTransport').onclick=calcTransport;
  weight.addEventListener('keydown',e=>{if(e.key==='Enter')calcTransport();});

  function calcTransport(){
    const value=Number(weight.value);
    if(!from.value||!to.value)return showTransportError('Выберите город отправления и назначения.');
    if(!(value>0))return showTransportError('Введите положительный вес или объём.');

    const m3=unit==='kg'?value/density:value;
    const routes=transport.filter(x=>x.from===from.value&&x.to===to.value).map(x=>{
      const raw=m3*Number(x.pricePerM3);
      return {...x,price:Math.max(raw,Number(x.minSum)||0),minimumApplied:raw<(Number(x.minSum)||0)};
    }).sort((a,b)=>a.price-b.price);

    if(!routes.length)return showTransportError('Для этого направления нет тарифа в текущей базе.');
    const best=routes[0];

    transportResult.innerHTML='<h3 class="result-title">✅ Найдено '+routes.length+' вариантов <small>'+from.value+' → '+to.value+' · '+num(value)+' '+(unit==='kg'?'кг':'м³')+' = '+num(m3)+' м³</small></h3>'+
      '<div class="summary"><div class="summary-item"><span class="label">🏆 Лучший</span><span class="value" style="color:#059669">'+money(best.price)+'</span></div><div class="summary-item"><span class="label">📦 Расчётный объём</span><span class="value">'+num(m3)+' м³</span></div><div class="summary-item"><span class="label">💰 Минимум</span><span class="value">'+money(best.minSum)+'</span></div></div>'+
      routes.map((r,i)=>'<div class="result-item '+(i===0?'best':'')+'"><div class="result-header"><span class="result-carrier">🚚 ТК ГК · '+r.from+' → '+r.to+(i===0?' <span class="badge best-badge">⭐ Лучший</span>':'')+(r.minimumApplied?' <span class="badge min-badge">⚠️ Минимум</span>':'')+'</span><span class="result-price">'+money(r.price)+'</span></div><div class="result-details"><span>📊 '+num(r.pricePerM3)+' ₽/м³</span><span>📦 '+num(m3)+' м³</span><span>💰 Мин. '+money(r.minSum)+'</span></div></div>').join('');

    saveHistory({type:'transport',title:from.value+' → '+to.value,meta:num(value)+' '+(unit==='kg'?'кг':'м³'),price:best.price});
  }

  const extras=['remote','crate','avizo','mkad','outside','prr','overtime','storage'];
  extras.forEach(id=>{
    const cb=$('#x-'+id),inp=$('#v-'+id);
    if(cb&&inp)cb.addEventListener('change',()=>{inp.disabled=!cb.checked;});
  });
  $('#calcExpedition').onclick=calcExpedition;

  function calcExpedition(){
    const city=expCity.value,w=Number(expWeight.value),db=expedition[city];
    if(!city)return showExpeditionError('Выберите город экспедирования.');
    if(!db?.base?.[w])return showExpeditionError('Для выбранной категории нет базового тарифа.');

    let total=Number(db.base[w]),lines=[['🚛 Базовый тариф',db.base[w],'до '+num(w)+' кг']],warnings=[];
    addFlat('remote','🏘️ Отдалённый район',db.remote?.[w]);
    addFlat('avizo','⏰ Авизация',w<=500?db.avizo?.under500:db.avizo?.over500);
    addKm('mkad','🛣️ Пробег за МКАД',db.mkad?.[w]);
    addKm('outside','🛣️ Пробег за пределы города',db.outside?.[w]);

    const crate=Number($('#v-crate').value);
    if($('#x-crate').checked&&crate>0&&db.crate){const c=Math.max(crate*db.crate.perM3,db.crate.min);lines.push(['📦 Обрешётка',c,num(crate)+' м³ × '+num(db.crate.perM3)+' ₽/м³']);total+=c;}
    else if($('#x-crate').checked&&!db.crate)warnings.push('Обрешётка не задана в тарифе для этого города.');

    const kg=Number($('#v-prr').value);
    if($('#x-prr').checked&&kg>0&&db.prr&&db.prr.perKg>0){const c=Math.max(kg*db.prr.perKg,db.prr.min);lines.push(['📥 ПРР / разгрузка',c,num(kg)+' кг']);total+=c;}
    else if($('#x-prr').checked&&!db.prr?.perKg)warnings.push('ПРР не задан в тарифе для этого города.');

    const h=Number($('#v-overtime').value);
    if($('#x-overtime').checked&&h>0&&db.overtime){const rate=Number(db.overtime[w])/4,c=h*rate;lines.push(['⏱️ Сверхнормативное время',c,num(h)+' ч × '+num(rate)+' ₽/ч']);total+=c;}
    else if($('#x-overtime').checked&&!db.overtime)warnings.push('Сверхнормативное время не задано.');

    const days=Number($('#v-storage').value);
    if($('#x-storage').checked&&days>0&&db.storage){
      let c=0,detail='';
      if(db.storage.perPallet){c=days*db.storage.perPallet;detail=num(days)+' сут × '+num(db.storage.perPallet)+' ₽/паллет';}
      else if(db.storage.perKg){c=days*db.storage.perKg*1000;detail=num(days)+' сут × 1 т';}
      if(c){lines.push(['🏬 Хранение',c,detail]);total+=c;}
    } else if($('#x-storage').checked&&!db.storage)warnings.push('Хранение не задано в тарифе для этого города.');

    expeditionResult.innerHTML='<div class="expedition-result"><h3>📦 Экспедирование: '+city+'</h3>'+lines.map(x=>'<div class="result-line"><span class="label">'+x[0]+'<br><small>'+x[2]+'</small></span><strong>'+money(x[1])+'</strong></div>').join('')+'<div class="result-line total"><span>💰 ИТОГО</span><span>'+money(total)+'</span></div>'+(warnings.length?warnings.map(x=>'<div class="notice">⚠️ '+x+'</div>').join(''):'')+'</div>';
    saveHistory({type:'expedition',title:'Экспедирование · '+city,meta:'до '+num(w)+' кг',price:total});

    function addFlat(id,label,rate){
      if(!$('#x-'+id).checked)return;
      if(rate==null){warnings.push(label.replace(/^[^ ]+ /,'')+' не задан в тарифе для этого города.');return;}
      lines.push([label,rate,'фиксированный тариф']);total+=rate;
    }
    function addKm(id,label,rate){
      if(!$('#x-'+id).checked)return;
      const km=Number($('#v-'+id).value);
      if(!(km>0))return;
      if(rate==null){warnings.push(label+' не задан в тарифе для этого города.');return;}
      const c=km*rate;lines.push([label,c,num(km)+' км × '+num(rate)+' ₽/км']);total+=c;
    }
  }

  function showTransportError(msg){transportResult.innerHTML='<div class="no-results"><div class="emoji">⚠️</div><p>'+msg+'</p></div>';}
  function showExpeditionError(msg){expeditionResult.innerHTML='<div class="no-results"><div class="emoji">⚠️</div><p>'+msg+'</p></div>';}

  const modal=$('#densityModal');
  $('#densityOpen').onclick=()=>modal.classList.add('active');
  $('#densityClose').onclick=()=>modal.classList.remove('active');
  modal.onclick=e=>{if(e.target===modal)modal.classList.remove('active')};
  $('#densityCalc').onclick=()=>{
    const w=Number($('#densityWeight').value),v=Number($('#densityVolume').value),out=$('#densityOut');
    if(!(w>0)||!(v>0)){out.textContent='Введите и вес, и объём.';out.className='density-result show';return;}
    const vw=v*density;
    out.className='density-result show '+(w>vw?'weight-win':w<vw?'volume-win':'');
    out.innerHTML=w>vw?'📦 Оплата по весу!<br><small>Фактический: '+num(w)+' кг · объёмный: '+num(vw)+' кг</small>':w<vw?'📐 Оплата по объёму!<br><small>Объёмный: '+num(vw)+' кг · фактический: '+num(w)+' кг</small>':'⚖️ Равны!<br><small>'+num(w)+' кг = '+num(v)+' м³ × '+density+'</small>';
  };

  function readHistory(){try{return JSON.parse(localStorage.getItem(historyKey))||[]}catch{return[]}}
  function saveHistory(item){const h=readHistory();h.unshift({...item,at:new Date().toLocaleString('ru-RU')});localStorage.setItem(historyKey,JSON.stringify(h.slice(0,50)));renderHistory();}
  function renderHistory(){
    const h=readHistory();
    $('#historyList').innerHTML=h.length?h.map(x=>'<div class="history-item"><div><b>'+x.title+'</b><br><small>'+x.meta+' · '+x.at+'</small></div><strong>'+money(x.price)+'</strong></div>').join(''):'<div class="history-empty">История расчётов пуста</div>';
  }
  $('#clearHistory').onclick=()=>{localStorage.removeItem(historyKey);renderHistory();};
  renderHistory();
})();