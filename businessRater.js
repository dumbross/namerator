// Main application logic for GitHub-hosted version

// Configuration for GitHub data storage
const config = {
    // Replace with your own GitHub username and repository
    owner: 'dumbross',
    repo: 'namerator-data',
    path: 'names.json',
    // Generate a personal access token with repo scope at https://github.com/settings/tokens
    // NOTE: In a production app, you'd want to handle authentication more securely
    token: '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' 
};

// Store business names in memory (loaded from GitHub)
let businesses = [];

// Generate a user ID if one doesn't exist
function getUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = 'user_' + Date.now();
        localStorage.setItem('userId', userId);
    }
    return userId;
}

// The current user ID
const currentUserId = getUserId();

// Function to fetch data from GitHub
async function fetchDataFromGitHub() {
    try {
        // Show loading state
        document.getElementById('business-list').innerHTML = '<p>Loading submissions...</p>';
        
        const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`, {
            headers: config.token ? {
                'Authorization': `token ${config.token}`
            } : {}
        });
        
        if (!response.ok) {
            // If file doesn't exist yet, start with empty array
            if (response.status === 404) {
                return [];
            }
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const data = await response.json();
        // Decode content from Base64
        const content = atob(data.content);
        // Parse JSON content
        businesses = JSON.parse(content);
        // Store the SHA for later updates
        localStorage.setItem('dataSHA', data.sha);
        
        return businesses;
    } catch (error) {
        console.error('Error fetching data:', error);
        // If there's an error, use cached data if available
        const cachedData = localStorage.getItem('cachedBusinesses');
        if (cachedData) {
            businesses = JSON.parse(cachedData);
            showNotification('Using cached data. Could not connect to GitHub.');
            return businesses;
        }
        showNotification('Error loading data. Please try again later.');
        return [];
    }
}

// Function to save data to GitHub
async function saveDataToGitHub() {
    try {
        // Cache data locally in case GitHub is unavailable
        localStorage.setItem('cachedBusinesses', JSON.stringify(businesses));
        
        // Get current SHA (needed for updates)
        const sha = localStorage.getItem('dataSHA');
        
        // Prepare the request data
        const content = btoa(JSON.stringify(businesses, null, 2)); // Base64 encode
        const requestData = {
            message: 'Update business data',
            content,
            sha: sha || undefined // Include SHA if we have it
        };
        
        // Send request to GitHub API
        const response = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.path}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `token ${config.token}`
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const data = await response.json();
        // Update the SHA for next time
        localStorage.setItem('dataSHA', data.content.sha);
        
        return true;
    } catch (error) {
        console.error('Error saving data:', error);
        showNotification('Could not save to GitHub. Data stored locally for now.');
        return false;
    }
}

// Show a notification to the user
function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove after 5 seconds
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

// Toggle admin panel
function setupAdminPanel() {
    const adminToggle = document.getElementById('admin-toggle');
    const adminPanel = document.getElementById('admin-panel');
    
    adminToggle.addEventListener('click', function() {
        adminPanel.classList.toggle('active');
        updateStorageInfo();
    });
    
    // Close admin panel when clicking outside of it
    document.addEventListener('click', function(event) {
        if (!adminPanel.contains(event.target) && !adminToggle.contains(event.target)) {
            adminPanel.classList.remove('active');
        }
    });
}

// Update storage usage info
function updateStorageInfo() {
    const storageUsage = document.getElementById('storage-usage');
    const businessesSize = JSON.stringify(businesses).length;
    
    storageUsage.textContent = `Current usage: ${formatBytes(businessesSize)} / Shared GitHub Repository`;
}

// Format bytes to readable size
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Update the UI with businesses
function renderBusinesses() {
    const businessList = document.getElementById('business-list');
    const emptyState = document.getElementById('empty-state');
    
    if (businesses.length === 0) {
        emptyState.style.display = 'block';
        businessList.innerHTML = '';
        return;
    }
    
    emptyState.style.display = 'none';
    businessList.innerHTML = '';
    
    businesses.forEach((business, index) => {
        const li = document.createElement('li');
        li.className = 'business-item';
        
        // Calculate average rating
        let totalRating = 0;
        let ratingCount = 0;
        
        if (business.ratings) {
            Object.values(business.ratings).forEach(rating => {
                totalRating += parseInt(rating);
                ratingCount++;
            });
        }
        
        const avgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : 'Not rated';
        
        // Create category class
        const categoryClass = business.category === 'punny' ? 'category-punny' : 
                            business.category === 'serious' ? 'category-serious' : '';
        
        // Check if current user is the author
        const isAuthor = business.authorId === currentUserId;
        
        // Create the delete button if user is the author
        const deleteButton = isAuthor ? 
            `<button class="delete-btn" data-index="${index}">Delete</button>` : '';
        
        // Add "You" tag if user is the author
        const authorTag = isAuthor ? 
            `<span class="author-tag">(Posted by you)</span>` : '';
        
        li.innerHTML = `
            <div class="business-header">
                <div class="business-info">
                    <span class="business-name">${business.name}</span>
                    ${authorTag}
                    <span class="business-category ${categoryClass}">${business.category}</span>
                </div>
                ${deleteButton}
            </div>
            <div class="rating-container">
                <div class="emotes" data-index="${index}">
                    <span class="emote" data-rating="1">😠</span>
                    <span class="emote" data-rating="2">🙁</span>
                    <span class="emote" data-rating="3">😐</span>
                    <span class="emote" data-rating="4">🙂</span>
                    <span class="emote" data-rating="5">😄</span>
                </div>
                <div class="stats">
                    <span>${ratingCount} ratings | Average: ${avgRating}</span>
                </div>
            </div>
        `;
        
        // Highlight previously selected emote if any
        const userRating = business.ratings && business.ratings[currentUserId];
        if (userRating) {
            const emoteElements = li.querySelectorAll('.emote');
            emoteElements[userRating - 1].classList.add('selected');
        }
        
        businessList.appendChild(li);
    });
    
    // Add event listeners to emotes
    document.querySelectorAll('.emotes').forEach(emoteContainer => {
        emoteContainer.addEventListener('click', handleRating);
    });
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', handleDelete);
    });
    
    // Update storage info
    updateStorageInfo();
}

// Handle emote rating
async function handleRating(event) {
    if (!event.target.classList.contains('emote')) return;
    
    const rating = parseInt(event.target.dataset.rating);
    const businessIndex = parseInt(event.currentTarget.dataset.index);
    
    // Initialize ratings object if it doesn't exist
    if (!businesses[businessIndex].ratings) {
        businesses[businessIndex].ratings = {};
    }
    
    // Check if user has already rated this with the same rating
    const currentRating = businesses[businessIndex].ratings[currentUserId];
    
    if (currentRating === rating) {
        // User clicked the same emote again, remove the rating
        delete businesses[businessIndex].ratings[currentUserId];
    } else {
        // User clicked a different emote, update the rating
        businesses[businessIndex].ratings[currentUserId] = rating;
    }
    
    // Save to GitHub
    await saveDataToGitHub();
    
    // Update UI
    renderBusinesses();
}

// Handle delete button click
async function handleDelete(event) {
    const businessIndex = parseInt(event.target.dataset.index);
    const business = businesses[businessIndex];
    
    // Only allow deletion if current user is the author
    if (business.authorId !== currentUserId) {
        return;
    }
    
    // Confirm deletion
    if (confirm(`Are you sure you want to delete "${business.name}"?`)) {
        // Remove the business from the array
        businesses.splice(businessIndex, 1);
        
        // Save to GitHub
        await saveDataToGitHub();
        
        // Update UI
        renderBusinesses();
    }
}

// Handle form submission
function setupFormSubmission() {
    const businessForm = document.getElementById('business-form');
    const businessNameInput = document.getElementById('business-name');
    
    businessForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const name = businessNameInput.value.trim();
        const categoryEl = document.querySelector('input[name="category"]:checked');
        
        if (!name || !categoryEl) return;
        
        const category = categoryEl.value;
        
        // Add new business with author ID
        businesses.push({
            name,
            category,
            authorId: currentUserId,
            timestamp: new Date().toISOString(),
            ratings: {}
        });
        
        // Save to GitHub
        await saveDataToGitHub();
        
        // Reset form
        businessForm.reset();
        
        // Update UI
        renderBusinesses();
    });
}

// Handle clear all data
function setupDataManagement() {
    const clearDataBtn = document.getElementById('clear-data-btn');
    const fixLegacyDataBtn = document.getElementById('fix-legacy-data-btn');
    const refreshDataBtn = document.getElementById('refresh-data-btn');
    
    clearDataBtn.addEventListener('click', async function() {
        if (confirm('Are you sure you want to delete ALL business names? This cannot be undone.')) {
            // Clear businesses array
            businesses = [];
            
            // Save to GitHub
            await saveDataToGitHub();
            
            // Update UI
            renderBusinesses();
        }
    });
    
    // Handle fix legacy data
    fixLegacyDataBtn.addEventListener('click', async function() {
        let fixedCount = 0;
        
        // Check each business for missing authorId
        businesses.forEach(business => {
            if (!business.authorId) {
                business.authorId = currentUserId;
                fixedCount++;
            }
            
            // Make sure ratings exists
            if (!business.ratings) {
                business.ratings = {};
            }
            
            // Make sure timestamp exists
            if (!business.timestamp) {
                business.timestamp = new Date().toISOString();
                fixedCount++;
            }
        });
        
        // Save to GitHub
        await saveDataToGitHub();
        
        // Update UI
        renderBusinesses();
        
        // Show confirmation
        alert(`Fixed ${fixedCount} legacy business entries. You can now delete them if needed.`);
    });
    
    // Handle refresh data
    refreshDataBtn.addEventListener('click', async function() {
        await fetchDataFromGitHub();
        renderBusinesses();
        showNotification('Data refreshed from GitHub');
    });
}

// Pull data periodically to keep up with changes
function setupDataSync() {
    // Fetch data initially
    fetchDataFromGitHub().then(() => {
        renderBusinesses();
    });
    
    // Poll for updates every minute
    setInterval(async () => {
        const newData = await fetchDataFromGitHub();
        
        // Check if data has changed
        if (JSON.stringify(newData) !== JSON.stringify(businesses)) {
            businesses = newData;
            renderBusinesses();
            showNotification('New data available. Refreshed!');
        }
    }, 60000); // Check every minute
}

// Add notification styles
function addNotificationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .notification {
            position: fixed;
            bottom: 20px;
            left: 20px;
            padding: 10px 20px;
            border-radius: 4px;
            color: white;
            z-index: 1000;
            animation: slide-in 0.3s, fade-out 0.3s 4.7s;
        }
        
        @keyframes slide-in {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
        
        @keyframes fade-out {
            from { opacity: 1; }
            to { opacity: 0; }
        }
        
        .success {
            background-color: var(--success);
        }
        
        .error {
            background-color: var(--danger);
        }
    `;
    document.head.appendChild(style);
}

// Update HTML for the admin panel
function updateAdminPanelHTML() {
    const adminPanel = document.getElementById('admin-panel');
    
    // Add refresh button to admin panel
    const adminActions = adminPanel.querySelector('.admin-actions');
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'refresh-data-btn';
    refreshBtn.textContent = 'Refresh Data from GitHub';
    adminActions.appendChild(refreshBtn);
    
    // Update storage info text
    const storageInfo = adminPanel.querySelector('.storage-info p:first-child');
    storageInfo.innerHTML = '<strong>Storage Info:</strong> Data is saved in a GitHub repository.';
}

// Initialize the application
async function initApp() {
    // Update the UI elements for GitHub storage
    updateAdminPanelHTML();
    
    // Add notification styles
    addNotificationStyles();
    
    // Setup UI event listeners
    setupAdminPanel();
    setupFormSubmission();
    setupDataManagement();
    
    // Setup data sync
    setupDataSync();
}

// Call initialization when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);
