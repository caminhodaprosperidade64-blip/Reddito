/**
 * Professional UI Utilities
 * Sistema de utilidades para UI profissional
 */

const ProUI = {
    /**
     * Toast Notifications
     */
    Toast: {
        container: null,

        init() {
            if (!this.container) {
                this.container = document.createElement('div');
                this.container.className = 'pro-toast-container';
                document.body.appendChild(this.container);
            }
        },

        show(message, type = 'info', duration = 3000) {
            this.init();

            const toast = document.createElement('div');
            toast.className = `pro-toast ${type}`;

            const icons = {
                success: 'fas fa-check-circle',
                error: 'fas fa-times-circle',
                warning: 'fas fa-exclamation-triangle',
                info: 'fas fa-info-circle'
            };

            toast.innerHTML = `
                <div class="pro-toast-icon">
                    <i class="${icons[type]}"></i>
                </div>
                <div class="pro-toast-content">
                    <div class="pro-toast-message">${message}</div>
                </div>
                <button class="pro-toast-close" onclick="this.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            `;

            this.container.appendChild(toast);

            if (duration > 0) {
                setTimeout(() => toast.remove(), duration);
            }

            return toast;
        },

        success(message, duration) {
            return this.show(message, 'success', duration);
        },

        error(message, duration) {
            return this.show(message, 'error', duration);
        },

        warning(message, duration) {
            return this.show(message, 'warning', duration);
        },

        info(message, duration) {
            return this.show(message, 'info', duration);
        }
    },

    /**
     * Confirm Dialog
     */
    Confirm: {
        show(title, message, onConfirm, onCancel) {
            const confirm = document.createElement('div');
            confirm.className = 'pro-confirm active';

            confirm.innerHTML = `
                <div class="pro-confirm-overlay"></div>
                <div class="pro-confirm-content">
                    <div class="pro-confirm-header">
                        <h3 class="pro-confirm-title">${title}</h3>
                    </div>
                    <div class="pro-confirm-body">
                        ${message}
                    </div>
                    <div class="pro-confirm-footer">
                        <button class="pro-btn pro-btn-secondary" data-action="cancel">
                            Cancelar
                        </button>
                        <button class="pro-btn pro-btn-danger" data-action="confirm">
                            Confirmar
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(confirm);

            const handleClose = (confirmed) => {
                confirm.remove();
                if (confirmed && onConfirm) onConfirm();
                if (!confirmed && onCancel) onCancel();
            };

            confirm.querySelector('[data-action="confirm"]').addEventListener('click', () => handleClose(true));
            confirm.querySelector('[data-action="cancel"]').addEventListener('click', () => handleClose(false));
            confirm.querySelector('.pro-confirm-overlay').addEventListener('click', () => handleClose(false));
        }
    },

    /**
     * Loading Overlay
     */
    Loading: {
        overlay: null,

        show(message = 'Carregando...') {
            if (!this.overlay) {
                this.overlay = document.createElement('div');
                this.overlay.className = 'pro-loading-overlay';
                this.overlay.innerHTML = `
                    <div style="text-align: center;">
                        <div class="pro-spinner"></div>
                        <p style="margin-top: 16px; color: var(--text-secondary);">${message}</p>
                    </div>
                `;
                document.body.appendChild(this.overlay);
            }
            this.overlay.classList.add('active');
        },

        hide() {
            if (this.overlay) {
                this.overlay.classList.remove('active');
            }
        }
    },

    /**
     * Modal Utilities
     */
    Modal: {
        open(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        },

        close(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('active');
                document.body.style.overflow = '';
            }
        }
    },

    /**
     * Format Utilities
     */
    Format: {
        currency(value) {
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
            }).format(value);
        },

        date(date) {
            return new Intl.DateTimeFormat('pt-BR').format(new Date(date));
        },

        datetime(date) {
            return new Intl.DateTimeFormat('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short'
            }).format(new Date(date));
        },

        phone(phone) {
            const cleaned = phone.replace(/\D/g, '');
            if (cleaned.length === 11) {
                return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
            } else if (cleaned.length === 10) {
                return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
            }
            return phone;
        },

        cpf(cpf) {
            const cleaned = cpf.replace(/\D/g, '');
            if (cleaned.length === 11) {
                return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            }
            return cpf;
        }
    },

    /**
     * Dropdown Utilities
     */
    Dropdown: {
        toggle(dropdownId) {
            const dropdown = document.getElementById(dropdownId);
            if (dropdown) {
                dropdown.classList.toggle('active');
            }
        },

        closeAll() {
            document.querySelectorAll('.pro-dropdown').forEach(d => {
                d.classList.remove('active');
            });
        }
    },

    /**
     * Tabs Utilities
     */
    Tabs: {
        switch(tabId, contentId) {
            // Remove active from all tabs
            document.querySelectorAll('.pro-tab').forEach(tab => {
                tab.classList.remove('active');
            });

            // Remove active from all contents
            document.querySelectorAll('.pro-tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Add active to selected
            const tab = document.getElementById(tabId);
            const content = document.getElementById(contentId);

            if (tab) tab.classList.add('active');
            if (content) content.classList.add('active');
        }
    },

    /**
     * Table Utilities
     */
    Table: {
        sort(table, column, direction = 'asc') {
            // Implementar ordenação de tabela
            console.log('Sort table:', table, column, direction);
        },

        filter(table, filters) {
            // Implementar filtros de tabela
            console.log('Filter table:', table, filters);
        },

        export(table, format = 'csv') {
            // Implementar exportação
            console.log('Export table:', table, format);
        }
    },

    /**
     * Chart Utilities (usando Chart.js)
     */
    Chart: {
        defaultOptions: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom'
                }
            }
        },

        createLine(canvasId, data, options = {}) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return null;

            return new Chart(ctx, {
                type: 'line',
                data: data,
                options: { ...this.defaultOptions, ...options }
            });
        },

        createBar(canvasId, data, options = {}) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return null;

            return new Chart(ctx, {
                type: 'bar',
                data: data,
                options: { ...this.defaultOptions, ...options }
            });
        },

        createDoughnut(canvasId, data, options = {}) {
            const ctx = document.getElementById(canvasId);
            if (!ctx) return null;

            return new Chart(ctx, {
                type: 'doughnut',
                data: data,
                options: { ...this.defaultOptions, ...options }
            });
        }
    },

    /**
     * Form Validation
     */
    Validation: {
        rules: {
            required: (value) => value && value.trim() !== '',
            email: (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
            phone: (value) => /^\(?[1-9]{2}\)?\s?9?\d{4}-?\d{4}$/.test(value),
            cpf: (value) => {
                const cleaned = value.replace(/\D/g, '');
                return cleaned.length === 11;
            },
            min: (value, min) => value.length >= min,
            max: (value, max) => value.length <= max,
            number: (value) => !isNaN(value),
            positive: (value) => parseFloat(value) > 0
        },

        validate(formId) {
            const form = document.getElementById(formId);
            if (!form) return false;

            let isValid = true;
            const inputs = form.querySelectorAll('[data-validate]');

            inputs.forEach(input => {
                const rules = input.dataset.validate.split('|');
                const value = input.value;

                rules.forEach(rule => {
                    const [ruleName, param] = rule.split(':');
                    const validator = this.rules[ruleName];

                    if (validator && !validator(value, param)) {
                        isValid = false;
                        input.classList.add('invalid');
                        // Mostrar mensagem de erro
                    } else {
                        input.classList.remove('invalid');
                    }
                });
            });

            return isValid;
        }
    },

    /**
     * Search Utilities
     */
    Search: {
        debounce(func, wait = 300) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },

        filter(items, query, fields) {
            if (!query) return items;

            const lowerQuery = query.toLowerCase();
            return items.filter(item => {
                return fields.some(field => {
                    const value = item[field];
                    return value && value.toString().toLowerCase().includes(lowerQuery);
                });
            });
        }
    },

    /**
     * Storage Utilities
     */
    Storage: {
        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage error:', e);
                return false;
            }
        },

        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (e) {
                console.error('Storage error:', e);
                return defaultValue;
            }
        },

        remove(key) {
            localStorage.removeItem(key);
        },

        clear() {
            localStorage.clear();
        }
    },

    /**
     * Date Utilities
     */
    Date: {
        today() {
            return new Date().toISOString().split('T')[0];
        },

        addDays(date, days) {
            const result = new Date(date);
            result.setDate(result.getDate() + days);
            return result.toISOString().split('T')[0];
        },

        formatWeekday(date) {
            const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
            return weekdays[new Date(date).getDay()];
        },

        formatMonth(date) {
            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
            return months[new Date(date).getMonth()];
        },

        getWeekDates(startDate = null) {
            const start = startDate ? new Date(startDate) : new Date();
            const dates = [];

            for (let i = 0; i < 7; i++) {
                const date = new Date(start);
                date.setDate(start.getDate() + i);
                dates.push(date.toISOString().split('T')[0]);
            }

            return dates;
        }
    },

    /**
     * Mobile Menu
     */
    MobileMenu: {
        toggle() {
            const sidebar = document.querySelector('.pro-sidebar');
            if (sidebar) {
                sidebar.classList.toggle('mobile-open');
            }
        },

        close() {
            const sidebar = document.querySelector('.pro-sidebar');
            if (sidebar) {
                sidebar.classList.remove('mobile-open');
            }
        }
    }
};

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.pro-dropdown')) {
        ProUI.Dropdown.closeAll();
    }
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
        const sidebar = document.querySelector('.pro-sidebar');
        if (sidebar && sidebar.classList.contains('mobile-open')) {
            if (!e.target.closest('.pro-sidebar') && !e.target.closest('.mobile-menu-btn')) {
                ProUI.MobileMenu.close();
            }
        }
    }
});

// Export for use
window.ProUI = ProUI;
