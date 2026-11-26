const STORAGE_KEYS = {
  menu: "littleBean.menu.v1",
  orders: "littleBean.orders.v1",
  customers: "littleBean.customers.v1",
  settings: "littleBean.settings.v1",
};

const defaultSettings = {
  shopName: "Lazzat Cafe",
  address: "",
  phone: "",
  email: "",
  gstin: "",
  fssai: "",
  defaultTaxRate: 5,
  receiptFooter: "Made with love & a little coffee.",
};

const defaultMenu = [
  { id: "avocado-toast", name: "Avocado toast", category: "Meals", price: 240 },
  { id: "grilled-sandwich", name: "Grilled sandwich", category: "Meals", price: 210 },
  { id: "french-fries", name: "French fries", category: "Snacks", price: 150 },
];

const categoryColors = {
  Snacks: "#f1efe6",
  Meals: "#edf2e8",
  Drinks: "#eaf1f3",
  Dessert: "#f7eee8",
  Other: "#f0edf4",
};
const standardMenuCategories = ["Snacks", "Meals", "Drinks", "Dessert", "Other"];
const removedMenuCategories = new Set(["Coffee", "Tea", "Bakery"]);
const legacyMenuCategories = new Map([["Bites", "Snacks"]]);
const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });

function readStorage(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.error(`Unable to read ${key} from local storage.`, error);
    return fallback;
  }
}

const storedMenu = readStorage(STORAGE_KEYS.menu, defaultMenu);
let menu = Array.isArray(storedMenu)
  ? storedMenu.filter((item) => !item || !removedMenuCategories.has(item.category)).map((item) => {
    if (!item || typeof item !== "object") return item;
    const cleanItem = { ...item };
    delete cleanItem.emoji;
    const migratedCategory = legacyMenuCategories.get(cleanItem.category);
    if (migratedCategory) cleanItem.category = migratedCategory;
    return cleanItem;
  })
  : defaultMenu;
const shouldMigrateMenu = Array.isArray(storedMenu) && storedMenu.some((item) => item && (
  Object.prototype.hasOwnProperty.call(item, "emoji")
  || removedMenuCategories.has(item.category)
  || legacyMenuCategories.has(item.category)
));
let orders = readStorage(STORAGE_KEYS.orders, []);
let customers = readStorage(STORAGE_KEYS.customers, []);
const storedSettings = readStorage(STORAGE_KEYS.settings, {});
let settings = { ...defaultSettings, ...(storedSettings && typeof storedSettings === "object" ? storedSettings : {}) };
const shouldRenameDefaultShop = settings.shopName === "Little Bean Cafe";
if (shouldRenameDefaultShop) settings.shopName = defaultSettings.shopName;
if (!Array.isArray(menu)) menu = defaultMenu;
if (!Array.isArray(orders)) orders = [];
if (!Array.isArray(customers)) customers = [];

let activeCategory = "All";
let cart = new Map();
let activePage = "billing";
let orderType = "Dine in";
let paymentMethod = "Cash";
let toastTimer;

const elements = {
  categories: document.getElementById("category-list"),
  products: document.getElementById("product-grid"),
  orderPanel: document.querySelector(".order-panel"),
  mobileBillDock: document.getElementById("mobile-bill-dock"),
  mobileBillCount: document.getElementById("mobile-bill-count"),
  mobileBillTotal: document.getElementById("mobile-bill-total"),
  menuCount: document.getElementById("menu-count"),
  search: document.getElementById("menu-search"),
  cartItems: document.getElementById("cart-items"),
  emptyCart: document.getElementById("empty-cart"),
  subtotal: document.getElementById("subtotal"),
  discount: document.getElementById("discount"),
  taxRate: document.getElementById("tax-rate"),
  taxAmount: document.getElementById("tax-amount"),
  grandTotal: document.getElementById("grand-total"),
  checkout: document.getElementById("checkout-button"),
  customer: document.getElementById("customer-name"),
  customerPhone: document.getElementById("customer-whatsapp"),
  todaySales: document.getElementById("today-sales"),
  toast: document.getElementById("toast"),
  menuModal: document.getElementById("menu-modal"),
  menuForm: document.getElementById("menu-form"),
  menuModalTitle: document.getElementById("menu-modal-title"),
  menuSubmitText: document.getElementById("menu-submit-text"),
  historyModal: document.getElementById("history-modal"),
  historyList: document.getElementById("history-list"),
  receipt: document.getElementById("print-receipt"),
  customerModal: document.getElementById("customer-modal"),
  customerForm: document.getElementById("customer-form"),
  customerOptions: document.getElementById("customer-options"),
  customerSearch: document.getElementById("customer-search"),
  customerTable: document.getElementById("customer-table-body"),
  customerEmpty: document.getElementById("customer-empty"),
  customerStats: document.getElementById("customer-stats"),
  reportPeriod: document.getElementById("report-period"),
  reportStats: document.getElementById("report-stats"),
  salesChart: document.getElementById("sales-chart"),
  salesChartCaption: document.getElementById("sales-chart-caption"),
  paymentBreakdown: document.getElementById("payment-breakdown"),
  kitchenOrders: document.getElementById("kitchen-orders"),
  activeOrderCount: document.getElementById("active-order-count"),
  kitchenPrintTicket: document.getElementById("kitchen-print-ticket"),
  settingsForm: document.getElementById("settings-form"),
  downloadBackup: document.getElementById("download-backup"),
  restoreBackup: document.getElementById("restore-backup"),
  backupFile: document.getElementById("backup-file"),
};

let kitchenView = "active";

if (shouldMigrateMenu) persist(STORAGE_KEYS.menu, menu);
if (shouldRenameDefaultShop) persist(STORAGE_KEYS.settings, settings);

