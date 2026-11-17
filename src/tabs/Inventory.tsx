import { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Download,
  Plus,
  Search,
  AlertTriangle,
  Edit2,
  Trash2,
  Save,
  X,
  Warehouse,
  Image as ImageIcon,
  Images,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  Product,
  Supplier,
  PRODUCT_CATEGORIES,
  CATEGORY_MARKUP,
  TIERED_CATEGORIES,
  SUB_CATEGORIES,
  ALL_SUB_CATEGORIES,
} from '@/lib/types';
import { formatVND } from '@/lib/pricing';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Input,
  Select,
  EmptyState,
  StatCard,
} from '@/components/ui';

const CSV_DELIMITER = ';';

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function getSkuGroupPrefix(sku: string): string {
  if (sku.startsWith('VP-')) {
    const parts = sku.split('-');
    if (parts.length >= 3) return parts.slice(0, 3).join('-');
  }
  if (sku.startsWith('BK-')) {
    const parts = sku.split('-');
    if (parts.length >= 2) return parts.slice(0, 2).join('-');
  }
  return sku;
}

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [applyImageToGroup, setApplyImageToGroup] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const [newProduct, setNewProduct] = useState<{
    sku: string;
    name: string;
    category: string;
    sub_category: string;
    variant: string;
    price_hlv: string;
    price_le: string;
    stock: string;
    default_supplier_id: string;
    image_url: string;
  }>({
    sku: '',
    name: '',
    category: PRODUCT_CATEGORIES[0],
    sub_category: '',
    variant: '',
    price_hlv: '',
    price_le: '',
    stock: '',
    default_supplier_id: '',
    image_url: '',
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('products').select('*').order('sku');
    if (error) {
      console.error('Error:', error);
    } else {
      setProducts(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
    supabase.from('suppliers').select('*').order('name').then(({ data }) => {
      if (data) setSuppliers(data);
    });
  }, [fetchProducts]);

  const uploadProductImageFile = async (file: File, fileKey: string): Promise<string> => {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const cleanKey = fileKey.replace(/[^a-zA-Z0-9_-]/g, '_');
    const storagePath = `${cleanKey}_${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('product-images')
      .upload(storagePath, file, { upsert: true, contentType: file.type || 'image/jpeg' });
    if (uploadErr) throw uploadErr;
    const { data } = supabase.storage.from('product-images').getPublicUrl(storagePath);
    return data.publicUrl;
  };

  const handleSingleImageUpload = async (file: File, target: 'edit' | 'new') => {
    try {
      setUploadingImage(true);
      const skuKey = target === 'edit' ? (editingProduct?.sku || 'item') : (newProduct.sku || 'new');
      const publicUrl = await uploadProductImageFile(file, skuKey);
      if (target === 'edit' && editingProduct) {
        setEditingProduct({ ...editingProduct, image_url: publicUrl });
      } else {
        setNewProduct((prev) => ({ ...prev, image_url: publicUrl }));
      }
    } catch (err) {
      alert('Lỗi tải ảnh: ' + (err as Error).message);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploadingImage(true);
    let matchedCount = 0;
    let unmatchedFiles: string[] = [];

    try {
      for (const file of files) {
        const baseName = file.name.replace(/\.[^/.]+$/, '').trim().toUpperCase();
        const matchedProducts = products.filter((p) => {
          const pSku = p.sku.toUpperCase();
          const groupPrefix = getSkuGroupPrefix(p.sku).toUpperCase();
          return pSku === baseName || groupPrefix === baseName;
        });

        if (matchedProducts.length === 0) {
          unmatchedFiles.push(file.name);
          continue;
        }

        const publicUrl = await uploadProductImageFile(file, baseName);
        const ids = matchedProducts.map((p) => p.id);
        await supabase.from('products').update({ image_url: publicUrl }).in('id', ids);
        matchedCount += matchedProducts.length;
      }

      setImportMsg(
        `Đã gắn ảnh tự động cho ${matchedCount} sản phẩm!` +
          (unmatchedFiles.length > 0
            ? ` (${unmatchedFiles.length} tệp chưa khớp mã SKU: ${unmatchedFiles.slice(0, 5).join(', ')})`
            : '')
      );
      setTimeout(() => setImportMsg(''), 8000);
      fetchProducts();
    } catch (err) {
      alert('Lỗi tải ảnh hàng loạt: ' + (err as Error).message);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const filteredProducts = products.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (subCategoryFilter && (p.sub_category || '') !== subCategoryFilter) return false;
    if (showLowStock && p.stock >= 5) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.variant || '').toLowerCase().includes(q) ||
      (p.sub_category || '').toLowerCase().includes(q)
    );
  });

  const lowStockCount = products.filter((p) => p.stock < 5).length;
  const totalStockValue = products.reduce((s, p) => s + p.price_hlv * p.stock, 0);
  const totalProducts = products.length;

  const computeLePrice = (category: string, hlv: number) => {
    const isTiered = TIERED_CATEGORIES.includes(category);
    return isTiered ? hlv : hlv + (CATEGORY_MARKUP[category] || 0);
  };

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    const calculatedPriceLe = computeLePrice(editingProduct.category, editingProduct.price_hlv);

    const { error } = await supabase
      .from('products')
      .update({
        name: editingProduct.name,
        category: editingProduct.category,
        sub_category: editingProduct.sub_category || null,
        variant: editingProduct.variant,
        price_hlv: editingProduct.price_hlv,
        price_le: calculatedPriceLe,
        stock: editingProduct.stock,
        default_supplier_id: editingProduct.default_supplier_id || null,
        image_url: editingProduct.image_url || null,
      })
      .eq('id', editingProduct.id);

    if (error) {
      alert('Lỗi cập nhật: ' + error.message);
      return;
    }

    const groupPrefix = getSkuGroupPrefix(editingProduct.sku);
    let siblingIds: string[] = [];
    if (applyImageToGroup && editingProduct.image_url && groupPrefix !== editingProduct.sku) {
      siblingIds = products
        .filter((p) => p.id !== editingProduct.id && getSkuGroupPrefix(p.sku) === groupPrefix)
        .map((p) => p.id);
      if (siblingIds.length > 0) {
        await supabase
          .from('products')
          .update({ image_url: editingProduct.image_url })
          .in('id', siblingIds);
      }
    }

    setProducts((prev) =>
      prev.map((p) => {
        if (p.id === editingProduct.id) {
          return {
            ...p,
            ...editingProduct,
            sub_category: editingProduct.sub_category || null,
            price_le: calculatedPriceLe,
          };
        }
        if (siblingIds.includes(p.id)) {
          return { ...p, image_url: editingProduct.image_url };
        }
        return p;
      })
    );
    setEditingProduct(null);
  };

  const handleAddProduct = async () => {
    if (!newProduct.sku || !newProduct.name) {
      alert('Vui lòng nhập mã SKU và tên sản phẩm');
      return;
    }
    const hlvPrice = parseInt(newProduct.price_hlv) || 0;
    const lePrice = computeLePrice(newProduct.category, hlvPrice);

    const { data, error } = await supabase
      .from('products')
      .insert({
        sku: newProduct.sku.trim(),
        name: newProduct.name.trim(),
        category: newProduct.category,
        sub_category: newProduct.sub_category || null,
        variant: newProduct.variant || null,
        price_hlv: hlvPrice,
        price_le: lePrice,
        stock: parseInt(newProduct.stock) || 0,
        default_supplier_id: newProduct.default_supplier_id || null,
        image_url: newProduct.image_url || null,
      })
      .select()
      .single();

    if (error) {
      alert('Lỗi thêm sản phẩm: ' + error.message);
      return;
    }
    setProducts((prev) => [...prev, data]);
    setNewProduct({
      sku: '',
      name: '',
      category: PRODUCT_CATEGORIES[0],
      sub_category: '',
      variant: '',
      price_hlv: '',
      price_le: '',
      stock: '',
      default_supplier_id: '',
      image_url: '',
    });
    setShowAddForm(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa sản phẩm này?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) {
      alert('Lỗi xóa: ' + error.message);
      return;
    }
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleExport = () => {
    const headers = ['SKU', 'Tên sản phẩm', 'Nhóm hàng', 'Môn võ / Nhóm con', 'Phân loại', 'Giá HLV', 'Giá Lẻ', 'Tồn kho'];
    const rows = products.map((p) => [
      p.sku,
      p.name,
      p.category,
      p.sub_category || '',
      p.variant || '',
      p.price_hlv,
      p.price_le,
      p.stock,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(CSV_DELIMITER))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thien_kim_products_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const delimiter = text.includes(';') ? ';' : ',';
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      setImportMsg('File CSV không có dữ liệu');
      e.target.value = '';
      return;
    }

    const headers = parseCSVLine(lines[0], delimiter).map((h) => h.replace(/^"|"$/g, '').trim());
    let success = 0;
    let fail = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i], delimiter);
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = (values[idx] || '').replace(/^"|"$/g, '').trim();
      });

      const sku = row['SKU'] || row['sku'] || '';
      const name = row['Tên sản phẩm'] || row['name'] || '';
      if (!sku || !name) {
        fail++;
        continue;
      }

      const category = row['Nhóm hàng'] || row['category'] || PRODUCT_CATEGORIES[0];
      const subCategory = row['Môn võ / Nhóm con'] || row['sub_category'] || row['Môn võ'] || '';
      const hlvPrice = parseInt(row['Giá HLV'] || row['price_hlv'] || '0') || 0;
      const lePrice = computeLePrice(category, hlvPrice);

      const { error } = await supabase.from('products').upsert(
        {
          sku,
          name,
          category,
          sub_category: subCategory || null,
          variant: row['Phân loại'] || row['variant'] || null,
          price_hlv: hlvPrice,
          price_le: lePrice,
          stock: parseInt(row['Tồn kho'] || row['stock'] || '0') || 0,
        },
        { onConflict: 'sku' }
      );

      if (error) {
        fail++;
      } else {
        success++;
      }
    }

    setImportMsg(`Đã nhập ${success} sản phẩm thành công${fail > 0 ? `, ${fail} lỗi` : ''}`);
    setTimeout(() => setImportMsg(''), 5000);
    fetchProducts();
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-700" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Quản lý Kho, Hình ảnh & Bảng giá"
        subtitle="Chỉnh sửa thông tin, tải ảnh hàng loạt theo SKU và quản lý tồn kho"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Tổng sản phẩm" value={String(totalProducts)} variant="primary" />
        <StatCard label="Sắp hết (< 5)" value={String(lowStockCount)} variant={lowStockCount > 0 ? 'danger' : 'default'} />
        <StatCard label="Tổng giá trị kho" value={formatVND(totalStockValue)} />
        <StatCard
          label="Đã có hình ảnh"
          value={`${products.filter((p) => Boolean(p.image_url)).length} / ${totalProducts}`}
          variant="default"
        />
      </div>

      {importMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {importMsg}
        </div>
      )}

      <Card className="p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo SKU, tên, phân loại, môn võ..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select
            value={categoryFilter}
            onChange={(v) => {
              setCategoryFilter(v);
              setSubCategoryFilter('');
            }}
            className="lg:w-44"
          >
            <option value="">Tất cả nhóm</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          {categoryFilter && (
            <Select value={subCategoryFilter} onChange={setSubCategoryFilter} className="lg:w-44">
              <option value="">Tất cả nhóm con</option>
              {(SUB_CATEGORIES[categoryFilter] || []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          )}
          <Button
            variant={showLowStock ? 'danger' : 'outline'}
            onClick={() => setShowLowStock(!showLowStock)}
          >
            <AlertTriangle size={16} className="inline mr-1" />
            {showLowStock ? 'Đang lọc' : 'Sắp hết'}
          </Button>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer">
              <span className="inline-flex items-center px-3.5 py-2.5 text-sm font-medium rounded-lg border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all">
                <Images size={16} className="inline mr-1.5" />
                {uploadingImage ? 'Đang tải ảnh...' : 'Tải ảnh hàng loạt'}
              </span>
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={uploadingImage}
                onChange={handleBulkImageUpload}
                className="hidden"
              />
            </label>
            <Button variant="outline" onClick={handleExport}>
              <Download size={16} className="inline mr-1" /> Export
            </Button>
            <label className="cursor-pointer">
              <span className="inline-flex items-center px-3.5 py-2.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white transition-all">
                <Upload size={16} className="inline mr-1" /> CSV
              </span>
              <input type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" />
            </label>
            <Button variant="primary" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus size={16} className="inline mr-1" /> Thêm SP
            </Button>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          Mẹo tải ảnh hàng loạt: Đặt tên tệp ảnh trùng Mã SKU (VD: <span className="font-mono text-slate-600">BX21.jpg</span>) hoặc Mã nhóm (VD: <span className="font-mono text-slate-600">VP-VVN-POLY.jpg</span> để tự gắn cho cả 11 size, <span className="font-mono text-slate-600">BK-KIEM.jpg</span> cho cả 3 loại kiếm), chọn tất cả ảnh cùng lúc để tải lên.
        </p>
      </Card>

      {showAddForm && (
        <Card className="p-5 mb-6 border-blue-300">
          <h3 className="font-semibold text-slate-800 mb-4">Thêm sản phẩm mới</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Mã SKU *"
              value={newProduct.sku}
              onChange={(v) => setNewProduct({ ...newProduct, sku: v })}
              placeholder="VD: VP-VVN-POLY-120"
            />
            <Input
              label="Tên sản phẩm *"
              value={newProduct.name}
              onChange={(v) => setNewProduct({ ...newProduct, name: v })}
              placeholder="Tên sản phẩm"
            />
            <Select
              label="Nhóm hàng"
              value={newProduct.category}
              onChange={(v) => setNewProduct({ ...newProduct, category: v, sub_category: '' })}
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Select
              label="Môn võ / Nhóm con"
              value={newProduct.sub_category}
              onChange={(v) => setNewProduct({ ...newProduct, sub_category: v })}
            >
              <option value="">-- Không --</option>
              {(SUB_CATEGORIES[newProduct.category] || ALL_SUB_CATEGORIES).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
            <Input
              label="Phân loại / Size / Màu"
              value={newProduct.variant}
              onChange={(v) => setNewProduct({ ...newProduct, variant: v })}
              placeholder="VD: Size 160"
            />
            <Input
              label="Giá HLV (đ)"
              type="number"
              value={newProduct.price_hlv}
              onChange={(v) => setNewProduct({ ...newProduct, price_hlv: v })}
              placeholder="96000"
            />
            <Input
              label="Tồn kho"
              type="number"
              value={newProduct.stock}
              onChange={(v) => setNewProduct({ ...newProduct, stock: v })}
              placeholder="0"
            />
            <Select
              label="Nhà cung ứng mặc định"
              value={newProduct.default_supplier_id}
              onChange={(v) => setNewProduct({ ...newProduct, default_supplier_id: v })}
            >
              <option value="">-- Không --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Hình ảnh sản phẩm</label>
              <div className="flex items-center gap-3">
                {newProduct.image_url ? (
                  <img src={newProduct.image_url} alt="Preview" className="w-11 h-11 rounded-lg object-cover border" />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400">
                    <ImageIcon size={18} />
                  </div>
                )}
                <label className="cursor-pointer px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700">
                  Chọn ảnh gốc
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleSingleImageUpload(f, 'new');
                    }}
                  />
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="primary" onClick={handleAddProduct}>Lưu sản phẩm</Button>
            <Button variant="outline" onClick={() => setShowAddForm(false)}>Hủy</Button>
          </div>
        </Card>
      )}

      {filteredProducts.length === 0 ? (
        <Card className="p-6">
          <EmptyState message="Không có sản phẩm nào" icon={<Warehouse size={40} />} />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-3 font-semibold text-slate-600 w-16">Ảnh</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600">SKU</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600">Sản phẩm</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600">Nhóm</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600">Nhóm con</th>
                <th className="text-right px-3 py-3 font-semibold text-slate-600">Giá HLV</th>
                <th className="text-right px-3 py-3 font-semibold text-slate-600">Giá Lẻ</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-600">Tồn</th>
                <th className="text-center px-3 py-3 font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    product.stock < 5 ? 'bg-red-50/50' : ''
                  }`}
                >
                  {editingProduct?.id === product.id ? (
                    <>
                      <td className="px-3 py-2">
                        <label className="cursor-pointer block relative group w-12 h-12">
                          {editingProduct.image_url ? (
                            <img
                              src={editingProduct.image_url}
                              alt={editingProduct.name}
                              className="w-12 h-12 rounded-lg object-cover border border-blue-400"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 border border-dashed border-blue-400 flex items-center justify-center text-blue-600">
                              <Upload size={16} />
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleSingleImageUpload(f, 'edit');
                            }}
                          />
                        </label>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-blue-700">{product.sku}</td>
                      <td className="px-3 py-2">
                        <input
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                        <input
                          value={editingProduct.variant || ''}
                          onChange={(e) => setEditingProduct({ ...editingProduct, variant: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm mt-1"
                          placeholder="Phân loại / Size"
                        />
                        {getSkuGroupPrefix(product.sku) !== product.sku && (
                          <label className="flex items-center gap-1.5 text-xs text-blue-700 mt-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={applyImageToGroup}
                              onChange={(e) => setApplyImageToGroup(e.target.checked)}
                            />
                            Áp dụng ảnh cho tất cả size/loại cùng mẫu ({getSkuGroupPrefix(product.sku)})
                          </label>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editingProduct.category}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, category: e.target.value, sub_category: '' })
                          }
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                        >
                          {PRODUCT_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <select
                          value={editingProduct.sub_category || ''}
                          onChange={(e) => setEditingProduct({ ...editingProduct, sub_category: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-xs bg-white"
                        >
                          <option value="">-- Không --</option>
                          {(SUB_CATEGORIES[editingProduct.category] || ALL_SUB_CATEGORIES).map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editingProduct.price_hlv}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, price_hlv: parseInt(e.target.value) || 0 })
                          }
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-slate-500 text-xs">Tự tính</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          value={editingProduct.stock}
                          onChange={(e) =>
                            setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })
                          }
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={handleSaveProduct}
                            className="p-1.5 rounded text-green-600 hover:bg-green-100"
                            title="Lưu"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => setEditingProduct(null)}
                            className="p-1.5 rounded text-slate-400 hover:bg-slate-100"
                            title="Hủy"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2.5">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-11 h-11 rounded-lg object-cover border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300">
                            <ImageIcon size={16} />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 font-mono text-xs font-medium text-blue-700">{product.sku}</td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-slate-700">{product.name}</p>
                        {product.variant && <p className="text-xs text-slate-400">{product.variant}</p>}
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{product.category}</td>
                      <td className="px-3 py-3">
                        {product.sub_category ? (
                          <Badge variant="info">{product.sub_category}</Badge>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">{formatVND(product.price_hlv)}</td>
                      <td className="px-3 py-3 text-right text-red-600 font-medium">{formatVND(product.price_le)}</td>
                      <td className="px-3 py-3 text-center">
                        {product.stock < 5 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded font-bold text-sm">
                            <AlertTriangle size={12} />
                            {product.stock}
                          </span>
                        ) : (
                          <span className="text-slate-700 font-medium">{product.stock}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setEditingProduct(product);
                              setApplyImageToGroup(true);
                            }}
                            className="p-1.5 rounded text-slate-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                            title="Sửa thông tin & hình ảnh"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1.5 rounded text-slate-500 hover:bg-red-100 hover:text-red-700 transition-colors"
                            title="Xóa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
