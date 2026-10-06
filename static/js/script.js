/**
 * TaskFlow - script.js
 * =====================
 * All frontend logic for the TaskFlow app.
 *
 * Sections:
 *  1. DOM element references
 *  2. Application state
 *  3. API helper functions
 *  4. Rendering functions
 *  5. Form handling (create / edit)
 *  6. Task actions (toggle, edit, delete)
 *  7. Filtering
 *  8. Dashboard stats
 *  9. Toast notification helper
 * 10. Modal helper
 * 11. Initialisation
 */

// ══════════════════════════════════════════════
//  1. DOM ELEMENT REFERENCES
// ══════════════════════════════════════════════

// Dashboard counters
const totalCountEl     = document.getElementById("total-count");
const pendingCountEl   = document.getElementById("pending-count");
const completedCountEl = document.getElementById("completed-count");
const highCountEl      = document.getElementById("high-count");

// Form elements
const taskForm        = document.getElementById("task-form");
const formTitle       = document.getElementById("form-title");
const formSubmitBtn   = document.getElementById("form-submit-btn");
const cancelEditBtn   = document.getElementById("cancel-edit-btn");
const editTaskIdInput = document.getElementById("edit-task-id");
const titleInput      = document.getElementById("task-title");
const descInput       = document.getElementById("task-description");
const prioritySelect  = document.getElementById("task-priority");
const dueDateInput    = document.getElementById("task-due-date");
const titleError      = document.getElementById("title-error");

// Task list area
const taskList       = document.getElementById("task-list");
const emptyState     = document.getElementById("empty-state");
const emptyMessage   = document.getElementById("empty-message");
const loadingSpinner = document.getElementById("loading-spinner");

// Filter buttons
const filterButtons  = document.querySelectorAll(".filter-btn");

// Modal elements
const deleteModal     = document.getElementById("delete-modal");
const confirmDeleteBtn = document.getElementById("confirm-delete-btn");
const cancelDeleteBtn  = document.getElementById("cancel-delete-btn");

// Toast
const toastEl = document.getElementById("toast");


// ══════════════════════════════════════════════
//  2. APPLICATION STATE
// ══════════════════════════════════════════════

// Tracks which filter is currently active
let currentFilter = "all";

// Stores the ID of the task pending deletion (used by the modal)
let taskIdToDelete = null;

// Toast timeout reference so we can clear it
let toastTimeout = null;


// ══════════════════════════════════════════════
//  3. API HELPER FUNCTIONS
// ══════════════════════════════════════════════

/**
 * Generic fetch wrapper. Returns parsed JSON or throws an error.
 * @param {string} url - API endpoint
 * @param {RequestInit} options - fetch options (method, body, headers)
 */
async function apiFetch(url, options = {}) {
  // Always send JSON content-type for requests that have a body
  if (options.body) {
    options.headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };
  }

  const response = await fetch(url, options);
  const data = await response.json();

  // If the server returned an error status, throw so callers can catch it
  if (!response.ok) {
    throw new Error(data.error || `HTTP error ${response.status}`);
  }

  return data;
}

// Convenience wrappers for each HTTP method
const api = {
  get:   (url)          => apiFetch(url),
  post:  (url, body)    => apiFetch(url, { method: "POST",   body: JSON.stringify(body) }),
  put:   (url, body)    => apiFetch(url, { method: "PUT",    body: JSON.stringify(body) }),
  patch: (url)          => apiFetch(url, { method: "PATCH" }),
  del:   (url)          => apiFetch(url, { method: "DELETE" }),
};


// ══════════════════════════════════════════════
//  4. RENDERING FUNCTIONS
// ══════════════════════════════════════════════

/**
 * Formats a due date string (YYYY-MM-DD) into a human-readable form.
 * Also flags overdue tasks.
 * @param {string} dateStr - date string from the database
 * @returns {{ text: string, isOverdue: boolean }}
 */
