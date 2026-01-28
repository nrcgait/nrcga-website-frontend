// Front Page Loader
// Loads and displays carousel images and breaking news popup from data/front-page.js

let carouselCurrentIndex = 0;
let carouselInterval = null;

function loadCarousel() {
    try {
        // Check if frontPageConfig is available
        if (typeof window.frontPageConfig === 'undefined') {
            console.warn('Front page config not found. Make sure data/front-page.js is loaded before carousel-loader.js');
            return;
        }

        // Get the carousel container
        const container = document.getElementById('nrcga-carousel');
        if (!container) {
            console.warn('Carousel container not found. Make sure #nrcga-carousel exists on the page.');
            return;
        }

        // Get carousel data from config
        const carouselData = window.frontPageConfig.carousel || [];

        // Filter active images and sort by display_order
        const activeImages = carouselData
            .filter(item => item.active !== 0)
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

        if (activeImages.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-secondary);">No carousel images available.</p>';
            return;
        }

        // Generate carousel HTML
        const carouselHTML = generateCarouselHTML(activeImages);
        container.innerHTML = carouselHTML;

        // Initialize carousel functionality
        initializeCarousel(activeImages.length);

    } catch (error) {
        console.error('Error loading carousel:', error);
    }
}

function generateCarouselHTML(images) {
    let trackHTML = '<div style="position: relative; overflow: hidden; border-radius: 12px;">';
    trackHTML += '<div class="carousel-track" style="display: flex; transition: transform 0.5s ease;">';

    images.forEach((image, index) => {
        const imageHTML = `
            <img 
                src="${image.image_url}" 
                alt="${image.alt_text || 'Carousel image'}" 
                style="width: 100%; height: 400px; object-fit: cover; flex-shrink: 0;"
                loading="lazy"
            >
        `;

        if (image.link_url && image.link_url.trim() !== '') {
            trackHTML += `<a href="${image.link_url}" style="display: block; width: 100%;">${imageHTML}</a>`;
        } else {
            trackHTML += imageHTML;
        }
    });

    trackHTML += '</div>';

    // Navigation buttons
    if (images.length > 1) {
        trackHTML += `
            <button class="carousel-prev" onclick="carouselPrev()" 
                style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); 
                background: rgba(255,255,255,0.8); border: none; border-radius: 50%; 
                width: 40px; height: 40px; cursor: pointer; font-size: 1.5rem; z-index: 10;
                transition: background 0.3s ease;"
                onmouseover="this.style.background='rgba(255,255,255,0.95)'"
                onmouseout="this.style.background='rgba(255,255,255,0.8)'"
                aria-label="Previous image">‹</button>
            <button class="carousel-next" onclick="carouselNext()" 
                style="position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); 
                background: rgba(255,255,255,0.8); border: none; border-radius: 50%; 
                width: 40px; height: 40px; cursor: pointer; font-size: 1.5rem; z-index: 10;
                transition: background 0.3s ease;"
                onmouseover="this.style.background='rgba(255,255,255,0.95)'"
                onmouseout="this.style.background='rgba(255,255,255,0.8)'"
                aria-label="Next image">›</button>
        `;

        // Dots navigation
        trackHTML += '<div class="carousel-dots" style="position: absolute; bottom: 1rem; left: 50%; transform: translateX(-50%); display: flex; gap: 0.5rem; z-index: 10;">';
        images.forEach((_, index) => {
            trackHTML += `
                <button onclick="carouselGoTo(${index})" class="carousel-dot" 
                    style="width: 10px; height: 10px; border-radius: 50%; border: none; 
                    background: ${index === 0 ? 'white' : 'rgba(255,255,255,0.5)'}; 
                    cursor: pointer; transition: background 0.3s ease;"
                    aria-label="Go to slide ${index + 1}"></button>
            `;
        });
        trackHTML += '</div>';
    }

    trackHTML += '</div>';
    return trackHTML;
}

function initializeCarousel(imageCount) {
    // Reset current index
    carouselCurrentIndex = 0;

    // Start auto-play if more than one image
    if (imageCount > 1) {
        startCarouselAutoPlay();
    }
}

// Carousel navigation functions (global scope for onclick handlers)
function carouselNext() {
    if (typeof window.frontPageConfig === 'undefined') return;
    const carouselData = window.frontPageConfig.carousel || [];
    const activeImages = carouselData
        .filter(item => item.active !== 0)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    
    if (activeImages.length === 0) return;
    carouselCurrentIndex = (carouselCurrentIndex + 1) % activeImages.length;
    updateCarousel(activeImages.length);
}

