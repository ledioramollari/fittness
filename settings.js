const STORAGE_KEY = "pulseFitnessApp_v1";
const ACTIVE_USER_KEY = "pulseFitnessActiveUser";
const database = loadDatabase();
const currentEmail = sessionStorage.getItem(ACTIVE_USER_KEY);
const hasActiveUser = Boolean(currentEmail && database.users[currentEmail]);

// Backend handoff: Load profile and nutrition targets from the API.
// Send profile/target form values and reset requests to matching API actions.
if (!hasActiveUser) {
  sessionStorage.removeItem(ACTIVE_USER_KEY);
  window.location.replace("index.html");
}

// Loads account data from localStorage when this script starts.
function loadDatabase() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {users:{}};
  } catch {
    return {users:{}};
  }
}

// Saves changes to the account data; called by the settings handlers.
function saveDatabase() {
  localStorage.setItem(STORAGE_KEY,JSON.stringify(database));
}

// Returns the signed-in account; called by the settings functions.
function currentUser() {
  return database.users[currentEmail];
}

// Calculates calorie and macro targets from an account; called by the target handler.
function calculateRecommendedTargets(account) {
  const profile = account.profile;
  const weightKilograms = profile.weightKg || 70;
  const heightCentimeters = profile.heightCm || 170;
  const ageYears = profile.age || 25;
  const basalMetabolicRate = 10*weightKilograms + 6.25*heightCentimeters - 5*ageYears + 5;
  let calories = basalMetabolicRate * 1.45;
  if (profile.goal === "lose") calories -= 350;
  if (profile.goal === "build") calories += 250;
  calories = Math.max(1200,Math.round(calories/50)*50);
  const protein = Math.round(weightKilograms * (profile.goal === "build" ? 2 : 1.8));
  const fat = Math.round(calories * .27 / 9);
  const carbs = Math.max(0,Math.round((calories - protein*4 - fat*9)/4));
  return {
    calories:calories,
    protein:protein,
    carbs:carbs,
    fat:fat
  };
}

// Formats a number for display; called by populateSettings.
function formatNumber(number) {
  return Number(number || 0).toLocaleString(undefined,{maximumFractionDigits:1});
}

// Shows a short message; calls getElementById and setTimeout to hide it later.
function toast(message) {
  const toastElement = document.getElementById("toast");
  if (!toastElement) return;
  toastElement.textContent = message;
  toastElement.classList.remove("translate-y-5","opacity-0");
  toastElement.classList.add("translate-y-0","opacity-100");
  clearTimeout(toast.timer);
  // Hides the message after a delay by changing the toast's classes.
  toast.timer = setTimeout(function() {
    toastElement.classList.add("translate-y-5","opacity-0");
    toastElement.classList.remove("translate-y-0","opacity-100");
  },2200);
}

if (hasActiveUser) {
  const pendingToast = sessionStorage.getItem("pulseToast");
  if (pendingToast) {
    sessionStorage.removeItem("pulseToast");
    toast(pendingToast);
  }
}

// Shows the user's name and sets up Log Out; calls currentUser.
function initNavigation() {
  document.getElementById("navUser").textContent = currentUser().profile.name;
  // Clears the signed-in email and opens the login page.
  document.getElementById("logoutBtn").addEventListener("click",function() {
    sessionStorage.removeItem(ACTIVE_USER_KEY);
    window.location.href = "index.html";
  });
}

// Copies the saved profile and target values into the fields; calls currentUser and formatNumber.
function populateSettings() {
  const account = currentUser();
  const profile = account.profile;
  document.getElementById("profileName").value = profile.name;
  document.getElementById("profileAge").value = profile.age || "";
  document.getElementById("profileHeight").value = formatNumber(profile.heightCm);
  document.getElementById("profileWeight").value = formatNumber(profile.weightKg);
  document.getElementById("profileGoalWeight").value = formatNumber(profile.goalWeightKg);
  document.getElementById("goalSelect").value = profile.goal;
  const macroNames = ["calories","protein","carbs","fat"];
  for (let i = 0; i < macroNames.length; i++) {
    const macroName = macroNames[i];
    document.getElementById("target"+macroName[0].toUpperCase()+macroName.slice(1)).value = account.targets[macroName];
  }
}

// Sets up the profile, target, recommendation, and reset handlers.
function initSettingsPage() {
  // Saves profile changes; calls currentUser, saveDatabase, renderAll, and toast.
  // Backend handoff: Send these profile fields to the profile update endpoint.
  document.getElementById("profileForm").addEventListener("submit",function(event) {
    event.preventDefault();
    const account = currentUser();
    const profile = account.profile;
    profile.name = document.getElementById("profileName").value.trim();
    profile.age = Number(document.getElementById("profileAge").value) || 25;
    profile.heightCm = Number(document.getElementById("profileHeight").value);
    profile.weightKg = Number(document.getElementById("profileWeight").value);
    profile.goalWeightKg = Number(document.getElementById("profileGoalWeight").value);
    profile.goal = document.getElementById("goalSelect").value;
    saveDatabase();
    renderAll();
    toast("Profile saved");
  });

  // Saves the daily targets; calls currentUser, saveDatabase, and toast.
  // Backend handoff: Send these target values to the targets update endpoint.
  document.getElementById("targetsForm").addEventListener("submit",function(event) {
    event.preventDefault();
    const account = currentUser();
    account.targets = {
      calories:Number(document.getElementById("targetCalories").value),
      protein:Number(document.getElementById("targetProtein").value),
      carbs:Number(document.getElementById("targetCarbs").value),
      fat:Number(document.getElementById("targetFat").value)
    };
    saveDatabase();
    toast("Daily targets saved");
  });

  // Recalculates targets; calls currentUser, calculateRecommendedTargets, saveDatabase, populateSettings, and toast.
  // Backend handoff: Send the selected goal/profile to a recommendation
  // endpoint if target calculations move from the browser to the server.
  document.getElementById("recalcBtn").addEventListener("click",function() {
    const account = currentUser();
    account.profile.goal = document.getElementById("goalSelect").value;
    account.targets = calculateRecommendedTargets(account);
    saveDatabase();
    populateSettings();
    toast("Recommended targets updated");
  });

  // Confirms and clears all saved data, then opens login; calls confirm.
  // Backend handoff: Replace local clearing with an account-data deletion
  // request and clear the client session after the server confirms.
  document.getElementById("resetBtn").addEventListener("click",function() {
    if (!confirm("Reset ALL Pulse data in this browser? This will delete every account and all logs.")) return;
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(ACTIVE_USER_KEY);
    sessionStorage.setItem("pulseToast","All local data reset");
    window.location.href = "index.html";
  });
}

// Refreshes the displayed name and settings fields; calls currentUser and populateSettings.
function renderAll() {
  document.getElementById("navUser").textContent = currentUser().profile.name;
  populateSettings();
}

if (hasActiveUser) {
  initNavigation();
  initSettingsPage();
  renderAll();
}
