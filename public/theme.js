(function(){
  // Always apply Ecclesia theme by default for all users
  document.addEventListener('DOMContentLoaded', function(){
    const body = document.body;
    body.classList.add('theme-ecclesia');
    body.classList.add('theme-candle');
    body.classList.remove('motion-off');
    body.classList.remove('enable-initial');
  });
})();