// --- Global Variables & State ---
const THEME_KEY = 'twstgoods_theme';
let products = [];
let isEditMode = false;
let sortDirection = 'asc';
let currentEditId = null;
let isImageMarkedForRemoval = false;
let currentUser = null;
let unsubscribeProducts = null;

// --- Main Application Start ---
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    setupEventListeners();
    monitorAuthState();
});

function setupEventListeners() {
    const authIconBtn = document.getElementById('authIconBtn');
    const authDropdown = document.getElementById('authDropdown');
    const mobileAuthBtn = document.getElementById('mobileAuthBtn');
    
    // Auth Icon (Desktop)
    authIconBtn.addEventListener('click', () => {
        if (currentUser) {
            authDropdown.classList.toggle('hidden');
        } else {
            openModal('loginModal');
        }
    });

    // Mobile Auth Button (ย่อจอ)
    mobileAuthBtn.addEventListener('click', () => {
        if (currentUser) {
            if(confirm("คุณต้องการออกจากระบบหรือไม่?")) {
                logout();
            }
        } else {
            openModal('loginModal');
        }
    });

    document.getElementById('googleLoginBtn').addEventListener('click', loginWithGoogle);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    
    document.addEventListener('click', (e) => {
        if (!document.getElementById('floatingAuth').contains(e.target)) {
            authDropdown.classList.add('hidden');
        }
    });

    document.getElementById('themeToggleBtn').addEventListener('click', handleThemeToggle);
    document.getElementById('addButton').addEventListener('click', () => openModal('productModal'));
    document.getElementById('editModeBtn').addEventListener('click', toggleEditMode);
    document.getElementById('deleteSelectedBtn').addEventListener('click', showDeleteConfirmation);
    document.getElementById('sortBtn').addEventListener('click', handleSort);
    document.getElementById('searchInput').addEventListener('keyup', displayProducts);
    document.getElementById('categoryFilter').addEventListener('change', displayProducts);
    document.getElementById('productForm').addEventListener('submit', handleFormSubmit);
    document.getElementById('removeImageBtn').addEventListener('click', handleRemoveImage);

    document.querySelectorAll('.close-button').forEach(btn => {
        btn.addEventListener('click', function() {
            closeModal(this.closest('.modal').id);
        });
    });
    document.getElementById('confirmCancelBtn').addEventListener('click', () => closeModal('confirmModal'));
    
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) closeModal(event.target.id);
    });
}

// --- Authentication ---
function monitorAuthState() {
    auth.onAuthStateChanged(user => {
        const authIconDefault = document.getElementById('authIconDefault');
        const authIconImage = document.getElementById('authIconImage');
        const userNameDisplay = document.getElementById('userNameDisplay');
        const authRequiredElements = document.querySelectorAll('.auth-required');
        const mobileAuthBtn = document.getElementById('mobileAuthBtn');

        if (user) {
            currentUser = user;
            if (user.photoURL) {
                authIconImage.src = user.photoURL;
                authIconImage.classList.remove('hidden');
                authIconDefault.classList.add('hidden');
            }
            userNameDisplay.textContent = user.displayName || user.email;
            
            // เปลี่ยนไอคอนมือถือเป็น "ออกจากระบบ"
            mobileAuthBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
            mobileAuthBtn.classList.add('logout-state');

            closeModal('loginModal');
            
            authRequiredElements.forEach(el => {
                if (el.id !== 'deleteSelectedBtn' || isEditMode) {
                    el.classList.remove('hidden');
                }
            });
            listenForDataChanges();
        } else {
            currentUser = null;
            products = [];
            authIconDefault.classList.remove('hidden');
            authIconImage.classList.add('hidden');
            document.getElementById('authDropdown').classList.add('hidden');
            
            // เปลี่ยนไอคอนมือถือเป็นรูป "คน" ตามที่ต้องการ
            mobileAuthBtn.innerHTML = '<i class="fas fa-user"></i>';
            mobileAuthBtn.classList.remove('logout-state');
            
            authRequiredElements.forEach(el => el.classList.add('hidden'));
            if (isEditMode) toggleEditMode();
            
            if (unsubscribeProducts) {
                unsubscribeProducts();
                unsubscribeProducts = null;
            }
            renderTable([]);
        }
    });
}

function loginWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(error => {
        console.error("Login failed:", error);
        alert("เกิดข้อผิดพลาดในการเข้าสู่ระบบ");
    });
}

function logout() {
    auth.signOut().then(() => {
        document.getElementById('authDropdown').classList.add('hidden');
    }).catch(error => console.error("Logout failed:", error));
}

// --- Theme Management ---
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

