// Product CSV Generator Application
class ProductCSVGenerator {
    constructor() {
        this.products = [];
        this.imageCounter = 0;
        this.uploadedImages = [];
        this.currentEditingId = null;
        this.cloudName = 'dz1y0qpji';
        this.unsignedPreset = 'product_csv_unsigned';
        this.defaultTags = [
            '新作', '人気', 'セール', '限定', 'プレゼント',
            'メンズ', 'レディース', 'キッズ',
            '春', '夏', '秋', '冬',
            'カジュアル', 'フォーマル', 'スポーツ', 'アウトドア',
            'オフィス', 'リラックス', 'デイリー', 'パーティー',
            '送料無料', '即納', '予約販売'
        ];
        this.customTags = [];
        this.tempSelectedTags = new Set();
        this.cloudinaryHistory = JSON.parse(localStorage.getItem('cloudinaryHistory') || '[]');
        
        this.csvHeaders = [
            'Title','URL handle','Description','Vendor','Product category','Type','Tags',
            'Published on online store','Status','SKU','Barcode',
            'Option1 name','Option1 value','Option1 Linked To',
            'Option2 name','Option2 value','Option2 Linked To',
            'Option3 name','Option3 value','Option3 Linked To',
            'Price','Compare-at price','Cost per item','Charge tax','Tax code',
            'Unit price total measure','Unit price total measure unit',
            'Unit price base measure','Unit price base measure unit',
            'Inventory tracker','Inventory quantity','Continue selling when out of stock',
            'Weight value (grams)','Weight unit for display','Requires shipping',
            'Fulfillment service','Product image URL','Image position','Image alt text',
            'Variant image URL','Gift card','SEO title','SEO description',
            'Color (product.metafields.shopify.color-pattern)',
            'Google Shopping / Google product category','Google Shopping / Gender',
            'Google Shopping / Age group','Google Shopping / Manufacturer part number (MPN)',
            'Google Shopping / Ad group name','Google Shopping / Ads labels',
            'Google Shopping / Condition','Google Shopping / Custom product',
            'Google Shopping / Custom label 0','Google Shopping / Custom label 1',
            'Google Shopping / Custom label 2','Google Shopping / Custom label 3',
            'Google Shopping / Custom label 4',
            'Brand Code','SKU Category','SKU Serial','Season','Brand Name'
        ];
        
        this.skuMaps = { category: {}, color: {}, size: {} };
        this.dataBrands = {};
        this.dataTags = [];
        this.loadData();
    }

    async loadData() {
        try {
            const [cat, col, sz, br, tg] = await Promise.all([
                fetch('data/categories.json').then(r => r.json()).catch(() => ({})),
                fetch('data/colors.json').then(r => r.json()).catch(() => ({})),
                fetch('data/sizes.json').then(r => r.json()).catch(() => ({})),
                fetch('data/brands.json').then(r => r.json()).catch(() => ({})),
                fetch('data/tags.json').then(r => r.json()).catch(() => ({ tags: [] }))
            ]);
            this.skuMaps.category = cat;
            this.skuMaps.color = col;
            this.skuMaps.size = sz;
            this.dataBrands = br;
            this.dataTags = tg.tags || [];
        } catch (e) {
            console.warn('Data files not loaded:', e);
        }
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderProductsList();
    }

    bindEvents() {
        document.getElementById('exportCsv').addEventListener('click', () => this.exportCSV());
        document.getElementById('loadTemplate').addEventListener('click', () => document.getElementById('templateFile').click());
        document.getElementById('templateFile').addEventListener('change', (e) => this.loadTemplate(e.target.files[0]));
        
        document.querySelector('.close-btn').addEventListener('click', () => this.closeModal());
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal());
        
