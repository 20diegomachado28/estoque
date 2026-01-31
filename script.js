// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyA6SGQ_cxiQTetsrEGGjymdKwSKM6T-MZ0",
  authDomain: "estoque-d84cc.firebaseapp.com",
  databaseURL: "https://estoque-d84cc-default-rtdb.firebaseio.com/",
  projectId: "estoque-d84cc",
  storageBucket: "estoque-d84cc.firebasestorage.app",
  messagingSenderId: "405806939263",
  appId: "1:405806939263:web:bf37aac13f7c7a9e69534a"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const auth = firebase.auth();

auth.signOut(); 

function fazerLogin() {
    const email = document.getElementById('login-email').value;
    const senha = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, senha).catch(e => {
        document.getElementById('login-error').innerText = "Acesso negado!";
    });
}

function fazerLogout() { auth.signOut(); }

auth.onAuthStateChanged(user => {
    if (user) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('main-container').style.display = 'block';
        carregarDadosFirebase();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('main-container').style.display = 'none';
    }
});

let estoque = [];
let proximoId = 1;
let scannerDestino = '';
let itensConferencia = [];

function carregarDadosFirebase() {
    db.ref('estoque').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            estoque = Object.values(data);
            proximoId = estoque.length > 0 ? Math.max(...estoque.map(p => p.id)) + 1 : 1;
            renderizarTabela();
        } else {
            estoque = [];
            renderizarTabela();
        }
    });
}

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
        qtd: parseInt(document.getElementById('qtd').value) || 0,
        valor: document.getElementById('valor').value,
        barcode: document.getElementById('barcode').value,
        fornecedor: document.getElementById('fornecedor').value,
        grupo: document.getElementById('grupo').value
    };

    if(!p.desc) return alert("Preencha a descrição!");
    
    estoque.push(p);
    renderizarTabela();
    limparCampos();
    toggleElement('areaCadastro');
    
    const areaLista = document.getElementById('areaListaProdutos');
    if(areaLista) areaLista.style.display = 'block';
}

function salvarLocal() {
    const dadosParaSalvar = {};
    estoque.forEach(p => {
        dadosParaSalvar[p.id] = p;
    });

    db.ref('estoque').set(dadosParaSalvar)
    .then(() => alert("✅ Dados salvos e sincronizados no Firebase!"))
    .catch(e => alert("❌ Erro ao salvar: " + e.message));
}

