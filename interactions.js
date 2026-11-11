(() => {
  'use strict';
  const button = document.querySelector('[data-copy-email]');
  const toast = document.querySelector('[data-toast]');
  if (!button || !toast || !navigator.clipboard?.writeText) return;
  button.hidden = false;
  let timer;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(button.dataset.copyEmail);
      toast.textContent = '이메일 주소를 복사했어요.';
    } catch {
      toast.textContent = '320823@naver.com으로 메일을 보내주세요.';
    }
    clearTimeout(timer);
    toast.hidden = false;
    timer = setTimeout(() => { toast.hidden = true; }, 2800);
  });
})();
