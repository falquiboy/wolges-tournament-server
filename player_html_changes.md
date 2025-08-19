# Cambios a player.html para manejo de comodines

## Resumen
Estos son los cambios necesarios para implementar correctamente el manejo de comodines (blanks) en la interfaz del jugador, incluyendo:
1. Botón visual para activar modo comodín
2. Detección de dígrafos comodín mientras se escribe
3. Visualización en rojo de los comodines
4. Desactivación de alertas molestas

## Cambios específicos

### 1. Agregar botón de comodín en el HTML (línea ~434)
```html
<button type="button" id="blankBtn" class="blank-toggle" onclick="toggleBlankMode()" title="Comodín - Click para activar" aria-label="Comodín">
</button>
```

### 2. Agregar estilos CSS para el botón comodín (línea ~225)
```css
.blank-toggle {
    width: 42px;
    height: 42px;
    background: #fff8dc;
    border: 2px solid #d4a574;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.blank-toggle.active {
    background: #e74c3c;
    border-color: #c0392b;
    transform: scale(1.05);
    box-shadow: 0 3px 6px rgba(231,76,60,0.3);
}
```

### 3. Agregar variable global y función toggleBlankMode (línea ~477)
```javascript
let blankModeActive = false;

function toggleBlankMode() {
    blankModeActive = !blankModeActive;
    const btn = document.getElementById('blankBtn');
    const indicator = document.getElementById('blankIndicator');
    
    if (blankModeActive) {
        btn.classList.add('active');
        indicator.style.display = 'block';
    } else {
        btn.classList.remove('active');
        indicator.style.display = 'none';
    }
    
    // Focus back on word input
    document.getElementById('wordInput').focus();
}
```

### 4. Actualizar función updateWordDisplay para aceptar blankPositions
```javascript
// Función para actualizar el display visual
function updateWordDisplay(processedValue, blankPositions) {
    const display = document.getElementById('wordDisplay');
    display.innerHTML = '';
    
    // Usar las posiciones de blanks para determinar qué colorear
    for (let i = 0; i < processedValue.length; i++) {
        const char = processedValue[i];
        const span = document.createElement('span');
        
        // Solo colorear de rojo si está marcado como blank en blankPositions
        if (blankPositions && blankPositions[i]) {
            span.className = 'blank-char';
            span.style.color = '#e74c3c';
            span.style.fontWeight = 'bold';
        }
        
        span.textContent = char.toUpperCase();
        display.appendChild(span);
    }
}
```

