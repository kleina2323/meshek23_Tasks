// משק קליין - אפליקציית ניהול משימות עם Firebase
// ================================================

// אלמנטים מה-DOM
const taskForm = document.getElementById('task-form');
const taskTitle = document.getElementById('task-title');
const taskBranch = document.getElementById('task-branch');
const taskAssignee = document.getElementById('task-assignee');
const taskDate = document.getElementById('task-date');
const taskNotes = document.getElementById('task-notes');
const tasksList = document.getElementById('tasks-list');
const emptyState = document.getElementById('empty-state');
const filterBtns = document.querySelectorAll('.filter-btn');

// סטטיסטיקות
const totalTasksEl = document.getElementById('total-tasks');
const pendingTasksEl = document.getElementById('pending-tasks');
const completedTasksEl = document.getElementById('completed-tasks');

// מיפוי ענפים
const branchNames = {
    general: '📌 כללי',
    solar: '☀️ מערכות סולאריות',
    dir: '🐑 דיר',
    lychee: '🍒 ליצ\'י',
    olives: '🫒 זיתים',
    avocado: '🥑 אבוקדו',
    finance: '💰 פיננסי'
};

// מיפוי שמות אחראים
const assigneeNames = {
    adi: 'עדי',
    omer: 'עומר',
    ido: 'עידו',
    dorit: 'דורית',
    eli: 'אלי'
};

// פילטר נוכחי
let currentFilter = 'all';

// מערך משימות מקומי (cache)
let tasksCache = [];

// ===================
// Firebase Functions
// ===================

// טעינת משימות מ-Firebase
async function loadTasks() {
    try {
        const snapshot = await db.collection('tasks').orderBy('createdAt', 'desc').get();
        tasksCache = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return tasksCache;
    } catch (error) {
        console.error('Error loading tasks:', error);
        return [];
    }
}

// הוספת משימה ל-Firebase
async function addTask(title, branch, assignee, dueDate, notes = '') {
    try {
        const newTask = {
            title,
            branch,
            assignee,
            dueDate,
            notes,
            completed: false,
            completedDate: null,
            createdAt: new Date().toISOString()
        };
        
        await db.collection('tasks').add(newTask);
        await loadAndRender();
    } catch (error) {
        console.error('Error adding task:', error);
        alert('שגיאה בהוספת משימה');
    }
}

// עדכון משימה ב-Firebase
async function toggleTask(taskId) {
    try {
        const task = tasksCache.find(t => t.id === taskId);
        if (task) {
            if (!task.completed) {
                // פתיחת Modal לבחירת מי סגר
                openCompleteModal(taskId, task.title);
            } else {
                // ביטול סגירה - החזרה למשימות פעילות
                await db.collection('tasks').doc(taskId).update({
                    completed: false,
                    completedDate: null,
                    completedBy: null
                });
                await loadAndRender();
            }
        }
    } catch (error) {
        console.error('Error updating task:', error);
    }
}

// פתיחת Modal לסגירת משימה
function openCompleteModal(taskId, taskTitle) {
    document.getElementById('complete-task-id').value = taskId;
    document.getElementById('complete-task-title').textContent = taskTitle;
    document.getElementById('complete-by').value = '';
    document.getElementById('complete-modal').classList.remove('hidden');
}

// סגירת Modal סגירת משימה
function closeCompleteModal() {
    document.getElementById('complete-modal').classList.add('hidden');
}

// טיפול בשליחת טופס סגירת משימה
document.getElementById('complete-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const taskId = document.getElementById('complete-task-id').value;
    const completedBy = document.getElementById('complete-by').value;
    
    if (!completedBy) {
        alert('יש לבחור מי סגר את המשימה');
        return;
    }
    
    try {
        await db.collection('tasks').doc(taskId).update({
            completed: true,
            completedDate: new Date().toISOString(),
            completedBy: completedBy
        });
        closeCompleteModal();
        await loadAndRender();
    } catch (error) {
        console.error('Error completing task:', error);
        alert('שגיאה בסגירת המשימה');
    }
});



// מחיקת משימה מ-Firebase
async function deleteTask(taskId) {
    if (confirm('האם למחוק את המשימה?')) {
        try {
            await db.collection('tasks').doc(taskId).delete();
            await loadAndRender();
        } catch (error) {
            console.error('Error deleting task:', error);
        }
    }
}

