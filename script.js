// ---------- DATA & STORAGE ----------
let schedule = [];
const STORAGE_KEY = 'smartbuddy_schedule';

// Load from LocalStorage
function loadSchedule() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        schedule = JSON.parse(stored);
    } else {
        // Demo data for testing
        schedule = [
            { id: Date.now() + 1, day: 'Monday', start: '09:00', end: '10:00', subject: 'Software Engg', room: 'LH-12' },
            { id: Date.now() + 2, day: 'Monday', start: '10:00', end: '11:00', subject: 'Mathematics', room: 'AB-01' },
            { id: Date.now() + 3, day: 'Wednesday', start: '14:00', end: '15:30', subject: 'Data Structures', room: 'C-203' },
        ];
        saveSchedule();
    }
}

function saveSchedule() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schedule));
}

// ---------- TIME UTILITIES ----------
function getCurrentDay() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
}

function getCurrentTimeString() {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

function updateLiveDateTime() {
    const now = new Date();
    document.getElementById('liveDateTime').textContent = 
        `${getCurrentDay()} ${now.toLocaleDateString()} ${getCurrentTimeString()}`;
}

// ---------- CORE: FIND CURRENT CLASS ----------
function findCurrentClass() {
    const today = getCurrentDay();
    const now = getCurrentTimeString();
    
    const current = schedule.find(item => 
        item.day === today && item.start <= now && item.end >= now
    );
    
    const displayDiv = document.getElementById('currentClassDisplay');
    if (current) {
        const endTime = current.end;
        const [endH, endM] = endTime.split(':').map(Number);
        const [nowH, nowM] = now.split(':').map(Number);
        const minutesLeft = (endH * 60 + endM) - (nowH * 60 + nowM);
        
        displayDiv.innerHTML = `
            <strong>${current.subject}</strong> (${current.start} - ${current.end})<br>
            📍 Room: ${current.room}<br>
            ⏳ ${minutesLeft} minutes remaining
        `;
    } else {
        // Check if any class today but later
        const upcoming = schedule.filter(item => item.day === today && item.start > now)
                                 .sort((a,b) => a.start.localeCompare(b.start));
        if (upcoming.length > 0) {
            displayDiv.innerHTML = `No class right now. Next: ${upcoming[0].subject} at ${upcoming[0].start}`;
        } else {
            displayDiv.innerHTML = '🎉 No more classes today!';
        }
    }
}

// ---------- RENDER TIMETABLE (with Edit/Delete) ----------
function renderTimetable() {
    const container = document.getElementById('timetableContainer');
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const grouped = {};
    daysOrder.forEach(day => grouped[day] = []);
    schedule.forEach(item => {
        if (grouped[item.day]) grouped[item.day].push(item);
    });
    // Sort each day by start time
    for (let day in grouped) {
        grouped[day].sort((a,b) => a.start.localeCompare(b.start));
    }

    let html = '<table><thead><tr><th>Day</th><th>Start</th><th>End</th><th>Subject</th><th>Room</th><th>Actions</th></tr></thead><tbody>';
    
    for (let day of daysOrder) {
        const classes = grouped[day];
        if (classes.length === 0) {
            html += `<tr><td>${day}</td><td colspan="5" style="color:#999;">No classes</td></tr>`;
        } else {
            classes.forEach(cls => {
                html += `<tr>
                    <td>${cls.day}</td>
                    <td>${cls.start}</td>
                    <td>${cls.end}</td>
                    <td>${cls.subject}</td>
                    <td>${cls.room}</td>
                    <td>
                        <button class="action-btn edit-btn" data-id="${cls.id}">✏️</button>
                        <button class="action-btn delete-btn" data-id="${cls.id}">🗑️</button>
                    </td>
                </tr>`;
            });
        }
    }
    html += '</tbody></table>';
    container.innerHTML = html;

    // Attach event listeners to edit/delete buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => openModal(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => deleteClass(e.target.dataset.id));
    });
}

// ---------- CRUD OPERATIONS ----------
function deleteClass(id) {
    if (!confirm('Cancel this class? (This action cannot be undone)')) return;
    id = Number(id);
    schedule = schedule.filter(item => item.id !== id);
    saveSchedule();
    renderTimetable();
    findCurrentClass(); // Refresh current class display
}

function saveClass(classData) {
    if (classData.id) {
        // Update existing
        const index = schedule.findIndex(item => item.id === Number(classData.id));
        if (index !== -1) schedule[index] = classData;
    } else {
        // New class
        classData.id = Date.now();
        schedule.push(classData);
    }
    saveSchedule();
    renderTimetable();
    findCurrentClass();
}

// ---------- MODAL HANDLING ----------
const modal = document.getElementById('classModal');
const modalTitle = document.getElementById('modalTitle');
const form = document.getElementById('classForm');
const closeBtn = document.querySelector('.close');
const cancelBtn = document.getElementById('cancelModalBtn');
const addBtn = document.getElementById('addClassBtn');

function openModal(id = null) {
    if (id) {
        const cls = schedule.find(item => item.id === Number(id));
        if (cls) {
            modalTitle.textContent = 'Edit Class';
            document.getElementById('classId').value = cls.id;
            document.getElementById('classDay').value = cls.day;
            document.getElementById('startTime').value = cls.start;
            document.getElementById('endTime').value = cls.end;
            document.getElementById('subject').value = cls.subject;
            document.getElementById('room').value = cls.room;
        }
    } else {
        modalTitle.textContent = 'Add New Class';
        form.reset();
        document.getElementById('classId').value = '';
    }
    modal.style.display = 'block';
}

function closeModal() {
    modal.style.display = 'none';
}

addBtn.addEventListener('click', () => openModal());
closeBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
window.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const classData = {
        id: document.getElementById('classId').value,
        day: document.getElementById('classDay').value,
        start: document.getElementById('startTime').value,
        end: document.getElementById('endTime').value,
        subject: document.getElementById('subject').value,
        room: document.getElementById('room').value
    };
    if (classData.start >= classData.end) {
        alert('End time must be after start time.');
        return;
    }
    saveClass(classData);
    closeModal();
});

// ---------- INITIALIZATION ----------
function init() {
    loadSchedule();
    renderTimetable();
    findCurrentClass();
    updateLiveDateTime();
    setInterval(() => {
        updateLiveDateTime();
        findCurrentClass(); // Re-evaluate current class every minute
    }, 60000);
}

init();