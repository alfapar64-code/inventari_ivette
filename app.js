const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSMpG3eag6FmM46ZF024-8tcKH0TCylnNUxyKxD6-nVJXYDfPgPbAUoAKAtjrcFOleIrpUuzyY7GnTT/pub?output=csv";

let inventoryData = {}; 
let savedData = JSON.parse(localStorage.getItem('inventario_ivette_data')) || {};

// MIGRACIÓN: Si alguien tiene datos guardados de la versión anterior (solo texto), los convertimos al nuevo formato con fecha.
for (let key in savedData) {
    if (typeof savedData[key] === 'string') {
        savedData[key] = { qty: savedData[key], expDate: '' };
    }
}

let currentDept = null;
const appContent = document.getElementById('app-content');
const btnBack = document.getElementById('btn-back');
const headerTitle = document.getElementById('header-title');

async function init() {
    try {
        const response = await fetch(CSV_URL);
        if (!response.ok) throw new Error("No se pudo conectar a Google Sheets");
        const csvText = await response.text();
        parseCSV(csvText);
        renderHome();
    } catch (error) {
        appContent.innerHTML = '<div class="text-center" style="color:red; padding:20px;"><b>Error de carga:</b><br>' + error.message + '</div>';
    }
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    const delimiter = text.includes(';') && !text.includes('DPTO.,') ? ';' : ',';
    let startIndex = (lines[0].toLowerCase().includes('dpto') || lines[0].toLowerCase().includes('descrip')) ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
        let line = lines[i];
        let cols = [];
        let inQuotes = false;
        let current = '';
        for (let char of line) {
            if (char === '"') inQuotes = !inQuotes;
            else if (char === delimiter && !inQuotes) { cols.push(current.trim()); current = ''; } 
            else { current += char; }
        }
        cols.push(current.trim());

        if (cols.length >= 2) {
            let dept = cols[0].replace(/^"|"$/g, '').trim().toUpperCase();
            let originalName = cols.slice(1).join(delimiter).replace(/^"|"$/g, '').trim();

            if (dept === "" || originalName === "") continue;

            let escapedDept = dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let prefixRegex = new RegExp('^' + escapedDept + '[\\s\\.\\-_]+', 'i');
            let name = originalName.replace(prefixRegex, '');

            if (!inventoryData[dept]) inventoryData[dept] = [];
            inventoryData[dept].push({ originalName: originalName, name: name });
        }
    }
}

// Calcula los días restantes (Negativo = Vencido, 0 a 30 = Promoción)
function getDaysRemaining(dateString) {
    if (!dateString) return null;
    const exp = new Date(dateString + 'T00:00:00'); 
    const today = new Date();
    today.setHours(0,0,0,0);
    return Math.ceil((exp - today) / (1000 * 60 * 60 * 24));
}

function renderHome() {
    currentDept = null;
    btnBack.classList.add('hidden');
    headerTitle.textContent = "Inventario Ivette";

    let html = '<div class="container">';
    const depts = Object.keys(inventoryData).sort();
    
    if (depts.length === 0) {
        html += '<div class="text-center">No se encontraron departamentos.</div>';
    } else {
        html += '<button class="btn btn-info" onclick="exportPromotions()">📊 Extraer Promociones (TODO EL INVENTARIO)</button>';
        html += '<p style="margin:20px 0 15px 0; color:#555;">Seleccione un departamento:</p>';
        
        depts.forEach(dept => {
            html += '<button class="dept-btn" onclick="renderDept(\'' + dept + '\')">📂 Departamento: ' + dept + '</button>';
        });
        
        html += '<hr style="margin: 35px 0 20px 0; border: 0; border-top: 1px solid #ccc;">';
        html += '<button class="btn btn-danger" onclick="clearAllData()">🗑️ Borrar TODO el inventario</button>';
    }
    html += '</div>';
    appContent.innerHTML = html;
}

