(() => {
  'use strict';

  const toast = document.getElementById('preview-message');
  let toastTimer;
  let lastModalTrigger;
  let copyTimer;

  function showPreview(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 4200);
  }

  document.querySelectorAll('[data-preview]').forEach((button) => {
    button.addEventListener('click', () => {
      showPreview(`${button.dataset.preview} 기능은 준비 중입니다.`);
    });
  });

  document.querySelectorAll('[data-modal-open]').forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = document.getElementById(button.dataset.modalOpen);
      if (!dialog || typeof dialog.showModal !== 'function') return;
      lastModalTrigger = button;
      dialog.showModal();
    });
  });

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.querySelector('[data-modal-close]')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      if (lastModalTrigger?.isConnected) lastModalTrigger.focus();
    });
  });

  async function copyValue(value) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return;
      } catch {
        // Fall back to a selection-based copy where clipboard permission is unavailable.
      }
    }
    const temporaryInput = document.createElement('textarea');
    temporaryInput.value = value;
    temporaryInput.setAttribute('readonly', '');
    temporaryInput.style.position = 'fixed';
    temporaryInput.style.opacity = '0';
    document.body.append(temporaryInput);
    temporaryInput.select();
    const copied = document.execCommand('copy');
    temporaryInput.remove();
    if (!copied) throw new Error('Clipboard copy was unavailable');
  }

  document.querySelectorAll('[data-copy]').forEach((button) => {
    button.addEventListener('click', async () => {
      const dialog = button.closest('dialog');
      const feedback = dialog?.querySelector('.modal-feedback');
      try {
        await copyValue(button.dataset.copy);
        if (feedback) {
          clearTimeout(copyTimer);
          feedback.textContent = '클립보드에 복사했어요.';
          feedback.hidden = false;
          copyTimer = setTimeout(() => { feedback.hidden = true; }, 2400);
        } else {
          showPreview('클립보드에 복사했어요.');
        }
      } catch {
        if (feedback) {
          feedback.textContent = '복사하지 못했어요. 내용을 길게 눌러 복사해주세요.';
          feedback.hidden = false;
        }
      }
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      clearTimeout(toastTimer);
      toast.hidden = true;
    }
  });
})();
