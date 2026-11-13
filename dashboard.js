const STORAGE_KEY = "pulseFitnessApp_v1";
const ACTIVE_USER_KEY = "pulseFitnessActiveUser";
const database = loadDatabase();
const currentEmail = sessionStorage.getItem(ACTIVE_USER_KEY);
const hasActiveUser = Boolean(currentEmail && database.users[currentEmail]);

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

// Saves changes to the account data; called by the food-log handlers.
function saveDatabase() {
  localStorage.setItem(STORAGE_KEY,JSON.stringify(database));
}

// Returns the signed-in account; called by the dashboard functions.
function currentUser() {
  return database.users[currentEmail];
}

// Makes today's date key; called by ensureDailyLog.
function getTodayDateKey() {
  const currentDate = new Date();
  return `${currentDate.getFullYear()}-${String(currentDate.getMonth()+1).padStart(2,"0")}-${String(currentDate.getDate()).padStart(2,"0")}`;
}

// Gets or creates today's food log; calls getTodayDateKey.
function ensureDailyLog(account) {
  const dateKey = getTodayDateKey();
  if (!account.days[dateKey]) account.days[dateKey] = {foods:[]};
  return account.days[dateKey];
}

// Makes an ID for a new food entry; called when the food form is submitted.
function createFoodEntryId() {
  return Date.now();
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

// Formats a number for display; called by renderMetrics and renderFood.
function formatNumber(number) {
  return Number(number || 0).toLocaleString(undefined,{maximumFractionDigits:1});
}

// Escapes text before adding it to HTML; called by renderFood.
function escapeHTML(value) {
  const textElement = document.createElement("span");
  textElement.textContent = value;
  return textElement.innerHTML;
}

// Adds up today's food values and updates the nutrition cards.
// Calls currentUser, ensureDailyLog, and formatNumber.
function renderMetrics() {
  const account = currentUser();
  const dailyLog = ensureDailyLog(account);
  const foodEntries = dailyLog.foods;
  const totals = {
    calories:0,
    protein:0,
    carbs:0,
    fat:0
  };
  for (let i = 0; i < foodEntries.length; i++) {
    const foodEntry = foodEntries[i];
    totals.calories += foodEntry.calories;
    totals.protein += foodEntry.protein;
    totals.carbs += foodEntry.carbs;
    totals.fat += foodEntry.fat;
  }

  const metrics = [
    {elementPrefix:"cal",value:totals.calories,target:account.targets.calories,unit:"kcal"},
    {elementPrefix:"protein",value:totals.protein,target:account.targets.protein,unit:"g"},
    {elementPrefix:"carbs",value:totals.carbs,target:account.targets.carbs,unit:"g"},
    {elementPrefix:"fat",value:totals.fat,target:account.targets.fat,unit:"g"}
  ];
  for (let i = 0; i < metrics.length; i++) {
    const metric = metrics[i];
    document.getElementById(metric.elementPrefix + "Value").textContent = formatNumber(metric.value) + (metric.unit === "kcal" ? "" : " " + metric.unit);
    document.getElementById(metric.elementPrefix + "Target").textContent = `of ${formatNumber(metric.target)} ${metric.unit}`;
    document.getElementById(metric.elementPrefix + "Bar").style.width = Math.min(100,metric.target > 0 ? metric.value / metric.target * 100 : 0) + "%";
  }
  document.getElementById("todayLabel").textContent = new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});
}

// Displays today's foods; calls currentUser, ensureDailyLog, escapeHTML, and formatNumber.
function renderFood() {
  const list = document.getElementById("foodList");
  const foodEntries = ensureDailyLog(currentUser()).foods;
  if (!foodEntries.length) {
    list.innerHTML = '<div class="mt-4 rounded-lg border border-dashed border-slate-700 bg-slate-950 px-3 py-6 text-center text-sm text-slate-400">No food logged yet. Add your first meal above.</div>';
    return;
  }
  let foodHTML = "";
  for (let i = foodEntries.length - 1; i >= 0; i--) {
    const foodEntry = foodEntries[i];
    foodHTML += `
    <div class="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-3">
      <div class="min-w-0">
        <div class="break-words font-bold">${escapeHTML(foodEntry.name)}</div>
        <div class="mt-0.5 text-xs text-slate-400">P ${formatNumber(foodEntry.protein)}g · C ${formatNumber(foodEntry.carbs)}g · F ${formatNumber(foodEntry.fat)}g</div>
      </div>
      <div class="flex shrink-0 items-center gap-2.5">
        <span class="whitespace-nowrap text-sm text-slate-300">${formatNumber(foodEntry.calories)} kcal</span>
        <button class="rounded-[7px] px-[7px] py-1 text-lg text-rose-400 hover:bg-rose-950" data-food-id="${escapeHTML(foodEntry.id)}" title="Delete food" type="button">×</button>
      </div>
    </div>
    `;
  }
  list.innerHTML = foodHTML;
}

// Sets up food deletion and submission; its handlers call saveDatabase, renderAll, and toast.
// Backend handoff: Send the form's name and nutrition values to the food
// create endpoint; use the saved entry returned by the API.
function initFoodLogger() {
  // Deletes the selected food; calls currentUser, ensureDailyLog, saveDatabase, renderAll, and toast.
  document.getElementById("foodList").addEventListener("click",function(event) {
    const deleteButton = event.target.closest("[data-food-id]");
    if (!deleteButton) return;
    const dailyLog = ensureDailyLog(currentUser());
    const remainingFoodEntries = [];
    for (let i = 0; i < dailyLog.foods.length; i++) {
      const foodEntry = dailyLog.foods[i];
      if (String(foodEntry.id) !== deleteButton.dataset.foodId) {
        remainingFoodEntries.push(foodEntry);
      }
    }
    dailyLog.foods = remainingFoodEntries;
    saveDatabase();
    renderAll();
    toast("Food entry deleted");
  });

  // Saves a new food entry; calls currentUser, ensureDailyLog, createFoodEntryId, saveDatabase, renderAll, and toast.
  document.getElementById("foodForm").addEventListener("submit",function(event) {
    event.preventDefault();
    const dailyLog = ensureDailyLog(currentUser());
    dailyLog.foods.push({
      id:createFoodEntryId(),
      name:document.getElementById("foodName").value,
      calories:Number(document.getElementById("foodCalories").value),
      protein:Number(document.getElementById("foodProtein").value),
      carbs:Number(document.getElementById("foodCarbs").value),
      fat:Number(document.getElementById("foodFat").value)
    });
    saveDatabase();
    event.target.reset();
    document.getElementById("foodProtein").value = document.getElementById("foodCarbs").value = document.getElementById("foodFat").value = 0;
    renderAll();
    toast("Food added to today's log");
  });
}

// Refreshes the user's name and dashboard; calls currentUser, renderMetrics, and renderFood.
function renderAll() {
  const account = currentUser();
  document.getElementById("navUser").textContent = account.profile.name;
  renderMetrics();
  renderFood();
}

if (hasActiveUser) {
  initNavigation();
  initFoodLogger();
  renderAll();
}
