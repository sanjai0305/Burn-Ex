/**
 * Burn-Ex Frontend Controller & State Machine
 * Handles SPA navigation, live telemetry polling, Chart.js visualizations,
 * and user profile calibration.
 */

// Global State Variables
let currentView = 'studio';
let telemetryInterval = null;
let complianceChart = null;
let historyChart = null;
let isWorkoutPaused = false;

// Exercise MET mapping
const EXERCISE_METS = {
  pushup: '8.0 MET',
  squat: '6.5 MET',
  jumping_jack: '8.0 MET'
};

const EXERCISE_MIN_ROMS = {
  pushup: 45.0,
  squat: 50.0,
  jumping_jack: 60.0
};

// ==========================================
// 1. Navigation & View Controller
// ==========================================

function switchView(viewName) {
  currentView = viewName;

  // Update Nav Buttons
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  if (viewName === 'studio') document.getElementById('navBtnStudio')?.classList.add('active');
  if (viewName === 'dashboard') document.getElementById('navBtnDashboard')?.classList.add('active');
  if (viewName === 'onboarding') document.getElementById('navBtnOnboarding')?.classList.add('active');

  // Switch View Panels
  document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
  const targetSection = document.getElementById(`view-${viewName}`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Lifecycle Hooks
  if (viewName === 'studio') {
    startTelemetryPolling();
  } else if (viewName === 'dashboard') {
    fetchDashboardHistory();
  } else if (viewName === 'onboarding') {
    loadProfileData();
  }
}

function selectGoal(element, goalValue) {
  document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('active'));
  element.classList.add('active');
  const hiddenInput = document.getElementById('profileGoal');
  if (hiddenInput) hiddenInput.value = goalValue;
}

// ==========================================
// 2. Profile Onboarding Management
// ==========================================

async function loadProfileData() {
  try {
    const res = await fetch('/api/profile');
    const data = await res.json();
    if (data.status === 'success' && data.profile) {
      const p = data.profile;
      document.getElementById('profileName').value = p.name || 'Athlete';
      document.getElementById('profileWeight').value = p.weight_kg || 70.0;
      document.getElementById('profileHeight').value = p.height_cm || 175.0;
      document.getElementById('profileAge').value = p.age || 25;
      document.getElementById('profileGender').value = p.gender || 'male';

      const goal = p.fitness_goal || 'fat_loss';
      document.getElementById('profileGoal').value = goal;
      document.querySelectorAll('.goal-card').forEach(card => {
        if (card.getAttribute('onclick')?.includes(goal)) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      });
    }
  } catch (err) {
    console.error('Error loading profile:', err);
  }
}

async function handleSaveProfile(e) {
  e.preventDefault();
  const profilePayload = {
    name: document.getElementById('profileName').value,
    weight_kg: parseFloat(document.getElementById('profileWeight').value) || 70.0,
    height_cm: parseFloat(document.getElementById('profileHeight').value) || 175.0,
    age: parseInt(document.getElementById('profileAge').value) || 25,
    gender: document.getElementById('profileGender').value,
    fitness_goal: document.getElementById('profileGoal').value,
  };

  try {
    const res = await fetch('/api/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profilePayload),
    });
    const result = await res.json();
    if (result.status === 'success') {
      showToast('Athlete profile calibrated successfully!', 'success');
      switchView('studio');
      handleChangeExercise(document.getElementById('exerciseSelect').value);
    }
  } catch (err) {
    showToast('Failed to save profile', 'error');
  }
}

// ==========================================
// 3. Live Workout Studio Telemetry
// ==========================================

function startTelemetryPolling() {
  if (telemetryInterval) clearInterval(telemetryInterval);
  telemetryInterval = setInterval(fetchTelemetryUpdate, 100);
}