        document.getElementById('productModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('productModal')) this.closeModal();
        });

        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        document.getElementById('cloudinaryUploadBtn').addEventListener('click', () => document.getElementById('cloudinaryInput').click());
        document.getElementById('cloudinaryInput').addEventListener('change', (e) => this.handleCloudinaryUpload(e.target.files));
        document.getElementById('openCloudinaryHistory').addEventListener('click', () => this.openCloudinaryHistoryPicker());
        document.getElementById('closeCloudinaryHistory').addEventListener('click', () => this.closeCloudinaryHistoryPicker());
        document.getElementById('cancelCloudinaryHistory').addEventListener('click', () => this.closeCloudinaryHistoryPicker());
        document.getElementById('applyCloudinaryHistory').addEventListener('click', () => this.applyCloudinaryHistorySelection());
        document.getElementById('cloudinaryHistoryModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('cloudinaryHistoryModal')) this.closeCloudinaryHistoryPicker();
        });

        document.getElementById('title').addEventListener('input', (e) => {
            const handle = document.getElementById('handle');
            if (!handle.value || handle.dataset.autoGenerated) {
                handle.value = this.generateHandle(e.target.value);
                handle.dataset.autoGenerated = 'true';
            }
        });
        document.getElementById('handle').addEventListener('input', (e) => { if (e.target.value) delete e.target.dataset.autoGenerated; });

        document.getElementById('toggleSkuMaps').addEventListener('click', () => {
            const panel = document.getElementById('skuMapsPanel');
            panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            if (panel.style.display === 'block') this.renderSkuMaps();
        });

        document.getElementById('manageData').addEventListener('click', () => this.openDataManage());
        document.getElementById('closeDataManage').addEventListener('click', () => this.closeDataManage());
        document.getElementById('cancelDataManage').addEventListener('click', () => this.closeDataManage());
        document.getElementById('dataManageModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('dataManageModal')) this.closeDataManage();
        });
        document.querySelectorAll('.data-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchDataTab(tab.dataset.tab));
        });
        document.getElementById('addBrandBtn').addEventListener('click', () => this.addDataItem('brands'));
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.addDataItem('categories'));
        document.getElementById('addColorBtn').addEventListener('click', () => this.addDataItem('colors'));
        document.getElementById('addSizeBtn').addEventListener('click', () => this.addDataItem('sizes'));
        document.getElementById('addTagBtn').addEventListener('click', () => this.addDataItem('tags'));
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportDataJson());

        document.getElementById('openTagPicker').addEventListener('click', () => this.openTagPicker());
        document.getElementById('closeTagPicker').addEventListener('click', () => this.closeTagPicker());
        document.getElementById('cancelTagPicker').addEventListener('click', () => this.closeTagPicker());
        document.getElementById('applyTagsBtn').addEventListener('click', () => this.applyTags());
        document.getElementById('addNewTagBtn').addEventListener('click', () => this.addNewTag());
        document.getElementById('newTagInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.addNewTag(); }
        });
        document.getElementById('tagPickerModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('tagPickerModal')) this.closeTagPicker();
        });

        ['brandCode','skuCategory','skuSerial','productType','option1Values','option2Values','option3Values'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateSkuPreview());
        });
        document.getElementById('year').addEventListener('change', () => this.updateSeason());
        document.getElementById('seasonType').addEventListener('change', () => this.updateSeason());
        ['option1Name','option2Name','option3Name'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('change', () => this.updateSkuPreview());
        });
        ['option1Values','option2Values','option3Values','option1Name','option2Name','option3Name'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.renderVariantInventory());
        });
    }

    generateHandle(title) {
        if (!title) return '';
        if (/[^\x00-\x7F]/.test(title)) return '';
        return title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
    }

    async handleCloudinaryUpload(files) {
        const btn = document.getElementById('cloudinaryUploadBtn');
        const originalText = btn.textContent;
        btn.textContent = 'アップロード中...';
        btn.disabled = true;
        for (const file of Array.from(files)) {
            if (!file.type.startsWith('image/')) continue;
            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('upload_preset', this.unsignedPreset);
                const res = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/image/upload`, { method: 'POST', body: formData });
                const data = await res.json();
                if (data.secure_url) {
                    this.uploadedImages.push({ id: `img_${Date.now()}_${this.imageCounter++}`, name: file.name, data: data.secure_url });
                    this.addCloudinaryHistory(data.secure_url, file.name);
                } else {
                    console.error('Cloudinary upload error:', data);
                    alert(`画像アップロードに失敗しました: ${data.error?.message || '不明なエラー'}`);
                }
            } catch (err) {
                console.error(err);
                alert('画像のアップロード中にネットワークエラーが発生しました');
            }
        }
        btn.textContent = originalText;
        btn.disabled = false;
        document.getElementById('cloudinaryInput').value = '';
        this.renderUploadedImages();
    }

    addCloudinaryHistory(url, name) {
        const exists = this.cloudinaryHistory.find(h => h.url === url);
        if (!exists) {
            this.cloudinaryHistory.unshift({ url, name, date: new Date().toISOString() });
            this.cloudinaryHistory = this.cloudinaryHistory.slice(0, 50);
            localStorage.setItem('cloudinaryHistory', JSON.stringify(this.cloudinaryHistory));
        }
    }

    openCloudinaryHistoryPicker() {
        const container = document.getElementById('cloudinaryHistoryList');
        if (!container) return;
        if (this.cloudinaryHistory.length === 0) {
            container.innerHTML = '<p class="cloudinary-history-empty">アップロード履歴がありません</p>';
            return;
        }
        container.innerHTML = this.cloudinaryHistory.map((item, idx) => `
            <label class="cloudinary-history-item">
                <input type="checkbox" value="${this.escapeHtml(item.url)}" data-name="${this.escapeHtml(item.name)}">
                <img src="${this.escapeHtml(item.url)}" alt="${this.escapeHtml(item.name)}">
                <span class="cloudinary-history-name">${this.escapeHtml(item.name)}</span>
            </label>
        `).join('');
        document.getElementById('cloudinaryHistoryModal').classList.add('active');
    }

    applyCloudinaryHistorySelection() {
        const container = document.getElementById('cloudinaryHistoryList');
        const checked = container.querySelectorAll('input[type="checkbox"]:checked');
        checked.forEach(cb => {
            const url = cb.value;
            const name = cb.dataset.name;
            this.uploadedImages.push({ id: `img_${Date.now()}_${this.imageCounter++}`, name, data: url });
        });
        this.renderUploadedImages();
        this.closeCloudinaryHistoryPicker();
    }

    closeCloudinaryHistoryPicker() {
        document.getElementById('cloudinaryHistoryModal').classList.remove('active');
    }

    renderUploadedImages() {
        const container = document.getElementById('uploadedImages');
        container.innerHTML = this.uploadedImages.map((img, idx) => `
            <div class="image-item">
                <img src="${img.data}" alt="${img.name}">
                <span class="image-name">${img.name}</span>
                <button type="button" class="remove-image" data-index="${idx}">&times;</button>
            </div>
        `).join('');
        container.querySelectorAll('.remove-image').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.uploadedImages.splice(parseInt(e.target.dataset.index), 1);
                this.renderUploadedImages();
            });
        });
    }

    openModal(productId = null) {
        this.currentEditingId = productId;
        this.uploadedImages = [];
        this.currentEditingVariantInventory = null;
        if (productId) {
            const product = this.products.find(p => p.id === productId);
            if (product) {
                this.currentEditingVariantInventory = product.variantInventory || null;
                this.fillForm(product);
                this.renderVariantInventory();
            }
        } else {
            this.clearForm();
            this.renderVariantInventory();
        }
        document.getElementById('productModal').classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    closeModal() {
        document.getElementById('productModal').classList.remove('active');
        document.body.style.overflow = '';
        this.currentEditingId = null;
        this.uploadedImages = [];
        this.currentEditingVariantInventory = null;
        this.renderUploadedImages();
    }

    openDataManage() {
        document.getElementById('dataManageModal').classList.add('active');
        this.renderDataLists();
    }

    closeDataManage() {
        document.getElementById('dataManageModal').classList.remove('active');
    }

    switchDataTab(tab) {
        document.querySelectorAll('.data-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
        document.querySelectorAll('.data-tab-content').forEach(c => c.classList.toggle('active', c.id === 'tab-' + tab));
    }

    renderDataLists() {
        // Brands
        const brandsList = document.getElementById('brandsList');
        const brandsEntries = Object.entries(this.dataBrands).sort((a, b) => a[0].localeCompare(b[0]));
        brandsList.innerHTML = brandsEntries.length ? brandsEntries.map(([name, info]) => `
            <div class="data-list-item">
                <div class="data-list-item-info">
                    <span class="data-list-item-name">${this.escapeHtml(name)}</span>
                    <span class="data-list-item-code">${this.escapeHtml(info.code || '')}</span>
                </div>
                <button class="data-list-item-remove" onclick="app.removeDataItem('brands','${this.escapeHtml(name).replace(/'/g, "\\'")}")">&times;</button>
            </div>
        `).join('') : '<div class="data-list-item"><span style="color:var(--color-text-muted)">データがありません</span></div>';

        // Categories
        const catList = document.getElementById('categoriesList');
        const catEntries = Object.entries(this.skuMaps.category).sort((a, b) => a[0].localeCompare(b[0]));
        catList.innerHTML = catEntries.length ? catEntries.map(([name, code]) => `
            <div class="data-list-item">
                <div class="data-list-item-info">
                    <span class="data-list-item-name">${this.escapeHtml(name)}</span>
                    <span class="data-list-item-code">${this.escapeHtml(code)}</span>
                </div>
                <button class="data-list-item-remove" onclick="app.removeDataItem('categories','${this.escapeHtml(name).replace(/'/g, "\\'")}")">&times;</button>
            </div>
        `).join('') : '<div class="data-list-item"><span style="color:var(--color-text-muted)">データがありません</span></div>';

        // Colors
        const colList = document.getElementById('colorsList');
        const colEntries = Object.entries(this.skuMaps.color).sort((a, b) => a[0].localeCompare(b[0]));
        colList.innerHTML = colEntries.length ? colEntries.map(([name, code]) => `
            <div class="data-list-item">
                <div class="data-list-item-info">
                    <span class="data-list-item-name">${this.escapeHtml(name)}</span>
                    <span class="data-list-item-code">${this.escapeHtml(code)}</span>
                </div>
                <button class="data-list-item-remove" onclick="app.removeDataItem('colors','${this.escapeHtml(name).replace(/'/g, "\\'")}")">&times;</button>
            </div>
        `).join('') : '<div class="data-list-item"><span style="color:var(--color-text-muted)">データがありません</span></div>';

        // Sizes
        const szList = document.getElementById('sizesList');
        const szEntries = Object.entries(this.skuMaps.size).sort((a, b) => a[0].localeCompare(b[0]));
        szList.innerHTML = szEntries.length ? szEntries.map(([name, code]) => `
            <div class="data-list-item">
                <div class="data-list-item-info">
                    <span class="data-list-item-name">${this.escapeHtml(name)}</span>
                    <span class="data-list-item-code">${this.escapeHtml(code)}</span>
                </div>
                <button class="data-list-item-remove" onclick="app.removeDataItem('sizes','${this.escapeHtml(name).replace(/'/g, "\\'")}")">&times;</button>
            </div>
        `).join('') : '<div class="data-list-item"><span style="color:var(--color-text-muted)">データがありません</span></div>';

        // Tags
        const tagsList = document.getElementById('tagsList');
        const sortedTags = [...this.dataTags].sort((a, b) => a.localeCompare(b));
        tagsList.innerHTML = sortedTags.length ? sortedTags.map((tag, i) => `
            <div class="data-list-item">
                <div class="data-list-item-info">
                    <span class="data-list-item-name">${this.escapeHtml(tag)}</span>
                </div>
                <button class="data-list-item-remove" onclick="app.removeDataItem('tags',${i})">&times;</button>
            </div>
        `).join('') : '<div class="data-list-item"><span style="color:var(--color-text-muted)">データがありません</span></div>';
    }

    addDataItem(type) {
        if (type === 'brands') {
            const name = document.getElementById('newBrandName').value.trim();
            const code = document.getElementById('newBrandCode').value.trim().toUpperCase();
            if (!name || !code) return;
            this.dataBrands[name] = { code };
            document.getElementById('newBrandName').value = '';
            document.getElementById('newBrandCode').value = '';
        } else if (type === 'categories') {
            const name = document.getElementById('newCategoryName').value.trim();
            const code = document.getElementById('newCategoryCode').value.trim().toUpperCase();
            if (!name || !code) return;
            this.skuMaps.category[name] = code;
            document.getElementById('newCategoryName').value = '';
            document.getElementById('newCategoryCode').value = '';
        } else if (type === 'colors') {
            const name = document.getElementById('newColorName').value.trim();
            const code = document.getElementById('newColorCode').value.trim().toUpperCase();
            if (!name || !code) return;
            this.skuMaps.color[name] = code;
            document.getElementById('newColorName').value = '';
            document.getElementById('newColorCode').value = '';
        } else if (type === 'sizes') {
            const name = document.getElementById('newSizeName').value.trim();
            const code = document.getElementById('newSizeCode').value.trim().toUpperCase();
            if (!name || !code) return;
            this.skuMaps.size[name] = code;
            document.getElementById('newSizeName').value = '';
            document.getElementById('newSizeCode').value = '';
        } else if (type === 'tags') {
            const name = document.getElementById('newTagName').value.trim();
            if (!name || this.dataTags.includes(name)) return;
            this.dataTags.push(name);
            this.customTags.push(name);
            document.getElementById('newTagName').value = '';
        }
        this.renderDataLists();
    }

    removeDataItem(type, key) {
        if (type === 'brands') {
            delete this.dataBrands[key];
        } else if (type === 'categories') {
            delete this.skuMaps.category[key];
        } else if (type === 'colors') {
            delete this.skuMaps.color[key];
        } else if (type === 'sizes') {
            delete this.skuMaps.size[key];
        } else if (type === 'tags') {
            const idx = parseInt(key);
            if (!isNaN(idx)) this.dataTags.splice(idx, 1);
        }
        this.renderDataLists();
    }

    exportDataJson() {
        const data = {
            brands: this.dataBrands,
            categories: this.skuMaps.category,
            colors: this.skuMaps.color,
            sizes: this.skuMaps.size,
            tags: this.dataTags
        };
        const content = JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `data_export_${new Date().toISOString().slice(0,10)}.json`;
        link.click();
        alert('JSONファイルをダウンロードしました。data/フォルダ内のJSONファイルを更新してください。');
    }

    clearForm() {
        document.getElementById('productForm').reset();
        document.getElementById('productId').value = '';
        document.getElementById('vendor').value = 'Your Brand';
        document.getElementById('status').value = 'active';
        document.getElementById('published').value = 'true';
        document.getElementById('chargeTax').value = 'true';
        document.getElementById('requiresShipping').value = 'true';
        document.getElementById('inventoryPolicy').value = 'deny';
        document.getElementById('fulfillmentService').value = 'manual';
        document.getElementById('giftCard').value = 'false';
        document.getElementById('brandName').value = '';
        document.getElementById('brandCode').value = '';
        document.getElementById('season').value = '';
        document.getElementById('skuCategory').value = '';
        document.getElementById('variantInventorySection').style.display = 'none';
        document.getElementById('variantInventoryContainer').innerHTML = '';
        const simpleGroup = document.getElementById('simpleInventoryGroup');
        if (simpleGroup) simpleGroup.style.display = 'block';
        const preview = document.getElementById('skuPreview');
        if (preview) preview.textContent = '-';
    }

    fillForm(product) {
        document.getElementById('productId').value = product.id;
        document.getElementById('title').value = product.title || '';
        document.getElementById('handle').value = product.handle || '';
        document.getElementById('description').value = product.description || '';
        document.getElementById('vendor').value = product.vendor || 'Your Brand';
        document.getElementById('productType').value = product.productType || '';
        document.getElementById('shopifyCategory').value = product.shopifyCategory || product.productCategory || '';
        document.getElementById('googleShoppingCategory').value = product.googleShoppingCategory || '';
        document.getElementById('tags').value = product.tags || '';
        document.getElementById('status').value = product.status || 'active';
        document.getElementById('published').value = product.published ? 'true' : 'false';
        document.getElementById('price').value = product.price || '';
        document.getElementById('compareAtPrice').value = product.compareAtPrice || '';
        document.getElementById('costPerItem').value = product.costPerItem || '';
        document.getElementById('inventoryQty').value = product.inventoryQty || 0;
        document.getElementById('inventoryPolicy').value = product.inventoryPolicy || 'deny';
        document.getElementById('chargeTax').value = product.chargeTax ? 'true' : 'false';
        document.getElementById('requiresShipping').value = product.requiresShipping ? 'true' : 'false';
        document.getElementById('weight').value = product.weight || 0;
        document.getElementById('fulfillmentService').value = product.fulfillmentService || 'manual';
        document.getElementById('sku').value = product.sku || '';
        document.getElementById('barcode').value = product.barcode || '';
        document.getElementById('seoTitle').value = product.seoTitle || '';
        document.getElementById('seoDescription').value = product.seoDescription || '';
        document.getElementById('giftCard').value = product.giftCard ? 'true' : 'false';
        document.getElementById('option1Name').value = product.option1Name || '';
        document.getElementById('option1Values').value = product.option1Values || '';
        document.getElementById('option2Name').value = product.option2Name || '';
        document.getElementById('option2Values').value = product.option2Values || '';
        document.getElementById('option3Name').value = product.option3Name || '';
        document.getElementById('option3Values').value = product.option3Values || '';
        document.getElementById('brandName').value = product.brandName || '';
        document.getElementById('brandCode').value = product.brandCode || '';
        if (product.season && product.season.length >= 2) {
            const yy = product.season.substring(0, 2);
            const type = product.season.substring(2).toUpperCase();
            document.getElementById('year').value = `20${yy}`;
            document.getElementById('seasonType').value = type === 'S' ? 'SS' : (type === 'A' ? 'AW' : '');
            document.getElementById('season').value = product.season;
        } else {
            document.getElementById('year').value = '';
            document.getElementById('seasonType').value = '';
            document.getElementById('season').value = '';
        }
        document.getElementById('skuCategory').value = product.skuCategory || '';
        document.getElementById('skuSerial').value = product.skuSerial || '';
        if (product.images) {
            this.uploadedImages = [...product.images];
            this.renderUploadedImages();
        }
        this.currentEditingVariantInventory = product.variantInventory || null;
        this.updateSkuPreview();
        this.renderVariantInventory();
    }

    saveProduct() {
        const year = document.getElementById('year').value;
        const seasonType = document.getElementById('seasonType').value;
        const season = year && seasonType ? `${String(year).substring(2)}${seasonType === 'SS' ? 'S' : 'A'}` : '';
        document.getElementById('season').value = season;
        const brand = (document.getElementById('brandCode').value || '').toUpperCase();
        const catCode = this.getCategoryCode(document.getElementById('skuCategory').value || document.getElementById('productType').value);
        const serial = (document.getElementById('skuSerial').value || '').trim();
        const baseParts = [brand, season, catCode].filter(p => p);
        if (serial) baseParts.push(serial);
        const baseSku = baseParts.join('-').toLowerCase();
        const handleInput = document.getElementById('handle').value.trim();

        const variantInventory = {};
        const section = document.getElementById('variantInventorySection');
        if (section && section.style.display !== 'none') {
            document.querySelectorAll('.variant-qty-input').forEach(input => {
                variantInventory[input.dataset.key] = parseInt(input.value) || 0;
            });
        }
        const simpleQty = parseInt(document.getElementById('inventoryQty').value) || 0;

        const product = {
            id: this.currentEditingId || `prod_${Date.now()}`,
            title: document.getElementById('title').value,
            handle: handleInput || baseSku,
            description: document.getElementById('description').value,
            vendor: document.getElementById('vendor').value,
            productType: document.getElementById('productType').value,
            shopifyCategory: document.getElementById('shopifyCategory').value,
            googleShoppingCategory: document.getElementById('googleShoppingCategory').value,
            skuSerial: document.getElementById('skuSerial').value,
            tags: document.getElementById('tags').value,
            status: document.getElementById('status').value,
            published: document.getElementById('published').value === 'true',
            price: parseFloat(document.getElementById('price').value) || 0,
            compareAtPrice: parseFloat(document.getElementById('compareAtPrice').value) || 0,
            costPerItem: parseFloat(document.getElementById('costPerItem').value) || 0,
            inventoryQty: simpleQty,
            variantInventory: Object.keys(variantInventory).length > 0 ? variantInventory : null,
            inventoryPolicy: document.getElementById('inventoryPolicy').value,
            chargeTax: document.getElementById('chargeTax').value === 'true',
            requiresShipping: document.getElementById('requiresShipping').value === 'true',
            weight: parseInt(document.getElementById('weight').value) || 0,
            fulfillmentService: document.getElementById('fulfillmentService').value,
            sku: document.getElementById('sku').value,
            barcode: document.getElementById('barcode').value,
            seoTitle: document.getElementById('seoTitle').value,
            seoDescription: document.getElementById('seoDescription').value,
            giftCard: document.getElementById('giftCard').value === 'true',
            option1Name: document.getElementById('option1Name').value,
            option1Values: document.getElementById('option1Values').value,
            option2Name: document.getElementById('option2Name').value,
            option2Values: document.getElementById('option2Values').value,
            option3Name: document.getElementById('option3Name').value,
            option3Values: document.getElementById('option3Values').value,
            brandName: document.getElementById('brandName').value,
            brandCode: document.getElementById('brandCode').value,
            season: document.getElementById('season').value,
            skuCategory: document.getElementById('skuCategory').value,
            images: [...this.uploadedImages]
        };
        if (this.currentEditingId) {
            const index = this.products.findIndex(p => p.id === this.currentEditingId);
            if (index !== -1) this.products[index] = product;
        } else {
            this.products.push(product);
        }
        this.renderProductsList();
        this.closeModal();
    }

    deleteProduct(productId) {
        if (confirm('この商品を削除してもよろしいですか？')) {
            this.products = this.products.filter(p => p.id !== productId);
            this.renderProductsList();
        }
    }

    renderProductsList() {
        const container = document.getElementById('productsList');
        if (this.products.length === 0) {
            container.innerHTML = `
                <div class="empty-state empty-state-action" id="emptyAddBtn">
                    <div class="empty-state-icon">+</div>
                    <h3>商品を追加</h3>
                    <p>ここをクリックして最初の商品を登録してください</p>
                </div>`;
            document.getElementById('emptyAddBtn').addEventListener('click', () => this.openModal());
            return;
        }
        container.innerHTML = `
            <div class="add-product-card" id="addProductCard">
                <div class="add-product-card-inner">
                    <div class="add-product-card-icon">+</div>
                    <div class="add-product-card-label">商品を追加</div>
                </div>
            </div>
        `;
        this.products.forEach(product => {
            const variants = this.generateVariants(product);
            const card = document.createElement('div');
            card.className = 'product-card';
            const variantTagsHtml = variants.slice(0, 5).map(v => `<span class="variant-tag">${this.escapeHtml(v)}</span>`).join('') + (variants.length > 5 ? `<span class="variant-tag">+${variants.length - 5}</span>` : '');
            card.innerHTML = `
                <div class="product-card-header">
                    <div class="product-card-title">${this.escapeHtml(product.title)}</div>
                    <div class="product-card-actions">
                        <button class="btn btn-small btn-secondary edit-btn" data-id="${product.id}">編集</button>
                        <button class="btn btn-small btn-danger delete-btn" data-id="${product.id}">削除</button>
                    </div>
                </div>
                <div class="product-card-info">
                    <div class="product-card-info-item"><span class="product-card-info-label">ハンドル</span><span class="product-card-info-value">${this.escapeHtml(product.handle)}</span></div>
                    <div class="product-card-info-item"><span class="product-card-info-label">価格</span><span class="product-card-info-value">¥${product.price.toLocaleString()}</span></div>
                    <div class="product-card-info-item"><span class="product-card-info-label">ステータス</span><span class="product-card-info-value">${product.status}</span></div>
                    <div class="product-card-info-item"><span class="product-card-info-label">在庫</span><span class="product-card-info-value">${this.calculateTotalInventory(product)}</span></div>
                </div>
                ${product.images && product.images.length > 0 ? `<div class="product-card-images">${product.images.slice(0, 4).map(img => `<img src="${img.data}" class="product-card-image" alt="">`).join('')}${product.images.length > 4 ? `<span class="variant-tag">+${product.images.length - 4}</span>` : ''}</div>` : ''}
                ${variants.length > 0 ? `<div class="product-card-variants"><div class="product-card-variants-title">バリエーション (${variants.length}個)</div><div class="product-card-variant-tags">${variantTagsHtml}</div></div>` : ''}
            `;
            container.appendChild(card);
        });
        container.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', (e) => this.openModal(e.target.dataset.id)));
        container.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', (e) => this.deleteProduct(e.target.dataset.id)));
        document.getElementById('addProductCard').addEventListener('click', () => this.openModal());
    }

    generateVariants(product) {
        const variants = [];
        const opt1 = product.option1Values ? product.option1Values.split(',').map(v => v.trim()).filter(v => v) : [];
        const opt2 = product.option2Values ? product.option2Values.split(',').map(v => v.trim()).filter(v => v) : [];
        const opt3 = product.option3Values ? product.option3Values.split(',').map(v => v.trim()).filter(v => v) : [];
        if (opt1.length === 0 && opt2.length === 0 && opt3.length === 0) return ['デフォルト'];
        if (opt1.length > 0) {
            opt1.forEach(v1 => {
                if (opt2.length > 0) opt2.forEach(v2 => opt3.length > 0 ? opt3.forEach(v3 => variants.push(`${v1} / ${v2} / ${v3}`)) : variants.push(`${v1} / ${v2}`));
                else if (opt3.length > 0) opt3.forEach(v3 => variants.push(`${v1} / ${v3}`));
                else variants.push(v1);
            });
        } else if (opt2.length > 0) {
            opt2.forEach(v2 => opt3.length > 0 ? opt3.forEach(v3 => variants.push(`${v2} / ${v3}`)) : variants.push(v2));
        } else if (opt3.length > 0) variants.push(...opt3);
        return variants;
    }

    calculateTotalInventory(product) {
        if (product.variantInventory && Object.keys(product.variantInventory).length > 0) {
            const total = Object.values(product.variantInventory).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
            return `${Object.keys(product.variantInventory).length}バリエーション / 合計${total}`;
        }
        const variants = this.generateVariants(product);
        return variants.length <= 1 ? (product.inventoryQty || 0) : `${variants.length}バリエーション / 各${product.inventoryQty || 0}`;
    }

    openTagPicker() {
        const current = document.getElementById('tags').value.split(',').map(t => t.trim()).filter(t => t);
        this.tempSelectedTags = new Set(current);
        document.getElementById('tagPickerModal').classList.add('active');
        this.renderTagCheckboxes();
    }

    closeTagPicker() {
        document.getElementById('tagPickerModal').classList.remove('active');
        this.tempSelectedTags.clear();
    }

    renderTagCheckboxes() {
        const container = document.getElementById('tagCheckboxes');
        const allTags = [...new Set([...this.defaultTags, ...this.customTags])].sort();
        container.innerHTML = allTags.map(tag => `
            <label class="tag-checkbox-label">
                <input type="checkbox" value="${this.escapeHtml(tag)}" ${this.tempSelectedTags.has(tag) ? 'checked' : ''}>
                <span>${this.escapeHtml(tag)}</span>
            </label>
        `).join('');
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) this.tempSelectedTags.add(e.target.value);
                else this.tempSelectedTags.delete(e.target.value);
            });
        });
    }

    addNewTag() {
        const input = document.getElementById('newTagInput');
        const name = input.value.trim();
        if (!name) return;
        if (!this.defaultTags.includes(name) && !this.customTags.includes(name)) {
            this.customTags.push(name);
        }
        this.tempSelectedTags.add(name);
        input.value = '';
        this.renderTagCheckboxes();
    }

    applyTags() {
        const tags = Array.from(this.tempSelectedTags).join(', ');
        document.getElementById('tags').value = tags;
        this.closeTagPicker();
    }

    getCategoryCode(name) {
        if (!name) return '';
        const key = Object.keys(this.skuMaps.category).find(k => k.toLowerCase() === name.toLowerCase());
        return key ? this.skuMaps.category[key] : name.substring(0, 2).toUpperCase();
    }

    getColorCode(name) {
        if (!name) return '';
        const trimmed = name.trim();
        const key = Object.keys(this.skuMaps.color).find(k => k.toLowerCase() === trimmed.toLowerCase());
        return key ? this.skuMaps.color[key] : trimmed.substring(0, 2).toUpperCase();
    }

    getSizeCode(name) {
        if (!name) return '';
        const trimmed = name.trim().toUpperCase();
        const key = Object.keys(this.skuMaps.size).find(k => k.toUpperCase() === trimmed);
        if (key) return this.skuMaps.size[key];
        return trimmed.length === 1 ? trimmed + '0' : trimmed.substring(0, 2);
    }

    resolveColorCode(product, variant) {
        const names = [product.option1Name, product.option2Name, product.option3Name];
        const values = [variant.option1, variant.option2, variant.option3];
        for (let i = 0; i < names.length; i++) {
            if (names[i] && names[i].toLowerCase() === 'color' && values[i]) {
                return this.getColorCode(values[i]);
            }
        }
        return '';
    }

    resolveSizeCode(product, variant) {
        const names = [product.option1Name, product.option2Name, product.option3Name];
        const values = [variant.option1, variant.option2, variant.option3];
        for (let i = 0; i < names.length; i++) {
            if (names[i] && names[i].toLowerCase() === 'size' && values[i]) {
                return this.getSizeCode(values[i]);
            }
        }
        return '';
    }

    updateSeason() {
        const year = document.getElementById('year').value;
        const seasonType = document.getElementById('seasonType').value;
        const seasonInput = document.getElementById('season');
        if (year && seasonType) {
            seasonInput.value = `${String(year).substring(2)}${seasonType === 'SS' ? 'S' : 'A'}`;
        } else {
            seasonInput.value = '';
        }
        this.updateSkuPreview();
    }

    updateSkuPreview() {
        const brand = (document.getElementById('brandCode').value || '').toUpperCase();
        const season = (document.getElementById('season').value || '').toUpperCase();
        const catCode = this.getCategoryCode(document.getElementById('skuCategory').value || document.getElementById('productType').value);
        const serial = (document.getElementById('skuSerial').value || '').trim();
        const previewEl = document.getElementById('skuPreview');
        const parts = [brand, season, catCode].filter(p => p);
        if (serial) parts.push(serial);
        if (previewEl) previewEl.textContent = parts.join('-') || '-';
    }

    renderVariantInventory() {
        const opt1Name = document.getElementById('option1Name').value;
        const opt2Name = document.getElementById('option2Name').value;
        const opt3Name = document.getElementById('option3Name').value;
        const opt1Vals = document.getElementById('option1Values').value.split(',').map(v => v.trim()).filter(v => v);
        const opt2Vals = document.getElementById('option2Values').value.split(',').map(v => v.trim()).filter(v => v);
        const opt3Vals = document.getElementById('option3Values').value.split(',').map(v => v.trim()).filter(v => v);
        const section = document.getElementById('variantInventorySection');
        const container = document.getElementById('variantInventoryContainer');
        const simpleGroup = document.getElementById('simpleInventoryGroup');

        const hasVariants = (opt1Name && opt1Vals.length > 0) || (opt2Name && opt2Vals.length > 0) || (opt3Name && opt3Vals.length > 0);
        if (!hasVariants) {
            section.style.display = 'none';
            if (simpleGroup) simpleGroup.style.display = 'block';
            return;
        }
        section.style.display = 'block';
        if (simpleGroup) simpleGroup.style.display = 'none';

        const variants = [];
        const names = [opt1Name, opt2Name, opt3Name].filter(n => n);
        const buildKey = (v1, v2, v3) => {
            const parts = [];
            if (opt1Name && v1) parts.push(v1);
            if (opt2Name && v2) parts.push(v2);
            if (opt3Name && v3) parts.push(v3);
            return parts.join(' / ');
        };
        const pushVariant = (v1, v2, v3) => {
            variants.push({ key: buildKey(v1, v2, v3), v1: v1 || '', v2: v2 || '', v3: v3 || '' });
        };
        if (opt1Name && opt1Vals.length > 0) {
            opt1Vals.forEach(v1 => {
                if (opt2Name && opt2Vals.length > 0) {
                    opt2Vals.forEach(v2 => {
                        if (opt3Name && opt3Vals.length > 0) opt3Vals.forEach(v3 => pushVariant(v1, v2, v3));
                        else pushVariant(v1, v2, '');
                    });
                } else if (opt3Name && opt3Vals.length > 0) {
                    opt3Vals.forEach(v3 => pushVariant(v1, '', v3));
                } else {
                    pushVariant(v1, '', '');
                }
            });
        } else if (opt2Name && opt2Vals.length > 0) {
            opt2Vals.forEach(v2 => {
                if (opt3Name && opt3Vals.length > 0) opt3Vals.forEach(v3 => pushVariant('', v2, v3));
                else pushVariant('', v2, '');
            });
        } else if (opt3Name && opt3Vals.length > 0) {
            opt3Vals.forEach(v3 => pushVariant('', '', v3));
        }

        const headers = names.map(n => this.escapeHtml(n));
        const rows = variants.map(v => {
            const cells = [];
            if (opt1Name && v.v1) cells.push(`<td>${this.escapeHtml(v.v1)}</td>`);
            if (opt2Name && v.v2) cells.push(`<td>${this.escapeHtml(v.v2)}</td>`);
            if (opt3Name && v.v3) cells.push(`<td>${this.escapeHtml(v.v3)}</td>`);
            const existing = this.currentEditingVariantInventory && this.currentEditingVariantInventory[v.key];
            const qty = existing !== undefined ? existing : (this.currentEditingVariantInventory ? 0 : parseInt(document.getElementById('inventoryQty').value) || 0);
            return `<tr>${cells.join('')}<td><input type="number" class="variant-qty-input" data-key="${this.escapeHtml(v.key)}" value="${qty}" min="0"></td></tr>`;
        }).join('');

        container.innerHTML = `
            <table class="variant-inventory-table">
                <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}<th>在庫数</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
    }

    renderSkuMaps() {
        const panel = document.getElementById('skuMapsPanel');
        if (!panel) return;
        const renderTable = (title, map) => {
            const rows = Object.entries(map).map(([k, v]) => `<tr><td>${this.escapeHtml(k)}</td><td><code>${v}</code></td></tr>`).join('');
            return `<div class="sku-map-table-wrapper"><h4>${title}</h4><table class="sku-map-table"><thead><tr><th>名称</th><th>コード</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        };
        panel.innerHTML = `
            <div class="sku-maps-content">
                ${renderTable('カテゴリ', this.skuMaps.category)}
                ${renderTable('カラー', this.skuMaps.color)}
                ${renderTable('サイズ', this.skuMaps.size)}
            </div>
        `;
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    getExternalImageUrl(url) {
        if (!url) return '';
        const trimmed = String(url).trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
        return '';
    }

    exportCSV() {
        if (this.products.length === 0) { alert('商品が登録されていません'); return; }
        const rows = [];
        rows.push(this.csvHeaders.join(','));
        this.products.forEach(product => this.generateCSVRows(product).forEach(row => rows.push(row.join(','))));
        const csvContent = '\uFEFF' + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `products_export_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
    }

    generateCSVRows(product) {
        const rows = [];
        const variants = this.generateVariantsForCSV(product);
        variants.forEach((variant, index) => {
            const row = new Array(this.csvHeaders.length).fill('');
            row[1] = this.escapeCsv(product.handle);
            if (index === 0) {
                row[0] = this.escapeCsv(product.title);
                row[2] = this.escapeCsv(product.description);
                row[3] = this.escapeCsv(product.vendor);
                row[4] = this.escapeCsv(product.shopifyCategory || product.productCategory || '');
                row[5] = this.escapeCsv(product.productType);
                row[6] = this.escapeCsv(product.tags);
                row[7] = product.published ? 'TRUE' : 'FALSE';
                row[41] = this.escapeCsv(product.seoTitle);
                row[42] = this.escapeCsv(product.seoDescription);
                row[44] = this.escapeCsv(product.googleShoppingCategory || product.productCategory || '');
            }
            row[8] = product.status;
            row[9] = this.escapeCsv(variant.sku || product.sku || '');
            row[10] = this.escapeCsv(product.barcode);
            if (variant.option1) {
                row[11] = this.escapeCsv(product.option1Name);
                row[12] = this.escapeCsv(variant.option1);
                if (product.option1Name === 'Color') row[13] = 'product.metafields.shopify.color-pattern';
            }
            if (variant.option2) { row[14] = this.escapeCsv(product.option2Name); row[15] = this.escapeCsv(variant.option2); }
            if (variant.option3) { row[17] = this.escapeCsv(product.option3Name); row[18] = this.escapeCsv(variant.option3); }
            row[20] = product.price;
            row[21] = product.compareAtPrice || '';
            row[22] = product.costPerItem || '';
            row[23] = product.chargeTax ? 'TRUE' : 'FALSE';
            row[29] = 'shopify';
            row[30] = variant.inventoryQty !== undefined ? variant.inventoryQty : (product.inventoryQty || 0);
            row[31] = product.inventoryPolicy.toUpperCase();
            row[32] = product.weight;
            row[33] = 'g';
            row[34] = product.requiresShipping ? 'TRUE' : 'FALSE';
            row[35] = product.fulfillmentService;
            if (index === 0 && product.images && product.images.length > 0) {
                const ext0 = this.getExternalImageUrl(product.images[0].data);
                if (ext0) { row[36] = this.escapeCsv(ext0); row[37] = '1'; }
                const ext1 = product.images.length > 1 ? this.getExternalImageUrl(product.images[1].data) : '';
                if (ext1) row[39] = this.escapeCsv(ext1);
            }
            row[40] = product.giftCard ? 'TRUE' : 'FALSE';
            row[57] = this.escapeCsv(product.brandCode || '');
            row[58] = this.escapeCsv(product.skuCategory || '');
            row[59] = this.escapeCsv(product.skuSerial || '');
            row[60] = this.escapeCsv(product.season || '');
            row[61] = this.escapeCsv(product.brandName || '');
            rows.push(row);
        });
        if (rows.length === 0) {
            const row = new Array(this.csvHeaders.length).fill('');
            row[0] = this.escapeCsv(product.title); row[1] = this.escapeCsv(product.handle); row[2] = this.escapeCsv(product.description);
            row[3] = this.escapeCsv(product.vendor); row[4] = this.escapeCsv(product.shopifyCategory || product.productCategory || ''); row[5] = this.escapeCsv(product.productType);
            row[7] = product.published ? 'TRUE' : 'FALSE'; row[8] = product.status; row[9] = this.escapeCsv(product.sku);
            row[20] = product.price; row[23] = product.chargeTax ? 'TRUE' : 'FALSE'; row[29] = 'shopify';
            row[30] = product.inventoryQty; row[31] = product.inventoryPolicy.toUpperCase(); row[32] = product.weight;
            row[34] = product.requiresShipping ? 'TRUE' : 'FALSE'; row[35] = product.fulfillmentService;
            if (product.images && product.images.length > 0) {
                const ext0 = this.getExternalImageUrl(product.images[0].data);
                if (ext0) { row[36] = this.escapeCsv(ext0); row[37] = '1'; }
            }
            row[57] = this.escapeCsv(product.brandCode || '');
            row[58] = this.escapeCsv(product.skuCategory || '');
            row[59] = this.escapeCsv(product.skuSerial || '');
            row[60] = this.escapeCsv(product.season || '');
            row[61] = this.escapeCsv(product.brandName || '');
            rows.push(row);
        }
        return rows;
    }

    generateVariantsForCSV(product) {
        const variants = [];
        const opt1 = product.option1Values ? product.option1Values.split(',').map(v => v.trim()).filter(v => v) : [];
        const opt2 = product.option2Values ? product.option2Values.split(',').map(v => v.trim()).filter(v => v) : [];
        const opt3 = product.option3Values ? product.option3Values.split(',').map(v => v.trim()).filter(v => v) : [];
        const opt1Name = product.option1Name || '';
        const opt2Name = product.option2Name || '';
        const opt3Name = product.option3Name || '';
        const genSku = (variant) => {
            const brand = (product.brandCode || '').toUpperCase();
            const season = (product.season || '').toUpperCase();
            const catCode = this.getCategoryCode(product.skuCategory || product.productType);
            const serial = (product.skuSerial || '').trim();
            const colorCode = this.resolveColorCode(product, variant);
            const sizeCode = this.resolveSizeCode(product, variant);
            const parts = [brand, season, catCode].filter(p => p);
            if (serial) parts.push(serial);
            if (colorCode) parts.push(colorCode);
            if (sizeCode) parts.push(sizeCode);
            return parts.join('-');
        };
        const buildKey = (v1, v2, v3) => {
            const parts = [];
            if (opt1Name && v1) parts.push(v1);
            if (opt2Name && v2) parts.push(v2);
            if (opt3Name && v3) parts.push(v3);
            return parts.join(' / ');
        };
        const getQty = (key) => {
            if (product.variantInventory && product.variantInventory[key] !== undefined) return product.variantInventory[key];
            return product.inventoryQty || 0;
        };
        if (opt1.length === 0 && opt2.length === 0 && opt3.length === 0) {
            const sku = genSku({ option1: '', option2: '', option3: '' });
            variants.push({ option1: '', option2: '', option3: '', sku: sku || product.sku || '', inventoryQty: product.inventoryQty || 0 });
            return variants;
        }
        if (opt1.length > 0) {
            opt1.forEach(v1 => {
                if (opt2.length > 0) opt2.forEach(v2 => opt3.length > 0 ? opt3.forEach(v3 => {
                    const key = buildKey(v1, v2, v3);
                    variants.push({ option1: v1, option2: v2, option3: v3, sku: genSku({option1:v1,option2:v2,option3:v3}), inventoryQty: getQty(key) });
                }) : variants.push({ option1: v1, option2: v2, option3: '', sku: genSku({option1:v1,option2:v2,option3:''}), inventoryQty: getQty(buildKey(v1, v2, '')) }));
                else if (opt3.length > 0) opt3.forEach(v3 => variants.push({ option1: v1, option2: '', option3: v3, sku: genSku({option1:v1,option2:'',option3:v3}), inventoryQty: getQty(buildKey(v1, '', v3)) }));
                else variants.push({ option1: v1, option2: '', option3: '', sku: genSku({option1:v1,option2:'',option3:''}), inventoryQty: getQty(buildKey(v1, '', '')) });
            });
        } else if (opt2.length > 0) {
            opt2.forEach(v2 => opt3.length > 0 ? opt3.forEach(v3 => variants.push({ option1: '', option2: v2, option3: v3, sku: genSku({option1:'',option2:v2,option3:v3}), inventoryQty: getQty(buildKey('', v2, v3)) })) : variants.push({ option1: '', option2: v2, option3: '', sku: genSku({option1:'',option2:v2,option3:''}), inventoryQty: getQty(buildKey('', v2, '')) }));
        } else if (opt3.length > 0) opt3.forEach(v3 => variants.push({ option1: '', option2: '', option3: v3, sku: genSku({option1:'',option2:'',option3:v3}), inventoryQty: getQty(buildKey('', '', v3)) }));
        return variants;
    }

    escapeCsv(value) {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) return '"' + str.replace(/"/g, '""') + '"';
        return str;
    }

    loadTemplate(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => { try { this.parseCSV(e.target.result); } catch (error) { alert('CSVの読み込みに失敗しました: ' + error.message); } };
        reader.readAsText(file);
    }

    parseCSVLine(line) {
        const values = [];
        let value = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') { value += '"'; i++; }
                else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) { values.push(value.trim()); value = ''; }
            else { value += char; }
        }
        values.push(value.trim());
        return values;
    }

    parseCSV(csvContent) {
        const lines = csvContent.split('\n').filter(line => line.trim());
        if (lines.length < 2) { alert('有効なデータが見つかりません'); return; }
        const headers = this.parseCSVLine(lines[0]);
        const find = (names) => { for (const name of names) { const idx = headers.indexOf(name); if (idx !== -1) return idx; } return -1; };
        const idx = {
            title: find(['Title']), handle: find(['URL handle', 'Handle']), description: find(['Description', 'Body (HTML)']),
            vendor: find(['Vendor']), productCategory: find(['Product category', 'Product Category']),
            googleShoppingCategory: find(['Google Shopping / Google product category', 'Google Product Category']), productType: find(['Type']),
            tags: find(['Tags']), published: find(['Published on online store', 'Published']), status: find(['Status']),
            price: find(['Price', 'Variant Price']), compareAtPrice: find(['Compare-at price', 'Variant Compare At Price']),
            costPerItem: find(['Cost per item', 'Variant Cost']), inventoryQty: find(['Inventory quantity', 'Variant Inventory Qty']), sku: find(['SKU', 'Variant SKU']),
            barcode: find(['Barcode', 'Variant Barcode']), option1Name: find(['Option1 name', 'Option1 Name']),
            option1Value: find(['Option1 value', 'Option1 Value']), option2Name: find(['Option2 name', 'Option2 Name']),
            option2Value: find(['Option2 value', 'Option2 Value']), option3Name: find(['Option3 name', 'Option3 Name']),
            option3Value: find(['Option3 value', 'Option3 Value']), imageSrc: find(['Product image URL', 'Image Src']),
            weight: find(['Weight value (grams)', 'Variant Grams']), requiresShipping: find(['Requires shipping', 'Variant Requires Shipping']),
            chargeTax: find(['Charge tax', 'Variant Taxable']), fulfillmentService: find(['Fulfillment service', 'Variant Fulfillment Service']),
            unitPriceTotalMeasure: find(['Unit price total measure', 'Unit Price Total Measure']),
            unitPriceTotalMeasureUnit: find(['Unit price total measure unit', 'Unit Price Total Measure Unit']),
            unitPriceBaseMeasure: find(['Unit price base measure', 'Unit Price Base Measure']),
            unitPriceBaseMeasureUnit: find(['Unit price base measure unit', 'Unit Price Base Measure Unit']),
            inventoryPolicy: find(['Continue selling when out of stock', 'Variant Inventory Policy']),
            seoTitle: find(['SEO title', 'SEO Title']),
            seoDescription: find(['SEO description', 'SEO Description']),
            imagePosition: find(['Image position', 'Image Position']),
            imageAltText: find(['Image alt text', 'Image Alt Text']),
            variantImage: find(['Variant image URL', 'Variant Image']),
            weightUnit: find(['Weight unit for display', 'Variant Weight Unit']),
            taxCode: find(['Tax code', 'Variant Tax Code']),
            inventoryTracker: find(['Inventory tracker', 'Variant Inventory Tracker']),
            giftCard: find(['Gift card', 'Gift Card']),
            brandCode: find(['Brand Code']), skuCategory: find(['SKU Category']),
            skuSerial: find(['SKU Serial']), season: find(['Season']),
            brandName: find(['Brand Name'])
        };
        const products = [];
        let current = null;
        const opt1Values = new Set();
        const opt2Values = new Set();
        const opt3Values = new Set();
        const images = [];
        for (let i = 1; i < lines.length; i++) {
            const values = this.parseCSVLine(lines[i]);
            const title = idx.title !== -1 ? values[idx.title] : '';
            if (title) {
                if (current) {
                    current.option1Values = Array.from(opt1Values).join(', ');
                    current.option2Values = Array.from(opt2Values).join(', ');
                    current.option3Values = Array.from(opt3Values).join(', ');
                    if (images.length > 0) current.images = images.map((src, i) => ({ id: `img_${current.id}_${i}`, name: `image_${i+1}.jpg`, data: src }));
                    products.push(current);
                }
                opt1Values.clear(); opt2Values.clear(); opt3Values.clear(); images.length = 0;
                current = {
                    id: `prod_${Date.now()}_${i}`,
                    title: title,
                    handle: idx.handle !== -1 ? values[idx.handle] : '',
                    description: idx.description !== -1 ? values[idx.description] : '',
                    vendor: idx.vendor !== -1 ? values[idx.vendor] : 'Your Brand',
                    shopifyCategory: idx.productCategory !== -1 ? values[idx.productCategory] : '',
                    googleShoppingCategory: idx.googleShoppingCategory !== -1 ? values[idx.googleShoppingCategory] : '',
                    productType: idx.productType !== -1 ? values[idx.productType] : '',
                    tags: idx.tags !== -1 ? values[idx.tags] : '',
                    published: idx.published !== -1 ? String(values[idx.published]).toLowerCase() === 'true' : true,
                    status: idx.status !== -1 ? values[idx.status] : 'active',
                    price: idx.price !== -1 ? parseFloat(values[idx.price]) || 0 : 0,
                    compareAtPrice: idx.compareAtPrice !== -1 ? parseFloat(values[idx.compareAtPrice]) || 0 : 0,
                    costPerItem: idx.costPerItem !== -1 ? parseFloat(values[idx.costPerItem]) || 0 : 0,
                    inventoryQty: idx.inventoryQty !== -1 ? parseInt(values[idx.inventoryQty]) || 0 : 0,
                    variantInventory: {},
                    sku: idx.sku !== -1 ? values[idx.sku] : '',
                    barcode: idx.barcode !== -1 ? values[idx.barcode] : '',
                    weight: idx.weight !== -1 ? parseInt(values[idx.weight]) || 0 : 0,
                    requiresShipping: idx.requiresShipping !== -1 ? String(values[idx.requiresShipping]).toLowerCase() === 'true' : true,
                    chargeTax: idx.chargeTax !== -1 ? String(values[idx.chargeTax]).toLowerCase() === 'true' : true,
                    fulfillmentService: idx.fulfillmentService !== -1 ? values[idx.fulfillmentService] : 'manual',
                    inventoryPolicy: idx.inventoryPolicy !== -1 ? (values[idx.inventoryPolicy].toLowerCase() === 'continue' ? 'continue' : 'deny') : 'deny',
                    seoTitle: idx.seoTitle !== -1 ? values[idx.seoTitle] : '',
                    seoDescription: idx.seoDescription !== -1 ? values[idx.seoDescription] : '',
                    option1Name: idx.option1Name !== -1 ? values[idx.option1Name] : '',
                    option2Name: idx.option2Name !== -1 ? values[idx.option2Name] : '',
                    option3Name: idx.option3Name !== -1 ? values[idx.option3Name] : '',
                    option1Values: '', option2Values: '', option3Values: '',
                    images: [], giftCard: idx.giftCard !== -1 ? String(values[idx.giftCard]).toLowerCase() === 'true' : false, costPerItem: 0,
                    brandCode: idx.brandCode !== -1 ? values[idx.brandCode] : '',
                    skuCategory: idx.skuCategory !== -1 ? values[idx.skuCategory] : '',
                    skuSerial: idx.skuSerial !== -1 ? values[idx.skuSerial] : '',
                    season: idx.season !== -1 ? values[idx.season] : '',
                    brandName: idx.brandName !== -1 ? values[idx.brandName] : ''
                };
            }
            if (current) {
                const v1 = idx.option1Value !== -1 ? values[idx.option1Value] : '';
                const v2 = idx.option2Value !== -1 ? values[idx.option2Value] : '';
                const v3 = idx.option3Value !== -1 ? values[idx.option3Value] : '';
                if (v1) opt1Values.add(v1);
                if (v2) opt2Values.add(v2);
                if (v3) opt3Values.add(v3);
                const buildKey = () => {
                    const parts = [];
                    if (current.option1Name && v1) parts.push(v1);
                    if (current.option2Name && v2) parts.push(v2);
                    if (current.option3Name && v3) parts.push(v3);
                    return parts.join(' / ');
                };
                const key = buildKey();
                if (key && idx.inventoryQty !== -1) {
                    current.variantInventory[key] = parseInt(values[idx.inventoryQty]) || 0;
                }
                if (idx.imageSrc !== -1 && values[idx.imageSrc]) images.push(values[idx.imageSrc]);
            }
        }
        if (current) {
            current.option1Values = Array.from(opt1Values).join(', ');
            current.option2Values = Array.from(opt2Values).join(', ');
            current.option3Values = Array.from(opt3Values).join(', ');
            if (images.length > 0) current.images = images.map((src, i) => ({ id: `img_${current.id}_${i}`, name: `image_${i+1}.jpg`, data: src }));
            products.push(current);
        }
        this.products = products;
        this.renderProductsList();
        alert(`${products.length}個の商品を読み込みました`);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ProductCSVGenerator();
});
