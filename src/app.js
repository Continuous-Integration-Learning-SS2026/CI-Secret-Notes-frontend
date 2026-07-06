posthog.onFeatureFlags(() => {
    if (posthog.isFeatureEnabled('dark-note-theme')) {
        document.querySelector('.primary-btn').classList.add('btn-red');
    }
});

async function fetchAndRenderNotes() {
    try {
        const response = await fetch('/api/notes');
        const data = await response.json();
        renderNotes(data);
    } catch (error) {
        console.error(error);
    }
}

const createForm = document.getElementById('create-form');
const notesListSection = document.getElementById('notes-list-section');
const createKeyToggle = document.querySelector('#create-section .toggle-password');
const createKeyInput = document.getElementById('note-key');

createKeyToggle.addEventListener('click', () => {
    const type = createKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    createKeyInput.setAttribute('type', type);
    createKeyToggle.textContent = type === 'password' ? 'Show' : 'Hide';
});

createForm.addEventListener('submit', async (e) => {
    e.preventDefault(); //prevent page reload

    const title = document.getElementById('note-title').value;
    const key = document.getElementById('note-key').value;
    const content = document.getElementById('note-content').value;

    try {
        await fetch('/api/notes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, key })
        });
        
        createForm.reset();
        createKeyInput.setAttribute('type', 'password');
        createKeyToggle.textContent = 'Show';

        fetchAndRenderNotes();
    } catch (error) {
        console.error(error);
    }
});

function renderNotes(notes) {
    notesListSection.innerHTML = '';

    notes.forEach(note => {
        const article = document.createElement('article');
        article.className = 'note-item';

        // 1. Keep this string 100% static. No variables (${}) allowed here.
        article.innerHTML = `
            <h3 class="display-title"></h3>
            
            <div class="auth-row">
                <div class="password-wrapper">
                    <input type="password" class="unlock-input" placeholder="Enter key..." required>
                    <span class="toggle-password" role="button">Show</span>
                </div>
                <button type="button" class="decrypt-btn">Unlock</button>
            </div>

            <div class="decrypted-content" hidden>
                <p></p>
            </div>
        `;

        // 2. Query elements and assign data safely using built-in DOM properties
        const titleEl = article.querySelector('.display-title');
        const authRow = article.querySelector('.auth-row');
        const contentDiv = article.querySelector('.decrypted-content');
        const toggleBtn = article.querySelector('.toggle-password');
        const passInput = article.querySelector('.unlock-input');
        const unlockBtn = article.querySelector('.decrypt-btn');

        // Safely map values and dynamic structural attributes
        titleEl.textContent = note.title;
        authRow.id = `auth-${note.id}`;
        contentDiv.id = `content-${note.id}`;

        notesListSection.appendChild(article);

        // toggle password
        toggleBtn.addEventListener('click', () => {
            const type = passInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passInput.setAttribute('type', type);
            toggleBtn.textContent = type === 'password' ? 'Show' : 'Hide';
        });

        // decrypt logic
        unlockBtn.addEventListener('click', async () => {
            const enteredKey = passInput.value;
            
            try {
                const response = await fetch('/api/notes/unlock', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: note.id, key: enteredKey })
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    authRow.style.display = 'none';
                    contentDiv.querySelector('p').textContent = data.content;
                    contentDiv.hidden = false;
                } else {
                    alert('Invalid key');
                    passInput.value = ''; 
                }
            } catch (error) {
                console.error(error);
            }
        });
    });
}

fetchAndRenderNotes();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { fetchAndRenderNotes, renderNotes };
}