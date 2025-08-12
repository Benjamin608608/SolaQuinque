(function(){
  // Theme management with accessibility considerations
  document.addEventListener('DOMContentLoaded', function(){
    const body = document.body;
    
    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      body.classList.add('motion-off');
    } else {
      body.classList.remove('motion-off');
    }
    
    // Check for dark mode preference
    const prefersDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Apply saved theme preference or default
    const savedTheme = localStorage.getItem('theme-preference');
    if (savedTheme === 'candle' || (prefersDarkMode && !savedTheme)) {
      body.classList.add('theme-ecclesia', 'theme-candle');
    } else {
      body.classList.add('theme-ecclesia');
      body.classList.remove('theme-candle');
    }
    
    body.classList.remove('enable-initial');
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
      if (!localStorage.getItem('theme-preference')) {
        if (e.matches) {
          body.classList.add('theme-candle');
        } else {
          body.classList.remove('theme-candle');
        }
      }
    });
  });
})();