function applyShopSettings() {
  document.getElementById("shop-name-display").textContent = settings.shopName;
  if (!cart.size) elements.taxRate.value = String(settings.defaultTaxRate);
  const form = elements.settingsForm.elements;
  form.namedItem("shopName").value = settings.shopName;
  form.namedItem("address").value = settings.address;
  form.namedItem("phone").value = settings.phone;
  form.namedItem("email").value = settings.email;
  form.namedItem("gstin").value = settings.gstin;
  form.namedItem("fssai").value = settings.fssai;
  form.namedItem("defaultTaxRate").value = String(settings.defaultTaxRate);
  form.namedItem("receiptFooter").value = settings.receiptFooter;
}

function persist(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Unable to save ${key} to local storage.`, error);
    showToast("Couldn't save changes. Check this device's storage.");
    return false;
  }
}

function createBackup() {
  return {
    format: "lazzat-cafe-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { menu, orders, customers, settings },
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateBackup(backup) {
  if (!isRecord(backup) || backup.format !== "lazzat-cafe-backup" || backup.version !== 1 || !isRecord(backup.data)) {
    throw new Error("This is not a supported Lazzat Cafe backup file.");
  }
  const data = backup.data;
  const validMenu = Array.isArray(data.menu) && data.menu.every((item) => (
    isRecord(item)
    && typeof item.id === "string" && item.id.trim()
    && typeof item.name === "string" && item.name.trim()
    && typeof item.category === "string" && item.category.trim()
    && Number.isFinite(item.price) && item.price > 0
  ));
  const validCustomers = Array.isArray(data.customers) && data.customers.every((customer) => (
    isRecord(customer)
    && typeof customer.id === "string"
    && typeof customer.name === "string" && customer.name.trim()
    && (customer.phone === undefined || typeof customer.phone === "string")
  ));
  const validOrders = Array.isArray(data.orders) && data.orders.every((order) => (
    isRecord(order)
    && typeof order.id === "string" && order.id.trim()
    && typeof order.createdAt === "string" && !Number.isNaN(Date.parse(order.createdAt))
    && typeof order.customer === "string"
    && typeof order.orderType === "string"
    && typeof order.paymentMethod === "string"
    && Array.isArray(order.items) && order.items.every((item) => (
      isRecord(item)
      && typeof item.name === "string" && item.name.trim()
      && Number.isFinite(item.price) && item.price >= 0
      && Number.isInteger(item.quantity) && item.quantity > 0
    ))
    && ["subtotal", "discount", "taxRate", "tax", "total"].every((key) => (
      Number.isFinite(order[key]) && order[key] >= 0
    ))
    && (order.customerPhone === undefined || typeof order.customerPhone === "string")
    && (order.whatsappSentAt === undefined || typeof order.whatsappSentAt === "string")
    && (order.status === undefined || ["Preparing", "Ready", "Completed"].includes(order.status))
  ));
  const validSettings = isRecord(data.settings)
    && ["shopName", "address", "phone", "email", "gstin", "fssai", "receiptFooter"].every((key) => (
      typeof data.settings[key] === "string"
    ))
    && [0, 5, 12, 18].includes(data.settings.defaultTaxRate);

  if (!validMenu || !validCustomers || !validOrders || !validSettings) {
    throw new Error("The backup file contains invalid or incomplete cafe data.");
  }
  return data;
}

function restoreBackupData(data) {
  const entries = [
    [STORAGE_KEYS.menu, data.menu],
    [STORAGE_KEYS.orders, data.orders],
    [STORAGE_KEYS.customers, data.customers],
    [STORAGE_KEYS.settings, data.settings],
  ];
  const previous = entries.map(([key]) => [key, localStorage.getItem(key)]);
  try {
    entries.forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  } catch (error) {
    let rollbackError = null;
    previous.forEach(([key, value]) => {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch (restoreError) {
        rollbackError = rollbackError || restoreError;
      }
    });
    console.error("Unable to restore the backup.", error);
    if (rollbackError) {
      console.error("Unable to fully roll back backup storage changes.", rollbackError);
      throw new Error("Storage failed during restore and existing data may be incomplete.");
    }
    throw new Error("Could not save the backup. Existing data was kept.");
  }

  menu = data.menu;
  orders = data.orders;
  customers = data.customers;
  settings = data.settings;
  cart.clear();
  elements.customer.value = "";
  elements.customerPhone.value = "";
  elements.discount.value = "0";
  elements.search.value = "";
  activeCategory = "All";
  applyShopSettings();
  renderCategories();
  renderProducts();
  renderCart();
  renderTodaySales();
  renderCustomers();
  renderReports();
  renderKitchenOrders();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2800);
}

function renderCategories() {
  const categories = ["All", ...new Set([...standardMenuCategories, ...menu.map((item) => item.category)])];
  if (!categories.includes(activeCategory)) activeCategory = "All";
  elements.categories.innerHTML = "";
  categories.forEach((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `category-button${category === activeCategory ? " active" : ""}`;
    button.textContent = category;
    button.addEventListener("click", () => {
      activeCategory = category;
      renderCategories();
      renderProducts();
    });
    elements.categories.append(button);
  });
}

function renderProducts() {
  const query = elements.search.value.trim().toLocaleLowerCase();
  const filtered = menu.filter((item) => {
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    return matchesCategory && item.name.toLocaleLowerCase().includes(query);
  });
  elements.menuCount.textContent = `${menu.length} menu ${menu.length === 1 ? "item" : "items"}`;
  elements.products.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "no-products";
    empty.textContent = "No menu items found. Try a different search or category.";
    elements.products.append(empty);
    return;
  }

  filtered.forEach((item) => {
    const card = document.createElement("article");
    card.className = "product-card";
    card.dataset.productId = item.id;
    const selectButton = document.createElement("button");
    selectButton.type = "button";
    selectButton.className = "product-select";
    selectButton.setAttribute("aria-label", `Add ${item.name}, ${rupees.format(item.price)}`);
    const category = document.createElement("span");
    category.className = "product-category";
    category.textContent = item.category;
    category.style.setProperty("--category-bg", categoryColors[item.category] || categoryColors.Other);
    const name = document.createElement("span");
    name.className = "product-name";
    name.textContent = item.name;
    const price = document.createElement("span");
    price.className = "product-price";
    price.textContent = rupees.format(item.price);
    const add = document.createElement("span");
    add.className = "product-add";
    add.textContent = "+";
    selectButton.append(category, name, price, add);
    selectButton.addEventListener("click", () => addToCart(item.id));
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "product-edit";
    editButton.setAttribute("aria-label", `Edit ${item.name}`);
    editButton.title = `Edit ${item.name}`;
    editButton.textContent = "✎";
    editButton.addEventListener("click", () => openEditMenuItem(item.id));
    card.append(selectButton, editButton);
    elements.products.append(card);
  });
}

function openAddMenuItem() {
  elements.menuForm.reset();
  elements.menuForm.elements.namedItem("id").value = "";
  elements.menuModalTitle.textContent = "Add a menu item";
  elements.menuSubmitText.textContent = "Add to menu";
  elements.menuModal.showModal();
}

function openEditMenuItem(id) {
  const item = menu.find((entry) => entry.id === id);
  if (!item) {
    showToast("That menu item could not be found.");
    return;
  }
  const form = elements.menuForm.elements;
  form.namedItem("id").value = item.id;
  form.namedItem("name").value = item.name;
  form.namedItem("price").value = String(item.price);
  form.namedItem("category").value = item.category;
  elements.menuModalTitle.textContent = "Edit menu item";
  elements.menuSubmitText.textContent = "Save changes";
  elements.menuModal.showModal();
}

function addToCart(id) {
  cart.set(id, (cart.get(id) || 0) + 1);
  renderCart();
}

function changeQuantity(id, amount) {
  const next = (cart.get(id) || 0) + amount;
  if (next <= 0) cart.delete(id);
  else cart.set(id, next);
  renderCart();
}

function calculateTotals() {
  const subtotal = [...cart.entries()].reduce((total, [id, quantity]) => {
    const item = menu.find((entry) => entry.id === id);
    return total + (item ? item.price * quantity : 0);
  }, 0);
  const requestedDiscount = Number(elements.discount.value);
  const discount = Number.isFinite(requestedDiscount) ? Math.min(Math.max(0, requestedDiscount), subtotal) : 0;
  const taxableAmount = subtotal - discount;
  const taxRate = Number(elements.taxRate.value) || 0;
  const tax = taxableAmount * taxRate / 100;
  return { subtotal, discount, taxRate, tax, total: taxableAmount + tax };
}

function renderCart() {
  elements.cartItems.innerHTML = "";
  elements.emptyCart.hidden = cart.size > 0;
  elements.checkout.disabled = cart.size === 0;
  cart.forEach((quantity, id) => {
    const item = menu.find((entry) => entry.id === id);
    if (!item) {
      cart.delete(id);
      return;
    }
    const line = document.createElement("div");
    line.className = "cart-line";

    const details = document.createElement("div");
    const title = document.createElement("div");
    title.className = "cart-item-title";
    title.textContent = item.name;
    const unit = document.createElement("div");
    unit.className = "cart-item-unit";
    unit.textContent = `${rupees.format(item.price)} each`;
    details.append(title, unit);

    const controls = document.createElement("div");
    controls.className = "quantity-control";
    const decrease = document.createElement("button");
    decrease.type = "button";
    decrease.textContent = "−";
    decrease.setAttribute("aria-label", `Remove one ${item.name}`);
    decrease.addEventListener("click", () => changeQuantity(id, -1));
    const count = document.createElement("span");
    count.textContent = String(quantity);
    const increase = document.createElement("button");
    increase.type = "button";
    increase.textContent = "+";
    increase.setAttribute("aria-label", `Add one ${item.name}`);
    increase.addEventListener("click", () => changeQuantity(id, 1));
    controls.append(decrease, count, increase);

    const total = document.createElement("div");
    total.className = "line-total";
    total.textContent = rupees.format(item.price * quantity);
    line.append(details, controls, total);
    elements.cartItems.append(line);
  });

  const totals = calculateTotals();
  elements.subtotal.textContent = rupees.format(totals.subtotal);
  elements.taxAmount.textContent = rupees.format(totals.tax);
  elements.grandTotal.textContent = rupees.format(totals.total);
  elements.products.querySelectorAll(".product-card").forEach((card) => {
    const quantity = cart.get(card.dataset.productId) || 0;
    const addButton = card.querySelector(".product-add");
    const selectButton = card.querySelector(".product-select");
    addButton.textContent = quantity ? String(quantity) : "+";
    addButton.classList.toggle("has-items", quantity > 0);
    card.classList.toggle("in-cart", quantity > 0);
    const item = menu.find((entry) => entry.id === card.dataset.productId);
    if (item) {
      selectButton.setAttribute("aria-label", quantity
        ? `Add another ${item.name}, ${rupees.format(item.price)}. ${quantity} in bill`
        : `Add ${item.name}, ${rupees.format(item.price)}`);
    }
  });
  renderMobileBillDock(totals.total);
}

function renderMobileBillDock(total) {
  const itemCount = [...cart.values()].reduce((sum, quantity) => sum + quantity, 0);
  elements.mobileBillCount.textContent = `${itemCount} ${itemCount === 1 ? "item" : "items"} in bill`;
  elements.mobileBillTotal.textContent = rupees.format(total);
  elements.mobileBillDock.hidden = activePage !== "billing" || cart.size === 0;
}

function getTodayOrders() {
  const today = new Date().toLocaleDateString("en-CA");
  return orders.filter((order) => new Date(order.createdAt).toLocaleDateString("en-CA") === today);
}

function renderTodaySales() {
  const sales = getTodayOrders().reduce((sum, order) => sum + order.total, 0);
  elements.todaySales.textContent = rupees.format(sales);
}

function renderKitchenOrders() {
  const activeOrders = orders.filter((order) => order.status === "Preparing" || order.status === "Ready");
  const visibleOrders = kitchenView === "completed"
    ? orders.filter((order) => order.status === "Completed")
    : activeOrders;
  elements.activeOrderCount.textContent = String(activeOrders.length);
  document.querySelectorAll(".kitchen-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.kitchenView === kitchenView);
  });
  elements.kitchenOrders.replaceChildren();

  if (!visibleOrders.length) {
    const empty = document.createElement("div");
    empty.className = "kitchen-empty";
    empty.textContent = kitchenView === "completed"
      ? "Completed orders will appear here."
      : "No active kitchen orders. New bills will appear here.";
    elements.kitchenOrders.append(empty);
    return;
  }

  visibleOrders.forEach((order) => {
    const ticket = document.createElement("article");
    ticket.className = "kitchen-ticket";

    const header = document.createElement("div");
    header.className = "kitchen-ticket-header";
    const identity = document.createElement("div");
    const id = document.createElement("div");
    id.className = "kitchen-ticket-id";
    id.textContent = order.id;
    const time = document.createElement("div");
    time.className = "kitchen-ticket-time";
    time.textContent = new Date(order.createdAt).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
    identity.append(id, time);
    const status = document.createElement("span");
    status.className = `kitchen-status ${order.status.toLocaleLowerCase()}`;
    status.textContent = order.status;
    header.append(identity, status);

    const meta = document.createElement("div");
    meta.className = "kitchen-ticket-meta";
    const orderType = document.createElement("span");
    orderType.textContent = order.orderType;
    const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const count = document.createElement("span");
    count.textContent = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
    meta.append(orderType, count);

    const customer = document.createElement("p");
    customer.className = "kitchen-ticket-customer";
    customer.textContent = order.customer ? `Customer: ${order.customer}` : "Walk-in customer";

    const items = document.createElement("ul");
    items.className = "kitchen-ticket-items";
    order.items.forEach((item) => {
      const line = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = item.name;
      const quantity = document.createElement("span");
      quantity.textContent = `× ${item.quantity}`;
      line.append(name, quantity);
      items.append(line);
    });

    ticket.append(header, meta, customer, items);
    const actions = document.createElement("div");
    actions.className = "kitchen-ticket-actions";
    const print = document.createElement("button");
    print.type = "button";
    print.className = "kitchen-ticket-print";
    print.textContent = "Print ticket";
    print.addEventListener("click", () => printKitchenTicket(order));
    actions.append(print);
    if (order.status !== "Completed") {
      const action = document.createElement("button");
      action.type = "button";
      action.className = "kitchen-ticket-action";
      action.textContent = order.status === "Preparing" ? "Mark ready" : "Complete order";
      action.addEventListener("click", () => {
        updateKitchenOrder(order.id, order.status === "Preparing" ? "Ready" : "Completed");
      });
      actions.append(action);
    }
    ticket.append(actions);
    elements.kitchenOrders.append(ticket);
  });
}

function createKitchenTicket(order) {
  const ticket = document.createElement("div");
  ticket.className = "kitchen-print-receipt";
  const shop = document.createElement("div");
  shop.className = "kitchen-print-shop";
  shop.textContent = settings.shopName;
  const heading = document.createElement("div");
  heading.className = "kitchen-print-heading";
  heading.textContent = "KITCHEN ORDER";
  const details = document.createElement("div");
  details.className = "kitchen-print-details";
  details.textContent = `${order.id} · ${new Date(order.createdAt).toLocaleString("en-IN")}`;
  const type = document.createElement("div");
  type.className = "kitchen-print-details";
  type.textContent = `${order.orderType}${order.customer ? ` · ${order.customer}` : ""}`;
  const divider = document.createElement("div");
  divider.className = "kitchen-print-divider";
  const items = document.createElement("ul");
  items.className = "kitchen-print-items";
  order.items.forEach((item) => {
    const line = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = item.name;
    const quantity = document.createElement("strong");
    quantity.textContent = `× ${item.quantity}`;
    line.append(name, quantity);
    items.append(line);
  });
  ticket.append(shop, heading, details, type, divider, items);
  elements.kitchenPrintTicket.replaceChildren(ticket);
}

function printKitchenTicket(order) {
  createKitchenTicket(order);
  document.body.classList.add("printing-kitchen-ticket");
  window.print();
}

window.addEventListener("afterprint", () => {
  document.body.classList.remove("printing-kitchen-ticket", "printing-order-packet");
  elements.kitchenPrintTicket.replaceChildren();
});

function updateKitchenOrder(orderId, status) {
  const order = orders.find((entry) => entry.id === orderId);
  if (!order || !["Ready", "Completed"].includes(status)) return;
  const previousStatus = order.status;
  const previousCompletedAt = order.completedAt;
  order.status = status;
  if (status === "Completed") order.completedAt = new Date().toISOString();
  if (!persist(STORAGE_KEYS.orders, orders)) {
    order.status = previousStatus;
    if (previousCompletedAt === undefined) delete order.completedAt;
    else order.completedAt = previousCompletedAt;
    renderKitchenOrders();
    return;
  }
  renderKitchenOrders();
  showToast(status === "Ready" ? `${order.id} is ready for handoff.` : `${order.id} completed.`);
}

function normalizedName(name) {
  return String(name || "").trim().toLocaleLowerCase();
}

function upsertCustomer(name, phone = "") {
  const cleanName = String(name || "").trim();
  if (!cleanName) return null;
  const existing = customers.find((customer) => normalizedName(customer.name) === normalizedName(cleanName));
  if (existing) {
    if (phone) existing.phone = phone;
    return existing;
  }
  const customer = { id: `customer-${Date.now()}`, name: cleanName, phone: String(phone || "").trim(), createdAt: new Date().toISOString() };
  customers.unshift(customer);
  return customer;
}

function renderCustomerSuggestions() {
  elements.customerOptions.replaceChildren();
  customers.forEach((customer) => {
    const option = document.createElement("option");
    option.value = customer.name;
    elements.customerOptions.append(option);
  });
}

function createStatCard(label, value, note) {
  const card = document.createElement("div");
  card.className = "stat-card";
  const title = document.createElement("span");
  title.className = "stat-label";
  title.textContent = label;
  const main = document.createElement("strong");
  main.className = "stat-value";
  main.textContent = value;
  const detail = document.createElement("small");
  detail.textContent = note;
  card.append(title, main, detail);
  return card;
}

function renderCustomers() {
  const customerMap = new Map();
  customers.forEach((customer) => customerMap.set(normalizedName(customer.name), { ...customer, bills: [], totalSpent: 0 }));
  orders.forEach((order) => {
    const key = normalizedName(order.customer);
    if (!key) return;
    if (!customerMap.has(key)) {
      customerMap.set(key, { id: key, name: order.customer.trim(), phone: "", bills: [], totalSpent: 0 });
    }
    const customer = customerMap.get(key);
    customer.bills.push(order);
    customer.totalSpent += order.total;
  });

  const allCustomers = [...customerMap.values()].sort((first, second) => first.name.localeCompare(second.name));
  const query = elements.customerSearch.value.trim().toLocaleLowerCase();
  const visibleCustomers = allCustomers.filter((customer) => (
    customer.name.toLocaleLowerCase().includes(query) || String(customer.phone || "").toLocaleLowerCase().includes(query)
  ));
  const repeatCustomers = allCustomers.filter((customer) => customer.bills.length > 1).length;
  const totalSpent = allCustomers.reduce((sum, customer) => sum + customer.totalSpent, 0);

  elements.customerStats.replaceChildren(
    createStatCard("Customers", String(allCustomers.length), "Saved customer profiles"),
    createStatCard("Returning customers", String(repeatCustomers), "More than one completed bill"),
    createStatCard("Customer sales", rupees.format(totalSpent), "From bills with a customer name"),
  );
  elements.customerTable.replaceChildren();
  elements.customerEmpty.hidden = visibleCustomers.length > 0;
  elements.customerTable.closest(".table-wrap").classList.toggle("no-results", visibleCustomers.length === 0);

  visibleCustomers.forEach((customer) => {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.className = "customer-name-cell";
    nameCell.textContent = customer.name;
    const phoneCell = document.createElement("td");
    phoneCell.textContent = customer.phone || "—";
    const billsCell = document.createElement("td");
    billsCell.textContent = String(customer.bills.length);
    const spentCell = document.createElement("td");
    spentCell.className = "money-cell";
    spentCell.textContent = rupees.format(customer.totalSpent);
    const visitCell = document.createElement("td");
    const latestBill = customer.bills.reduce((latest, order) => (
      !latest || new Date(order.createdAt) > new Date(latest.createdAt) ? order : latest
    ), null);
    visitCell.textContent = latestBill
      ? new Date(latestBill.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "No bills yet";
    row.append(nameCell, phoneCell, billsCell, spentCell, visitCell);
    elements.customerTable.append(row);
  });
  renderCustomerSuggestions();
}

function getOrdersForReport(period) {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (period === "7days") start.setDate(start.getDate() - 6);
  else if (period === "month") start.setDate(1);
  else if (period === "all") return orders;
  return orders.filter((order) => new Date(order.createdAt) >= start);
}

function renderReports() {
  const period = elements.reportPeriod.value;
  const reportOrders = getOrdersForReport(period);
  const sales = reportOrders.reduce((sum, order) => sum + order.total, 0);
  const average = reportOrders.length ? sales / reportOrders.length : 0;
  elements.reportStats.replaceChildren(
    createStatCard("Total sales", rupees.format(sales), "For the selected period"),
    createStatCard("Bills completed", String(reportOrders.length), "Completed orders"),
    createStatCard("Average bill", rupees.format(average), "Sales divided by bills"),
  );

  const endDate = new Date();
  const startDate = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  startDate.setDate(startDate.getDate() - 6);
  const chartStart = period === "today"
    ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate())
    : period === "month"
      ? new Date(endDate.getFullYear(), endDate.getMonth(), Math.max(1, endDate.getDate() - 6))
      : period === "all" && reportOrders.length
        ? new Date(Math.max(startDate.getTime(), new Date(reportOrders[reportOrders.length - 1].createdAt).getTime()))
        : startDate;
  const dayCount = period === "today" ? 1 : 7;
  const chartDays = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(chartStart);
    date.setDate(chartStart.getDate() + index);
    return date;
  }).filter((date) => date <= endDate);
  const chartTotals = new Map();
  reportOrders.forEach((order) => {
    const date = new Date(order.createdAt);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    chartTotals.set(key, (chartTotals.get(key) || 0) + order.total);
  });
  const dailyAmounts = chartDays.map((date) => chartTotals.get(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`) || 0);
  const maxDailySales = Math.max(...dailyAmounts, 1);
  elements.salesChartCaption.textContent = period === "today"
    ? "Sales for today"
    : "Daily totals for the latest 7 days in this period";
  elements.salesChart.replaceChildren();
  if (!reportOrders.length) {
    const empty = document.createElement("div");
    empty.className = "report-empty";
    empty.textContent = "No completed bills for this period yet.";
    elements.salesChart.append(empty);
  } else {
    chartDays.forEach((date, index) => {
      const amount = dailyAmounts[index];
      const barRow = document.createElement("div");
      barRow.className = "sales-bar-row";
      const label = document.createElement("span");
      label.className = "sales-bar-label";
      label.textContent = date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
      const track = document.createElement("div");
      track.className = "sales-bar-track";
      const bar = document.createElement("div");
      bar.className = "sales-bar";
      bar.style.width = `${amount ? Math.max(4, amount / maxDailySales * 100) : 0}%`;
      track.append(bar);
      const value = document.createElement("strong");
      value.className = "sales-bar-value";
      value.textContent = rupees.format(amount);
      barRow.append(label, track, value);
      elements.salesChart.append(barRow);
    });
  }

  const payments = new Map();
  reportOrders.forEach((order) => payments.set(order.paymentMethod, (payments.get(order.paymentMethod) || 0) + order.total));
  elements.paymentBreakdown.replaceChildren();
  if (!reportOrders.length) {
    const empty = document.createElement("div");
    empty.className = "report-empty";
    empty.textContent = "Payment totals will appear after your first bill.";
    elements.paymentBreakdown.append(empty);
  } else {
    [...payments.entries()].sort((first, second) => second[1] - first[1]).forEach(([method, amount]) => {
      const row = document.createElement("div");
      row.className = "payment-report-row";
      const methodName = document.createElement("span");
      methodName.textContent = method;
      const bar = document.createElement("div");
      bar.className = "payment-report-track";
      const fill = document.createElement("span");
      fill.style.width = `${sales ? amount / sales * 100 : 0}%`;
      bar.append(fill);
      const value = document.createElement("strong");
      value.textContent = rupees.format(amount);
      row.append(methodName, bar, value);
      elements.paymentBreakdown.append(row);
    });
  }
}

