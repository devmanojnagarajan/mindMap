document.addEventListener('DOMContentLoaded', () => {
  const loginButton = document.getElementById('login-btn');

  loginButton.addEventListener('click', () => {
    loginButton.innerHTML = '<i class="ri-loader-4-line spin"></i>';
    loginButton.disabled = true;

    setTimeout(() => {
        window.location.href = 'http://localhost:3000/auth';
    }, 1000);
  });
});
