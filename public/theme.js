(function(){
  // Apply Ecclesia theme only when explicitly enabled
  document.addEventListener('DOMContentLoaded', function(){
    const body = document.body;
    const enable = (localStorage.getItem('ecclesiaTheme') === 'on');
    if (enable) {
      body.classList.add('theme-ecclesia');
      body.classList.add('theme-candle');
      body.classList.remove('motion-off');
      body.classList.remove('enable-initial');
    } else {
      body.classList.remove('theme-ecclesia');
      body.classList.remove('theme-candle');
    }
  });
})();