function createReceipt(order) {
  const receipt = document.createElement("div");
  const shopDetails = [];
  if (settings.address) {
    shopDetails.push(`<div class="receipt-muted">${settings.address.split(/\r?\n/).map(escapeHtml).join("<br>")}</div>`);
  }
  const contactDetails = [settings.phone, settings.email].filter(Boolean).map(escapeHtml).join(" · ");
  if (contactDetails) shopDetails.push(`<div class="receipt-muted">${contactDetails}</div>`);
  if (settings.gstin) shopDetails.push(`<div class="receipt-muted">GSTIN: ${escapeHtml(settings.gstin)}</div>`);
  if (settings.fssai) shopDetails.push(`<div class="receipt-muted">FSSAI: ${escapeHtml(settings.fssai)}</div>`);
  const receiptFooter = String(settings.receiptFooter || "").trim() || "Thank you for visiting!";
  receipt.innerHTML = `
    <div class="receipt-center">
      <div class="receipt-brand">${escapeHtml(settings.shopName)}</div>
      <div class="receipt-muted">CAFE</div>
      ${shopDetails.join("")}
    </div>
    <div class="receipt-rule"></div>
    <div class="receipt-line"><span>Bill</span><span>${escapeHtml(order.id)}</span></div>
    <div class="receipt-line"><span>Date</span><span>${escapeHtml(new Date(order.createdAt).toLocaleString("en-IN"))}</span></div>
    ${order.customer ? `<div class="receipt-line"><span>Customer</span><span>${escapeHtml(order.customer)}</span></div>` : ""}
    <div class="receipt-line"><span>Order type</span><span>${escapeHtml(order.orderType)}</span></div>
    <div class="receipt-line"><span>Payment</span><span>${escapeHtml(order.paymentMethod)}</span></div>
    <div class="receipt-rule"></div>
    <div class="receipt-items">${order.items.map((item) => `<div class="receipt-item"><div class="receipt-item-name"><span>${escapeHtml(item.name)}</span><span>${rupees.format(item.price * item.quantity)}</span></div><div class="receipt-item-detail">${item.quantity} × ${rupees.format(item.price)}</div></div>`).join("")}</div>
    <div class="receipt-rule"></div>
    <div class="receipt-line"><span>Subtotal</span><span>${rupees.format(order.subtotal)}</span></div>
    ${order.discount ? `<div class="receipt-line"><span>Discount</span><span>−${rupees.format(order.discount)}</span></div>` : ""}
    <div class="receipt-line"><span>GST (${order.taxRate}%)</span><span>${rupees.format(order.tax)}</span></div>
    <div class="receipt-rule"></div>
    <div class="receipt-line receipt-total"><span>TOTAL</span><span>${rupees.format(order.total)}</span></div>
    <div class="receipt-center receipt-thanks">${escapeHtml(receiptFooter)}</div>
    <div class="receipt-developer-credit">Developed by Shariff Tech</div>`;
  elements.receipt.replaceChildren(receipt);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function checkout() {
  if (!cart.size) return;
  const totals = calculateTotals();
  const order = {
    id: `LB-${Date.now().toString().slice(-8)}`,
    createdAt: new Date().toISOString(),
    customer: elements.customer.value.trim(),
    customerPhone: elements.customerPhone.value.trim(),
    orderType,
    paymentMethod,
    status: "Preparing",
    items: [...cart.entries()].map(([id, quantity]) => {
      const item = menu.find((entry) => entry.id === id);
      return { id, name: item.name, price: item.price, quantity };
    }),
    ...totals,
  };
  orders.unshift(order);
  if (!persist(STORAGE_KEYS.orders, orders)) {
    orders.shift();
    return;
  }
  if (order.customer) {
    upsertCustomer(order.customer, order.customerPhone);
    persist(STORAGE_KEYS.customers, customers);
    renderCustomers();
  }
  renderTodaySales();
  renderKitchenOrders();
  const whatsappOpened = sendBillOnWhatsApp(order, false);
  createReceipt(order);
  createKitchenTicket(order);
  document.body.classList.add("printing-order-packet");
  window.print();
  cart.clear();
  elements.customer.value = "";
  elements.customerPhone.value = "";
  elements.discount.value = "0";
  elements.taxRate.value = String(settings.defaultTaxRate);
  renderCart();
  showToast(whatsappOpened
    ? `Customer receipt and kitchen ticket printed. Send the bill in WhatsApp.`
    : `Customer receipt and kitchen ticket printed. Add a WhatsApp number to send the bill.`);
}

function normalizeWhatsAppNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
}

