(function() {
  let isDirty = false;
  let originalValues = {};
  
  function createSaveBar() {
    const bar = document.createElement('div');
    bar.id = 'unsavedBar';
    bar.innerHTML = `
      <div class="unsaved-content">
        <span>You have unsaved changes</span>
        <div class="unsaved-actions">
          <button class="btn btn-secondary" onclick="UnsavedChanges.reset()">Discard</button>
          <button class="btn btn-primary" onclick="UnsavedChanges.save()">Save Changes</button>
        </div>
      </div>
    `;
    document.body.appendChild(bar);
    
    const style = document.createElement('style');
    style.textContent = `
      #unsavedBar {
        position: fixed;
        bottom: -80px;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #2d1f3d 0%, #1a1a2e 100%);
        border-top: 2px solid #9b59b6;
        padding: 16px 24px;
        z-index: 9999;
        transition: bottom 0.3s ease;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.3);
      }
      #unsavedBar.show {
        bottom: 0;
      }
      .unsaved-content {
        max-width: 1200px;
        margin: 0 auto;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-left: 260px;
      }
      .unsaved-content span {
        color: #ffa500;
        font-weight: 600;
        font-size: 14px;
      }
      .unsaved-actions {
        display: flex;
        gap: 12px;
      }
      .unsaved-actions .btn {
        padding: 8px 20px;
        font-size: 13px;
      }
      @media (max-width: 768px) {
        .unsaved-content { padding-left: 20px; flex-direction: column; gap: 12px; }
      }
    `;
    document.head.appendChild(style);
  }
  
  function captureOriginalValues() {
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.id) {
        originalValues[el.id] = el.type === 'checkbox' ? el.checked : el.value;
      }
    });
  }
  
  function checkForChanges() {
    let hasChanges = false;
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.id && originalValues.hasOwnProperty(el.id)) {
        const currentVal = el.type === 'checkbox' ? el.checked : el.value;
        if (currentVal !== originalValues[el.id]) {
          hasChanges = true;
        }
      }
    });
    return hasChanges;
  }
  
  function showBar() {
    const bar = document.getElementById('unsavedBar');
    if (bar) bar.classList.add('show');
  }
  
  function hideBar() {
    const bar = document.getElementById('unsavedBar');
    if (bar) bar.classList.remove('show');
  }
  
  function markDirty() {
    if (checkForChanges()) {
      isDirty = true;
      showBar();
    } else {
      isDirty = false;
      hideBar();
    }
  }
  
  function attachListeners() {
    document.querySelectorAll('input, textarea, select').forEach(el => {
      el.addEventListener('input', markDirty);
      el.addEventListener('change', markDirty);
    });
  }
  
  window.UnsavedChanges = {
    init: function(saveCallback) {
      this.saveCallback = saveCallback;
      createSaveBar();
      setTimeout(() => {
        captureOriginalValues();
        attachListeners();
      }, 500);
    },
    
    markSaved: function() {
      isDirty = false;
      hideBar();
      captureOriginalValues();
    },
    
    markDirty: function() {
      isDirty = true;
      showBar();
    },
    
    reset: function() {
      document.querySelectorAll('input, textarea, select').forEach(el => {
        if (el.id && originalValues.hasOwnProperty(el.id)) {
          if (el.type === 'checkbox') {
            el.checked = originalValues[el.id];
          } else {
            el.value = originalValues[el.id];
          }
        }
      });
      isDirty = false;
      hideBar();
    },
    
    save: async function() {
      if (this.saveCallback) {
        await this.saveCallback();
      }
    },
    
    isDirty: function() {
      return isDirty;
    },
    
    refresh: function() {
      captureOriginalValues();
      attachListeners();
    }
  };
  
  window.addEventListener('beforeunload', function(e) {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return e.returnValue;
    }
  });
})();