// החזרת משימה מהלוג למשימות פעילות
async function restoreTask(taskId) {
    try {
        await db.collection('tasks').doc(taskId).update({
            completed: false,
            completedDate: null,
            completedBy: null
        });
        await loadAndRender();
    } catch (error) {
        console.error('Error restoring task:', error);
    }
}

// ===================
// UI Functions
// ===================

// פורמט תאריך לעברית
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

// בדיקה אם תאריך עבר
function isOverdue(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDateObj = new Date(dateString);
    return taskDateObj < today;
}

// בדיקה אם משימה הושלמה לפני יותר מ-3 ימים
function isCompletedMoreThan3DaysAgo(completedDate) {
    if (!completedDate) return false;
    const completed = new Date(completedDate);
    const now = new Date();
    const diffTime = now - completed;
    const diffDays = diffTime / (1000 * 60 * 60 * 24);
    return diffDays >= 3;
}

// בדיקה אם משימה קרובה (יומיים לפני הסיום)
function isDueSoon(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDateObj = new Date(dateString);
    const twoDaysFromNow = new Date(today);
    twoDaysFromNow.setDate(today.getDate() + 2);
    return taskDateObj >= today && taskDateObj <= twoDaysFromNow;
}

// יצירת HTML למשימה
function createTaskElement(task) {
    const isTaskOverdue = !task.completed && isOverdue(task.dueDate);
    const isTaskDueSoon = !task.completed && !isTaskOverdue && isDueSoon(task.dueDate);
    
    const taskCard = document.createElement('div');
    taskCard.className = `task-card ${task.completed ? 'completed' : ''} ${isTaskOverdue ? 'overdue' : ''} ${isTaskDueSoon ? 'due-soon' : ''}`;
    taskCard.dataset.branch = task.branch;
    
    // מידע על סגירת המשימה
    const completedInfo = task.completed ? 
        `<div class="task-completed-info">
            ✓ נסגר ע"י ${assigneeNames[task.completedBy] || task.completedBy || '-'} | ${formatDate(task.completedDate)}
        </div>` : '';
    
    taskCard.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
               onchange="toggleTask('${task.id}')">
        <div class="task-content">
            <span class="task-title" title="${task.title}">${task.title} ${task.recurring ? '<span class="recurring-badge" title="משימה חוזרת"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg></span>' : ''}</span>
            <div class="task-meta">
                <span class="task-branch">${branchNames[task.branch]}</span>
                <span class="task-assignee">👤 ${assigneeNames[task.assignee] || task.assignee || '-'}</span>
                <span class="task-date ${isTaskOverdue ? 'overdue' : ''}">
                    📅 ${formatDate(task.dueDate)}${isTaskOverdue ? ' (איחור!)' : ''}
                </span>
                ${task.notes ? `<span class="task-notes" title="${task.notes}">📝 ${task.notes}</span>` : ''}
            </div>
            ${completedInfo}
        </div>
        <div class="task-actions">
            ${!task.completed ? `<button class="btn-edit" onclick="openEditModal('${task.id}')" title="ערוך משימה">✏️</button>` : ''}
            ${!task.completed ? `<button class="btn-calendar" onclick="addToGoogleCalendar('${task.id}')" title="הוסף ליומן Google">📅</button>` : ''}
            <button class="btn-delete" onclick="deleteTask('${task.id}')" title="מחק משימה">🗑️</button>
        </div>
    `;
    
    return taskCard;
}

// הוספה ליומן Google
function addToGoogleCalendar(taskId) {
    const task = tasksCache.find(t => t.id === taskId);
    if (!task) return;
    
    const title = encodeURIComponent(`משק קליין: ${task.title}`);
    const details = encodeURIComponent(`ענף: ${branchNames[task.branch]}${task.notes ? '\n\nהערות: ' + task.notes : ''}`);
    const date = task.dueDate.replace(/-/g, '');
    
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&dates=${date}/${date}&reminder=1440`;
    
    window.open(calendarUrl, '_blank');
}

// רינדור כל המשימות
function renderTasks() {
    tasksList.innerHTML = '';
    
    // פילטור לפי ענף - רק משימות שלא הושלמו
    let filteredTasks = tasksCache.filter(t => {
        if (!t.completed) return true; // משימות פעילות
        // משימות שהושלמו - הצג עם קו מחיקה אם פחות מ-3 ימים עברו
        return !isCompletedMoreThan3DaysAgo(t.completedDate);
    });
    
    if (currentFilter !== 'all') {
        filteredTasks = filteredTasks.filter(t => t.branch === currentFilter);
    }
    
    // מיון לפי תאריך
    filteredTasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    if (filteredTasks.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        filteredTasks.forEach(task => {
            tasksList.appendChild(createTaskElement(task));
        });
    }
    
    // עדכון הלוג אם פתוח
    if (!logContainer.classList.contains('hidden')) {
        renderLog();
    }
}

