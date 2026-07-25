(function createTutorPremiumAccess() {
  const DEVELOPMENT_PREMIUM_KEY = 'alphaquant_tutor_development_premium';

  function readCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('user')) || null;
    } catch {
      return null;
    }
  }

  function isLocalDevelopment() {
    return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
  }

  function userHasPremiumSubscription(user) {
    return Boolean(user && (user.isPremium === true || user.subscription === 'premium' || user.plan === 'premium'));
  }

  function getTutorAccess() {
    const user = readCurrentUser();
    const isPremium = userHasPremiumSubscription(user)
      || (isLocalDevelopment() && localStorage.getItem(DEVELOPMENT_PREMIUM_KEY) === 'true');

    return { isPremium, user };
  }

  function enableDevelopmentPremiumAccess() {
    if (!isLocalDevelopment()) return false;
    localStorage.setItem(DEVELOPMENT_PREMIUM_KEY, 'true');
    return true;
  }

  window.TutorPremiumAccess = { enableDevelopmentPremiumAccess, getTutorAccess };
})();