function sendBillOnWhatsApp(order, showFeedback = true) {
  const customer = customers.find((entry) => normalizedName(entry.name) === normalizedName(order.customer));
  const phone = normalizeWhatsAppNumber(order.customerPhone || (customer && customer.phone));
  if (!phone) {
    if (showFeedback) showToast("Add a valid WhatsApp number before sending this bill.");
    return false;
  }
  const message = [
    `*${settings.shopName}*`,
    `Bill: ${order.id}`,
    `Date: ${new Date(order.createdAt).toLocaleString("en-IN")}`,
    order.customer ? `Customer: ${order.customer}` : null,
    "",
    "*Items*",
    ...order.items.map((item) => `${item.name} × ${item.quantity} - ${rupees.format(item.price * item.quantity)}`),
    "",
    `Subtotal: ${rupees.format(order.subtotal)}`,
    order.discount ? `Discount: -${rupees.format(order.discount)}` : null,
    `GST (${order.taxRate}%): ${rupees.format(order.tax)}`,
    `*Total: ${rupees.format(order.total)}*`,
    `Payment: ${order.paymentMethod}`,
    "",
    "Thank you for visiting!",
    "Developed by Shariff Tech",
  ].filter((line) => line !== null).join("\n");
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
  if (showFeedback) showToast("WhatsApp opened. Review the bill and tap Send.");
  return true;
}