function renderizarTabela(dados = estoque) {
    const corpo = document.getElementById('listaProdutos');
    if(!corpo) return;
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
                <td><input type="text" value="${p.valor}" onchange="editar(${p.id}, 'valor', this.value)" style="width:70px"></td>
                <td><input type="text" value="${p.barcode || ''}" onchange="editar(${p.id}, 'barcode', this.value)" style="width:90px"></td>
                <td><button onclick="remover(${p.id})" style="background:red; color:white;">X</button></td>
            </tr>`;
    });
}

function prepararConferencia() {
    toggleElement('areaConferencia');
    const select = document.getElementById('selectFornecedorConf');
    const fornecedores = [...new Set(estoque.map(p => p.fornecedor).filter(f => f))];
    select.innerHTML = '<option value="">Selecione um Fornecedor...</option>';
    fornecedores.forEach(f => { select.innerHTML += `<option value="${f}">${f}</option>`; });
}

function iniciarCheckout() {
    const fornecedor = document.getElementById('selectFornecedorConf').value;
    if(!fornecedor) {
        document.getElementById('controleCheckout').style.display = 'none';
        return;
    }
    document.getElementById('controleCheckout').style.display = 'block';
    document.getElementById('btnPdfConf').style.display = 'block';
    if(!document.getElementById('btnResetConf')) {
        const btnReset = document.createElement('button');
        btnReset.id = 'btnResetConf';
        btnReset.innerText = '🔄 Resetar Conferência';
        btnReset.style = 'width: 100%; margin-top: 10px; background: #7f8c8d; color: white; border: none; padding: 10px; border-radius: 4px; cursor: pointer;';
        btnReset.onclick = resetarConferencia;
        document.getElementById('controleCheckout').appendChild(btnReset);
    }
    
    itensConferencia = estoque.filter(p => p.fornecedor === fornecedor).map(p => ({ ...p, bipados: 0 }));
    atualizarListaCheckout();
}

function atualizarListaCheckout() {
    const container = document.getElementById('listaCheckoutPendente');
    container.innerHTML = '';
    const bipados = itensConferencia.filter(p => p.bipados > 0);
    if(bipados.length > 0) {
        container.innerHTML += '<p><strong>Conferidos:</strong></p>';
        bipados.forEach(p => {
            container.innerHTML += `
                <div style="border-bottom: 1px solid #eee; padding: 5px; display: flex; justify-content: space-between; background: #eaffea;">
                    <span>✅ ${p.desc} (${p.bipados})</span>
                    <button onclick="removerItemConferencia(${p.id})" style="background:none; color:red; border:none; cursor:pointer; font-weight:bold;">X</button>
                </div>`;
        });
    }
    const pendentes = itensConferencia.filter(p => p.bipados < p.qtd);
    if(pendentes.length === 0 && itensConferencia.length > 0) {
        container.innerHTML += '<p style="color:green; font-weight:bold; margin-top:10px;">✅ Todos os itens conferidos!</p>';
        return;
    }
    container.innerHTML += '<p style="margin-top:10px;"><strong>Pendentes:</strong></p>';
    pendentes.forEach(p => {
        container.innerHTML += `
            <div style="border-bottom: 1px solid #eee; padding: 5px; display: flex; justify-content: space-between;">
                <span><strong>${p.desc}</strong></span>
                <span>Faltam: <strong>${p.qtd - p.bipados}</strong></span>
            </div>`;
    });
}

function removerItemConferencia(id) {
    const item = itensConferencia.find(p => p.id === id);
    if(item && item.bipados > 0) {
        item.bipados--;
        atualizarListaCheckout();
    }
}

function resetarConferencia() {
    if(confirm("Deseja zerar toda a conferência atual?")) {
        itensConferencia.forEach(p => p.bipados = 0);
        atualizarListaCheckout();
    }
}

function validarItemCheckout(codigo) {
    if(!codigo) return;
    const termo = codigo.toString().toLowerCase();
    const item = itensConferencia.find(p => 
        (p.barcode && p.barcode.toString() === termo) || 
        (p.id && p.id.toString() === termo) || 
        (p.ref && p.ref.toString().toLowerCase() === termo) ||
        (p.desc && p.desc.toLowerCase().includes(termo))
    );
    if(!item) return alert("❌ Produto não encontrado neste fornecedor!");
    if(item.bipados >= item.qtd) return alert(`⚠️ EXCESSO: ${item.desc} já conferido!`);
    item.bipados++;
    atualizarListaCheckout();
}

function processarBipeManual() {
    const busca = document.getElementById('inputManualConf').value;
    validarItemCheckout(busca);
    document.getElementById('inputManualConf').value = '';
}

function limparCampos() {
    ['desc', 'ref', 'qtd', 'valor', 'barcode', 'fornecedor', 'grupo'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = '';
    });
}

function editar(id, campo, valor) {
    const item = estoque.find(p => p.id === id);
    if(item) {
        item[campo] = valor;
        db.ref('estoque/' + id).update({ [campo]: valor });
    }
}

// AJUSTE: Remove do banco e atualiza a tela IMEDIATAMENTE
function remover(id) {
    if(confirm("Excluir item?")) {
        db.ref('estoque/' + id).remove().then(() => {
            // Remove do array local para sumir da tela na hora
            estoque = estoque.filter(p => p.id !== id);
            renderizarTabela();
        });
    }
}

function buscar() {
    const termo = document.getElementById('inputBusca').value.toLowerCase();
    const filtrados = estoque.filter(p => 
        p.id.toString().includes(termo) || 
        p.desc.toLowerCase().includes(termo) || 
        (p.barcode && p.barcode.includes(termo)) ||
        (p.ref && p.ref.toLowerCase().includes(termo))
    );
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

function gerarPDFConferencia() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const fornecedor = document.getElementById('selectFornecedorConf').value;
    const dataHora = new Date().toLocaleString();
    doc.setFontSize(10);
    doc.text(dataHora, 195, 10, { align: 'right' });
    doc.setFontSize(16);
    doc.text(`Relatório de Conferência - ${fornecedor}`, 14, 20);
    const rows = itensConferencia.map(p => [p.desc, p.qtd, p.bipados, p.qtd === p.bipados ? 'OK' : 'FALTANTE']);
    doc.autoTable({ head: [['Item', 'Qtd Esperada', 'Qtd Bipada', 'Status']], body: rows, startY: 30 });
    doc.save(`conferencia_${fornecedor}.pdf`);
}

function gerarPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const dataHora = new Date().toLocaleString();
    doc.setFontSize(10);
    doc.text(dataHora, 195, 10, { align: 'right' });
    doc.setFontSize(16);
    doc.text("Estoque Geral", 14, 20);
    const rows = estoque.map(p => [p.id, p.desc, p.qtd, `R$ ${p.valor}`]);
    doc.autoTable({ head: [['ID', 'Descrição', 'Qtd', 'Valor']], body: rows, startY: 30 });
    doc.save("estoque.pdf");
}

function toggleLista() {
    toggleElement('areaListaProdutos');
}