// עדכון סטטיסטיקות
function updateStats() {
    const completed = tasksCache.filter(t => t.completed).length;
    const pending = tasksCache.filter(t => !t.completed).length;
    const total = pending; // רק משימות פעילות
    
    totalTasksEl.textContent = total;
    completedTasksEl.textContent = completed;
    pendingTasksEl.textContent = pending;
}

// טעינה ורינדור
async function loadAndRender() {
    await loadTasks();
    renderTasks();
    updateStats();
}

// ===================
// Event Listeners
// ===================

// טופס הוספת משימה
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = taskTitle.value.trim();
    const branch = taskBranch.value;
    const assignee = taskAssignee.value;
    const dueDate = taskDate.value;
    const notes = taskNotes.value.trim();
    
    
    if (title && branch && assignee && dueDate) {
        await addTask(title, branch, assignee, dueDate, notes);
        taskForm.reset();
        taskDate.value = new Date().toISOString().split('T')[0];
    }
});

// כפתורי פילטר
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderTasks();
    });
});

// ===================
// לוג משימות שהושלמו
// ===================

const toggleLogBtn = document.getElementById('toggle-log');
const logContainer = document.getElementById('log-container');
const logList = document.getElementById('log-list');
const logEmpty = document.getElementById('log-empty');
const logBranchFilter = document.getElementById('log-branch-filter');
const logMonthFilter = document.getElementById('log-month-filter');
const exportLogBtn = document.getElementById('export-log');

// פתיחה/סגירה של הלוג
toggleLogBtn.addEventListener('click', () => {
    logContainer.classList.toggle('hidden');
    if (logContainer.classList.contains('hidden')) {
        toggleLogBtn.textContent = 'הצג לוג';
    } else {
        toggleLogBtn.textContent = 'הסתר לוג';
        renderLog();
    }
});

// פילטור לוג
logBranchFilter.addEventListener('change', renderLog);
logMonthFilter.addEventListener('change', renderLog);

// רינדור הלוג
function renderLog() {
    let completedTasks = tasksCache.filter(t => t.completed);
    
    // סינון לפי ענף
    const branchFilter = logBranchFilter.value;
    if (branchFilter !== 'all') {
        completedTasks = completedTasks.filter(t => t.branch === branchFilter);
    }
    
    // סינון לפי חודש
    const monthFilter = logMonthFilter.value;
    if (monthFilter) {
        completedTasks = completedTasks.filter(t => {
            if (!t.completedDate) return false;
            const completedMonth = t.completedDate.substring(0, 7);
            return completedMonth === monthFilter;
        });
    }
    
    // מיון לפי תאריך השלמה
    completedTasks.sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate));
    
    logList.innerHTML = '';
    
    if (completedTasks.length === 0) {
        logEmpty.classList.remove('hidden');
        logList.classList.add('hidden');
    } else {
        logEmpty.classList.add('hidden');
        logList.classList.remove('hidden');
        
        completedTasks.forEach(task => {
            const logItem = document.createElement('div');
            logItem.className = 'log-item';
            logItem.innerHTML = `
                <div class="log-item-content">
                    <span class="log-item-title">${task.title}</span>
                    <div class="log-item-meta">
                        <span>${branchNames[task.branch]}</span>
                        <span>👤 אחראי: ${assigneeNames[task.assignee] || task.assignee || '-'}</span>
                        <span>📅 יעד: ${formatDate(task.dueDate)}</span>
                    </div>
                    ${task.notes ? `<div class="log-item-notes">📝 ${task.notes}</div>` : ''}
                </div>
                <div class="log-item-actions">
                    <div class="log-item-dates">
                        <div>✓ הושלם: ${formatDate(task.completedDate)}</div>
                        <div>👤 סגר: ${assigneeNames[task.completedBy] || task.completedBy || '-'}</div>
                    </div>
                    <button class="btn-restore" onclick="restoreTask('${task.id}')" title="החזר למשימות">↩️</button>
                </div>
            `;
            logList.appendChild(logItem);
        });
    }
}

