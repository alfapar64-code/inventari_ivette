const CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSMpG3eag6FmM46ZF024-8tcKH0TCylnNUxyKxD6-nVJXYDfPgPbAUoAKAtjrcFOleIrpUuzyY7GnTT/pub?output=csv";

let inventoryData = {}; 
let savedData = JSON.parse(localStorage.getItem('inventario_ivette_data')) || {};
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

    let startIndex = 0;
    if (lines[0].toLowerCase().includes('dpto') || lines[0].toLowerCase().includes('descrip')) {
        startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
        let line = lines[i];
        
        let cols = [];
        let inQuotes = false;
        let current = '';
        for (let char of line) {
            if (char === '"') inQuotes = !inQuotes;
            else if (char === delimiter && !inQuotes) {
                cols.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        cols.push(current.trim());

        if (cols.length >= 2) {
            let dept = cols[0].replace(/^"|"$/g, '').trim().toUpperCase();
            let originalName = cols.slice(1).join(delimiter).replace(/^"|"$/g, '').trim();

            if (dept === "" || originalName === "") continue;

            // Elimina la abreviatura del departamento si aparece al inicio de la descripción
            let escapedDept = dept.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            let prefixRegex = new RegExp('^' + escapedDept + '[\\s\\.\\-_]+', 'i');
            let name = originalName.replace(prefixRegex, '');

            if (!inventoryData[dept]) {
                inventoryData[dept] = [];
            }
            inventoryData[dept].push({
                originalName: originalName,
                name: name
            });
        }
    }
}

function renderHome() {
    currentDept = null;
    btnBack.classList.add('hidden');
    headerTitle.textContent = "Inventario Ivette";

    let html = '<div class="container">';
    const depts = Object.keys(inventoryData).sort();
    
    if (depts.length === 0) {
        html += '<div class="text-center">No se encontraron departamentos. Revisa la estructura del CSV.</div>';
    } else {
        html += '<p style="margin-bottom:15px; color:#555;">Seleccione un departamento:</p>';
        depts.forEach(dept => {
            html += '<button class="dept-btn" onclick="renderDept(\'' + dept + '\')">📂 Departamento: ' + dept + '</button>';
        });
        
        html += '<hr style="margin: 25px 0; border: 0; border-top: 1px solid #ccc;">';
        html += '<button class="btn btn-danger" onclick="clearAllData()">Borrar TODO el inventario</button>';
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
    html += '<p style="margin-bottom:15px; color:#555;">Ingrese cantidades. (Permite sumas: 5 + 10)</p>';
    
    items.forEach((item) => {
        let savedValue = savedData[item.originalName] || '';
        html += `
            <div class="item-row">
                <div class="item-name">${item.name}</div>
                <div class="item-input-group">
                    <input type="text" class="item-input" inputmode="text" placeholder="Ej: 5 + 10" 
                           data-id="${item.originalName}" value="${savedValue}" onblur="evaluateInput(this)">
                </div>
            </div>
        `;
    });

    html += '<button class="btn btn-primary" onclick="saveDept()">Guardar / Agregar al inventario</button>';
    html += '<button class="btn btn-danger" onclick="clearDept(\'' + dept + '\')">Borrar e iniciar desde cero</button>';
    html += '</div>';

    appContent.innerHTML = html;
    window.scrollTo(0,0);
}

window.evaluateInput = function(inputEl) {
    let val = inputEl.value.trim();
    if (!val) return;
    try {
        let sanitized = val.replace(/[^0-9+\-*/(). ]/g, '');
        if (sanitized) {
            let result = Function("'use strict'; return (" + sanitized + ")")();
            if (result !== undefined && !isNaN(result)) {
                inputEl.value = result;
            }
        }
    } catch (e) {
        console.warn("Fórmula no válida");
    }
}

window.saveDept = function() {
    const inputs = document.querySelectorAll('.item-input');
    inputs.forEach(input => {
        evaluateInput(input); 
        const id = input.getAttribute('data-id');
        const val = input.value.trim();
        if (val) {
            savedData[id] = val;
        } else {
            delete savedData[id];
        }
    });
    localStorage.setItem('inventario_ivette_data', JSON.stringify(savedData));
    alert("¡Inventario guardado!");
    renderHome();
}

window.clearDept = function(dept) {
    if(confirm("¿Borrar datos de " + dept + " e iniciar de cero?")) {
        const items = inventoryData[dept];
        items.forEach(item => delete savedData[item.originalName]);
        localStorage.setItem('inventario_ivette_data', JSON.stringify(savedData));
        renderDept(dept); 
    }
}

window.clearAllData = function() {
    if(confirm("¡ATENCIÓN! ¿Borrar TODO el inventario guardado?")) {
        savedData = {};
        localStorage.removeItem('inventario_ivette_data');
        renderHome();
        alert("Inventario borrado por completo.");
    }
}

btnBack.addEventListener('click', () => renderHome());
init();
