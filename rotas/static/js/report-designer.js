/**
 * Report Designer - Sistema completo de edição visual de relatórios
 * Similar ao FastReport
 */

// ===== RENDERING =====

function renderCanvas() {
    console.log('renderCanvas called');
    const canvasPage = document.getElementById('canvasPage');
    console.log('canvasPage element:', canvasPage);
    
    if (!canvasPage) {
        console.error('canvasPage element not found!');
        return;
    }
    
    console.log('layoutData:', layoutData);
    console.log('layoutData.bands:', layoutData?.bands);
    
    if (!layoutData || !layoutData.bands) {
        console.error('layoutData or layoutData.bands is missing!');
        return;
    }
    
    canvasPage.innerHTML = '';
    
    const visibleBands = layoutData.bands.filter(b => b.visible);
    console.log('Visible bands to render:', visibleBands.length);
    
    visibleBands.forEach(band => {
        console.log('Rendering band:', band.name);
        const bandEl = createBandElement(band);
        canvasPage.appendChild(bandEl);
    });
    
    // Garantir z-indexes corretos após renderização
    setTimeout(() => {
        ensureCorrectZIndices();
        console.log('Z-indices enforced after rendering');
        console.log('💡 DEBUG TOOLS: Ctrl+D = element info, Ctrl+Click = elements at point, fixZIndices() = fix z-index issues');
    }, 10);
    
    console.log('renderCanvas completed');
}

function createBandElement(band) {
    const bandEl = document.createElement('div');
    bandEl.className = 'band';
    bandEl.dataset.bandId = band.id;
    bandEl.style.height = `${band.height}px`;
    if (band.background_color) {
        bandEl.style.backgroundColor = band.background_color;
    }
    
    // Band header color by type
    const HEADER_COLORS = {
        page_header: '#1177bb', page_footer: '#1177bb',
        header: '#0e7c34', footer: '#0e7c34',
        detail: '#805500',
        group_header: '#8b5e00', group_footer: '#3d6e20'
    };
    const headerColor = HEADER_COLORS[band.type] || '#0e639c';
    
    // Band Header
    const header = document.createElement('div');
    header.className = 'band-header';
    header.style.background = headerColor;
    const groupTag = (band.type === 'group_header' || band.type === 'group_footer') && band.group_field
        ? ` <span style="font-size:10px;opacity:0.8;">[${band.group_field}]</span>` : '';
    header.innerHTML = `
        <span>${band.name}${groupTag}</span>
        <span>${band.height}px</span>
    `;
    bandEl.appendChild(header);
    
    // Band Body
    const body = document.createElement('div');
    body.className = 'band-body';
    body.dataset.bandId = band.id;
    
    // Render elements - ordenados por z_index para renderização correta
    const sortedElements = band.elements.slice().sort((a, b) => (a.z_index || 1) - (b.z_index || 1));
    
    sortedElements.forEach(element => {
        const elementEl = createElementNode(element, band.id);
        body.appendChild(elementEl);
    });
    
    bandEl.appendChild(body);
    
    // Resize Handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'band-handle';
    resizeHandle.dataset.bandId = band.id;
    bandEl.appendChild(resizeHandle);
    
    // Events
    header.addEventListener('click', () => selectBand(band.id));
    
    // Event delegation para todos os eventos de elementos
    body.addEventListener('click', (e) => {
        const reportElement = e.target.closest('.report-element');
        if (reportElement) {
            e.stopPropagation();
            const elementId = reportElement.dataset.elementId;
            const bandId = reportElement.dataset.bandId;
            const elementType = reportElement.dataset.elementType;
            console.log(`Band body click detected on element: ${elementId} (type: ${elementType})`);
            
            // Log extra para elementos aggregate
            if (elementType === 'aggregate') {
                console.log('🎯 AGGREGATE element clicked!', {
                    elementId,
                    bandId,
                    zIndex: reportElement.style.zIndex,
                    position: `${reportElement.style.left}, ${reportElement.style.top}`,
                    size: `${reportElement.style.width} x ${reportElement.style.height}`,
                    textContent: reportElement.textContent
                });
            }
            
            selectElement(elementId, bandId, e.shiftKey);
        } else {
            // Clique na banda vazia
            console.log('Click on empty band area');
            selectBand(band.id);
        }
    });
    
    body.addEventListener('mousedown', (e) => {
        const reportElement = e.target.closest('.report-element');
        if (reportElement) {
            const elementId = reportElement.dataset.elementId;
            const bandId = reportElement.dataset.bandId;
            console.log(`Element mousedown via delegation: ${elementId}`);
            startDragElement(e, elementId, bandId);
        }
    });
    
    body.addEventListener('contextmenu', (e) => {
        const reportElement = e.target.closest('.report-element');
        if (reportElement) {
            const elementId = reportElement.dataset.elementId;
            const bandId = reportElement.dataset.bandId;
            showContextMenu(e, elementId, bandId);
        }
    });
    
    resizeHandle.addEventListener('mousedown', (e) => startResizeBand(e, band.id));
    
    // Drop events
    body.addEventListener('dragover', handleDragOver);
    body.addEventListener('drop', (e) => handleDrop(e, band.id));
    
    return bandEl;
}

function createElementNode(element, bandId) {
    console.log(`Creating element ${element.id} with z_index:`, element.z_index);
    console.log(`Element type: ${element.type}, content will be: "${getElementDisplayText(element)}"`);
    
    const el = document.createElement('div');
    el.className = 'report-element';
    el.dataset.elementId = element.id;
    el.dataset.bandId = bandId;
    el.dataset.elementType = element.type;
    
    // Position and size
    el.style.left = `${element.x || 0}px`;
    el.style.top = `${element.y || 0}px`;
    el.style.width = `${element.width || 100}px`;
    el.style.height = `${element.height || 20}px`;
    
    // Z-index (importante para permitir seleção correta)
    const zIndex = element.z_index || 1;
    el.style.zIndex = zIndex;
    
    // CRÍTICO: Garantir que elementos sejam sempre clicáveis
    el.style.pointerEvents = 'auto';
    el.style.position = 'absolute';
    
    // Para elementos aggregate (Sum), dar z-index extra alto por padrão
    if (element.type === 'aggregate') {
        el.style.zIndex = Math.max(zIndex, 100);
        el.style.backgroundColor = 'rgba(255, 255, 0, 0.1)'; // Fundo levemente amarelo para debug
        console.log(`AGGREGATE element ${element.id} created with enhanced z-index: ${el.style.zIndex}`);
    }
    
    console.log(`Element ${element.id} positioned at (${element.x}, ${element.y}) with z-index: ${el.style.zIndex}`);
    
    // Style
    if (element.font_family) el.style.fontFamily = element.font_family;
    if (element.font_size) el.style.fontSize = `${element.font_size}px`;
    if (element.font_bold) el.style.fontWeight = 'bold';
    if (element.font_italic) el.style.fontStyle = 'italic';
    if (element.font_underline) el.style.textDecoration = 'underline';
    if (element.color) el.style.color = element.color;
    if (element.background_color) el.style.backgroundColor = element.background_color;
    if (element.alignment) el.style.textAlign = element.alignment;
    if (element.vertical_alignment) {
        el.style.display = 'flex';
        el.style.alignItems = element.vertical_alignment === 'top' ? 'flex-start' : 
                              element.vertical_alignment === 'bottom' ? 'flex-end' : 'center';
    }
    
    // Border
    if (element.border_width) {
        el.style.borderWidth = `${element.border_width}px`;
        el.style.borderStyle = element.border_style || 'solid';
        el.style.borderColor = element.border_color || '#000';
    }
    
    // Content
    const displayText = getElementDisplayText(element);
    el.textContent = displayText;
    console.log(`Element ${element.id} (${element.type}) will display: "${displayText}"`);
    
    // Adicionar atributo adicional para debug
    el.setAttribute('data-debug-info', `${element.type}-${element.id}`);
    
    // Não adicionar event listeners individuais - usar event delegation da banda
    // Events serão gerenciados pelo body da banda via event delegation
    
    return el;
    
    return el;
}

function getElementDisplayText(element) {
    switch (element.type) {
        case 'text':
            return element.text || 'Texto';
        case 'field':
            return `[${element.data_field || 'Campo'}]`;
        case 'expression':
            return element.expression || '[Expressão]';
        case 'aggregate':
            return `${element.aggregate_function || 'SUM'}([${element.aggregate_field || 'Campo'}])`;
        case 'line':
            return '―';
        case 'rectangle':
            return '';
        case 'image':
            return '🖼️';
        case 'barcode':
            return '|||||||';
        case 'qrcode':
            return '▦';
        case 'checkbox':
            return element.checkbox_field ? `☑ [${element.checkbox_field}]` : '☑ Caixa';
        case 'richtext':
            return element.richtext_content ? element.richtext_content.substring(0, 40) : '📃 Texto Rico';
        case 'datatable':
            return `📋 Tabela (${(element.datatable_columns || []).length} colunas)`;
        case 'chart':
            return `📈 Gráfico ${(element.chart_type || 'barra').toUpperCase()}`;
        case 'datefield':
            return `📅 [${element.data_field || 'Data'}] (${element.date_format || 'dd/mm/yyyy'})`;
        case 'numericfield': {
            const _pre = element.number_prefix || '';
            const _suf = element.number_suffix || '';
            return `${_pre}[${element.data_field || 'Número'}]${_suf}`;
        }
        case 'subreport':
            return `📄 Sub: ${element.subreport_name || 'Sem nome'}`;
        default:
            return element.name || 'Elemento';
    }
}

// ===== DEBUG FUNCTIONS =====

function debugElementInfo() {
    console.log('=== DEBUG: All elements in DOM ===');
    const elements = document.querySelectorAll('.report-element');
    elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        console.log(`Element ${index + 1}:`, {
            id: el.dataset.elementId,
            bandId: el.dataset.bandId,
            type: el.dataset.elementType,
            position: `(${el.style.left}, ${el.style.top})`,
            size: `${el.style.width} x ${el.style.height}`,
            zIndex: el.style.zIndex,
            computedZIndex: window.getComputedStyle(el).zIndex,
            isVisible: rect.width > 0 && rect.height > 0,
            boundingRect: {
                left: Math.round(rect.left),
                top: Math.round(rect.top),
                right: Math.round(rect.right),
                bottom: Math.round(rect.bottom),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            },
            selected: el.classList.contains('selected'),
            content: el.textContent.substring(0, 20)
        });
    });
    console.log('=== END DEBUG ===');
}

// Adicionar listener para debug com Ctrl+D
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        debugElementInfo();
    }
});

// Adicionar listener para detectar elementos em uma posição específica (Ctrl+Click)
document.addEventListener('click', (e) => {
    if (e.ctrlKey) {
        e.preventDefault();
        const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
        console.log('Elements at click point:', elementsAtPoint.map(el => ({ 
            tagName: el.tagName, 
            className: el.className, 
            id: el.id, 
            dataset: el.dataset,
            zIndex: el.style.zIndex || window.getComputedStyle(el).zIndex
        })));
    }
});

// ===== Z-INDEX MANAGEMENT =====

function updateElementZIndex(elementEl, elementId, bandId) {
    // Encontrar o elemento nos dados para obter seu z_index correto
    const band = layoutData.bands.find(b => b.id === bandId);
    if (band) {
        const element = band.elements.find(e => e.id === elementId);
        if (element) {
            elementEl.style.zIndex = element.z_index || 1;
        }
    }
}