function markWhatsAppBillSent(order) {
  if (order.whatsappSentAt) return;
  order.whatsappSentAt = new Date().toISOString();
  if (!persist(STORAGE_KEYS.orders, orders)) {
    delete order.whatsappSentAt;
    return;
  }
  renderHistory();
  showToast(`Bill ${order.id} marked as sent on WhatsApp.`);
}

function renderHistory() {
  elements.historyList.innerHTML = "";
  if (!orders.length) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Your completed bills will appear here.";
    elements.historyList.append(empty);
    return;
  }
  orders.forEach((order) => {
    const row = document.createElement("div");
    row.className = "history-entry";
    const details = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = `${order.id}${order.customer ? ` · ${order.customer}` : ""}`;
    const date = document.createElement("small");
    date.textContent = `${new Date(order.createdAt).toLocaleString("en-IN")} · ${order.items.reduce((sum, item) => sum + item.quantity, 0)} items · ${order.paymentMethod}`;
    details.append(heading, date);
    const right = document.createElement("div");
    right.className = "history-entry-right";
    const amount = document.createElement("b");
    amount.textContent = rupees.format(order.total);
    const print = document.createElement("button");
    print.type = "button";
    print.className = "history-print";
    print.textContent = "Print";
    print.addEventListener("click", () => {
      createReceipt(order);
      window.print();
    });
    const whatsapp = document.createElement("button");
    whatsapp.type = "button";
    whatsapp.className = "history-whatsapp";
    whatsapp.textContent = "WhatsApp";
    whatsapp.title = "Open WhatsApp with this bill";
    whatsapp.setAttribute("aria-label", `Send bill ${order.id} on WhatsApp`);
    whatsapp.addEventListener("click", () => sendBillOnWhatsApp(order));
    const sent = document.createElement("button");
    sent.type = "button";
    sent.className = "history-whatsapp-sent";
    sent.textContent = order.whatsappSentAt ? "WhatsApp sent ✓" : "Mark sent";
    sent.disabled = Boolean(order.whatsappSentAt);
    sent.setAttribute("aria-label", order.whatsappSentAt
      ? `Bill ${order.id} sent on WhatsApp`
      : `Mark bill ${order.id} as sent on WhatsApp`);
    sent.addEventListener("click", () => markWhatsAppBillSent(order));
    right.append(amount, print, whatsapp, sent);
    row.append(details, right);
    elements.historyList.append(row);
  });
}

