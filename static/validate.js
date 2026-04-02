document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('email');
    const emailHint = document.getElementById('emailHint');
    let popupTimeout; 
  
    form.addEventListener('submit', (event) => {
      const email = emailInput.value.trim();
      const validDomain = email.endsWith('@cs.hku.hk') || email.endsWith('@connect.hku.hk');
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
      if (!emailPattern.test(email) || !validDomain) {
        event.preventDefault();
        showPopup(emailInput, 'Must be an email address with @cs.hku.hk or @connect.hku.hk');
      } else {
        hidePopup();
      }
    });
  
    function showPopup(inputElement, message) {
      
      clearTimeout(popupTimeout);
  
      emailHint.textContent = message;
      const rect = inputElement.getBoundingClientRect();
      emailHint.style.top = `${rect.bottom + window.scrollY + 5}px`;
      emailHint.style.left = `${rect.left + window.scrollX}px`;
      emailHint.classList.add('show');
      emailHint.style.display = 'block';
  
      
      popupTimeout = setTimeout(() => {
        hidePopup();
      }, 3000);
    }
  
    function hidePopup() {
      emailHint.classList.remove('show');
      emailHint.style.display = 'none';
    }
  });
  
  