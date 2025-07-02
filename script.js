// script.js

// Importa as funções necessárias do Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut,
    onAuthStateChanged,
    signInWithCustomToken
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { // Importa funções e FieldValue diretamente
    getFirestore,
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    onSnapshot,
    setDoc,
    increment, // Importa a função increment diretamente
    orderBy, // Importa orderBy para ordenação
    limit // Importa limit para limitar resultados
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";


// Configuração do Firebase fornecida pelo usuário
const firebaseConfig = {
    apiKey: "AIzaSyANwSekMLDgTW2MnOPJ9KboJh4CetX2xBo",
    authDomain: "sistema-pia.firebaseapp.com",
    projectId: "sistema-pia",
    storageBucket: "sistema-pia.firebasestorage.app",
    messagingSenderId: "626462829808",
    appId: "1:626462829808:web:aa0aa4048f1a82c5c0a635",
    measurementId: "G-T7YBKWB48G"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Variáveis globais para o ID do aplicativo e ID do usuário
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
let userId = null; // Será definido após a autenticação
let userName = 'Usuário Desconhecido'; // Será definido após o login para histórico
// userRole será mantido para consistência, mas não será usado para permissões
let userRole = 'guest'; // Papel inicial padrão para utilizadores não autenticados

// Variáveis para os gráficos
let entradasChartInstance = null;
let saidasChartInstance = null;

// Variável para armazenar a última transação de saída para impressão
let lastExitTransaction = null;

// Variáveis para armazenar os unsubscribers dos listeners onSnapshot
let unsubscribeItems = null;
let unsubscribePeople = null;
let unsubscribeVolunteers = null;
let unsubscribeAppointments = null; // Novo unsubscriber para agendamentos

// --- Declarações de Variáveis Globais para Elementos do DOM ---
// Estas variáveis serão inicializadas dentro de DOMContentLoaded
let loginSection, registerSection, resetPasswordSection, dashboardSection, authWrapper;
let loginForm, registerForm, resetPasswordForm, logoutButton;
let showRegisterLink, showResetPasswordLink, showLoginFromRegisterLink, showLoginFromResetLink;
let navOverview, navEntrada, navSaida, navCadastroPessoas, navCadastroVoluntarios, navAgendamentos, navRelatorios, navPesquisa;
let dashboardOverviewSection, entradaSection, saidaSection, cadastroPessoasSection, cadastroVoluntariosSection, agendamentosSection, relatoriosSection, pesquisaSection;
let entradaForm, saidaForm, cadastroPessoasForm, cadastroVoluntariosForm, agendamentoForm, searchForm;
let currentStockList, currentPeopleList, currentVolunteersList, currentAgendamentosList;
let saidaPessoaSelect, saidaItemsContainer, addItemRowButton, printLastReceiptButton;
let relatorioEstoqueList, relatorioAtendimentosList, searchResultsList;
let personHistoryModal, closePersonHistoryModalButton, personHistoryTitle, personHistoryContent, printPersonHistoryButton;
let entradasChartContainer, saidasChartContainer;
let agendamentoVoluntarioSelect, agendamentoItemsContainer, addAgendamentoItemRowButton;
let overviewTotalItems, overviewTotalPeople, overviewUpcomingAppointments, overviewLatestEntries, overviewLatestExits;

// Novas variáveis para o modal de notificação persistente
let notificationModal, closeNotificationModalButton, notificationMessageContent, notificationOkButton;


// Função para exibir mensagens ao usuário (mensagens temporárias)
function showMessage(message, type = 'info') {
    const messageBox = document.getElementById('message-box');
    messageBox.textContent = message;
    messageBox.className = `fixed bottom-4 right-4 px-4 py-2 rounded-md shadow-lg ${type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500'} text-white block`;
    setTimeout(() => {
        messageBox.classList.add('hidden');
    }, 3000);
}

// NOVA FUNÇÃO: Exibe uma notificação persistente com som
function showPersistentNotification(message) {
    if (notificationMessageContent && notificationModal) {
        notificationMessageContent.textContent = message;
        notificationModal.classList.remove('hidden');

        // Toca um som
        try {
            // Certifique-se de que o Tone.js foi carregado no seu HTML
            const synth = new Tone.Synth().toDestination();
            synth.triggerAttackRelease("C4", "8n"); // Toca um C4 por 1/8 de nota
        } catch (e) {
            console.error("Erro ao tocar som de notificação:", e);
            // Pode ser que o Tone.js não tenha sido carregado ou o contexto de áudio não foi iniciado
            // devido a restrições do navegador (ex: precisa de interação do usuário primeiro).
        }
    } else {
        console.warn("Elementos do modal de notificação não encontrados. Exibindo como mensagem temporária.");
        showMessage(message, 'info'); // Fallback para mensagem temporária
    }
}


// Função para alternar a visibilidade das seções
function showSection(sectionToShow) {
    const sections = [loginSection, registerSection, resetPasswordSection, dashboardSection];
    sections.forEach(section => {
        if (section) {
            section.classList.add('hidden');
        }
    });

    // Controla a visibilidade do wrapper de autenticação
    if (sectionToShow === loginSection || sectionToShow === registerSection || sectionToShow === resetPasswordSection) {
        authWrapper.classList.remove('hidden');
        dashboardSection.classList.add('hidden'); // Garante que o dashboard esteja escondido
    } else {
        authWrapper.classList.add('hidden');
        dashboardSection.classList.remove('hidden'); // Garante que o dashboard esteja visível
    }

    if (sectionToShow) {
        sectionToShow.classList.remove('hidden');
    }
}

// Função para verificar se o utilizador tem permissão
// Esta função agora sempre retorna true para utilizadores autenticados
function hasPermission(requiredRoles) {
    return userId !== null; // Se o utilizador estiver logado, tem permissão total
}

// Função para atualizar a visibilidade da UI com base no papel do utilizador
// Agora, se o utilizador estiver autenticado, todas as opções são mostradas
function updateUIBasedOnRole() {
    const navLinks = {
        'nav-overview': navOverview,
        'nav-entrada': navEntrada,
        'nav-saida': navSaida,
        'nav-cadastro-pessoas': navCadastroPessoas,
        'nav-cadastro-voluntarios': navCadastroVoluntarios,
        'nav-agendamentos': navAgendamentos,
        'nav-relatorios': navRelatorios,
        'nav-pesquisa': navPesquisa
    };

    const sensitiveButtons = document.querySelectorAll('.edit-button, .delete-button, .status-button');
    const sensitiveForms = [
        entradaForm,
        saidaForm,
        cadastroPessoasForm,
        cadastroVoluntariosForm,
        agendamentoForm
    ];

    if (userId) { // Se o utilizador estiver autenticado
        Object.values(navLinks).forEach(link => link && link.classList.remove('hidden'));
        sensitiveButtons.forEach(button => button.classList.remove('hidden'));
        sensitiveForms.forEach(form => {
            if (form) form.classList.remove('hidden');
        });
        document.getElementById('add-item-row') && document.getElementById('add-item-row').classList.remove('hidden');
        document.getElementById('add-agendamento-item-row') && document.getElementById('add-agendamento-item-row').classList.remove('hidden');
    } else { // Se não estiver autenticado (guest)
        Object.values(navLinks).forEach(link => link && link.classList.add('hidden'));
        sensitiveButtons.forEach(button => button.classList.add('hidden'));
        sensitiveForms.forEach(form => {
            if (form) form.classList.add('hidden');
        });
        document.getElementById('add-item-row') && document.getElementById('add-item-row').classList.add('hidden');
        document.getElementById('add-agendamento-item-row') && document.getElementById('add-agendamento-item-row').classList.add('hidden');
    }
}


function showDashboardContent(contentSectionToShow) {
    const contentSections = [dashboardOverviewSection, entradaSection, saidaSection, cadastroPessoasSection, cadastroVoluntariosSection, agendamentosSection, relatoriosSection, pesquisaSection];
    contentSections.forEach(section => {
        if (section) {
            section.classList.add('hidden');
        }
    });
    if (contentSectionToShow) {
        contentSectionToShow.classList.remove('hidden');
    }

    // Remove a classe 'active' de todos os links de navegação e adiciona ao link clicado
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    // Adiciona a classe 'active' ao link de navegação correspondente à seção mostrada
    if (contentSectionToShow === dashboardOverviewSection) {
        navOverview.classList.add('active');
        loadDashboardOverviewData(); // Carrega os dados da visão geral
    } else if (contentSectionToShow === entradaSection) {
        navEntrada.classList.add('active');
    } else if (contentSectionToShow === saidaSection) {
        navSaida.classList.add('active');
    } else if (contentSectionToShow === cadastroPessoasSection) {
        navCadastroPessoas.classList.add('active');
    } else if (contentSectionToShow === cadastroVoluntariosSection) {
        navCadastroVoluntarios.classList.add('active');
    } else if (contentSectionToShow === agendamentosSection) { // Ativa o link de agendamentos
        navAgendamentos.classList.add('active');
    } else if (contentSectionToShow === relatoriosSection) {
        navRelatorios.classList.add('active');
    } else if (contentSectionToShow === pesquisaSection) {
        navPesquisa.classList.add('active');
    }

    // Sempre chama updateUIBasedOnRole ao mudar de seção para garantir a visibilidade correta
    updateUIBasedOnRole();
}

// --- Funções do Dashboard ---

// Carrega dados iniciais do dashboard (ex: estoque atual)
async function loadInitialDashboardData() {
    if (!userId) return; // Garante que o userId está disponível
    showDashboardContent(dashboardOverviewSection); // Mostra a visão geral por padrão
    loadItems();
    loadPeople();
    loadVolunteers(); // Carrega voluntários ao iniciar o dashboard
    loadAppointments(); // Carrega agendamentos ao iniciar o dashboard
    checkUpcomingAppointments(); // Verifica agendamentos ao carregar o dashboard
}

// --- Nova função para carregar dados da Visão Geral do Dashboard ---
async function loadDashboardOverviewData() {
    if (!userId) return;
    console.log("Iniciando loadDashboardOverviewData...");

    try {
        // Total de Itens em Estoque
        const itemsSnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/items`));
        let totalItems = 0;
        itemsSnapshot.forEach(doc => {
            totalItems += doc.data().quantity || 0;
        });
        overviewTotalItems.textContent = totalItems;
        console.log("Total de Itens em Estoque:", totalItems);


        // Total de Pessoas Atendidas
        const peopleSnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/peopleServed`));
        overviewTotalPeople.textContent = peopleSnapshot.size;
        console.log("Total de Pessoas Atendidas:", peopleSnapshot.size);

        // Agendamentos Próximos (próximas 24 horas)
        const now = new Date();
        const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Fetch all 'agendado' appointments and filter in memory
        const appointmentsQuery = query(
            collection(db, `artifacts/${appId}/public/data/appointments`),
            where("status", "==", "agendado")
            // Não adicionamos where("dateTime", ">=", now) e where("dateTime", "<=", twentyFourHoursFromNow)
            // diretamente na query do Firestore para evitar problemas de índice.
            // Filtraremos em memória.
        );
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        let upcomingAppointmentsCount = 0;
        appointmentsSnapshot.forEach(doc => {
            const data = doc.data();
            const appointmentDateTime = data.dateTime && data.dateTime.seconds ? new Date(data.dateTime.seconds * 1000) : null;
            if (appointmentDateTime && appointmentDateTime > now && appointmentDateTime <= twentyFourHoursFromNow) {
                upcomingAppointmentsCount++;
            }
        });
        overviewUpcomingAppointments.textContent = upcomingAppointmentsCount;
        console.log("Agendamentos Próximos (próximas 24h):", upcomingAppointmentsCount);

        // Últimas Entradas (últimos 5 itens)
        const latestEntriesQuery = query(
            collection(db, `artifacts/${appId}/public/data/items`),
            orderBy("receivedDate", "desc"),
            limit(5)
        );
        const latestEntriesSnapshot = await getDocs(latestEntriesQuery);
        overviewLatestEntries.innerHTML = '';
        console.log("Últimas Entradas (raw snapshot):", latestEntriesSnapshot.docs.map(doc => doc.data()));

        if (latestEntriesSnapshot.empty) {
            overviewLatestEntries.innerHTML = '<li class="text-gray-500 p-2">Nenhuma entrada recente.</li>';
        } else {
            latestEntriesSnapshot.forEach(docItem => {
                const data = docItem.data();
                const li = document.createElement('li');
                li.className = 'border-b border-gray-200 p-2 text-sm';
                const receivedDate = data.receivedDate ? new Date(data.receivedDate.seconds * 1000).toLocaleString() : 'N/A';
                li.innerHTML = `<strong>${data.type} (${data.size})</strong> - Qtd: ${data.quantity} em ${receivedDate}`;
                overviewLatestEntries.appendChild(li);
            });
        }

        // Últimas Saídas (últimas 5 transações)
        // Para as saídas, precisamos buscar as pessoas e depois iterar sobre os itemsReceived
        const latestExitsQuery = query(
            collection(db, `artifacts/${appId}/public/data/peopleServed`),
            orderBy("lastAttended", "desc"), // Ordena pela última vez que a pessoa foi atendida
            limit(5)
        );
        const latestExitsSnapshot = await getDocs(latestExitsQuery);
        overviewLatestExits.innerHTML = '';
        console.log("Últimas Saídas (raw peopleServed snapshot):", latestExitsSnapshot.docs.map(doc => doc.data()));


        if (latestExitsSnapshot.empty) {
            overviewLatestExits.innerHTML = '<li class="text-gray-500 p-2">Nenhuma saída recente.</li>';
        } else {
            let exitTransactions = [];
            latestExitsSnapshot.forEach(personDoc => {
                const personData = personDoc.data();
                if (personData.itemsReceived && personData.itemsReceived.length > 0) {
                    // Adiciona cada transação de saída com o nome da pessoa
                    personData.itemsReceived.forEach(transaction => {
                        exitTransactions.push({
                            personName: personData.name,
                            transactionDate: transaction.date,
                            itemsCount: transaction.items ? transaction.items.length : 0 // Conta quantos itens saíram
                        });
                    });
                }
            });

            // Ordena as transações de saída pela data mais recente
            exitTransactions.sort((a, b) => {
                const dateA = a.transactionDate && a.transactionDate.seconds ? a.transactionDate.seconds : 0;
                const dateB = b.transactionDate && b.transactionDate.seconds ? b.transactionDate.seconds : 0;
                return dateB - dateA;
            });

            // Limita aos 5 mais recentes
            exitTransactions = exitTransactions.slice(0, 5);
            console.log("Últimas Saídas (processadas):", exitTransactions);


            if (exitTransactions.length === 0) {
                overviewLatestExits.innerHTML = '<li class="text-gray-500 p-2">Nenhuma saída recente.</li>';
            } else {
                exitTransactions.forEach(exit => {
                    const li = document.createElement('li');
                    li.className = 'border-b border-gray-200 p-2 text-sm';
                    const transactionDate = exit.transactionDate ? new Date(exit.transactionDate.seconds * 1000).toLocaleString() : 'N/A';
                    li.innerHTML = `<strong>${exit.personName}</strong> retirou ${exit.itemsCount} itens em ${transactionDate}`;
                    overviewLatestExits.appendChild(li);
                });
            }
        }

    } catch (error) {
        console.error("Erro ao carregar dados da Visão Geral:", error);
        showMessage("Erro ao carregar dados da Visão Geral.", 'error');
    }
}


