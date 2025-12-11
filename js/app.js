// משק קליין - אפליקציית ניהול משימות
// ====================================

// אלמנטים מה-DOM
const taskForm = document.getElementById('task-form');
const taskTitle = document.getElementById('task-title');
const taskBranch = document.getElementById('task-branch');
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
    solar: '☀️ מערכות סולאריות',
    dir: '🐑 דיר',
    lychee: '🍒 ליצ\'י',
    olives: '🫒 זיתים',
    avocado: '🥑 אבוקדו'
};

// פילטר נוכחי
let currentFilter = 'all';

// טעינת משימות מ-localStorage
function loadTasks() {
    const tasks = localStorage.getItem('meshek-klein-tasks');
    return tasks ? JSON.parse(tasks) : [];
}

// שמירת משימות ל-localStorage
function saveTasks(tasks) {
    localStorage.setItem('meshek-klein-tasks', JSON.stringify(tasks));
}

// יצירת ID ייחודי
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// פורמט תאריך לעברית
function formatDate(dateString) {
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
    const taskDate = new Date(dateString);
    return taskDate < today;
}

// הוספת משימה חדשה
function addTask(title, branch, dueDate, notes = '') {
    const tasks = loadTasks();
    const newTask = {
        id: generateId(),
        title,
        branch,
        dueDate,
        notes,
        completed: false,
        completedDate: null,
        createdAt: new Date().toISOString()
    };
    tasks.unshift(newTask); // הוסף בהתחלה
    saveTasks(tasks);
    renderTasks();
    updateStats();
}

// סימון משימה כהושלמה/לא הושלמה
function toggleTask(taskId) {
    const tasks = loadTasks();
    const task = tasks.find(t => t.id === taskId);
    if (task) {
        task.completed = !task.completed;
        task.completedDate = task.completed ? new Date().toISOString() : null;
        saveTasks(tasks);
        renderTasks();
        updateStats();
    }
}

// מחיקת משימה
function deleteTask(taskId) {
    if (confirm('האם למחוק את המשימה?')) {
        let tasks = loadTasks();
        tasks = tasks.filter(t => t.id !== taskId);
        saveTasks(tasks);
        renderTasks();
        updateStats();
    }
}

// יצירת HTML למשימה
function createTaskElement(task) {
    const isTaskOverdue = !task.completed && isOverdue(task.dueDate);
    
    const taskCard = document.createElement('div');
    taskCard.className = `task-card ${task.completed ? 'completed' : ''}`;
    taskCard.dataset.branch = task.branch;
    
    taskCard.innerHTML = `
        <input type="checkbox" class="task-checkbox" ${task.completed ? 'checked' : ''} 
               onchange="toggleTask('${task.id}')">
        <div class="task-content">
            <span class="task-title">${task.title}</span>
            <div class="task-meta">
                <span class="task-branch">${branchNames[task.branch]}</span>
                <span class="task-date ${isTaskOverdue ? 'overdue' : ''}">
                    📅 ${formatDate(task.dueDate)}
                    ${isTaskOverdue ? '(באיחור!)' : ''}
                </span>
            </div>
            ${task.notes ? `<div class="task-notes">📝 ${task.notes}</div>` : ''}
            ${task.completedDate ? `<span class="task-completed-date">✓ הושלם ב-${formatDate(task.completedDate)}</span>` : ''}
        </div>
        <button class="btn-delete" onclick="deleteTask('${task.id}')" title="מחק משימה">🗑️</button>
    `;
    
    return taskCard;
}

// רינדור כל המשימות
function renderTasks() {
    const tasks = loadTasks();
    tasksList.innerHTML = '';
    
    // פילטור לפי ענף
    const filteredTasks = currentFilter === 'all' 
        ? tasks 
        : tasks.filter(t => t.branch === currentFilter);
    
    // מיון: לא הושלמו קודם, ואז לפי תאריך
    filteredTasks.sort((a, b) => {
        if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
        }
        return new Date(a.dueDate) - new Date(b.dueDate);
    });
    
    if (filteredTasks.length === 0) {
        emptyState.classList.remove('hidden');
    } else {
        emptyState.classList.add('hidden');
        filteredTasks.forEach(task => {
            tasksList.appendChild(createTaskElement(task));
        });
    }
}

// עדכון סטטיסטיקות
function updateStats() {
    const tasks = loadTasks();
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    
    totalTasksEl.textContent = total;
    completedTasksEl.textContent = completed;
    pendingTasksEl.textContent = pending;
}

// Event Listeners
// ===============

// טופס הוספת משימה
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const title = taskTitle.value.trim();
    const branch = taskBranch.value;
    const dueDate = taskDate.value;
    const notes = taskNotes.value.trim();
    
    if (title && branch && dueDate) {
        addTask(title, branch, dueDate, notes);
        taskForm.reset();
        // קבע תאריך ברירת מחדל להיום
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
    const tasks = loadTasks();
    let completedTasks = tasks.filter(t => t.completed);
    
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
    
    // מיון לפי תאריך השלמה (החדש ביותר קודם)
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
                        <span>📅 יעד: ${formatDate(task.dueDate)}</span>
                    </div>
                    ${task.notes ? `<div class="log-item-notes">📝 ${task.notes}</div>` : ''}
                </div>
                <div class="log-item-dates">
                    <div>✓ הושלם:</div>
                    <div>${formatDate(task.completedDate)}</div>
                </div>
            `;
            logList.appendChild(logItem);
        });
    }
}

// ייצוא לוג לקובץ טקסט
exportLogBtn.addEventListener('click', () => {
    const tasks = loadTasks();
    const completedTasks = tasks.filter(t => t.completed);
    
    if (completedTasks.length === 0) {
        alert('אין משימות שהושלמו לייצוא');
        return;
    }
    
    // מיון לפי תאריך
    completedTasks.sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate));
    
    let content = '📋 לוג משימות שהושלמו - משק קליין\n';
    content += '=' .repeat(50) + '\n\n';
    content += `תאריך ייצוא: ${new Date().toLocaleDateString('he-IL')}\n`;
    content += `סה"כ משימות שהושלמו: ${completedTasks.length}\n\n`;
    content += '-'.repeat(50) + '\n\n';
    
    completedTasks.forEach((task, index) => {
        content += `${index + 1}. ${task.title}\n`;
        content += `   ענף: ${branchNames[task.branch]}\n`;
        content += `   תאריך יעד: ${formatDate(task.dueDate)}\n`;
        content += `   הושלם בתאריך: ${formatDate(task.completedDate)}\n`;
        if (task.notes) {
            content += `   הערות: ${task.notes}\n`;
        }
        content += '\n';
    });
    
    // יצירת קובץ להורדה
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

// אתחול
// =====
document.addEventListener('DOMContentLoaded', () => {
    // קבע תאריך ברירת מחדל להיום
    taskDate.value = new Date().toISOString().split('T')[0];
    
    // טען ורנדר משימות
    renderTasks();
    updateStats();
});