// --- Image Compression to Base64 ---
function compressImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600;
                const MAX_HEIGHT = 600;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                resolve(dataUrl);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

// --- Firestore Data Handling ---
function listenForDataChanges() {
    if (!currentUser) return;
    
    const collectionRef = db.collection('users').doc(currentUser.uid).collection('products');
    
    unsubscribeProducts = collectionRef.onSnapshot((snapshot) => {
        products = [];
        snapshot.forEach((doc) => {
            products.push({ id: doc.id, ...doc.data() });
        });
        displayProducts();
        populateCategoryFilter();
    }, (error) => {
        console.error("Firestore read failed:", error);
    });
}

async function handleFormSubmit(e) {
    e.preventDefault();
    if (!currentUser) return;

    const saveBtn = document.getElementById('saveProductBtn');
    const uploadProgress = document.getElementById('uploadProgress');
    saveBtn.disabled = true;
    saveBtn.textContent = 'กำลังบันทึก...';

    let finalImageUrl = '';
    const file = document.getElementById('imageFile').files[0];
    const urlValue = document.getElementById('imageUrl').value.trim();
    const productToEdit = currentEditId ? products.find(p => p.id === currentEditId) : null;

    try {
        if (isImageMarkedForRemoval) {
            finalImageUrl = '';
        } else if (file) {
            uploadProgress.classList.remove('hidden');
            finalImageUrl = await compressImageToBase64(file);
            uploadProgress.classList.add('hidden');
        } else if (urlValue) {
            finalImageUrl = urlValue;
        } else if (productToEdit) {
            finalImageUrl = productToEdit.image || '';
        }

        const productData = {
            image: finalImageUrl,
            name: document.getElementById('productName').value,
            category: document.getElementById('category').value,
            quantity: document.getElementById('quantity').value,
            price: document.getElementById('price').value,
            note: document.getElementById('note').value 
        };

        const collectionRef = db.collection('users').doc(currentUser.uid).collection('products');

        if (currentEditId) {
            await collectionRef.doc(currentEditId).update(productData);
        } else {
            await collectionRef.add(productData);
        }
        closeModal('productModal');
    } catch (error) {
        console.error("Error saving product:", error);
        alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'บันทึก';
        uploadProgress.classList.add('hidden');
    }
}

function showDeleteConfirmation() {
    const selectedCheckboxes = document.querySelectorAll('#inventoryBody input[type="checkbox"]:checked');
    if (selectedCheckboxes.length === 0) {
        alert('กรุณาเลือกรายการที่ต้องการลบ');
        return;
    }

    const confirmMessage = document.getElementById('confirmMessage');
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    confirmMessage.textContent = `คุณแน่ใจหรือไม่ว่าต้องการลบรายการที่เลือก ${selectedCheckboxes.length} รายการ?`;
    openModal('confirmModal');

    confirmDeleteBtn.onclick = async () => {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.textContent = 'กำลังลบ...';

        const idsToDelete = Array.from(selectedCheckboxes).map(cb => cb.dataset.id);
        
        try {
            const batch = db.batch();
            const collectionRef = db.collection('users').doc(currentUser.uid).collection('products');
            
            idsToDelete.forEach(id => {
                const docRef = collectionRef.doc(id);
                batch.delete(docRef);
            });
            await batch.commit();
            
            closeModal('confirmModal');
            if (isEditMode) toggleEditMode();
        } catch (error) {
            console.error("เกิดข้อผิดพลาดในการลบ: ", error);
            alert("ลบข้อมูลไม่สำเร็จ");
        } finally {
            confirmDeleteBtn.disabled = false;
            confirmDeleteBtn.textContent = 'ยืนยัน';
        }
    };
}

// --- UI & Display ---
function toggleEditMode() {
    isEditMode = !isEditMode;
    document.body.classList.toggle('edit-mode', isEditMode);
    document.getElementById('deleteSelectedBtn').classList.toggle('hidden', !isEditMode);
    document.getElementById('editModeBtn').innerHTML = isEditMode ? '<i class="fas fa-check"></i>' : '<i class="fas fa-pencil-alt"></i>';
    displayProducts();
}

function handleSort() {
    sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    document.getElementById('sortBtn').innerHTML = sortDirection === 'asc' ? '<i class="fas fa-sort-alpha-down"></i>' : '<i class="fas fa-sort-alpha-up"></i>';
    displayProducts();
}

function displayProducts() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    const selectedCategory = document.getElementById('categoryFilter').value;

    let filteredProducts = products.filter(product =>
        (product.name.toLowerCase().includes(searchText) || (product.category && product.category.toLowerCase().includes(searchText))) &&
        (selectedCategory === 'all' || product.category === selectedCategory)
    );
    
    filteredProducts.sort((a, b) => {
        return sortDirection === 'asc' ? a.name.localeCompare(b.name, 'th') : b.name.localeCompare(a.name, 'th');
    });

    renderTable(filteredProducts);
}

