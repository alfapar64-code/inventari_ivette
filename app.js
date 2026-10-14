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
    
    let headers = lines[0].split(delimiter).map(h => h.replace(/^"|"$/g, '').trim().toLowerCase());
    let dptoIdx = -1, descIdx = -1, codeIdx = -1;
    
    for(let i=0; i<headers.length; i++) {
        let h = headers[i];
        if (h.includes('dpto') || h.includes('departamento')) dptoIdx = i;
        else if (h.includes('descrip') || h.includes('rubro')) descIdx = i;
        else if (h.includes('cod') || h.includes('cód') || h.includes('barra')) codeIdx = i;
    }
    
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
        html += '<button class="btn" style="background-color: #2e7d32; color: white; margin-bottom: 10px;" onclick="exportInventory()">📦 Ver Resumen de Inventario (TODO)</button>';
        html += '<button class="btn btn-info" onclick="exportPromotions()">📊 Ver Promociones y Vencidos (TODO)</button>';
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
    
    html += '<button class="btn" style="background-color: #2e7d32; color: white; margin-bottom: 10px;" onclick="exportInventory(\'' + dept + '\')">📦 Ver Resumen del Inventario (' + dept + ')</button>';
    html += '<button class="btn btn-info" onclick="exportPromotions(\'' + dept + '\')">📄 Ver Promociones (' + dept + ')</button>';
    html += '<p style="margin:15px 0; color:#555; font-size:0.9rem;">Autoguardado activado.</p>';
    
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

    html += '<button class="btn btn-primary" onclick="renderHome()">⬅ Volver al inicio</button>';
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

// ---- VENTANA DE REPORTES EN PANTALLA ----
window.currentCsvContent = "";
window.currentCsvFileName = "";

window.showReportModal = function(title, items, csvContent, fileName) {
    window.currentCsvContent = csvContent;
    window.currentCsvFileName = fileName;

    let modal = document.createElement('div');
    modal.id = 'report-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = '#f5f5f5';
    modal.style.zIndex = '3000';
    modal.style.overflowY = 'auto';
    modal.style.padding = '15px';
    modal.style.boxSizing = 'border-box';
    modal.style.paddingBottom = '80px';

    let html = `
        <div style="background: white; padding: 15px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
            <h2 style="margin:0; font-size: 1.1rem; color: #2e7d32;">${title}</h2>
            <button onclick="document.body.removeChild(document.getElementById('report-modal'))" 
                    style="background:#f44336; color:white; border:none; padding:10px 15px; border-radius:5px; font-weight:bold; cursor:pointer;">
                X Cerrar
            </button>
        </div>
        <p style="color:#666; font-size:0.9rem; margin-bottom:15px; text-align:center;">Información lista para transcribir a tu PC</p>
        <div style="background: white; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); padding: 10px;">
    `;

    items.forEach(item => {
        if (!item.qty && !item.expDate) return; 
        html += `
            <div style="border-bottom: 1px solid #eee; padding: 15px 0;">
                <div style="font-weight:bold; font-size: 1.15rem; margin-bottom: 10px; color: #222;">${item.name}</div>
                <div style="display:flex; justify-content: space-between; font-size: 1.05rem;">
                    <span style="color: #555;">Cant: <strong style="color:#000; font-size:1.2rem;">${item.qty || '-'}</strong></span>
                    <span style="color: #555;">Vence: <strong style="color:#000;">${item.expDate || '-'}</strong></span>
                </div>
            </div>
        `;
    });

    html += `</div>
        <button onclick="triggerDownload()" 
                style="display:block; width:100%; background:#2196F3; color:white; border:none; padding:15px; border-radius:8px; font-weight:bold; margin-top:20px; font-size:1.1rem;">
            📥 Descargar este archivo (Opcional)
        </button>
    `;

    modal.innerHTML = html;
    document.body.appendChild(modal);
}

