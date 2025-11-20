import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import {
  getDatabase,
  ref,
  set,
  onValue,
  remove,
  push,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAWzacAewH_nRxNJRqnrORF9vPhzaLjn-Q',
  authDomain: 'meeting-calendar-20eb2.firebaseapp.com',
  databaseURL: 'https://meeting-calendar-20eb2-default-rtdb.firebaseio.com',
  projectId: 'meeting-calendar-20eb2',
  storageBucket: 'meeting-calendar-20eb2.firebasestorage.app',
  messagingSenderId: '43144949492',
  appId: '1:43144949492:web:afd82bd90b4ae3e637f8a1',
  measurementId: 'G-V5LDJRR90J',
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

let meetings = [];
let currentWeekOffset = 0;
let selectedTime = null;
let currentUser = null;

const timeSlots = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
];

// Wait for page load
window.addEventListener('DOMContentLoaded', () => {
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    updateUIForAuth(user);
  });

  function updateUIForAuth(user) {
    const userInfo = document.getElementById('userInfo');
    const authNotice = document.getElementById('authNotice');
    const addMeetingBtn = document.getElementById('addMeetingBtn');

    if (user) {
      userInfo.innerHTML = `
                    <span>👤 ${user.email}</span>
                    <button class="logout-btn" onclick="logout()">Выйти</button>
                `;
      authNotice.style.display = 'none';
      addMeetingBtn.disabled = false;
    } else {
      userInfo.innerHTML = `
                    <button class="login-header-btn" onclick="showLoginModal()">🔐 Войти</button>
                `;
      authNotice.style.display = 'block';
      addMeetingBtn.disabled = true;
    }
  }

  window.showLoginModal = function () {
    const modal = document.getElementById('loginModal');
    modal.classList.add('show');
    modal.style.display = 'flex';
  };

  window.closeLoginModal = function () {
    const modal = document.getElementById('loginModal');
    modal.classList.remove('show');
    modal.style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
  };

  window.login = async function (event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorMessage = document.getElementById('errorMessage');

    try {
      await signInWithEmailAndPassword(auth, email, password);
      errorMessage.style.display = 'none';
      closeLoginModal();
      alert('✅ Вход выполнен успешно!');
    } catch (error) {
      errorMessage.style.display = 'block';
      errorMessage.textContent =
        'Ошибка входа: ' +
        (error.code === 'auth/invalid-credential'
          ? 'Неверный email или пароль'
          : error.message);
    }
  };

  window.logout = async function () {
    try {
      await signOut(auth);
      alert('✅ Вы вышли из системы');
    } catch (error) {
      alert('Ошибка выхода: ' + error.message);
    }
  };

  function loadMeetings() {
    const meetingsRef = ref(database, 'meetings');
    onValue(meetingsRef, (snapshot) => {
      meetings = [];
      const data = snapshot.val();
      if (data) {
        Object.keys(data).forEach((key) => {
          meetings.push({
            id: key,
            ...data[key],
          });
        });
      }
      updateCalendar();
      updateTimeSlots();
      updateStats();
    });
  }

  window.addMeeting = function () {
    if (!currentUser) {
      showLoginModal();
      return;
    }

    const date = document.getElementById('meetingDate').value;
    const company = document.getElementById('companyName').value;
    const contact = document.getElementById('contactPerson').value;
    const phone = document.getElementById('phone').value;
    const address = document.getElementById('address').value;
    const comment = document.getElementById('comment').value;

    if (!date || !selectedTime || !company) {
      alert('Заполните обязательные поля: дата, время и название компании');
      return;
    }

    const meetingsRef = ref(database, 'meetings');
    const newMeetingRef = push(meetingsRef);

    const meeting = {
      date,
      time: selectedTime,
      company,
      contact,
      phone,
      address,
      comment,
      createdAt: Date.now(),
      createdBy: currentUser.email,
    };

    set(newMeetingRef, meeting)
      .then(() => {
        document.getElementById('companyName').value = '';
        document.getElementById('contactPerson').value = '';
        document.getElementById('phone').value = '';
        document.getElementById('address').value = '';
        document.getElementById('comment').value = '';
        selectedTime = null;

        document.querySelectorAll('.time-slot').forEach((el) => {
          el.classList.remove('selected');
        });

        alert('✅ Встреча успешно добавлена!');
      })
      .catch((error) => {
        alert('Ошибка при добавлении встречи: ' + error.message);
      });
  };

  window.deleteMeeting = function (id) {
    if (!currentUser) {
      alert('⚠️ Для удаления встреч необходимо войти в систему');
      showLoginModal();
      return;
    }

    if (confirm('Удалить эту встречу?')) {
      const meetingRef = ref(database, 'meetings/' + id);
      remove(meetingRef).catch((error) => {
        alert('Ошибка при удалении: ' + error.message);
      });
    }
  };

  function initTimeGrid() {
    const grid = document.getElementById('timeGrid');
    grid.innerHTML = '';
    timeSlots.forEach((time) => {
      const slot = document.createElement('div');
      slot.className = 'time-slot';
      slot.textContent = time;
      slot.onclick = () => selectTime(time, slot);
      grid.appendChild(slot);
    });
  }

  function selectTime(time, element) {
    if (element.classList.contains('occupied')) return;

    document.querySelectorAll('.time-slot').forEach((el) => {
      el.classList.remove('selected');
    });
    element.classList.add('selected');
    selectedTime = time;
  }

  function updateTimeSlots() {
    const dateInput = document.getElementById('meetingDate');
    const selectedDate = dateInput.value;

    if (!selectedDate) return;

    const occupiedTimes = meetings
      .filter((m) => m.date === selectedDate)
      .map((m) => m.time);

    document.querySelectorAll('.time-slot').forEach((slot) => {
      const time = slot.textContent;
      slot.classList.remove('occupied', 'selected');
      if (occupiedTimes.includes(time)) {
        slot.classList.add('occupied');
      }
    });

    selectedTime = null;
  }

  function getWeekDates(offset) {
    const today = new Date();
    today.setDate(today.getDate() + offset * 7);
    const firstDay = new Date(today);
    const day = firstDay.getDay();
    const diff = firstDay.getDate() - day + (day === 0 ? -6 : 1);
    firstDay.setDate(diff);

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(firstDay);
      date.setDate(firstDay.getDate() + i);
      dates.push(date);
    }
    return dates;
  }

  function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function formatDisplayDate(date) {
    const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const months = [
      'янв',
      'фев',
      'мар',
      'апр',
      'мая',
      'июн',
      'июл',
      'авг',
      'сен',
      'окт',
      'ноя',
      'дек',
    ];
    return `${days[date.getDay()]}, ${date.getDate()} ${
      months[date.getMonth()]
    }`;
  }

  function updateCalendar() {
    const dates = getWeekDates(currentWeekOffset);
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    const firstDate = dates[0];
    const lastDate = dates[6];
    document.getElementById(
      'currentWeek'
    ).textContent = `${firstDate.getDate()} ${
      [
        'янв',
        'фев',
        'мар',
        'апр',
        'мая',
        'июн',
        'июл',
        'авг',
        'сен',
        'окт',
        'ноя',
        'дек',
      ][firstDate.getMonth()]
    } - ${lastDate.getDate()} ${
      [
        'янв',
        'фев',
        'мар',
        'апр',
        'мая',
        'июн',
        'июл',
        'авг',
        'сен',
        'окт',
        'ноя',
        'дек',
      ][lastDate.getMonth()]
    } ${lastDate.getFullYear()}`;

    dates.forEach((date) => {
      const dateStr = formatDate(date);
      const dayMeetings = meetings
        .filter((m) => m.date === dateStr)
        .sort((a, b) => a.time.localeCompare(b.time));

      const card = document.createElement('div');
      card.className = 'day-card';

      const today = formatDate(new Date());
      const isToday = dateStr === today;

      card.innerHTML = `
                    <div class="day-header">
                        <div class="day-name" style="${
                          isToday ? 'color: #ef5350;' : ''
                        }">${formatDisplayDate(date)} ${
        isToday ? '(Сегодня)' : ''
      }</div>
                        <div class="day-date">${dayMeetings.length} встреч</div>
                    </div>
                    <div class="meetings-list">
                        ${
                          dayMeetings.length > 0
                            ? dayMeetings
                                .map(
                                  (m) => `
                                <div class="meeting-card">
                                    <div class="meeting-time">⏰ ${m.time}</div>
                                    <div class="meeting-company">🏢 ${
                                      m.company
                                    }</div>
                                    ${
                                      m.contact
                                        ? `<div class="meeting-contact">👤 ${m.contact}</div>`
                                        : ''
                                    }
                                    ${
                                      m.phone
                                        ? `<div class="meeting-contact">📞 ${m.phone}</div>`
                                        : ''
                                    }
                                    ${
                                      m.address
                                        ? `<div class="meeting-contact">📍 ${m.address}</div>`
                                        : ''
                                    }
                                    ${
                                      m.comment
                                        ? `<div class="meeting-contact">💬 ${m.comment}</div>`
                                        : ''
                                    }
                                    <div class="meeting-actions">
                                        <button class="delete-btn" onclick="deleteMeeting('${
                                          m.id
                                        }')" ${
                                    !currentUser ? 'disabled' : ''
                                  }>🗑️ Удалить</button>
                                    </div>
                                </div>
                            `
                                )
                                .join('')
                            : '<div class="no-meetings">Встреч нет</div>'
                        }
                    </div>
                `;

      grid.appendChild(card);
    });
  }

  window.changeWeek = function (offset) {
    if (offset === 0) {
      currentWeekOffset = 0;
    } else {
      currentWeekOffset += offset;
    }
    updateCalendar();
  };

  function updateStats() {
    const today = formatDate(new Date());
    const todayMeetings = meetings.filter((m) => m.date === today).length;

    const weekDates = getWeekDates(0).map((d) => formatDate(d));
    const weekMeetings = meetings.filter((m) =>
      weekDates.includes(m.date)
    ).length;

    document.getElementById('todayCount').textContent = todayMeetings;
    document.getElementById('weekCount').textContent = weekMeetings;
    document.getElementById('totalCount').textContent = meetings.length;
  }

  document
    .getElementById('meetingDate')
    .addEventListener('change', updateTimeSlots);

  const today = new Date();
  document.getElementById('meetingDate').value = formatDate(today);
  document.getElementById('meetingDate').min = formatDate(today);

  initTimeGrid();
  loadMeetings();
});