function formatDueDate(dateStr) {
  if (!dateStr) return { text: "", isOverdue: false };

  const today    = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDate  = new Date(dateStr + "T00:00:00"); // force local timezone
  const isOverdue = dueDate < today;

  // Pretty-print the date
  const text = dueDate.toLocaleDateString("en-US", {
    month: "short",
    day:   "numeric",
    year:  "numeric",
  });

  return { text, isOverdue };
}

/**
 * Builds the HTML string for a single task card.
 * @param {Object} task - task object from the API
 * @returns {string} HTML string
 */
function buildTaskCard(task) {
  const { text: dueDateText, isOverdue } = formatDueDate(task.due_date);

  // Determine the badge class for the priority
  const priorityBadgeClass = `badge badge-${task.priority}`;
  const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

  // Build the due date badge HTML (only if there is a due date)
  let dueBadgeHtml = "";
  if (dueDateText) {
    const badgeClass = isOverdue && !task.completed ? "badge badge-overdue" : "badge badge-due";
    const prefix     = isOverdue && !task.completed ? "⚠️ Overdue: " : "📅 ";
    dueBadgeHtml = `<span class="${badgeClass}">${prefix}${dueDateText}</span>`;
  }

  // Completion status badge
  const statusBadgeHtml = task.completed
    ? `<span class="badge badge-done">✓ Done</span>`
    : `<span class="badge badge-pending">Pending</span>`;

  // Description paragraph (hidden when empty)
  const descHtml = task.description
    ? `<p class="task-description">${escapeHtml(task.description)}</p>`
    : "";

  // Completed class adds line-through and dim effect
  const cardClass = `task-card priority-${task.priority}${task.completed ? " completed" : ""}`;

  return `
    <div class="${cardClass}" id="task-${task.id}" role="listitem" data-id="${task.id}">

      <!-- Circular checkbox to toggle completion -->
      <div class="task-checkbox-wrap">
        <button
          class="task-checkbox"
          title="${task.completed ? 'Mark as pending' : 'Mark as completed'}"
          aria-label="${task.completed ? 'Mark task as pending' : 'Mark task as completed'}"
          onclick="toggleTask(${task.id})"
        >
          <!-- Checkmark SVG (visible only when task is completed) -->
          <svg viewBox="0 0 12 10" fill="none" aria-hidden="true">
            <polyline points="1,5 4,9 11,1" />
          </svg>
        </button>
      </div>

      <!-- Task content -->
      <div class="task-body">
        <h3 class="task-title">${escapeHtml(task.title)}</h3>
        ${descHtml}
        <div class="task-meta">
          <span class="${priorityBadgeClass}">${priorityLabel}</span>
          ${dueBadgeHtml}
          ${statusBadgeHtml}
        </div>
      </div>

      <!-- Edit / Delete buttons -->
      <div class="task-actions">
        <button
          class="action-btn edit"
          title="Edit task"
          aria-label="Edit task: ${escapeHtml(task.title)}"
          onclick="startEditTask(${task.id})"
        >✏️</button>
        <button
          class="action-btn delete"
          title="Delete task"
          aria-label="Delete task: ${escapeHtml(task.title)}"
          onclick="showDeleteModal(${task.id})"
        >🗑️</button>
      </div>
    </div>
  `;
}

/**
 * Renders the given array of task objects into the task list section.
 * @param {Array} tasks - array of task objects
 */
function renderTasks(tasks) {
  // Hide spinner
  loadingSpinner.style.display = "none";

  if (tasks.length === 0) {
    taskList.innerHTML = "";
    emptyState.style.display = "block";

    // Show a helpful message depending on the active filter
    const messages = {
      all:       "Add your first task using the form above!",
      pending:   "No pending tasks. Great job!",
      completed: "No completed tasks yet.",
      high:      "No high-priority tasks.",
    };
    emptyMessage.textContent = messages[currentFilter] || "No tasks found.";
    return;
  }

  emptyState.style.display = "none";
  taskList.innerHTML = tasks.map(buildTaskCard).join("");
}

/**
 * Simple HTML escape to prevent XSS attacks.
 * Replaces special characters with their HTML entity equivalents.
 * @param {string} str - raw text
 * @returns {string} safe HTML string
 */