window.triggerDownload = function() {
    const blob = new Blob([window.currentCsvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", window.currentCsvFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

window.exportInventory = function(dept = null) {
    let itemsToExport = [];
    for (let d in inventoryData) {
        if (dept && d !== dept) continue; 
        inventoryData[d].forEach(item => {
            let data = savedData[item.originalName];
            if (data && (data.qty || data.expDate)) {
                itemsToExport.push({ dept: d, barcode: item.barcode || '', name: item.name, qty: data.qty, expDate: data.expDate });
            }
        });
    }
    if (itemsToExport.length === 0) { alert("No hay productos contados para mostrar."); return; }
    let now = new Date();
    let dateString = now.toLocaleDateString('es-AR') + ' a las ' + now.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
    let csvContent = "\uFEFF"; 
    csvContent += `"Inventario exportado el: ${dateString}"\n\n`; 
    csvContent += "Departamento;Codigo de Barras;Rubro;Cantidad Contada;Fecha de Vencimiento\n";
    itemsToExport.forEach(row => { csvContent += `${row.dept};"${row.barcode}";"${row.name}";${row.qty};${row.expDate}\n`; });
    showReportModal(dept ? `Inventario: ${dept}` : "Inventario Completo", itemsToExport, csvContent, dept ? `Inventario_Realizado_${dept}.csv` : "Inventario_Realizado_Completo.csv");
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
                    itemsToExport.push({ dept: d, name: item.name, qty: data.qty || '0', expDate: data.expDate, days: days });
                }
            }
        });
    }
    if (itemsToExport.length === 0) { alert("No hay productos en promoción o vencidos."); return; }
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
    showReportModal(dept ? `Promociones: ${dept}` : "Todas las Promociones", itemsToExport, csvContent, dept ? `Promociones_${dept}.csv` : "Promociones_Inventario_Completo.csv");
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
    if(confirm("¡ATENCIÓN EXTREMA! ¿Estás seguro de borrar TODO EL INVENTARIO?")) {
        savedData = {};
        localStorage.removeItem('inventario_ivette_data');
        renderHome();
        alert("El inventario ha sido limpiado por completo.");
    }
}

// ---- LÓGICA DEL ESCÁNER Y BUSCADORES MANUALES ----
let html5QrcodeScanner = null;
const readerContainer = document.getElementById('reader-container');
const manualBarcode = document.getElementById('manual-barcode-input');
const manualName = document.getElementById('manual-name-input');
const searchResults = document.getElementById('search-results');

document.getElementById('btn-scan').addEventListener('click', () => {
    readerContainer.classList.remove('hidden');
    manualBarcode.value = ""; 
    manualName.value = "";
    searchResults.style.display = 'none';
    
    if (!html5QrcodeScanner) {
        html5QrcodeScanner = new Html5Qrcode("reader", {
            formatsToSupport: [
                Html5QrcodeSupportedFormats.EAN_13, Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A, Html5QrcodeSupportedFormats.UPC_E,
                Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.ITF
            ]
        });
    }
    
    const cameraConfig = { facingMode: "environment" };
    const config = { fps: 10, qrbox: function(vw, vh) { return { width: Math.min(320, vw * 0.95), height: 150 }; } };
    
    html5QrcodeScanner.start(cameraConfig, config,
        (decodedText) => { detenerYEjecutar(() => buscarCodigo(decodedText)); },
        () => { }
    ).catch(err => { console.warn("Modo manual activo."); });
});

document.getElementById('btn-close-scanner').addEventListener('click', () => detenerYEjecutar(() => {}));

function detenerYEjecutar(callback) {
    if (html5QrcodeScanner && html5QrcodeScanner.isScanning) {
        html5QrcodeScanner.stop().then(() => {
            readerContainer.classList.add('hidden');
            callback();
        }).catch(() => {
            readerContainer.classList.add('hidden');
            callback();
        });
    } else {
        readerContainer.classList.add('hidden');
        callback();
    }
}

// 1. BUSCADOR POR CÓDIGO MANUAL
document.getElementById('btn-manual-search').addEventListener('click', () => {
    let codigo = manualBarcode.value.trim();
    if (codigo) detenerYEjecutar(() => buscarCodigo(codigo));
});
manualBarcode.addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('btn-manual-search').click(); });