// --- Gestão de Itens (Entrada) ---
// Handler de submit padrão para o formulário de entrada
const defaultEntradaSubmitHandler = async (e) => {
    e.preventDefault();
    // Removida a verificação hasPermission
    const categoria = entradaForm['entrada-categoria'].value;
    const tipo = entradaForm['entrada-tipo'].value;
    const genero = entradaForm['entrada-genero'].value;
    const tamanho = entradaForm['entrada-tamanho'].value;
    const quantidade = parseInt(entradaForm['entrada-quantidade'].value);
    const descricao = entradaForm['entrada-descricao'].value;

    if (!userId) {
        showMessage("Usuário não autenticado. Por favor, faça login.", 'error');
        return;
    }

    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/items`), {
            category: categoria,
            type: tipo,
            gender: genero,
            size: tamanho,
            quantity: quantidade,
            description: descricao,
            receivedDate: new Date(),
            status: 'available',
            addedBy: userName,
            addedById: userId
        });
        showMessage('Item registrado com sucesso!', 'success');
        entradaForm.reset();
        loadDashboardOverviewData(); // Atualiza a visão geral após a entrada
    } catch (error) {
        console.error("Erro ao registrar entrada:", error);
        showMessage(`Erro ao registrar entrada: ${error.message}`, 'error');
    }
};


// Edita um item existente
async function editItem(id) {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para editar itens.", 'error');
        return;
    }
    try {
        const itemDocRef = doc(db, `artifacts/${appId}/public/data/items`, id);
        const itemDoc = await getDoc(itemDocRef);
        if (itemDoc.exists()) {
            const data = itemDoc.data();
            // Preenche o formulário de entrada com os dados para edição
            entradaForm['entrada-categoria'].value = data.category;
            entradaForm['entrada-tipo'].value = data.type;
            entradaForm['entrada-genero'].value = data.gender;
            entradaForm['entrada-tamanho'].value = data.size;
            entradaForm['entrada-quantidade'].value = data.quantity;
            entradaForm['entrada-descricao'].value = data.description || '';

            // Altera o botão de submit para "Atualizar"
            const submitButton = entradaForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Atualizar Item';
            submitButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            submitButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700');

            // Remove o listener de submit existente para evitar duplicação ou comportamento incorreto
            entradaForm.removeEventListener('submit', defaultEntradaSubmitHandler);
            if (entradaForm._currentSubmitHandler) {
                entradaForm.removeEventListener('submit', entradaForm._currentSubmitHandler);
            }

            // Adiciona um novo listener para a atualização
            const newSubmitHandler = async (e) => {
                e.preventDefault();
                // Removida a verificação hasPermission
                const updatedCategoria = entradaForm['entrada-categoria'].value;
                const updatedTipo = entradaForm['entrada-tipo'].value;
                const updatedGenero = entradaForm['entrada-genero'].value;
                const updatedTamanho = entradaForm['entrada-tamanho'].value;
                const updatedQuantidade = parseInt(entradaForm['entrada-quantidade'].value);
                const updatedDescricao = entradaForm['entrada-descricao'].value;

                await updateDoc(itemDocRef, {
                    category: updatedCategoria,
                    type: updatedTipo,
                    gender: updatedGenero,
                    size: updatedTamanho,
                    quantity: updatedQuantidade,
                    description: updatedDescricao,
                    lastUpdated: new Date(),
                    lastUpdatedBy: userName, // Quem atualizou
                    lastUpdatedById: userId // ID de quem atualizou
                });
                showMessage('Item atualizado com sucesso!', 'success');
                entradaForm.reset();
                // Restaura o botão de submit para o estado original
                submitButton.textContent = 'Registrar Entrada';
                submitButton.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                submitButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
                // Remove o listener de atualização e anexa o original novamente
                entradaForm.removeEventListener('submit', newSubmitHandler);
                entradaForm.addEventListener('submit', defaultEntradaSubmitHandler); // Anexa o handler padrão
                loadItems(); // Recarrega a lista
                loadDashboardOverviewData(); // Atualiza a visão geral após a edição
                entradaForm._currentSubmitHandler = null; // Limpa o handler temporário
            };

            // Armazena o handler atual para poder removê-lo
            entradaForm._currentSubmitHandler = newSubmitHandler;
            entradaForm.addEventListener('submit', newSubmitHandler);

            showDashboardContent(entradaSection); // Garante que a seção de entrada esteja visível
        }
    } catch (error) {
        console.error("Erro ao editar item:", error);
        showMessage(`Erro ao editar item: ${error.message}`, 'error');
    }
}

// Carrega e exibe os itens no estoque
async function loadItems() {
    if (!userId) return;
    // Desinscreve o listener anterior para evitar duplicação
    if (unsubscribeItems) {
        unsubscribeItems();
    }

    unsubscribeItems = onSnapshot(collection(db, `artifacts/${appId}/public/data/items`), (snapshot) => {
        currentStockList.innerHTML = ''; // Limpa a lista a cada atualização
        if (snapshot.empty) {
            currentStockList.innerHTML = '<li class="text-gray-500 p-2">Nenhum item no estoque ainda.</li>';
            return;
        }
        snapshot.docs.forEach(docItem => {
            const data = docItem.data();
            const li = document.createElement('li');
            li.className = 'list-item'; // Adiciona a classe list-item
            const receivedDate = data.receivedDate ? new Date(data.receivedDate.seconds * 1000).toLocaleString() : 'N/A';
            const addedBy = data.addedBy || 'Desconhecido'; // Exibe o nome de quem adicionou
            li.innerHTML = `
                <span><strong>Categoria:</strong> ${data.category}</span>
                <span><strong>Tipo:</strong> ${data.type}</span>
                <span><strong>Gênero:</strong> ${data.gender}</span>
                <span><strong>Tamanho:</strong> ${data.size}</span>
                <span><strong>Quantidade:</strong> ${data.quantity}</span>
                <!-- REMOVIDO: <span><strong>Status:</strong> ${data.status}</span> -->
                <span><strong>Entrada por:</strong> ${addedBy} em ${receivedDate}</span>
                <button class="edit-button bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm" data-id="${docItem.id}">Editar</button>
                <button class="delete-button bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm" data-id="${docItem.id}">Excluir</button>
            `;
            currentStockList.appendChild(li);
        });

        // Adiciona event listeners para os botões de editar e excluir
        document.querySelectorAll('.edit-button').forEach(button => {
            // Removida a verificação hasPermission aqui, visível para todos os logados
            if (userId) {
                button.classList.remove('hidden');
                button.onclick = (e) => editItem(e.target.dataset.id);
            } else {
                button.classList.add('hidden');
            }
        });
        document.querySelectorAll('.delete-button').forEach(button => {
            // Removida a verificação hasPermission aqui, visível para todos os logados
            if (userId) {
                button.classList.remove('hidden');
                button.onclick = (e) => deleteItem(e.target.dataset.id);
            } else {
                button.classList.add('hidden');
            }
        });
    }, (error) => {
        console.error("Erro ao carregar itens:", error);
        showMessage("Erro ao carregar estoque de itens.", 'error');
    });
}


// Exclui um item
async function deleteItem(id) {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para excluir itens.", 'error');
        return;
    }
    // Usando um modal customizado em vez de confirm()
    if (await showCustomConfirm('Tem certeza que deseja excluir este item?')) {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/items`, id));
            showMessage('Item excluído com sucesso!', 'success');
            loadDashboardOverviewData(); // Atualiza a visão geral após a exclusão
            // loadItems() será chamado pelo onSnapshot listener
        } catch (error) {
            console.error("Erro ao excluir item:", error);
            showMessage(`Erro ao excluir item: ${error.message}`, 'error');
        }
    }
}


