/* ============================================
   SMART STUDENT FEE MANAGEMENT SYSTEM
   Shared Utilities — script.js
   ============================================ */

/**
 * Toggle mobile sidebar
 */
function toggleSidebar() {
    console.log("toggleSidebar called");
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar) {
        const isOpen = sidebar.classList.toggle('open');
        console.log("Sidebar isOpen:", isOpen);
        if (overlay) {
            if (isOpen) {
                overlay.classList.add('active');
                document.body.style.overflow = 'hidden'; 
            } else {
                overlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    } else {
        console.error("Sidebar element not found!");
    }
}

/**
 * Close mobile sidebar
 */
function closeSidebar() {
    console.log("closeSidebar called");
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');
    document.body.style.overflow = '';
}

window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;

/**
 * Retrieve the students array from Firestore or LocalStorage.
 * @returns {Promise<Array>} Array of student objects
 */
async function getStudents() {
  if (!window.isConfigured) {
    const data = localStorage.getItem('students');
    return data ? JSON.parse(data) : [];
  }
  try {
    const querySnapshot = await window.db.collection("students").get();
    const students = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      students.push({
        id: doc.id,
        ...data,
        name: data.name || data.Name || '',
        reg: data.reg || data.RegNo || data.id || doc.id || ''
      });
    });
    return students;
  } catch (e) {
    console.error('Error reading students from Firestore:', e);
    const data = localStorage.getItem('students');
    return data ? JSON.parse(data) : [];
  }
}

/**
 * Save a single student to Firestore and LocalStorage.
 * @param {Object} student — Student object
 */
async function saveStudent(student) {
  // Always save to localStorage as a local secondary/fallback
  const students = await getStudentsLocalOnly();
  const idx = students.findIndex(s => s.reg === student.reg);
  if (idx >= 0) students[idx] = student;
  else students.push(student);
  localStorage.setItem('students', JSON.stringify(students));

  if (!window.isConfigured) return;

  try {
    await window.db.collection("students").doc(student.reg).set(student);
  } catch (e) {
    console.error('Error saving student to Firestore:', e);
    // Don't show toast if it's a background process (like batch upload) unless it's a real failure
    if (typeof window.isBatch === 'undefined') {
      showToast('Sync error — student data not saved to cloud.', 'error');
    }
  }
}

/**
 * Helper to get students from localStorage only (for internal logic)
 */
async function getStudentsLocalOnly() {
  const data = localStorage.getItem('students');
  return data ? JSON.parse(data) : [];
}

/**
 * [BUGFIX] Delete a single student from Firestore and LocalStorage.
 * Previously, admin.html called window.db directly without checking isConfigured,
 * which crashed when Firebase was not configured.
 * @param {string} reg — Register number (document ID)
 */
async function deleteStudentRecord(reg) {
  // Always remove from localStorage
  let students = await getStudentsLocalOnly();
  students = students.filter(s => s.reg !== reg);
  localStorage.setItem('students', JSON.stringify(students));

  if (!window.isConfigured) return;
  try {
    await window.db.collection("students").doc(reg).delete();
  } catch (e) {
    console.error('Error deleting student from Firestore:', e);
    throw e;
  }
}

/**
 * Save the entire students array.
 * [IMPROVEMENT] Uses Firestore batched writes (max 500 per batch) instead of
 * sequential await saveStudent() calls, which was O(n) round-trips and very
 * slow for large Excel imports.
 * @param {Array} students — Array of student objects
 */
async function saveStudents(students) {
  localStorage.setItem('students', JSON.stringify(students));
  if (!window.isConfigured) return;
  try {
    const BATCH_SIZE = 490; // Firestore limit is 500 ops per batch
    for (let i = 0; i < students.length; i += BATCH_SIZE) {
      const chunk = students.slice(i, i + BATCH_SIZE);
      const batch = window.db.batch();
      chunk.forEach(student => {
        const ref = window.db.collection("students").doc(student.reg);
        batch.set(ref, student);
      });
      await batch.commit();
    }
  } catch (e) {
    console.error('Error saving students batch to Firestore:', e);
  }
}