function carouselPrev() {
    if (typeof window.frontPageConfig === 'undefined') return;
    const carouselData = window.frontPageConfig.carousel || [];
    const activeImages = carouselData
        .filter(item => item.active !== 0)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    
    if (activeImages.length === 0) return;
    carouselCurrentIndex = (carouselCurrentIndex - 1 + activeImages.length) % activeImages.length;
    updateCarousel(activeImages.length);
}

function carouselGoTo(index) {
    if (typeof window.frontPageConfig === 'undefined') return;
    const carouselData = window.frontPageConfig.carousel || [];
    const activeImages = carouselData
        .filter(item => item.active !== 0)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
    
    if (index < 0 || index >= activeImages.length) return;
    carouselCurrentIndex = index;
    updateCarousel(activeImages.length);
}

function updateCarousel(imageCount) {
    const track = document.querySelector('.carousel-track');
    if (track) {
        track.style.transform = `translateX(-${carouselCurrentIndex * 100}%)`;
    }
    
    document.querySelectorAll('.carousel-dot').forEach((dot, i) => {
        if (dot) {
            dot.style.background = i === carouselCurrentIndex ? 'white' : 'rgba(255,255,255,0.5)';
        }
    });
}

function startCarouselAutoPlay() {
    // Clear existing interval
    if (carouselInterval) {
        clearInterval(carouselInterval);
    }
    
    // Start new interval (5 seconds)
    carouselInterval = setInterval(() => {
        carouselNext();
    }, 5000);
}

function stopCarouselAutoPlay() {
    if (carouselInterval) {
        clearInterval(carouselInterval);
        carouselInterval = null;
    }
}

// Breaking News Popup Loader
function loadBreakingNews() {
    try {
        // Check if frontPageConfig is available
        if (typeof window.frontPageConfig === 'undefined') {
            return;
        }

        const breakingNews = window.frontPageConfig.breakingNews || {};
        
        // Check if breaking news is active
        if (!breakingNews.active) {
            return;
        }

        // Check if user has dismissed this news item
        const storageKey = breakingNews.storage_key || 'nrcga_breaking_news_dismissed';
        if (localStorage.getItem(storageKey) === 'true') {
            return;
        }

        // Get popup elements
        const popup = document.getElementById('breaking-news-popup');
        if (!popup) {
            return;
        }

        // Populate popup content
        const titleEl = document.getElementById('popup-title');
        const contentEl = document.getElementById('popup-content');
        const imageContainer = document.getElementById('popup-image-container');
        const readMoreBtn = document.getElementById('popup-read-more');
        const dontShowCheckbox = document.getElementById('dont-show-again');

        if (titleEl) titleEl.textContent = breakingNews.title || 'Breaking News!';
        if (contentEl) contentEl.textContent = breakingNews.content || '';

        // Handle image
        if (imageContainer) {
            if (breakingNews.image_url) {
                imageContainer.innerHTML = `<img src="${breakingNews.image_url}" alt="${breakingNews.title || 'Breaking news image'}" style="max-width: 100%; height: auto; border-radius: 8px;">`;
            } else {
                imageContainer.innerHTML = '';
            }
        }

        // Handle "Read More" button
        if (readMoreBtn) {
            if (breakingNews.read_more_url) {
                readMoreBtn.style.display = 'inline-block';
                readMoreBtn.onclick = () => {
                    window.location.href = breakingNews.read_more_url;
                };
            } else {
                readMoreBtn.style.display = 'none';
            }
        }

        // Show popup
        popup.style.display = 'flex';

        // Close button handler
        const closeBtn = document.getElementById('close-popup');
        const dismissBtn = document.getElementById('popup-dismiss');
        
        const closePopup = () => {
            popup.style.display = 'none';
            if (dontShowCheckbox && dontShowCheckbox.checked) {
                localStorage.setItem(storageKey, 'true');
            }
        };

        if (closeBtn) closeBtn.onclick = closePopup;
        if (dismissBtn) dismissBtn.onclick = closePopup;
    } catch (error) {
        console.error('Error loading breaking news:', error);
    }
}

// Pause on hover
document.addEventListener('DOMContentLoaded', () => {
    const carouselContainer = document.getElementById('nrcga-carousel');
    if (carouselContainer) {
        carouselContainer.addEventListener('mouseenter', stopCarouselAutoPlay);
        carouselContainer.addEventListener('mouseleave', () => {
            if (typeof window.frontPageConfig !== 'undefined') {
                const carouselData = window.frontPageConfig.carousel || [];
                const activeImages = carouselData
                    .filter(item => item.active !== 0)
                    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
                if (activeImages.length > 1) {
                    startCarouselAutoPlay();
                }
            }
        });
    }
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('nrcga-carousel')) {
        loadCarousel();
    }
    loadBreakingNews();
});