elements.search.addEventListener("input", renderProducts);
elements.discount.addEventListener("input", renderCart);
elements.taxRate.addEventListener("change", renderCart);
elements.checkout.addEventListener("click", checkout);
document.getElementById("clear-cart").addEventListener("click", () => {
  if (!cart.size) return;
  if (!window.confirm("Remove all items from this bill?")) return;
  cart.clear();
  elements.discount.value = "0";
  renderCart();
});

document.querySelectorAll(".type-button").forEach((button) => {
  button.addEventListener("click", () => {
    orderType = button.dataset.type;
    document.querySelectorAll(".type-button").forEach((candidate) => candidate.classList.toggle("selected", candidate === button));
  });
});
document.querySelectorAll(".payment-button").forEach((button) => {
  button.addEventListener("click", () => {
    paymentMethod = button.dataset.payment;
    document.querySelectorAll(".payment-button").forEach((candidate) => candidate.classList.toggle("selected", candidate === button));
  });
});

document.getElementById("open-menu-modal").addEventListener("click", openAddMenuItem);
document.querySelector(".modal-close").addEventListener("click", () => elements.menuModal.close());
document.querySelector(".modal-cancel").addEventListener("click", () => elements.menuModal.close());
elements.menuForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(elements.menuForm);
  const id = String(formData.get("id") || "");
  const name = String(formData.get("name")).trim();
  const price = Number(formData.get("price"));
  const category = String(formData.get("category"));
  if (!name || !Number.isFinite(price) || price <= 0) {
    showToast("Enter an item name and a valid price.");
    return;
  }
  if (id && !menu.some((item) => item.id === id)) {
    showToast("That menu item could not be found.");
    elements.menuModal.close();
    return;
  }
  const updatedItem = { id: id || `item-${Date.now()}`, name, category, price };
  const nextMenu = id
    ? menu.map((item) => item.id === id ? updatedItem : item)
    : [...menu, updatedItem];
  if (!persist(STORAGE_KEYS.menu, nextMenu)) return;
  menu = nextMenu;
  activeCategory = category;
  elements.search.value = "";
  renderCategories();
  renderProducts();
  renderCart();
  elements.menuForm.reset();
  elements.menuModal.close();
  showToast(id ? `${name} updated.` : `${name} added to your menu.`);
});