function setSelectedElementZIndex(elementEl) {
    // Dar z-index alto para elemento selecionado
    elementEl.style.zIndex = 9999;
}

function ensureCorrectZIndices() {
    // Função para garantir que todos os elementos tenham z-index correto
    layoutData.bands.forEach(band => {
        band.elements.forEach(element => {
            const elementEl = document.querySelector(`[data-element-id="${element.id}"]`);
            if (elementEl && !elementEl.classList.contains('selected')) {
                elementEl.style.zIndex = element.z_index || 1;
            }
        });
    });
}

function fixAllZIndices() {
    // Função mais agressiva para reorganizar todos os z-index
    console.log('Fixing all z-indices...');
    
    layoutData.bands.forEach((band, bandIndex) => {
        if (band.elements && band.elements.length > 0) {
            // Reorganizar z-index sequencialmente
            band.elements.forEach((element, elementIndex) => {
                const newZIndex = elementIndex + 1;
                element.z_index = newZIndex;
                
                const elementEl = document.querySelector(`[data-element-id="${element.id}"]`);
                if (elementEl) {
                    if (elementEl.classList.contains('selected')) {
                        elementEl.style.zIndex = 9999;
                    } else {
                        elementEl.style.zIndex = newZIndex;
                    }
                    console.log(`Fixed element ${element.id}: z-index = ${elementEl.style.zIndex}`);
                }
            });
        }
    });
    
    console.log('All z-indices fixed');
}

// Adicionar função global para debug
window.fixZIndices = fixAllZIndices;

// Função específica para diagnosticar problema do Sum
function diagnosticClickTest() {
    console.log('=== DIAGNOSTIC: Click Test Mode ===');
    console.log('Clique em qualquer elemento para ver informações detalhadas...');
    
    // Remover listener anterior se existir
    if (window.diagnosticClickListener) {
        document.removeEventListener('click', window.diagnosticClickListener);
    }
    
    // Adicionar novo listener para diagnóstico
    window.diagnosticClickListener = (e) => {
        console.log('--- CLICK DETECTED ---');
        console.log('Mouse position:', { x: e.clientX, y: e.clientY });
        
        // Obter todos os elementos no ponto do clique
        const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
        console.log('All elements at click point:');
        
        elementsAtPoint.forEach((el, index) => {
            const isReportElement = el.classList.contains('report-element');
            const rect = el.getBoundingClientRect();
            
            console.log(`  ${index}: ${el.tagName}`, {
                className: el.className,
                id: el.id,
                elementId: el.dataset?.elementId,
                bandId: el.dataset?.bandId,
                elementType: el.dataset?.elementType,
                isReportElement: isReportElement,
                zIndex: el.style.zIndex || window.getComputedStyle(el).zIndex,
                bounds: {
                    left: Math.round(rect.left),
                    top: Math.round(rect.top),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height)
                },
                textContent: el.textContent?.substring(0, 30)
            });
        });
        
        // Encontrar o elemento report-element mais próximo
        const reportElement = e.target.closest('.report-element');
        if (reportElement) {
            console.log('Closest report element:', {
                elementId: reportElement.dataset.elementId,
                bandId: reportElement.dataset.bandId,
                elementType: reportElement.dataset.elementType,
                selected: reportElement.classList.contains('selected')
            });
        } else {
            console.log('No report element found in target path');
        }
        
        console.log('--- END CLICK INFO ---');
    };
    
    document.addEventListener('click', window.diagnosticClickListener);
    console.log('Click em qualquer lugar para ver diagnóstico. Digite stopDiagnostic() para parar.');
}

function stopDiagnostic() {
    if (window.diagnosticClickListener) {
        document.removeEventListener('click', window.diagnosticClickListener);
        window.diagnosticClickListener = null;
        console.log('Diagnostic stopped');
    }
}

// Função para mostrar todos os elementos no canvas
function showAllElements() {
    console.log('=== ALL ELEMENTS IN CANVAS ===');
    const elements = document.querySelectorAll('.report-element');
    console.log(`Total elements found: ${elements.length}`);
    
    elements.forEach((el, index) => {
        const rect = el.getBoundingClientRect();
        console.log(`Element ${index + 1}:`, {
            elementId: el.dataset.elementId,
            bandId: el.dataset.bandId,
            elementType: el.dataset.elementType,
            position: `left: ${el.style.left}, top: ${el.style.top}`,
            size: `${el.style.width} x ${el.style.height}`,
            zIndex: el.style.zIndex,
            computedZIndex: window.getComputedStyle(el).zIndex,
            selected: el.classList.contains('selected'),
            textContent: el.textContent.trim(),
            isVisible: rect.width > 0 && rect.height > 0,
            bounds: {
                left: Math.round(rect.left),
                top: Math.round(rect.top),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            }
        });
    });
    
    // Também mostrar dados do layoutData
    console.log('=== LAYOUT DATA ELEMENTS ===');
    if (layoutData && layoutData.bands) {
        layoutData.bands.forEach(band => {
            console.log(`Band ${band.id} (${band.name}) has ${band.elements.length} elements:`);
            band.elements.forEach(element => {
                console.log(`  - ${element.id}: type=${element.type}, text="${element.text || element.data_field || element.aggregate_function}", z_index=${element.z_index}`);
            });
        });
    }
    console.log('=== END ALL ELEMENTS ===');
}

// Adicionar funções globais
window.diagnosticClickTest = diagnosticClickTest;
window.stopDiagnostic = stopDiagnostic;
window.showAllElements = showAllElements;

// Função para testar somatório
function testSumElement() {
    console.log('=== TESTING SUM ELEMENT ===');
    
    // Encontrar elementos de soma no layout
    const aggregateElements = [];
    if (layoutData && layoutData.bands) {
        layoutData.bands.forEach(band => {
            band.elements.forEach(element => {
                if (element.type === 'aggregate') {
                    aggregateElements.push({
                        id: element.id,
                        function: element.aggregate_function,
                        field: element.aggregate_field,
                        bandId: band.id,
                        bandName: band.name
                    });
                }
            });
        });
    }
    
    console.log(`Found ${aggregateElements.length} aggregate elements:`, aggregateElements);
    
    if (aggregateElements.length > 0) {
        console.log('✅ Elementos de soma configurados corretamente!');
        aggregateElements.forEach(el => {
            console.log(`  - ${el.function}(${el.field}) na banda ${el.bandName}`);
        });
    } else {
        console.log('❌ Nenhum elemento de soma encontrado');
    }
    
    console.log('=== END TEST ===');
    return aggregateElements;
}

// Função para mostrar campos esperados pelo layout
function showExpectedFields() {
    console.log('=== EXPECTED FIELDS IN LAYOUT ===');
    
    const expectedFields = new Set();
    const aggregateFields = [];
    
    if (layoutData && layoutData.bands) {
        layoutData.bands.forEach(band => {
            console.log(`\n--- Band: ${band.name} ---`);
            
            band.elements.forEach(element => {
                if (element.type === 'field' && element.data_field) {
                    expectedFields.add(element.data_field);
                    console.log(`  Field element: "${element.data_field}"`);
                }
                
                if (element.type === 'aggregate') {
                    const aggField = element.aggregate_field;
                    const aggFunc = element.aggregate_function;
                    if (aggField) {
                        expectedFields.add(aggField);
                        aggregateFields.push({ func: aggFunc, field: aggField });
                        console.log(`  Aggregate element: ${aggFunc}("${aggField}")`);
                    } else {
                        console.log(`  ⚠️  Aggregate element sem campo definido: ${aggFunc}(?)`);
                    }
                }
                
                if (element.type === 'expression' && element.expression) {
                    console.log(`  Expression element: "${element.expression}"`);
                }
            });
        });
    }
    
    console.log(`\n--- SUMMARY ---`);
    console.log(`Total unique fields expected: ${expectedFields.size}`);
    console.log(`Fields list:`, Array.from(expectedFields).sort());
    console.log(`Aggregate functions:`, aggregateFields);
    console.log('\nPara testar os dados, gere o preview e verifique o console do servidor.');
    console.log('=== END EXPECTED FIELDS ===');
    
    return {
        fields: Array.from(expectedFields),
        aggregates: aggregateFields
    };
}

window.showExpectedFields = showExpectedFields;

// ===== SELECTION =====

function selectElement(elementId, bandId, addToSelection = false) {
    console.log(`Selecting element: ${elementId} in band: ${bandId}, add=${addToSelection}`);
    
    if (addToSelection) {
        // Shift+Click: toggle in multi-select
        const idx = selectedElements.findIndex(e => e.id === elementId);
        if (idx === -1) {
            selectedElements.push({ id: elementId, bandId: bandId });
        } else {
            selectedElements.splice(idx, 1);
        }
        // Keep selectedElement as the last one for properties panel
        if (selectedElements.length > 0) {
            selectedElement = selectedElements[selectedElements.length - 1];
        }
    } else {
        selectedElement = { id: elementId, bandId: bandId };
        selectedElements = [{ id: elementId, bandId: bandId }];
        selectedBand = null;
    }
    
    // Update UI - remove all selection first
    document.querySelectorAll('.report-element').forEach(el => {
        el.classList.remove('selected');
        el.querySelectorAll('.element-resize-handle').forEach(h => h.remove());
        const elemId = el.dataset.elementId;
        const elemBandId = el.dataset.bandId;
        updateElementZIndex(el, elemId, elemBandId);
    });
    
    document.querySelectorAll('.band').forEach(el => el.classList.remove('selected'));
    
    // Mark all selected elements
    selectedElements.forEach(sel => {
        const el = document.querySelector(`[data-element-id="${sel.id}"]`);
        if (el) {
            el.classList.add('selected');
            setSelectedElementZIndex(el);
            // Only add resize handles to the primary selected element
            if (sel.id === selectedElement.id) {
                addResizeHandles(el, sel.id, sel.bandId);
            }
        }
    });
    
    renderProperties();
}

function selectBand(bandId) {
    selectedBand = bandId;
    selectedElement = null;
    selectedElements = [];
    
    // Update UI
    document.querySelectorAll('.report-element').forEach(el => {
        el.classList.remove('selected');
        el.querySelectorAll('.element-resize-handle').forEach(h => h.remove());
    });
    
    document.querySelectorAll('.band').forEach(el => el.classList.remove('selected'));
    
    const bandEl = document.querySelector(`[data-band-id="${bandId}"]`);
    if (bandEl) {
        bandEl.classList.add('selected');
    }
    
    renderProperties();
    updateBandsList();
}

function deselectAll() {
    selectedElement = null;
    selectedBand = null;
    selectedElements = [];
    
    document.querySelectorAll('.report-element').forEach(el => {
        el.classList.remove('selected');
        el.querySelectorAll('.element-resize-handle').forEach(h => h.remove());
    });
    
    document.querySelectorAll('.band').forEach(el => el.classList.remove('selected'));
    
    renderProperties();
}

// ===== RESIZE HANDLES =====

function addResizeHandles(elementEl, elementId, bandId) {
    const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
    
    handles.forEach(position => {
        const handle = document.createElement('div');
        handle.className = `element-resize-handle ${position}`;
        handle.dataset.position = position;
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            startResizeElement(e, elementId, bandId, position);
        });
        elementEl.appendChild(handle);
    });
}

