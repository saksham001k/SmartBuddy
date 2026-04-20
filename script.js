// ---------- DATA & STORAGE ----------
let schedule = [];
const STORAGE_KEY = 'smartbuddy_schedule';
let notificationPermission = false;
let notifiedClasses = new Set();

function loadSchedule() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        schedule = JSON.parse(stored);
    } else {
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
    const el = document.getElementById('liveDateTime');
    if (el) {
        const now = new Date();
        el.textContent = `${getCurrentDay()} ${now.toLocaleDateString()} ${getCurrentTimeString()}`;
    }
}

// ---------- CORE: FIND CURRENT CLASS ----------
function findCurrentClass() {
    const displayDiv = document.getElementById('currentClassDisplay');
    if (!displayDiv) return;

    const today = getCurrentDay();
    const now = getCurrentTimeString();
    
    const current = schedule.find(item => 
        item.day === today && item.start <= now && item.end >= now
    );
    
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
        const upcoming = schedule.filter(item => item.day === today && item.start > now)
                                 .sort((a,b) => a.start.localeCompare(b.start));
        if (upcoming.length > 0) {
            displayDiv.innerHTML = `No class right now. Next: ${upcoming[0].subject} at ${upcoming[0].start}`;
        } else {
            displayDiv.innerHTML = '🎉 No more classes today!';
        }
    }
}

// ---------- NOTIFICATION SYSTEM ----------
function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'granted') {
        notificationPermission = true;
    } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(permission => {
            notificationPermission = (permission === 'granted');
        });
    }
}

function checkUpcomingClasses() {
    if (!notificationPermission) return;
    
    const today = getCurrentDay();
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    schedule.forEach(cls => {
        if (cls.day !== today) return;
        
        const [startH, startM] = cls.start.split(':').map(Number);
        const classStartMinutes = startH * 60 + startM;
        const minutesUntil = classStartMinutes - currentMinutes;
        
        if (minutesUntil === 15) {
            const classKey = `${cls.id}-${today}`;
            if (!notifiedClasses.has(classKey)) {
                showNotification(cls);
                notifiedClasses.add(classKey);
            }
        }
    });
}

function showNotification(cls) {
    if (!notificationPermission) return;
    new Notification(`📚 SmartBuddy Reminder`, {
        body: `${cls.subject} starts in 15 minutes!\nRoom: ${cls.room}\nTime: ${cls.start} - ${cls.end}`,
        icon: 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\'%3E%3Cpath fill=\'%23667eea\' d=\'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13h-1v6l5.25 3.15.75-1.23-4.5-2.67z\'/%3E%3C/svg%3E',
        requireInteraction: false
    });
}

function resetDailyNotifications() {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        notifiedClasses.clear();
    }
}

// ---------- RENDER TIMETABLE (GROUPED BY DAY) ----------
function renderTimetable() {
    const container = document.getElementById('timetableContainer');
    if (!container) return;

    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    // Group and sort
    const grouped = {};
    daysOrder.forEach(day => grouped[day] = []);
    schedule.forEach(item => {
        if (grouped.hasOwnProperty(item.day)) {
            grouped[item.day].push(item);
        }
    });
    for (let day in grouped) {
        grouped[day].sort((a, b) => a.start.localeCompare(b.start));
    }

    let html = '<table><thead><tr><th>Day</th><th>Start</th><th>End</th><th>Subject</th><th>Room</th><th>Actions</th></tr></thead><tbody>';
    
    for (let day of daysOrder) {
        const classes = grouped[day];
        if (classes.length === 0) {
            html += `<tr><td>${day}</td><td colspan="5" style="color:#999; text-align:center;">No classes</td></tr>`;
        } else {
            // First row for this day with rowspan
            html += `<tr>`;
            html += `<td rowspan="${classes.length}" style="vertical-align:middle; font-weight:600;">${day}</td>`;
            // First class details
            const first = classes[0];
            html += `<td>${first.start}</td><td>${first.end}</td><td>${first.subject}</td><td>${first.room}</td>`;
            html += `<td>
                        <button class="action-btn edit-btn" data-id="${first.id}">✏️</button>
                        <button class="action-btn delete-btn" data-id="${first.id}">🗑️</button>
                    </td>`;
            html += `</tr>`;
            
            // Remaining classes for the same day (skip day cell)
            for (let i = 1; i < classes.length; i++) {
                const cls = classes[i];
                html += `<tr>`;
                html += `<td>${cls.start}</td><td>${cls.end}</td><td>${cls.subject}</td><td>${cls.room}</td>`;
                html += `<td>
                            <button class="action-btn edit-btn" data-id="${cls.id}">✏️</button>
                            <button class="action-btn delete-btn" data-id="${cls.id}">🗑️</button>
                        </td>`;
                html += `</tr>`;
            }
        }
    }
    
    html += '</tbody></table>';
    container.innerHTML = html;

    // Attach event listeners
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
    findCurrentClass();
}

