(() => {
  "use strict";

  const STORAGE_KEY = "pulseFitnessApp_v1";
  const ACTIVE_USER_KEY = "pulseFitnessActiveUser";
  const db = loadDB();
  const currentEmail = sessionStorage.getItem(ACTIVE_USER_KEY);

  // Backend handoff: Load profile and nutrition targets from the API.
  // Send profile/target form values and reset requests to matching API actions.
  if (!currentEmail || !db.users[currentEmail]) {
    sessionStorage.removeItem(ACTIVE_USER_KEY);
    window.location.replace("index.html");
    return;
  }

  // Reads and writes account and settings data in browser storage.
  // Backend handoff: Replace loadDB/saveDB with API reads and writes.
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

  function user() {
    return db.users[currentEmail];
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

  function fmt(n) {
    return Number(n || 0).toLocaleString(undefined,{maximumFractionDigits:1});
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

  // Shows the user's name; clicking Log Out clears the session and opens login.
  function initNavigation() {
    document.getElementById("navUser").textContent = user().profile.name;
    document.getElementById("logoutBtn").addEventListener("click",() => {
      sessionStorage.removeItem(ACTIVE_USER_KEY);
      window.location.href = "index.html";
    });
  }

  // Copies the saved profile and target values into the settings fields.
  function populateSettings() {
    const u = user(), p = u.profile;
    document.getElementById("profileName").value = p.name;
    document.getElementById("profileAge").value = p.age || "";
    document.getElementById("profileHeight").value = fmt(p.heightCm);
    document.getElementById("profileWeight").value = fmt(p.weightKg);
    document.getElementById("profileGoalWeight").value = fmt(p.goalWeightKg);
    document.getElementById("goalSelect").value = p.goal;
    ["calories","protein","carbs","fat"].forEach(k => {
      document.getElementById("target"+k[0].toUpperCase()+k.slice(1)).value = u.targets[k];
    });
  }

  // Connects the profile, targets, recommendation, and reset handlers.
  function initSettingsPage() {
    // Submitting the profile form saves changes and refreshes the displayed name.
    // Backend handoff: Send these profile fields to the profile update endpoint.
    document.getElementById("profileForm").addEventListener("submit",e => {
      e.preventDefault();
      const u = user(), p = u.profile;
      p.name = document.getElementById("profileName").value.trim();
      p.age = Number(document.getElementById("profileAge").value) || 25;
      p.heightCm = Number(document.getElementById("profileHeight").value);
      p.weightKg = Number(document.getElementById("profileWeight").value);
      p.goalWeightKg = Number(document.getElementById("profileGoalWeight").value);
      p.goal = document.getElementById("goalSelect").value;
      saveDB();
      renderAll();
      toast("Profile saved");
    });

    // Submitting targets saves the entered daily calories and macro goals.
    // Backend handoff: Send these target values to the targets update endpoint.
    document.getElementById("targetsForm").addEventListener("submit",e => {
      e.preventDefault();
      const u = user();
      u.targets = {
        calories:Number(document.getElementById("targetCalories").value),
        protein:Number(document.getElementById("targetProtein").value),
        carbs:Number(document.getElementById("targetCarbs").value),
        fat:Number(document.getElementById("targetFat").value)
      };
      saveDB();
      toast("Daily targets saved");
    });

    // Clicking this button recalculates targets using the selected goal.
    // Backend handoff: Send the selected goal/profile to a recommendation
    // endpoint if target calculations move from the browser to the server.
    document.getElementById("recalcBtn").addEventListener("click",() => {
      const u = user();
      u.profile.goal = document.getElementById("goalSelect").value;
      u.targets = recommended(u);
      saveDB();
      populateSettings();
      toast("Recommended targets updated");
    });

    // Clicking Reset asks for confirmation, then clears saved data and returns to login.
    // Backend handoff: Replace local clearing with an account-data deletion
    // request and clear the client session after the server confirms.
    document.getElementById("resetBtn").addEventListener("click",() => {
      if (!confirm("Reset ALL Pulse data in this browser? This will delete every account and all logs.")) return;
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(ACTIVE_USER_KEY);
      sessionStorage.setItem("pulseToast","All local data reset");
      window.location.href = "index.html";
    });
  }

  // Refreshes the displayed name and fills the settings fields from saved data.
  function renderAll() {
    document.getElementById("navUser").textContent = user().profile.name;
    populateSettings();
  }

  initNavigation();
  initSettingsPage();
  renderAll();
})();