function startResizeElement(e, elementId, bandId, position) {
    e.preventDefault();
    isResizing = true;
    
    const element = findElement(elementId, bandId);
    if (!element) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = element.width || 100;
    const startHeight = element.height || 20;
    const startLeft = element.x || 0;
    const startTop = element.y || 0;
    
    function onMouseMove(e) {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newX = startLeft;
        let newY = startTop;
        
        // Handle different positions
        if (position.includes('e')) newWidth = Math.max(20, startWidth + dx);
        if (position.includes('w')) {
            newWidth = Math.max(20, startWidth - dx);
            newX = startLeft + (startWidth - newWidth);
        }
        if (position.includes('s')) newHeight = Math.max(10, startHeight + dy);
        if (position.includes('n')) {
            newHeight = Math.max(10, startHeight - dy);
            newY = startTop + (startHeight - newHeight);
        }
        
        // Snap to grid
        if (snapToGrid) {
            newWidth = Math.round(newWidth / 5) * 5;
            newHeight = Math.round(newHeight / 5) * 5;
            newX = Math.round(newX / 5) * 5;
            newY = Math.round(newY / 5) * 5;
        }
        
        // Update element
        element.width = newWidth;
        element.height = newHeight;
        element.x = newX;
        element.y = newY;
        
        // Update DOM
        const elementEl = document.querySelector(`[data-element-id="${elementId}"]`);
        if (elementEl) {
            elementEl.style.width = `${newWidth}px`;
            elementEl.style.height = `${newHeight}px`;
            elementEl.style.left = `${newX}px`;
            elementEl.style.top = `${newY}px`;
        }
        
        renderProperties();
    }
    
    function onMouseUp() {
        isResizing = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveToUndoStack();
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// ===== DRAG & DROP =====

function setupEventListeners() {
    // Toolbox drag
    document.querySelectorAll('.toolbox-item').forEach(item => {
        item.addEventListener('dragstart', handleToolboxDragStart);
    });
    
    // Fields drag
    document.getElementById('fieldsList').addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('field-item')) {
            e.dataTransfer.setData('field', e.target.dataset.fieldName);
        }
    });
    
    // Sidebar tabs
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    // Toolbar buttons
    document.getElementById('btnSave').addEventListener('click', () => openSaveModal(false));
    document.getElementById('btnSaveAs').addEventListener('click', () => openSaveModal(true));
    document.getElementById('btnPreview').addEventListener('click', previewReport);
    document.getElementById('btnUndo').addEventListener('click', undo);
    document.getElementById('btnRedo').addEventListener('click', redo);
    
    // Event listeners para o modal de preview
    document.getElementById('openInNewTab').addEventListener('click', openPdfInNewTab);
    document.getElementById('downloadPdf').addEventListener('click', downloadPdf);
    
    // Fechar modal de preview ao clicar fora dele
    document.getElementById('pdfPreviewModal').addEventListener('click', (e) => {
        if (e.target.id === 'pdfPreviewModal') {
            closePdfPreview();
        }
    });
    
    // Fechar modal com tecla Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('pdfPreviewModal');
            if (modal.classList.contains('show')) {
                closePdfPreview();
            }
        }
    });
    
    // Canvas settings
    document.getElementById('pageSize').addEventListener('change', updatePageSize);
    document.getElementById('orientation').addEventListener('change', updatePageSize);
    document.getElementById('zoomLevel').addEventListener('change', updateZoom);
    document.getElementById('showGrid').addEventListener('change', (e) => {
        showGrid = e.target.checked;
        updateGrid();
    });
    document.getElementById('snapToGrid').addEventListener('change', (e) => {
        snapToGrid = e.target.checked;
    });
    
    // Query select
    document.getElementById('querySelect').addEventListener('change', async (e) => {
        currentQueryId = e.target.value;
        if (currentQueryId) {
            await loadFieldsFromQuery(currentQueryId);
        } else {
            camposDisponiveis = [];
            renderFieldsList();
        }
    });
    
    // Fields search
    document.getElementById('fieldsSearch').addEventListener('input', renderFieldsList);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
    
    // Context menu
    document.addEventListener('click', () => hideContextMenu());
    document.querySelectorAll('.context-menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            handleContextMenuAction(item.dataset.action);
        });
    });
    
    // Canvas click to deselect
    document.getElementById('canvasContainer').addEventListener('click', (e) => {
        if (e.target.id === 'canvasContainer' || e.target.id === 'canvasPage') {
            deselectAll();
        }
    });
}

