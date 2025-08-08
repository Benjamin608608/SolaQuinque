(function(){
  // Apply defaults: theme on, candlelight on, motion on, initial-letter off
  document.addEventListener('DOMContentLoaded', function(){
    const body = document.body;
    body.classList.add('theme-ecclesia');
    body.classList.add('theme-candle');
    body.classList.remove('motion-off');
    body.classList.remove('enable-initial');
  });
})();