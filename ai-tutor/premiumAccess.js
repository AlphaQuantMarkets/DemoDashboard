(function createTutorPremiumAccess() {
  async function getTutorAccess() {
    const token = localStorage.getItem('authToken');
    if (!token) {
      return { isPremium: false, user: null };
    }

    try {
      const response = await fetch(window.TutorApi.apiUrl('/api/auth/me'), {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        return { isPremium: false, user: null };
      }

      const { user } = await response.json();
      return { isPremium: user?.is_premium === true, user };
    } catch {
      return { isPremium: false, user: null };
    }
  }

  window.TutorPremiumAccess = { getTutorAccess };
})();