function buscarCodigo(barcode) {
    barcode = barcode.trim();
    let foundDept = null;
    let foundIdx = -1;

    for (let dept in inventoryData) {
        for (let i = 0; i < inventoryData[dept].length; i++) {
            if (inventoryData[dept][i].barcode === barcode) {
                foundDept = dept; foundIdx = i; break;
            }
        }
        if (foundDept) break;
    }
    if (foundDept) openProductByIndex(foundDept, foundIdx);
    else alert("El código (" + barcode + ") no coincide con ningún producto.");
}

// 2. BUSCADOR POR NOMBRE (TEXTO Y VOZ)
const btnDictate = document.getElementById('btn-dictate');
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-AR'; // Español de Argentina
    recognition.interimResults = false;

    btnDictate.addEventListener('click', () => {
        try {
            recognition.start();
            manualName.placeholder = "Escuchando voz...";
            btnDictate.style.backgroundColor = "#f44336"; 
        } catch(e) {}
    });

    recognition.onresult = (event) => {
        manualName.value = event.results[0][0].transcript;
        btnDictate.style.backgroundColor = "#2196F3";
        manualName.placeholder = "Escribe o dicta el nombre...";
        document.getElementById('btn-name-search').click(); // Auto-buscar al terminar de hablar
    };

    recognition.onerror = () => {
        btnDictate.style.backgroundColor = "#2196F3";
        manualName.placeholder = "Escribe o dicta el nombre...";
    };
    recognition.onend = () => {
        btnDictate.style.backgroundColor = "#2196F3";
        manualName.placeholder = "Escribe o dicta el nombre...";
    };
} else {
    btnDictate.style.display = 'none'; // Ocultar si el navegador no soporta micrófono web
}

document.getElementById('btn-name-search').addEventListener('click', () => {
    let query = manualName.value.trim().toLowerCase();
    if (query === "") return;
    
    searchResults.innerHTML = '';
    let matches = [];

    for (let dept in inventoryData) {
        let items = inventoryData[dept];
        for (let i = 0; i < items.length; i++) {
            if (items[i].name.toLowerCase().includes(query)) {
                matches.push({ dept: dept, name: items[i].name, index: i });
            }
        }
    }

    if (matches.length === 0) {
        searchResults.style.display = 'none';
        alert("No se encontró ningún producto que contenga: " + query);
    } else if (matches.length === 1) {
        // Si hay un solo resultado exacto, ir directo a él
        searchResults.style.display = 'none';
        detenerYEjecutar(() => openProductByIndex(matches[0].dept, matches[0].index));
    } else {
        // Mostrar lista de resultados si hay múltiples coincidencias
        searchResults.style.display = 'flex';
        matches.forEach(match => {
            let btn = document.createElement('button');
            btn.innerHTML = `<b style="color:#2e7d32;">[${match.dept}]</b> ${match.name}`;
            btn.style.padding = "12px";
            btn.style.border = "1px solid #ccc";
            btn.style.borderRadius = "4px";
            btn.style.background = "#fafafa";
            btn.style.textAlign = "left";
            btn.style.fontSize = "1rem";
            btn.style.cursor = "pointer";
            btn.onclick = () => {
                searchResults.style.display = 'none';
                detenerYEjecutar(() => openProductByIndex(match.dept, match.index));
            };
            searchResults.appendChild(btn);
        });
    }
});

manualName.addEventListener('keypress', (e) => { if (e.key === 'Enter') document.getElementById('btn-name-search').click(); });

function openProductByIndex(foundDept, foundIdx) {
    renderDept(foundDept); 
    setTimeout(() => {
        let itemRow = document.getElementById('row_' + foundIdx);
        if (itemRow) {
            itemRow.scrollIntoView({ behavior: "smooth", block: "center" });
            let originalBg = itemRow.style.backgroundColor;
            itemRow.style.backgroundColor = "#fffae6"; 
            itemRow.style.border = "2px solid #ff9800";
            let qtyInput = document.getElementById('qty_' + foundIdx);
            if (qtyInput) qtyInput.focus();
            setTimeout(() => {
                itemRow.style.backgroundColor = originalBg;
                itemRow.style.border = "1px solid #ddd";
            }, 3000);
        }
    }, 150);
}

btnBack.addEventListener('click', () => renderHome());
init();