async function fetchTelemetryUpdate() {
  if (currentView !== 'studio') return;

  try {
    const res = await fetch('/api/telemetry');
    if (!res.ok) return;
    const data = await res.json();

    // 1. Repetitions Counter
    document.getElementById('repCountGiant').textContent = data.total_reps;
    document.getElementById('validRepsPill').textContent = `${data.valid_reps} Valid`;
    document.getElementById('invalidRepsPill').textContent = `${data.invalid_reps} Rejected`;

    const statePill = document.getElementById('statePill');
    statePill.textContent = `STATE: ${data.current_state}`;
    if (data.current_state === 'DOWN') {
      statePill.className = 'state-pill down';
    } else {
      statePill.className = 'state-pill';
    }

    // 2. Form Score Gauge
    const score = Math.round(data.form_score_pct);
    document.getElementById('formScoreText').textContent = `${score}%`;
    const circle = document.getElementById('gaugeCircle');
    if (circle) {
      // Circumference = 2 * PI * 36 ≈ 226.2
      const offset = 226.2 - (226.2 * (score / 100));
      circle.style.strokeDashoffset = offset;
      if (score >= 75) {
        circle.style.stroke = 'var(--neon-green)';
      } else if (score >= 50) {
        circle.style.stroke = 'var(--amber-gold)';
      } else {
        circle.style.stroke = 'var(--crimson-red)';
      }
    }

    // 3. Joint Angle & ROM Meters
    document.getElementById('jointAngleText').textContent = `${data.current_angle}°`;
    const anglePercent = Math.min(100, Math.max(0, (data.current_angle / 180.0) * 100));
    document.getElementById('jointAngleBar').style.width = `${anglePercent}%`;

    document.getElementById('avgRomText').textContent = `${data.avg_rom}°`;
    const romPercent = Math.min(100, Math.max(0, (data.avg_rom / 120.0) * 100));
    document.getElementById('avgRomBar').style.width = `${romPercent}%`;

    const torsoIncl = data.torso_inclination_angle || 0.0;
    document.getElementById('torsoInclinationText').textContent = `${torsoIncl.toFixed(1)}°`;
    const torsoPercent = Math.min(100, Math.max(0, (torsoIncl / 90.0) * 100));
    document.getElementById('torsoInclinationBar').style.width = `${torsoPercent}%`;

    // 4. Energy Burn Rate & Intensity
    document.getElementById('burnRateText').textContent = data.burn_rate_kcal_min.toFixed(2);
    const intensityBadge = document.getElementById('intensityBadge');
    intensityBadge.textContent = data.intensity;
    intensityBadge.className = `intensity-badge ${data.intensity.toLowerCase()}`;

    const velocity = data.current_angular_velocity || 0.0;
    const peakVelocity = data.peak_angular_velocity || 0.0;
    document.getElementById('jointVelocityText').textContent = `${velocity.toFixed(0)}°/s (Peak: ${peakVelocity.toFixed(0)}°/s)`;
    const velocityPercent = Math.min(100, Math.max(0, (velocity / 300.0) * 100));
    document.getElementById('jointVelocityBar').style.width = `${velocityPercent}%`;

    // 5. Session Timer
    const duration = data.duration_sec;
    const mins = Math.floor(duration / 60).toString().padStart(2, '0');
    const secs = Math.floor(duration % 60).toString().padStart(2, '0');
    document.getElementById('sessionTimerText').textContent = `${mins}:${secs}`;

    // 6. FPS
    document.getElementById('fpsTelemetry').textContent = `FPS: ${data.fps}`;

    // 7. Form Alert Banner
    const banner = document.getElementById('formAlertBanner');
    const bannerIcon = document.getElementById('bannerIcon');
    const bannerText = document.getElementById('bannerText');

    if (data.target_lost) {
      banner.className = 'form-alert-banner warning';
      bannerIcon.textContent = '⚠️';
      bannerText.textContent = 'TARGET LOST - TRACKING PAUSED';
    } else if (!data.is_form_valid && data.form_error) {
      banner.className = 'form-alert-banner error';
      bannerIcon.textContent = '⚠️';
      bannerText.textContent = `WARNING: ${data.form_error}`;
    } else {
      banner.className = 'form-alert-banner';
      bannerIcon.textContent = '✓';
      bannerText.textContent = data.is_active ? 'FORM OPTIMAL' : 'READY TO START';
    }

  } catch (err) {
    // Silently ignore transient network errors
  }
}

// ==========================================
// 4. Workout Action Handlers
// ==========================================

async function handleChangeExercise(exerciseType) {
  try {
    const res = await fetch('/api/workout/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exercise: exerciseType }),
    });
    const data = await res.json();
    if (data.status === 'success') {
      document.getElementById('metValueDisplay').textContent = EXERCISE_METS[exerciseType] || '7.0 MET';
      showToast(`Switched to ${data.exercise.toUpperCase()}`, 'success');
      isWorkoutPaused = false;
      updatePauseButtonUI(false);
    }
  } catch (err) {
    showToast('Failed to change exercise', 'error');
  }
}

async function handleTogglePause() {
  try {
    const res = await fetch('/api/workout/pause', { method: 'POST' });
    const data = await res.json();
    isWorkoutPaused = data.is_paused;
    updatePauseButtonUI(isWorkoutPaused);
    showToast(isWorkoutPaused ? 'Workout Paused' : 'Workout Resumed', 'success');
  } catch (err) {
    showToast('Failed to toggle pause', 'error');
  }
}