// --- Gestão de Pessoas ---
// Handler de submit padrão para o formulário de cadastro de pessoas
const defaultPessoaSubmitHandler = async (e) => {
    e.preventDefault();
    // Removida a verificação hasPermission
    const nome = cadastroPessoasForm['pessoa-nome'].value;
    const contato = cadastroPessoasForm['pessoa-contato'].value;
    const endereco = cadastroPessoasForm['pessoa-endereco'].value;

    if (!userId) {
        showMessage("Usuário não autenticado. Por favor, faça login.", 'error');
        return;
    }

    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/peopleServed`), {
            name: nome,
            contact: contato,
            address: endereco,
            registeredBy: userName,
            registeredById: userId,
            registeredAt: new Date()
        });
        showMessage('Pessoa cadastrada com sucesso!', 'success');
        cadastroPessoasForm.reset(); // Resetar o formulário
        loadDashboardOverviewData(); // Atualiza a visão geral após o cadastro de pessoa
    } catch (error) {
        console.error("Erro ao cadastrar pessoa:", error);
        showMessage(`Erro ao cadastrar pessoa: ${error.message}`, 'error');
    }
};


// Carrega e exibe as pessoas cadastradas
async function loadPeople() {
    if (!userId) return;
    // Desinscreve o listener anterior para evitar duplicação
    if (unsubscribePeople) {
        unsubscribePeople();
    }

    unsubscribePeople = onSnapshot(collection(db, `artifacts/${appId}/public/data/peopleServed`), (snapshot) => {
        currentPeopleList.innerHTML = ''; // Limpa a lista a cada atualização
        if (snapshot.empty) {
            currentPeopleList.innerHTML = '<li class="text-gray-500 p-2">Nenhuma pessoa cadastrada ainda.</li>';
            return;
        }
        snapshot.docs.forEach(docItem => {
            const data = docItem.data();
            const li = document.createElement('li');
            li.className = 'list-item'; // Adiciona a classe list-item
            const registeredAt = data.registeredAt ? new Date(data.registeredAt.seconds * 1000).toLocaleString() : 'N/A';
            const registeredBy = data.registeredBy || 'Desconhecido';
            li.innerHTML = `
                <span><strong>Nome:</strong> ${data.name}</span>
                <span><strong>Contato:</strong> ${data.contact}</span>
                <span><strong>Endereço:</strong> ${data.address}</span>
                <span><strong>Cadastrado por:</strong> ${registeredBy} em ${registeredAt}</span>
                <button class="edit-button bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm" data-id="${docItem.id}" data-type="person">Editar</button>
                <button class="delete-button bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm" data-id="${docItem.id}" data-type="person">Excluir</button>
                <button class="view-history-button bg-blue-500 hover:bg-blue-600 text-white rounded-md shadow-sm" data-id="${docItem.id}" data-name="${data.name}">Ver Histórico</button>
            `;
            currentPeopleList.appendChild(li);
        });

        // Adiciona event listeners para os botões de editar e excluir
        document.querySelectorAll('.edit-button[data-type="person"]').forEach(button => {
            // Removida a verificação hasPermission aqui
            if (userId) {
                button.classList.remove('hidden');
                button.onclick = (e) => editPerson(e.target.dataset.id);
            } else {
                button.classList.add('hidden');
            }
        });
        document.querySelectorAll('.delete-button[data-type="person"]').forEach(button => {
            // Removida a verificação hasPermission aqui
            if (userId) {
                button.classList.remove('hidden');
                button.onclick = (e) => deletePerson(e.target.dataset.id);
            } else {
                button.classList.add('hidden');
            }
        });
        document.querySelectorAll('.view-history-button').forEach(button => {
            button.onclick = (e) => showPersonHistory(e.target.dataset.id, e.target.dataset.name);
        });
    }, (error) => {
        console.error("Erro ao carregar pessoas:", error);
        showMessage("Erro ao carregar lista de pessoas.", 'error');
    });
}

// Edita uma pessoa existente
async function editPerson(id) {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para editar pessoas.", 'error');
        return;
    }
    try {
        const personDocRef = doc(db, `artifacts/${appId}/public/data/peopleServed`, id);
        const personDoc = await getDoc(personDocRef);
        if (personDoc.exists()) {
            const data = personDoc.data();
            // Preenche o formulário de cadastro de pessoas com os dados para edição
            cadastroPessoasForm['pessoa-nome'].value = data.name;
            cadastroPessoasForm['pessoa-contato'].value = data.contact;
            cadastroPessoasForm['pessoa-endereco'].value = data.address;

            // Altera o botão de submit para "Atualizar"
            const submitButton = cadastroPessoasForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Atualizar Pessoa';
            submitButton.classList.remove('bg-teal-600', 'hover:bg-teal-700');
            submitButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700');

            // Remove o listener de submit existente para evitar duplicação
            cadastroPessoasForm.removeEventListener('submit', defaultPessoaSubmitHandler);
            if (cadastroPessoasForm._currentSubmitHandler) {
                cadastroPessoasForm.removeEventListener('submit', cadastroPessoasForm._currentSubmitHandler);
            }

            // Adiciona um novo listener para a atualização
            const newSubmitHandler = async (e) => {
                e.preventDefault();
                // Removida a verificação hasPermission
                const updatedNome = cadastroPessoasForm['pessoa-nome'].value;
                const updatedContato = cadastroPessoasForm['pessoa-contato'].value;
                const updatedEndereco = cadastroPessoasForm['pessoa-endereco'].value;

                await updateDoc(personDocRef, {
                    name: updatedNome,
                    contact: updatedContato,
                    address: updatedEndereco,
                    lastUpdated: new Date(),
                    lastUpdatedBy: userName, // Quem atualizou
                    lastUpdatedById: userId // ID de quem atualizou
                });
                showMessage('Pessoa atualizada com sucesso!', 'success');
                cadastroPessoasForm.reset();
                // Restaura o botão de submit
                submitButton.textContent = 'Cadastrar Pessoa';
                submitButton.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                submitButton.classList.add('bg-teal-600', 'hover:bg-teal-700');
                // Remove o listener de atualização e anexa o original novamente
                cadastroPessoasForm.removeEventListener('submit', newSubmitHandler);
                cadastroPessoasForm.addEventListener('submit', defaultPessoaSubmitHandler); // Anexa o handler padrão
                loadPeople(); // Recarrega a lista
                loadDashboardOverviewData(); // Atualiza a visão geral após a edição
                cadastroPessoasForm._currentSubmitHandler = null; // Limpa o handler temporário
            };

            // Armazena o handler atual para poder removê-lo
            cadastroPessoasForm._currentSubmitHandler = newSubmitHandler;
            cadastroPessoasForm.addEventListener('submit', newSubmitHandler);

            showDashboardContent(cadastroPessoasSection); // Garante que a seção de cadastro de pessoas esteja visível
        }
    } catch (error) {
        console.error("Erro ao editar pessoa:", error);
        showMessage(`Erro ao editar pessoa: ${error.message}`, 'error');
    }
}


// Exclui uma pessoa
async function deletePerson(id) {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para excluir pessoas.", 'error');
        return;
    }
    // Usando um modal customizado em vez de confirm()
    if (await showCustomConfirm('Tem certeza que deseja excluir esta pessoa?')) {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/peopleServed`, id));
            showMessage('Pessoa excluída com sucesso!', 'success');
            loadDashboardOverviewData(); // Atualiza a visão geral após a exclusão
            // loadPeople() será chamado pelo onSnapshot listener
        } catch (error) {
            console.error("Erro ao excluir pessoa:", error);
            showMessage(`Erro ao excluir pessoa: ${error.message}`, 'error');
        }
    }
}


// --- Gestão de Voluntários ---

// Handler de submit para o formulário de cadastro de voluntários
// Este handler é o padrão e será anexado apenas uma vez.
const defaultVoluntarioSubmitHandler = async (e) => {
    e.preventDefault();
    // Removida a verificação hasPermission
    const nome = cadastroVoluntariosForm['voluntario-nome'].value;
    const contato = cadastroVoluntariosForm['voluntario-contato'].value;
    const disponibilidade = cadastroVoluntariosForm['voluntario-disponibilidade'].value;

    if (!userId) {
        showMessage("Usuário não autenticado. Por favor, faça login.", 'error');
        return;
    }

    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/volunteers`), {
            name: nome,
            contact: contato,
            availability: disponibilidade,
            registeredBy: userName,
            registeredById: userId,
            registeredAt: new Date()
        });
        showMessage('Voluntário cadastrado com sucesso!', 'success');
        cadastroVoluntariosForm.reset();
        // loadVolunteers() será chamado pelo onSnapshot listener
    } catch (error) {
        console.error("Erro ao cadastrar voluntário:", error);
        showMessage(`Erro ao cadastrar voluntário: ${error.message}`, 'error');
    }
};


// Carrega e exibe os voluntários cadastrados
async function loadVolunteers() {
    if (!userId) return;
    // Desinscreve o listener anterior para evitar duplicação
    if (unsubscribeVolunteers) {
        unsubscribeVolunteers();
    }

    unsubscribeVolunteers = onSnapshot(collection(db, `artifacts/${appId}/public/data/volunteers`), (snapshot) => {
        currentVolunteersList.innerHTML = ''; // Limpa a lista a cada atualização
        if (snapshot.empty) {
            currentVolunteersList.innerHTML = '<li class="text-gray-500 p-2">Nenhum voluntário cadastrado ainda.</li>';
            return;
        }
        snapshot.docs.forEach(docItem => {
            const data = docItem.data();
            const li = document.createElement('li');
            li.className = 'list-item'; // Adiciona a classe list-item
            const registeredAt = data.registeredAt ? new Date(data.registeredAt.seconds * 1000).toLocaleString() : 'N/A';
            const registeredBy = data.registeredBy || 'Desconhecido';
            li.innerHTML = `
                <span><strong>Nome:</strong> ${data.name}</span>
                <span><strong>Contato:</strong> ${data.contact}</span>
                <span><strong>Disponibilidade:</strong> ${data.availability || 'N/A'}</span>
                <span><strong>Cadastrado por:</strong> ${registeredBy} em ${registeredAt}</span>
                <button class="edit-button bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm" data-id="${docItem.id}" data-type="volunteer">Editar</button>
                <button class="delete-button bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm" data-id="${docItem.id}" data-type="volunteer">Excluir</button>
            `;
            currentVolunteersList.appendChild(li);
        });

        // Adiciona event listeners para os botões de editar e excluir
        document.querySelectorAll('.edit-button[data-type="volunteer"]').forEach(button => {
            // Removida a verificação hasPermission aqui
            if (userId) {
                button.classList.remove('hidden');
                button.onclick = (e) => editVolunteer(e.target.dataset.id);
            } else {
                button.classList.add('hidden');
            }
        });
        document.querySelectorAll('.delete-button[data-type="volunteer"]').forEach(button => {
            // Removida a verificação hasPermission aqui
            if (userId) {
                button.classList.remove('hidden');
                button.onclick = (e) => deleteVolunteer(e.target.dataset.id);
            } else {
                button.classList.add('hidden');
            }
        });
    }, (error) => {
        console.error("Erro ao carregar voluntários:", error);
        showMessage("Erro ao carregar lista de voluntários.", 'error');
    });
}

// Edita um voluntário existente
async function editVolunteer(id) {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para editar voluntários.", 'error');
        return;
    }
    try {
        const volunteerDocRef = doc(db, `artifacts/${appId}/public/data/volunteers`, id);
        const volunteerDoc = await getDoc(volunteerDocRef);
        if (volunteerDoc.exists()) {
            const data = volunteerDoc.data();
            // Preenche o formulário de cadastro de voluntários com os dados para edição
            cadastroVoluntariosForm['voluntario-nome'].value = data.name;
            cadastroVoluntariosForm['voluntario-contato'].value = data.contact;
            cadastroVoluntariosForm['voluntario-disponibilidade'].value = data.availability || '';

            // Altera o botão de submit para "Atualizar"
            const submitButton = cadastroVoluntariosForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Atualizar Voluntário';
            submitButton.classList.remove('bg-blue-600', 'hover:bg-blue-700'); // Ou a cor original do botão de cadastro
            submitButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700');

            // Remove o listener de submit existente para evitar duplicação
            cadastroVoluntariosForm.removeEventListener('submit', defaultVoluntarioSubmitHandler);
            if (cadastroVoluntariosForm._currentSubmitHandler) {
                cadastroVoluntariosForm.removeEventListener('submit', cadastroVoluntariosForm._currentSubmitHandler);
            }

            // Adiciona um novo listener para a atualização
            const newSubmitHandler = async (e) => {
                e.preventDefault();
                // Removida a verificação hasPermission
                const updatedNome = cadastroVoluntariosForm['voluntario-nome'].value;
                const updatedContato = cadastroVoluntariosForm['voluntario-contato'].value;
                const updatedDisponibilidade = cadastroVoluntariosForm['voluntario-disponibilidade'].value;

                await updateDoc(volunteerDocRef, {
                    name: updatedNome,
                    contact: updatedContato,
                    availability: updatedDisponibilidade,
                    lastUpdated: new Date(),
                    lastUpdatedBy: userName,
                    lastUpdatedById: userId
                });
                showMessage('Voluntário atualizado com sucesso!', 'success');
                cadastroVoluntariosForm.reset();
                // Restaura o botão de submit
                submitButton.textContent = 'Cadastrar Voluntário';
                submitButton.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                submitButton.classList.add('bg-blue-600', 'hover:bg-blue-700'); // Ou a cor original do botão de cadastro
                // Remove o listener de atualização e anexa o original novamente
                cadastroVoluntariosForm.removeEventListener('submit', newSubmitHandler);
                cadastroVoluntariosForm.addEventListener('submit', defaultVoluntarioSubmitHandler); // Anexa o handler padrão
                loadVolunteers(); // Recarrega a lista
                cadastroVoluntariosForm._currentSubmitHandler = null; // Limpa o handler temporário
            };

            // Armazena o handler atual para poder removê-lo
            cadastroVoluntariosForm._currentSubmitHandler = newSubmitHandler;
            cadastroVoluntariosForm.addEventListener('submit', newSubmitHandler);

            showDashboardContent(cadastroVoluntariosSection); // Garante que a seção de cadastro de voluntários esteja visível
        }
    } catch (error) {
        console.error("Erro ao editar voluntário:", error);
        showMessage(`Erro ao editar voluntário: ${error.message}`, 'error');
    }
}

// Exclui um voluntário
async function deleteVolunteer(id) {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para excluir voluntários.", 'error');
        return;
    }
    if (await showCustomConfirm('Tem certeza que deseja excluir este voluntário?')) {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/volunteers`, id));
            showMessage('Voluntário excluído com sucesso!', 'success');
            // loadVolunteers() será chamado pelo onSnapshot listener
        } catch (error) {
            console.error("Erro ao excluir voluntário:", error);
            showMessage(`Erro ao excluir voluntário: ${error.message}`, 'error');
        }
    }
}


// --- Gestão de Saída de Itens (Múltiplos Itens) ---