window.renderDept = function(dept) {
    currentDept = dept;
    btnBack.classList.remove('hidden');
    headerTitle.textContent = "Dpto: " + dept;

    const items = inventoryData[dept];
    let html = '<div class="container" id="dept-form">';
    html += '<button class="btn btn-info" onclick="exportPromotions(\'' + dept + '\')">📄 Extraer Promociones (' + dept + ')</button>';
    html += '<p style="margin:15px 0; color:#555; font-size:0.9rem;">Autoguardado activado. Los datos se guardan solos al escribir.</p>';
    
    items.forEach((item, idx) => {
        let saved = savedData[item.originalName] || { qty: '', expDate: '' };
        let days = getDaysRemaining(saved.expDate);
        let badgeHtml = '';
        
        if (days !== null) {
            if (days < 0) badgeHtml = `<span class="expired-badge">❌ Vencido (${Math.abs(days)}d)</span>`;
            else if (days <= 30) badgeHtml = `<span class="promo-badge">⚠️ Promoción (${days}d)</span>`;
        }

        let escapedName = item.originalName.replace(/'/g, "\\'"); // Proteger comillas en la función

        html += `
            <div class="item-row">
                <div class="item-name">${item.name} <span id="badge_${idx}">${badgeHtml}</span></div>
                <div class="item-inputs">
                    <div class="input-row">
                        <label>Cant:</label>
                        <input type="text" class="item-input" id="qty_${idx}" inputmode="text" placeholder="Ej: 5+10" 
                               value="${saved.qty}" onblur="handleItemChange('${escapedName}', ${idx}, true)">
                    </div>
                    <div class="input-row">
                        <label>Vence:</label>
                        <input type="date" class="item-date" id="date_${idx}" 
                               value="${saved.expDate}" onchange="handleItemChange('${escapedName}', ${idx}, false)">
                    </div>
                </div>
            </div>
        `;
    });

    html += '<button class="btn btn-primary" onclick="renderHome()">⬅ Volver al inicio (Guardado Automático)</button>';
    html += '<button class="btn btn-danger" onclick="clearDept(\'' + dept + '\')">Borrar este Dpto e iniciar de cero</button>';
    html += '</div>';

    appContent.innerHTML = html;
    window.scrollTo(0,0);
}

// Evaluación matemática (Ej: 5 + 10)
function evaluateMath(val) {
    if (!val) return '';
    try {
        let sanitized = val.replace(/[^0-9+\-*/(). ]/g, '');
        if (sanitized) {
            let result = Function("'use strict'; return (" + sanitized + ")")();
            if (result !== undefined && !isNaN(result)) return result;
        }
    } catch (e) {}
    return val;
}

// AUTOGUARDADO EN TIEMPO REAL
window.handleItemChange = function(originalName, idx, isMath) {
    let qtyEl = document.getElementById('qty_' + idx);
    let dateEl = document.getElementById('date_' + idx);
    let badgeEl = document.getElementById('badge_' + idx);
    
    if (isMath) { qtyEl.value = evaluateMath(qtyEl.value); }
    
    let qty = qtyEl.value.trim();
    let expDate = dateEl.value;
    
    // Guardar en memoria permanentemente
    if (!qty && !expDate) {
        delete savedData[originalName];
    } else {
        savedData[originalName] = { qty: qty, expDate: expDate };
    }
    localStorage.setItem('inventario_ivette_data', JSON.stringify(savedData));
    
    // Actualizar etiqueta visual al instante
    let days = getDaysRemaining(expDate);
    if (days !== null) {
        if (days < 0) badgeEl.innerHTML = `<span class="expired-badge">❌ Vencido (${Math.abs(days)}d)</span>`;
        else if (days <= 30) badgeEl.innerHTML = `<span class="promo-badge">⚠️ Promoción (${days}d)</span>`;
        else badgeEl.innerHTML = '';
    } else {
        badgeEl.innerHTML = '';
    }
}

// EXPORTACIÓN A EXCEL (CSV)
window.exportPromotions = function(dept = null) {
    let csvContent = "\uFEFFDepartamento;Rubro;Cantidad;Fecha de Vencimiento;Estado / Dias Restantes\n";
    let itemsToExport = [];
    
    for (let d in inventoryData) {
        if (dept && d !== dept) continue; 
        
        inventoryData[d].forEach(item => {
            let data = savedData[item.originalName];
            if (data && data.expDate) {
                let days = getDaysRemaining(data.expDate);
                if (days !== null && days <= 30) {
                    itemsToExport.push({
                        dept: d, name: item.name, qty: data.qty || '0', 
                        expDate: data.expDate, days: days
                    });
                }
            }
        });
    }
    
    if (itemsToExport.length === 0) {
        let msg = dept ? `No hay productos en promoción o vencidos registrados en ${dept}.` : "No hay productos en promoción o vencidos en todo el inventario.";
        alert(msg);
        return;
    }
    
    // Ordenar desde el más vencido hasta el más lejano
    itemsToExport.sort((a, b) => a.days - b.days);
    
    itemsToExport.forEach(row => {
        let status = row.days < 0 ? `Vencido hace ${Math.abs(row.days)} dias` : `${row.days} dias`;
        csvContent += `${row.dept};"${row.name}";${row.qty};${row.expDate};${status}\n`;
    });
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", dept ? `Promociones_${dept}.csv` : "Promociones_Inventario_Completo.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.clearDept = function(dept) {
    if(confirm(`¿Seguro que deseas borrar TODA la información contada de ${dept}?\nEsta acción no se puede deshacer.`)) {
        const items = inventoryData[dept];
        items.forEach(item => delete savedData[item.originalName]);
        localStorage.setItem('inventario_ivette_data', JSON.stringify(savedData));
        renderDept(dept); 
    }
}

window.clearAllData = function() {
    if(confirm("¡ATENCIÓN EXTREMA! ¿Estás seguro de borrar TODO EL INVENTARIO? \nPerderás todas las cantidades y fechas guardadas.")) {
        savedData = {};
        localStorage.removeItem('inventario_ivette_data');
        renderHome();
        alert("El inventario ha sido limpiado por completo.");
    }
}

btnBack.addEventListener('click', () => renderHome());
init();