async function handleResetWorkout() {
  try {
    const res = await fetch('/api/workout/reset', { method: 'POST' });
    const data = await res.json();
    if (data.status === 'success') {
      isWorkoutPaused = false;
      updatePauseButtonUI(false);
      document.getElementById('repCountGiant').textContent = '0';
      document.getElementById('validRepsPill').textContent = '0 Valid';
      document.getElementById('invalidRepsPill').textContent = '0 Rejected';
      document.getElementById('sessionTimerText').textContent = '00:00';
      document.getElementById('burnRateText').textContent = '0.00';
      document.getElementById('formScoreText').textContent = '100%';
      document.getElementById('statePill').textContent = 'STATE: UP';
      document.getElementById('statePill').className = 'state-pill';
      showToast('Workout set reset!', 'success');
    }
  } catch (err) {
    showToast('Failed to reset workout', 'error');
  }
}

function updatePauseButtonUI(paused) {
  const btn = document.getElementById('btnPauseText');
  if (btn) {
    btn.textContent = paused ? 'Resume' : 'Pause';
  }
}

async function handleEndWorkout() {
  try {
    const res = await fetch('/api/workout/end', { method: 'POST' });
    const data = await res.json();
    if (data.status === 'success') {
      showToast('Workout Completed! Opening Analytics...', 'success');
      switchView('dashboard');
      displaySessionSummary(data.summary);
    }
  } catch (err) {
    showToast('Failed to finalize workout', 'error');
  }
}

function startNewSetFromDashboard() {
  switchView('studio');
  handleChangeExercise(document.getElementById('exerciseSelect').value);
}

// ==========================================
// 5. Analytics Dashboard & Charting
// ==========================================

function displaySessionSummary(summary) {
  if (!summary) return;

  // KPI Row
  document.getElementById('kpiCalories').textContent = `${summary.kcal_lower.toFixed(2)} - ${summary.kcal_upper.toFixed(2)} kcal`;
  document.getElementById('kpiCaloriesRange').textContent = `Point: ~${summary.kcal_point.toFixed(2)} kcal (Confidence Range)`;
  document.getElementById('kpiReps').textContent = `${summary.total_reps} (${summary.valid_reps} Valid)`;
  document.getElementById('kpiFormScore').textContent = `${summary.form_score_pct.toFixed(1)}% Form Compliance`;

  const duration = summary.duration_sec;
  const mins = Math.floor(duration / 60).toString().padStart(2, '0');
  const secs = Math.floor(duration % 60).toString().padStart(2, '0');
  document.getElementById('kpiDuration').textContent = `${mins}:${secs} min`;

  document.getElementById('kpiIntensity').textContent = `${summary.rep_velocity.toFixed(1)} reps/min`;

  // Render Chart A (Repetition ROM Compliance)
  const minRom = EXERCISE_MIN_ROMS[summary.exercise_type] || 45.0;
  renderComplianceChart(summary.rep_rom_history || [], minRom);
}

async function fetchDashboardHistory() {
  try {
    const res = await fetch('/api/history');
    const data = await res.json();
    if (data.status === 'success') {
      const sessions = data.sessions || [];
      populateHistoryTable(sessions);
      renderHistoryChart(sessions);

      // If sessions exist and KPIs are blank, populate with most recent
      if (sessions.length > 0 && document.getElementById('kpiCalories').textContent === '-- kcal') {
        const latest = sessions[0];
        displaySessionSummary({
          exercise_type: latest.exercise_type,
          duration_sec: latest.duration_sec,
          total_reps: latest.total_reps,
          valid_reps: latest.valid_reps,
          form_score_pct: latest.form_score_pct,
          rep_velocity: latest.rep_velocity,
          kcal_lower: latest.kcal_lower,
          kcal_point: latest.kcal_point,
          kcal_upper: latest.kcal_upper,
          rep_rom_history: latest.rep_rom_data,
        });
      }
    }
  } catch (err) {
    console.error('Error fetching history:', err);
  }
}

function renderComplianceChart(repRomData, minRomThreshold) {
  const ctx = document.getElementById('chartCompliance');
  if (!ctx) return;

  if (complianceChart) complianceChart.destroy();

  const labels = repRomData.length > 0 
    ? repRomData.map((_, i) => `Rep ${i + 1}`) 
    : ['No Reps'];

  const dataValues = repRomData.length > 0 ? repRomData : [0];
  const thresholdLine = dataValues.map(() => minRomThreshold);

  complianceChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Repetition ROM (°)',
          data: dataValues,
          borderColor: '#00FF87',
          backgroundColor: 'rgba(0, 255, 135, 0.12)',
          borderWidth: 3,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#00FF87',
          pointRadius: 5,
        },
        {
          label: 'Min ROM Target (°)',
          data: thresholdLine,
          borderColor: '#FFB800',
          borderDash: [6, 6],
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } } },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', font: { family: 'Space Grotesk' } }
        },
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', font: { family: 'Space Grotesk' } },
          suggestedMin: 0,
          suggestedMax: 120,
        }
      }
    }
  });
}

