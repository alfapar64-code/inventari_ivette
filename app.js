const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSMpG3eag6FmM46ZF024-8tcKH0TCylnNUxyKxD6-nVJXYDfPgPbAUoAKAtjrcFOleIrpUuzyY7GnTT/pub?output=csv";

let inventoryData = {}; 
let savedData = JSON.parse(localStorage.getItem('inventario_ivette_data')) || {};

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
    
    // Mapeo automático de columnas
    let headers = lines[0].split(delimiter).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    let dptoIdx = -1, descIdx = -1, codeIdx = -1;
    
    for(let i=0; i<headers.length; i++) {
        let h = headers[i];
        if (h.includes('dpto') || h.includes('departamento')) dptoIdx = i;
        else if (h.includes('descrip') || h.includes('rubro')) descIdx = i;
        else if (h.includes('cod') || h.includes('cód') || h.includes('barra')) codeIdx = i;
    }
    
    // Por si no hay encabezados, usamos las primeras columnas por defecto
    if (dptoIdx === -1) dptoIdx = 0;
    if (descIdx === -1) descIdx = 1;
    
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

        if (cols.length > Math.max(dptoIdx, descIdx)) {
            let dept = cols[dptoIdx].replace(/^"|"$/g, '').trim().toUpperCase();
            let originalName = cols[descIdx].replace(/^"|"$/g, '').trim();
            // Extracción del código de barras si la columna existe
            let barcode = (codeIdx !== -1 && codeIdx < cols.length) ? cols[codeIdx].replace(/^"|"$/g, '').trim() : '';

            if (dept === "" || originalName === "") continue;

            let escapedDept = dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let prefixRegex = new RegExp('^' + escapedDept + '[\\s\\.\\-_]+', 'i');
            let name = originalName.replace(prefixRegex, '');

            if (!inventoryData[dept]) inventoryData[dept] = [];
            inventoryData[dept].push({ originalName: originalName, name: name, barcode: barcode });
        }
    }
}

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

        let escapedName = item.originalName.replace(/'/g, "\\'"); 

        html += `
            <div class="item-row" id="row_${idx}">
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

window.handleItemChange = function(originalName, idx, isMath) {
    let qtyEl = document.getElementById('qty_' + idx);
    let dateEl = document.getElementById('date_' + idx);
    let badgeEl = document.getElementById('badge_' + idx);
    
    if (isMath) { qtyEl.value = evaluateMath(qtyEl.value); }
    
    let qty = qtyEl.value.trim();
    let expDate = dateEl.value;
    
    if (!qty && !expDate) {
        delete savedData[originalName];
    } else {
        savedData[originalName] = { qty: qty, expDate: expDate };
    }
    localStorage.setItem('inventario_ivette_data', JSON.stringify(savedData));
    
    let days = getDaysRemaining(expDate);
    if (days !== null) {
        if (days < 0) badgeEl.innerHTML = `<span class="expired-badge">❌ Vencido (${Math.abs(days)}d)</span>`;
        else if (days <= 30) badgeEl.innerHTML = `<span class="promo-badge">⚠️ Promoción (${days}d)</span>`;
        else badgeEl.innerHTML = '';
    } else {
        badgeEl.innerHTML = '';
    }
}

window.exportPromotions = function(dept = null) {
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
    
    itemsToExport.sort((a, b) => a.days - b.days);

    let now = new Date();
    let dateString = now.toLocaleDateString('es-AR') + ' a las ' + now.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
    
    let csvContent = "\uFEFF"; 
    csvContent += `"Reporte generado el: ${dateString}"\n\n`; 
    csvContent += "Departamento;Rubro;Cantidad;Fecha de Vencimiento;Estado / Dias Restantes\n";
    
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

// ---- LOGICA DEL ESCANER DE CÓDIGO DE BARRAS ----
let html5QrcodeScanner = null;

document.getElementById('btn-scan').addEventListener('click', () => {
    document.getElementById('reader-container').classList.remove('hidden');
    
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("reader");
    }
    
    html5QrcodeScanner.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: { width: 250, height: 150 } },
        (decodedText, decodedResult) => {
            // Se encontró un código, apagar la cámara y buscar
            html5QrcodeScanner.stop().then(() => {
                document.getElementById('reader-container').classList.add('hidden');
                findAndOpenProduct(decodedText);
            });
        },
        (errorMessage) => { /* Ignorar errores de lectura en proceso */ }
    ).catch(err => {
        alert("Debes otorgar permisos de cámara para poder escanear.");
        document.getElementById('reader-container').classList.add('hidden');
    });
});

document.getElementById('btn-close-scanner').addEventListener('click', () => {
    if (html5QrcodeScanner) {
        html5QrcodeScanner.stop().then(() => {
            document.getElementById('reader-container').classList.add('hidden');
        }).catch(err => {
            document.getElementById('reader-container').classList.add('hidden');
        });
    } else {
        document.getElementById('reader-container').classList.add('hidden');
    }
});

function findAndOpenProduct(barcode) {
    barcode = barcode.trim();
    let found = null;
    let foundDept = null;
    let foundIdx = -1;

    for (let dept in inventoryData) {
        let items = inventoryData[dept];
        for (let i = 0; i < items.length; i++) {
            if (items[i].barcode === barcode) {
                found = items[i];
                foundDept = dept;
                foundIdx = i;
                break;
            }
        }
        if (found) break;
    }

    if (found) {
        renderDept(foundDept); // Entrar a la categoría correcta
        
        // Esperar un instante para hacer scroll hacia el producto
        setTimeout(() => {
            let itemRow = document.getElementById('row_' + foundIdx);
            if (itemRow) {
                itemRow.scrollIntoView({ behavior: "smooth", block: "center" });
                
                // Efecto visual amarillo para ubicarlo fácil
                let originalBg = itemRow.style.backgroundColor;
                itemRow.style.backgroundColor = "#fffae6"; 
                itemRow.style.border = "2px solid #ff9800";
                
                // Ubicar el cursor en la casilla de cantidad
                let qtyInput = document.getElementById('qty_' + foundIdx);
                if (qtyInput) qtyInput.focus();
                
                setTimeout(() => {
                    itemRow.style.backgroundColor = originalBg;
                    itemRow.style.border = "1px solid #ddd";
                }, 3000);
            }
        }, 150);
    } else {
        alert("El código escaneado (" + barcode + ") no coincide con ningún producto de tu hoja de Google Sheets.");
    }
}

btnBack.addEventListener('click', () => renderHome());
init();