function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}


// ══════════════════════════════════════════════
//  5. FORM HANDLING (CREATE / EDIT)
// ══════════════════════════════════════════════

/**
 * Handles form submission for both creating and updating tasks.
 */
taskForm.addEventListener("submit", async (e) => {
  e.preventDefault();  // prevent the browser's default page reload

  // Clear any previous error message
  titleError.textContent = "";

  const title       = titleInput.value.trim();
  const description = descInput.value.trim();
  const priority    = prioritySelect.value;
  const due_date    = dueDateInput.value;

  // Client-side validation: title is required
  if (!title) {
    titleError.textContent = "Please enter a task title.";
    titleInput.focus();
    return;
  }

  const taskData = { title, description, priority, due_date };
  const editId   = editTaskIdInput.value;

  try {
    if (editId) {
      // UPDATE existing task
      await api.put(`/api/tasks/${editId}`, taskData);
      showToast("Task updated successfully!", "success");
    } else {
      // CREATE new task
      await api.post("/api/tasks", taskData);
      showToast("Task created!", "success");
    }

    resetForm();
    loadTasks();      // refresh task list
    loadStats();      // refresh dashboard counts
  } catch (error) {
    showToast(error.message || "Something went wrong.", "error");
  }
});

/**
 * Resets the form back to its default "add new task" state.
 */
function resetForm() {
  taskForm.reset();
  editTaskIdInput.value  = "";
  titleError.textContent = "";
  formTitle.textContent  = "Add New Task";
  formSubmitBtn.innerHTML = '<span class="btn-icon">+</span> Create Task';
  cancelEditBtn.style.display = "none";
}

/**
 * Populates the form with existing task data for editing.
 * @param {number} taskId - ID of the task to edit
 */
async function startEditTask(taskId) {
  try {
    const task = await api.get(`/api/tasks/${taskId}`);

    // Fill in form fields
    editTaskIdInput.value  = task.id;
    titleInput.value       = task.title;
    descInput.value        = task.description;
    prioritySelect.value   = task.priority;
    dueDateInput.value     = task.due_date;

    // Update form UI to "edit" mode
    formTitle.textContent   = "Edit Task";
    formSubmitBtn.innerHTML = '<span class="btn-icon">💾</span> Save Changes';
    cancelEditBtn.style.display = "inline-flex";

    // Scroll the form into view smoothly
    document.getElementById("form-section").scrollIntoView({ behavior: "smooth" });
    titleInput.focus();
  } catch (error) {
    showToast("Could not load task for editing.", "error");
  }
}

// Cancel button returns form to "add" mode without saving
cancelEditBtn.addEventListener("click", resetForm);


// ══════════════════════════════════════════════
//  6. TASK ACTIONS
// ══════════════════════════════════════════════

/**
 * Toggles a task's completed status via the API.
 * @param {number} taskId
 */
async function toggleTask(taskId) {
  try {
    const updatedTask = await api.patch(`/api/tasks/${taskId}/toggle`);
    const msg = updatedTask.completed ? "Task marked as done! ✅" : "Task marked as pending.";
    showToast(msg, "success");
    loadTasks();
    loadStats();
  } catch (error) {
    showToast("Could not update task.", "error");
  }
}

/**
 * Shows the delete confirmation modal for the given task.
 * @param {number} taskId
 */
function showDeleteModal(taskId) {
  taskIdToDelete = taskId;
  deleteModal.style.display = "flex";
}

/**
 * Performs the actual delete when user confirms in the modal.
 */
confirmDeleteBtn.addEventListener("click", async () => {
  if (taskIdToDelete === null) return;

  deleteModal.style.display = "none";

  try {
    await api.del(`/api/tasks/${taskIdToDelete}`);
    showToast("Task deleted.", "info");
    taskIdToDelete = null;

    // If we were editing this task, reset the form
    if (editTaskIdInput.value == taskIdToDelete) resetForm();

    loadTasks();
    loadStats();
  } catch (error) {
    showToast("Could not delete task.", "error");
  }
});

