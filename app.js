// Product CSV Generator Application

const MEASUREMENT_FIELDS = {
    tops: ['着丈', '肩幅', '身幅', '袖丈'],
    bottoms: ['ウエスト', 'ヒップ', '股上', '股下', 'すそ周り'],
    onepiece: ['着丈', '肩幅', '身幅', '袖丈', 'ウエスト'],
    outer: ['着丈', '肩幅', '身幅', '袖丈'],
    hat: ['頭周り', 'つばの長さ', '高さ'],
    shoes: ['外反幅', '甲周り', '重さ'],
    bag: ['幅', '高さ', 'マチ', '持ち手長さ', '重さ'],
    accessories: ['全長', '幅', '重さ'],
    other: ['備考']
};

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
            'Size (product.metafields.shopify.size)',
            'Google Shopping / Google product category','Google Shopping / Gender',
            'Google Shopping / Age group','Google Shopping / Manufacturer part number (MPN)',
            'Google Shopping / Ad group name','Google Shopping / Ads labels',
            'Google Shopping / Condition','Google Shopping / Custom product',
            'Google Shopping / Custom label 0','Google Shopping / Custom label 1',
            'Google Shopping / Custom label 2','Google Shopping / Custom label 3',
            'Google Shopping / Custom label 4',
            'Brand Code','SKU Category','SKU Serial','Season','Brand Name',
            'Collection'
        ];
        
        this.skuMaps = { category: {}, color: {}, size: {} };
        this.dataSizes = { shoes: {}, clothing: {}, other: {} };
        this.dataBrands = {};
        this.dataTags = [];
        this.dataCollections = [];
        this.tempSelectedCollection = '';
        this.currentEditingVariantImages = null;
        this.variantImagePickerTarget = null;
        this.loadData();
    }

    async loadData() {
        try {
            const [cat, col, szRaw, br, tg, cl] = await Promise.all([
                fetch('data/categories.json').then(r => r.json()).catch(() => ({})),
                fetch('data/colors.json').then(r => r.json()).catch(() => ({})),
                fetch('data/sizes.json').then(r => r.json()).catch(() => ({})),
                fetch('data/brands.json').then(r => r.json()).catch(() => ({})),
                fetch('data/tags.json').then(r => r.json()).catch(() => ({ tags: [] })),
                fetch('data/collections.json').then(r => r.json()).catch(() => ({ collections: [] }))
            ]);
            this.skuMaps.category = cat;
            this.skuMaps.color = col;
            this.dataSizes = { shoes: {}, clothing: {}, other: {} };
            this.skuMaps.size = {};
            if (szRaw.shoes) {
                Object.entries(szRaw.shoes).forEach(([name, info]) => {
                    this.dataSizes.shoes[name] = info;
                    this.skuMaps.size[name] = info.code;
                });
            }
            if (szRaw.clothing) {
                Object.entries(szRaw.clothing).forEach(([name, info]) => {
                    this.dataSizes.clothing[name] = info;
                    this.skuMaps.size[name] = info.code;
                });
            }
            if (!szRaw.shoes && !szRaw.clothing) {
                Object.entries(szRaw).forEach(([name, info]) => {
                    if (typeof info === 'string') {
                        this.skuMaps.size[name] = info;
                        this.dataSizes.other[name] = { code: info };
                    } else if (info && info.code) {
                        this.skuMaps.size[name] = info.code;
                        this.dataSizes.other[name] = info;
                    }
                });
            }
            this.dataBrands = br;
            this.dataTags = Array.isArray(tg.tags) ? tg.tags.map(t => typeof t === 'string' ? t : (t.name || '')).filter(Boolean) : [];
            this.dataCollections = Array.isArray(cl.collections) ? cl.collections.map(c => typeof c === 'string' ? c : (c.name || '')).filter(Boolean) : [];
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
        document.querySelectorAll('.data-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchDataTab(tab.dataset.tab));
        });
        document.getElementById('addBrandBtn').addEventListener('click', () => this.addDataItem('brands'));
        document.getElementById('addCategoryBtn').addEventListener('click', () => this.addDataItem('categories'));
        document.getElementById('addColorBtn').addEventListener('click', () => this.addDataItem('colors'));
        document.getElementById('addTagBtn').addEventListener('click', () => this.addDataItem('tags'));
        document.getElementById('addCollectionBtn').addEventListener('click', () => this.addDataItem('collections'));
        document.querySelectorAll('.size-type-tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchSizeTypeTab(tab.dataset.sizeType));
        });
        document.getElementById('addShoeSizeBtn').addEventListener('click', () => this.addSizeItem('shoes'));
        document.getElementById('addClothingSizeBtn').addEventListener('click', () => this.addSizeItem('clothing'));
        document.getElementById('addOtherSizeBtn').addEventListener('click', () => this.addSizeItem('other'));
        document.getElementById('exportDataBtn').addEventListener('click', () => this.exportDataJson());

        document.getElementById('openBrandPicker').addEventListener('click', () => this.openBrandPicker());
        document.getElementById('openVendorPicker').addEventListener('click', () => this.openBrandPicker());
        document.getElementById('closeBrandPicker').addEventListener('click', () => this.closeBrandPicker());
        document.getElementById('cancelBrandPicker').addEventListener('click', () => this.closeBrandPicker());
        document.getElementById('brandSearchInput').addEventListener('input', () => this.filterBrandPicker());

        document.getElementById('openCategoryPicker').addEventListener('click', () => this.openCategoryPicker());
        document.getElementById('openProductTypePicker').addEventListener('click', () => this.openProductTypePicker());
        document.getElementById('closeCategoryPicker').addEventListener('click', () => this.closeCategoryPicker());
        document.getElementById('cancelCategoryPicker').addEventListener('click', () => this.closeCategoryPicker());
        document.getElementById('categorySearchInput').addEventListener('input', () => this.filterCategoryPicker());

        document.getElementById('openTagPicker').addEventListener('click', () => this.openTagPicker());
        document.getElementById('closeTagPicker').addEventListener('click', () => this.closeTagPicker());
        document.getElementById('cancelTagPicker').addEventListener('click', () => this.closeTagPicker());
        document.getElementById('applyTagsBtn').addEventListener('click', () => this.applyTags());
        document.getElementById('addNewTagBtn').addEventListener('click', () => this.addNewTag());
        document.getElementById('newTagInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.addNewTag(); }
        });

        document.getElementById('openCollectionPicker').addEventListener('click', () => this.openCollectionPicker());
        document.getElementById('closeCollectionPicker').addEventListener('click', () => this.closeCollectionPicker());
        document.getElementById('cancelCollectionPicker').addEventListener('click', () => this.closeCollectionPicker());
        document.getElementById('applyCollectionsBtn').addEventListener('click', () => this.applyCollections());
        document.getElementById('addNewCollectionBtn').addEventListener('click', () => this.addNewCollection());
        document.getElementById('newCollectionInput').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this.addNewCollection(); }
        });

        document.getElementById('closeVariantImagePicker').addEventListener('click', () => this.closeVariantImagePicker());
        document.getElementById('cancelVariantImagePicker').addEventListener('click', () => this.closeVariantImagePicker());
        document.getElementById('clearVariantImageBtn').addEventListener('click', () => this.clearVariantImage());
        document.getElementById('variantCloudinaryUploadBtn').addEventListener('click', () => document.getElementById('cloudinaryInput').click());

        document.getElementById('openOption1Picker').addEventListener('click', () => this.openOptionPicker(1));
        document.getElementById('openOption2Picker').addEventListener('click', () => this.openOptionPicker(2));
        document.getElementById('openOption3Picker').addEventListener('click', () => this.openOptionPicker(3));
        document.getElementById('closeSizePicker').addEventListener('click', () => this.closeSizePicker());
        document.getElementById('cancelSizePicker').addEventListener('click', () => this.closeSizePicker());
        document.getElementById('applySizesBtn').addEventListener('click', () => this.applySizes());
        document.querySelectorAll('[data-size-picker-tab]').forEach(tab => {
            tab.addEventListener('click', () => this.switchSizePickerTab(tab.dataset.sizePickerTab));
        });
        document.getElementById('closeColorPicker').addEventListener('click', () => this.closeColorPicker());
        document.getElementById('cancelColorPicker').addEventListener('click', () => this.closeColorPicker());
        document.getElementById('applyColorsBtn').addEventListener('click', () => this.applyColors());

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
        ['title','vendor','description'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateSeoFields());
        });
        document.getElementById('seoDescription').addEventListener('input', () => {
            this.seoDescriptionManuallyEdited = true;
        });

        document.getElementById('measurementType').addEventListener('change', () => this.renderMeasurementTable());
        document.getElementById('addMeasurementRow').addEventListener('click', () => this.addMeasurementRow());
        ['description', 'descriptionOther', 'modelInfo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('input', () => this.updateDescriptionPreview());
        });
        document.getElementById('measurementTableWrapper').addEventListener('input', () => this.updateDescriptionPreview());
    }

    generateHandle(title) {
        if (!title) return '';
        if (/[^\x00-\x7F]/.test(title)) return '';
        return title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').substring(0, 50);
    }

    generateCollectionHandle(name) {
        if (!name) return '';
        return name;
    }

    updateSeoFields() {
        const title = document.getElementById('title').value.trim();
        const vendor = document.getElementById('vendor').value.trim() || 'Your Brand';
        const description = document.getElementById('description').value.trim();

        // Auto-generate SEO title: Title | Brand (max 60 chars)
        if (title) {
            let seoTitle = `${title} | ${vendor}`;
            if (seoTitle.length > 60) {
                seoTitle = `${title.substring(0, 57 - vendor.length)}... | ${vendor}`;
            }
            document.getElementById('seoTitle').value = seoTitle;
        } else {
            document.getElementById('seoTitle').value = '';
        }

        // Auto-generate SEO description from description (max 160 chars) unless manually edited
        if (!this.seoDescriptionManuallyEdited && description) {
            const plainText = description.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
            document.getElementById('seoDescription').value = plainText.substring(0, 160);
        }
    }

    renderMeasurementTable(rows = []) {
        const type = document.getElementById('measurementType').value;
        const section = document.getElementById('measurementSection');
        const wrapper = document.getElementById('measurementTableWrapper');

        if (!type || !MEASUREMENT_FIELDS[type]) {
            section.style.display = 'none';
            wrapper.innerHTML = '';
            return;
        }

        section.style.display = 'block';
        const fields = MEASUREMENT_FIELDS[type];
        const unit = (type === 'shoes' || type === 'bag' || type === 'accessories') ? '' : ' (cm)';

        let html = '<div class="measurement-table-scroll"><table class="measurement-table"><thead><tr><th>Size' + unit + '</th>';
        fields.forEach(field => { html += `<th>${this.escapeHtml(field)}</th>`; });
        html += '<th></th></tr></thead><tbody>';

        if (rows.length === 0) rows = [{ size: '' }];
        rows.forEach((row, index) => {
            html += `<tr data-row-index="${index}"><td><input type="text" class="measurement-size" value="${this.escapeHtml(row.size || '')}" placeholder="S, M, 2..."></td>`;
            fields.forEach((field, fIndex) => {
                const key = this.measurementKey(field);
                html += `<td><input type="text" class="measurement-value" data-field="${this.escapeHtml(field)}" value="${this.escapeHtml(row[key] || '')}"></td>`;
            });
            html += `<td><button type="button" class="btn btn-icon btn-remove-row" data-index="${index}">削除</button></td></tr>`;
        });

        html += '</tbody></table></div>';
        wrapper.innerHTML = html;

        wrapper.querySelectorAll('.btn-remove-row').forEach(btn => {
            btn.addEventListener('click', (e) => this.removeMeasurementRow(parseInt(e.target.dataset.index)));
        });
    }

    measurementKey(label) {
        return label.replace(/\s+/g, '_').replace(/[()]/g, '');
    }

    addMeasurementRow() {
        const wrapper = document.getElementById('measurementTableWrapper');
        const rows = this.getMeasurementData();
        rows.push({ size: '' });
        this.renderMeasurementTable(rows);
        this.updateDescriptionPreview();
    }

    removeMeasurementRow(index) {
        const rows = this.getMeasurementData();
        rows.splice(index, 1);
        if (rows.length === 0) rows.push({ size: '' });
        this.renderMeasurementTable(rows);
        this.updateDescriptionPreview();
    }

    getMeasurementData() {
        const wrapper = document.getElementById('measurementTableWrapper');
        const rows = [];
        wrapper.querySelectorAll('tbody tr').forEach(tr => {
            const row = { size: '' };
            const sizeInput = tr.querySelector('.measurement-size');
            if (sizeInput) row.size = sizeInput.value.trim();
            tr.querySelectorAll('.measurement-value').forEach(input => {
                const key = this.measurementKey(input.dataset.field);
                row[key] = input.value.trim();
            });
            rows.push(row);
        });
        return rows;
    }

    generateDescriptionHTML(product = null) {
        const description = product ? (product.description || '') : document.getElementById('description').value.trim();

        // 既にHTML形式のdescriptionがあれば、そのまま使用する（CSV読み込み時の互換性）
        if (description && /<[^>]+>/.test(description)) {
            return description;
        }

        const descriptionOther = product ? (product.descriptionOther || '') : document.getElementById('descriptionOther').value.trim();
        const modelInfo = product ? (product.modelInfo || '') : document.getElementById('modelInfo').value.trim();
        const measurementType = product ? (product.measurementType || '') : document.getElementById('measurementType').value;
        const measurementRows = product ? (product.measurementRows || []) : this.getMeasurementData();

        let html = '';

        if (description) {
            html += description.replace(/\n/g, '<br>');
        }

        const fields = MEASUREMENT_FIELDS[measurementType];
        if (fields && measurementRows.length > 0 && measurementRows.some(r => r.size || fields.some(f => r[this.measurementKey(f)]))) {
            if (html) html += '<p>&nbsp;</p>';
            const sizeHeader = `Size${(measurementType === 'shoes' || measurementType === 'bag' || measurementType === 'accessories' || measurementType === 'other') ? '' : ' (cm)'}`;
            html += '<div class="rte-table-wrapper"><table style="width: auto; border-collapse: collapse; border-top: 1px solid #000; border-bottom: 1px solid #000;"><tbody>';
            html += `<tr style="border-bottom: 1px solid #000;"><td style="border: none; padding: 6px 12px;">${this.escapeHtml(sizeHeader)}</td>`;
            fields.forEach(field => { html += `<td style="border: none; padding: 6px 12px;">${this.escapeHtml(field)}</td>`; });
            html += '</tr>';
            measurementRows.forEach(row => {
                html += `<tr><td style="border: none; padding: 6px 12px;">${this.escapeHtml(row.size || '')}</td>`;
                fields.forEach(field => {
                    html += `<td style="border: none; padding: 6px 12px;">${this.escapeHtml(row[this.measurementKey(field)] || '')}</td>`;
                });
                html += '</tr>';
            });
            html += '</tbody></table></div>';
        }

        if (descriptionOther) {
            if (html) html += '<p>&nbsp;</p>';
            html += descriptionOther.replace(/\n/g, '<br>');
        }

        if (modelInfo) {
            if (html) html += '<p>&nbsp;</p>';
            html += `<p>${this.escapeHtml(modelInfo)}</p>`;
        }

        return html;
    }

    updateDescriptionPreview() {
        const preview = document.getElementById('descriptionPreview');
        if (!preview) return;
        preview.innerHTML = this.generateDescriptionHTML();
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
        if (document.getElementById('variantImagePickerModal').classList.contains('active')) {
            this.renderVariantImageGrid();
        }
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
        this.currentEditingVariantImages = null;
        if (productId) {
            const product = this.products.find(p => p.id === productId);
            if (product) {
                this.currentEditingVariantInventory = product.variantInventory || null;
                this.currentEditingVariantImages = product.variantImages ? {...product.variantImages} : null;
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
                    <span class="data-list-item-code">${this.escapeHtml(info.reading || '')} / ${this.escapeHtml(info.code || '')}</span>
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

        // Shoe Sizes
        const shoeList = document.getElementById('shoeSizesList');
        const shoeEntries = Object.entries(this.dataSizes.shoes).sort((a, b) => {
            const n1 = parseFloat(a[0].replace(/[^0-9.]/g, '')) || 0;
            const n2 = parseFloat(b[0].replace(/[^0-9.]/g, '')) || 0;
            return n1 - n2;
        });
        shoeList.innerHTML = shoeEntries.length ? shoeEntries.map(([name, info]) => {
            const extra = [];
            if (info.uk) extra.push(`UK: ${info.uk}`);
            if (info.us) extra.push(`US: ${info.us}`);
            const extraStr = extra.length ? ` (${extra.join(' / ')})` : '';
            const escName = this.escapeHtml(name).replace(/'/g, "\\'");
            return `<div class="data-list-item"><div class="data-list-item-info"><span class="data-list-item-name">${this.escapeHtml(name)}${extraStr}</span><span class="data-list-item-code">${this.escapeHtml(info.code)}</span></div><button class="data-list-item-remove" onclick="app.removeSizeItem('shoes','${escName}')">&times;</button></div>`;
        }).join('') : '<div class="data-list-item"><span style="color:var(--color-text-muted)">データがありません</span></div>';

        // Clothing Sizes
        const clothList = document.getElementById('clothingSizesList');
        const clothEntries = Object.entries(this.dataSizes.clothing).sort((a, b) => a[0].localeCompare(b[0]));
        clothList.innerHTML = clothEntries.length ? clothEntries.map(([name, info]) => {
            const escName = this.escapeHtml(name).replace(/'/g, "\\'");
            return `<div class="data-list-item"><div class="data-list-item-info"><span class="data-list-item-name">${this.escapeHtml(name)}</span><span class="data-list-item-code">${this.escapeHtml(info.code)}</span></div><button class="data-list-item-remove" onclick="app.removeSizeItem('clothing','${escName}')">&times;</button></div>`;
        }).join('') : '<div class="data-list-item"><span style="color:var(--color-text-muted)">データがありません</span></div>';

        // Other Sizes
        const otherList = document.getElementById('otherSizesList');
        const otherEntries = Object.entries(this.dataSizes.other).sort((a, b) => a[0].localeCompare(b[0]));
        otherList.innerHTML = otherEntries.length ? otherEntries.map(([name, info]) => {
            const escName = this.escapeHtml(name).replace(/'/g, "\\'");
            return `<div class="data-list-item"><div class="data-list-item-info"><span class="data-list-item-name">${this.escapeHtml(name)}</span><span class="data-list-item-code">${this.escapeHtml(info.code)}</span></div><button class="data-list-item-remove" onclick="app.removeSizeItem('other','${escName}')">&times;</button></div>`;
        }).join('') : '<div class="data-list-item"><span style="color:var(--color-text-muted)">データがありません</span></div>';
        // Tags (view-only from task manager)
        const tagsList = document.getElementById('tagsList');
        const sortedTags = [...this.dataTags].filter(Boolean).sort((a, b) => a.localeCompare(b));
        tagsList.innerHTML = sortedTags.length ? sortedTags.map((tag) => `
            <div class="data-list-item">
                <div class="data-list-item-info">
                    <span class="data-list-item-name">${this.escapeHtml(tag)}</span>
                </div>
            </div>
        `).join('') : '<div class="data-list-item"><span style="color:var(--color-text-muted)">データがありません</span></div>';

        // Collections (view-only from task manager)
        const collectionsList = document.getElementById('collectionsList');
        const sortedCollections = [...this.dataCollections].filter(Boolean).sort((a, b) => a.localeCompare(b));
        collectionsList.innerHTML = sortedCollections.length ? sortedCollections.map((col) => `
            <div class="data-list-item">
                <div class="data-list-item-info">
                    <span class="data-list-item-name">${this.escapeHtml(col)}</span>
                </div>
            </div>
        `).join('') : '<div class="data-list-item"><span style="color:var(--color-text-muted)">データがありません</span></div>';
    }

    addDataItem(type) {
        // ブランド・タグ・コレクションはタスク内のデータ登録画面で管理するため、ここでは編集不可
        if (['brands', 'tags', 'collections'].includes(type)) {
            alert('ブランド・タグ・コレクションは、タスク > データ登録 から管理してください。こちらは確認専用です。');
            return;
        }
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
        } else if (type === 'collections') {
            const name = document.getElementById('newCollectionName').value.trim();
            if (!name || this.dataCollections.includes(name)) return;
            this.dataCollections.push(name);
            document.getElementById('newCollectionName').value = '';
        }
        this.renderDataLists();
    }

    removeDataItem(type, key) {
        // ブランド・タグ・コレクションはタスク内のデータ登録画面で管理するため、ここでは削除不可
        if (['brands', 'tags', 'collections'].includes(type)) {
            alert('ブランド・タグ・コレクションは、タスク > データ登録 から管理してください。こちらは確認専用です。');
            return;
        }
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
        } else if (type === 'collections') {
            const idx = parseInt(key);
            if (!isNaN(idx)) this.dataCollections.splice(idx, 1);
        }
        this.renderDataLists();
    }

    switchSizeTypeTab(type) {
        document.querySelectorAll('.size-type-tab').forEach(t => t.classList.toggle('active', t.dataset.sizeType === type));
        document.querySelectorAll('.size-type-content').forEach(c => c.classList.toggle('active', c.id === 'size-type-' + type));
    }

    addSizeItem(type) {
        if (type === 'shoes') {
            const name = document.getElementById('newShoeSizeName').value.trim();
            const code = document.getElementById('newShoeSizeCode').value.trim().toUpperCase();
            const uk = document.getElementById('newShoeSizeUk').value.trim();
            const us = document.getElementById('newShoeSizeUs').value.trim();
            if (!name || !code) return alert('サイズ名とコードを入力してください');
            if (this.skuMaps.size[name]) return alert(`サイズ「${name}」は既に登録されています`);
            if (Object.values(this.skuMaps.size).includes(code)) return alert(`コード「${code}」は既に使用されています`);
            const info = { code };
            if (uk) info.uk = uk;
            if (us) info.us = us;
            this.dataSizes.shoes[name] = info;
            this.skuMaps.size[name] = code;
            document.getElementById('newShoeSizeName').value = '';
            document.getElementById('newShoeSizeCode').value = '';
            document.getElementById('newShoeSizeUk').value = '';
            document.getElementById('newShoeSizeUs').value = '';
        } else if (type === 'clothing') {
            const name = document.getElementById('newClothingSizeName').value.trim();
            const code = document.getElementById('newClothingSizeCode').value.trim().toUpperCase();
            if (!name || !code) return alert('サイズ名とコードを入力してください');
            if (this.skuMaps.size[name]) return alert(`サイズ「${name}」は既に登録されています`);
            if (Object.values(this.skuMaps.size).includes(code)) return alert(`コード「${code}」は既に使用されています`);
            this.dataSizes.clothing[name] = { code };
            this.skuMaps.size[name] = code;
            document.getElementById('newClothingSizeName').value = '';
            document.getElementById('newClothingSizeCode').value = '';
        } else if (type === 'other') {
            const name = document.getElementById('newOtherSizeName').value.trim();
            const code = document.getElementById('newOtherSizeCode').value.trim().toUpperCase();
            if (!name || !code) return alert('サイズ名とコードを入力してください');
            if (this.skuMaps.size[name]) return alert(`サイズ「${name}」は既に登録されています`);
            if (Object.values(this.skuMaps.size).includes(code)) return alert(`コード「${code}」は既に使用されています`);
            this.dataSizes.other[name] = { code };
            this.skuMaps.size[name] = code;
            document.getElementById('newOtherSizeName').value = '';
            document.getElementById('newOtherSizeCode').value = '';
        }
        this.renderDataLists();
    }

    removeSizeItem(type, key) {
        if (this.dataSizes[type]) {
            delete this.dataSizes[type][key];
            delete this.skuMaps.size[key];
        }
        this.renderDataLists();
    }

    bulkAddShoeSizes() {
        const ukBase = 0;
        const usBase = 0;
        for (let s = 14; s <= 30; s += 0.5) {
            const name = 'JP ' + (s % 1 === 0 ? String(s) : String(s));
            if (this.skuMaps.size[name]) continue;
            const code = 'JP' + String(s).replace('.', '');
            const ukVal = ukBase + (s - 14);
            const usVal = usBase + (s - 14);
            const ukStr = Number.isInteger(ukVal) ? String(ukVal) : String(ukVal);
            const usStr = Number.isInteger(usVal) ? String(usVal) : String(usVal);
            this.dataSizes.shoes[name] = { code, uk: 'UK ' + ukStr, us: 'US ' + usStr };
            this.skuMaps.size[name] = code;
        }
        this.renderDataLists();
        alert('JP 14~30 の靴サイズを一括登録しました');
    }


    exportDataJson() {
        const data = {
            brands: this.dataBrands,
            categories: this.skuMaps.category,
            colors: this.skuMaps.color,
            sizes: this.skuMaps.size,
            tags: this.dataTags,
            collections: this.dataCollections
        };
        const content = JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `data_export_${new Date().toISOString().slice(0,10)}.json`;
        link.click();
        alert('JSONファイルをダウンロードしました。data/フォルダ内のJSONファイルを更新してください。');
    }

    openOptionPicker(optionNum) {
        const name = document.getElementById(`option${optionNum}Name`).value;
        if (name === 'Size') {
            this.openSizePicker(`option${optionNum}Values`);
        } else if (name === 'Color') {
            this.openColorPicker(`option${optionNum}Values`);
        } else {
            alert('Size または Color を選択してください');
        }
    }

    openSizePicker(targetInputId) {
        this.sizePickerTarget = targetInputId;
        const current = document.getElementById(targetInputId).value.split(',').map(v => v.trim()).filter(v => v);
        this.tempSelectedSizes = new Set(current);
        document.getElementById('sizePickerModal').classList.add('active');
        this.switchSizePickerTab('shoes');
        this.renderSizeCheckboxes();
    }

    closeSizePicker() {
        document.getElementById('sizePickerModal').classList.remove('active');
        this.tempSelectedSizes.clear();
    }

    switchSizePickerTab(type) {
        document.querySelectorAll('[data-size-picker-tab]').forEach(t => t.classList.toggle('active', t.dataset.sizePickerTab === type));
        document.querySelectorAll('.size-picker-panel').forEach(p => p.style.display = p.id === `sizePicker-${type}` ? 'block' : 'none');
        this.currentSizePickerTab = type;
    }

    renderSizeCheckboxes() {
        const render = (containerId, data) => {
            const container = document.getElementById(containerId);
            const entries = Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]));
            container.innerHTML = entries.map(([name, info]) => {
                const extra = [];
                if (info.uk) extra.push(`UK: ${info.uk}`);
                if (info.us) extra.push(`US: ${info.us}`);
                const extraStr = extra.length ? ` (${extra.join(' / ')})` : '';
                return `<label class="tag-checkbox-label"><input type="checkbox" value="${this.escapeHtml(name)}" ${this.tempSelectedSizes.has(name) ? 'checked' : ''}><span>${this.escapeHtml(name)}${extraStr}</span></label>`;
            }).join('');
            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', (e) => {
                    if (e.target.checked) this.tempSelectedSizes.add(e.target.value);
                    else this.tempSelectedSizes.delete(e.target.value);
                });
            });
        };
        render('sizeCheckboxes-shoes', this.dataSizes.shoes);
        render('sizeCheckboxes-clothing', this.dataSizes.clothing);
        render('sizeCheckboxes-other', this.dataSizes.other);
    }

    applySizes() {
        const selected = [...this.tempSelectedSizes].sort((a, b) => {
            const n1 = parseFloat(a.replace(/[^0-9.]/g, '')) || 0;
            const n2 = parseFloat(b.replace(/[^0-9.]/g, '')) || 0;
            if (n1 && n2) return n1 - n2;
            return a.localeCompare(b);
        });
        document.getElementById(this.sizePickerTarget).value = selected.join(', ');
        this.closeSizePicker();
        this.renderVariantInventory();
    }

    openColorPicker(targetInputId) {
        this.colorPickerTarget = targetInputId;
        const current = document.getElementById(targetInputId).value.split(',').map(v => v.trim()).filter(v => v);
        this.tempSelectedColors = new Set(current);
        document.getElementById('colorPickerModal').classList.add('active');
        this.renderColorCheckboxes();
    }

    closeColorPicker() {
        document.getElementById('colorPickerModal').classList.remove('active');
        this.tempSelectedColors.clear();
    }

    renderColorCheckboxes() {
        const container = document.getElementById('colorCheckboxes');
        const entries = Object.entries(this.skuMaps.color).sort((a, b) => a[0].localeCompare(b[0]));
        container.innerHTML = entries.map(([name, code]) => `
            <label class="tag-checkbox-label">
                <input type="checkbox" value="${this.escapeHtml(name)}" ${this.tempSelectedColors.has(name) ? 'checked' : ''}>
                <span>${this.escapeHtml(name)} <span style="color:var(--color-text-muted);font-size:12px;">(${this.escapeHtml(code)})</span></span>
            </label>
        `).join('');
        container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                if (e.target.checked) this.tempSelectedColors.add(e.target.value);
                else this.tempSelectedColors.delete(e.target.value);
            });
        });
    }

    applyColors() {
        const selected = [...this.tempSelectedColors].sort((a, b) => a.localeCompare(b));
        document.getElementById(this.colorPickerTarget).value = selected.join(', ');
        this.closeColorPicker();
        this.renderVariantInventory();
    }

    openBrandPicker() {
        document.getElementById('brandPickerModal').classList.add('active');
        document.getElementById('brandSearchInput').value = '';
        this.renderBrandPicker('');
        document.getElementById('brandSearchInput').focus();
    }

    closeBrandPicker() {
        document.getElementById('brandPickerModal').classList.remove('active');
    }

    renderBrandPicker(filter) {
        const container = document.getElementById('brandPickerList');
        const entries = Object.entries(this.dataBrands).sort((a, b) => a[0].localeCompare(b[0]));
        const filtered = filter ? entries.filter(([name]) => name.toLowerCase().includes(filter.toLowerCase())) : entries;
        container.innerHTML = filtered.map(([name, info]) => `
            <div class="data-list-item data-picker-item" onclick="app.selectBrand('${this.escapeHtml(name).replace(/'/g, "\\'")}','${this.escapeHtml(info.code).replace(/'/g, "\\'")}')">
                <div class="data-list-item-info">
                    <span class="data-list-item-name">${this.escapeHtml(name)}</span>
                    <span class="data-list-item-code">${this.escapeHtml(info.code)}</span>
                </div>
            </div>
        `).join('');
    }

    filterBrandPicker() {
        const filter = document.getElementById('brandSearchInput').value.trim();
        this.renderBrandPicker(filter);
    }

    selectBrand(name, code) {
        document.getElementById('brandName').value = name;
        document.getElementById('brandCode').value = code;
        document.getElementById('vendor').value = name;
        this.updateSkuPreview();
        this.closeBrandPicker();
    }

    openCategoryPicker() {
        this.categoryPickerTarget = 'skuCategory';
        document.getElementById('categoryPickerModal').classList.add('active');
        document.getElementById('categorySearchInput').value = '';
        this.renderCategoryPicker('');
        document.getElementById('categorySearchInput').focus();
    }

    openProductTypePicker() {
        this.categoryPickerTarget = 'productType';
        document.getElementById('categoryPickerModal').classList.add('active');
        document.getElementById('categorySearchInput').value = '';
        this.renderCategoryPicker('');
        document.getElementById('categorySearchInput').focus();
    }

    closeCategoryPicker() {
        document.getElementById('categoryPickerModal').classList.remove('active');
    }

    renderCategoryPicker(filter) {
        const container = document.getElementById('categoryPickerList');
        const entries = Object.entries(this.skuMaps.category).sort((a, b) => a[0].localeCompare(b[0]));
        const filtered = filter ? entries.filter(([name]) => name.toLowerCase().includes(filter.toLowerCase())) : entries;
        container.innerHTML = filtered.map(([name, code]) => `
            <div class="data-list-item data-picker-item" onclick="app.selectCategory('${this.escapeHtml(name).replace(/'/g, "\\'")}')">
                <div class="data-list-item-info">
                    <span class="data-list-item-name">${this.escapeHtml(name)}</span>
                    <span class="data-list-item-code">${this.escapeHtml(code)}</span>
                </div>
            </div>
        `).join('');
    }

    filterCategoryPicker() {
        const filter = document.getElementById('categorySearchInput').value.trim();
        this.renderCategoryPicker(filter);
    }

    selectCategory(name) {
        if (this.categoryPickerTarget === 'productType') {
            document.getElementById('productType').value = name;
        } else {
            document.getElementById('skuCategory').value = name;
            this.updateSkuPreview();
        }
        this.closeCategoryPicker();
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
        this.seoDescriptionManuallyEdited = false;
        this.currentEditingVariantImages = null;
        document.getElementById('descriptionOther').value = '';
        document.getElementById('modelInfo').value = '';
        document.getElementById('measurementType').value = '';
        document.getElementById('measurementSection').style.display = 'none';
        document.getElementById('measurementTableWrapper').innerHTML = '';
        document.getElementById('descriptionPreview').innerHTML = '';
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
        document.getElementById('descriptionOther').value = product.descriptionOther || '';
        document.getElementById('modelInfo').value = product.modelInfo || '';
        document.getElementById('measurementType').value = product.measurementType || '';
        this.renderMeasurementTable(product.measurementRows || []);
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
        this.seoDescriptionManuallyEdited = !!(product.seoDescription && product.seoDescription.trim());
        document.getElementById('seoTitle').value = product.seoTitle || '';
        document.getElementById('seoDescription').value = product.seoDescription || '';
        this.updateSeoFields();
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
        document.getElementById('collections').value = product.collections || '';
        if (product.images) {
            this.uploadedImages = [...product.images];
            this.renderUploadedImages();
        }
        this.currentEditingVariantInventory = product.variantInventory || null;
        this.updateSkuPreview();
        this.renderVariantInventory();
        this.updateDescriptionPreview();
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
        const variantImages = {};
        const section = document.getElementById('variantInventorySection');
        if (section && section.style.display !== 'none') {
            document.querySelectorAll('.variant-qty-input').forEach(input => {
                variantInventory[input.dataset.key] = parseInt(input.value) || 0;
            });
            document.querySelectorAll('.variant-image-input').forEach(input => {
                const url = input.value.trim();
                if (url) {
                    variantImages[input.dataset.key] = url;
                    // Add to uploadedImages if not already present
                    const exists = this.uploadedImages.some(img => img.data === url);
                    if (!exists) {
                        this.uploadedImages.push({ id: `img_${Date.now()}_${this.imageCounter++}`, name: 'Variant Image', data: url });
                    }
                }
            });
        }
        const simpleQty = parseInt(document.getElementById('inventoryQty').value) || 0;

        const product = {
            id: this.currentEditingId || `prod_${Date.now()}`,
            title: document.getElementById('title').value,
            handle: handleInput || baseSku,
            description: document.getElementById('description').value,
            descriptionOther: document.getElementById('descriptionOther').value,
            modelInfo: document.getElementById('modelInfo').value,
            measurementType: document.getElementById('measurementType').value,
            measurementRows: this.getMeasurementData(),
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
            collections: document.getElementById('collections').value,
            images: [...this.uploadedImages],
            variantImages: Object.keys(variantImages).length > 0 ? variantImages : null
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
        const allTags = [...new Set([...this.dataTags, ...this.customTags])].sort();
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
        if (!this.dataTags.includes(name) && !this.customTags.includes(name)) {
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

    openCollectionPicker() {
        const current = document.getElementById('collections').value.trim();
        this.tempSelectedCollection = current;
        document.getElementById('collectionPickerModal').classList.add('active');
        this.renderCollectionRadios();
    }

    closeCollectionPicker() {
        document.getElementById('collectionPickerModal').classList.remove('active');
        this.tempSelectedCollection = '';
    }

    renderCollectionRadios() {
        const container = document.getElementById('collectionCheckboxes');
        const allCollections = [...new Set([...this.dataCollections])].sort((a, b) => a.localeCompare(b));
        container.innerHTML = allCollections.map(tag => `
            <label class="tag-checkbox-label">
                <input type="radio" name="collectionRadio" value="${this.escapeHtml(tag)}" ${this.tempSelectedCollection === tag ? 'checked' : ''}>
                <span>${this.escapeHtml(tag)}</span>
            </label>
        `).join('');
        container.querySelectorAll('input[type="radio"]').forEach(rb => {
            rb.addEventListener('change', (e) => {
                if (e.target.checked) this.tempSelectedCollection = e.target.value;
            });
        });
    }

    addNewCollection() {
        const input = document.getElementById('newCollectionInput');
        const name = input.value.trim();
        if (!name) return;
        if (!this.dataCollections.includes(name)) {
            this.dataCollections.push(name);
        }
        this.tempSelectedCollection = name;
        input.value = '';
        this.renderCollectionRadios();
    }

    applyCollections() {
        document.getElementById('collections').value = this.tempSelectedCollection;
        this.closeCollectionPicker();
    }

    openVariantImagePicker(variantKey) {
        this.variantImagePickerTarget = variantKey;
        document.getElementById('variantImagePickerModal').classList.add('active');
        this.renderVariantImageGrid();
    }

    closeVariantImagePicker() {
        document.getElementById('variantImagePickerModal').classList.remove('active');
        this.variantImagePickerTarget = null;
    }

    renderVariantImageGrid() {
        const grid = document.getElementById('variantImageGrid');
        const currentUrl = this.currentEditingVariantImages && this.currentEditingVariantImages[this.variantImagePickerTarget];
        if (this.uploadedImages.length === 0) {
            grid.innerHTML = '<div style="color: var(--color-text-muted); text-align: center; padding: 20px;">商品画像がアップロードされていません。先に商品画像セクションからCloudinaryへ画像をアップロードしてください。</div>';
            return;
        }
        grid.innerHTML = this.uploadedImages.map(img => `
            <div class="variant-image-item ${img.data === currentUrl ? 'selected' : ''}" data-url="${this.escapeHtml(img.data)}">
                <img src="${this.escapeHtml(img.data)}" alt="${this.escapeHtml(img.name)}">
                <span class="variant-image-name">${this.escapeHtml(img.name)}</span>
            </div>
        `).join('');
        grid.querySelectorAll('.variant-image-item').forEach(item => {
            item.addEventListener('click', () => {
                this.selectVariantImage(item.dataset.url);
            });
        });
    }

    selectVariantImage(url) {
        if (!this.variantImagePickerTarget) return;
        if (!this.currentEditingVariantImages) this.currentEditingVariantImages = {};
        this.currentEditingVariantImages[this.variantImagePickerTarget] = url;
        // Add to uploadedImages if not already present
        const exists = this.uploadedImages.some(img => img.data === url);
        if (!exists) {
            this.uploadedImages.push({ id: `img_${Date.now()}_${this.imageCounter++}`, name: 'Variant Image', data: url });
            this.renderUploadedImages();
        }
        this.closeVariantImagePicker();
        this.renderVariantInventory();
    }

    clearVariantImage() {
        if (!this.variantImagePickerTarget) return;
        if (this.currentEditingVariantImages) {
            delete this.currentEditingVariantImages[this.variantImagePickerTarget];
        }
        this.closeVariantImagePicker();
        this.renderVariantInventory();
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
            const existingQty = this.currentEditingVariantInventory && this.currentEditingVariantInventory[v.key];
            const qty = existingQty !== undefined ? existingQty : (this.currentEditingVariantInventory ? 0 : parseInt(document.getElementById('inventoryQty').value) || 0);
            const existingImg = this.currentEditingVariantImages && this.currentEditingVariantImages[v.key];
            const imgUrl = existingImg || '';
            const imgPreview = imgUrl ? `<img src="${this.escapeHtml(imgUrl)}" class="variant-image-preview" alt="">` : '';
            const imageCell = `
                <td>
                    <div class="variant-image-cell">
                        ${imgPreview}
                        <input type="hidden" class="variant-image-input" data-key="${this.escapeHtml(v.key)}" value="${this.escapeHtml(imgUrl)}">
                        <button type="button" class="btn btn-secondary variant-image-select-btn" data-key="${this.escapeHtml(v.key)}">選択</button>
                        ${imgUrl ? `<button type="button" class="btn btn-danger variant-image-clear-btn" data-key="${this.escapeHtml(v.key)}" style="padding: 4px 8px; font-size: 12px;">クリア</button>` : ''}
                    </div>
                </td>
            `;
            return `<tr>${cells.join('')}<td><input type="number" class="variant-qty-input" data-key="${this.escapeHtml(v.key)}" value="${qty}" min="0"></td>${imageCell}</tr>`;
        }).join('');

        container.innerHTML = `
            <table class="variant-inventory-table">
                <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}<th>在庫数</th><th>画像</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        container.querySelectorAll('.variant-image-select-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.openVariantImagePicker(e.target.dataset.key));
        });
        container.querySelectorAll('.variant-image-clear-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const key = e.target.dataset.key;
                if (this.currentEditingVariantImages) delete this.currentEditingVariantImages[key];
                this.renderVariantInventory();
            });
        });
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
        const defaultName = `products_export_${new Date().toISOString().slice(0,10)}.csv`;
        const customName = document.getElementById('exportFilename').value.trim();
        link.download = customName.endsWith('.csv') ? customName : (customName ? customName + '.csv' : defaultName);
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
                row[2] = this.escapeCsv(this.generateDescriptionHTML(product));
                row[3] = this.escapeCsv(product.vendor);
                row[4] = this.escapeCsv(product.shopifyCategory || product.productCategory || '');
                row[5] = this.escapeCsv(product.productType);
                row[6] = this.escapeCsv(product.tags);
                row[7] = product.published ? 'TRUE' : 'FALSE';
                row[41] = this.escapeCsv(product.seoTitle);
                row[42] = this.escapeCsv(product.seoDescription);
                row[45] = this.escapeCsv(product.googleShoppingCategory || product.productCategory || '');
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
            // First image goes on first variant row
            if (index === 0 && product.images && product.images.length > 0) {
                const ext0 = this.getExternalImageUrl(product.images[0].data);
                if (ext0) { row[36] = this.escapeCsv(ext0); row[37] = '1'; }
            }
            // Per-variant image
            if (product.variantImages && variant.key && product.variantImages[variant.key]) {
                const varImgUrl = this.getExternalImageUrl(product.variantImages[variant.key]);
                if (varImgUrl) row[39] = this.escapeCsv(varImgUrl);
            }
            row[40] = product.giftCard ? 'TRUE' : 'FALSE';
            row[58] = this.escapeCsv(product.brandCode || '');
            row[59] = this.escapeCsv(product.skuCategory || '');
            row[60] = this.escapeCsv(product.skuSerial || '');
            row[61] = this.escapeCsv(product.season || '');
            row[62] = this.escapeCsv(product.brandName || '');
            // First collection on first variant row
            if (index === 0 && product.collections) {
                const collection = product.collections.split(',').map(c => c.trim()).filter(c => c)[0];
                if (collection) row[63] = this.escapeCsv(collection);
            }
            rows.push(row);
        });

        // Add additional image rows (2nd, 3rd, etc.)
        if (product.images && product.images.length > 1) {
            for (let i = 1; i < product.images.length; i++) {
                const ext = this.getExternalImageUrl(product.images[i].data);
                if (ext) {
                    const imgRow = new Array(this.csvHeaders.length).fill('');
                    imgRow[1] = this.escapeCsv(product.handle);
                    imgRow[36] = this.escapeCsv(ext);
                    imgRow[37] = String(i + 1);
                    rows.push(imgRow);
                }
            }
        }


        if (rows.length === 0) {
            const row = new Array(this.csvHeaders.length).fill('');
            row[0] = this.escapeCsv(product.title); row[1] = this.escapeCsv(product.handle); row[2] = this.escapeCsv(this.generateDescriptionHTML(product));
            row[3] = this.escapeCsv(product.vendor); row[4] = this.escapeCsv(product.shopifyCategory || product.productCategory || ''); row[5] = this.escapeCsv(product.productType);
            row[7] = product.published ? 'TRUE' : 'FALSE'; row[8] = product.status; row[9] = this.escapeCsv(product.sku);
            row[20] = product.price; row[23] = product.chargeTax ? 'TRUE' : 'FALSE'; row[29] = 'shopify';
            row[30] = product.inventoryQty; row[31] = product.inventoryPolicy.toUpperCase(); row[32] = product.weight;
            row[34] = product.requiresShipping ? 'TRUE' : 'FALSE'; row[35] = product.fulfillmentService;
            if (product.images && product.images.length > 0) {
                const ext0 = this.getExternalImageUrl(product.images[0].data);
                if (ext0) { row[36] = this.escapeCsv(ext0); row[37] = '1'; }
            }
            row[58] = this.escapeCsv(product.brandCode || '');
            row[59] = this.escapeCsv(product.skuCategory || '');
            row[60] = this.escapeCsv(product.skuSerial || '');
            row[61] = this.escapeCsv(product.season || '');
            row[62] = this.escapeCsv(product.brandName || '');
            if (product.collections) {
                const collection = product.collections.split(',').map(c => c.trim()).filter(c => c)[0];
                if (collection) row[63] = this.escapeCsv(collection);
            }
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
            variants.push({ option1: '', option2: '', option3: '', sku: sku || product.sku || '', inventoryQty: product.inventoryQty || 0, key: '' });
            return variants;
        }
        if (opt1.length > 0) {
            opt1.forEach(v1 => {
                if (opt2.length > 0) opt2.forEach(v2 => opt3.length > 0 ? opt3.forEach(v3 => {
                    const key = buildKey(v1, v2, v3);
                    variants.push({ option1: v1, option2: v2, option3: v3, sku: genSku({option1:v1,option2:v2,option3:v3}), inventoryQty: getQty(key), key });
                }) : variants.push({ option1: v1, option2: v2, option3: '', sku: genSku({option1:v1,option2:v2,option3:''}), inventoryQty: getQty(buildKey(v1, v2, '')), key: buildKey(v1, v2, '') }));
                else if (opt3.length > 0) opt3.forEach(v3 => variants.push({ option1: v1, option2: '', option3: v3, sku: genSku({option1:v1,option2:'',option3:v3}), inventoryQty: getQty(buildKey(v1, '', v3)), key: buildKey(v1, '', v3) }));
                else variants.push({ option1: v1, option2: '', option3: '', sku: genSku({option1:v1,option2:'',option3:''}), inventoryQty: getQty(buildKey(v1, '', '')), key: buildKey(v1, '', '') });
            });
        } else if (opt2.length > 0) {
            opt2.forEach(v2 => opt3.length > 0 ? opt3.forEach(v3 => variants.push({ option1: '', option2: v2, option3: v3, sku: genSku({option1:'',option2:v2,option3:v3}), inventoryQty: getQty(buildKey('', v2, v3)), key: buildKey('', v2, v3) })) : variants.push({ option1: '', option2: v2, option3: '', sku: genSku({option1:'',option2:v2,option3:''}), inventoryQty: getQty(buildKey('', v2, '')), key: buildKey('', v2, '') }));
        } else if (opt3.length > 0) opt3.forEach(v3 => variants.push({ option1: '', option2: '', option3: v3, sku: genSku({option1:'',option2:'',option3:v3}), inventoryQty: getQty(buildKey('', '', v3)), key: buildKey('', '', v3) }));
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
    if (document.getElementById('policyMain')) {
        window.policyManager = new PolicyManager();
    }
    if (document.getElementById('taskMenu')) {
        window.taskManager = new TaskManager();
    }
});

// ============================================================
// Policy Manager for client review & approval
// ============================================================
class PolicyManager {
    constructor() {
        this.currentKey = null;
        this.storageKey = 'policyManagerData';
        this.loadData();
        this.init();
    }

    init() {
        this.bindEvents();
        this.renderTaskList();
    }

    bindEvents() {
        // トップページのカード
        document.querySelectorAll('#topPage .top-menu-card').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.dataset.target;
                if (target === 'csv') this.showSection('csv');
                else if (target === 'task') this.showSection('task');
            });
        });

        // タスクメニューのカード
        document.querySelectorAll('#taskMenu .top-menu-card').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.dataset.target;
                if (target === 'policy') this.showSection('policy');
            });
        });

        // 戻るボタン
        document.getElementById('csvBackBtn').addEventListener('click', () => this.showSection('top'));
        document.getElementById('taskBackBtn').addEventListener('click', () => this.showSection('top'));
        document.getElementById('policyBackBtn').addEventListener('click', () => this.showSection('task'));
        document.getElementById('policyMenuBackBtn')?.addEventListener('click', () => this.showSection('task'));

        document.getElementById('policySaveDraftBtn').addEventListener('click', () => this.saveDraft());
        document.getElementById('policyApproveBtn').addEventListener('click', () => this.approve());
    }

    loadData() {
        this.data = JSON.parse(localStorage.getItem(this.storageKey) || '{}');
    }

    saveData() {
        localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }

    showSection(section) {
        const topPage = document.getElementById('topPage');
        const taskMenu = document.getElementById('taskMenu');
        const dataMenu = document.getElementById('dataMenu');
        const csvMain = document.getElementById('csvMain');
        const policyMain = document.getElementById('policyMain');
        const skuRuleMain = document.getElementById('skuRuleMain');
        const brandMain = document.getElementById('brandMain');
        const tagMain = document.getElementById('tagMain');
        const collectionMain = document.getElementById('collectionMain');
        const notificationMain = document.getElementById('notificationMain');

        [topPage, taskMenu, dataMenu, csvMain, policyMain, skuRuleMain, brandMain, tagMain, collectionMain, notificationMain].forEach(el => {
            if (el) el.style.display = 'none';
        });

        if (section === 'top') {
            topPage.style.display = 'block';
        } else if (section === 'task') {
            taskMenu.style.display = 'block';
        } else if (section === 'csv') {
            csvMain.style.display = 'block';
        } else if (section === 'policy') {
            policyMain.style.display = 'block';
            this.showTaskList();
        }
    }

    showTaskList() {
        document.getElementById('policyTaskList').style.display = 'block';
        document.getElementById('policyEditor').style.display = 'none';
        this.currentKey = null;
        this.renderTaskList();
    }

    renderTaskList() {
        const container = document.getElementById('policyTaskCards');
        container.innerHTML = Object.values(POLICY_TEMPLATES).map(t => {
            const status = this.getStatus(t.key);
            return `
                <div class="policy-task-card" data-key="${t.key}">
                    <div class="policy-task-status">${status.approved ? '✅ 承認済み' : '⏳ 未承認'}</div>
                    <h3>${this.escapeHtml(t.title)}</h3>
                    <p>${this.escapeHtml(t.description)}</p>
                    ${status.approved ? `<p class="policy-task-meta">最終承認: ${this.escapeHtml(status.lastApproved)} / バージョン: v${status.versions}</p>` : ''}
                    <button class="btn btn-primary policy-edit-btn" data-key="${t.key}">編集・確認</button>
                </div>
            `;
        }).join('');
        container.querySelectorAll('.policy-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.openEditor(e.target.dataset.key));
        });
    }

    getStatus(key) {
        return this.data[key]?.status || { approved: false, lastApproved: null, versions: 0 };
    }

    openEditor(key) {
        this.currentKey = key;
        const tmpl = POLICY_TEMPLATES[key];
        document.getElementById('policyTaskList').style.display = 'none';
        document.getElementById('policyEditor').style.display = 'block';
        document.getElementById('policyEditorTitle').textContent = tmpl.title;
        this.renderForm(tmpl);
        this.updatePreview();
    }

    renderForm(tmpl) {
        const container = document.getElementById('policyFormContainer');
        const saved = this.data[tmpl.key]?.values || {};
        const contactValues = this.data.contact?.values || {};
        const fieldsHtml = tmpl.fields.map(f => {
            const value = saved[f.key] !== undefined ? saved[f.key] : (contactValues[f.key] !== undefined ? contactValues[f.key] : f.default);
            const disabledAttr = f.disabled ? 'disabled' : '';
            const disabledClass = f.disabled ? ' policy-input-disabled' : '';
            let input = '';
            if (f.type === 'textarea') {
                input = `<textarea class="policy-input${disabledClass}" id="policyField_${f.key}" data-preview-key="${f.key}" rows="4" ${disabledAttr}>${this.escapeHtml(value)}</textarea>`;
            } else if (f.type === 'select') {
                input = `<select class="policy-input${disabledClass}" id="policyField_${f.key}" data-preview-key="${f.key}" ${disabledAttr}>${f.options.map(o => `<option value="${this.escapeHtml(o.value)}" ${o.value === value ? 'selected' : ''}>${this.escapeHtml(o.label)}</option>`).join('')}</select>`;
            } else if (f.type === 'checkbox') {
                input = `<label class="policy-checkbox-label"><input type="checkbox" id="policyField_${f.key}" data-preview-key="${f.key}" ${value ? 'checked' : ''} ${disabledAttr}> ${this.escapeHtml(f.label)}</label>`;
            } else {
                input = `<input class="policy-input${disabledClass}" type="${f.type}" id="policyField_${f.key}" data-preview-key="${f.key}" value="${this.escapeHtml(value)}" ${disabledAttr}>`;
            }
            return `
                <div class="policy-form-group" data-key="${f.key}">
                    <label for="policyField_${f.key}">${this.escapeHtml(f.label)}</label>
                    ${f.help ? `<p class="policy-field-help">${this.escapeHtml(f.help)}</p>` : ''}
                    ${input}
                </div>
            `;
        }).join('');

        const revisionNote = this.data[tmpl.key]?.revisionNote || '';
        const revisionHtml = `
            <div class="policy-form-group policy-revision-group">
                <label for="policyRevisionNote">内容の訂正依頼</label>
                <p class="policy-field-help">プレビューには反映されません。HTMLファイルの最上部に記載され、ファイル名にも反映されます。訂正依頼がない場合は空欄のまま承認してください。</p>
                <textarea class="policy-input" id="policyRevisionNote" rows="3" placeholder="例：第3条の表現をもう少し丁寧に修正してください">${this.escapeHtml(revisionNote)}</textarea>
            </div>
        `;

        container.innerHTML = fieldsHtml + revisionHtml;

        tmpl.fields.forEach(f => {
            if (f.disabled) return;
            const el = document.getElementById(`policyField_${f.key}`);
            if (el) {
                el.addEventListener('input', () => this.updatePreview());
                if (f.type === 'checkbox') el.addEventListener('change', () => this.updatePreview());
                el.addEventListener('focus', () => this.highlightPreview(f.key));
                el.addEventListener('blur', () => this.clearPreviewHighlight());
            }
        });
    }

    highlightPreview(key) {
        if (!this.currentKey) return;
        this.updatePreview();
        const value = this.getFieldValues()[key];
        if (value === '' || value === null || value === undefined || typeof value === 'boolean') return;

        const preview = document.getElementById('policyPreview');
        const walker = document.createTreeWalker(preview, NodeFilter.SHOW_TEXT);
        const textNodes = [];
        while (walker.nextNode()) textNodes.push(walker.currentNode);

        textNodes.forEach(node => {
            const index = node.nodeValue.indexOf(value);
            if (index === -1) return;
            const fragment = document.createDocumentFragment();
            fragment.append(document.createTextNode(node.nodeValue.slice(0, index)));
            const highlight = document.createElement('span');
            highlight.className = 'policy-preview-part policy-preview-active';
            highlight.textContent = value;
            fragment.append(highlight, document.createTextNode(node.nodeValue.slice(index + value.length)));
            node.parentNode.replaceChild(fragment, node);
        });
    }

    clearPreviewHighlight() {
        this.updatePreview();
    }

    getFieldValues() {
        const tmpl = POLICY_TEMPLATES[this.currentKey];
        const values = {};
        tmpl.fields.forEach(f => {
            const el = document.getElementById(`policyField_${f.key}`);
            if (!el) return;
            if (f.type === 'checkbox') {
                values[f.key] = el.checked;
            } else {
                values[f.key] = el.value;
            }
        });
        return values;
    }

    buildHtml(tmpl, values) {
        let html = tmpl.template;
        if (values.NON_RETURNABLE_ITEMS) {
            const items = values.NON_RETURNABLE_ITEMS.split('\n').filter(s => s.trim()).map(s => `<li>${this.escapeHtml(s.trim())}</li>`).join('\n  ');
            html = html.replace('{{NON_RETURNABLE_ITEMS}}', items);
        }
        Object.keys(values).forEach(key => {
            const regex = new RegExp(`{{${key}}}`, 'g');
            let val = values[key];
            if (typeof val === 'string') {
                val = this.escapeHtml(val);
            } else if (typeof val === 'boolean') {
                val = val ? 'はい' : 'いいえ';
            }
            html = html.replace(regex, val);
        });
        return html;
    }

    updatePreview() {
        if (!this.currentKey) return;
        const tmpl = POLICY_TEMPLATES[this.currentKey];
        const values = this.getFieldValues();
        const html = this.buildHtml(tmpl, values);
        document.getElementById('policyPreview').innerHTML = html;
    }

    saveDraft() {
        const tmpl = POLICY_TEMPLATES[this.currentKey];
        if (!this.data[tmpl.key]) this.data[tmpl.key] = { status: { approved: false }, values: {} };
        this.data[tmpl.key].values = this.getFieldValues();
        const revisionEl = document.getElementById('policyRevisionNote');
        this.data[tmpl.key].revisionNote = revisionEl ? revisionEl.value.trim() : '';
        if (tmpl.key === 'contact') {
            this.syncContactValues();
        }
        this.saveData();
        alert('下書きを保存しました');
    }

    syncContactValues() {
        const contactValues = this.data.contact?.values || {};
        const sharedKeys = ['COMPANY_NAME', 'ADDRESS', 'PHONE', 'EMAIL'];
        Object.keys(POLICY_TEMPLATES).forEach(key => {
            if (key === 'contact') return;
            const fieldKeys = POLICY_TEMPLATES[key].fields.map(f => f.key);
            if (!this.data[key]) this.data[key] = { status: { approved: false }, values: {} };
            sharedKeys.forEach(sk => {
                if (fieldKeys.includes(sk) && contactValues[sk] !== undefined) {
                    this.data[key].values[sk] = contactValues[sk];
                }
            });
        });
    }

    approve() {
        const tmpl = POLICY_TEMPLATES[this.currentKey];
        const values = this.getFieldValues();
        const isEmpty = v => v === '' || v === null || v === undefined;
        const emptyLabels = tmpl.fields.filter(f => !f.disabled && isEmpty(values[f.key])).map(f => f.label);
        if (emptyLabels.length > 0) {
            if (!confirm(`未入力の項目があります：\n${emptyLabels.join('、')}\n\nこのままで承認しますか？`)) return;
        }
        if (!this.data[tmpl.key]) this.data[tmpl.key] = { status: {}, values: {} };
        this.data[tmpl.key].values = values;
        const revisionEl = document.getElementById('policyRevisionNote');
        const revisionNote = revisionEl ? revisionEl.value.trim() : '';
        this.data[tmpl.key].revisionNote = revisionNote;
        if (tmpl.key === 'contact') {
            this.syncContactValues();
        }
        const version = (this.data[tmpl.key].status.versions || 0) + 1;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        this.data[tmpl.key].status = { approved: true, lastApproved: new Date().toLocaleString('ja-JP'), versions: version };
        this.saveData();

        const html = this.buildHtml(tmpl, values);
        const revisionComment = revisionNote ? `<!-- 訂正依頼: ${this.escapeHtml(revisionNote)} -->\n` : '';
        const fullHtml = `<!DOCTYPE html>\n<html lang="ja">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>${this.escapeHtml(tmpl.title)}</title>\n<style>\nbody { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans JP", sans-serif; line-height: 1.7; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 40px 20px; background: #fff; }\nh2 { font-size: 1.5em; margin-top: 2em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.3em; }\nh3 { font-size: 1.1em; margin-top: 1.5em; }\nul { padding-left: 1.5em; }\ntable { width: 100%; border-collapse: collapse; }\nth, td { padding: 10px; border-bottom: 1px solid #e0e0e0; vertical-align: top; }\nth { width: 30%; }\na { color: #1a1a1a; }\n</style>\n</head>\n<body>\n${revisionComment}${html}\n</body>\n</html>`;

        const revisionSuffix = revisionNote ? `_修正依頼_${this.sanitizeFilename(revisionNote.slice(0, 20))}` : '';
        const serverFilename = `${tmpl.filenamePrefix}${revisionSuffix}_v${version}_${timestamp}.html`;
        const localFilename = `${tmpl.filenamePrefix}_local${revisionSuffix}_v${version}_${timestamp}.html`;

        const downloadLocal = confirm(`生成したHTMLは提出用サーバーにアップロードされます。\nローカルにもダウンロードしますか？`);
        if (downloadLocal) {
            const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = localFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        sendToGas({
            type: 'ポリシー',
            action: '承認・HTML生成',
            itemName: tmpl.title,
            detail: `ファイル名: ${serverFilename}`,
            saveToDrive: {
                filename: serverFilename,
                content: fullHtml,
                mimeType: 'text/html'
            }
        });

        alert(`「${tmpl.title}」を承認しました。\n提出用サーバーにアップロードしました。`);
        this.showTaskList();
    }

    sanitizeFilename(text) {
        if (!text) return '';
        return String(text).replace(/[\\/:*?"<>|\s]/g, '_').slice(0, 20);
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
}

// Default Google Apps Script config for email notifications.
// After deploying the GAS web app, set the URL here so all users share it.
const GAS_CONFIG = {
    url: 'https://script.google.com/macros/s/AKfycbylwrpxSaN5hxMXOpPrU4jFlqQkeikQ16vRIr5y4WyhO4QZgMAgNb4CQ3L3r-conBqw2w/exec',
    token: 'fullgram-portal-token-2026',
    toEmail: 'tamagon123@gmail.com'
};
const SETTINGS_PASSWORD = '0126';

async function sendToGas(payload) {
    const settings = (window.taskManager && window.taskManager.gasSettings) || {};
    const url = settings.url || GAS_CONFIG.url;
    const token = settings.token || GAS_CONFIG.token;
    if (!url) return;
    try {
        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, token })
        });
    } catch (e) {
        console.error('GAS send failed:', e);
    }
}

// ============================================================
// Task Manager for SKU rules and data management
// ============================================================
class TaskManager {
    constructor() {
        this.loadData();
        this.loadJsonFiles().then(() => {
            this.init();
        });
    }

    loadData() {
        this.brands = JSON.parse(localStorage.getItem('taskManagerData_brands') || 'null');
        this.tags = JSON.parse(localStorage.getItem('taskManagerData_tags') || 'null');
        this.collections = JSON.parse(localStorage.getItem('taskManagerData_collections') || 'null');
        this.skuRuleChecks = JSON.parse(localStorage.getItem('taskManagerData_skuRuleChecks') || '{}');
        this.gasSettings = JSON.parse(localStorage.getItem('taskManagerData_gasSettings') || '{}');
    }

    saveData() {
        localStorage.setItem('taskManagerData_brands', JSON.stringify(this.brands));
        localStorage.setItem('taskManagerData_tags', JSON.stringify(this.tags));
        localStorage.setItem('taskManagerData_collections', JSON.stringify(this.collections));
        localStorage.setItem('taskManagerData_skuRuleChecks', JSON.stringify(this.skuRuleChecks));
        localStorage.setItem('taskManagerData_gasSettings', JSON.stringify(this.gasSettings));
    }

    async loadJsonFiles() {
        try {
            const [brands, tags, collections] = await Promise.all([
                fetch('data/brands.json').then(r => r.json()).catch(() => ({})),
                fetch('data/tags.json').then(r => r.json()).catch(() => ({ tags: [] })),
                fetch('data/collections.json').then(r => r.json()).catch(() => ({ collections: [] }))
            ]);
            if (!this.brands) this.brands = brands;
            if (!this.tags) this.tags = tags;
            if (!this.collections) this.collections = collections;
        } catch (e) {
            console.error('Failed to load data files:', e);
            if (!this.brands) this.brands = {};
            if (!this.tags) this.tags = { tags: [] };
            if (!this.collections) this.collections = { collections: [] };
        }
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        document.querySelectorAll('#taskMenu .top-menu-card').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.dataset.target;
                if (target === 'policy') window.policyManager.showSection('policy');
                else if (target === 'skuRule') this.showSection('skuRule');
                else if (target === 'dataMenu') this.showSection('dataMenu');
            });
        });

        document.querySelectorAll('#dataMenu .top-menu-card').forEach(card => {
            card.addEventListener('click', () => {
                const target = card.dataset.target;
                if (target === 'brand') this.showSection('brand');
                else if (target === 'tag') this.showSection('tag');
                else if (target === 'collection') this.showSection('collection');
            });
        });

        document.getElementById('skuRuleBackBtn').addEventListener('click', () => this.showSection('taskMenu'));
        document.getElementById('dataMenuBackBtn').addEventListener('click', () => this.showSection('taskMenu'));
        document.getElementById('dataMenuSettingsBtn')?.addEventListener('click', () => {
            const input = prompt('通知設定画面を開くにはパスワードを入力してください');
            if (input === SETTINGS_PASSWORD) {
                this.showSection('notification');
            } else if (input !== null) {
                alert('パスワードが正しくありません');
            }
        });
        document.getElementById('brandBackBtn').addEventListener('click', () => this.showSection('dataMenu'));
        document.getElementById('tagBackBtn').addEventListener('click', () => this.showSection('dataMenu'));
        document.getElementById('collectionBackBtn').addEventListener('click', () => this.showSection('dataMenu'));
        document.getElementById('notificationBackBtn').addEventListener('click', () => this.showSection('dataMenu'));

        document.getElementById('gasSaveBtn')?.addEventListener('click', () => this.saveGasSettings());
        document.getElementById('gasTestBtn')?.addEventListener('click', () => this.testGasNotification());
    }

    showSection(section) {
        const sections = ['topPage', 'taskMenu', 'dataMenu', 'csvMain', 'policyMain', 'skuRuleMain', 'brandMain', 'tagMain', 'collectionMain', 'notificationMain'];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });

        const idMap = {
            top: 'topPage',
            taskMenu: 'taskMenu',
            dataMenu: 'dataMenu',
            csv: 'csvMain',
            policy: 'policyMain',
            skuRule: 'skuRuleMain',
            brand: 'brandMain',
            tag: 'tagMain',
            collection: 'collectionMain',
            notification: 'notificationMain'
        };
        const target = document.getElementById(idMap[section] || section);
        if (target) target.style.display = 'block';

        if (section === 'skuRule') this.renderSkuRule();
        else if (section === 'brand') this.renderBrandManager();
        else if (section === 'tag') this.renderTagManager();
        else if (section === 'collection') this.renderCollectionManager();
        else if (section === 'notification') this.renderNotificationSettings();
    }

    renderNotificationSettings() {
        const settings = this.gasSettings || {};
        document.getElementById('gasUrlInput').value = settings.url || GAS_CONFIG.url;
        document.getElementById('gasToEmailInput').value = settings.toEmail || GAS_CONFIG.toEmail;
        document.getElementById('gasTokenInput').value = settings.token || GAS_CONFIG.token;
    }

    checkSettingsPassword() {
        const input = document.getElementById('settingsPasswordInput').value.trim();
        if (input !== SETTINGS_PASSWORD) {
            alert('設定パスワードが正しくありません');
            return false;
        }
        return true;
    }

    saveGasSettings() {
        if (!this.checkSettingsPassword()) return;
        this.gasSettings = {
            url: document.getElementById('gasUrlInput').value.trim(),
            toEmail: document.getElementById('gasToEmailInput').value.trim(),
            token: document.getElementById('gasTokenInput').value.trim()
        };
        this.saveData();
        alert('通知設定を保存しました');
    }

    async testGasNotification() {
        if (!this.checkSettingsPassword()) return;
        this.saveGasSettings();
        await this.notify('通知設定', 'テスト送信', '通知設定', 'これはテスト通知です。');
        alert('テスト通知を送信しました');
    }

    async notify(type, action, itemName, detail, saveToDriveType) {
        const settings = this.gasSettings || {};
        const url = settings.url || GAS_CONFIG.url;
        const token = settings.token || GAS_CONFIG.token;
        const toEmail = settings.toEmail || GAS_CONFIG.toEmail;
        if (!url) return;
        try {
            const body = {
                token,
                to: toEmail,
                type,
                action,
                itemName,
                detail
            };
            if (saveToDriveType) {
                let data;
                if (saveToDriveType === 'brands') data = this.brands;
                else if (saveToDriveType === 'tags') data = this.tags;
                else if (saveToDriveType === 'collections') data = this.collections;
                body.saveToDrive = {
                    filename: `${saveToDriveType}.json`,
                    content: JSON.stringify(data, null, 2),
                    mimeType: 'application/json'
                };
            }
            await fetch(url, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
        } catch (e) {
            console.error('Notify failed:', e);
        }
    }

    // ============================================================
    // SKU Rule
    // ============================================================
    renderSkuRule() {
        const container = document.getElementById('skuRuleContainer');
        const saved = this.skuRuleChecks || {};

        const rules = [
            {
                id: 'format',
                title: '基本形式',
                text: 'SKUは「ブランド略称（3文字）- 年（2桁）+ シーズン（1文字）- カテゴリコード - 連番（2桁、任意）- カラー - サイズ」で構成されます。',
                example: '例：FGM-26S-JK-01-RD-S0'
            },
            {
                id: 'brand',
                title: 'ブランド略称（3文字）',
                text: 'ブランド名から3文字の英字を使用します。例：Fullgram → FGM',
                example: ''
            },
            {
                id: 'year',
                title: '年（2桁）',
                text: '発売年の下2桁を使用します。例：2026年 → 26',
                example: ''
            },
            {
                id: 'season',
                title: 'シーズン（1文字）',
                text: 'SS（春夏）→ S、AW（秋冬）→ A を使用します。',
                example: ''
            },
            {
                id: 'category',
                title: 'カテゴリコード',
                text: 'カテゴリごとに決められたコードを使用します。詳細はカテゴリ管理画面を参照してください。',
                example: '例：JK（ジャケット）、SH（シャツ）、PT（パンツ）'
            },
            {
                id: 'serial',
                title: '連番（2桁、任意）',
                text: '同一ブランド・年・シーズン・カテゴリ内で重複を避けるための連番です。1商品のみの場合は省略可能です。',
                example: '例：01, 02, 03'
            },
            {
                id: 'color',
                title: 'カラー',
                text: '商品のカラー名を英字略称（2〜4文字）で表記します。',
                example: '例：RD（レッド）、BK（ブラック）、NV（ネイビー）'
            },
            {
                id: 'size',
                title: 'サイズ',
                text: '商品のサイズを英数字で表記します。',
                example: '例：S0, M0, L0, F0（フリーサイズ）'
            }
        ];

        container.innerHTML = `
            <div class="sku-rule-list">
                ${rules.map((rule, idx) => {
                    const check = saved[rule.id] || { ok: false, note: '' };
                    return `
                        <div class="sku-rule-item" data-id="${rule.id}">
                            <div class="sku-rule-header">
                                <span class="sku-rule-number">${idx + 1}</span>
                                <h3>${this.escapeHtml(rule.title)}</h3>
                            </div>
                            <p class="sku-rule-text">${this.escapeHtml(rule.text)}</p>
                            ${rule.example ? `<p class="sku-rule-example">${this.escapeHtml(rule.example)}</p>` : ''}
                            <div class="sku-rule-checks">
                                <label class="sku-rule-ok"><input type="checkbox" id="skuOk_${rule.id}" ${check.ok ? 'checked' : ''}> OK</label>
                                <div class="sku-rule-correction">
                                    <label for="skuNote_${rule.id}">訂正依頼</label>
                                    <input type="text" id="skuNote_${rule.id}" value="${this.escapeHtml(check.note)}" placeholder="訂正があれば入力してください">
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="sku-rule-overall">
                <label for="skuOverallNote">全体の訂正依頼</label>
                <textarea id="skuOverallNote" rows="4" placeholder="全体に関する追加項目や訂正があれば入力してください">${this.escapeHtml(saved.overallNote || '')}</textarea>
            </div>
            <div class="sku-rule-actions">
                <button id="skuSaveBtn" class="btn btn-secondary">一時保存</button>
                <button id="skuExportBtn" class="btn btn-success">保存して完了</button>
            </div>
            <div class="policy-approval-note" style="margin-top: 20px; padding: 16px; background: var(--color-surface); border-radius: 8px;">
                <p><strong>保存について：</strong>「保存して完了」を押すと、各項目のOK/訂正依頼内容をまとめたテキストファイルが提出用サーバーに自動保存されます。同時にローカルにも保存するか確認が表示されます。古いファイルは削除する必要はありません。</p>
            </div>
        `;

        document.getElementById('skuSaveBtn').addEventListener('click', () => this.saveSkuRule());
        document.getElementById('skuExportBtn').addEventListener('click', () => this.exportSkuRule());
    }

    saveSkuRule() {
        const items = document.querySelectorAll('#skuRuleContainer .sku-rule-item');
        const checks = {};
        items.forEach(item => {
            const id = item.dataset.id;
            checks[id] = {
                ok: document.getElementById(`skuOk_${id}`).checked,
                note: document.getElementById(`skuNote_${id}`).value.trim()
            };
        });
        checks.overallNote = document.getElementById('skuOverallNote').value.trim();
        this.skuRuleChecks = checks;
        this.saveData();
        alert('下書きを保存しました');
    }

    exportSkuRule() {
        this.saveSkuRule();
        const checks = this.skuRuleChecks;
        const ruleTitles = {
            format: '基本形式',
            brand: 'ブランド略称（3文字）',
            year: '年（2桁）',
            season: 'シーズン（1文字）',
            category: 'カテゴリコード',
            serial: '連番（2桁、任意）',
            color: 'カラー',
            size: 'サイズ'
        };

        let text = `SKUルール確認結果\n生成日時: ${new Date().toLocaleString('ja-JP')}\n\n`;
        Object.keys(ruleTitles).forEach(id => {
            const check = checks[id] || { ok: false, note: '' };
            text += `■ ${ruleTitles[id]}\n`;
            text += `状態: ${check.ok ? 'OK' : (check.note ? '訂正あり' : '未確認')}\n`;
            if (check.note) text += `訂正依頼: ${check.note}\n`;
            text += `\n`;
        });
        text += `--------------------------------\n全体の訂正依頼:\n${checks.overallNote || 'なし'}\n`;

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const serverFilename = `sku-rule-check_${timestamp}.txt`;
        const localFilename = `sku-rule-check_local_${timestamp}.txt`;

        if (!confirm(`SKUルール確認結果を提出用サーバーに保存しますか？`)) return;

        const downloadLocal = confirm(`提出用サーバーにアップロードしました。\nローカルにもダウンロードしますか？`);
        if (downloadLocal) {
            const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = localFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        sendToGas({
            type: 'SKUルール',
            action: 'テキスト出力',
            itemName: 'SKUルール確認結果',
            detail: `ファイル名: ${serverFilename}`,
            saveToDrive: {
                filename: serverFilename,
                content: text,
                mimeType: 'text/plain'
            }
        });
    }

    // ============================================================
    // Brand Manager
    // ============================================================
    renderBrandManager() {
        const container = document.getElementById('brandManager');
        const entries = Object.entries(this.brands || {}).sort((a, b) => a[0].localeCompare(b[0]));

        container.innerHTML = `
            <div class="data-manager">
                <div class="data-form">
                    <h3>ブランドを追加</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>ブランド名</label>
                            <input type="text" id="brandInputName" placeholder="例：Fullgram">
                        </div>
                        <div class="form-group">
                            <label>読み</label>
                            <input type="text" id="brandInputReading" placeholder="例：フルグラム">
                        </div>
                        <div class="form-group">
                            <label>SKU用3文字</label>
                            <input type="text" id="brandInputCode" maxlength="3" placeholder="例：FGM">
                        </div>
                    </div>
                    <button id="brandAddBtn" class="btn btn-primary">追加</button>
                </div>
                <div class="data-table-wrap">
                    <h3>登録済みブランド</h3>
                    <table class="data-manager-table">
                        <thead>
                            <tr><th>ブランド名</th><th>読み</th><th>SKU用3文字</th><th></th></tr>
                        </thead>
                        <tbody>
                            ${entries.map(([name, info]) => `
                                <tr data-name="${this.escapeHtml(name)}">
                                    <td>${this.escapeHtml(name)}</td>
                                    <td>${this.escapeHtml(info.reading || '')}</td>
                                    <td>${this.escapeHtml(info.code || '')}</td>
                                    <td><button class="btn btn-danger data-remove-btn" data-type="brand" data-name="${this.escapeHtml(name).replace(/"/g, '&quot;')}">削除</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="data-actions">
                    <button id="brandExportBtn" class="btn btn-success">保存して完了</button>
                </div>
                <div class="policy-approval-note" style="margin-top: 20px; padding: 16px; background: var(--color-surface); border-radius: 8px;">
                    <p><strong>保存について：</strong>「保存して完了」を押すとブランド情報が提出用サーバーに自動保存されます。同時にローカルにも保存するか確認が表示されます。商品CSV生成画面では最新のブランド情報を参照します。古いファイルは削除する必要はありません。</p>
                </div>
            </div>
        `;

        document.getElementById('brandAddBtn').addEventListener('click', () => this.addBrand());
        document.getElementById('brandExportBtn').addEventListener('click', () => this.exportJson('brands'));
        container.querySelectorAll('[data-type="brand"].data-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => this.removeBrand(btn.dataset.name));
        });
    }

    addBrand() {
        const name = document.getElementById('brandInputName').value.trim();
        const reading = document.getElementById('brandInputReading').value.trim();
        const code = document.getElementById('brandInputCode').value.trim().toUpperCase();
        if (!name || !reading || !code) {
            alert('全項目を入力してください');
            return;
        }
        if (!this.brands) this.brands = {};
        this.brands[name] = { reading, code };
        this.saveData();
        this.notify('ブランド', '追加', name, `読み: ${reading}\nSKUコード: ${code}`, 'brands');
        this.renderBrandManager();
    }

    removeBrand(name) {
        if (!confirm(`「${name}」を削除しますか？`)) return;
        if (this.brands) {
            delete this.brands[name];
            this.saveData();
            this.notify('ブランド', '削除', name, '', 'brands');
        }
        this.renderBrandManager();
    }

    // ============================================================
    // Tag Manager
    // ============================================================
    renderTagManager() {
        const container = document.getElementById('tagManager');
        const tags = (this.tags && this.tags.tags) ? [...this.tags.tags] : [];

        container.innerHTML = `
            <div class="data-manager">
                <div class="data-form">
                    <h3>タグを追加</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>タグ名</label>
                            <input type="text" id="tagInputName" placeholder="例：新作">
                        </div>
                        <div class="form-group" style="flex: 2;">
                            <label>説明</label>
                            <input type="text" id="tagInputDesc" placeholder="例：新入荷・新発売アイテム">
                        </div>
                    </div>
                    <button id="tagAddBtn" class="btn btn-primary">追加</button>
                </div>
                <div class="data-table-wrap">
                    <h3>登録済みタグ</h3>
                    <table class="data-manager-table">
                        <thead>
                            <tr><th>タグ名</th><th>説明</th><th></th></tr>
                        </thead>
                        <tbody>
                            ${tags.map((tag, idx) => `
                                <tr data-idx="${idx}">
                                    <td>${this.escapeHtml(typeof tag === 'string' ? tag : tag.name)}</td>
                                    <td>${this.escapeHtml(typeof tag === 'string' ? '' : (tag.description || ''))}</td>
                                    <td><button class="btn btn-danger data-remove-btn" data-type="tag" data-idx="${idx}">削除</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="data-actions">
                    <button id="tagExportBtn" class="btn btn-success">保存して完了</button>
                </div>
                <div class="policy-approval-note" style="margin-top: 20px; padding: 16px; background: var(--color-surface); border-radius: 8px;">
                    <p><strong>保存について：</strong>「保存して完了」を押すとタグ情報が提出用サーバーに自動保存されます。同時にローカルにも保存するか確認が表示されます。商品CSV生成画面では最新のタグ情報を参照します。古いファイルは削除する必要はありません。</p>
                </div>
            </div>
        `;

        document.getElementById('tagAddBtn').addEventListener('click', () => this.addTag());
        document.getElementById('tagExportBtn').addEventListener('click', () => this.exportJson('tags'));
        container.querySelectorAll('[data-type="tag"].data-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => this.removeTag(parseInt(btn.dataset.idx, 10)));
        });
    }

    addTag() {
        const name = document.getElementById('tagInputName').value.trim();
        const description = document.getElementById('tagInputDesc').value.trim();
        if (!name) {
            alert('タグ名を入力してください');
            return;
        }
        if (!this.tags) this.tags = { tags: [] };
        if (!this.tags.tags) this.tags.tags = [];
        this.tags.tags.push({ name, description });
        this.saveData();
        this.notify('タグ', '追加', name, `説明: ${description}`, 'tags');
        this.renderTagManager();
    }

    removeTag(idx) {
        if (!confirm('このタグを削除しますか？')) return;
        if (this.tags && this.tags.tags) {
            const removed = this.tags.tags[idx];
            this.tags.tags.splice(idx, 1);
            this.saveData();
            this.notify('タグ', '削除', typeof removed === 'string' ? removed : (removed.name || ''), `説明: ${typeof removed === 'string' ? '' : (removed.description || '')}`, 'tags');
        }
        this.renderTagManager();
    }

    // ============================================================
    // Collection Manager
    // ============================================================
    renderCollectionManager() {
        const container = document.getElementById('collectionManager');
        const collections = (this.collections && this.collections.collections) ? [...this.collections.collections] : [];
        const tags = (this.tags && this.tags.tags) ? this.tags.tags.map(t => typeof t === 'string' ? t : t.name) : [];

        container.innerHTML = `
            <div class="data-manager">
                <div class="data-form">
                    <h3>コレクションを追加</h3>
                    <div class="form-row">
                        <div class="form-group">
                            <label>コレクション名</label>
                            <input type="text" id="collectionInputName" placeholder="例：新作アイテム">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group" style="flex: 2;">
                            <label>説明</label>
                            <input type="text" id="collectionInputDesc" placeholder="例：新入荷・新発売のアイテムをまとめたコレクション">
                        </div>
                    </div>
                    <div class="form-group">
                        <label>紐づけるタグ（複数選択）</label>
                        <div class="collection-tag-checkboxes">
                            ${tags.map(tag => `
                                <label class="collection-tag-label"><input type="checkbox" value="${this.escapeHtml(tag)}"> ${this.escapeHtml(tag)}</label>
                            `).join('')}
                        </div>
                    </div>
                    <button id="collectionAddBtn" class="btn btn-primary">追加</button>
                </div>
                <div class="data-table-wrap">
                    <h3>登録済みコレクション</h3>
                    <table class="data-manager-table">
                        <thead>
                            <tr><th>コレクション名</th><th>説明</th><th>紐づけるタグ</th><th></th></tr>
                        </thead>
                        <tbody>
                            ${collections.map((col, idx) => `
                                <tr data-idx="${idx}">
                                    <td>${this.escapeHtml(typeof col === 'string' ? col : col.name)}</td>
                                    <td>${this.escapeHtml(typeof col === 'string' ? '' : (col.description || ''))}</td>
                                    <td>${this.escapeHtml((typeof col === 'string' ? [] : (col.tags || [])).join(', '))}</td>
                                    <td><button class="btn btn-danger data-remove-btn" data-type="collection" data-idx="${idx}">削除</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="data-actions">
                    <button id="collectionExportBtn" class="btn btn-success">保存して完了</button>
                </div>
                <div class="policy-approval-note" style="margin-top: 20px; padding: 16px; background: var(--color-surface); border-radius: 8px;">
                    <p><strong>保存について：</strong>「保存して完了」を押すとコレクション情報が提出用サーバーに自動保存されます。同時にローカルにも保存するか確認が表示されます。商品CSV生成画面では最新のコレクション情報を参照します。古いファイルは削除する必要はありません。</p>
                </div>
            </div>
        `;

        document.getElementById('collectionAddBtn').addEventListener('click', () => this.addCollection());
        document.getElementById('collectionExportBtn').addEventListener('click', () => this.exportJson('collections'));
        container.querySelectorAll('[data-type="collection"].data-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => this.removeCollection(parseInt(btn.dataset.idx, 10)));
        });
    }

    addCollection() {
        const name = document.getElementById('collectionInputName').value.trim();
        const description = document.getElementById('collectionInputDesc').value.trim();
        const tagEls = document.querySelectorAll('#collectionManager .collection-tag-checkboxes input:checked');
        const tags = Array.from(tagEls).map(el => el.value);
        if (!name) {
            alert('コレクション名を入力してください');
            return;
        }
        if (!this.collections) this.collections = { collections: [] };
        if (!this.collections.collections) this.collections.collections = [];
        this.collections.collections.push({ name, description, tags });
        this.saveData();
        this.notify('コレクション', '追加', name, `説明: ${description}\n紐づけるタグ: ${tags.join(', ')}`, 'collections');
        this.renderCollectionManager();
    }

    removeCollection(idx) {
        if (!confirm('このコレクションを削除しますか？')) return;
        if (this.collections && this.collections.collections) {
            const removed = this.collections.collections[idx];
            this.collections.collections.splice(idx, 1);
            this.saveData();
            this.notify('コレクション', '削除', typeof removed === 'string' ? removed : (removed.name || ''), '', 'collections');
        }
        this.renderCollectionManager();
    }

    exportJson(type) {
        let data, baseName, label;
        if (type === 'brands') { data = this.brands; baseName = 'brands'; label = 'ブランド'; }
        else if (type === 'tags') { data = this.tags; baseName = 'tags'; label = 'タグ'; }
        else if (type === 'collections') { data = this.collections; baseName = 'collections'; label = 'コレクション'; }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const serverFilename = `${baseName}_${timestamp}.json`;
        const localFilename = `${baseName}_local_${timestamp}.json`;

        if (!confirm(`${label}データを提出用サーバーに保存しますか？`)) return;

        const downloadLocal = confirm(`${serverFilename} が提出用サーバーにアップロードされました。\nローカルにもダウンロードしますか？`);
        if (downloadLocal) {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = localFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }

        this.notify(label, 'JSON保存', serverFilename, `${serverFilename} が提出用サーバーにアップロードされました。`, type);
    }

    escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
}