/* ---------- Security / Sanitization ---------- */

/**
 * Sanitize a string to prevent injection.
 * Strips HTML tags and trims whitespace.
 * @param {string} str — The input string
 * @returns {string} Sanitized string
 */
function sanitize(str) {
  if (typeof str !== 'string') return '';
  // Remove any HTML tags
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML.trim();
}

/**
 * Escape HTML entities for safe display in innerHTML.
 * @param {string} str — The input string
 * @returns {string} Escaped string
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return str.replace(/[&<>"']/g, c => map[c]);
}

/**
 * Clean phone number for tel: and wa.me: links.
 * Removes all non-numeric characters.
 */
function cleanPhone(phone) {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
}

/* ---------- Toast Notifications ---------- */

/**
 * Show a toast notification.
 * @param {string} message — Message to display
 * @param {string} type — 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration — Duration in milliseconds (default 3000)
 */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    'event-switch': '🎪'
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);

  // Auto-dismiss
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(60px)';
    toast.style.transition = 'all .3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ---------- Global Settings Helpers ---------- */

/**
 * Retrieve all events from Firestore or LocalStorage.
 */
async function getEvents() {
  if (!window.isConfigured) {
    const data = localStorage.getItem('events_list');
    return data ? JSON.parse(data) : [];
  }
  try {
    const querySnapshot = await window.db.collection("events").get();
    const events = [];
    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });
    return events;
  } catch (e) {
    console.error('Error reading events:', e);
    const data = localStorage.getItem('events_list');
    return data ? JSON.parse(data) : [];
  }
}

/**
 * Save event details to a dedicated events collection.
 */
async function saveEvent(ev) {
  const events = await getEvents();
  const id = ev.id || "event_" + Date.now();
  ev.id = id;
  ev.updatedAt = Date.now();

  const idx = events.findIndex(e => e.id === id);
  if (idx >= 0) events[idx] = ev;
  else events.push(ev);
  localStorage.setItem('events_list', JSON.stringify(events));

  if (window.isConfigured) {
    try {
      await window.db.collection("events").doc(id).set(ev);
    } catch (e) { console.error('Error saving event:', e); }
  }
  return id;
}

/**
 * Delete an event.
 */
async function deleteEventRecord(id) {
  let events = await getEvents();
  events = events.filter(e => e.id !== id);
  localStorage.setItem('events_list', JSON.stringify(events));

  if (window.isConfigured) {
    try {
      await window.db.collection("events").doc(id).delete();
      // Note: In production, you'd also delete the payments subcollection
    } catch (e) { console.error('Error deleting event:', e); }
  }
}

/**
 * Get payments for a specific event.
 */
async function getPayments(eventId) {
  if (!window.isConfigured) {
    const data = localStorage.getItem(`payments_${eventId}`);
    return data ? JSON.parse(data) : {};
  }
  try {
    const querySnapshot = await window.db.collection("events").doc(eventId).collection("payments").get();
    const payments = {};
    querySnapshot.forEach((doc) => {
      // Use original casing or standardized casing? Standardizing to uppercase for keys.
      payments[doc.id.toUpperCase()] = doc.data();
    });
    return payments;
  } catch (e) {
    console.error('Error reading payments:', e);
    const data = localStorage.getItem(`payments_${eventId}`);
    return data ? JSON.parse(data) : {};
  }
}

/**
 * Save a payment record for a student for a specific event.
 */
async function savePayment(eventId, studentReg, paymentData) {
  if (!eventId || !studentReg) return;
  const reg = studentReg.trim().toUpperCase();

  // Local storage backup
  const data = localStorage.getItem(`payments_${eventId}`);
  const payments = data ? JSON.parse(data) : {};
  payments[reg] = paymentData;
  localStorage.setItem(`payments_${eventId}`, JSON.stringify(payments));

  if (window.isConfigured) {
    try {
      await window.db.collection("events").doc(eventId).collection("payments").doc(reg).set(paymentData);
    } catch (e) { console.error('Error saving payment:', e); }
  }
}