// Adiciona uma nova linha de item ao formulário de saída
async function addItemRow() {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para adicionar itens de saída.", 'error');
        return;
    }
    const allItems = await getItemsData(); // Pega todos os itens disponíveis
    const newRow = document.createElement('div');
    newRow.className = 'saida-item-row flex flex-col sm:flex-row sm:items-end gap-2';
    newRow.innerHTML = `
        <div class="flex-grow">
            <label class="block text-sm font-medium text-gray-700">Item</label>
            <select class="item-select mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required>
                <option value="">Selecione um item</option>
                ${allItems.map(item => `<option value="${item.id}" data-category="${item.category}" data-type="${item.type}" data-size="${item.size}" data-gender="${item.gender}" data-quantity="${item.quantity}">${item.category}: ${item.type} (${item.size}) - Qtd: ${item.quantity}</option>`).join('')}
            </select>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700">Qtd</label>
            <input type="number" min="1" value="1" class="item-quantity mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required>
        </div>
        <button type="button" class="remove-item-row-button px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-150 ease-in-out">Remover</button>
    `;
    saidaItemsContainer.appendChild(newRow);

    // Adiciona listener para o botão de remover desta linha
    newRow.querySelector('.remove-item-row-button').addEventListener('click', () => {
        newRow.remove();
    });
}

// Função auxiliar para obter todos os itens do estoque
async function getItemsData() {
    if (!userId) return [];
    try {
        const q = query(collection(db, `artifacts/${appId}/public/data/items`), where("quantity", ">", 0));
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(docItem => ({ id: docItem.id, ...docItem.data() }));
    } catch (error) {
        console.error("Erro ao obter itens para selects:", error);
        showMessage("Erro ao carregar itens para seleção.", 'error');
        return [];
    }
}

// Submissão do formulário de saída com múltiplos itens
const defaultSaidaSubmitHandler = async (e) => { // Renomeado para consistência
    e.preventDefault();
    // Removida a verificação hasPermission
    const pessoaId = saidaPessoaSelect.value;
    const itemRows = saidaItemsContainer.querySelectorAll('.saida-item-row');
    const itemsToExit = [];

    if (!userId) {
        showMessage("Usuário não autenticado. Por favor, faça login.", 'error');
        return;
    }

    if (!pessoaId) {
        showMessage("Por favor, selecione uma pessoa atendida.", 'error');
        return;
    }

    if (itemRows.length === 0) {
        showMessage("Por favor, adicione pelo menos um item para registrar a saída.", 'error');
        return;
    }

    // Valida e coleta os itens de cada linha
    for (const row of itemRows) {
        const itemSelect = row.querySelector('.item-select');
        const itemQuantityInput = row.querySelector('.item-quantity');

        const itemId = itemSelect.value;
        const quantidadeSaida = parseInt(itemQuantityInput.value);

        if (!itemId || isNaN(quantidadeSaida) || quantidadeSaida <= 0) {
            showMessage("Por favor, preencha todos os campos de item e quantidade corretamente.", 'error');
            return;
        }

        const selectedOption = itemSelect.options[itemSelect.selectedIndex];
        const currentStock = parseInt(selectedOption.dataset.quantity);

        if (quantidadeSaida > currentStock) {
            showMessage(`Quantidade insuficiente em estoque para "${selectedOption.textContent}". Disponível: ${currentStock}`, 'error');
            return;
        }

        itemsToExit.push({
            id: itemId,
            quantity: quantidadeSaida,
            details: {
                category: selectedOption.dataset.category,
                type: selectedOption.dataset.type,
                size: selectedOption.dataset.size,
                gender: selectedOption.dataset.gender
            }
        });
    }

    try {
        const personDocRef = doc(db, `artifacts/${appId}/public/data/peopleServed`, pessoaId);
        const personDoc = await getDoc(personDocRef);
        const personData = personDoc.data();
        const itemsReceived = personData.itemsReceived || [];

        const transactionDate = new Date();
        const transactionDetails = {
            transactionId: Date.now().toString(), // ID único para a transação
            date: transactionDate, // Armazena como objeto Date, Firestore converterá para Timestamp
            exitedBy: userName, // Quem realizou a saída
            exitedById: userId, // ID de quem realizou a saída
            items: []
        };

        for (const item of itemsToExit) {
            const itemDocRef = doc(db, `artifacts/${appId}/public/data/items`, item.id);
            // Usando a função increment importada diretamente
            await updateDoc(itemDocRef, {
                quantity: increment(-item.quantity), // Agora usa 'increment' diretamente
                lastUpdated: new Date()
            });

            transactionDetails.items.push({
                itemId: item.id,
                quantity: item.quantity,
                itemDetails: item.details
            });
        }

        itemsReceived.push(transactionDetails);

        await updateDoc(personDocRef, {
            itemsReceived: itemsReceived,
            lastAttended: transactionDate
        });

        showMessage('Saída de itens registrada com sucesso!', 'success');
        saidaForm.reset(); // Resetar o formulário
        saidaItemsContainer.innerHTML = ''; // Limpa as linhas de item
        addItemRow(); // Adiciona uma nova linha vazia
        loadItems(); // Atualiza a lista de itens no dashboard de entrada
        loadDashboardOverviewData(); // Atualiza a visão geral após a saída
        lastExitTransaction = { person: personData, transaction: transactionDetails }; // Armazena para impressão
    } catch (error) {
    console.error("Erro ao registrar saída:", error);
    showMessage(`Erro ao registrar saída: ${error.message}`, 'error');
}
};


// Carrega pessoas para o select de saída
async function loadPeopleForSaida() {
    if (!userId) return;
    saidaPessoaSelect.innerHTML = '<option value="">Selecione uma pessoa</option>';
    try {
        const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/peopleServed`));
        querySnapshot.forEach((docItem) => {
            const data = docItem.data();
            const option = document.createElement('option');
            option.value = docItem.id;
            option.textContent = data.name;
            saidaPessoaSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar pessoas para saída:", error);
        showMessage("Erro ao carregar lista de pessoas para saída.", 'error');
    }
}

// --- Gestão de Agendamentos ---

// Preenche o select de voluntários no formulário de agendamento
async function loadVolunteersForAppointments() {
    if (!userId) return;
    agendamentoVoluntarioSelect.innerHTML = '<option value="">Nenhum</option>'; // Opção padrão
    try {
        const querySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/volunteers`));
        querySnapshot.forEach((docItem) => {
            const data = docItem.data();
            const option = document.createElement('option');
            option.value = docItem.id;
            option.textContent = data.name;
            agendamentoVoluntarioSelect.appendChild(option);
        });
    } catch (error) {
        console.error("Erro ao carregar voluntários para agendamentos:", error);
        showMessage("Erro ao carregar lista de voluntários para agendamentos.", 'error');
    }
}

// Adiciona uma nova linha de item ao formulário de agendamento
function addAgendamentoItemRow(initialItem = {}) {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para adicionar itens ao agendamento.", 'error');
        return;
    }
    // Remove a mensagem inicial se presente
    const initialMessage = agendamentoItemsContainer.querySelector('p.text-gray-500');
    if (initialMessage) {
        initialMessage.remove();
    }

    const newRow = document.createElement('div');
    newRow.className = 'agendamento-item-row flex flex-col sm:flex-row sm:items-end gap-2 mb-2 p-2 border rounded-md bg-white shadow-sm';
    newRow.innerHTML = `
        <div class="flex-grow">
            <label class="block text-sm font-medium text-gray-700">Categoria</label>
            <select class="item-category mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required>
                <option value="">Selecione a Categoria</option>
                <option value="roupa">Roupa</option>
                <option value="calcado">Calçado</option>
            </select>
        </div>
        <div class="flex-grow">
            <label class="block text-sm font-medium text-gray-700">Tipo</label>
            <input type="text" class="item-type mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Ex: Camiseta, Tênis" required>
        </div>
        <div class="flex-grow">
            <label class="block text-sm font-medium text-gray-700">Gênero</label>
            <select class="item-gender mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required>
                <option value="">Selecione o Gênero</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="unissex">Unissex</option>
            </select>
        </div>
        <div class="flex-grow">
            <label class="block text-sm font-medium text-gray-700">Tamanho</label>
            <input type="text" class="item-size mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Ex: M, 40" required>
        </div>
        <div>
            <label class="block text-sm font-medium text-gray-700">Qtd</label>
            <input type="number" min="1" value="1" class="item-quantity mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" required>
        </div>
        <button type="button" class="remove-agendamento-item-row-button px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 transition duration-150 ease-in-out">Remover</button>
    `;
    agendamentoItemsContainer.appendChild(newRow);

    // Preenche os campos se houver dados iniciais (para edição)
    if (initialItem.category) newRow.querySelector('.item-category').value = initialItem.category;
    if (initialItem.type) newRow.querySelector('.item-type').value = initialItem.type;
    if (initialItem.gender) newRow.querySelector('.item-gender').value = initialItem.gender;
    if (initialItem.size) newRow.querySelector('.item-size').value = initialItem.size;
    if (initialItem.quantity) newRow.querySelector('.item-quantity').value = initialItem.quantity;

    // Adiciona listener para o botão de remover desta linha
    newRow.querySelector('.remove-agendamento-item-row-button').addEventListener('click', () => {
        newRow.remove();
        // Se todas as linhas forem removidas, adiciona a mensagem inicial de volta
        if (agendamentoItemsContainer.children.length === 0) {
            agendamentoItemsContainer.innerHTML = '<p class="text-gray-500 text-center">Adicione itens para detalhar o agendamento.</p>';
        }
    });
}

// Handler de submit para o formulário de agendamento
const defaultAgendamentoSubmitHandler = async (e) => {
    e.preventDefault();
    // Removida a verificação hasPermission
    const tipo = agendamentoForm['agendamento-tipo'].value;
    const data = agendamentoForm['agendamento-data'].value;
    const hora = agendamentoForm['agendamento-hora'].value;
    const descricao = agendamentoForm['agendamento-descricao'].value;
    const voluntarioId = agendamentoForm['agendamento-voluntario'].value;
    const voluntarioNome = agendamentoForm['agendamento-voluntario'].options[agendamentoForm['agendamento-voluntario'].selectedIndex].text;

    const itemRows = agendamentoItemsContainer.querySelectorAll('.agendamento-item-row');
    const agendamentoItems = [];

    if (!userId) {
        showMessage("Usuário não autenticado. Por favor, faça login.", 'error');
        return;
    }

    // Valida e coleta os itens de cada linha do agendamento
    itemRows.forEach(row => {
        const category = row.querySelector('.item-category').value;
        const type = row.querySelector('.item-type').value;
        const gender = row.querySelector('.item-gender').value;
        const size = row.querySelector('.item-size').value;
        const quantity = parseInt(row.querySelector('.item-quantity').value);

        if (category && type && gender && size && !isNaN(quantity) && quantity > 0) {
            agendamentoItems.push({ category, type, gender, size, quantity });
        }
    });

    // Combina data e hora para um objeto Date
    const fullDateTime = new Date(`${data}T${hora}`);

    try {
        await addDoc(collection(db, `artifacts/${appId}/public/data/appointments`), {
            type: tipo,
            dateTime: fullDateTime,
            description: descricao,
            volunteerId: voluntarioId || null,
            volunteerName: voluntarioId ? voluntarioNome : null,
            items: agendamentoItems, // Salva os itens do agendamento
            status: 'agendado', // Status inicial do agendamento
            registeredBy: userName,
            registeredById: userId,
            registeredAt: new Date()
        });
        showMessage('Agendamento registrado com sucesso!', 'success');
        agendamentoForm.reset();
        agendamentoItemsContainer.innerHTML = '<p class="text-gray-500 text-center">Adicione itens para detalhar o agendamento.</p>'; // Limpa os itens
        loadDashboardOverviewData(); // Atualiza a visão geral após o agendamento
        // loadAppointments() será chamado pelo onSnapshot listener
    } catch (error) {
        console.error("Erro ao registrar agendamento:", error);
        showMessage(`Erro ao registrar agendamento: ${error.message}`, 'error');
    }
};


