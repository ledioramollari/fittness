(() => {
  "use strict";

  const STORAGE_KEY = "pulseFitnessApp_v1";
  const ACTIVE_USER_KEY = "pulseFitnessActiveUser";
  const db = loadDB();
  let currentEmail = sessionStorage.getItem(ACTIVE_USER_KEY);

  // Backend handoff: Replace local account reads/writes with auth API calls.
  // Login sends email/password and receives an authenticated user/session.
  // Signup sends email, password, and profile fields; keep returned user data.
  if (!currentEmail || !db.users[currentEmail]) {
    currentEmail = null;
    sessionStorage.removeItem(ACTIVE_USER_KEY);
  }

  // Reads and writes account data in browser storage.
  // Backend handoff: loadDB/saveDB are the local data source/sink to replace.
  function loadDB() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {users:{}};
    } catch {
      return {users:{}};
    }
  }

  function saveDB() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  }

  // Calculates recommended calories and macros from the profile and goal.
  function recommended(u) {
    const p = u.profile;
    const kg = p.weightKg || 70, cm = p.heightCm || 170, age = p.age || 25;
    const bmr = 10*kg + 6.25*cm - 5*age + 5;
    let calories = bmr * 1.45;
    if (p.goal === "lose") calories -= 350;
    if (p.goal === "build") calories += 250;
    calories = Math.max(1200, Math.round(calories/50)*50);
    const protein = Math.round(kg * (p.goal === "build" ? 2 : 1.8));
    const fat = Math.round(calories * .27 / 9);
    const carbs = Math.max(0, Math.round((calories - protein*4 - fat*9)/4));
    return {calories,protein,carbs,fat};
  }

  function newUser(email,password,profile) {
    const u = {
      email,
      password,
      profile:{
        name:profile.name,
        age:25,
        heightCm:170,
        weightKg:profile.weightKg,
        goalWeightKg:profile.goalWeightKg,
        goal:profile.goal
      },
      targets:{},
      days:{},
      createdAt:new Date().toISOString()
    };
    u.targets = recommended(u);
    db.users[email] = u;
    saveDB();
  }

  function setActiveUser(email) {
    sessionStorage.setItem(ACTIVE_USER_KEY, email);
  }

  // Shows a message briefly after an action succeeds.
  function toast(message) {
    const toastElement = document.getElementById("toast");
    if (!toastElement) return;
    toastElement.textContent = message;
    toastElement.classList.remove("translate-y-5","opacity-0");
    toastElement.classList.add("translate-y-0","opacity-100");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
      toastElement.classList.add("translate-y-5","opacity-0");
      toastElement.classList.remove("translate-y-0","opacity-100");
    },2200);
  }

  const pendingToast = sessionStorage.getItem("pulseToast");
  if (pendingToast) {
    sessionStorage.removeItem("pulseToast");
    toast(pendingToast);
  }

  // Connects the sign-in, account creation, and onboarding form handlers.
  function initAuthPage() {
    if (currentEmail) {
      window.location.replace("dashboard.html");
      return;
    }

    let authMode = "login";
    let pendingEmail = "";
    let pendingPassword = "";

    function setAuthMode(mode) {
      authMode = mode;
      document.getElementById("loginTab").classList.toggle("bg-slate-800",mode==="login");
      document.getElementById("loginTab").classList.toggle("font-bold",mode==="login");
      document.getElementById("loginTab").classList.toggle("text-slate-100",mode==="login");
      document.getElementById("loginTab").classList.toggle("text-slate-400",mode!=="login");
      document.getElementById("signupTab").classList.toggle("bg-slate-800",mode==="signup");
      document.getElementById("signupTab").classList.toggle("font-bold",mode==="signup");
      document.getElementById("signupTab").classList.toggle("text-slate-100",mode==="signup");
      document.getElementById("signupTab").classList.toggle("text-slate-400",mode!=="signup");
      document.getElementById("authTitle").textContent = mode==="login" ? "Welcome back." : "Start your journey.";
      document.getElementById("authSubtitle").textContent = mode==="login" ? "Log in to keep your progress moving." : "Create an account to track your fitness goals.";
      document.getElementById("authSubmit").textContent = mode==="login" ? "Log In" : "Continue";
      document.getElementById("authPassword").autocomplete = mode==="login" ? "current-password" : "new-password";
      document.getElementById("authError").textContent = "";
    }

    // Clicking either tab calls setAuthMode to update the visible form labels.
    document.getElementById("loginTab").addEventListener("click",() => setAuthMode("login"));
    document.getElementById("signupTab").addEventListener("click",() => setAuthMode("signup"));

    // Submitting this form checks login details or opens onboarding for signup.
    // Backend handoff: Send these form values to the login or signup endpoint;
    // use its response/error instead of checking or creating accounts in db.
    document.getElementById("authForm").addEventListener("submit",e => {
      e.preventDefault();
      const email = document.getElementById("authEmail").value.trim().toLowerCase();
      const password = document.getElementById("authPassword").value;

      if (authMode === "login") {
        const found = db.users[email];
        if (!found || found.password !== password) {
          document.getElementById("authError").textContent = "Email or password is incorrect.";
          return;
        }
        setActiveUser(email);
        window.location.href = "dashboard.html";
        return;
      }

      if (db.users[email]) {
        document.getElementById("authError").textContent = "An account with this email already exists.";
        return;
      }
      if (password.length < 4) {
        document.getElementById("authError").textContent = "Use at least 4 characters for the password.";
        return;
      }
      pendingEmail = email;
      pendingPassword = password;
      document.getElementById("authFormSection").classList.add("hidden");
      document.getElementById("onboardingSection").classList.remove("hidden");
    });

    // Submitting onboarding creates the account and opens the dashboard.
    // Backend handoff: Send these onboarding fields with the signup request.
    document.getElementById("onboardingForm").addEventListener("submit",e => {
      e.preventDefault();
      const weight = Number(document.getElementById("onWeight").value);
      const goalWeight = Number(document.getElementById("onGoalWeight").value);
      if (weight <= 0 || goalWeight <= 0) return;
      newUser(pendingEmail,pendingPassword,{
        name:document.getElementById("onName").value.trim(),
        weightKg:weight,
        goalWeightKg:goalWeight,
        goal:document.getElementById("onGoal").value
      });
      setActiveUser(pendingEmail);
      window.location.href = "dashboard.html";
    });
  }

  initAuthPage();
})();
