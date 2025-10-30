// =================================================================
// TWSTxGoods - Stock Manager Script with FIREBASE
// =================================================================

// ======================= 1. Firebase Configuration =======================
// PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyCNIo57_LoA3uosJ5i991jwrHSaw-lewOc",
  authDomain: "twstxgoods-44ee1.firebaseapp.com",
  projectId: "twstxgoods-44ee1",
  storageBucket: "twstxgoods-44ee1.firebasestorage.app",
  messagingSenderId: "100980544241",
  appId: "1:100980544241:web:0ae6f5d6f625fc7ce8cf50",
  measurementId: "G-3FF2MK7QF5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const productsRef = database.ref('products');

// =================== 2. Constants and Global Variables ===================
const THEME_KEY = 'twstgoods_theme';
let products = [];
let isEditMode = false;
let sortDirection = 'asc';
let sortableInstance = null;
let isImageMarkedForRemoval = false;

// =================== 3. Initial Load & Event Listeners ===================
document.addEventListener('DOMContentLoaded', () => {
    // DOM element references
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const addButton = document.getElementById('addButton');
    const editModeBtn = document.getElementById('editModeBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const searchInput = document.getElementById('searchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    const sortBtn = document.getElementById('sortBtn');
    const productForm = document.getElementById('productForm');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const removeImageBtn = document.getElementById('removeImageBtn');

    // Initial setup
    loadTheme();
    listenForData();
    
    // Event Listeners Setup
    themeToggleBtn.addEventListener('click', handleThemeToggle);
    addButton.addEventListener('click', () => openModal('productModal'));
    editModeBtn.addEventListener('click', toggleEditMode);
    deleteSelectedBtn.addEventListener('click', showDeleteConfirmation);
    sortBtn.addEventListener('click', handleSort);
    searchInput.addEventListener('keyup', displayProducts);
    categoryFilter.addEventListener('change', displayProducts);
    productForm.addEventListener('submit', handleFormSubmit);
    document.querySelector('#productModal .close-button').addEventListener('click', () => closeModal('productModal'));
    window.addEventListener('click', (event) => { if (event.target.classList.contains('modal')) closeModal(event.target.id); });
    confirmCancelBtn.addEventListener('click', () => closeModal('confirmModal'));
    removeImageBtn.addEventListener('click', handleRemoveImage);
});

// ========================= 4. Theme Management =========================
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    document.body.className = '';
    document.body.classList.add(`${savedTheme}-mode`);
    document.getElementById('themeToggleBtn').innerHTML = savedTheme === 'light' ? `<i class="fas fa-moon"></i>` : `<i class="fas fa-sun"></i>`;
}

function handleThemeToggle() {
    const isLight = document.body.classList.toggle('light-mode');
    document.body.classList.toggle('dark-mode', !isLight);
    const newTheme = isLight ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, newTheme);
    loadTheme();
}

// =================== 5. Firebase Data & State Management ===================
function saveData() {
    productsRef.set(products);
}

function listenForData() {
    productsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        products = data ? data : [];
        displayProducts();
        populateCategoryFilter();
    });
}

function toggleEditMode() {
    isEditMode = !isEditMode;
    document.body.classList.toggle('edit-mode', isEditMode);
    document.getElementById('deleteSelectedBtn').classList.toggle('hidden', !isEditMode);
    document.getElementById('editModeBtn').innerHTML = isEditMode ? '<i class="fas fa-check"></i>' : '<i class="fas fa-pencil-alt"></i>';
    
    if (isEditMode && !sortableInstance) {
        sortableInstance = new Sortable(document.getElementById('inventoryBody'), { animation: 150, ghostClass: 'sortable-ghost', onEnd: updateOrder });
    } else if (!isEditMode && sortableInstance) {
        sortableInstance.destroy();
        sortableInstance = null;
    }
    displayProducts();
}

function updateOrder(evt) {
    const [movedItem] = products.splice(evt.oldIndex, 1);
    products.splice(evt.newIndex, 0, movedItem);
    saveData();
}

// =================== 6. Display & UI Rendering ===================
function handleSort() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    products.sort((a, b) => {
        return sortDirection === 'asc' ? a.name.localeCompare(b.name, 'th') : b.name.localeCompare(a.name, 'th');
    });
    document.getElementById('sortBtn').innerHTML = sortDirection === 'asc' ? '<i class="fas fa-sort-alpha-down"></i>' : '<i class="fas fa-sort-alpha-up"></i>';
    saveData();
}

function displayProducts() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const selectedCategory = document.getElementById('categoryFilter').value;
    const filteredProducts = products.filter(product => {
        const nameMatch = product.name.toLowerCase().includes(searchText);
        const categoryMatch = product.category ? product.category.toLowerCase().includes(searchText) : false;
        const textMatch = nameMatch || categoryMatch;
        const categoryFilterMatch = selectedCategory === 'all' || product.category === selectedCategory;
        return textMatch && categoryFilterMatch;
    });
    renderTable(filteredProducts);
}