// Carrega e exibe os agendamentos
async function loadAppointments() {
    if (!userId) return;
    if (unsubscribeAppointments) {
        unsubscribeAppointments();
    }

    unsubscribeAppointments = onSnapshot(collection(db, `artifacts/${appId}/public/data/appointments`), (snapshot) => {
        currentAgendamentosList.innerHTML = '';
        if (snapshot.empty) {
            currentAgendamentosList.innerHTML = '<li class="text-gray-500 p-2">Nenhum agendamento registrado ainda.</li>';
            return;
        }

        const appointments = [];
        snapshot.docs.forEach(docItem => {
            appointments.push({ id: docItem.id, ...docItem.data() });
        });

        // Ordena os agendamentos por data e hora (mais próximos primeiro)
        appointments.sort((a, b) => {
            const dateA = a.dateTime && a.dateTime.seconds ? a.dateTime.seconds : 0;
            const dateB = b.dateTime && b.dateTime.seconds ? b.dateTime.seconds : 0;
            return dateA - dateB;
        });

        appointments.forEach(data => {
            const li = document.createElement('li');
            li.className = 'list-item flex-col items-start'; // Ajusta para exibir itens em coluna
            const appointmentDateTime = data.dateTime && data.dateTime.seconds ? new Date(data.dateTime.seconds * 1000).toLocaleString() : 'N/A';
            const registeredBy = data.registeredBy || 'Desconhecido';
            const volunteerInfo = data.volunteerName ? `<strong>Voluntário:</strong> ${data.volunteerName}` : 'N/A';

            let itemsHtml = '';
            if (data.items && data.items.length > 0) {
                itemsHtml = '<div class="w-full mt-2"><h5 class="font-semibold text-gray-700">Itens Agendados:</h5><ul class="list-disc list-inside text-gray-600 text-sm">';
                data.items.forEach(item => {
                    itemsHtml += `<li>${item.category}: ${item.type} (${item.size}, ${item.gender}) - Qtd: ${item.quantity}</li>`;
                });
                itemsHtml += '</ul></div>';
            } else {
                itemsHtml = '<span class="text-gray-500 text-sm mt-2">Nenhum item detalhado.</span>';
            }

            // Define a cor do status
            let statusColorClass = '';
            if (data.status === 'concluido') {
                statusColorClass = 'text-green-600 font-bold';
            } else if (data.status === 'pendente') {
                statusColorClass = 'text-yellow-600 font-bold';
            } else { // agendado
                statusColorClass = 'text-blue-600 font-bold';
            }

            li.innerHTML = `
                <div class="w-full flex flex-wrap justify-between items-center gap-2 mb-2">
                    <span><strong>Tipo:</strong> ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}</span>
                    <span><strong>Data/Hora:</strong> ${appointmentDateTime}</span>
                    <span><strong>Status:</strong> <span class="${statusColorClass}">${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span></span>
                    <span>${volunteerInfo}</span>
                    <span><strong>Registrado por:</strong> ${registeredBy}</span>
                </div>
                <span class="w-full text-sm text-gray-700"><strong>Descrição:</strong> ${data.description || 'N/A'}</span>
                ${itemsHtml}
                <div class="w-full flex justify-end flex-wrap gap-2 mt-3">
                    <button class="edit-button bg-yellow-500 hover:bg-yellow-600 text-white rounded-md shadow-sm" data-id="${data.id}" data-type="appointment">Editar</button>
                    <button class="delete-button bg-red-500 hover:bg-red-600 text-white rounded-md shadow-sm" data-id="${data.id}" data-type="appointment">Excluir</button>
                    <button class="status-button bg-green-500 hover:bg-green-600 text-white rounded-md shadow-sm" data-id="${data.id}" data-status="concluido">Concluir</button>
                    <button class="status-button bg-orange-500 hover:bg-orange-600 text-white rounded-md shadow-sm" data-id="${data.id}" data-status="pendente">Pendente</button>
                </div>
            `;
            currentAgendamentosList.appendChild(li);
        });

        document.querySelectorAll('.edit-button[data-type="appointment"]').forEach(button => {
            // Removida a verificação hasPermission aqui
            if (userId) {
                button.classList.remove('hidden');
                button.onclick = (e) => editAppointment(e.target.dataset.id);
            } else {
                button.classList.add('hidden');
            }
        });
        document.querySelectorAll('.delete-button[data-type="appointment"]').forEach(button => {
            // Removida a verificação hasPermission aqui
            if (userId) {
                button.classList.remove('hidden');
                button.onclick = (e) => deleteAppointment(e.target.dataset.id);
            } else {
                button.classList.add('hidden');
            }
        });
        document.querySelectorAll('.status-button').forEach(button => {
            // Removida a verificação hasPermission aqui
            if (userId) {
                button.classList.remove('hidden');
                button.onclick = (e) => updateAppointmentStatus(e.target.dataset.id, e.target.dataset.status);
            } else {
                button.classList.add('hidden');
            }
        });
    }, (error) => {
        console.error("Erro ao carregar agendamentos:", error);
        showMessage("Erro ao carregar lista de agendamentos.", 'error');
    });
}

// Edita um agendamento existente
async function editAppointment(id) {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para editar agendamentos.", 'error');
        return;
    }
    try {
        const appointmentDocRef = doc(db, `artifacts/${appId}/public/data/appointments`, id);
        const appointmentDoc = await getDoc(appointmentDocRef);
        if (appointmentDoc.exists()) {
            const data = appointmentDoc.data();
            // Preenche o formulário de agendamento com os dados para edição
            agendamentoForm['agendamento-tipo'].value = data.type;
            const dateTime = data.dateTime && data.dateTime.seconds ? new Date(data.dateTime.seconds * 1000) : new Date();
            agendamentoForm['agendamento-data'].value = dateTime.toISOString().split('T')[0]; // Formatoപ്പെടെ-MM-DD
            agendamentoForm['agendamento-hora'].value = dateTime.toTimeString().slice(0, 5); // Formato HH:MM
            agendamentoForm['agendamento-descricao'].value = data.description || '';
            // Carrega voluntários e seleciona o responsável, se houver
            await loadVolunteersForAppointments();
            if (data.volunteerId) {
                agendamentoForm['agendamento-voluntario'].value = data.volunteerId;
            } else {
                agendamentoForm['agendamento-voluntario'].value = '';
            }

            // Limpa e preenche os itens do agendamento para edição
            agendamentoItemsContainer.innerHTML = '';
            if (data.items && data.items.length > 0) {
                data.items.forEach(item => addAgendamentoItemRow(item));
            } else {
                agendamentoItemsContainer.innerHTML = '<p class="text-gray-500 text-center">Adicione itens para detalhar o agendamento.</p>';
            }


            // Altera o botão de submit para "Atualizar"
            const submitButton = agendamentoForm.querySelector('button[type="submit"]');
            submitButton.textContent = 'Atualizar Agendamento';
            submitButton.classList.remove('bg-blue-600', 'hover:bg-blue-700');
            submitButton.classList.add('bg-indigo-600', 'hover:bg-indigo-700');

            // Remove o listener de submit existente para evitar duplicação
            agendamentoForm.removeEventListener('submit', defaultAgendamentoSubmitHandler);
            if (agendamentoForm._currentSubmitHandler) {
                agendamentoForm.removeEventListener('submit', agendamentoForm._currentSubmitHandler);
            }

            // Adiciona um novo listener para a atualização
            const newSubmitHandler = async (e) => {
                e.preventDefault();
                // Removida a verificação hasPermission
                const updatedTipo = agendamentoForm['agendamento-tipo'].value;
                const updatedData = agendamentoForm['agendamento-data'].value;
                const updatedHora = agendamentoForm['agendamento-hora'].value;
                const updatedDescricao = agendamentoForm['agendamento-descricao'].value;
                const updatedVoluntarioId = agendamentoForm['agendamento-voluntario'].value;
                const updatedVoluntarioNome = agendamentoForm['agendamento-voluntario'].options[agendamentoForm['agendamento-voluntario'].selectedIndex].text;
                const updatedFullDateTime = new Date(`${updatedData}T${updatedHora}`);

                const updatedItemRows = agendamentoItemsContainer.querySelectorAll('.agendamento-item-row');
                const updatedAgendamentoItems = [];
                updatedItemRows.forEach(row => {
                    const category = row.querySelector('.item-category').value;
                    const type = row.querySelector('.item-type').value;
                    const gender = row.querySelector('.item-gender').value;
                    const size = row.querySelector('.item-size').value;
                    const quantity = parseInt(row.querySelector('.item-quantity').value);

                    if (category && type && gender && size && !isNaN(quantity) && quantity > 0) {
                        updatedAgendamentoItems.push({ category, type, gender, size, quantity });
                    }
                });

                await updateDoc(appointmentDocRef, {
                    type: updatedTipo,
                    dateTime: updatedFullDateTime,
                    description: updatedDescricao,
                    volunteerId: updatedVoluntarioId || null,
                    volunteerName: updatedVoluntarioId ? updatedVoluntarioNome : null,
                    items: updatedAgendamentoItems, // Salva os itens atualizados
                    lastUpdated: new Date(),
                    lastUpdatedBy: userName,
                    lastUpdatedById: userId
                });
                showMessage('Agendamento atualizado com sucesso!', 'success');
                agendamentoForm.reset();
                agendamentoItemsContainer.innerHTML = '<p class="text-gray-500 text-center">Adicione itens para detalhar o agendamento.</p>'; // Limpa os itens
                // Restaura o botão de submit
                submitButton.textContent = 'Registrar Agendamento';
                submitButton.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                submitButton.classList.add('bg-blue-600', 'hover:bg-blue-700');
                // Remove o listener de atualização e anexa o original novamente
                agendamentoForm.removeEventListener('submit', newSubmitHandler);
                agendamentoForm.addEventListener('submit', defaultAgendamentoSubmitHandler); // Anexa o handler padrão
                loadAppointments(); // Recarrega a lista
                loadDashboardOverviewData(); // Atualiza a visão geral após a edição
                agendamentoForm._currentSubmitHandler = null; // Limpa o handler temporário
            };

            // Armazena o handler atual para poder removê-lo
            agendamentoForm._currentSubmitHandler = newSubmitHandler;
            agendamentoForm.addEventListener('submit', newSubmitHandler);

            showDashboardContent(agendamentosSection); // Garante que a seção de agendamentos esteja visível
        }
    } catch (error) {
        console.error("Erro ao editar agendamento:", error);
        showMessage(`Erro ao editar agendamento: ${error.message}`, 'error');
    }
}

// Exclui um agendamento
async function deleteAppointment(id) {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para excluir agendamentos.", 'error');
        return;
    }
    if (await showCustomConfirm('Tem certeza que deseja excluir este agendamento?')) {
        try {
            await deleteDoc(doc(db, `artifacts/${appId}/public/data/appointments`, id));
            showMessage('Agendamento excluído com sucesso!', 'success');
            loadDashboardOverviewData(); // Atualiza a visão geral após a exclusão
            // loadAppointments() será chamado pelo onSnapshot listener
        } catch (error) {
            console.error("Erro ao excluir agendamento:", error);
            showMessage(`Erro ao excluir agendamento: ${error.message}`, 'error');
        }
    }
}

// Atualiza o status de um agendamento
async function updateAppointmentStatus(id, newStatus) {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para atualizar o status de agendamentos.", 'error');
        return;
    }
    try {
        const appointmentDocRef = doc(db, `artifacts/${appId}/public/data/appointments`, id);
        await updateDoc(appointmentDocRef, {
            status: newStatus,
            lastUpdated: new Date(),
            lastUpdatedBy: userName,
            lastUpdatedById: userId
        });
        showMessage(`Status do agendamento atualizado para "${newStatus}"!`, 'success');
        loadDashboardOverviewData(); // Atualiza a visão geral após a atualização do status
        // loadAppointments() será chamado pelo onSnapshot listener
    } catch (error) {
        console.error("Erro ao atualizar status do agendamento:", error);
        showMessage(`Erro ao atualizar status: ${error.message}`, 'error');
    }
}

// --- Notificações de Agendamentos Próximos ---
async function checkUpcomingAppointments() {
    if (!userId) return;

    const now = new Date();
    const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Próximas 24 horas

    try {
        const q = query(
            collection(db, `artifacts/${appId}/public/data/appointments`),
            where("status", "==", "agendado")
            // Não adicionamos where("dateTime", ">=", now) e where("dateTime", "<=", twentyFourHoursFromNow)
            // diretamente na query do Firestore para evitar problemas de índice.
            // Filtraremos em memória.
        );
        const querySnapshot = await getDocs(q);

        let notifications = [];

        querySnapshot.forEach(docItem => {
            const data = docItem.data();
            // Tratamento robusto para a data do agendamento
            const appointmentDateTime = data.dateTime instanceof Date ? data.dateTime : (data.dateTime && typeof data.dateTime.toDate === 'function' ? data.dateTime.toDate() : null);

            if (appointmentDateTime && appointmentDateTime > now && appointmentDateTime <= twentyFourHoursFromNow) {
                const timeDiff = appointmentDateTime.getTime() - now.getTime();
                const minutesDiff = Math.round(timeDiff / (1000 * 60));

                let notificationMessage = '';
                if (minutesDiff <= 60) {
                    notificationMessage = `Agendamento de ${data.type} em ${minutesDiff} minutos!`;
                } else {
                    notificationMessage = `Agendamento de ${data.type} em ${Math.round(minutesDiff / 60)} horas.`;
                }
                notifications.push(notificationMessage);
            }
        });

        if (notifications.length > 0) {
            // Usa a nova função de notificação persistente
            notifications.forEach(msg => showPersistentNotification(msg));
        }
    } catch (error) {
        console.error("Erro ao verificar agendamentos próximos:", error);
    }
}


