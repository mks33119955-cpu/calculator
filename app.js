(() => {
  const data=window.CALC_DATA, transport=data.transport, expedition=data.expedition, density=data.density;
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const money=n=>new Intl.NumberFormat('ru-RU').format(Math.round(n))+' ₽';
  const num=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
  const historyKey='logistic-calculator-history-v2';
  let unit='kg';
  const from=$('#from'),to=$('#to'),weight=$('#cargoValue'),unitKg=$('#unitKg'),unitM3=$('#unitM3');
  const resultHead=$('#resultHead'),resultBody=$('#resultBody'),expCity=$('#expCity'),expWeight=$('#expWeight');
  [...new Set(transport.map(x=>x.from))].sort().forEach(c=>from.add(new Option(c,c)));
  Object.keys(expedition).sort().forEach(c=>expCity.add(new Option(c,c)));
  from.addEventListener('change',()=>{to.innerHTML='<option value="">Выберите город</option>';to.disabled=!from.value;if(from.value)[...new Set(transport.filter(x=>x.from===from.value).map(x=>x.to))].sort().forEach(c=>to.add(new Option(c,c)));});
  [unitKg,unitM3].forEach(b=>b.addEventListener('click',()=>{unit=b.dataset.unit;[unitKg,unitM3].forEach(x=>x.classList.toggle('active',x===b));$('#valueLabel').textContent=unit==='kg'?'Вес':'Объём';$('#cargoValue').placeholder=unit==='kg'?'Например, 500':'Например, 2,5';}));
  $$('.tab').forEach(b=>b.addEventListener('click',()=>switchMode(b.dataset.mode)));
  function switchMode(m){$$('.tab').forEach(x=>x.classList.toggle('active',x.dataset.mode===m));$('#transportForm').classList.toggle('hidden',m!=='transport');$('#expeditionForm').classList.toggle('hidden',m!=='expedition');clearResult();}
  $('#calcTransport').onclick=calcTransport;
  function calcTransport(){
    const value=Number(weight.value);
    if(!from.value||!to.value)return showError('Выберите город отправления и назначения.');
    if(!(value>0))return showError('Введите положительный вес или объём.');
    const m3=unit==='kg'?value/density:value;
    const routes=transport.filter(x=>x.from===from.value&&x.to===to.value).map(x=>{const raw=m3*x.pricePerM3;return {...x,price:Math.max(raw,x.minSum),minimumApplied:raw<x.minSum};}).sort((a,b)=>a.price-b.price);
    if(!routes.length)return showError('Для этого направления нет тарифа в текущей базе.');
    const best=routes[0];
    resultHead.innerHTML='<div><h2>Варианты перевозки</h2><p>'+from.value+' → '+to.value+' · '+num(value)+' '+(unit==='kg'?'кг':'м³')+' · расчётный объём '+num(m3)+' м³</p></div><div class="total">'+money(best.price)+'</div>';
    resultBody.innerHTML=routes.map((r,i)=>'<div class="quote '+(i===0?'best':'')+'"><div class="quote-top"><div class="quote-name">ТК ГК '+(i===0?'<span class="badge">Оптимальный тариф</span>':'')+'</div><div class="quote-price">'+money(r.price)+'</div></div><div class="chips"><span class="chip">'+num(r.pricePerM3)+' ₽/м³</span><span class="chip">минимум '+money(r.minSum)+'</span>'+(r.minimumApplied?'<span class="chip">применена минималка</span>':'')+'</div></div>').join('');
    saveHistory({type:'transport',title:from.value+' → '+to.value,meta:num(value)+' '+(unit==='kg'?'кг':'м³'),price:best.price});
  }
  const extras=['remote','crate','avizo','mkad','outside','prr','overtime','storage'];
  extras.forEach(id=>{const cb=$('#x-'+id),inp=$('#v-'+id);if(cb&&inp)cb.addEventListener('change',()=>inp.disabled=!cb.checked);});
  $('#calcExpedition').onclick=calcExpedition;
  function calcExpedition(){
    const city=expCity.value,w=Number(expWeight.value),db=expedition[city];
    if(!city)return showError('Выберите город экспедирования.');
    if(!db?.base?.[w])return showError('Для выбранной категории нет базового тарифа.');
    let total=db.base[w],lines=[['Базовый тариф',db.base[w],'до '+num(w)+' кг'],],warnings=[];
    addFlat('remote','Отдалённый район',db.remote?.[w]);
    addFlat('avizo','Авизация',w<=500?db.avizo?.under500:db.avizo?.over500);
    addKm('mkad','Пробег за МКАД',db.mkad?.[w]);
    addKm('outside','Пробег за пределы города',db.outside?.[w]);
    const crate=Number($('#v-crate').value); if($('#x-crate').checked&&crate>0&&db.crate){const c=Math.max(crate*db.crate.perM3,db.crate.min);lines.push(['Обрешётка',c,num(crate)+' м³ × '+num(db.crate.perM3)+' ₽/м³']);total+=c;} else if($('#x-crate').checked&&!db.crate)warnings.push('Обрешётка не задана в тарифе для этого города.');
    const kg=Number($('#v-prr').value); if($('#x-prr').checked&&kg>0&&db.prr&&db.prr.perKg>0){const c=Math.max(kg*db.prr.perKg,db.prr.min);lines.push(['ПРР / разгрузка',c,num(kg)+' кг']);total+=c;} else if($('#x-prr').checked&&!db.prr?.perKg)warnings.push('ПРР не задан в тарифе для этого города.');
    const h=Number($('#v-overtime').value); if($('#x-overtime').checked&&h>0&&db.overtime){const rate=db.overtime[w]/4,c=h*rate;lines.push(['Сверхнормативное время',c,num(h)+' ч × '+num(rate)+' ₽/ч']);total+=c;} else if($('#x-overtime').checked&&!db.overtime)warnings.push('Сверхнормативное время не задано.');
    const days=Number($('#v-storage').value); if($('#x-storage').checked&&days>0&&db.storage){let c=0,detail='';if(db.storage.perPallet){c=days*db.storage.perPallet;detail=num(days)+' сут × '+num(db.storage.perPallet)+' ₽/паллет';}else{c=days*db.storage.perKg*1000;detail=num(days)+' сут × 1 т';}lines.push(['Хранение',c,detail]);total+=c;} else if($('#x-storage').checked&&!db.storage)warnings.push('Хранение не задано в тарифе для этого города.');
    function addFlat(id,label,rate){if(!$('#x-'+id).checked)return;if(rate==null){warnings.push(label+' не задан в тарифе для этого города.');return;}lines.push([label,rate,'фиксированный тариф']);total+=rate;}
    function addKm(id,label,rate){if(!$('#x-'+id).checked)return;const km=Number($('#v-'+id).value);if(!(km>0))return;if(rate==null){warnings.push(label+' не задан в тарифе для этого города.');return;}const c=km*rate;lines.push([label,c,num(km)+' км × '+num(rate)+' ₽/км']);total+=c;}
    resultHead.innerHTML='<div><h2>Экспедирование · '+city+'</h2><p>Категория до '+num(w)+' кг · детализация тарифа</p></div><div class="total">'+money(total)+'</div>';
    resultBody.innerHTML='<div class="breakdown">'+lines.map(x=>'<div class="line"><span>'+x[0]+'<br><small>'+x[2]+'</small></span><strong>'+money(x[1])+'</strong></div>').join('')+'<div class="line total-line"><span>Итого</span><strong>'+money(total)+'</strong></div></div>'+(warnings.length?warnings.map(x=>'<div class="notice">⚠️ '+x+'</div>').join(''):'');
    saveHistory({type:'expedition',title:'Экспедирование · '+city,meta:'до '+num(w)+' кг',price:total});
  }
  function showError(msg){resultHead.innerHTML='<div><h2>Нужны данные</h2><p>Проверьте параметры расчёта</p></div>';resultBody.innerHTML='<div class="result-empty"><span class="empty-icon">⚠️</span>'+msg+'</div>';}
  function clearResult(){resultHead.innerHTML='<div><h2>Результат расчёта</h2><p>Введите параметры слева — здесь появится прозрачная детализация стоимости.</p></div>';resultBody.innerHTML='<div class="result-empty"><span class="empty-icon">🧮</span>Готово к расчёту</div>';}
  const modal=$('#densityModal');$('#densityOpen').onclick=()=>modal.classList.add('open');$('#densityClose').onclick=()=>modal.classList.remove('open');modal.onclick=e=>{if(e.target===modal)modal.classList.remove('open')};
  $('#densityCalc').onclick=()=>{const w=Number($('#densityWeight').value),v=Number($('#densityVolume').value);if(w>0&&v>0){const vw=v*density;$('#densityOut').innerHTML='<b>'+(w>=vw?'Ориентир по весу':'Ориентир по объёму')+'</b><br>Объёмный вес: '+num(vw)+' кг · фактический: '+num(w)+' кг';}else $('#densityOut').textContent='Введите и вес, и объём.';};
  function readHistory(){try{return JSON.parse(localStorage.getItem(historyKey))||[]}catch{return[]}}
  function saveHistory(item){const h=readHistory();h.unshift({...item,at:new Date().toLocaleString('ru-RU')});localStorage.setItem(historyKey,JSON.stringify(h.slice(0,30)));renderHistory();}
  function renderHistory(){const h=readHistory();$('#historyList').innerHTML=h.length?h.map(x=>'<div class="history-item"><div><b>'+x.title+'</b><br><small>'+x.meta+' · '+x.at+'</small></div><strong>'+money(x.price)+'</strong></div>').join(''):'<div class="result-empty">История пока пуста.</div>';}
  $('#clearHistory').onclick=()=>{localStorage.removeItem(historyKey);renderHistory()};renderHistory();
})();
