/* ==================== 1. SETUP & CONFIG ==================== */
gsap.registerPlugin(ScrollTrigger, TextPlugin);

const UI = {
    themeBtn: document.getElementById('theme-switch'),
    body: document.body,
    navbar: document.querySelector('.navbar'),
    tabs: document.querySelectorAll('.tab-btn'),
    advancedFields: document.querySelector('.advanced-options'),
    shortenBtn: document.querySelector('.btn-large'),
    resultContainer: document.getElementById("result"),
    accordions: document.querySelectorAll('.accordion-header'),
    topLinksContainer: document.getElementById("top-links"),
    analyticsDisplay: document.getElementById("analytics-result")
};

/* ==================== 2. THEME MANAGEMENT ==================== */
function initTheme() {
    const savedTheme = localStorage.getItem('ezlink-theme');
    if (savedTheme === 'dark') {
        UI.body.classList.add('dark-mode');
        UI.body.classList.remove('light-mode');
    }
}

UI.themeBtn.addEventListener('click', () => {
    UI.body.classList.toggle('dark-mode');
    UI.body.classList.toggle('light-mode');
    
    // Animate icon rotation
    gsap.fromTo(UI.themeBtn.querySelector('i:not([style*="display: none"])'), 
        { rotation: -90, opacity: 0 }, 
        { rotation: 0, opacity: 1, duration: 0.4 }
    );

    const isDark = UI.body.classList.contains('dark-mode');
    localStorage.setItem('ezlink-theme', isDark ? 'dark' : 'light');
});

/* ==================== 3. ANIMATIONS (GSAP) ==================== */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initHeroAnimations();
    initTypewriter();
    initScrollAnimations();
    getTopLinks(); // Load initial data
});

function initHeroAnimations() {
    const tl = gsap.timeline();

    // Staggered Text Reveal
    tl.from('.reveal-text', {
        y: 50,
        opacity: 0,
        duration: 1,
        stagger: 0.15,
        ease: "power4.out"
    })
    // Card Pop Up
    .from('.tool-interface', {
        y: 100,
        opacity: 0,
        scale: 0.95,
        duration: 1,
        ease: "expo.out"
    }, "-=0.5");
}

function initTypewriter() {
    const words = ["Precision.", "Brevity.", "Impact.", "Control."];
    let cursor = gsap.timeline().to('#typewriter', {duration: 0.1}); // delay start

    words.forEach((word) => {
        let tl = gsap.timeline({repeat: 1, yoyo: true, repeatDelay: 1.5});
        tl.to('#typewriter', {duration: 1, text: word, ease: "none"});
        cursor.add(tl);
    });
    
    // Loop the whole sequence
    gsap.to(cursor, {duration: 12, repeat: -1});
}

function initScrollAnimations() {
    // Navbar Glass Effect on Scroll
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) UI.navbar.classList.add('scrolled');
        else UI.navbar.classList.remove('scrolled');
    });

    // Step Cards (Staggered from left)
    gsap.from('.step-card', {
        scrollTrigger: {
            trigger: '.steps',
            start: 'top 80%',
        },
        y: 50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.2,
        ease: "power2.out"
    });

    // Bento Grid (Pop in)
    gsap.utils.toArray('.bento-card').forEach((card, i) => {
        gsap.from(card, {
            scrollTrigger: {
                trigger: card,
                start: 'top 85%',
            },
            y: 40,
            opacity: 0,
            duration: 0.6,
            delay: i * 0.1,
            ease: "back.out(1.7)"
        });
    });

    // Analytics Section Slide
    gsap.from('.text-content', {
        scrollTrigger: { trigger: '.analytics', start: 'top 75%' },
        x: -50, opacity: 0, duration: 0.8
    });
    gsap.from('.visual-content', {
        scrollTrigger: { trigger: '.analytics', start: 'top 75%' },
        x: 50, opacity: 0, duration: 0.8, delay: 0.2
    });
}

// Custom Cursor Logic
const cursorDot = document.querySelector('.cursor-dot');
const cursorOutline = document.querySelector('.cursor-outline');

if(cursorDot && cursorOutline && window.matchMedia("(pointer: fine)").matches) {
    window.addEventListener("mousemove", (e) => {
        const posX = e.clientX;
        const posY = e.clientY;
        
        cursorDot.style.left = `${posX}px`;
        cursorDot.style.top = `${posY}px`;
        
        cursorOutline.animate({
            left: `${posX}px`,
            top: `${posY}px`
        }, { duration: 500, fill: "forwards" });
    });
}

/* ==================== 4. INTERACTION LOGIC ==================== */

// Tabs Switcher
UI.tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        UI.tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        if (tab.dataset.tab === 'custom') {
            UI.advancedFields.classList.add('show');
        } else {
            UI.advancedFields.classList.remove('show');
        }
    });
});

// Accordion Logic
UI.accordions.forEach(header => {
    header.addEventListener('click', () => {
        const body = header.nextElementSibling;
        const icon = header.querySelector('.icon');
        
        // Close others
        document.querySelectorAll('.accordion-body').forEach(b => {
            if(b !== body) {
                b.classList.remove('open');
                b.previousElementSibling.querySelector('.icon').innerText = '+';
            }
        });

        // Toggle current
        body.classList.toggle('open');
        icon.innerText = body.classList.contains('open') ? '-' : '+';
    });
});