// --- Histórico de Pessoa ---
async function showPersonHistory(personId, personName) {
    if (!userId) {
        showMessage("Usuário não autenticado.", 'error');
        return;
    }

    personHistoryTitle.textContent = `Histórico de Atendimento: ${personName}`;
    personHistoryContent.innerHTML = '<p class="text-gray-500">Carregando histórico...</p>';
    personHistoryModal.classList.remove('hidden');

    try {
        const personDocRef = doc(db, `artifacts/${appId}/public/data/peopleServed`, personId);
        const personDoc = await getDoc(personDocRef);

        if (personDoc.exists()) {
            const data = personDoc.data();
            const itemsReceived = data.itemsReceived || [];

            if (itemsReceived.length === 0) {
                personHistoryContent.innerHTML = '<p class="text-gray-600">Nenhum atendimento registrado para esta pessoa.</p>';
            } else {
                let historyHtml = '';
                // Ordena as transações da mais recente para a mais antiga
                itemsReceived.sort((a, b) => {
                    const dateA = a.date instanceof Date ? a.date.getTime() : (a.date && typeof a.date.toDate === 'function' ? a.date.toDate().getTime() : 0);
                    const dateB = b.date instanceof Date ? b.date.getTime() : (b.date && typeof b.date.toDate === 'function' ? b.date.toDate().getTime() : 0);
                    return dateB - dateA;
                });

                itemsReceived.forEach(transaction => {
                    // Tratamento robusto para a data da transação
                    const transactionDateObj = transaction.date instanceof Date ? transaction.date : (transaction.date && typeof transaction.date.toDate === 'function' ? transaction.date.toDate() : null);
                    const transactionDate = transactionDateObj ? transactionDateObj.toLocaleString() : 'N/A';
                    const exitedBy = transaction.exitedBy || 'Desconhecido';
                    historyHtml += `
                        <div class="border p-3 rounded-md bg-gray-50 shadow-sm mb-4">
                            <p class="font-semibold text-gray-700">Transação em: <span class="text-indigo-600">${transactionDate}</span></p>
                            <p class="text-gray-600">Realizado por: <span class="font-medium">${exitedBy}</span></p>
                            <h5 class="font-semibold text-gray-700 mt-2">Itens Retirados:</h5>
                            <ul class="list-disc list-inside text-gray-600">
                    `;
                    if (transaction.items && transaction.items.length > 0) {
                        transaction.items.forEach(item => {
                            historyHtml += `<li>${item.itemDetails.category.charAt(0).toUpperCase() + item.itemDetails.category.slice(1)}: ${item.itemDetails.type} (${item.itemDetails.size}) - Qtd: ${item.quantity}</li>`;
                        });
                    } else {
                        historyHtml += `<li>Nenhum item detalhado.</li>`;
                    }
                    historyHtml += `
                            </ul>
                        </div>
                    `;
                });
                personHistoryContent.innerHTML = historyHtml;

                // Adiciona listener para o botão de imprimir histórico específico
                printPersonHistoryButton.onclick = () => printPersonHistoryPdf(data, itemsReceived);

            }
        } else {
            personHistoryContent.innerHTML = '<p class="text-red-600">Pessoa não encontrada.</p>';
        }
    } catch (error) {
        console.error("Erro ao carregar histórico da pessoa:", error);
        personHistoryContent.innerHTML = `<p class="text-red-600">Erro ao carregar histórico: ${error.message}</p>`;
        showMessage(`Erro ao carregar histórico: ${error.message}`, 'error');
    }
}


// --- Relatórios e Gráficos ---
async function generateReports() {
    if (!userId) { // Apenas verifica se o utilizador está logado
        showMessage("Você não tem permissão para gerar relatórios.", 'error');
        return;
    }

    relatorioEstoqueList.innerHTML = '';
    relatorioAtendimentosList.innerHTML = '';

    // Destruir instâncias de gráficos anteriores para evitar duplicatas
    if (entradasChartInstance) {
        entradasChartInstance.destroy();
    }
    if (saidasChartInstance) {
        saidasChartInstance.destroy();
    }

    // Relatório de Estoque
    try {
        const itemsSnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/items`)); // Coleção agora é 'items'
        if (itemsSnapshot.empty) {
            relatorioEstoqueList.innerHTML = '<li class="text-gray-500 p-2">Nenhum item no estoque para relatório.</li>';
        } else {
            itemsSnapshot.forEach(docItem => {
                const data = docItem.data();
                const receivedDate = data.receivedDate ? new Date(data.receivedDate.seconds * 1000).toLocaleString() : 'N/A';
                const addedBy = data.addedBy || 'Desconhecido';
                relatorioEstoqueList.innerHTML += `
                    <li class="list-item">
                        <span><strong>Categoria:</strong> ${data.category}</span>
                        <span><strong>Tipo:</strong> ${data.type}</span>
                        <span><strong>Gênero:</strong> ${data.gender}</span>
                        <span><strong>Tamanho:</strong> ${data.size}</span>
                        <span><strong>Quantidade:</strong> ${data.quantity}</span>
                        <span><strong>Status:</strong> ${data.status}</span>
                        <span><strong>Entrada por:</strong> ${addedBy} em ${receivedDate}</span>
                    </li>
                `;
            });
        }
    } catch (error) {
        console.error("Erro ao gerar relatório de estoque:", error);
        showMessage("Erro ao gerar relatório de estoque.", 'error');
    }

    // Relatório de Atendimentos
    try {
        const peopleSnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/peopleServed`));
        if (peopleSnapshot.empty) {
            relatorioAtendimentosList.innerHTML = '<li class="text-gray-500 p-2">Nenhum atendimento registrado para relatório.</li>';
        } else {
            peopleSnapshot.forEach(docItem => {
                const data = docItem.data();
                let itemsHtml = '';
                if (data.itemsReceived && data.itemsReceived.length > 0) {
                    itemsHtml = '<ul>';
                    data.itemsReceived.forEach(transaction => {
                        // Tratamento robusto para a data da transação
                        const transactionDateObj = transaction.date instanceof Date ? transaction.date : (transaction.date && typeof transaction.date.toDate === 'function' ? transaction.date.toDate() : null);
                        const transactionDate = transactionDateObj ? transactionDateObj.toLocaleString() : 'N/A';
                        const exitedBy = transaction.exitedBy || 'Desconhecido';
                        itemsHtml += `<li><strong>Transação em ${transactionDate} por ${exitedBy}:</strong></li><ul>`;
                        if (transaction.items && transaction.items.length > 0) {
                            transaction.items.forEach(item => {
                                itemsHtml += `<li>- ${item.itemDetails.category}: ${item.itemDetails.type} (${item.itemDetails.size}) - Qtd: ${item.quantity}</li>`;
                            });
                        } else {
                            itemsHtml += `<li>- Nenhum item detalhado.</li>`;
                        }
                        itemsHtml += `</ul>`;
                    });
                    itemsHtml += '</ul>';
                } else {
                    itemsHtml = 'Nenhum item retirado.';
                }
                relatorioAtendimentosList.innerHTML += `
                    <li class="list-item">
                        <span><strong>Pessoa:</strong> ${data.name}</span>
                        <span><strong>Contato:</strong> ${data.contact}</span>
                        <span><strong>Atendimentos:</strong> ${itemsHtml}</span>
                    </li>
                `;
            });
        }
    } catch (error) {
        console.error("Erro ao gerar relatório de atendimentos:", error);
        showMessage("Erro ao gerar relatório de atendimentos.", 'error');
    }

    // Gerar Gráficos
    await generateCharts();
}

async function generateCharts() {
    if (!userId) { // Apenas verifica se o utilizador está logado
        // A mensagem já foi exibida em generateReports
        return;
    }

    const entradasPorCategoria = {
        'roupa': 0,
        'calcado': 0
    };
    const saidasPorCategoria = {
        'roupa': 0,
        'calcado': 0
    };

    // Coletar dados de entradas
    try {
        const itemsSnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/items`));
        itemsSnapshot.forEach(docItem => {
            const data = docItem.data();
            if (data.category && entradasPorCategoria.hasOwnProperty(data.category)) {
                entradasPorCategoria[data.category] += data.quantity;
            }
        });
    } catch (error) {
        console.error("Erro ao coletar dados para gráfico de entradas:", error);
    }

    // Coletar dados de saídas
    try {
        const peopleSnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/peopleServed`));
        peopleSnapshot.forEach(personDoc => {
            const data = personDoc.data();
            if (data.itemsReceived) {
                data.itemsReceived.forEach(transaction => { // Itera sobre as transações
                    if (transaction.items) { // Garante que transaction.items existe
                        transaction.items.forEach(item => { // Itera sobre os itens em cada transação
                            if (item.itemDetails && item.itemDetails.category && saidasPorCategoria.hasOwnProperty(item.itemDetails.category)) {
                                saidasPorCategoria[item.itemDetails.category] += item.quantity;
                            }
                        });
                    }
                });
            }
        });
    } catch (error) {
        console.error("Erro ao coletar dados para gráfico de saídas:", error);
    }

    // Verifica se há dados para o gráfico de entradas
    const totalEntradas = Object.values(entradasPorCategoria).reduce((sum, val) => sum + val, 0);
    if (totalEntradas > 0) {
        // Garante que o canvas está visível e limpo
        entradasChartContainer.innerHTML = '<h4 class="text-lg font-semibold text-gray-700 mb-2">Entradas por Categoria</h4><canvas id="entradasChart"></canvas>';
        const ctxEntradas = document.getElementById('entradasChart').getContext('2d');
        entradasChartInstance = new Chart(ctxEntradas, {
            type: 'bar',
            data: {
                labels: ['Roupas', 'Calçados'],
                datasets: [{
                    label: 'Quantidade de Entradas',
                    data: [entradasPorCategoria.roupa, entradasPorCategoria.calcado],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.6)', // Azul esverdeado para Roupas
                        'rgba(153, 102, 255, 0.6)' // Roxo para Calçados
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(153, 102, 255, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Quantidade'
                        }
                    }
                }
            }
        });
    } else {
        // Exibe mensagem se não houver dados
        entradasChartContainer.innerHTML = '<h4 class="text-lg font-semibold text-gray-700 mb-2">Entradas por Categoria</h4><p class="text-gray-500 text-center mt-4">Nenhum dado de entrada disponível para este gráfico.</p>';
    }

    // Verifica se há dados para o gráfico de saídas
    const totalSaidas = Object.values(saidasPorCategoria).reduce((sum, val) => sum + val, 0);
    if (totalSaidas > 0) {
        // Garante que o canvas está visível e limpo
        saidasChartContainer.innerHTML = '<h4 class="text-lg font-semibold text-gray-700 mb-2">Saídas por Categoria</h4><canvas id="saidasChart"></canvas>';
        const ctxSaidas = document.getElementById('saidasChart').getContext('2d');
        saidasChartInstance = new Chart(ctxSaidas, {
            type: 'pie',
            data: {
                labels: ['Roupas', 'Calçados'],
                datasets: [{
                    label: 'Quantidade de Saídas',
                    data: [saidasPorCategoria.roupa, saidasPorCategoria.calcado],
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)', // Vermelho para Roupas
                        'rgba(54, 162, 235, 0.6)' // Azul para Calçados
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
            }
        });
    } else {
        // Exibe mensagem se não houver dados
        saidasChartContainer.innerHTML = '<h4 class="text-lg font-semibold text-gray-700 mb-2">Saídas por Categoria</h4><p class="text-gray-500 text-center mt-4">Nenhum dado de saída disponível para este gráfico.</p>';
    }
}