// ייצוא לוג לקובץ טקסט
exportLogBtn.addEventListener('click', () => {
    const completedTasks = tasksCache.filter(t => t.completed);
    
    if (completedTasks.length === 0) {
        alert('אין משימות שהושלמו לייצוא');
        return;
    }
    
    completedTasks.sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate));
    
    let content = '📋 לוג משימות שהושלמו - משק קליין\n';
    content += '=' .repeat(50) + '\n\n';
    content += `תאריך ייצוא: ${new Date().toLocaleDateString('he-IL')}\n`;
    content += `סה"כ משימות שהושלמו: ${completedTasks.length}\n\n`;
    content += '-'.repeat(50) + '\n\n';
    
    completedTasks.forEach((task, index) => {
        content += `${index + 1}. ${task.title}\n`;
        content += `   ענף: ${branchNames[task.branch]}\n`;
        content += `   אחראי: ${assigneeNames[task.assignee] || task.assignee || '-'}\n`;
        content += `   תאריך יעד: ${formatDate(task.dueDate)}\n`;
        content += `   הושלם בתאריך: ${formatDate(task.completedDate)}\n`;
        content += `   סגר: ${assigneeNames[task.completedBy] || task.completedBy || '-'}\n`;
        if (task.notes) {
            content += `   הערות: ${task.notes}\n`;
        }
        content += '\n';
    });
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `משק_קליין_לוג_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// ===================
// ברכה לפי שעה
// ===================
function setGreeting() {
    const hour = new Date().getHours();
    const greetingEl = document.getElementById('greeting');
    let greeting = '';
    
    if (hour >= 5 && hour < 12) {
        greeting = '☀️ בוקר טוב!';
    } else if (hour >= 12 && hour < 14) {
        greeting = '🌤️ צהריים טובים!';
    } else if (hour >= 14 && hour < 17) {
        greeting = '🌅 אחה"צ טובים!';
    } else if (hour >= 17 && hour < 21) {
        greeting = '🌆 ערב טוב!';
    } else {
        greeting = '🌙 לילה טוב!';
    }
    
    greetingEl.textContent = greeting;
}

// עדכון תאריך ושעה
function updateDateTime() {
    const now = new Date();
    
    const dateEl = document.getElementById('current-date');
    const timeEl = document.getElementById('current-time');
    
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('he-IL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }
    
    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

// ===================
// עריכת משימה
// ===================

// פתיחת modal לעריכה
function openEditModal(taskId) {
    const task = tasksCache.find(t => t.id === taskId);
    if (!task) return;
    
    document.getElementById('edit-task-id').value = taskId;
    document.getElementById('edit-title').value = task.title;
    document.getElementById('edit-branch').value = task.branch;
    document.getElementById('edit-assignee').value = task.assignee;
    document.getElementById('edit-date').value = task.dueDate;
    document.getElementById('edit-notes').value = task.notes || '';
    // recurring removed
    
    document.getElementById('edit-modal').classList.remove('hidden');
}

// סגירת modal
function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

// שמירת עריכה
document.getElementById('edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const taskId = document.getElementById('edit-task-id').value;
    const updates = {
        title: document.getElementById('edit-title').value.trim(),
        branch: document.getElementById('edit-branch').value,
        assignee: document.getElementById('edit-assignee').value,
        dueDate: document.getElementById('edit-date').value,
        notes: document.getElementById('edit-notes').value.trim(),
        
    };
    
    try {
        await db.collection('tasks').doc(taskId).update(updates);
        closeEditModal();
        await loadAndRender();
    } catch (error) {
        console.error('Error updating task:', error);
        alert('שגיאה בעדכון משימה');
    }
});

// סגירה בלחיצה מחוץ ל-modal
document.getElementById('edit-modal').addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') {
        closeEditModal();
    }
});

// ===================
// Auto-grow textarea
// ===================
function autoGrowTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

// ===================
// אתחול
// ===================
document.addEventListener('DOMContentLoaded', () => {
    setGreeting();
    updateDateTime();
    setInterval(updateDateTime, 1000); // עדכון כל שנייה
    taskDate.value = new Date().toISOString().split('T')[0];
    loadAndRender();
    
    // הוספת auto-grow לשדה כותרת המשימה
    taskTitle.addEventListener('input', function() {
        autoGrowTextarea(this);
    });
});

// האזנה לשינויים בזמן אמת מ-Firebase
db.collection('tasks').onSnapshot(() => {
    loadAndRender();
});