// Close modal without deleting
cancelDeleteBtn.addEventListener("click", () => {
  deleteModal.style.display = "none";
  taskIdToDelete = null;
});

// Also close modal by clicking the backdrop overlay
deleteModal.addEventListener("click", (e) => {
  if (e.target === deleteModal) {
    deleteModal.style.display = "none";
    taskIdToDelete = null;
  }
});


// ══════════════════════════════════════════════
//  7. FILTERING
// ══════════════════════════════════════════════

/**
 * Attaches click handlers to all filter buttons.
 * When clicked, updates the active filter and reloads the task list.
 */
filterButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    // Remove active class from all buttons, add to the clicked one
    filterButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    // Update the current filter and reload
    currentFilter = btn.dataset.filter;
    loadTasks();
  });
});


// ══════════════════════════════════════════════
//  8. DATA LOADING
// ══════════════════════════════════════════════

/**
 * Fetches tasks from the API (with the current filter) and renders them.
 */
async function loadTasks() {
  // Show spinner while loading
  loadingSpinner.style.display = "flex";
  emptyState.style.display     = "none";
  taskList.innerHTML           = "";

  try {
    const data = await api.get(`/api/tasks?filter=${currentFilter}`);
    renderTasks(data.tasks);
  } catch (error) {
    loadingSpinner.style.display = "none";
    showToast("Could not load tasks. Is the server running?", "error");
  }
}

/**
 * Fetches dashboard statistics and updates the counter elements.
 */
async function loadStats() {
  try {
    const stats = await api.get("/api/stats");
    // Animate the numbers updating
    animateCount(totalCountEl,     stats.total);
    animateCount(pendingCountEl,   stats.pending);
    animateCount(completedCountEl, stats.completed);
    animateCount(highCountEl,      stats.high_priority_pending);
  } catch (error) {
    // Stats failure is non-critical; silently ignore
    console.warn("Could not load stats:", error.message);
  }
}

/**
 * Quickly animates a number counter from its current value to the target.
 * @param {HTMLElement} el - the element to animate
 * @param {number} target - the final number to display
 */
function animateCount(el, target) {
  const start    = parseInt(el.textContent, 10) || 0;
  const duration = 400; // milliseconds
  const startTs  = performance.now();

  function step(ts) {
    const elapsed  = ts - startTs;
    const progress = Math.min(elapsed / duration, 1);
    el.textContent = Math.round(start + (target - start) * progress);
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}


// ══════════════════════════════════════════════
//  9. TOAST NOTIFICATION HELPER
// ══════════════════════════════════════════════

/**
 * Shows a brief toast notification at the bottom-right of the screen.
 * @param {string} message - text to display
 * @param {'success'|'error'|'info'} type - controls the colour strip
 */
function showToast(message, type = "info") {
  // Clear any existing timer so we don't hide a new toast too early
  if (toastTimeout) clearTimeout(toastTimeout);

  toastEl.textContent = message;
  toastEl.className   = `toast ${type} show`;

  // Auto-hide after 3 seconds
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove("show");
  }, 3000);
}


// ══════════════════════════════════════════════
//  10. KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════

document.addEventListener("keydown", (e) => {
  // Press Escape to close modal or cancel edit
  if (e.key === "Escape") {
    if (deleteModal.style.display !== "none") {
      deleteModal.style.display = "none";
      taskIdToDelete = null;
    } else if (editTaskIdInput.value) {
      resetForm();
    }
  }
});


// ══════════════════════════════════════════════
//  11. INITIALISATION
// ══════════════════════════════════════════════

/**
 * Entry point — runs when the page has fully loaded.
 * Loads the initial data from the server.
 */
document.addEventListener("DOMContentLoaded", () => {
  loadStats();   // populate dashboard
  loadTasks();   // populate task list
});

// Make functions globally accessible (called via onclick in HTML)
window.toggleTask      = toggleTask;
window.startEditTask   = startEditTask;
window.showDeleteModal = showDeleteModal;