// --- Pesquisa ---
const defaultSearchSubmitHandler = async (e) => { // Renomeado para consistência
    e.preventDefault();
    const queryText = searchForm['search-query'].value.toLowerCase().trim();
    searchResultsList.innerHTML = '';

    if (!userId) {
        showMessage("Usuário não autenticado.", 'error');
        return;
    }

    if (!queryText) {
        showMessage("Por favor, digite um termo para pesquisa.", 'info');
        return;
    }

    try {
        let resultsFound = false;

        // Pesquisar em Itens (Roupas e Calçados)
        const itemsQuerySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/items`)); // Coleção agora é 'items'
        itemsQuerySnapshot.forEach(docItem => {
            const data = docItem.data();
            const category = data.category ? data.category.toLowerCase() : '';
            const type = data.type ? data.type.toLowerCase() : '';
            const size = data.size ? data.size.toLowerCase() : '';
            const description = data.description ? data.description.toLowerCase() : '';

            if (category.includes(queryText) || type.includes(queryText) || size.includes(queryText) || description.includes(queryText)) {
                const li = document.createElement('li');
                li.className = 'list-item'; // Adiciona a classe list-item
                li.innerHTML = `<span><strong>${data.category.charAt(0).toUpperCase() + data.category.slice(1)}:</strong> ${data.type} (${data.size}, ${data.gender}) - Qtd: ${data.quantity}</span>`;
                searchResultsList.appendChild(li);
                resultsFound = true;
            }
        });

        // Pesquisar em Pessoas
        const peopleQuerySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/peopleServed`));
        peopleQuerySnapshot.forEach(docItem => {
            const data = docItem.data();
            const name = data.name ? data.name.toLowerCase() : '';
            const contact = data.contact ? data.contact.toLowerCase() : '';
            const address = data.address ? data.address.toLowerCase() : '';

            if (name.includes(queryText) || contact.includes(queryText) || address.includes(queryText)) {
                const li = document.createElement('li');
                li.className = 'list-item'; // Adiciona a classe list-item
                li.innerHTML = `<span><strong>Pessoa:</strong> ${data.name} - Contato: ${data.contact}</span>`;
                searchResultsList.appendChild(li);
                resultsFound = true;
            }
        });

        // Pesquisar em Voluntários
        const volunteersQuerySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/volunteers`));
        volunteersQuerySnapshot.forEach(docItem => {
            const data = docItem.data();
            const name = data.name ? data.name.toLowerCase() : '';
            const contact = data.contact ? data.contact.toLowerCase() : '';
            const availability = data.availability ? data.availability.toLowerCase() : '';

            if (name.includes(queryText) || contact.includes(queryText) || availability.includes(queryText)) {
                const li = document.createElement('li');
                li.className = 'list-item'; // Adiciona a classe list-item
                li.innerHTML = `<span><strong>Voluntário:</strong> ${data.name} - Contato: ${data.contact} - Disponibilidade: ${data.availability || 'N/A'}</span>`;
                searchResultsList.appendChild(li);
                resultsFound = true;
            }
        });

        // Pesquisar em Agendamentos (NOVO)
        const appointmentsQuerySnapshot = await getDocs(collection(db, `artifacts/${appId}/public/data/appointments`));
        appointmentsQuerySnapshot.forEach(docItem => {
            const data = docItem.data();
            const type = data.type ? data.type.toLowerCase() : '';
            const description = data.description ? data.description.toLowerCase() : '';
            const volunteerName = data.volunteerName ? data.volunteerName.toLowerCase() : '';
            const status = data.status ? data.status.toLowerCase() : '';
            // Tratamento robusto para a data do agendamento
            const dateTimeObj = data.dateTime instanceof Date ? data.dateTime : (data.dateTime && typeof data.dateTime.toDate === 'function' ? data.dateTime.toDate() : null);
            const dateTimeString = dateTimeObj ? dateTimeObj.toLocaleString().toLowerCase() : '';

            let itemsSearch = '';
            if (data.items && data.items.length > 0) {
                itemsSearch = data.items.map(item => `${item.category} ${item.type} ${item.size} ${item.gender}`).join(' ').toLowerCase();
            }

            if (type.includes(queryText) || description.includes(queryText) || volunteerName.includes(queryText) || dateTimeString.includes(queryText) || status.includes(queryText) || itemsSearch.includes(queryText)) {
                const li = document.createElement('li');
                li.className = 'list-item flex-col items-start'; // Ajusta para exibir itens em coluna
                let itemsHtml = '';
                if (data.items && data.items.length > 0) {
                    itemsHtml = '<div class="w-full mt-2"><h5 class="font-semibold text-gray-700">Itens Agendados:</h5><ul class="list-disc list-inside text-gray-600 text-sm">';
                    data.items.forEach(item => {
                        itemsHtml += `<li>${item.category}: ${item.type} (${item.size}, ${item.gender}) - Qtd: ${item.quantity}</li>`;
                    });
                    itemsHtml += '</ul></div>';
                } else {
                    itemsHtml = '<span class="text-gray-500 text-sm mt-2">Nenhum item detalhado.</span>';
                }

                li.innerHTML = `
                    <div class="w-full flex flex-wrap justify-between items-center gap-2 mb-2">
                        <span><strong>Agendamento:</strong> ${data.type.charAt(0).toUpperCase() + data.type.slice(1)}</span>
                        <span><strong>Data/Hora:</strong> ${dateTimeString}</span>
                        <span><strong>Status:</strong> ${data.status.charAt(0).toUpperCase() + data.status.slice(1)}</span>
                        <span><strong>Voluntário:</strong> ${data.volunteerName || 'N/A'}</span>
                    </div>
                    <span class="w-full text-sm text-gray-700"><strong>Descrição:</strong> ${data.description || 'N/A'}</span>
                    ${itemsHtml}
                `;
                searchResultsList.appendChild(li);
                resultsFound = true;
            }
        });


        if (!resultsFound) {
            searchResultsList.innerHTML = '<li class="text-gray-500 p-2">Nenhum resultado encontrado para a pesquisa.</li>';
        }
    } catch (error) {
        console.error("Erro ao realizar pesquisa:", error);
        showMessage(`Erro ao realizar pesquisa: ${error.message}`, 'error');
    }
};


// --- Modal de Confirmação Customizado (Substitui alert/confirm) ---
function showCustomConfirm(message) {
    return new Promise((resolve) => {
        // Cria o elemento do modal
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50';
        modal.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
                <p class="text-lg font-semibold text-gray-800 mb-4">${message}</p>
                <div class="flex justify-end space-x-3">
                    <button id="confirm-cancel" class="px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 transition duration-150 ease-in-out">Cancelar</button>
                    <button id="confirm-ok" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition duration-150 ease-in-out">Confirmar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Adiciona listeners para os botões
        document.getElementById('confirm-ok').addEventListener('click', () => {
            modal.remove();
            resolve(true);
        });

        document.getElementById('confirm-cancel').addEventListener('click', () => {
            modal.remove();
            resolve(false);
        });
    });
}

// --- Geração de PDF (Último Extrato de Saída) ---
async function generatePdfStatement(personData, transactionData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Título Centralizado
    doc.setFontSize(22);
    doc.setTextColor(52, 152, 219); // Azul vibrante
    doc.text("Extrato de Saída de Itens", doc.internal.pageSize.width / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0); // Preto
    doc.text("------------------------------------------------------------------------------------------------------------------------------------------", 10, 25);


    // Informações da Pessoa Atendida
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80); // Azul escuro
    doc.text("Pessoa Atendida:", 15, 40);
    doc.setFontSize(12);
    doc.setTextColor(52, 73, 94); // Cinza escuro
    doc.text(`Nome: ${personData.name}`, 20, 50);
    doc.text(`Contato: ${personData.contact}`, 20, 57);
    doc.text(`Endereço: ${personData.address}`, 20, 64);

    doc.text("------------------------------------------------------------------------------------------------------------------------------------------", 10, 70);


    // Detalhes da Transação
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80); // Azul escuro
    doc.text("Detalhes da Transação:", 15, 85);
    doc.setFontSize(12);
    doc.setTextColor(52, 73, 94); // Cinza escuro
    // Tratamento robusto para a data da transação
    const transactionDateObj = transactionData.date instanceof Date ? transactionData.date : (transactionData.date && typeof transactionData.date.toDate === 'function' ? transactionData.date.toDate() : null);
    const transactionDate = transactionDateObj ? transactionDateObj.toLocaleString() : 'N/A';
    doc.text(`Data e Hora: ${transactionDate}`, 20, 95);
    doc.text(`Realizado por: ${transactionData.exitedBy}`, 20, 102);

    doc.text("------------------------------------------------------------------------------------------------------------------------------------------", 10, 108);

    // Itens Retirados
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80); // Azul escuro
    doc.text("Itens Retirados:", 15, 120);

    let y = 130;
    doc.setFontSize(10);
    doc.setTextColor(52, 73, 94); // Cinza escuro

    if (transactionData.items && transactionData.items.length > 0) {
        transactionData.items.forEach(item => {
            doc.text(`- Categoria: ${item.itemDetails.category.charAt(0).toUpperCase() + item.itemDetails.category.slice(1)}`, 25, y);
            doc.text(`Tipo: ${item.itemDetails.type}`, 25, y + 5);
            doc.text(`Tamanho: ${item.itemDetails.size}`, 25, y + 10);
            doc.text(`Gênero: ${item.itemDetails.gender}`, 25, y + 15);
            doc.text(`Quantidade: ${item.quantity}`, 25, y + 20);
            y += 30; // Espaço para o próximo item
            if (y > doc.internal.pageSize.height - 30) { // Nova página se necessário
                doc.addPage();
                y = 20;
                doc.setFontSize(10);
                doc.setTextColor(52, 73, 94);
            }
        });
    } else {
        doc.text("Nenhum item detalhado nesta transação.", 25, y);
        y += 10;
    }


    // Rodapé
    doc.setFontSize(10);
    doc.setTextColor(127, 140, 141); // Cinza claro
    doc.text("Sistema de Gestão de Estoque de Roupas e Calçados - Doações", doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 15, { align: "center" });

    doc.save(`extrato_saida_${personData.name.replace(/\s/g, '_')}_${transactionData.transactionId}.pdf`);
}

// --- Geração de PDF (Histórico Completo da Pessoa) ---
async function printPersonHistoryPdf(personData, itemsReceivedHistory) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Título Centralizado
    doc.setFontSize(22);
    doc.setTextColor(52, 152, 219); // Azul vibrante
    doc.text(`Histórico de Atendimento: ${personData.name}`, doc.internal.pageSize.width / 2, 20, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0); // Preto
    doc.text("------------------------------------------------------------------------------------------------------------------------------------------", 10, 25);

    // Informações da Pessoa Atendida
    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80); // Azul escuro
    doc.text("Dados da Pessoa:", 15, 40);
    doc.setFontSize(12);
    doc.setTextColor(52, 73, 94); // Cinza escuro
    doc.text(`Nome: ${personData.name}`, 20, 50);
    doc.text(`Contato: ${personData.contact}`, 20, 57);
    doc.text(`Endereço: ${personData.address}`, 20, 64);

    doc.text("------------------------------------------------------------------------------------------------------------------------------------------", 10, 70);

    let y = 85; // Posição Y inicial para o histórico

    if (itemsReceivedHistory.length === 0) {
        doc.setFontSize(12);
        doc.setTextColor(52, 73, 94);
        doc.text("Nenhum atendimento registrado para esta pessoa.", doc.internal.pageSize.width / 2, y, { align: "center" });
    } else {
        itemsReceivedHistory.forEach(transaction => {
            // Tratamento robusto para a data da transação
            const transactionDateObj = transaction.date instanceof Date ? transaction.date : (transaction.date && typeof transaction.date.toDate === 'function' ? transaction.date.toDate() : null);
            const transactionDate = transactionDateObj ? transactionDateObj.toLocaleString() : 'N/A';
            const exitedBy = transaction.exitedBy || 'Desconhecido';

            // Verifica se precisa de nova página antes de adicionar a transação
            if (y + 40 > doc.internal.pageSize.height - 30) { // Estima espaço para cabeçalho da transação
                doc.addPage();
                y = 20; // Reset Y para nova página
            }

            doc.setFontSize(13);
            doc.setTextColor(44, 62, 80);
            doc.text(`Transação em: ${transactionDate} por ${exitedBy}`, 15, y);
            y += 10;
            doc.setFontSize(11);
            doc.setTextColor(52, 73, 94);
            doc.text("Itens:", 20, y);
            y += 7;

            if (transaction.items && transaction.items.length > 0) {
                transaction.items.forEach(item => {
                    // Verifica se precisa de nova página para o item
                    if (y + 10 > doc.internal.pageSize.height - 30) {
                        doc.addPage();
                        y = 20;
                        doc.setFontSize(11);
                        doc.setTextColor(52, 73, 94);
                    }
                    doc.text(`- ${item.itemDetails.category.charAt(0).toUpperCase() + item.itemDetails.category.slice(1)}: ${item.itemDetails.type} (${item.itemDetails.size}) - Qtd: ${item.quantity}`, 25, y);
                    y += 7;
                });
            } else {
                if (y + 10 > doc.internal.pageSize.height - 30) { // Check space for "No items" message
                    doc.addPage();
                    y = 20;
                    doc.setFontSize(11);
                    doc.setTextColor(52, 73, 94);
                }
                doc.text(`- Nenhum item detalhado.`, 25, y);
                y += 7;
            }
            y += 10; // Espaço entre as transações
        });
    }

    // Rodapé
    doc.setFontSize(10);
    doc.setTextColor(127, 140, 141);
    doc.text("Sistema de Gestão de Estoque de Roupas e Calçados - Doações", doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 15, { align: "center" });

    doc.save(`historico_${personData.name.replace(/\s/g, '_')}.pdf`);
}


// Listener de estado de autenticação do Firebase
onAuthStateChanged(auth, async (user) => {
    if (user) {
        userId = user.uid; // Define o userId quando o usuário está autenticado

        // A lógica de obtenção de userRole de custom claims não é mais necessária para permissões,
        // mas pode ser mantida se for usada para outros fins de exibição ou dados.
        // Por simplicidade, vamos definir userRole como 'admin' para todos os autenticados
        // para que updateUIBasedOnRole mostre tudo.
        userRole = 'admin'; // Todos os utilizadores autenticados terão acesso total

        // Tenta buscar o nome do usuário a partir do perfil (ainda útil para nome completo e outros dados do perfil)
        try {
            const userProfileDoc = await getDoc(doc(db, 'artifacts', appId, 'user_profiles', userId));
            if (userProfileDoc.exists()) {
                const profileData = userProfileDoc.data();
                userName = profileData.fullName || user.email || 'Usuário Desconhecido'; // Prioriza nome completo, senão email
            } else {
                userName = user.email || 'Usuário Desconhecido'; // Se perfil não existe, usa email
            }
        } catch (profileError) {
            console.error("Erro ao carregar perfil do usuário:", profileError);
            userName = user.email || 'Usuário Desconhecido'; // Em caso de erro, usa email
        }

        showSection(dashboardSection);
        // Carrega os dados iniciais do dashboard e atualiza a UI com base no papel
        loadInitialDashboardData();
        updateUIBasedOnRole(); // Atualiza a UI após o login
        // Inicia a verificação de agendamentos próximos a cada 30 segundos
        setInterval(checkUpcomingAppointments, 30000); // Verifica a cada 30 segundos
    } else {
        userId = null; // Limpa o userId se o usuário não estiver autenticado
        userName = 'Usuário Desconhecido'; // Reseta o nome do usuário
        userRole = 'guest'; // Define o papel como convidado
        showSection(loginSection);
        updateUIBasedOnRole(); // Atualiza a UI para o estado de convidado
    }
});

// Autenticação inicial com token personalizado
async function initialAuth() {
    try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
            // Se o token for válido, onAuthStateChanged cuidará de mostrar o dashboard e o papel
        } else {
            // Se não houver token inicial, permaneça na tela de login
            showSection(loginSection);
            updateUIBasedOnRole(); // Garante que a UI esteja correta para 'guest'
        }
    } catch (error) {
        console.error("Erro na autenticação inicial:", error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // --- Inicialização das Variáveis Globais de Elementos do DOM ---
    loginSection = document.getElementById('login-section');
    registerSection = document.getElementById('register-section');
    resetPasswordSection = document.getElementById('reset-password-section');
    dashboardSection = document.getElementById('dashboard-section');
    authWrapper = document.getElementById('auth-wrapper'); // Certifique-se de que este ID existe no HTML

    loginForm = document.getElementById('login-form');
    registerForm = document.getElementById('register-form');
    resetPasswordForm = document.getElementById('reset-password-form');
    logoutButton = document.getElementById('logout-button');

    showRegisterLink = document.getElementById('show-register');
    showResetPasswordLink = document.getElementById('show-reset-password');
    showLoginFromRegisterLink = document.getElementById('show-login-from-register');
    showLoginFromResetLink = document.getElementById('show-login-from-reset');

    navOverview = document.getElementById('nav-overview');
    navEntrada = document.getElementById('nav-entrada');
    navSaida = document.getElementById('nav-saida');
    navCadastroPessoas = document.getElementById('nav-cadastro-pessoas');
    navCadastroVoluntarios = document.getElementById('nav-cadastro-voluntarios');
    navAgendamentos = document.getElementById('nav-agendamentos');
    navRelatorios = document.getElementById('nav-relatorios');
    navPesquisa = document.getElementById('nav-pesquisa');

    dashboardOverviewSection = document.getElementById('dashboard-overview-section');
    entradaSection = document.getElementById('entrada-section');
    saidaSection = document.getElementById('saida-section');
    cadastroPessoasSection = document.getElementById('cadastro-pessoas-section');
    cadastroVoluntariosSection = document.getElementById('cadastro-voluntarios-section');
    agendamentosSection = document.getElementById('agendamentos-section');
    relatoriosSection = document.getElementById('relatorios-section');
    pesquisaSection = document.getElementById('pesquisa-section');

    entradaForm = document.getElementById('entrada-form');
    saidaForm = document.getElementById('saida-form');
    cadastroPessoasForm = document.getElementById('cadastro-pessoas-form');
    cadastroVoluntariosForm = document.getElementById('cadastro-voluntarios-form');
    agendamentoForm = document.getElementById('agendamento-form');
    searchForm = document.getElementById('search-form');

    currentStockList = document.getElementById('current-stock-list');
    currentPeopleList = document.getElementById('current-people-list');
    currentVolunteersList = document.getElementById('current-volunteers-list');
    currentAgendamentosList = document.getElementById('current-agendamentos-list');
    saidaPessoaSelect = document.getElementById('saida-pessoa');
    saidaItemsContainer = document.getElementById('saida-items-container');
    addItemRowButton = document.getElementById('add-item-row');
    printLastReceiptButton = document.getElementById('print-last-receipt-button');

    relatorioEstoqueList = document.getElementById('relatorio-estoque-list');
    relatorioAtendimentosList = document.getElementById('relatorio-atendimentos-list');
    searchResultsList = document.getElementById('search-results-list');

    personHistoryModal = document.getElementById('person-history-modal');
    closePersonHistoryModalButton = document.getElementById('close-person-history-modal');
    personHistoryTitle = document.getElementById('person-history-title');
    personHistoryContent = document.getElementById('person-history-content');
    printPersonHistoryButton = document.getElementById('print-person-history');

    entradasChartContainer = document.getElementById('entradasChartContainer');
    saidasChartContainer = document.getElementById('saidasChartContainer');

    agendamentoVoluntarioSelect = document.getElementById('agendamento-voluntario');
    agendamentoItemsContainer = document.getElementById('agendamento-items-container');
    addAgendamentoItemRowButton = document.getElementById('add-agendamento-item-row');

    overviewTotalItems = document.getElementById('overview-total-items');
    overviewTotalPeople = document.getElementById('overview-total-people');
    overviewUpcomingAppointments = document.getElementById('overview-upcoming-appointments');
    overviewLatestEntries = document.getElementById('overview-latest-entries');
    overviewLatestExits = document.getElementById('overview-latest-exits');

    // Inicialização das novas variáveis para o modal de notificação persistente
    notificationModal = document.getElementById('notification-modal');
    closeNotificationModalButton = document.getElementById('close-notification-modal');
    notificationMessageContent = document.getElementById('notification-message-content');
    notificationOkButton = document.getElementById('notification-ok-button'); // Inicializa o botão "Entendi"

    // --- Fim da Inicialização das Variáveis Globais de Elementos do DOM ---


    initialAuth(); // Chama a autenticação inicial agora que o DOM está carregado

    // --- Funções de Autenticação ---

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm['login-email'].value;
        const password = loginForm['login-password'].value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            showMessage('Login realizado com sucesso!', 'success');
            loginForm.reset();
        } catch (error) {
            console.error("Erro de login:", error);
            showMessage(`Erro de login: ${error.message}`, 'error');
        }
    });

    // Cadastro de Usuário
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = registerForm['register-full-name'].value;
        const email = registerForm['register-email'].value;
        const password = registerForm['register-password'].value;
        const contactNumber = registerForm['register-contact-number'].value;
        const cep = registerForm['register-cep'].value;
        const city = registerForm['register-city'].value;
        const street = registerForm['register-street'].value;
        const neighborhood = registerForm['register-neighborhood'].value;
        const role = registerForm['register-role'].value; // Obtém o papel selecionado

        // Validação básica de senha no cliente
        if (password.length < 6) {
            showMessage('A senha deve ter no mínimo 6 caracteres.', 'error');
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Salva informações adicionais do usuário no Firestore, incluindo o papel
            // O papel ainda é salvo no Firestore para fins de registo, mas não será usado para permissões no cliente
            await setDoc(doc(db, 'artifacts', appId, 'user_profiles', user.uid), {
                fullName,
                email,
                contactNumber,
                cep,
                city,
                street,
                neighborhood,
                role, // Salva o papel
                createdAt: new Date()
            });

            showMessage('Cadastro realizado com sucesso!', 'success');
            registerForm.reset();
            showSection(loginSection); // Volta para a tela de login após o cadastro
        } catch (error) {
            console.error("Erro de cadastro:", error);
            let userFriendlyMessage = 'Erro ao cadastrar. Por favor, tente novamente.';
            if (error.code === 'auth/email-already-in-use') {
                userFriendlyMessage = 'Este e-mail já está em uso. Por favor, faça login ou use outro e-mail.';
            } else if (error.code === 'auth/weak-password') {
                userFriendlyMessage = 'A senha é muito fraca. Por favor, use uma senha com no mínimo 6 caracteres.';
            }
            showMessage(`Erro de cadastro: ${userFriendlyMessage}`, 'error');
        }
    });

    // Recuperação de Senha
    resetPasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = resetPasswordForm['reset-email'].value;

        try {
            await sendPasswordResetEmail(auth, email);
            showMessage('Link de recuperação de senha enviado para o seu email!', 'info');
            resetPasswordForm.reset();
            showSection(loginSection); // Volta para a tela de login
        }
        catch (error) {
            console.error("Erro ao enviar link de recuperação:", error);
            showMessage(`Erro ao recuperar senha: ${error.message}`, 'error');
        }
    });

    // Logout
    logoutButton.addEventListener('click', async () => {
        try {
            await signOut(auth);
            showMessage('Você foi desconectado.', 'info');
        } catch (error) {
            console.error("Erro ao fazer logout:", error);
            showMessage(`Erro ao fazer logout: ${error.message}`, 'error');
        }
    });

    // --- Navegação entre seções de autenticação ---
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(registerSection);
    });

    showResetPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(resetPasswordSection);
    });

    showLoginFromRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(loginSection);
    });

    showLoginFromResetLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(loginSection);
    });

    // --- Navegação do Dashboard ---
    navOverview.addEventListener('click', () => {
        showDashboardContent(dashboardOverviewSection);
    });
    navEntrada.addEventListener('click', () => {
        showDashboardContent(entradaSection);
        loadItems(); // Recarrega a lista de itens (roupas e calçados)
    });
    navSaida.addEventListener('click', () => {
        showDashboardContent(saidaSection);
        loadPeopleForSaida(); // Carrega pessoas para o select
        saidaItemsContainer.innerHTML = ''; // Limpa os itens de saída anteriores
        addItemRow(); // Adiciona a primeira linha de item
    });
    navCadastroPessoas.addEventListener('click', () => {
        showDashboardContent(cadastroPessoasSection);
        loadPeople(); // Recarrega a lista de pessoas
    });
    // Event listener para a nova navegação de voluntários
    navCadastroVoluntarios.addEventListener('click', () => {
        showDashboardContent(cadastroVoluntariosSection);
        loadVolunteers(); // Carrega a lista de voluntários
    });
    navAgendamentos.addEventListener('click', () => {
        showDashboardContent(agendamentosSection);
        loadVolunteersForAppointments(); // Carrega voluntários para o select de agendamentos
        agendamentoItemsContainer.innerHTML = '<p class="text-gray-500 text-center">Adicione itens para detalhar o agendamento.</p>'; // Limpa os itens do agendamento
        loadAppointments(); // Carrega a lista de agendamentos
    });
    navRelatorios.addEventListener('click', () => {
        showDashboardContent(relatoriosSection);
        generateReports(); // Gera os relatórios e gráficos
    });
    navPesquisa.addEventListener('click', () => {
        showDashboardContent(pesquisaSection);
    });

    // Anexa os handlers de submit aos formulários
    entradaForm.addEventListener('submit', defaultEntradaSubmitHandler);
    cadastroPessoasForm.addEventListener('submit', defaultPessoaSubmitHandler);
    cadastroVoluntariosForm.addEventListener('submit', defaultVoluntarioSubmitHandler);
    saidaForm.addEventListener('submit', defaultSaidaSubmitHandler);
    agendamentoForm.addEventListener('submit', defaultAgendamentoSubmitHandler);
    searchForm.addEventListener('submit', defaultSearchSubmitHandler);

    // Anexa listener para o botão de adicionar linha de item na saída
    addItemRowButton.addEventListener('click', addItemRow);
    // Anexa listener para o botão de adicionar linha de item no agendamento
    addAgendamentoItemRowButton.addEventListener('click', addAgendamentoItemRow);
    // Anexa listener para o botão de imprimir último recibo
    printLastReceiptButton.addEventListener('click', () => {
        if (lastExitTransaction) {
            generatePdfStatement(lastExitTransaction.person, lastExitTransaction.transaction);
        } else {
            showMessage('Nenhuma transação de saída recente para imprimir.', 'info');
        }
    });

    // Anexa listener para fechar o modal de histórico
    closePersonHistoryModalButton.addEventListener('click', () => {
        personHistoryModal.classList.add('hidden');
    });

    // Anexa listener para fechar o modal de notificação persistente (botão 'X')
    if (closeNotificationModalButton) {
        closeNotificationModalButton.addEventListener('click', () => {
            if (notificationModal) {
                notificationModal.classList.add('hidden');
            }
        });
    }

    // NOVO: Anexa listener para o botão "Entendi" do modal de notificação
    if (notificationOkButton) {
        notificationOkButton.addEventListener('click', () => {
            if (notificationModal) {
                notificationModal.classList.add('hidden');
            }
        });
    }

}); // Fim de DOMContentLoaded
