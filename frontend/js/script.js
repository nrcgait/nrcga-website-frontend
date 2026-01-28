// Theme toggle functionality is now handled in components.js

// Navigation functionality is now handled in components.js
// This file is for page-specific scripts

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offsetTop = target.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// Navbar scroll effect
let lastScroll = 0;
const navbar = document.querySelector('.navbar');

if (navbar) {
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        
        if (currentScroll > 100) {
            navbar.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.boxShadow = 'none';
        }
        
        lastScroll = currentScroll;
    });
}

// Hero overlay scroll effect - fade in overlay as user scrolls
const heroSection = document.querySelector('.hero');
const heroOverlay = document.getElementById('hero-overlay');

if (heroSection && heroOverlay) {
    // Initially hide overlay so banner is fully visible
    heroOverlay.style.opacity = '0';
    
    window.addEventListener('scroll', () => {
        const scrollPosition = window.pageYOffset;
        const heroHeight = heroSection.offsetHeight;
        
        // Overlay fades in over first 30% of hero height
        const overlayFadeEnd = heroHeight * 0.3;
        const overlayScrollProgress = Math.min(scrollPosition / overlayFadeEnd, 1);
        
        // Fade in overlay as user scrolls
        if (scrollPosition > 0) {
            heroOverlay.style.opacity = overlayScrollProgress;
        } else {
            heroOverlay.style.opacity = '0';
        }
    });
    
    // Initialize on page load
    window.dispatchEvent(new Event('scroll'));
}

// Form submission handler (exclude attendance form which has its own handler)
const contactForm = document.querySelector('.contact-form:not(#attendance-form)');
if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        // Add your form submission logic here
        alert('Thank you for your message! We will get back to you soon.');
        contactForm.reset();
    });
}

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', () => {
    const animateElements = document.querySelectorAll('.program-card, .feature-item, .session-card, .committee-item');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