function renderTable(productList) {
    const tableBody = document.getElementById('inventoryBody');
    tableBody.innerHTML = '';

    if (!currentUser) {
        tableBody.innerHTML = `<tr class="empty-row"><td colspan="8">กรุณาล็อกอินเพื่อดูข้อมูลสินค้า</td></tr>`;
        return;
    }

    if (productList.length === 0) {
        tableBody.innerHTML = `<tr class="empty-row"><td colspan="8">ไม่พบรายการ</td></tr>`;
        return;
    }

    productList.forEach(product => {
        const row = document.createElement('tr');
        const imageHtml = product.image ? `<img src="${product.image}" alt="${product.name}" onclick="openImageModal('${product.image}')">` : '';

        // จัดการรูปแบบราคา ใส่ลูกน้ำคั่น
        let displayPrice = product.price || '';
        if (displayPrice !== '' && !isNaN(displayPrice)) {
            displayPrice = Number(displayPrice).toLocaleString('th-TH');
        }

        row.innerHTML = `
            <td class="checkbox-col auth-required" data-label="เลือก"><input type="checkbox" data-id="${product.id}"></td>
            <td data-label="รูปสินค้า">${imageHtml}</td>
            <td data-label="รายการ" class="product-name-col">${product.name}</td>
            <td data-label="ประเภท">${product.category || ''}</td>
            <td data-label="จำนวน">${product.quantity || ''}</td>
            <td data-label="ราคา">${displayPrice}</td>
            <td data-label="หมายเหตุ">${product.note || ''}</td>
            <td class="action-col auth-required" data-label="แก้ไข"><button class="header-btn edit-btn" onclick="openModal('productModal', '${product.id}')"><i class="fas fa-edit"></i></button></td>
        `;
        tableBody.appendChild(row);
    });
}

function populateCategoryFilter() {
    const categoryFilter = document.getElementById('categoryFilter');
    const currentValue = categoryFilter.value;
    const categories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();

    categoryFilter.innerHTML = '<option value="all">ทุกประเภท</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        categoryFilter.appendChild(option);
    });
    categoryFilter.value = currentValue;
}

// --- Modal Handling ---
function openModal(modalId, id = null) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (modalId === 'productModal') {
        const form = document.getElementById('productForm');
        form.reset();
        
        const removeImageContainer = document.getElementById('removeImageContainer');
        const removeImageBtn = document.getElementById('removeImageBtn');

        isImageMarkedForRemoval = false;
        removeImageBtn.disabled = false;
        removeImageBtn.textContent = 'ลบรูปภาพปัจจุบัน';
        document.getElementById('imageUrl').disabled = false;
        document.getElementById('imageFile').disabled = false;

        currentEditId = id;

        if (id) {
            document.getElementById('modalTitle').textContent = 'แก้ไขรายการ';
            const product = products.find(p => p.id === id);
            if (product) {
                document.getElementById('productName').value = product.name;
                document.getElementById('category').value = product.category || '';
                document.getElementById('quantity').value = product.quantity || '';
                document.getElementById('price').value = product.price || '';
                document.getElementById('note').value = product.note || ''; 
                
                if(product.image && product.image.startsWith('http')) {
                    document.getElementById('imageUrl').value = product.image;
                } else if(product.image && product.image.startsWith('data:image')) {
                    document.getElementById('imageUrl').placeholder = "รูปภาพถูกบันทึกในระบบแล้ว";
                }
                removeImageContainer.classList.toggle('hidden', !product.image);
            }
        } else {
            document.getElementById('modalTitle').textContent = 'เพิ่มรายการ';
            removeImageContainer.classList.add('hidden');
            document.getElementById('imageUrl').placeholder = "https://example.com/image.jpg";
        }
    }
    modal.classList.add('is-open');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('is-open');
}

function openImageModal(imageUrl) {
    if (!imageUrl) return;
    document.getElementById('modalImage').src = imageUrl;
    openModal('imageModal');
}

function handleRemoveImage() {
    isImageMarkedForRemoval = true;
    const removeImageBtn = document.getElementById('removeImageBtn');
    removeImageBtn.textContent = 'รูปภาพจะถูกลบเมื่อบันทึก';
    removeImageBtn.disabled = true;

    document.getElementById('imageUrl').value = '';
    document.getElementById('imageUrl').disabled = true;
    document.getElementById('imageFile').value = '';
    document.getElementById('imageFile').disabled = true;
}