/**
 * Subscribe to real-time updates for payments of a specific event.
 */
function subscribeToPayments(eventId, callback) {
  if (!window.isConfigured || !window.db || !eventId) return null;
  return window.db.collection("events").doc(eventId).collection("payments").onSnapshot((querySnapshot) => {
    const payments = {};
    querySnapshot.forEach((doc) => {
      payments[doc.id.toUpperCase()] = doc.data();
    });
    callback(payments);
  }, (error) => {
    console.error("Error subscribing to payments:", error);
  });
}

/**
 * Subscribe to real-time updates for all events.
 */
function subscribeToEvents(callback) {
  if (!window.isConfigured || !window.db) return null;
  return window.db.collection("events").onSnapshot((querySnapshot) => {
    const events = [];
    querySnapshot.forEach((doc) => {
      events.push({ id: doc.id, ...doc.data() });
    });
    callback(events);
  }, (error) => {
    console.error("Error subscribing to events:", error);
  });
}

/**
 * Compatibility: Get the active event.
 */
async function getEvent() {
  const events = await getEvents();
  return events.find(e => e.status === 'active') || events[0] || {};
}

/**
 * Compatibility: Save event to Firestore.
 */
async function saveEventFirestore(ev) {
  return await saveEvent(ev);
}

/**
 * Retrieve notice.
 */
async function getNotice() {
  if (!window.isConfigured) {
    return localStorage.getItem('notice') || "";
  }
  try {
    const docSnap = await window.db.collection("settings").doc("notice").get();
    return docSnap.exists ? (docSnap.data().text || "") : "";
  } catch (e) {
    console.error('Error reading notice:', e);
    return localStorage.getItem('notice') || "";
  }
}

/**
 * Save notice.
 */
async function saveNoticeFirestore(text) {
  localStorage.setItem('notice', text);
  if (!window.isConfigured) return;
  try {
    await window.db.collection("settings").doc("notice").set({ text });
  } catch (e) {
    console.error('Error saving notice:', e);
  }
}

/**
 * Get dynamic admin name.
 */
async function getAdminName() {
  try {
    const docSnap = await window.db.collection("settings").doc("admin").get();
    return docSnap.exists ? (docSnap.data().name || "Admin") : "Admin";
  } catch (e) {
    console.error('Error reading admin name:', e);
    return localStorage.getItem('admin_name') || "Admin";
  }
}

/**
 * Save dynamic admin name.
 */
async function saveAdminName(name) {
  localStorage.setItem('admin_name', name);
  if (!window.isConfigured) return;
  try {
    await window.db.collection("settings").doc("admin").set({ name });
  } catch (e) {
    console.error('Error saving admin name:', e);
  }
}

// Attach all to window
window.getStudents = getStudents;
window.deleteStudentRecord = deleteStudentRecord;
window.saveStudent = saveStudent;
window.saveStudents = saveStudents;
window.getEvents = getEvents;
window.saveEvent = saveEvent;
window.deleteEventRecord = deleteEventRecord;
window.getPayments = getPayments;
window.savePayment = savePayment;
window.subscribeToEvents = subscribeToEvents;
window.subscribeToPayments = subscribeToPayments;
window.getEvent = getEvent; // Compatibility
window.saveEventFirestore = saveEventFirestore; // Compatibility
window.getNotice = getNotice;
window.saveNoticeFirestore = saveNoticeFirestore;
window.getAdminName = getAdminName;
window.saveAdminName = saveAdminName;
window.sanitize = sanitize;
window.escapeHTML = escapeHTML;
window.cleanPhone = cleanPhone;
window.showToast = showToast;

window.showToast = showToast;
