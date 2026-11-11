/* Reference drawer motion; native dialog retains Escape and keyboard focus handling. */
(() => {
  'use strict';
  const dialog=document.querySelector('[data-mobile-menu]');
  const opener=document.querySelector('[data-menu-open]');
  const closer=dialog?.querySelector('[data-menu-close]');
  if (!dialog || !opener || !closer || typeof dialog.showModal!=='function') return;
  const mobile=matchMedia('(max-width:820px)'),reduced=matchMedia('(prefers-reduced-motion:reduce)');
  let closeTimer=null;
  const sync=()=>{
    opener.setAttribute('aria-expanded',String(dialog.open));
    document.documentElement.classList.toggle('mobile-menu-open',dialog.open);
  };
  function finishClose() {
    clearTimeout(closeTimer);closeTimer=null;
    if(dialog.open)dialog.close();dialog.classList.remove('is-closing');sync();
  }
  function requestClose() {
    if(!dialog.open || dialog.classList.contains('is-closing'))return;
    if(reduced.matches){finishClose();return;}
    dialog.classList.add('is-closing');closeTimer=setTimeout(finishClose,350);
  }
  opener.addEventListener('click',()=>{if(!dialog.open){dialog.showModal();sync();}});
  closer.addEventListener('click',requestClose);
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  dialog.addEventListener('animationend',event=>{if(event.target===dialog && dialog.classList.contains('is-closing'))finishClose();});
  dialog.addEventListener('close',()=>{clearTimeout(closeTimer);closeTimer=null;dialog.classList.remove('is-closing');sync();});
  dialog.addEventListener('click',event=>{if(event.target.closest('a[href]'))requestClose();});
  const onSize=()=>{if(!mobile.matches && dialog.open)finishClose();};
  if(mobile.addEventListener)mobile.addEventListener('change',onSize);else mobile.addListener(onSize);
  window.addEventListener('pagehide',finishClose);sync();
})();
