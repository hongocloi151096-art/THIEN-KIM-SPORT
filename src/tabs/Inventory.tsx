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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Product, Supplier, PRODUCT_CATEGORIES, CATEGORY_MARKUP, TIERED_CATEGORIES } from '@/lib/types';
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

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [importMsg, setImportMsg] = useState('');

  // New product form
  const [newProduct, setNewProduct] = useState<{
    sku: string;
    name: string;
    category: string;
    variant: string;
    price_hlv: string;
    price_le: string;
    stock: string;
    default_supplier_id: string;
  }>({
    sku: '',
    name: '',
    category: PRODUCT_CATEGORIES[0],
    variant: '',
    price_hlv: '',
    price_le: '',
    stock: '',
    default_supplier_id: '',
  });

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('products').select('*').order('name');
    const { data, error } = await query;
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

  const filteredProducts = products.filter((p) => {
    if (categoryFilter && p.category !== categoryFilter) return false;
    if (showLowStock && p.stock >= 5) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.sku.toLowerCase().includes(q) ||
      p.name.toLowerCase().includes(q) ||
      (p.variant || '').toLowerCase().includes(q)
    );
  });

  const lowStockCount = products.filter((p) => p.stock < 5).length;
  const totalStockValue = products.reduce((s, p) => s + p.price_hlv * p.stock, 0);
  const totalProducts = products.length;

  const handleSaveProduct = async () => {
    if (!editingProduct) return;
    const isTiered = TIERED_CATEGORIES.includes(editingProduct.category);
    const calculatedPriceLe = isTiered
      ? editingProduct.price_hlv
      : editingProduct.price_hlv + (CATEGORY_MARKUP[editingProduct.category] || 0);

    const { error } = await supabase
      .from('products')
      .update({
        name: editingProduct.name,
        category: editingProduct.category,
        variant: editingProduct.variant,
        price_hlv: editingProduct.price_hlv,
        price_le: calculatedPriceLe,
        stock: editingProduct.stock,
        default_supplier_id: editingProduct.default_supplier_id || null,
      })
      .eq('id', editingProduct.id);

    if (error) {
      alert('Lỗi cập nhật: ' + error.message);
      return;
    }
    setProducts((prev) =>
      prev.map((p) =>
        p.id === editingProduct.id
          ? { ...p, ...editingProduct, price_le: calculatedPriceLe }
          : p
      )
    );
    setEditingProduct(null);
  };

  const handleAddProduct = async () => {
    if (!newProduct.sku || !newProduct.name) {
      alert('Vui lòng nhập mã SKU và tên sản phẩm');
      return;
    }
    const hlvPrice = parseInt(newProduct.price_hlv) || 0;
    const isTiered = TIERED_CATEGORIES.includes(newProduct.category);
    const lePrice = isTiered
      ? hlvPrice
      : hlvPrice + (CATEGORY_MARKUP[newProduct.category] || 0);

    const { data, error } = await supabase
      .from('products')
      .insert({
        sku: newProduct.sku,
        name: newProduct.name,
        category: newProduct.category,
        variant: newProduct.variant || null,
        price_hlv: hlvPrice,
        price_le: lePrice,
        stock: parseInt(newProduct.stock) || 0,
        default_supplier_id: newProduct.default_supplier_id || null,
      })
      .select()
      .single();

    if (error) {
      alert('Lỗi thêm sản phẩm: ' + error.message);
      return;
    }
    setProducts((prev) => [...prev, data]);
    setNewProduct({
      sku: '', name: '', category: PRODUCT_CATEGORIES[0], variant: '',
      price_hlv: '', price_le: '', stock: '', default_supplier_id: '',
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
    const headers = ['SKU', 'Tên sản phẩm', 'Nhóm hàng', 'Phân loại', 'Giá HLV', 'Giá Lẻ', 'Tồn kho'];
    const rows = products.map((p) => [
      p.sku,
      p.name,
      p.category,
      p.variant || '',
      p.price_hlv,
      p.price_le,
      p.stock,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
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
    const lines = text.split('\n').filter((l) => l.trim());
    if (lines.length < 2) {
      setImportMsg('File CSV không có dữ liệu');
      return;
    }

    const parseRow = (line: string) => {
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
        } else if (char === ',' && !inQuotes) {
          result.push(current);
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current);
      return result;
    };

    const headers = parseRow(lines[0]).map((h) => h.replace(/^"|"$/g, '').trim());
    let success = 0;
    let fail = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseRow(lines[i]);
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
      const hlvPrice = parseInt(row['Giá HLV'] || row['price_hlv'] || '0') || 0;
      const isTiered = TIERED_CATEGORIES.includes(category);
      const lePrice = isTiered
        ? hlvPrice
        : hlvPrice + (CATEGORY_MARKUP[category] || 0);

      const { error } = await supabase.from('products').upsert({
        sku,
        name,
        category,
        variant: row['Phân loại'] || row['variant'] || null,
        price_hlv: hlvPrice,
        price_le: lePrice,
        stock: parseInt(row['Tồn kho'] || row['stock'] || '0') || 0,
      }, { onConflict: 'sku' });

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
        title="Quản lý Kho & Nhập bảng giá"
        subtitle="Tồn kho, cảnh báo hết hàng và import/export CSV"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Tổng sản phẩm" value={String(totalProducts)} variant="primary" />
        <StatCard label="Sắp hết (< 5)" value={String(lowStockCount)} variant={lowStockCount > 0 ? 'danger' : 'default'} />
        <StatCard label="Tổng giá trị kho" value={formatVND(totalStockValue)} />
        <StatCard
          label="Nhóm hàng"
          value={String(PRODUCT_CATEGORIES.length)}
          variant="default"
        />
      </div>

      {importMsg && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {importMsg}
        </div>
      )}

      {/* Toolbar */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm theo SKU, tên, phân loại..."
              className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <Select value={categoryFilter} onChange={setCategoryFilter} className="lg:w-48">
            <option value="">Tất cả nhóm</option>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Button
            variant={showLowStock ? 'danger' : 'outline'}
            onClick={() => setShowLowStock(!showLowStock)}
          >
            <AlertTriangle size={16} className="inline mr-1.5" />
            {showLowStock ? 'Đang lọc sắp hết' : 'Sắp hết hàng'}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download size={16} className="inline mr-1.5" /> Export
            </Button>
            <label className="cursor-pointer">
              <span className="inline-flex items-center px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 bg-white transition-all">
                <Upload size={16} className="inline mr-1.5" /> Import CSV
              </span>
              <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
            </label>
            <Button variant="primary" onClick={() => setShowAddForm(!showAddForm)}>
              <Plus size={16} className="inline mr-1.5" /> Thêm SP
            </Button>
          </div>
        </div>
      </Card>

      {/* Add product form */}
      {showAddForm && (
        <Card className="p-5 mb-6 border-blue-300">
          <h3 className="font-semibold text-slate-800 mb-4">Thêm sản phẩm mới</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Mã SKU *" value={newProduct.sku} onChange={(v) => setNewProduct({ ...newProduct, sku: v })} placeholder="VD: VP-POLY-120" />
            <Input label="Tên sản phẩm *" value={newProduct.name} onChange={(v) => setNewProduct({ ...newProduct, name: v })} placeholder="Tên sản phẩm" />
            <Select
              label="Nhóm hàng"
              value={newProduct.category}
              onChange={(v) => setNewProduct({ ...newProduct, category: v })}
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Input label="Phân loại/Size/Màu" value={newProduct.variant} onChange={(v) => setNewProduct({ ...newProduct, variant: v })} placeholder="VD: Size 160" />
            <Input label="Giá HLV (đ)" type="number" value={newProduct.price_hlv} onChange={(v) => setNewProduct({ ...newProduct, price_hlv: v })} placeholder="96000" />
            <Input label="Tồn kho" type="number" value={newProduct.stock} onChange={(v) => setNewProduct({ ...newProduct, stock: v })} placeholder="0" />
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
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="primary" onClick={handleAddProduct}>Lưu sản phẩm</Button>
            <Button variant="outline" onClick={() => setShowAddForm(false)}>Hủy</Button>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            * Giá Lẻ sẽ tự động tính: +40.000đ cho Võ phục/Binh khí/Dụng cụ, hoặc bằng Giá HLV cho Áo thun.
          </p>
        </Card>
      )}

      {/* Products table */}
      {filteredProducts.length === 0 ? (
        <Card className="p-6">
          <EmptyState message="Không có sản phẩm nào" icon={<Warehouse size={40} />} />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-600">SKU</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Sản phẩm</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Nhóm</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Giá HLV</th>
                <th className="text-right px-4 py-3 font-semibold text-slate-600">Giá Lẻ</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Tồn kho</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${product.stock < 5 ? 'bg-red-50/50' : ''}`}>
                  {editingProduct?.id === product.id ? (
                    <>
                      <td className="px-4 py-2 font-mono text-xs text-blue-700">{product.sku}</td>
                      <td className="px-4 py-2">
                        <input
                          value={editingProduct.name}
                          onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                        />
                        <input
                          value={editingProduct.variant || ''}
                          onChange={(e) => setEditingProduct({ ...editingProduct, variant: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm mt-1"
                          placeholder="Phân loại"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editingProduct.category}
                          onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                          className="w-full px-2 py-1 border border-slate-300 rounded text-sm bg-white"
                        >
                          {PRODUCT_CATEGORIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editingProduct.price_hlv}
                          onChange={(e) => setEditingProduct({ ...editingProduct, price_hlv: parseInt(e.target.value) || 0 })}
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-sm text-right"
                        />
                      </td>
                      <td className="px-4 py-2 text-right text-slate-500 text-xs">
                        Tự động tính
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editingProduct.stock}
                          onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                          className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={handleSaveProduct} className="p-1.5 rounded text-green-600 hover:bg-green-100" title="Lưu">
                            <Save size={16} />
                          </button>
                          <button onClick={() => setEditingProduct(null)} className="p-1.5 rounded text-slate-400 hover:bg-slate-100" title="Hủy">
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono text-xs font-medium text-blue-700">{product.sku}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-700">{product.name}</p>
                        {product.variant && <p className="text-xs text-slate-400">{product.variant}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{product.category}</td>
                      <td className="px-4 py-3 text-right text-slate-700">{formatVND(product.price_hlv)}</td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">{formatVND(product.price_le)}</td>
                      <td className="px-4 py-3 text-center">
                        {product.stock < 5 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded font-bold text-sm">
                            <AlertTriangle size={12} />
                            {product.stock}
                          </span>
                        ) : (
                          <span className="text-slate-700 font-medium">{product.stock}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setEditingProduct(product)}
                            className="p-1.5 rounded text-slate-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                            title="Sửa"
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