function renderHistoryChart(sessions) {
  const ctx = document.getElementById('chartHistory');
  if (!ctx) return;

  if (historyChart) historyChart.destroy();

  // Reverse to chronological order (oldest to newest, max 10)
  const recent = [...sessions].reverse().slice(-10);
  const labels = recent.map((s, i) => `S${i + 1} (${s.exercise_type.slice(0, 4).toUpperCase()})`);
  const calories = recent.map(s => s.kcal_point);
  const formScores = recent.map(s => s.form_score_pct);

  historyChart = new Chart(ctx, {
    data: {
      labels: labels.length > 0 ? labels : ['No Data'],
      datasets: [
        {
          type: 'bar',
          label: 'Calories (kcal)',
          data: calories.length > 0 ? calories : [0],
          backgroundColor: 'rgba(0, 242, 254, 0.4)',
          borderColor: '#00F2FE',
          borderWidth: 2,
          borderRadius: 6,
          yAxisID: 'yKcal',
        },
        {
          type: 'line',
          label: 'Form Score (%)',
          data: formScores.length > 0 ? formScores : [0],
          borderColor: '#00FF87',
          borderWidth: 2,
          pointBackgroundColor: '#00FF87',
          yAxisID: 'yScore',
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94A3B8', font: { family: 'Inter', size: 11 } } },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#64748B', font: { family: 'Space Grotesk' } }
        },
        yKcal: {
          type: 'linear',
          position: 'left',
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#00F2FE', font: { family: 'Space Grotesk' } },
          title: { display: true, text: 'kcal', color: '#00F2FE' }
        },
        yScore: {
          type: 'linear',
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#00FF87', font: { family: 'Space Grotesk' } },
          min: 0,
          max: 100,
          title: { display: true, text: 'Form %', color: '#00FF87' }
        }
      }
    }
  });
}

function populateHistoryTable(sessions) {
  const tbody = document.getElementById('historyTableBody');
  if (!tbody) return;

  if (!sessions || sessions.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No workout sessions recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = sessions.map(s => {
    const mins = Math.floor(s.duration_sec / 60).toString().padStart(2, '0');
    const secs = Math.floor(s.duration_sec % 60).toString().padStart(2, '0');
    const scoreColor = s.form_score_pct >= 75 ? 'green' : (s.form_score_pct >= 50 ? 'amber' : 'red');

    return `
      <tr>
        <td style="font-family: var(--font-code); font-size: 0.8rem; color: var(--text-muted);">${s.timestamp}</td>
        <td><span class="badge-tag cyan">${s.exercise_name || s.exercise_type}</span></td>
        <td style="font-family: var(--font-code);">${mins}:${secs}</td>
        <td><strong>${s.valid_reps}</strong> / ${s.total_reps}</td>
        <td>${s.avg_rom_deg}°</td>
        <td><span class="badge-tag ${scoreColor}">${s.form_score_pct}%</span></td>
        <td style="color: var(--neon-green); font-weight: 700;">${s.kcal_lower} - ${s.kcal_upper} kcal</td>
      </tr>
    `;
  }).join('');
}

function exportData(format) {
  window.open(`/api/export?format=${format}`, '_blank');
}

// Toast Notification Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠️'}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

async function loadAvailableCameras() {
  try {
    const res = await fetch('/api/cameras');
    const data = await res.json();
    if (data.status === 'success') {
      const select = document.getElementById('cameraSelect');
      if (select) {
        select.innerHTML = data.cameras.map(idx => {
          let label = `Camera ${idx}`;
          if (idx === 0) label += " (Integrated)";
          else if (idx === 1) label += " (External/Virtual)";
          else label += " (External)";
          return `<option value="${idx}" ${idx === data.current ? 'selected' : ''}>${label}</option>`;
        }).join('');
      }
    }
  } catch (err) {
    console.error('Error loading cameras:', err);
  }
}

async function handleChangeCamera(cameraIndex) {
  try {
    const res = await fetch('/api/cameras/select', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: parseInt(cameraIndex) })
    });
    const data = await res.json();
    if (data.status === 'success') {
      showToast(`Switched to Camera ${data.selected}`, 'success');
    }
  } catch (err) {
    showToast('Failed to change camera', 'error');
  }
}

// Initializer
document.addEventListener('DOMContentLoaded', () => {
  loadProfileData();
  loadAvailableCameras();
  switchView('studio');
});