function saveClass(classData) {
    if (classData.id) {
        const index = schedule.findIndex(item => item.id === Number(classData.id));
        if (index !== -1) schedule[index] = classData;
    } else {
        classData.id = Date.now();
        schedule.push(classData);
    }
    saveSchedule();
    renderTimetable();
    findCurrentClass();
}

// ---------- CSV IMPORT ----------
function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const newClasses = [];
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    for (let line of lines) {
        if (line.toLowerCase().includes('day') && line.toLowerCase().includes('start')) continue;
        const parts = line.split(',').map(s => s.trim());
        if (parts.length < 5) continue;
        const [day, start, end, subject, room] = parts;
        if (!days.includes(day)) continue;
        if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) continue;
        
        newClasses.push({
            id: Date.now() + Math.floor(Math.random() * 1000),
            day,
            start,
            end,
            subject,
            room
        });
    }
    return newClasses;
}

function importFromCSV(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        const imported = parseCSV(e.target.result);
        if (imported.length === 0) {
            alert('No valid classes found. Format: Day,Start,End,Subject,Room');
            return;
        }
        imported.forEach(newClass => {
            const duplicate = schedule.some(c => 
                c.day === newClass.day && 
                c.start === newClass.start && 
                c.end === newClass.end &&
                c.subject === newClass.subject
            );
            if (!duplicate) schedule.push(newClass);
        });
        saveSchedule();
        renderTimetable();
        findCurrentClass();
        alert(`✅ Imported ${imported.length} classes.`);
    };
    reader.readAsText(file);
}

function setupUpload() {
    const uploadBtn = document.getElementById('uploadBtn');
    const fileInput = document.getElementById('csvFileInput');
    if (uploadBtn && fileInput) {
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) importFromCSV(file);
            fileInput.value = '';
        });
    }
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
    setupUpload();
    requestNotificationPermission();
    
    setInterval(() => {
        updateLiveDateTime();
        findCurrentClass();
        checkUpcomingClasses();
        resetDailyNotifications();
    }, 60000);
    
    setTimeout(checkUpcomingClasses, 1000);
}
// ---------- RESET TO DEMO ----------
function resetToDemo() {
    if (confirm('Reset timetable to demo data? Your current changes will be lost.')) {
        schedule = [
            { id: Date.now() + 1, day: 'Monday', start: '09:00', end: '10:00', subject: 'Software Engg', room: 'LH-12' },
            { id: Date.now() + 2, day: 'Monday', start: '10:00', end: '11:00', subject: 'Mathematics', room: 'AB-01' },
            { id: Date.now() + 3, day: 'Wednesday', start: '14:00', end: '15:30', subject: 'Data Structures', room: 'C-203' },
        ];
        saveSchedule();
        renderTimetable();
        findCurrentClass();
        alert('Demo data loaded.');
    }
}

// In init(), add:
document.getElementById('resetDemoBtn')?.addEventListener('click', resetToDemo);
init();