// EXPORTACIÓN A EXCEL (.XLS CON FORMATO)
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
    
    // Ordenar desde el más vencido hasta el más lejano
    itemsToExport.sort((a, b) => a.days - b.days);

    // Formatear la fecha actual de Argentina (ej: 01/10/2026 a las 06:42)
    let now = new Date();
    let dateString = now.toLocaleDateString('es-AR') + ' a las ' + now.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'});
    
    // Construir estructura HTML que Excel lee nativamente con formato
    let excelContent = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
        <meta charset="utf-8">
        <style>
            table { border-collapse: collapse; font-family: Calibri, Arial, sans-serif; }
            th, td { border: 1px solid #a6a6a6; text-align: center; vertical-align: middle; padding: 5px; }
            th { background-color: #e7e6e6; font-weight: bold; }
            .title-row td { font-size: 14px; font-weight: bold; text-align: center; border: none; padding-bottom: 15px; }
        </style>
    </head>
    <body>
        <table>
            <tr class="title-row">
                <td colspan="5">Reporte de Promociones y Vencimientos - Generado el: ${dateString}</td>
            </tr>
            <tr>
                <th style="width: 100px;">Departamento</th>
                <th style="width: 350px;">Rubro</th>
                <th style="width: 80px;">Cantidad</th>
                <th style="width: 140px;">Fecha de Vencimiento</th>
                <th style="width: 160px;">Estado / Días Restantes</th>
            </tr>`;
    
    itemsToExport.forEach(row => {
        let status = row.days < 0 ? `Vencido hace ${Math.abs(row.days)} días` : `${row.days} días`;
        excelContent += `
            <tr>
                <td>${row.dept}</td>
                <td>${row.name}</td>
                <td>${row.qty}</td>
                <td>${row.expDate}</td>
                <td>${status}</td>
            </tr>`;
    });
    
    excelContent += `
        </table>
    </body>
    </html>`;
    
    // Generar archivo descargable
    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", dept ? `Promociones_${dept}.xls` : "Promociones_Inventario_Completo.xls");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
