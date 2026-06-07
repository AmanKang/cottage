(function () {
  "use strict";

  const TRIP_ID = "cottage-2026";
  const SEED_VERSION = 1;
  const STORAGE_KEY = "cottage-weekend-v1";
  const FIREBASE_VERSION = "10.12.4";
  const FRIENDS = ["Aman", "Rashid", "Ryan", "Nathan", "Kyle", "Luis"];
  const CATEGORIES = ["Food", "Drinks", "Supplies", "Firewood", "Other"];
  const DAYS = [
    { id: "friday", label: "Friday June 26", subtitle: "Heading to Cottage", meals: ["Dinner"] },
    { id: "saturday", label: "Saturday June 27", subtitle: "Heading to Cottage", meals: ["Breakfast", "Lunch", "Dinner"] },
    { id: "sunday", label: "Sunday June 28", subtitle: "Leaving Cottage", meals: ["Breakfast", "Lunch", "Dinner"] },
    { id: "monday", label: "Monday June 29", subtitle: "Checkout", meals: ["Breakfast"] }
  ];

  const appEl = document.querySelector("#app");
  const ui = {
    groceryOpen: undefined,
    travelOpen: true,
    mealsOpen: false,
    assignee: null,
    toastTimer: null,
    selectedDay: "friday"
  };

  let store = null;
  let state = createEmptyState();

  function createEmptyState() {
    return {
      meta: {},
      friends: FRIENDS.map((name) => ({ id: slug(name), name })),
      groceries: [],
      travel: [],
      meals: []
    };
  }

  function createSeedState() {
    return {
      meta: {
        title: "Cottage Weekend with the Boys",
        description: "Cottage weekend with the boys at Algonquin Highlands.",
        dateRange: "Friday June 26 to Monday June 29, 2026",
        address: "3499 Livingstone Lake Road, Township Of Algonquin Highlands, ON P0A",
        mapsUrl: "https://maps.app.goo.gl/2sG6tNWT6Kz2xB2F7",
        airbnbUrl: "https://www.airbnb.ca/trips/v1/reservation-details/ro/RESERVATION2_CHECKIN/HMPCAB2FBX",
        seedVersion: SEED_VERSION
      },
      friends: FRIENDS.map((name, index) => ({ id: slug(name), name, sortOrder: index + 1 })),
      groceries: [
        groceryDoc("eggs", "Eggs", "Food", 1),
        groceryDoc("waffles", "Waffles", "Food", 2)
      ],
      travel: [
        travelDoc("friday-aman", "friday", "heading", "Aman", ["Kyle"], "3pm, Toronto", "", [], 1),
        travelDoc("friday-rashid", "friday", "heading", "Rashid", ["Luis"], "3pm, Toronto", "", [], 2),
        travelDoc("friday-nathan", "friday", "heading", "Nathan", [], "", "", [], 3),
        travelDoc("saturday-ryan", "saturday", "heading", "Ryan", [], "", "", [], 1),
        travelDoc("sunday-rashid", "sunday", "leaving", "Rashid", ["Kyle"], "4pm", "", [], 1),
        travelDoc("sunday-aman", "sunday", "leaving", "Aman", ["Luis"], "11am, Cottage", "", [], 2),
        travelDoc("sunday-nathan", "sunday", "leaving", "Nathan", [], "11am, Cottage", "", [], 3),
        travelDoc("sunday-ryan", "sunday", "leaving", "Ryan", [], "11am, Cottage", "", [], 4),
        travelDoc("monday-checkout", "monday", "checkout", "", [], "", "", [], 1)
      ],
      meals: [
        mealDoc("friday-dinner", "friday", "Dinner", 1),
        mealDoc("saturday-breakfast", "saturday", "Breakfast", 1),
        mealDoc("saturday-lunch", "saturday", "Lunch", 2),
        mealDoc("saturday-dinner", "saturday", "Dinner", 3),
        mealDoc("sunday-breakfast", "sunday", "Breakfast", 1),
        mealDoc("sunday-lunch", "sunday", "Lunch", 2),
        mealDoc("sunday-dinner", "sunday", "Dinner", 3),
        mealDoc("monday-breakfast", "monday", "Breakfast", 1)
      ]
    };
  }

  function groceryDoc(id, name, category, sortOrder) {
    return { id, name, category, completed: false, sortOrder, createdAt: "", updatedAt: "" };
  }

  function travelDoc(id, dayId, section, driver, passengers, departure, arrival, tasks, sortOrder) {
    return { id, dayId, section, driver, passengers, departure, arrival, tasks, sortOrder, updatedAt: "" };
  }

  function mealDoc(id, dayId, mealType, sortOrder) {
    return {
      id,
      dayId,
      mealType,
      what: "",
      details: "",
      ingredients: [],
      headChef: "",
      helper: "",
      cleaners: [],
      sortOrder,
      updatedAt: ""
    };
  }

  function slug(value) {
    return String(value).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeList(value) {
    if (Array.isArray(value)) return value.filter(Boolean).map(String);
    return String(value || "")
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function bySortThenName(a, b) {
    return (a.sortOrder || 0) - (b.sortOrder || 0) || String(a.name || a.mealType || a.driver).localeCompare(String(b.name || b.mealType || b.driver));
  }

  function isFirebaseConfigured() {
    const config = window.COTTAGE_FIREBASE_CONFIG || {};
    return Boolean(config.apiKey && config.projectId && config.appId);
  }

  async function init() {
    try {
      store = isFirebaseConfigured() ? await createFirestoreStore() : createLocalStore();
      await store.ensureSeed();
      store.subscribe((nextState) => {
        state = nextState;
        render();
      });
    } catch (error) {
      console.error(error);
      store = createLocalStore();
      await store.ensureSeed();
      store.subscribe((nextState) => {
        state = nextState;
        render();
      });
      toast("Firebase unavailable. Using local browser storage.");
    }
  }

  function createLocalStore() {
    function read() {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (_error) {
        return null;
      }
    }

    function write(nextState) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    }

    function current() {
      return read() || createSeedState();
    }

    return {
      mode: "local",
      async ensureSeed() {
        if (!read()) write(createSeedState());
      },
      subscribe(callback) {
        callback(current());
        return function unsubscribe() {};
      },
      async updateDoc(collection, id, patch) {
        const nextState = current();
        const list = nextState[collection] || [];
        const index = list.findIndex((item) => item.id === id);
        if (index >= 0) list[index] = { ...list[index], ...patch, updatedAt: new Date().toISOString() };
        write(nextState);
        state = nextState;
        render();
      },
      async addDoc(collection, doc) {
        const nextState = current();
        nextState[collection] = [...(nextState[collection] || []), doc];
        write(nextState);
        state = nextState;
        render();
      },
      async deleteDoc(collection, id) {
        const nextState = current();
        nextState[collection] = (nextState[collection] || []).filter((item) => item.id !== id);
        write(nextState);
        state = nextState;
        render();
      }
    };
  }

  async function createFirestoreStore() {
    const appModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`);
    const fireModule = await import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`);
    const firebaseApp = appModule.initializeApp(window.COTTAGE_FIREBASE_CONFIG);
    const db = fireModule.getFirestore(firebaseApp);

    const mainRef = fireModule.doc(db, "trips", TRIP_ID, "meta", "main");
    const collections = ["friends", "groceries", "travel", "meals"];
    let cache = createEmptyState();

    function collectionRef(name) {
      return fireModule.collection(db, "trips", TRIP_ID, name);
    }

    function docRef(collection, id) {
      return fireModule.doc(db, "trips", TRIP_ID, collection, id);
    }

    return {
      mode: "firestore",
      async ensureSeed() {
        const mainSnap = await fireModule.getDoc(mainRef);
        if (mainSnap.exists() && mainSnap.data().seedVersion === SEED_VERSION) return;

        const seed = createSeedState();
        const batch = fireModule.writeBatch(db);
        batch.set(fireModule.doc(db, "trips", TRIP_ID), { updatedAt: fireModule.serverTimestamp() }, { merge: true });
        batch.set(mainRef, { ...seed.meta, updatedAt: fireModule.serverTimestamp() }, { merge: true });

        collections.forEach((collection) => {
          seed[collection].forEach((doc) => {
            const { id, ...body } = doc;
            batch.set(docRef(collection, id), { ...body, updatedAt: fireModule.serverTimestamp() }, { merge: true });
          });
        });

        await batch.commit();
      },
      subscribe(callback) {
        const unsubscribers = [];
        unsubscribers.push(
          fireModule.onSnapshot(mainRef, (snapshot) => {
            cache = { ...cache, meta: snapshot.exists() ? snapshot.data() : {} };
            callback(cache);
          })
        );

        collections.forEach((collection) => {
          unsubscribers.push(
            fireModule.onSnapshot(collectionRef(collection), (snapshot) => {
              cache = {
                ...cache,
                [collection]: snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })).sort(bySortThenName)
              };
              callback(cache);
            })
          );
        });

        return function unsubscribe() {
          unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
      },
      async updateDoc(collection, id, patch) {
        await fireModule.setDoc(docRef(collection, id), { ...patch, updatedAt: fireModule.serverTimestamp() }, { merge: true });
      },
      async addDoc(collection, doc) {
        const { id, ...body } = doc;
        await fireModule.setDoc(docRef(collection, id), { ...body, createdAt: fireModule.serverTimestamp(), updatedAt: fireModule.serverTimestamp() });
      },
      async deleteDoc(collection, id) {
        await fireModule.deleteDoc(docRef(collection, id));
      }
    };
  }

  function render() {
    const groceryOpen = ui.groceryOpen ?? false;
    appEl.innerHTML = [
      renderTripInfo(),
      renderGroceries(groceryOpen),
      renderTimeline()
    ].join("");
  }

  function renderTripInfo() {
    const meta = state.meta || {};
    return `
      <div class="trip-header">
        <h1>${escapeHtml(meta.title || "Cottage Weekend")}</h1>
        <div class="trip-meta-row">
          <span class="trip-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            Algonquin Highlands
          </span>
          <span class="trip-meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            June 26–29
          </span>
        </div>
        <div class="quick-grid">
          <button class="quick-chip" type="button" data-action="quick-goto" data-target="travel">
            <span class="quick-icon" style="--qi-bg:#e0f2fe;--qi-c:#0284c7">🚗</span>
            Travel
          </button>
          <button class="quick-chip" type="button" data-action="quick-goto" data-target="grocery">
            <span class="quick-icon" style="--qi-bg:#fef9c3;--qi-c:#ca8a04">🛒</span>
            Grocery
          </button>
          <button class="quick-chip" type="button" data-action="quick-goto" data-target="meals">
            <span class="quick-icon" style="--qi-bg:#fce7f3;--qi-c:#db2777">🍳</span>
            Meals
          </button>
        </div>
        <div class="link-row">
          <a class="button" href="${escapeHtml(meta.mapsUrl || "#")}" target="_blank" rel="noopener noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            Google Maps
          </a>
          <a class="button" href="${escapeHtml(meta.airbnbUrl || "#")}" target="_blank" rel="noopener noreferrer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            Airbnb
          </a>
          <button class="button" type="button" data-action="copy-address">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy address
          </button>
        </div>
      </div>
    `;
  }

  function renderGroceries(open) {
    const groceries = [...state.groceries].sort(bySortThenName);
    const remaining = groceries.filter((item) => !item.completed).length;
    return `
      <details class="section-accordion" data-section="groceries" ${open ? "open" : ""}>
        <summary class="accordion-summary">
          <div class="accordion-label">
            <span class="accordion-icon">🛒</span>
            <span>Grocery list</span>
          </div>
          <span class="accordion-count">${remaining} left</span>
        </summary>
        <div class="accordion-body">
          <form class="grocery-form" data-action="add-grocery">
            <input class="field" name="name" type="text" placeholder="Add item" autocomplete="off" required>
            <select name="category" aria-label="Grocery category">
              ${CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("")}
            </select>
            <button class="button primary" type="submit">Add</button>
          </form>
          <ul class="grocery-list">
            ${groceries.map(renderGroceryItem).join("") || `<li class="empty-state">No grocery items yet.</li>`}
          </ul>
        </div>
      </details>
    `;
  }

  function renderGroceryItem(item) {
    return `
      <li class="grocery-item ${item.completed ? "is-complete" : ""}">
        <input class="check" type="checkbox" aria-label="Complete ${escapeHtml(item.name)}" data-action="toggle-grocery" data-id="${escapeHtml(item.id)}" ${item.completed ? "checked" : ""}>
        <input class="field item-name" type="text" value="${escapeHtml(item.name)}" data-collection="groceries" data-id="${escapeHtml(item.id)}" data-field="name">
        <select data-collection="groceries" data-id="${escapeHtml(item.id)}" data-field="category" aria-label="Category for ${escapeHtml(item.name)}">
          ${CATEGORIES.map((category) => `<option value="${category}" ${item.category === category ? "selected" : ""}>${category}</option>`).join("")}
        </select>
        <button class="icon-button danger-hover" type="button" aria-label="Delete ${escapeHtml(item.name)}" data-action="delete-grocery" data-id="${escapeHtml(item.id)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </li>
    `;
  }

  function renderTimeline() {
    const tabs = DAYS.map((day) => `
      <button class="day-tab ${ui.selectedDay === day.id ? "active" : ""}" type="button" data-action="select-day" data-id="${escapeHtml(day.id)}">
        <span class="day-tab-date">${escapeHtml(day.label.split(" ")[2])}</span>
        <span class="day-tab-day">${escapeHtml(day.label.split(" ")[0].slice(0, 2))}</span>
      </button>
    `).join("");

    const activeDay = DAYS.find(d => d.id === ui.selectedDay) || DAYS[0];

    return `
      <section class="timeline">
        <div class="day-tabs">
          ${tabs}
        </div>
        ${renderDay(activeDay)}
      </section>
    `;
  }

  function renderDay(day) {
    const travel = state.travel.filter((item) => item.dayId === day.id).sort(bySortThenName);
    const meals = state.meals.filter((item) => item.dayId === day.id).sort(bySortThenName);
    const travelTitle = day.id === "sunday" ? "Departures" : day.id === "monday" ? "Checkout" : "Travel";
    return `
      <article class="day-panel">
        <details class="section-accordion" data-section="travel" ${ui.travelOpen ? "open" : ""}>
          <summary class="accordion-summary">
            <div class="accordion-label">
              <span class="accordion-icon">🚗</span>
              <span>${travelTitle}</span>
            </div>
            <div class="accordion-right">
              <span class="accordion-count">${travel.length} ${travel.length === 1 ? "car" : "cars"}</span>
              <form data-action="add-travel" data-day-id="${escapeHtml(day.id)}" style="display:contents">
                <button class="button small" type="submit" onclick="event.stopPropagation()">+ Add</button>
              </form>
            </div>
          </summary>
          <div class="accordion-body">
            <div class="card-grid">
              ${travel.map(renderTravelCard).join("") || `<p class="empty-state">No travel rows yet.</p>`}
            </div>
          </div>
        </details>
        <details class="section-accordion" data-section="meals" ${ui.mealsOpen ? "open" : ""}>
          <summary class="accordion-summary">
            <div class="accordion-label">
              <span class="accordion-icon">🍳</span>
              <span>Meals</span>
            </div>
            <span class="accordion-count">${meals.length} ${meals.length === 1 ? "meal" : "meals"}</span>
          </summary>
          <div class="accordion-body">
            <div class="card-grid">
              ${meals.map(renderMealCard).join("")}
            </div>
          </div>
        </details>
      </article>
    `;
  }

  function renderTravelCard(item) {
    const isCheckout = item.section === "checkout";
    return `
      <div class="edit-card">
        <div class="card-head">
          <h4>${isCheckout ? "Checkout / departure notes" : `${escapeHtml(item.driver || "Unassigned")} car`}</h4>
          ${isCheckout ? "" : `<button class="icon-button danger-hover" type="button" aria-label="Delete travel row" data-action="delete-travel" data-id="${escapeHtml(item.id)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>`}
        </div>
        ${isCheckout ? "" : renderTravelFields(item)}
        ${renderTaskList(item)}
      </div>
    `;
  }

  function renderTravelFields(item) {
    return `
      <div class="form-grid">
        <div class="field-group">
          <label for="${item.id}-driver">Driver</label>
          <select id="${item.id}-driver" data-collection="travel" data-id="${escapeHtml(item.id)}" data-field="driver">
            <option value="">Unassigned</option>
            ${FRIENDS.map((friend) => `<option value="${friend}" ${item.driver === friend ? "selected" : ""}>${friend}</option>`).join("")}
          </select>
        </div>
        <div class="field-group">
          <label for="${item.id}-passengers">Passengers</label>
          <input id="${item.id}-passengers" class="field" type="text" value="${escapeHtml((item.passengers || []).join(", "))}" data-collection="travel" data-id="${escapeHtml(item.id)}" data-field="passengers">
        </div>
        <div class="field-group">
          <label for="${item.id}-departure">Departure</label>
          <input id="${item.id}-departure" class="field" type="text" value="${escapeHtml(item.departure || "")}" data-collection="travel" data-id="${escapeHtml(item.id)}" data-field="departure">
        </div>
        <div class="field-group">
          <label for="${item.id}-arrival">Approx arrival</label>
          <input id="${item.id}-arrival" class="field" type="text" value="${escapeHtml(item.arrival || "")}" data-collection="travel" data-id="${escapeHtml(item.id)}" data-field="arrival">
        </div>
      </div>
    `;
  }

  function renderTaskList(item) {
    const tasks = Array.isArray(item.tasks) ? item.tasks : [];
    return `
      <div>
        <span class="label">Tasks</span>
        <ul class="task-list">
          ${tasks.map((task) => renderTaskItem(item.id, task)).join("") || `<li class="empty-state">No tasks yet.</li>`}
        </ul>
        <form class="task-form" data-action="add-task" data-id="${escapeHtml(item.id)}">
          <input class="field" name="task" type="text" placeholder="Add task" autocomplete="off" required>
          <button class="button" type="submit">Add</button>
        </form>
      </div>
    `;
  }

  function renderTaskItem(travelId, task) {
    return `
      <li class="task-item ${task.completed ? "is-complete" : ""}">
        <input class="check" type="checkbox" aria-label="Complete task" data-action="toggle-task" data-travel-id="${escapeHtml(travelId)}" data-task-id="${escapeHtml(task.id)}" ${task.completed ? "checked" : ""}>
        <input class="field task-text" type="text" value="${escapeHtml(task.text)}" data-action="edit-task" data-travel-id="${escapeHtml(travelId)}" data-task-id="${escapeHtml(task.id)}">
        <button class="icon-button danger-hover" type="button" aria-label="Delete task" data-action="delete-task" data-travel-id="${escapeHtml(travelId)}" data-task-id="${escapeHtml(task.id)}"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
      </li>
    `;
  }

  function renderMealCard(item) {
    return `
      <div class="edit-card">
        <h4>${escapeHtml(item.mealType)}</h4>
        <div class="form-grid">
          <div class="field-group wide">
            <label for="${item.id}-what">What</label>
            <input id="${item.id}-what" class="field" type="text" value="${escapeHtml(item.what || "")}" data-collection="meals" data-id="${escapeHtml(item.id)}" data-field="what">
          </div>
          <div class="field-group wide">
            <label for="${item.id}-details">Details</label>
            <textarea id="${item.id}-details" data-collection="meals" data-id="${escapeHtml(item.id)}" data-field="details">${escapeHtml(item.details || "")}</textarea>
          </div>
          <div class="field-group wide">
            <label for="${item.id}-ingredients">Ingredients</label>
            <textarea id="${item.id}-ingredients" data-collection="meals" data-id="${escapeHtml(item.id)}" data-field="ingredients">${escapeHtml((item.ingredients || []).join("\n"))}</textarea>
          </div>
          <div class="field-group wide">
            ${renderAssignee(item, "headChef", "Head chef", false)}
          </div>
        </div>
      </div>
    `;
  }

  function renderAssignee(meal, field, label, multi) {
    const value = multi ? (meal[field] || []).join(", ") : meal[field];
    const isOpen = ui.assignee && ui.assignee.mealId === meal.id && ui.assignee.field === field;
    return `
      <div class="field-group assignee-wrap">
        <label>${escapeHtml(label)}</label>
        <button class="button assignee-button ${value ? "" : "empty"}" type="button" data-action="open-assignee" data-meal-id="${escapeHtml(meal.id)}" data-field="${field}" data-multi="${multi ? "true" : "false"}">
          ${escapeHtml(value || "Unassigned")}
        </button>
        ${isOpen ? renderAssigneePopover(meal, field, multi) : ""}
      </div>
    `;
  }

  function renderAssigneePopover(meal, field, multi) {
    const selected = multi ? meal[field] || [] : [meal[field]].filter(Boolean);
    return `
      <div class="assignee-popover">
        ${FRIENDS.map((friend) => `
          <button class="assignee-option ${selected.includes(friend) ? "active" : ""}" type="button" data-action="select-assignee" data-meal-id="${escapeHtml(meal.id)}" data-field="${field}" data-name="${friend}" data-multi="${multi ? "true" : "false"}">
            <span>${friend}</span>
            <span>${selected.includes(friend) ? "selected" : ""}</span>
          </button>
        `).join("")}
        <div class="assignee-footer">
          <button class="button small" type="button" data-action="clear-assignee" data-meal-id="${escapeHtml(meal.id)}" data-field="${field}" data-multi="${multi ? "true" : "false"}">Clear</button>
          <button class="button small primary" type="button" data-action="close-assignee">Done</button>
        </div>
      </div>
    `;
  }

  async function updateDocument(collection, id, patch, options) {
    const list = state[collection] || [];
    const existing = list.find((item) => item.id === id);
    if (existing) Object.assign(existing, patch);
    if (options && options.render) render();
    try {
      await store.updateDoc(collection, id, patch);
    } catch (error) {
      console.error(error);
      toast("Could not save change.");
    }
  }

  function getTravel(id) {
    return state.travel.find((item) => item.id === id);
  }

  function getMeal(id) {
    return state.meals.find((item) => item.id === id);
  }

  function makeId(prefix) {
    if (crypto && crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function toast(message) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    const node = document.createElement("div");
    node.className = "toast";
    node.textContent = message;
    document.body.appendChild(node);
    clearTimeout(ui.toastTimer);
    ui.toastTimer = setTimeout(() => node.remove(), 2400);
  }

  document.addEventListener("toggle", (event) => {
    const target = event.target;
    if (target.matches('[data-section="groceries"]')) {
      ui.groceryOpen = target.open;
    }
    if (target.matches('[data-section="travel"]')) {
      ui.travelOpen = target.open;
    }
    if (target.matches('[data-section="meals"]')) {
      ui.mealsOpen = target.open;
    }
  }, true);
  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (!store) return;
    const action = form.dataset.action;

    if (action === "add-grocery") {
      event.preventDefault();
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const category = String(data.get("category") || "Other");
      if (!name) return;
      const doc = groceryDoc(makeId("grocery"), name, category, Date.now());
      await store.addDoc("groceries", doc);
      form.reset();
    }

    if (action === "add-task") {
      event.preventDefault();
      const travel = getTravel(form.dataset.id);
      const data = new FormData(form);
      const text = String(data.get("task") || "").trim();
      if (!travel || !text) return;
      const tasks = [...(travel.tasks || []), { id: makeId("task"), text, completed: false }];
      await updateDocument("travel", travel.id, { tasks }, { render: true });
      form.reset();
    }

    if (action === "add-travel") {
      event.preventDefault();
      const dayId = form.dataset.dayId;
      if (!dayId) return;
      const doc = travelDoc(makeId(`travel-${dayId}`), dayId, dayId === "sunday" ? "leaving" : "heading", "", [], "", "", [], Date.now());
      await store.addDoc("travel", doc);
    }
  });

  document.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    if (!store) return;

    const action = target.dataset.action;

    if (action === "select-day") {
      ui.selectedDay = target.dataset.id;
      render();
      return;
    }

    if (action === "quick-goto") {
      const dest = target.dataset.target;
      if (dest === "grocery") { ui.groceryOpen = true; }
      else if (dest === "travel") { ui.travelOpen = true; }
      else if (dest === "meals") { ui.mealsOpen = true; }
      render();
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-section="${dest === "grocery" ? "groceries" : dest}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      return;
    }

    if (action === "copy-address") {
      try {
        await navigator.clipboard.writeText(state.meta.address || "");
        toast("Address copied.");
      } catch (_error) {
        toast("Copy failed.");
      }
    }

    if (action === "delete-grocery") {
      await store.deleteDoc("groceries", target.dataset.id);
    }

    if (action === "delete-travel") {
      await store.deleteDoc("travel", target.dataset.id);
    }

    if (action === "delete-task" || action === "toggle-task") {
      const travel = getTravel(target.dataset.travelId);
      if (!travel) return;
      const tasks = (travel.tasks || []).map((task) => {
        if (task.id !== target.dataset.taskId) return task;
        return action === "toggle-task" ? { ...task, completed: target.checked } : task;
      }).filter((task) => action !== "delete-task" || task.id !== target.dataset.taskId);
      await updateDocument("travel", travel.id, { tasks }, { render: true });
    }

    if (action === "open-assignee") {
      ui.assignee = { mealId: target.dataset.mealId, field: target.dataset.field };
      render();
    }

    if (action === "close-assignee") {
      ui.assignee = null;
      render();
    }

    if (action === "clear-assignee") {
      const meal = getMeal(target.dataset.mealId);
      if (!meal) return;
      const multi = target.dataset.multi === "true";
      await updateDocument("meals", meal.id, { [target.dataset.field]: multi ? [] : "" }, { render: true });
    }

    if (action === "select-assignee") {
      const meal = getMeal(target.dataset.mealId);
      if (!meal) return;
      const field = target.dataset.field;
      const name = target.dataset.name;
      const multi = target.dataset.multi === "true";
      if (multi) {
        const current = meal[field] || [];
        const next = current.includes(name) ? current.filter((item) => item !== name) : [...current, name];
        await updateDocument("meals", meal.id, { [field]: next }, { render: true });
      } else {
        ui.assignee = null;
        await updateDocument("meals", meal.id, { [field]: meal[field] === name ? "" : name }, { render: true });
      }
    }
  });

  document.addEventListener("change", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (!store) return;

    if (target.dataset.action === "toggle-grocery") {
      await updateDocument("groceries", target.dataset.id, { completed: target.checked }, { render: true });
      return;
    }

    const collection = target.dataset.collection;
    const id = target.dataset.id;
    const field = target.dataset.field;
    if (!collection || !id || !field) return;

    let value = target.value;
    if (field === "passengers" || field === "ingredients") value = normalizeList(value);
    await updateDocument(collection, id, { [field]: value });
  });

  document.addEventListener("blur", async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return;
    if (!store) return;

    if (target.dataset.action === "edit-task") {
      const travel = getTravel(target.dataset.travelId);
      if (!travel) return;
      const tasks = (travel.tasks || []).map((task) => task.id === target.dataset.taskId ? { ...task, text: target.value.trim() } : task);
      await updateDocument("travel", travel.id, { tasks });
    }
  }, true);

  init();
})();