### 5. Reemplazar el event listener del wordInput completo
```javascript
// Configurar input de palabra
document.getElementById('wordInput').addEventListener('input', function(e) {
    const cursorPos = e.target.selectionStart;
    const value = e.target.value;
    const previousValue = e.target.dataset.previousValue || '';
    const previousBlanks = e.target.dataset.blanks ? JSON.parse(e.target.dataset.blanks) : [];
    const pendingBlank = e.target.dataset.pendingBlank ? JSON.parse(e.target.dataset.pendingBlank) : null;
    let newValue = '';
    let newCursorPos = cursorPos;
    let deactivateBlankMode = false;
    let blankPositions = [];
    let newPendingBlank = '';
    
    for (let i = 0; i < value.length; i++) {
        const char = value[i].toUpperCase();
        
        // Primero verificar si hay un blank pendiente que puede formar dígrafo
        if (pendingBlank && pendingBlank.position === i - 1) {
            const pendingChar = pendingBlank.char;
            let formedDigraph = false;
            
            if (pendingChar === 'C' && char === 'H') {
                // Reemplazar la C pendiente con ch
                newValue = newValue.slice(0, -1) + 'ch';
                blankPositions[blankPositions.length - 1] = true;
                blankPositions.push(true);
                formedDigraph = true;
            } else if (pendingChar === 'L' && char === 'L') {
                // Reemplazar la L pendiente con ll
                newValue = newValue.slice(0, -1) + 'll';
                blankPositions[blankPositions.length - 1] = true;
                blankPositions.push(true);
                formedDigraph = true;
            } else if (pendingChar === 'R' && char === 'R') {
                // Reemplazar la R pendiente con rr
                newValue = newValue.slice(0, -1) + 'rr';
                blankPositions[blankPositions.length - 1] = true;
                blankPositions.push(true);
                formedDigraph = true;
            }
            
            if (formedDigraph) {
                newPendingBlank = ''; // Clear pending
                deactivateBlankMode = true; // Deactivate blank mode after forming digraph
                continue;
            } else {
                // No formó dígrafo, convertir el pendiente a minúscula
                newValue = newValue.slice(0, -1) + pendingChar.toLowerCase();
                blankPositions[blankPositions.length - 1] = true;
                deactivateBlankMode = true;
                newPendingBlank = '';
                // Continuar procesando el carácter actual normalmente
            }
        }
        
        // Si el modo comodín está activo y es una nueva letra
        if (blankModeActive && /[A-Z]/.test(char) && (!previousValue[i] || previousValue[i] !== value[i])) {
            // Si es C, L o R, podría formar un dígrafo - mantener pendiente
            if ((char === 'C' || char === 'L' || char === 'R') && i === value.length - 1) {
                newValue += char; // Agregar temporalmente en mayúscula
                blankPositions.push(false); // Temporalmente no es blank
                newPendingBlank = { char: char, position: i };
            } else {
                // No puede formar dígrafo, convertir a minúscula
                newValue += char.toLowerCase();
                blankPositions.push(true);
                deactivateBlankMode = true;
            }
        } else if (/[a-z]/.test(value[i]) && previousBlanks[i]) {
            // Mantener minúscula solo si ya estaba marcada como comodín
            newValue += value[i];
            blankPositions.push(true);
        } else if (/[A-Za-z]/.test(char)) {
            // Convertir a mayúscula (letra normal)
            newValue += char.toUpperCase();
            blankPositions.push(false);
        } else if (char === 'Ñ' || value[i] === 'ñ') {
            newValue += 'Ñ';
            blankPositions.push(false);
        }
    }
    
    // Si quedó un blank pendiente al final, convertirlo a minúscula
    if (pendingBlank && newValue.length > 0 && newValue.length <= previousValue.length) {
        const lastCharIndex = newValue.length - 1;
        if (lastCharIndex === pendingBlank.position) {
            newValue = newValue.slice(0, -1) + pendingBlank.char.toLowerCase();
            blankPositions[lastCharIndex] = true;
            deactivateBlankMode = true;
            newPendingBlank = '';
        }
    }
    
    if (value !== newValue) {
        e.target.value = newValue;
        e.target.setSelectionRange(newCursorPos, newCursorPos);
    }
    
    e.target.dataset.previousValue = newValue;
    e.target.dataset.blanks = JSON.stringify(blankPositions);
    e.target.dataset.pendingBlank = newPendingBlank ? JSON.stringify(newPendingBlank) : '';
    
    // Actualizar display visual
    updateWordDisplay(newValue, blankPositions);
    
    // Desactivar modo comodín si se usó (excepto si hay pending)
    if (deactivateBlankMode && !newPendingBlank) {
        blankModeActive = false;
        document.getElementById('blankBtn').classList.remove('active');
        document.getElementById('blankIndicator').style.display = 'none';
    }
});
```

### 6. Actualizar limpieza del formulario en showGameScreen
```javascript
// Limpiar formulario
document.getElementById('coordInput').value = '';
document.getElementById('wordInput').value = '';
document.getElementById('wordInput').dataset.previousValue = '';
document.getElementById('wordInput').dataset.blanks = '[]';
updateWordDisplay('', []); // Limpiar display visual
```

### 7. Desactivar alertas molestas
Reemplazar todos los `alert()` relacionados con jugadas inválidas por `console.error()`:

```javascript
// En submitPlay:
} else {
    console.error('Formato de coordenada inválido');
    return;
}

// Validar rango
if (row < 0 || row > 14 || col < 0 || col > 14) {
    console.error('Coordenada fuera del tablero');
    return;
}

// En sendPlay:
} else {
    // Silently handle errors - don't show alerts
    console.error('Error al enviar jugada:', result.error);
    document.getElementById('submitBtn').disabled = false;
}
```

### 8. Agregar indicador visual del modo comodín
```html
<div id="blankIndicator" style="display: none; margin-top: 5px; font-size: 12px; color: #e74c3c;">
    Modo comodín activado - La siguiente letra será comodín
</div>
```

## Notas importantes
- Los comodines se muestran en minúsculas internamente pero en mayúsculas visualmente con color rojo
- Los dígrafos comodín (ch, ll, rr) se detectan automáticamente cuando se activa el modo comodín
- El modo comodín se desactiva automáticamente después de ingresar una letra o dígrafo
- La confirmación de jugada muestra los comodines en minúscula para cumplir con el reglamento