function handleToolboxDragStart(e) {
    e.dataTransfer.setData('elementType', e.currentTarget.dataset.elementType);
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

function handleDrop(e, bandId) {
    e.preventDefault();
    e.stopPropagation();
    
    const elementType = e.dataTransfer.getData('elementType');
    const fieldName = e.dataTransfer.getData('field');
    
    if (!elementType && !fieldName) return;
    
    const band = layoutData.bands.find(b => b.id === bandId);
    if (!band) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    let newElement;
    
    if (fieldName) {
        // Field dropped
        newElement = createNewElement('field', x, y, band);
        newElement.data_field = fieldName;
        newElement.name = fieldName;
    } else {
        // Tool dropped
        newElement = createNewElement(elementType, x, y, band);
    }
    
    band.elements.push(newElement);
    
    saveToUndoStack();
    renderCanvas();
    selectElement(newElement.id, bandId);
    
    showToast('Elemento adicionado!', 'success');
}

function createNewElement(type, x, y, band = null) {
    // Calcular z-index único baseado nos elementos existentes na banda
    let zIndex = 1;
    if (band && band.elements && band.elements.length > 0) {
        const maxZIndex = Math.max(...band.elements.map(e => e.z_index || 1));
        zIndex = maxZIndex + 1;
    }
    
    const element = {
        id: `element_${elementIdCounter++}`,
        type: type,
        name: type.charAt(0).toUpperCase() + type.slice(1),
        x: snapToGrid ? Math.round(x / 5) * 5 : x,
        y: snapToGrid ? Math.round(y / 5) * 5 : y,
        width: type === 'line' ? 100 : 100,
        height: type === 'line' ? 2 : 20,
        z_index: zIndex,
        
        // Text properties
        text: type === 'text' ? 'Novo Texto' : '',
        data_field: '',
        expression: '',
        
        // Formatting
        font_family: 'Helvetica',
        font_size: 10,
        font_bold: false,
        font_italic: false,
        font_underline: false,
        color: '#000000',
        background_color: '',
        border_width: 0,
        border_color: '#000000',
        border_style: 'solid',
        border_sides: ['top', 'right', 'bottom', 'left'],
        
        // Alignment
        alignment: 'left',
        vertical_alignment: 'top',
        padding: 2,
        
        // Visibility
        visible: true,
        visibility_expression: '',
        format: '',
        
        // Aggregates
        aggregate_function: 'SUM',
        aggregate_field: '',
        aggregate_scope: 'all',
        
        // Line
        line_width: 1,
        line_style: 'solid',
        
        // Image
        image_source: '',
        image_fit: 'contain',
        
        // Barcode
        barcode_type: 'code128',
        barcode_data_field: '',
        
        // Formatting (date/numeric)
        date_format: 'dd/mm/yyyy',
        number_format: '#,##0.00',
        number_prefix: '',
        number_suffix: '',
        
        // Visibility
        visibility_expression: '',
        
        // Rotation (degrees)
        rotation: 0,
        
        // Padding (px)
        padding_top: 2,
        padding_right: 2,
        padding_bottom: 2,
        padding_left: 2,
        
        // CheckBox
        checkbox_field: '',
        checkbox_checked_value: 'true',
        
        // RichText
        richtext_content: '',
        
        // DataTable
        datatable_columns: [],
        datatable_show_header: true,
        datatable_border: true,
        
        // Chart
        chart_type: 'bar',
        chart_x_field: '',
        chart_y_field: '',
        chart_title: '',
        
        // Sub-report
        subreport_name: '',
        subreport_layout_id: null
    };
    
    // Type-specific size overrides
    if (type === 'datatable') { element.width = 400; element.height = 120; }
    if (type === 'chart') { element.width = 300; element.height = 200; }
    if (type === 'subreport') { element.width = 400; element.height = 100; }
    if (type === 'richtext') { element.width = 200; element.height = 60; }
    if (type === 'checkbox') { element.width = 20; element.height = 20; element.background_color = ''; }
    
    return element;
}

function startDragElement(e, elementId, bandId) {
    if (isResizing) return;
    
    e.preventDefault();
    isDragging = true;
    
    // Ctrl+drag: duplicate element, then drag the copy
    if (e.ctrlKey) {
        const source = findElement(elementId, bandId);
        const band = layoutData.bands.find(b => b.id === bandId);
        if (source && band) {
            const copy = JSON.parse(JSON.stringify(source));
            copy.id = `element_${elementIdCounter++}`;
            copy.x = (copy.x || 0) + 10;
            copy.y = (copy.y || 0) + 10;
            band.elements.push(copy);
            renderCanvas();
            // Continue drag with the new copy
            elementId = copy.id;
            showToast('Elemento duplicado — arrastando cópia', 'info');
        }
    }
    
    selectElement(elementId, bandId);
    
    const element = findElement(elementId, bandId);
    if (!element) return;
    
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    const startX = element.x || 0;
    const startY = element.y || 0;
    
    function onMouseMove(e) {
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        
        let newX = startX + dx;
        let newY = startY + dy;
        
        // Snap to grid
        if (snapToGrid) {
            newX = Math.round(newX / 5) * 5;
            newY = Math.round(newY / 5) * 5;
        }
        
        // Bounds checking
        newX = Math.max(0, newX);
        newY = Math.max(0, newY);
        
        element.x = newX;
        element.y = newY;
        
        const elementEl = document.querySelector(`[data-element-id="${elementId}"]`);
        if (elementEl) {
            elementEl.style.left = `${newX}px`;
            elementEl.style.top = `${newY}px`;
        }
        
        renderProperties();
    }
    
    function onMouseUp() {
        isDragging = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveToUndoStack();
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function startResizeBand(e, bandId) {
    e.preventDefault();
    
    const band = layoutData.bands.find(b => b.id === bandId);
    if (!band) return;
    
    const startY = e.clientY;
    const startHeight = band.height;
    
    function onMouseMove(e) {
        const dy = e.clientY - startY;
        let newHeight = Math.max(20, startHeight + dy);
        
        if (snapToGrid) {
            newHeight = Math.round(newHeight / 5) * 5;
        }
        
        band.height = newHeight;
        
        const bandEl = document.querySelector(`.band[data-band-id="${bandId}"]`);
        if (bandEl) {
            bandEl.style.height = `${newHeight}px`;
            bandEl.querySelector('.band-header span:last-child').textContent = `${newHeight}px`;
        }
        
        renderProperties();
    }
    
    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        saveToUndoStack();
        renderBandsList();
    }
    
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

// ===== PROPERTIES PANEL =====

function renderProperties() {
    const container = document.getElementById('propertiesContent');
    
    if (selectedElement) {
        const element = findElement(selectedElement.id, selectedElement.bandId);
        if (element) {
            container.innerHTML = renderElementProperties(element);
            attachPropertyListeners(element);
            const applyBar = document.getElementById('propertiesApplyBar');
            if (applyBar) applyBar.style.display = 'block';
        }
    } else if (selectedBand) {
        const band = layoutData.bands.find(b => b.id === selectedBand);
        if (band) {
            container.innerHTML = renderBandProperties(band);
            attachBandPropertyListeners(band);
        }
    } else {
        const applyBar = document.getElementById('propertiesApplyBar');
        if (applyBar) applyBar.style.display = 'none';
        container.innerHTML = `
            <div style="text-align: center; padding: 40px 20px; color: #969696;">
                <div style="font-size: 48px; margin-bottom: 12px;">⚙️</div>
                <div>Selecione um elemento ou banda</div>
            </div>
        `;
    }
}

function renderElementProperties(element) {
    return `
        <div class="property-group">
            <div class="property-group-title">Geral</div>
            <div class="property-item">
                <label class="property-label">Nome</label>
                <input type="text" class="property-input" data-prop="name" value="${element.name || ''}">
            </div>
            <div class="property-item">
                <label class="property-label">Tipo</label>
                <input type="text" class="property-input" value="${element.type}" disabled>
            </div>
        </div>
        
        <div class="property-group">
            <div class="property-group-title">Posição e Tamanho</div>
            <div class="property-item">
                <label class="property-label">X (px)</label>
                <input type="number" class="property-input" data-prop="x" value="${element.x || 0}">
            </div>
            <div class="property-item">
                <label class="property-label">Y (px)</label>
                <input type="number" class="property-input" data-prop="y" value="${element.y || 0}">
            </div>
            <div class="property-item">
                <label class="property-label">Largura (px)</label>
                <input type="number" class="property-input" data-prop="width" value="${element.width || 100}">
            </div>
            <div class="property-item">
                <label class="property-label">Altura (px)</label>
                <input type="number" class="property-input" data-prop="height" value="${element.height || 20}">
            </div>
        </div>
        
        ${element.type === 'text' ? `
            <div class="property-group">
                <div class="property-group-title">Conteúdo</div>
                <div class="property-item">
                    <label class="property-label">Texto</label>
                    <textarea class="property-input" data-prop="text" rows="3">${element.text || ''}</textarea>
                </div>
            </div>
        ` : ''}
        
        ${element.type === 'field' ? `
            <div class="property-group">
                <div class="property-group-title">Dados</div>
                <div class="property-item">
                    <label class="property-label">Campo</label>
                    <select class="property-input" data-prop="data_field">
                        <option value="">Selecione...</option>
                        ${camposDisponiveis.map(campo => `
                            <option value="${campo}" ${element.data_field === campo ? 'selected' : ''}>${campo}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        ` : ''}
        
        ${element.type === 'expression' ? `
            <div class="property-group">
                <div class="property-group-title">Expressão</div>
                <div class="property-item">
                    <label class="property-label">Fórmula</label>
                    <textarea class="property-input" data-prop="expression" rows="3">${element.expression || ''}</textarea>
                    <small style="color: #969696; font-size: 11px;">Ex: [Campo1] + " - " + [Campo2]</small>
                </div>
            </div>
        ` : ''}
        
        ${element.type === 'aggregate' ? `
            <div class="property-group">
                <div class="property-group-title">Agregação</div>
                <div class="property-item">
                    <label class="property-label">Função</label>
                    <select class="property-input" data-prop="aggregate_function">
                        <option value="SUM" ${element.aggregate_function === 'SUM' ? 'selected' : ''}>Soma (SUM)</option>
                        <option value="COUNT" ${element.aggregate_function === 'COUNT' ? 'selected' : ''}>Contagem (COUNT)</option>
                        <option value="AVG" ${element.aggregate_function === 'AVG' ? 'selected' : ''}>Média (AVG)</option>
                        <option value="MIN" ${element.aggregate_function === 'MIN' ? 'selected' : ''}>Mínimo (MIN)</option>
                        <option value="MAX" ${element.aggregate_function === 'MAX' ? 'selected' : ''}>Máximo (MAX)</option>
                    </select>
                </div>
                <div class="property-item">
                    <label class="property-label">Campo</label>
                    <select class="property-input" data-prop="aggregate_field">
                        <option value="">Selecione...</option>
                        ${camposDisponiveis.map(campo => `
                            <option value="${campo}" ${element.aggregate_field === campo ? 'selected' : ''}>${campo}</option>
                        `).join('')}
                    </select>
                </div>
            </div>
        ` : ''}
        
        <div class="property-group">
            <div class="property-group-title">Fonte</div>
            <div class="property-item">
                <label class="property-label">Família</label>
                <select class="property-input" data-prop="font_family">
                    <option value="Helvetica" ${element.font_family === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                    <option value="Arial" ${element.font_family === 'Arial' ? 'selected' : ''}>Arial</option>
                    <option value="Times-Roman" ${element.font_family === 'Times-Roman' ? 'selected' : ''}>Times New Roman</option>
                    <option value="Courier" ${element.font_family === 'Courier' ? 'selected' : ''}>Courier</option>
                </select>
            </div>
            <div class="property-item">
                <label class="property-label">Tamanho</label>
                <input type="number" class="property-input" data-prop="font_size" value="${element.font_size || 10}">
            </div>
            <div class="property-item">
                <label>
                    <input type="checkbox" class="property-checkbox" data-prop="font_bold" ${element.font_bold ? 'checked' : ''}> Negrito
                </label>
            </div>
            <div class="property-item">
                <label>
                    <input type="checkbox" class="property-checkbox" data-prop="font_italic" ${element.font_italic ? 'checked' : ''}> Itálico
                </label>
            </div>
            <div class="property-item">
                <label>
                    <input type="checkbox" class="property-checkbox" data-prop="font_underline" ${element.font_underline ? 'checked' : ''}> Sublinhado
                </label>
            </div>
        </div>
        
        <div class="property-group">
            <div class="property-group-title">Cores</div>
            <div class="property-item">
                <label class="property-label">Cor do Texto</label>
                <div class="color-picker-wrapper">
                    <input type="color" class="property-input" data-prop="color" value="${element.color || '#000000'}" style="width: 60px;">
                    <input type="text" class="property-input" data-prop="color" value="${element.color || '#000000'}" style="flex: 1;">
                </div>
            </div>
            <div class="property-item">
                <label class="property-label">Cor de Fundo</label>
                <div class="color-picker-wrapper">
                    <input type="color" class="property-input" data-prop="background_color" value="${element.background_color || '#ffffff'}" style="width: 60px;">
                    <input type="text" class="property-input" data-prop="background_color" value="${element.background_color || ''}" style="flex: 1;">
                </div>
            </div>
        </div>
        
        <div class="property-group">
            <div class="property-group-title">Alinhamento</div>
            <div class="property-item">
                <label class="property-label">Horizontal</label>
                <select class="property-input" data-prop="alignment">
                    <option value="left" ${element.alignment === 'left' ? 'selected' : ''}>Esquerda</option>
                    <option value="center" ${element.alignment === 'center' ? 'selected' : ''}>Centro</option>
                    <option value="right" ${element.alignment === 'right' ? 'selected' : ''}>Direita</option>
                    <option value="justify" ${element.alignment === 'justify' ? 'selected' : ''}>Justificado</option>
                </select>
            </div>
            <div class="property-item">
                <label class="property-label">Vertical</label>
                <select class="property-input" data-prop="vertical_alignment">
                    <option value="top" ${element.vertical_alignment === 'top' ? 'selected' : ''}>Superior</option>
                    <option value="middle" ${element.vertical_alignment === 'middle' ? 'selected' : ''}>Meio</option>
                    <option value="bottom" ${element.vertical_alignment === 'bottom' ? 'selected' : ''}>Inferior</option>
                </select>
            </div>
        </div>
        
        <div class="property-group">
            <div class="property-group-title">Borda</div>
            <div class="property-item">
                <label class="property-label">Espessura</label>
                <input type="number" class="property-input" data-prop="border_width" value="${element.border_width || 0}" min="0">
            </div>
            <div class="property-item">
                <label class="property-label">Cor</label>
                <input type="color" class="property-input" data-prop="border_color" value="${element.border_color || '#000000'}">
            </div>
        </div>
        
        <div class="property-group">
            <div class="property-group-title">Layout</div>
            <div class="property-item">
                <label class="property-label">Rotação (graus)</label>
                <input type="number" class="property-input" data-prop="rotation" value="${element.rotation || 0}" min="-360" max="360" step="5">
            </div>
            <div class="property-item">
                <label class="property-label">Padding (px)</label>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                    <input type="number" class="property-input" data-prop="padding_top" value="${element.padding_top ?? 2}" placeholder="Topo" min="0">
                    <input type="number" class="property-input" data-prop="padding_bottom" value="${element.padding_bottom ?? 2}" placeholder="Base" min="0">
                    <input type="number" class="property-input" data-prop="padding_left" value="${element.padding_left ?? 2}" placeholder="Esq" min="0">
                    <input type="number" class="property-input" data-prop="padding_right" value="${element.padding_right ?? 2}" placeholder="Dir" min="0">
                </div>
            </div>
        </div>
        
        ${['field', 'datefield', 'numericfield', 'aggregate', 'expression'].includes(element.type) ? `
        <div class="property-group">
            <div class="property-group-title">Formatação</div>
            ${element.type === 'datefield' || (element.type === 'field' && element.data_field) ? `
            <div class="property-item">
                <label class="property-label">Formato de Data</label>
                <select class="property-input" data-prop="date_format">
                    <option value="dd/mm/yyyy" ${(element.date_format || '') === 'dd/mm/yyyy' ? 'selected' : ''}>dd/mm/yyyy</option>
                    <option value="dd/mm/yy" ${element.date_format === 'dd/mm/yy' ? 'selected' : ''}>dd/mm/yy</option>
                    <option value="mm/dd/yyyy" ${element.date_format === 'mm/dd/yyyy' ? 'selected' : ''}>mm/dd/yyyy</option>
                    <option value="yyyy-mm-dd" ${element.date_format === 'yyyy-mm-dd' ? 'selected' : ''}>yyyy-mm-dd</option>
                    <option value="dd Mon yyyy" ${element.date_format === 'dd Mon yyyy' ? 'selected' : ''}>dd Mon yyyy</option>
                    <option value="HH:MM:SS" ${element.date_format === 'HH:MM:SS' ? 'selected' : ''}>HH:MM:SS</option>
                    <option value="dd/mm/yyyy HH:MM" ${element.date_format === 'dd/mm/yyyy HH:MM' ? 'selected' : ''}>dd/mm/yyyy HH:MM</option>
                </select>
            </div>` : ''}
            ${['numericfield', 'aggregate'].includes(element.type) ? `
            <div class="property-item">
                <label class="property-label">Formato Numérico</label>
                <select class="property-input" data-prop="number_format">
                    <option value="#,##0.00" ${(element.number_format || '') === '#,##0.00' ? 'selected' : ''}>#,##0.00</option>
                    <option value="#,##0" ${element.number_format === '#,##0' ? 'selected' : ''}>#,##0 (inteiro)</option>
                    <option value="#,##0.000" ${element.number_format === '#,##0.000' ? 'selected' : ''}>#,##0.000</option>
                    <option value="0.00%" ${element.number_format === '0.00%' ? 'selected' : ''}>0.00%</option>
                    <option value="R$ #,##0.00" ${element.number_format === 'R$ #,##0.00' ? 'selected' : ''}>R$ #,##0.00</option>
                </select>
            </div>
            <div class="property-item" style="display:grid; grid-template-columns:1fr 1fr; gap:4px;">
                <div>
                    <label class="property-label">Prefixo</label>
                    <input type="text" class="property-input" data-prop="number_prefix" value="${element.number_prefix || ''}" placeholder="R$ ">
                </div>
                <div>
                    <label class="property-label">Sufixo</label>
                    <input type="text" class="property-input" data-prop="number_suffix" value="${element.number_suffix || ''}" placeholder="%">
                </div>
            </div>` : ''}
            <div class="property-item">
                <label class="property-label">Formato Livre</label>
                <input type="text" class="property-input" data-prop="format" value="${element.format || ''}" placeholder="Ex: R$ {0:,.2f}">
            </div>
        </div>` : ''}
        
        ${element.type === 'checkbox' ? `
        <div class="property-group">
            <div class="property-group-title">Caixa de Seleção</div>
            <div class="property-item">
                <label class="property-label">Campo</label>
                <select class="property-input" data-prop="checkbox_field">
                    <option value="">Selecione...</option>
                    ${camposDisponiveis.map(c => `<option value="${c}" ${element.checkbox_field === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
            </div>
            <div class="property-item">
                <label class="property-label">Valor = Marcado</label>
                <input type="text" class="property-input" data-prop="checkbox_checked_value" value="${element.checkbox_checked_value || 'true'}">
            </div>
        </div>` : ''}
        
        ${element.type === 'richtext' ? `
        <div class="property-group">
            <div class="property-group-title">Texto Rico</div>
            <div class="property-item">
                <label class="property-label">Conteúdo HTML</label>
                <textarea class="property-input" data-prop="richtext_content" rows="5">${element.richtext_content || ''}</textarea>
                <small style="color:#969696; font-size:10px;">Suporta &lt;b&gt;, &lt;i&gt;, &lt;u&gt;, &lt;br&gt;, &lt;span style=...&gt;</small>
            </div>
        </div>` : ''}
        
        ${element.type === 'datatable' ? `
        <div class="property-group">
            <div class="property-group-title">Tabela de Dados</div>
            <div class="property-item">
                <label>
                    <input type="checkbox" class="property-checkbox" data-prop="datatable_show_header" ${element.datatable_show_header !== false ? 'checked' : ''}> Mostrar Cabeçalho
                </label>
            </div>
            <div class="property-item">
                <label>
                    <input type="checkbox" class="property-checkbox" data-prop="datatable_border" ${element.datatable_border !== false ? 'checked' : ''}> Mostrar Bordas
                </label>
            </div>
            <div class="property-item">
                <label class="property-label">Colunas (separadas por vírgula)</label>
                <input type="text" class="property-input" data-prop="_datatable_columns_str"
                    value="${(element.datatable_columns || []).join(', ')}"
                    placeholder="campo1, campo2, campo3">
                <small style="color:#969696;font-size:10px;">Deixe vazio para usar todos os campos</small>
            </div>
        </div>` : ''}
        
        ${element.type === 'chart' ? `
        <div class="property-group">
            <div class="property-group-title">Gráfico</div>
            <div class="property-item">
                <label class="property-label">Tipo</label>
                <select class="property-input" data-prop="chart_type">
                    <option value="bar" ${(element.chart_type||'bar')==='bar' ? 'selected':''}>Barras</option>
                    <option value="line" ${element.chart_type==='line' ? 'selected':''}>Linha</option>
                    <option value="pie" ${element.chart_type==='pie' ? 'selected':''}>Pizza</option>
                    <option value="doughnut" ${element.chart_type==='doughnut' ? 'selected':''}>Rosca</option>
                    <option value="area" ${element.chart_type==='area' ? 'selected':''}>Área</option>
                </select>
            </div>
            <div class="property-item">
                <label class="property-label">Campo Eixo X (categorias)</label>
                <select class="property-input" data-prop="chart_x_field">
                    <option value="">Selecione...</option>
                    ${camposDisponiveis.map(c => `<option value="${c}" ${element.chart_x_field===c?'selected':''}>${c}</option>`).join('')}
                </select>
            </div>
            <div class="property-item">
                <label class="property-label">Campo Eixo Y (valores)</label>
                <select class="property-input" data-prop="chart_y_field">
                    <option value="">Selecione...</option>
                    ${camposDisponiveis.map(c => `<option value="${c}" ${element.chart_y_field===c?'selected':''}>${c}</option>`).join('')}
                </select>
            </div>
            <div class="property-item">
                <label class="property-label">Título do Gráfico</label>
                <input type="text" class="property-input" data-prop="chart_title" value="${element.chart_title || ''}">
            </div>
        </div>` : ''}
        
        ${element.type === 'subreport' ? `
        <div class="property-group">
            <div class="property-group-title">Sub-relatório</div>
            <div class="property-item">
                <label class="property-label">Nome</label>
                <input type="text" class="property-input" data-prop="subreport_name" value="${element.subreport_name || ''}">
            </div>
        </div>` : ''}
        
        <div class="property-group">
            <div class="property-group-title">Visibilidade Condicional</div>
            <div class="property-item">
                <label class="property-label">Expressão (oculta se falso)</label>
                <textarea class="property-input" data-prop="visibility_expression" rows="2" placeholder="Ex: [valor] > 0">${element.visibility_expression || ''}</textarea>
                <small style="color:#969696;font-size:10px;">Deixe vazio para sempre visível</small>
            </div>
        </div>
        
        <div class="property-group">
            <div class="property-group-title">Ações</div>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="toolbar-btn" style="flex:1; font-size:11px;" onclick="bringElementFront()">⬆ Frente</button>
                <button class="toolbar-btn" style="flex:1; font-size:11px;" onclick="sendElementBack()">⬇ Trás</button>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                <button class="toolbar-btn" style="flex:1; font-size:11px;" onclick="duplicateSelectedElement()">📑 Duplicar</button>
                <button class="toolbar-btn" style="flex:1; font-size:11px; background:#5c2020;" onclick="deleteSelectedElement()">🗑 Deletar</button>
            </div>
        </div>
    `;
}

function renderBandProperties(band) {
    return `
        <div class="property-group">
            <div class="property-group-title">Banda: ${band.name}</div>
            <div class="property-item">
                <label class="property-label">Nome</label>
                <input type="text" class="property-input" data-band-prop="name" value="${band.name || ''}">
            </div>
            <div class="property-item">
                <label class="property-label">Altura (px)</label>
                <input type="number" class="property-input" data-band-prop="height" value="${band.height || 30}" min="20">
            </div>
            <div class="property-item">
                <label>
                    <input type="checkbox" class="property-checkbox" data-band-prop="visible" ${band.visible ? 'checked' : ''}> Visível
                </label>
            </div>
        </div>
        
        <div class="property-group">
            <div class="property-group-title">Cor de Fundo</div>
            <div class="property-item">
                <div class="color-picker-wrapper">
                    <input type="color" class="property-input" data-band-prop="background_color" value="${band.background_color || '#ffffff'}" style="width: 60px;">
                    <input type="text" class="property-input" data-band-prop="background_color" value="${band.background_color || ''}" style="flex: 1;">
                </div>
            </div>
        </div>
        
        ${band.type === 'detail' ? `
            <div class="property-group">
                <div class="property-group-title">Cores Alternadas</div>
                <div class="property-item">
                    <label>
                        <input type="checkbox" class="property-checkbox" data-band-prop="alternating_color" ${band.alternating_color ? 'checked' : ''}> Ativar
                    </label>
                </div>
                <div class="property-item">
                    <label class="property-label">Cor Alternada</label>
                    <input type="color" class="property-input" data-band-prop="alternate_color" value="${band.alternate_color || '#f9f9f9'}">
                </div>
            </div>
        ` : ''}
        
        ${(band.type === 'group_header' || band.type === 'group_footer') ? `
            <div class="property-group">
                <div class="property-group-title">Agrupamento</div>
                <div class="property-item">
                    <label class="property-label">Campo de Grupo</label>
                    <select class="property-input" data-band-prop="group_field">
                        <option value="">Selecione...</option>
                        ${camposDisponiveis.map(c => `<option value="${c}" ${band.group_field === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
                <div style="margin-top:8px;">
                    <button class="toolbar-btn" style="width:100%; justify-content:center; background:#5c2020; font-size:11px;" 
                            onclick="removeGroupBand('${band.id}')">🗑 Remover Banda de Grupo</button>
                </div>
            </div>
        ` : ''}
    `;
}

function attachPropertyListeners(element) {
    document.querySelectorAll('[data-prop]').forEach(input => {
        const prop = input.dataset.prop;
        
        input.addEventListener('change', (e) => {
            let value = e.target.type === 'checkbox' ? e.target.checked : 
                       e.target.type === 'number' ? parseFloat(e.target.value) :
                       e.target.value;
            
            element[prop] = value;
            
            const elementEl = document.querySelector(`[data-element-id="${selectedElement.id}"]`);
            if (elementEl) {
                updateElementDOM(elementEl, element);
            }
            
            saveToUndoStack();
        });
        
        // Real-time update for color pickers
        if (input.type === 'color' || input.type === 'text') {
            input.addEventListener('input', (e) => {
                if (prop === 'color' || prop === ' background_color' || prop === 'border_color') {
                    let value = e.target.value;
                    element[prop] = value;
                    
                    const elementEl = document.querySelector(`[data-element-id="${selectedElement.id}"]`);
                    if (elementEl) {
                        updateElementDOM(elementEl, element);
                    }
                    
                    // Sync color inputs
                    document.querySelectorAll(`[data-prop="${prop}"]`).forEach(input2 => {
                        if (input2 !== input) input2.value = value;
                    });
                }
            });
        }
    });
}

function applyElementProperties() {
    if (!selectedElement) return;
    const element = findElement(selectedElement.id, selectedElement.bandId);
    if (!element) return;

    // Aplicar todos os inputs de propriedade
    document.querySelectorAll('[data-prop]').forEach(input => {
        const prop = input.dataset.prop;
        if (!prop) return;
        let value;
        if (input.type === 'checkbox') {
            value = input.checked;
        } else if (input.type === 'number') {
            value = parseFloat(input.value);
        } else {
            value = input.value;
        }
        // Tratar colunas de datatable separadas por vírgula
        if (prop === '_datatable_columns_str') {
            element.datatable_columns = value.split(',').map(s => s.trim()).filter(Boolean);
            return;
        }
        element[prop] = value;
    });

    // Atualizar DOM do elemento no canvas
    const elementEl = document.querySelector(`[data-element-id="${selectedElement.id}"]`);
    if (elementEl) updateElementDOM(elementEl, element);

    saveToUndoStack();
    showToast('Alterações aplicadas!', 'success');
}

function attachBandPropertyListeners(band) {
    document.querySelectorAll('[data-band-prop]').forEach(input => {
        const prop = input.dataset.bandProp;
        
        input.addEventListener('change', (e) => {
            let value = e.target.type === 'checkbox' ? e.target.checked : 
                       e.target.type === 'number' ? parseFloat(e.target.value) :
                       e.target.value;
            
            band[prop] = value;
            
            const bandEl = document.querySelector(`.band[data-band-id="${selectedBand}"]`);
            if (bandEl && prop === 'height') {
                bandEl.style.height = `${value}px`;
                bandEl.querySelector('.band-header span:last-child').textContent = `${value}px`;
            }
            if (bandEl && prop === 'background_color') {
                bandEl.style.backgroundColor = value;
            }
            if (prop === 'name') {
                bandEl.querySelector('.band-header span:first-child').textContent = value;
            }
            
            renderBandsList();
            saveToUndoStack();
        });
    });
}

function updateElementDOM(elementEl, element) {
    // Position and size
    if (element.x !== undefined) elementEl.style.left = `${element.x}px`;
    if (element.y !== undefined) elementEl.style.top = `${element.y}px`;
    if (element.width !== undefined) elementEl.style.width = `${element.width}px`;
    if (element.height !== undefined) elementEl.style.height = `${element.height}px`;
    
    // Style
    if (element.font_family) elementEl.style.fontFamily = element.font_family;
    if (element.font_size) elementEl.style.fontSize = `${element.font_size}px`;
    elementEl.style.fontWeight = element.font_bold ? 'bold' : 'normal';
    elementEl.style.fontStyle = element.font_italic ? 'italic' : 'normal';
    elementEl.style.textDecoration = element.font_underline ? 'underline' : 'none';
    if (element.color) elementEl.style.color = element.color;
    if (element.background_color !== undefined) elementEl.style.backgroundColor = element.background_color;
    if (element.alignment) elementEl.style.textAlign = element.alignment;
    
    // Border
    if (element.border_width !== undefined) {
        elementEl.style.borderWidth = `${element.border_width}px`;
        elementEl.style.borderStyle = element.border_style || 'solid';
        elementEl.style.borderColor = element.border_color || '#000';
    }
    
    // Content
    elementEl.textContent = getElementDisplayText(element);
}

// ===== FIELDS & BANDS LISTS =====

function renderFieldsList() {
    console.log('renderFieldsList called');
    const container = document.getElementById('fieldsList');
    const searchInput = document.getElementById('fieldsSearch');
    
    console.log('fieldsList container:', container);
    console.log('fieldsSearch input:', searchInput);
    console.log('camposDisponiveis:', camposDisponiveis);
    
    if (!container) {
        console.error('fieldsList element not found!');
        return;
    }
    
    if (!searchInput) {
        console.error('fieldsSearch element not found!');
        return;
    }
    
    const search = searchInput.value.toLowerCase();
    
    let fields = camposDisponiveis || [];
    if (search) {
        fields = fields.filter(f => f.toLowerCase().includes(search));
    }
    
    console.log('Fields to render:', fields.length);
    
    if (fields.length === 0) {
        container.innerHTML = '<div style="color: #969696; text-align: center; padding: 20px;">Nenhum campo encontrado</div>';
        return;
    }
    
    container.innerHTML = fields.map(campo => `
        <div class="field-item" draggable="true" data-field-name="${campo}">
            <div class="field-icon">🔤</div>
            <div class="field-name">${campo}</div>
        </div>
    `).join('');
    
    // Add drag listeners
    container.querySelectorAll('.field-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('field', item.dataset.fieldName);
        });
    });
    
    console.log('renderFieldsList completed');
}

function renderBandsList() {
    console.log('renderBandsList called');
    const container = document.getElementById('bandsList');
    console.log('bandsList container:', container);
    
    if (!container) {
        console.error('bandsList element not found!');
        return;
    }
    
    if (!layoutData || !layoutData.bands) {
        console.error('Cannot render bands list - no bands in layoutData');
        return;
    }
    
    console.log('Rendering bands list with', layoutData.bands.length, 'bands');
    
    const BAND_COLORS = {
        page_header: '#1177bb', page_footer: '#1177bb',
        header: '#0e7c34', footer: '#0e7c34',
        detail: '#805500',
        group_header: '#8b5e00', group_footer: '#3d6e20'
    };
    
    container.innerHTML = layoutData.bands.map(band => {
        const isGroup = band.type === 'group_header' || band.type === 'group_footer';
        const color = BAND_COLORS[band.type] || '#555';
        return `
        <div class="band-list-item ${selectedBand === band.id ? 'active' : ''}" data-band-id="${band.id}"
             style="border-left:3px solid ${color};">
            <div style="flex:1; min-width:0;">
                <div class="band-list-item-name" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${band.name}
                    ${isGroup ? `<span style="font-size:10px; color:#969696;"> [${band.group_field || '?'}]</span>` : ''}
                </div>
                <div class="band-list-item-height">
                    ${band.height}px &bull; ${band.elements.length} elem
                    <input type="checkbox" ${band.visible ? 'checked' : ''} style="margin-left:6px;"
                           onclick="toggleBandVisibility('${band.id}', event)" title="Visível">
                </div>
            </div>
            ${isGroup ? `<button style="background:none;border:none;color:#f14c4c;cursor:pointer;font-size:14px;padding:0 4px;" 
                             title="Remover banda de grupo" onclick="event.stopPropagation(); removeGroupBand('${band.id}')">✕</button>` : ''}
        </div>`;
    }).join('');
    
    container.querySelectorAll('.band-list-item').forEach(item => {
        item.addEventListener('click', () => {
            selectBand(item.dataset.bandId);
        });
    });
    
    console.log('renderBandsList completed');
}

function toggleBandVisibility(bandId, event) {
    event.stopPropagation();
    const band = layoutData.bands.find(b => b.id === bandId);
    if (band) {
        band.visible = event.target.checked;
        renderCanvas();
        renderBandsList();
        saveToUndoStack();
    }
}

async function loadFieldsFromQuery(queryId) {
    try {
        const response = await fetch(`/report-designer/load-fields/?query_id=${queryId}`);
        const data = await response.json();
        
        if (data.success) {
            camposDisponiveis = data.campos;
            renderFieldsList();
            showToast(`Campos carregados: ${data.query_nome}`, 'success');
        } else {
            showToast(data.message || 'Erro ao carregar campos', 'error');
        }
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao carregar campos da query', 'error');
    }
}

// ===== SAVE & LOAD =====

function openSaveModal(saveAs) {
    const modal = document.getElementById('saveModal');
    const title = document.getElementById('saveModalTitle');
    
    if (saveAs || !currentLayoutId) {
        title.textContent = '💾 Salvar Como';
        if (saveAs && currentLayoutId) {
            document.getElementById('layoutName').value += ' (Cópia)';
        }
    } else {
        title.textContent = '💾 Salvar Layout';
    }
    
    modal.classList.add('show');
}

function closeSaveModal() {
    document.getElementById('saveModal').classList.remove('show');
}

async function saveLayout() {
    const nome = document.getElementById('layoutName').value.trim();
    const descricao = document.getElementById('layoutDescription').value.trim();
    const padrao = document.getElementById('layoutPadrao').checked;
    
    if (!nome) {
        showToast('Nome é obrigatório!', 'error');
        return;
    }
    
    const pageSize = document.getElementById('pageSize').value;
    const orientation = document.getElementById('orientation').value;
    
    const payload = {
        id: currentLayoutId,
        nome: nome,
        descricao: descricao,
        query_id: currentQueryId,
        layout_json: layoutData,
        page_size: pageSize,
        orientation: orientation,
        margin_top: 20,
        margin_bottom: 20,
        margin_left: 15,
        margin_right: 15,
        default_font_family: 'Helvetica',
        default_font_size: 10,
        padrao: padrao
    };
    
    try {
        const response = await fetch('/report-designer/salvar/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentLayoutId = data.layout_id;
            showToast(data.message, 'success');
            closeSaveModal();
            
            // Update URL if new
            if (!window.location.pathname.includes('/editar/')) {
                window.history.pushState({}, '', `/report-designer/${data.layout_id}/editar/`);
            }
        } else {
            showToast(data.message || 'Erro ao salvar', 'error');
        }
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao salvar layout', 'error');
    }
}

async function previewReport() {
    if (!currentLayoutId) {
        showToast('Salve o layout antes de visualizar', 'info');
        return;
    }
    
    showToast('Gerando preview do PDF...', 'info');
    
    try {
        const response = await fetch('/report-designer/preview/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                layout_id: currentLayoutId,
                layout_json: layoutData
            })
        });
        
        if (response.ok && response.headers.get('content-type')?.includes('application/pdf')) {
            // Recebeu PDF - mostrar no modal de preview
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            
            // Armazenar URL globalmente para ações do modal
            window.currentPdfUrl = url;
            window.currentPdfBlob = blob;
            
            // Mostrar modal de preview
            showPdfPreview(url);
            showToast('Preview gerado com sucesso!', 'success');
        } else {
            // Recebeu JSON com erro
            const data = await response.json();
            showToast(data.message || 'Erro ao gerar preview', 'error');
        }
    } catch (error) {
        console.error('Erro:', error);
        showToast('Erro ao gerar preview', 'error');
    }
}

function showPdfPreview(url) {
    const modal = document.getElementById('pdfPreviewModal');
    const frame = document.getElementById('pdfPreviewFrame');
    const loading = document.getElementById('pdfLoading');
    
    // Mostrar modal
    modal.classList.add('show');
    
    // Configurar iframe
    frame.style.display = 'none';
    loading.style.display = 'block';
    
    // Tentar carregar no iframe
    frame.onload = () => {
        loading.style.display = 'none';
        frame.style.display = 'block';
    };
    
    frame.onerror = () => {
        loading.textContent = '❌ Erro ao carregar preview. Clique em "Nova Aba" para visualizar.';
    };
    
    frame.src = url;
}

function closePdfPreview() {
    const modal = document.getElementById('pdfPreviewModal');
    const frame = document.getElementById('pdfPreviewFrame');
    
    modal.classList.remove('show');
    frame.src = '';
    
    // Limpar URL depois de um tempo
    if (window.currentPdfUrl) {
        setTimeout(() => {
            URL.revokeObjectURL(window.currentPdfUrl);
            window.currentPdfUrl = null;
            window.currentPdfBlob = null;
        }, 1000);
    }
}

function openPdfInNewTab() {
    if (window.currentPdfUrl) {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
            newWindow.location.href = window.currentPdfUrl;
            showToast('PDF aberto em nova aba', 'success');
        } else {
            showToast('Pop-up bloqueado pelo navegador', 'warning');
        }
    }
}

function downloadPdf() {
    if (window.currentPdfBlob && window.currentPdfUrl) {
        const a = document.createElement('a');
        a.href = window.currentPdfUrl;
        a.download = `preview_layout_${currentLayoutId}_${new Date().getTime()}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        showToast('PDF baixado com sucesso', 'success');
    }
}

// ===== UNDO/REDO =====

function saveToUndoStack() {
    const state = JSON.parse(JSON.stringify(layoutData));
    undoStack.push(state);
    
    if (undoStack.length > 50) {
        undoStack.shift();
    }
    
    redoStack = [];
    
    updateUndoRedoButtons();
}

function undo() {
    if (undoStack.length === 0) return;
    
    const currentState = JSON.parse(JSON.stringify(layoutData));
    redoStack.push(currentState);
    
    layoutData = undoStack.pop();
    
    renderCanvas();
    renderBandsList();
    renderProperties();
    updateUndoRedoButtons();
    
    showToast('Ação desfeita', 'info');
}

function redo() {
    if (redoStack.length === 0) return;
    
    const currentState = JSON.parse(JSON.stringify(layoutData));
    undoStack.push(currentState);
    
    layoutData = redoStack.pop();
    
    renderCanvas();
    renderBandsList();
    renderProperties();
    updateUndoRedoButtons();
    
    showToast('Ação refeita', 'info');
}

function updateUndoRedoButtons() {
    document.getElementById('btnUndo').disabled = undoStack.length === 0;
    document.getElementById('btnRedo').disabled = redoStack.length === 0;
}

// ===== CONTEXT MENU =====

function showContextMenu(e, elementId, bandId) {
    e.preventDefault();
    e.stopPropagation();
    
    selectElement(elementId, bandId);
    
    const menu = document.getElementById('contextMenu');
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.classList.add('show');
}

function hideContextMenu() {
    document.getElementById('contextMenu').classList.remove('show');
}

function handleContextMenuAction(action) {
    hideContextMenu();
    
    if (!selectedElement) return;
    
    const element = findElement(selectedElement.id, selectedElement.bandId);
    if (!element) return;
    
    const band = layoutData.bands.find(b => b.id === selectedElement.bandId);
    if (!band) return;
    
    switch (action) {
        case 'copy':
            clipboard = JSON.parse(JSON.stringify(element));
            showToast('Elemento copiado', 'success');
            break;
            
        case 'paste':
            if (clipboard) {
                const newElement = JSON.parse(JSON.stringify(clipboard));
                newElement.id = `element_${elementIdCounter++}`;
                newElement.x = (newElement.x || 0) + 10;
                newElement.y = (newElement.y || 0) + 10;
                band.elements.push(newElement);
                renderCanvas();
                selectElement(newElement.id, selectedElement.bandId);
                saveToUndoStack();
                showToast('Elemento colado', 'success');
            }
            break;
            
        case 'duplicate':
            const duplicated = JSON.parse(JSON.stringify(element));
            duplicated.id = `element_${elementIdCounter++}`;
            duplicated.x = (duplicated.x || 0) + 10;
            duplicated.y = (duplicated.y || 0) + 10;
            band.elements.push(duplicated);
            renderCanvas();
            selectElement(duplicated.id, selectedElement.bandId);
            saveToUndoStack();
            showToast('Elemento duplicado', 'success');
            break;
            
        case 'delete':
            const index = band.elements.findIndex(e => e.id === element.id);
            if (index !== -1) {
                band.elements.splice(index, 1);
                renderCanvas();
                deselectAll();
                saveToUndoStack();
                showToast('Elemento deletado', 'success');
            }
            break;
            
        case 'bring-front':
            element.z_index = Math.max(...band.elements.map(e => e.z_index || 1)) + 1;
            renderCanvas();
            selectElement(element.id, selectedElement.bandId);
            saveToUndoStack();
            break;
            
        case 'send-back':
            element.z_index = Math.min(...band.elements.map(e => e.z_index || 1)) - 1;
            renderCanvas();
            selectElement(element.id, selectedElement.bandId);
            saveToUndoStack();
            break;
    }
}

// ===== KEYBOARD SHORTCUTS =====

function handleKeyboard(e) {
    // Ctrl+S - Save
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        openSaveModal(false);
    }
    
    // Ctrl+Z - Undo
    if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
    }
    
    // Ctrl+Y - Redo
    if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
    }
    
    // Delete - Remove element
    if (e.key === 'Delete' && selectedElement) {
        const element = findElement(selectedElement.id, selectedElement.bandId);
        const band = layoutData.bands.find(b => b.id === selectedElement.bandId);
        if (element && band) {
            const index = band.elements.findIndex(e => e.id === element.id);
            if (index !== -1) {
                band.elements.splice(index, 1);
                renderCanvas();
                deselectAll();
                saveToUndoStack();
                showToast('Elemento deletado', 'success');
            }
        }
    }
    
    // Ctrl+C - Copy
    if (e.ctrlKey && e.key === 'c' && selectedElement) {
        const element = findElement(selectedElement.id, selectedElement.bandId);
        if (element) {
            clipboard = JSON.parse(JSON.stringify(element));
            showToast('Elemento copiado', 'success');
        }
    }
    
    // Ctrl+V - Paste
    if (e.ctrlKey && e.key === 'v' && clipboard && selectedBand) {
        const band = layoutData.bands.find(b => b.id === selectedBand);
        if (band) {
            const newElement = JSON.parse(JSON.stringify(clipboard));
            newElement.id = `element_${elementIdCounter++}`;
            newElement.x = (newElement.x || 0) + 10;
            newElement.y = (newElement.y || 0) + 10;
            band.elements.push(newElement);
            renderCanvas();
            selectElement(newElement.id, selectedBand);
            saveToUndoStack();
            showToast('Elemento colado', 'success');
        }
    }
    
    // Arrow keys - Move element
    if (selectedElement && ['ArrowUp', 'ArrowDown', 'Arrow Left', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const element = findElement(selectedElement.id, selectedElement.bandId);
        if (element) {
            const step = e.shiftKey ? 10 : 1;
            
            switch (e.key) {
                case 'ArrowUp': element.y = Math.max(0, (element.y || 0) - step); break;
                case 'ArrowDown': element.y = (element.y || 0) + step; break;
                case 'ArrowLeft': element.x = Math.max(0, (element.x || 0) - step); break;
                case 'ArrowRight': element.x = (element.x || 0) + step; break;
            }
            
            const elementEl = document.querySelector(`[data-element-id="${selectedElement.id}"]`);
            if (elementEl) {
                elementEl.style.left = `${element.x}px`;
                elementEl.style.top = `${element.y}px`;
            }
            
            renderProperties();
        }
    }
}

// ===== UTILITIES =====

function findElement(elementId, bandId) {
    const band = layoutData.bands.find(b => b.id === bandId);
    if (!band) return null;
    return band.elements.find(e => e.id === elementId);
}

function switchTab(tabName) {
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    
    document.querySelectorAll('.sidebar-content').forEach(content => {
        content.classList.toggle('hidden', content.id !== `${tabName}Tab`);
    });
}

function updatePageSize() {
    const pageSize = document.getElementById('pageSize').value;
    const orientation = document.getElementById('orientation').value;
    const canvasPage = document.getElementById('canvasPage');
    
    const dimensions = PAGE_SIZES[pageSize];
    if (!dimensions) return;
    
    let width = dimensions.width;
    let height = dimensions.height;
    
    if (orientation === 'landscape') {
        [width, height] = [height, width];
    }
    
    // Convert mm to pixels (assuming 96 DPI)
    const mmToPx = 3.7795275591;
    canvasPage.style.width = `${width * mmToPx}px`;
    canvasPage.style.minHeight = `${height * mmToPx}px`;
    
    renderCanvas();
}

function updateZoom() {
    zoomLevel = parseFloat(document.getElementById('zoomLevel').value);
    const canvasPage = document.getElementById('canvasPage');
    canvasPage.style.transform = `scale(${zoomLevel})`;
    canvasPage.style.transformOrigin = 'top left';
}

function updateGrid() {
    const canvasPage = document.getElementById('canvasPage');
    if (showGrid) {
        canvasPage.style.backgroundImage = `
            linear-gradient(0deg, transparent 24%, rgba(0,0,0,.05) 25%, rgba(0,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,.05) 75%, rgba(0,0,0,.05) 76%, transparent 77%, transparent),
            linear-gradient(90deg, transparent 24%, rgba(0,0,0,.05) 25%, rgba(0,0,0,.05) 26%, transparent 27%, transparent 74%, rgba(0,0,0,.05) 75%, rgba(0,0,0,.05) 76%, transparent 77%, transparent)
        `;
        canvasPage.style.backgroundSize = '50px 50px';
    } else {
        canvasPage.style.backgroundImage = 'none';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="font-size: 18px;">${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}</div>
        <div>${message}</div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function getCsrfToken() {
    return document.querySelector('[name=csrfmiddlewaretoken]')?.value || 
           document.cookie.match(/csrftoken=([^;]+)/)?.[1] || '';
}

// Add keyframe animation for toast slideOut
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Prevent default drag behavior on document (only outside canvas)
document.addEventListener('dragover', (e) => {
    // Permite dragover dentro de band-body areas
    if (!e.target.closest('.band-body')) {
        e.preventDefault();
    }
});
document.addEventListener('drop', (e) => {
    // Permite drop dentro de band-body areas
    if (!e.target.closest('.band-body')) {
        e.preventDefault();
    }
});

// Global initialization function - called from template after variables are set
function initDesigner() {
    console.log('Initializing designer...', layoutData);
    setupEventListeners();
    renderCanvas();
    renderFieldsList();
    renderBandsList();
    updatePageSize();
}

// ===== ALIGN & DISTRIBUTE =====

function alignElements(direction) {
    const els = selectedElements.length >= 2 ? selectedElements :
                (selectedElement ? [selectedElement] : []);
    if (els.length < 2) {
        showToast('Selecione 2 ou mais elementos com Shift+Click para alinhar', 'info');
        return;
    }
    
    const data = els.map(sel => findElement(sel.id, sel.bandId)).filter(Boolean);
    if (data.length < 2) return;
    
    switch (direction) {
        case 'left': {
            const minX = Math.min(...data.map(e => e.x || 0));
            data.forEach(e => { e.x = minX; });
            break;
        }
        case 'right': {
            const maxRight = Math.max(...data.map(e => (e.x || 0) + (e.width || 0)));
            data.forEach(e => { e.x = maxRight - (e.width || 0); });
            break;
        }
        case 'hcenter': {
            const centers = data.map(e => (e.x || 0) + (e.width || 0) / 2);
            const avgCenter = centers.reduce((a, b) => a + b, 0) / centers.length;
            data.forEach(e => { e.x = Math.round(avgCenter - (e.width || 0) / 2); });
            break;
        }
        case 'top': {
            const minY = Math.min(...data.map(e => e.y || 0));
            data.forEach(e => { e.y = minY; });
            break;
        }
        case 'bottom': {
            const maxBottom = Math.max(...data.map(e => (e.y || 0) + (e.height || 0)));
            data.forEach(e => { e.y = maxBottom - (e.height || 0); });
            break;
        }
        case 'vcenter': {
            const vcenters = data.map(e => (e.y || 0) + (e.height || 0) / 2);
            const avgV = vcenters.reduce((a, b) => a + b, 0) / vcenters.length;
            data.forEach(e => { e.y = Math.round(avgV - (e.height || 0) / 2); });
            break;
        }
    }
    
    saveToUndoStack();
    renderCanvas();
    showToast(`Elementos alinhados (${direction})`, 'success');
}

function distributeElements(axis) {
    const els = selectedElements.length >= 3 ? selectedElements :
                (selectedElement ? [selectedElement] : []);
    if (els.length < 3) {
        showToast('Selecione 3 ou mais elementos para distribuir', 'info');
        return;
    }
    
    const data = els.map(sel => findElement(sel.id, sel.bandId)).filter(Boolean);
    if (data.length < 3) return;
    
    if (axis === 'horizontal') {
        data.sort((a, b) => (a.x || 0) - (b.x || 0));
        const minX = data[0].x || 0;
        const maxX = (data[data.length-1].x || 0) + (data[data.length-1].width || 0);
        const totalWidth = data.reduce((s, e) => s + (e.width || 0), 0);
        const gap = (maxX - minX - totalWidth) / (data.length - 1);
        let curX = minX;
        data.forEach(e => { e.x = Math.round(curX); curX += (e.width || 0) + gap; });
    } else {
        data.sort((a, b) => (a.y || 0) - (b.y || 0));
        const minY = data[0].y || 0;
        const maxY = (data[data.length-1].y || 0) + (data[data.length-1].height || 0);
        const totalHeight = data.reduce((s, e) => s + (e.height || 0), 0);
        const gap = (maxY - minY - totalHeight) / (data.length - 1);
        let curY = minY;
        data.forEach(e => { e.y = Math.round(curY); curY += (e.height || 0) + gap; });
    }
    
    saveToUndoStack();
    renderCanvas();
    showToast(`Elementos distribuídos (${axis === 'horizontal' ? 'horizontal' : 'vertical'})`, 'success');
}

// Helper actions called from properties panel buttons
function bringElementFront() {
    if (!selectedElement) return;
    const band = layoutData.bands.find(b => b.id === selectedElement.bandId);
    const element = findElement(selectedElement.id, selectedElement.bandId);
    if (band && element) {
        element.z_index = Math.max(...band.elements.map(e => e.z_index || 1)) + 1;
        renderCanvas();
        selectElement(element.id, selectedElement.bandId);
        saveToUndoStack();
    }
}

function sendElementBack() {
    if (!selectedElement) return;
    const band = layoutData.bands.find(b => b.id === selectedElement.bandId);
    const element = findElement(selectedElement.id, selectedElement.bandId);
    if (band && element) {
        element.z_index = Math.min(...band.elements.map(e => e.z_index || 1)) - 1;
        renderCanvas();
        selectElement(element.id, selectedElement.bandId);
        saveToUndoStack();
    }
}

function duplicateSelectedElement() {
    if (!selectedElement) return;
    const element = findElement(selectedElement.id, selectedElement.bandId);
    const band = layoutData.bands.find(b => b.id === selectedElement.bandId);
    if (!element || !band) return;
    const copy = JSON.parse(JSON.stringify(element));
    copy.id = `element_${elementIdCounter++}`;
    copy.x = (copy.x || 0) + 10;
    copy.y = (copy.y || 0) + 10;
    band.elements.push(copy);
    renderCanvas();
    selectElement(copy.id, selectedElement.bandId);
    saveToUndoStack();
    showToast('Elemento duplicado', 'success');
}

function deleteSelectedElement() {
    if (!selectedElement) return;
    const band = layoutData.bands.find(b => b.id === selectedElement.bandId);
    if (!band) return;
    const idx = band.elements.findIndex(e => e.id === selectedElement.id);
    if (idx !== -1) {
        band.elements.splice(idx, 1);
        renderCanvas();
        deselectAll();
        saveToUndoStack();
        showToast('Elemento deletado', 'success');
    }
}

// ===== GROUP BANDS =====

function addGroupBand() {
    const groupField = prompt('Nome do campo de agrupamento (ex: CIDADE, CLIENTE):');
    if (!groupField) return;
    
    const slug = groupField.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    const ts = Date.now();
    
    // Find the detail band index to insert before/after it
    const detailIdx = layoutData.bands.findIndex(b => b.type === 'detail');
    const insertBefore = detailIdx >= 0 ? detailIdx : layoutData.bands.length;
    
    const groupHeader = {
        id: `group_header_${slug}_${ts}`,
        type: 'group_header',
        name: `Grupo - Cabeçalho [${groupField}]`,
        group_field: groupField,
        height: 30,
        visible: true,
        background_color: '#e8f4fd',
        elements: []
    };
    
    const groupFooter = {
        id: `group_footer_${slug}_${ts}`,
        type: 'group_footer',
        name: `Grupo - Rodapé [${groupField}]`,
        group_field: groupField,
        height: 30,
        visible: true,
        background_color: '#f0f8e8',
        elements: []
    };
    
    layoutData.bands.splice(insertBefore, 0, groupHeader);
    // Footer after detail
    const newDetailIdx = layoutData.bands.findIndex(b => b.type === 'detail');
    layoutData.bands.splice(newDetailIdx >= 0 ? newDetailIdx + 1 : layoutData.bands.length, 0, groupFooter);
    
    renderCanvas();
    renderBandsList();
    saveToUndoStack();
    showToast(`Bandas de grupo criadas para campo "${groupField}"`, 'success');
}

function addBand(type) {
    const ts = Date.now();
    const typeMap = {
        'header': { name: 'Cabeçalho Extra', bg: '#fff8e1' },
        'footer': { name: 'Rodapé Extra', bg: '#fff3e0' }
    };
    const cfg = typeMap[type] || { name: 'Banda', bg: '#fff' };
    
    layoutData.bands.push({
        id: `band_${type}_${ts}`,
        type: type,
        name: cfg.name,
        height: 40,
        visible: true,
        background_color: cfg.bg,
        elements: []
    });
    
    renderCanvas();
    renderBandsList();
    saveToUndoStack();
    showToast(`Banda "${cfg.name}" adicionada`, 'success');
}

function removeGroupBand(bandId) {
    const band = layoutData.bands.find(b => b.id === bandId);
    if (!band) return;
    
    if (!confirm(`Remover a banda "${band.name}" e todos os seus elementos?`)) return;
    
    // If it's a group header, also offer to remove its footer
    if (band.type === 'group_header' && band.group_field) {
        const footer = layoutData.bands.find(b => b.type === 'group_footer' && b.group_field === band.group_field);
        if (footer && confirm(`Remover também o rodapé de grupo "${footer.name}"?`)) {
            layoutData.bands = layoutData.bands.filter(b => b.id !== footer.id);
        }
    }
    
    layoutData.bands = layoutData.bands.filter(b => b.id !== bandId);
    renderCanvas();
    renderBandsList();
    deselectAll();
    saveToUndoStack();
    showToast('Banda removida', 'info');
}

// ===== EXPRESSION AUTOCOMPLETE =====

function setupExpressionAutocomplete(textarea) {
    if (!textarea) return;
    
    let autocompleteBox = null;
    
    textarea.addEventListener('keyup', (e) => {
        const val = textarea.value;
        const pos = textarea.selectionStart;
        
        // Find if we're inside an open bracket [
        const beforeCursor = val.substring(0, pos);
        const lastBracket = beforeCursor.lastIndexOf('[');
        const lastClosing = beforeCursor.lastIndexOf(']');
        
        if (lastBracket > lastClosing) {
            // We're inside a field reference [...]
            const partial = beforeCursor.substring(lastBracket + 1).toLowerCase();
            const matches = camposDisponiveis.filter(f => f.toLowerCase().startsWith(partial));
            
            if (matches.length > 0) {
                showAutocomplete(textarea, matches, lastBracket, pos);
                return;
            }
        }
        
        hideAutocomplete();
    });
    
    textarea.addEventListener('blur', () => {
        setTimeout(hideAutocomplete, 200);
    });
    
    function showAutocomplete(ta, matches, bracketPos, curPos) {
        hideAutocomplete();
        
        const rect = ta.getBoundingClientRect();
        autocompleteBox = document.createElement('div');
        autocompleteBox.className = 'expr-autocomplete';
        autocompleteBox.style.cssText = `
            position:fixed; background:#2d2d30; border:1px solid #555; border-radius:4px;
            box-shadow:0 4px 12px rgba(0,0,0,0.5); z-index:99999;
            max-height:160px; overflow-y:auto; font-size:12px;
            left:${rect.left}px; top:${rect.bottom + 2}px; min-width:180px;
        `;
        
        matches.slice(0, 10).forEach(field => {
            const item = document.createElement('div');
            item.style.cssText = 'padding:6px 12px; cursor:pointer; color:#cccccc; border-bottom:1px solid #3c3c3c;';
            item.textContent = field;
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const before = ta.value.substring(0, bracketPos + 1);
                const after = ta.value.substring(curPos);
                ta.value = before + field + ']' + after;
                ta.dispatchEvent(new Event('input'));
                ta.dispatchEvent(new Event('change'));
                hideAutocomplete();
                ta.focus();
            });
            item.addEventListener('mouseenter', () => item.style.background = '#3c3c3c');
            item.addEventListener('mouseleave', () => item.style.background = '');
            autocompleteBox.appendChild(item);
        });
        
        if (matches.length > 10) {
            const more = document.createElement('div');
            more.style.cssText = 'padding:4px 12px; color:#969696; font-size:11px;';
            more.textContent = `+${matches.length - 10} campos adicionais...`;
            autocompleteBox.appendChild(more);
        }
        
        document.body.appendChild(autocompleteBox);
        window._exprAutocompleteBox = autocompleteBox;
    }
    
    function hideAutocomplete() {
        if (window._exprAutocompleteBox) {
            window._exprAutocompleteBox.remove();
            window._exprAutocompleteBox = null;
        }
        autocompleteBox = null;
    }
}

// Hook expression autocomplete into property inputs after rendering
const _origAttachPropertyListeners = attachPropertyListeners;
function attachPropertyListeners(element) {
    _origAttachPropertyListeners(element);
    
    // Setup autocomplete for expression and richtext fields
    document.querySelectorAll('[data-prop="expression"], [data-prop="visibility_expression"], [data-prop="richtext_content"]').forEach(ta => {
        setupExpressionAutocomplete(ta);
    });
    
    // Handle datatable columns string → array conversion
    const dtColInput = document.querySelector('[data-prop="_datatable_columns_str"]');
    if (dtColInput) {
        dtColInput.addEventListener('change', () => {
            element.datatable_columns = dtColInput.value.split(',').map(s => s.trim()).filter(Boolean);
        });
    }
    
    // Apply rotation in DOM preview
    document.querySelectorAll('[data-prop="rotation"]').forEach(inp => {
        inp.addEventListener('input', () => {
            const elementEl = document.querySelector(`[data-element-id="${selectedElement?.id}"]`);
            if (elementEl) {
                elementEl.style.transform = `rotate(${inp.value || 0}deg)`;
            }
        });
    });
}

// ===== EXPORT (Excel/CSV/HTML) =====

async function exportReport(format) {
    if (!currentLayoutId) {
        showToast('Salve o layout antes de exportar', 'info');
        return;
    }
    
    showToast(`Exportando como ${format.toUpperCase()}...`, 'info');
    
    try {
        const response = await fetch('/report-designer/export/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCsrfToken()
            },
            body: JSON.stringify({
                layout_id: currentLayoutId,
                layout_json: layoutData,
                format: format
            })
        });
        
        if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            showToast(data.message || `Erro ao exportar como ${format}`, 'error');
            return;
        }
        
        const blob = await response.blob();
        const ext = { excel: 'xlsx', csv: 'csv', html: 'html' }[format] || format;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `relatorio_${currentLayoutId}.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Exportado como ${format.toUpperCase()} com sucesso!`, 'success');
    } catch (err) {
        console.error(err);
        showToast(`Erro ao exportar: ${err.message}`, 'error');
    }
}

// Expose export to global for toolbar buttons
window.exportReport = exportReport;
window.alignElements = alignElements;
window.distributeElements = distributeElements;
window.addGroupBand = addGroupBand;
window.addBand = addBand;
window.removeGroupBand = removeGroupBand;
window.bringElementFront = bringElementFront;
window.sendElementBack = sendElementBack;
window.duplicateSelectedElement = duplicateSelectedElement;
window.deleteSelectedElement = deleteSelectedElement;