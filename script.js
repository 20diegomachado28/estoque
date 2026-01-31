// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyA6SGQ_cxiQTetsrEGGjymdKwSKM6T-MZ0",
  authDomain: "estoque-d84cc.firebaseapp.com",
  databaseURL: "https://estoque-d84cc-default-rtdb.firebaseio.com/", // <--- ADICIONEI ESTA LINHA
  projectId: "estoque-d84cc",
  storageBucket: "estoque-d84cc.firebasestorage.app",
  messagingSenderId: "405806939263",
  appId: "1:405806939263:web:bf37aac13f7c7a9e69534a"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ... RESTANTE DO SEU CÓDIGO PERMANECE IGUAL ...

let estoque = [];
let proximoId = 1;
let scannerDestino = '';
let itensConferencia = [];

// Sincronização em tempo real com Firebase
db.ref('estoque').on('value', (snapshot) => {
    const data = snapshot.val();
    estoque = data ? Object.values(data) : [];
    proximoId = estoque.length > 0 ? Math.max(...estoque.map(p => p.id)) + 1 : 1;
    renderizarTabela();
});

document.getElementById('data-atual').innerText = `Data: ${new Date().toLocaleDateString()}`;

function toggleElement(id) {
    const el = document.getElementById(id);
    el.style.display = (el.style.display === 'none' || el.style.display === '') ? 'block' : 'none';
}

function adicionarProduto() {
    const p = {
        id: proximoId++,
        desc: document.getElementById('desc').value,
        ref: document.getElementById('ref').value,
        qtd: document.getElementById('qtd').value,
        valor: document.getElementById('valor').value,
        barcode: document.getElementById('barcode').value,
        fornecedor: document.getElementById('fornecedor').value,
        grupo: document.getElementById('grupo').value
    };

    if(!p.desc) return alert("Preencha a descrição!");
    
    // Salva direto no Firebase usando o ID como chave
    db.ref('estoque/' + p.id).set(p);
    
    limparCampos();
    toggleElement('areaCadastro');
}

function limparCampos() {
    ['desc', 'ref', 'qtd', 'valor', 'barcode', 'fornecedor', 'grupo'].forEach(id => document.getElementById(id).value = '');
}

function renderizarTabela(dados = estoque) {
    const corpo = document.getElementById('listaProdutos');
    corpo.innerHTML = '';
    dados.forEach((p) => {
        corpo.innerHTML += `
            <tr>
                <td>${p.id}</td>
                <td><input type="text" value="${p.desc}" onchange="editar(${p.id}, 'desc', this.value)"></td>
                <td>
                    <small>F:</small> <input type="text" value="${p.fornecedor || ''}" onchange="editar(${p.id}, 'fornecedor', this.value)" style="width:70px; font-size:10px"><br>
                    <small>G:</small> <input type="text" value="${p.grupo || ''}" onchange="editar(${p.id}, 'grupo', this.value)" style="width:70px; font-size:10px">
                </td>
                <td><input type="number" value="${p.qtd}" onchange="editar(${p.id}, 'qtd', this.value)" style="width:50px"></td>
                <td><input type="number" value="${p.valor}" onchange="editar(${p.id}, 'valor', this.value)" style="width:70px"></td>
                <td>${p.barcode}</td>
                <td><button onclick="remover(${p.id})" style="background:red; color:white;">X</button></td>
            </tr>
        `;
    });
}

function prepararConferencia() {
    toggleElement('areaConferencia');
    const select = document.getElementById('selectFornecedorConf');
    const fornecedores = [...new Set(estoque.map(p => p.fornecedor).filter(f => f))];
    
    select.innerHTML = '<option value="">Selecione um Fornecedor...</option>';
    fornecedores.forEach(f => {
        select.innerHTML += `<option value="${f}">${f}</option>`;
    });
}

function iniciarCheckout() {
    const fornecedor = document.getElementById('selectFornecedorConf').value;
    if(!fornecedor) {
        document.getElementById('controleCheckout').style.display = 'none';
        return;
    }
    document.getElementById('controleCheckout').style.display = 'block';
    document.getElementById('btnPdfConf').style.display = 'block';
    
    itensConferencia = estoque
        .filter(p => p.fornecedor === fornecedor)
        .map(p => ({ ...p, bipados: 0 }));
    
    atualizarListaCheckout();
}

