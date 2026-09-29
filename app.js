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
        const csvText = await response.text();
        parseCSV(csvText);
        renderHome();
    } catch (error) {
        appContent.innerHTML = `<div class="text-center" style="color:red;">Error al cargar el inventario. Verifica tu conexión a internet o los permisos del documento.</div>`;
        console.error("Error fetching CSV:", error);
    }
}

function parseCSV(text) {
    const lines = text.split('\n').filter(line => line.trim() !== '');
    
    // Si la primera fila es encabezado (ej. "Descripción", "Articulo"), empezamos desde la fila 1
    let startIndex = 0;
    if (lines[0].toLowerCase().includes('descrip') || lines[0].toLowerCase().includes('rubro') || lines[0].toLowerCase().includes('art') || !lines[0].includes('-')) {
        startIndex = 1;
    }

    for (let i = startIndex; i < lines.length; i++) {
        let line = lines[i].replace(/^"|"$/g, '').trim(); 
        
        // El formato CSV separa por comas, tomamos la primera columna ignorando comas internas
        // Un split simple funciona si no hay comas literales en la descripción.
        let rawName = line.split(',')[0].replace(/(^"|"$)/g, '').trim();

        // Extraer prefijo (Asume formato: "PREFIJO - Nombre" o "PREFIJO_Nombre" o "PREFIJO Nombre")
        let match = rawName.match(/^([A-Z0-9]+)\s*[-_]?\s*(.+)$/i);
        if (match) {
            let dept = match[1].toUpperCase();
            let name = match[2];
            
            if (!inventoryData[dept]) {
                inventoryData[dept] = [];
            }
            inventoryData[dept].push({
                originalName: rawName,
                name: name
            });
        }
    }
}

function renderHome() {
    currentDept = null;
    btnBack.classList.add('hidden');
    headerTitle.textContent = "Inventario Ivette";

    let html = `<div class="container">`;
    const depts = Object.keys(inventoryData).sort();
    
    if (depts.length === 0) {
        html += `<div class="text-center">No se encontraron departamentos. Verifica el formato del CSV de Google Sheets.</div>`;
    } else {
        html += `<p style="margin-bottom:15px; color:#555;">Seleccione un departamento:</p>`;
        depts.forEach(dept => {
            html += `<button class="dept-btn" onclick="renderDept('${dept}')">📂 Departamento: ${dept}</button>`;
        });
        
        html += `<hr style="margin: 25px 0; border: 0; border-top: 1px solid #ccc;">`;
        html += `<button class="btn btn-danger" onclick="clearAllData()">Borrar TODO el inventario</button>`;
    }
    
    html += `</div>`;
    appContent.innerHTML = html;
}

window.renderDept = function(dept) {
    currentDept = dept;
    btnBack.classList.remove('hidden');
    headerTitle.textContent = "Dpto: " + dept;

    const items = inventoryData[dept];
    let html = `<div class="container" id="dept-form">`;
    html += `<p style="margin-bottom:15px; color:#555;">Ingrese las cantidades. Puede usar sumas (ej: 5 + 10).</p>`;
    
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

    html += `
        <button class="btn btn-primary" onclick="saveDept()">Guardar / Agregar al inventario</button>
        <button class="btn btn-danger" onclick="clearDept('${dept}')">Borrar e iniciar desde cero</button>
    </div>`;

    appContent.innerHTML = html;
    
    // Scroll arriba
    window.scrollTo(0,0);
}

window.evaluateInput = function(inputEl) {
    let val = inputEl.value.trim();
    if (!val) return;
    
    try {
        let sanitized = val.replace(/[^0-9+\-*/(). ]/g, '');
        if (sanitized) {
            let result = Function(\`'use strict'; return (\${sanitized})\`)();
            if (result !== undefined && !isNaN(result)) {
                inputEl.value = result;
            }
        }
    } catch (e) {
        console.warn("No se pudo evaluar la expresión matemática", e);
    }
}

window.saveDept = function() {
    const inputs = document.querySelectorAll('.item-input');
    inputs.forEach(input => {
        evaluateInput(input); // Convertir operaciones a resultado final
        
        const id = input.getAttribute('data-id');
        const val = input.value.trim();
        if (val) {
            savedData[id] = val;
        } else {
            delete savedData[id];
        }
    });
    
    localStorage.setItem('inventario_ivette_data', JSON.stringify(savedData));
    alert("¡Inventario del departamento guardado correctamente!");
    renderHome();
}

window.clearDept = function(dept) {
    if(confirm(\`¿Estás seguro de borrar los datos contados de '\${dept}' e iniciar desde cero?\`)) {
        const items = inventoryData[dept];
        items.forEach(item => {
            delete savedData[item.originalName];
        });
        localStorage.setItem('inventario_ivette_data', JSON.stringify(savedData));
        renderDept(dept); 
    }
}

window.clearAllData = function() {
    if(confirm("¡ATENCIÓN! ¿Estás seguro de borrar TODO el inventario guardado globalmente? Esta acción no se puede deshacer.")) {
        savedData = {};
        localStorage.removeItem('inventario_ivette_data');
        renderHome();
        alert("Todo el inventario ha sido borrado e inicializado desde cero.");
    }
}

btnBack.addEventListener('click', () => {
    // Regresar al home
    renderHome();
});

// Arrancar App
init();