function renderTable(productList) {
    const tableBody = document.getElementById('inventoryBody');
    tableBody.innerHTML = '';

    if (productList.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;">ไม่พบสินค้า</td></tr>`;
        return;
    }

    productList.forEach(product => {
        const originalIndex = products.findIndex(p => p === product);
        const row = document.createElement('tr');
        const imageHtml = product.image ? `<img src="${product.image}" alt="${product.name}" onclick="openImageModal('${product.image}')">` : '';
        
        row.innerHTML = `
            <td class="checkbox-col" data-label="เลือก"><input type="checkbox" data-index="${originalIndex}"></td>
            <td data-label="รูปสินค้า">${imageHtml}</td>
            <td data-label="ชื่อสินค้า">${product.name}</td>
            <td data-label="ประเภท">${product.category || ''}</td>
            <td data-label="จำนวน">${product.quantity || ''}</td>
            <td data-label="ราคา">${product.price || ''}</td>
            <td class="action-col" data-label="แก้ไข"><button class="header-btn edit-btn" onclick="openModal('productModal', ${originalIndex})"><i class="fas fa-edit"></i></button></td>
        `;
        tableBody.appendChild(row);
    });
}

function populateCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))];
    const currentValue = categoryFilter.value;

    categoryFilter.innerHTML = '<option value="all">ทุกประเภท</option>';
    categories.forEach(cat => {
        categoryFilter.innerHTML += `<option value="${cat}">${cat}</option>`;
    });
    categoryFilter.value = currentValue;
}

// =================== 7. Modal & Form Handling ===================
let currentEditIndex = null;

function openModal(modalId, index = null) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    if (modalId === 'productModal') {
        const form = document.getElementById('productForm');
        const removeImageContainer = document.getElementById('removeImageContainer');
        const removeImageBtn = document.getElementById('removeImageBtn');

        // Reset state from previous use
        form.reset();
        isImageMarkedForRemoval = false;
        removeImageBtn.disabled = false;
        removeImageBtn.textContent = 'ลบรูปภาพปัจจุบัน';
        document.getElementById('imageUrl').disabled = false;
        document.getElementById('imageFile').disabled = false;
        currentEditIndex = index;

        if (index !== null) { // Edit Mode
            document.getElementById('modalTitle').textContent = 'แก้ไขรายการสินค้า';
            const product = products[index];
            document.getElementById('productName').value = product.name;
            document.getElementById('category').value = product.category || '';
            document.getElementById('quantity').value = product.quantity || '';
            document.getElementById('price').value = product.price || '';
            removeImageContainer.classList.toggle('hidden', !product.image);
        } else { // Add Mode
            document.getElementById('modalTitle').textContent = 'เพิ่มรายการสินค้า';
            removeImageContainer.classList.add('hidden');
        }
    }
    modal.classList.add('is-open');
}

function openImageModal(imageUrl) {
    if (!imageUrl) return;
    document.getElementById('modalImage').src = imageUrl;
    openModal('imageModal');
}

function closeModal(modalId = null) {
    if (modalId) {
        document.getElementById(modalId).classList.remove('is-open');
    } else {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('is-open'));
    }
}

function handleRemoveImage() {
    isImageMarkedForRemoval = true;
    const removeImageBtn = document.getElementById('removeImageBtn');
    removeImageBtn.textContent = 'รูปภาพจะถูกลบเมื่อบันทึก';
    removeImageBtn.disabled = true;

    // Also disable image inputs
    document.getElementById('imageUrl').value = '';
    document.getElementById('imageUrl').disabled = true;
    document.getElementById('imageFile').value = '';
    document.getElementById('imageFile').disabled = true;
}

async function handleFormSubmit(e) {
    e.preventDefault();
    let finalImageUrl;
    const file = document.getElementById('imageFile').files[0];
    const urlValue = document.getElementById('imageUrl').value.trim();

    if (isImageMarkedForRemoval) {
        finalImageUrl = '';
    } else if (file) {
        finalImageUrl = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    } else if (urlValue) {
        finalImageUrl = urlValue;
    } else if (currentEditIndex !== null) {
        finalImageUrl = products[currentEditIndex].image;
    } else {
        finalImageUrl = '';
    }

    const productData = {
        image: finalImageUrl,
        name: document.getElementById('productName').value,
        category: document.getElementById('category').value,
        quantity: document.getElementById('quantity').value,
        price: document.getElementById('price').value
    };

    if (currentEditIndex !== null) {
        products[currentEditIndex] = productData;
    } else {
        products.push(productData);
    }

    saveData();
    closeModal('productModal');
}

function showDeleteConfirmation() {
    const selectedCheckboxes = document.querySelectorAll('#inventoryBody input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
        alert('กรุณาเลือกสินค้าที่ต้องการลบ');
        return;
    }
    
    const confirmMsg = document.getElementById('confirmMessage');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    
    confirmMsg.textContent = `คุณแน่ใจหรือไม่ว่าต้องการลบสินค้าที่เลือก ${selectedCheckboxes.length} รายการ?`;
    openModal('confirmModal');

    confirmDeleteBtn.onclick = () => {
        // Get indices and sort them in descending order to prevent shifting issues
        const indicesToDelete = Array.from(selectedCheckboxes).map(cb => parseInt(cb.dataset.index)).sort((a, b) => b - a);
        
        indicesToDelete.forEach(index => {
            products.splice(index, 1);
        });

        saveData();
        closeModal('confirmModal');
        toggleEditMode();
    };
}