function atualizarListaCheckout() {
    const container = document.getElementById('listaCheckoutPendente');
    container.innerHTML = '';
    const pendentes = itensConferencia.filter(p => p.bipados < p.qtd);
    if(pendentes.length === 0) {
        container.innerHTML = '<p style="color:green; font-weight:bold;">✅ Todos os itens conferidos!</p>';
        return;
    }
    pendentes.forEach(p => {
        container.innerHTML += `<div style="border-bottom: 1px solid #eee; padding: 5px; display: flex; justify-content: space-between;">
                <span><strong>${p.desc}</strong></span>
                <span>Faltam: <strong>${p.qtd - p.bipados}</strong></span>
            </div>`;
    });
}

function processarBipeManual() {
    const busca = document.getElementById('inputManualConf').value;
    validarItemCheckout(busca);
    document.getElementById('inputManualConf').value = '';
}

function validarItemCheckout(codigo) {
    if(!codigo) return;
    const item = itensConferencia.find(p => p.barcode === codigo || p.id.toString() === codigo || p.desc.toLowerCase() === codigo.toLowerCase());
    if(!item) return alert("❌ Produto não encontrado!");
    if(item.bipados >= item.qtd) return alert(`⚠️ EXCESSO: ${item.desc} já conferido!`);
    item.bipados++;
    atualizarListaCheckout();
}

function gerarPDFConferencia() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fornecedor = document.getElementById('selectFornecedorConf').value;
    doc.text(`Conferência: ${fornecedor}`, 14, 15);
    let totalItens = 0, valorTotal = 0;
    const rows = itensConferencia.map(p => {
        const subtotal = p.bipados * parseFloat(p.valor || 0);
        totalItens += p.bipados; valorTotal += subtotal;
        return [p.desc, p.bipados, `R$ ${parseFloat(p.valor).toFixed(2)}`, `R$ ${subtotal.toFixed(2)}`];
    });
    doc.autoTable({ head: [['Descrição', 'Qtd', 'Unit.', 'Subtotal']], body: rows, startY: 30, foot: [['TOTAL', totalItens, '-', `R$ ${valorTotal.toFixed(2)}`]] });
    doc.save(`conf_${fornecedor}.pdf`);
}

function aplicarFiltros() {
    const fFornecedor = document.getElementById('filtroFornecedor').value.toLowerCase();
    const fGrupo = document.getElementById('filtroGrupo').value.toLowerCase();
    const fValor = document.getElementById('filtroValor').value;
    const filtrados = estoque.filter(p => {
        const matchFornecedor = (p.fornecedor || "").toLowerCase().includes(fFornecedor);
        const matchGrupo = (p.grupo || "").toLowerCase().includes(fGrupo);
        const matchValor = fValor ? parseFloat(p.valor) <= parseFloat(fValor) : true;
        return matchFornecedor && matchGrupo && matchValor;
    });
    renderizarTabela(filtrados);
}

function editar(id, campo, valor) {
    db.ref('estoque/' + id).update({ [campo]: valor });
}

function remover(id) {
    if(confirm("Deseja excluir?")) db.ref('estoque/' + id).remove();
}

function salvarLocal() {
    alert("O sistema agora salva automaticamente na nuvem Firebase!");
}

function buscar() {
    const termo = document.getElementById('inputBusca').value.toLowerCase();
    const filtrados = estoque.filter(p => p.id.toString().includes(termo) || p.desc.toLowerCase().includes(termo) || p.barcode.includes(termo));
    renderizarTabela(filtrados);
}

function iniciarScanner(destino) {
    scannerDestino = destino;
    const divScanner = document.getElementById('interactive');
    divScanner.style.display = 'block';
    Quagga.init({
        inputStream: { name: "Live", type: "LiveStream", target: divScanner, constraints: { facingMode: "environment" } },
        decoder: { readers: ["ean_reader", "code_128_reader"] }
    }, (err) => { if(!err) Quagga.start(); });
    Quagga.onDetected((data) => {
        const code = data.codeResult.code;
        if(scannerDestino === 'cadastro') document.getElementById('barcode').value = code;
        else if(scannerDestino === 'conferencia') validarItemCheckout(code);
        else { document.getElementById('inputBusca').value = code; buscar(); }
        Quagga.stop(); divScanner.style.display = 'none';
    });
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Relatório de Estoque Geral", 14, 15);
    const rows = estoque.map(p => [p.id, p.desc, p.qtd, `R$ ${p.valor}`]);
    doc.autoTable({ head: [['ID', 'Descrição', 'Qtd', 'Valor']], body: rows, startY: 30 });
    doc.save("estoque_geral.pdf");
}