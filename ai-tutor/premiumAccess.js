(function createTutorPremiumAccess() {
  // status: 'loggedOut' (no/invalid/expired token), 'free' (authenticated,
  // not premium), or 'premium' (authenticated and premium). Always verified
  // against the backend — never trusts a locally-decoded token.
  async function getTutorAccess() {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return { status: 'loggedOut', isPremium: false, user: null };
    }

    try {
      const response = await fetch(window.TutorApi.apiUrl('/api/auth/me'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('authToken');
        }
        return { status: 'loggedOut', isPremium: false, user: null };
      }

      const { user } = await response.json();
      const isPremium = user?.is_premium === true;
      return { status: isPremium ? 'premium' : 'free', isPremium, user };
    } catch {
      return { status: 'loggedOut', isPremium: false, user: null };
    }
  }

  window.TutorPremiumAccess = { getTutorAccess };
})();
