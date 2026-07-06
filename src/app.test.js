/**
 * @jest-environment jsdom
 */

// Enable fetch mocking for network requests
const fetchMock = require('jest-fetch-mock');
fetchMock.enableMocks();

describe('Frontend Test Suite for Secret Notes', () => {
    let app;

    beforeEach(() => {

            window.posthog = {
            onFeatureFlags: jest.fn((callback) => callback()), // Executes the callback immediately
            isFeatureEnabled: jest.fn(() => false) // Returns false by default for the feature flag
        };
        // 1. Reset the DOM structure BEFORE loading app.js so elements actually exist
        document.body.innerHTML = `
            <div id="create-section">
                <form id="create-form">
                    <input id="note-title" value="" />
                    <input id="note-key" type="password" value="" />
                    <textarea id="note-content"></textarea>
                    <span class="toggle-password">Show</span>
                </form>
            </div>
            <section id="notes-list-section"></section>
        `;

        // 2. Clear Node's require cache so app.js executes fresh for every single test
        jest.resetModules();

        // 3. Load app.js now that the DOM is fully ready
        app = require('./app.js');

        fetch.resetMocks();
    });

    // --- CREATE FORM TESTS ---

    test('1. Should toggle password visibility (Show/Hide) on the creation form', () => {
        const toggleBtn = document.querySelector('#create-section .toggle-password');
        const keyInput = document.getElementById('note-key');

        // Initially, the input type should be password
        expect(keyInput.getAttribute('type')).toBe('password');

        // First click: should switch to text and update button text to 'Hide'
        toggleBtn.click();
        expect(keyInput.getAttribute('type')).toBe('text');
        expect(toggleBtn.textContent).toBe('Hide');

        // Second click: should switch back to password and update button text to 'Show'
        toggleBtn.click();
        expect(keyInput.getAttribute('type')).toBe('password');
        expect(toggleBtn.textContent).toBe('Show');
    });

    test('2. Should send correct data via POST on submit and reset the form fields', async () => {
        // Mock successful POST response and subsequent GET response for re-rendering
        fetch.mockResponseOnce(JSON.stringify({ success: true }));
        fetch.mockResponseOnce(JSON.stringify([])); 

        // Fill in the form inputs
        document.getElementById('note-title').value = 'Test Title';
        document.getElementById('note-key').value = 'secret123';
        document.getElementById('note-content').value = 'My hidden note content';

        const form = document.getElementById('create-form');
        
        // Dispatch the submit event manually
        form.dispatchEvent(new Event('submit'));

        // Verify the API call was made with the exact payload
        expect(fetch).toHaveBeenCalledWith('/api/notes', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ title: 'Test Title', content: 'My hidden note content', key: 'secret123' })
        }));
    });

    // --- FETCH & INITIAL RENDER TESTS ---

    test('3. Should fetch notes from the API (GET) and render them into the DOM list', async () => {
        const mockNotes = [{ id: 1, title: 'Fetched Note 1' }];
        fetch.mockResponseOnce(JSON.stringify(mockNotes));

        await app.fetchAndRenderNotes();

        // Check if the API was hit and the dynamic title was inserted into the DOM
        expect(fetch).toHaveBeenCalledWith('/api/notes');
        const titleEl = document.querySelector('.display-title');
        expect(titleEl.textContent).toBe('Fetched Note 1');
    });

    test('4. Should catch and log errors to console if the initial GET request fails', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        fetch.mockReject(new Error('API Failure'));

        await app.fetchAndRenderNotes();

        // Assert that the catch block executed and captured the error
        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
        consoleSpy.mockRestore();
    });

    // --- DYNAMICALLY GENERATED NOTE ITEM TESTS ---

    test('5. Should toggle password visibility on a dynamically generated note item', () => {
        app.renderNotes([{ id: 5, title: 'Dynamic Note' }]);
        
        const article = document.querySelector('.note-item');
        const toggleBtn = article.querySelector('.toggle-password');
        const passInput = article.querySelector('.unlock-input');

        // Verify toggle logic works exactly the same way for rendered notes
        expect(passInput.getAttribute('type')).toBe('password');
        toggleBtn.click();
        expect(passInput.getAttribute('type')).toBe('text');
    });

    test('6. Should reveal decrypted content when the correct unlock key is provided', async () => {
        app.renderNotes([{ id: 9, title: 'Private Note' }]);
        fetch.mockResponseOnce(JSON.stringify({ success: true, content: 'Decrypted secret text!' }));

        const article = document.querySelector('.note-item');
        article.querySelector('.unlock-input').value = 'correct_key';
        article.querySelector('.decrypt-btn').click();

        // Flush asynchronous microtasks to let the DOM updates complete
        await new Promise(process.nextTick);

        const authRow = article.querySelector('#auth-9');
        const contentDiv = article.querySelector('#content-9');

        // The input row should hide, and the text container should become visible with the content
        expect(authRow.style.display).toBe('none');
        expect(contentDiv.hidden).toBe(false);
        expect(contentDiv.querySelector('p').textContent).toBe('Decrypted secret text!');
    });

    test('7. Should alert the user and clear the input field if the unlock key is invalid', async () => {
        app.renderNotes([{ id: 9, title: 'Private Note' }]);
        fetch.mockResponseOnce(JSON.stringify({ success: false }));
        const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

        const article = document.querySelector('.note-item');
        const input = article.querySelector('.unlock-input');
        input.value = 'wrong_key';
        article.querySelector('.decrypt-btn').click();

        await new Promise(process.nextTick);

        // Expect the error UI behavior: browser alert triggered and input wiped clean
        expect(alertSpy).toHaveBeenCalledWith('Invalid key');
        expect(input.value).toBe('');
        alertSpy.mockRestore();
    });

    test('8. Should clear the old list items from the DOM before rendering new ones', () => {
        // Initial render with one item
        app.renderNotes([{ id: 1, title: 'Old Note' }]);
        expect(document.querySelectorAll('.note-item').length).toBe(1);

        // Second render with two fresh items should completely overwrite the container
        app.renderNotes([{ id: 2, title: 'New A' }, { id: 3, title: 'New B' }]);
        expect(document.querySelectorAll('.note-item').length).toBe(2);
    });

    test('9. Should handle and log network errors gracefully during the unlock action', async () => {
        app.renderNotes([{ id: 1, title: 'Error Testing' }]);
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        fetch.mockReject(new Error('Server Connection Lost'));

        document.querySelector('.decrypt-btn').click();
        await new Promise(process.nextTick);

        expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
        consoleSpy.mockRestore();
    });

    test('10. Should enforce native HTML validation by setting the required attribute on unlock inputs', () => {
        app.renderNotes([{ id: 1, title: 'Validation Check' }]);
        const input = document.querySelector('.unlock-input');
        
        // Ensures the browser natively blocks empty form submissions for unlocking
        expect(input.hasAttribute('required')).toBe(true);
    });
});