document.getElementById("history-nav").addEventListener("click", () => {
  renderHistory();
  elements.historyModal.showModal();
});
document.querySelector(".history-close").addEventListener("click", () => elements.historyModal.close());
elements.historyModal.addEventListener("click", (event) => {
  if (event.target === elements.historyModal) elements.historyModal.close();
});

function setActivePage(page) {
  activePage = page;
  const pages = {
    billing: document.getElementById("billing-page"),
    kitchen: document.getElementById("kitchen-page"),
    customers: document.getElementById("customers-page"),
    reports: document.getElementById("reports-page"),
    settings: document.getElementById("settings-page"),
  };
  Object.entries(pages).forEach(([name, element]) => {
    element.hidden = name !== page;
  });
  document.querySelectorAll(".nav-link[data-page]").forEach((button) => {
    const active = button.dataset.page === page;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  document.getElementById("breadcrumb-current").textContent = {
    billing: "New bill",
    kitchen: "Kitchen orders",
    customers: "Customers",
    reports: "Reports",
    settings: "Shop settings",
  }[page];
  if (page === "customers") renderCustomers();
  if (page === "reports") renderReports();
  if (page === "kitchen") renderKitchenOrders();
  renderMobileBillDock(calculateTotals().total);
}

document.querySelectorAll(".nav-link[data-page]").forEach((button) => {
  button.addEventListener("click", () => setActivePage(button.dataset.page));
});
document.querySelectorAll(".kitchen-tab").forEach((button) => {
  button.addEventListener("click", () => {
    kitchenView = button.dataset.kitchenView;
    renderKitchenOrders();
  });
});
elements.mobileBillDock.addEventListener("click", () => {
  elements.orderPanel.scrollIntoView({ behavior: "smooth", block: "start" });
});
elements.customer.addEventListener("change", () => {
  const customer = customers.find((entry) => normalizedName(entry.name) === normalizedName(elements.customer.value));
  if (customer && customer.phone) elements.customerPhone.value = customer.phone;
});
elements.customerSearch.addEventListener("input", renderCustomers);
elements.reportPeriod.addEventListener("change", renderReports);
document.getElementById("open-customer-modal").addEventListener("click", () => elements.customerModal.showModal());
document.querySelector(".customer-close").addEventListener("click", () => elements.customerModal.close());
document.querySelector(".customer-cancel").addEventListener("click", () => elements.customerModal.close());
elements.customerForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(elements.customerForm);
  const name = String(formData.get("name")).trim();
  const phone = String(formData.get("phone")).trim();
  if (!name) {
    showToast("Enter a customer name.");
    return;
  }
  const existed = customers.some((customer) => normalizedName(customer.name) === normalizedName(name));
  upsertCustomer(name, phone);
  persist(STORAGE_KEYS.customers, customers);
  renderCustomers();
  elements.customerForm.reset();
  elements.customerModal.close();
  showToast(existed ? "Customer details updated." : "Customer added.");
});
elements.customerModal.addEventListener("click", (event) => {
  if (event.target === elements.customerModal) elements.customerModal.close();
});
elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(elements.settingsForm);
  const nextSettings = {
    shopName: String(formData.get("shopName")).trim(),
    address: String(formData.get("address")).trim(),
    phone: String(formData.get("phone")).trim(),
    email: String(formData.get("email")).trim(),
    gstin: String(formData.get("gstin")).trim(),
    fssai: String(formData.get("fssai")).trim(),
    defaultTaxRate: Number(formData.get("defaultTaxRate")),
    receiptFooter: String(formData.get("receiptFooter")).trim(),
  };
  if (!nextSettings.shopName || ![0, 5, 12, 18].includes(nextSettings.defaultTaxRate)) {
    showToast("Enter a shop name and choose a valid GST rate.");
    return;
  }
  if (!persist(STORAGE_KEYS.settings, nextSettings)) return;
  settings = nextSettings;
  applyShopSettings();
  renderCart();
  showToast("Shop settings saved.");
});
elements.downloadBackup.addEventListener("click", () => {
  try {
    const contents = JSON.stringify(createBackup(), null, 2);
    const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `lazzat-cafe-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("Backup downloaded.");
  } catch (error) {
    console.error("Unable to download the cafe backup.", error);
    showToast("Backup download failed. Please try again.");
  }
});
elements.restoreBackup.addEventListener("click", () => elements.backupFile.click());
elements.backupFile.addEventListener("change", async () => {
  const file = elements.backupFile.files[0];
  if (!file) return;
  try {
    const backup = JSON.parse(await file.text());
    const data = validateBackup(backup);
    if (!window.confirm("Restore this backup? It will replace the menu, bills, customers, and settings saved on this device.")) return;
    restoreBackupData(data);
    showToast("Cafe data restored from backup.");
  } catch (error) {
    console.error("Unable to restore the selected cafe backup.", error);
    showToast(error instanceof Error ? `Restore failed: ${error.message}` : "Restore failed. Check the backup file and try again.");
  } finally {
    elements.backupFile.value = "";
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    elements.search.focus();
  }
});

document.getElementById("today-date").textContent = new Intl.DateTimeFormat("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
}).format(new Date());
applyShopSettings();
renderCategories();
renderProducts();
renderCart();
renderTodaySales();
renderCustomers();
renderReports();
renderKitchenOrders();