/* ==================== 5. CORE FUNCTIONALITY ==================== */

async function shortenURL() {
    const originalUrl = document.getElementById("original_url").value.trim();
    const customCode = document.getElementById("custom_code").value.trim();
    const expiration = document.getElementById("expiration").value;

    if (!originalUrl) {
        shakeInput(document.querySelector('.input-wrapper.main-url'));
        return;
    }

    // Loading State
    const originalText = UI.shortenBtn.innerHTML;
    UI.shortenBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Generating...';
    UI.shortenBtn.disabled = true;

    try {
        let endpoint = "/shorten";
        const params = new URLSearchParams();
        if (customCode) params.append("custom_code", customCode);
        if (expiration) params.append("expiration_days", expiration);
        if (params.toString()) endpoint += "?" + params.toString();

        const res = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ original_url: originalUrl })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || "Something went wrong");

        // Success UI
        renderSuccess(data.short_url);
        getTopLinks();

    } catch (err) {
        showError(err.message);
    } finally {
        UI.shortenBtn.innerHTML = originalText;
        UI.shortenBtn.disabled = false;
    }
}

function renderSuccess(url) {
    UI.resultContainer.innerHTML = `
        <div class="success-card">
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fas fa-check-circle" style="color:var(--olive-mid);"></i>
                <a href="${url}" target="_blank" class="short-link-text">${url}</a>
            </div>
            <button onclick="navigator.clipboard.writeText('${url}')" class="icon-btn" title="Copy">
                <i class="fas fa-copy"></i>
            </button>
        </div>
    `;
    
    gsap.fromTo(".success-card", { height: 0, opacity: 0 }, { height: "auto", opacity: 1, duration: 0.5 });
}

function showError(msg) {
    UI.resultContainer.innerHTML = `
        <div style="padding:15px; background:#fee2e2; color:#b91c1c; border-radius:8px; margin-top:20px; border:1px solid #fecaca;">
            <i class="fas fa-exclamation-circle"></i> ${msg}
        </div>
    `;
}

function shakeInput(el) {
    gsap.to(el, { x: [-10, 10, -10, 10, 0], duration: 0.4 });
    el.style.borderColor = "var(--orange-main)";
    setTimeout(() => el.style.borderColor = "", 2000);
}

// Analytics Logic (Redesigned)
async function getTopLinks() {
    try {
        const res = await fetch("/analytics/top");
        const data = await res.json();
        
        if (!data.length) {
            UI.topLinksContainer.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">No data available yet.</div>';
            return;
        }

        // Calculate max clicks for progress bar
        const maxClicks = Math.max(...data.map(d => d.click_count));

        UI.topLinksContainer.innerHTML = data.map((link, i) => {
            const percentage = maxClicks > 0 ? (link.click_count / maxClicks) * 100 : 0;
            const rankClass = i === 0 ? 'top-1' : (i === 1 ? 'top-2' : (i === 2 ? 'top-3' : ''));
            
            return `
            <div class="link-row">
                <div class="rank-info">
                    <div class="rank-badge ${rankClass}">${i + 1}</div>
                    <div class="link-details">
                        <span class="link-alias">/${link.short_url.split('/').pop()}</span>
                        <div class="click-bar-container">
                            <div class="click-bar" style="width: ${percentage}%"></div>
                        </div>
                    </div>
                </div>
                <div class="link-actions">
                    <span>${link.click_count}</span>
                    <i class="fas fa-mouse-pointer" style="font-size:0.7rem;"></i>
                </div>
            </div>
            `;
        }).join('');
    } catch (e) { console.error(e); }
}

async function loadAnalyticsByCode(code) {
    if (!code) return;
    
    // Simulate loading
    UI.analyticsDisplay.innerHTML = '<div style="text-align:center; padding:20px;"><i class="fas fa-circle-notch fa-spin"></i></div>';

    try {
        const res = await fetch(`/analytics/${code}`);
        const data = await res.json();
        
        if (!res.ok) throw new Error("Link not found");

        UI.analyticsDisplay.innerHTML = `
            <div style="background:var(--bg-body); padding:24px; border-radius:16px; border:1px solid var(--border-color);">
                <div style="display:flex; justify-content:space-between; margin-bottom:20px;">
                    <h3 style="margin:0;">${code}</h3>
                    <span style="background:#dcfce7; color:#166534; padding:4px 12px; border-radius:20px; font-size:0.8rem;">Active</span>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">
                    <div style="background:var(--olive-dark); color:white; padding:15px; border-radius:12px; text-align:center;">
                        <div style="font-size:2rem; font-weight:700;">${data.click_count}</div>
                        <div style="font-size:0.8rem; opacity:0.8;">Total Clicks</div>
                    </div>
                    <div style="background:var(--orange-main); color:white; padding:15px; border-radius:12px; text-align:center;">
                        <div style="font-size:2rem; font-weight:700;">${data.expires_in_days ?? '∞'}</div>
                        <div style="font-size:0.8rem; opacity:0.8;">Days Left</div>
                    </div>
                </div>
            </div>
        `;
        
        gsap.from(UI.analyticsDisplay.children[0], { y: 20, opacity: 0 });

    } catch (e) {
        UI.analyticsDisplay.innerHTML = `<p style="color:var(--orange-main); text-align:center;">${e.message}</p>`;
    }
}
