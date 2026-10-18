import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  PackageCheck,
  Users,
  FolderTree,
  CreditCard,
  FileCheck,
  AlertTriangle,
  Settings,
  History,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import {
  Product,
  CreatorApplication,
  Category,
  Order,
  PayoutRequest,
  ProductReport,
  MarketplaceSettings,
  AdminAuditLog,
} from '../types';
import { adminService } from '../services/adminService';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export const AdminDashboardPage: React.FC = () => {
  const { currentUser, isAdmin } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<
    'products' | 'creators' | 'categories' | 'orders' | 'payouts' | 'reports' | 'settings' | 'audit'
  >('products');

  const [loading, setLoading] = useState(true);

  // Data states
  const [products, setProducts] = useState<Product[]>([]);
  const [applications, setApplications] = useState<CreatorApplication[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [reports, setReports] = useState<ProductReport[]>([]);
  const [settings, setSettings] = useState<MarketplaceSettings | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  // Action states
  const [moderationNotes, setModerationNotes] = useState('');
  const [payoutRef, setPayoutRef] = useState('');
  const [selectedPayout, setSelectedPayout] = useState<PayoutRequest | null>(null);

  // Category Modal
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [catNameEn, setCatNameEn] = useState('');
  const [catNameAm, setCatNameAm] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDescEn, setCatDescEn] = useState('');
  const [catDescAm, setCatDescAm] = useState('');
  const [catSortOrder, setCatSortOrder] = useState('1');

  useEffect(() => {
    if (!currentUser) {
      navigate('/signin?redirect=/admin');
      return;
    }
    if (!isAdmin) {
      navigate('/');
      return;
    }

    async function loadAdminData() {
      try {
        const [prods, apps, cats, ords, payreqs, reps, setts, logs] = await Promise.all([
          adminService.getProductsForReview(),
          adminService.getCreatorApplications(),
          adminService.getAllCategories(),
          adminService.getRecentOrders(),
          adminService.getPayoutRequests(),
          adminService.getReports(),
          adminService.getSettings(),
          adminService.getAuditLogs(),
        ]);

        setProducts(prods);
        setApplications(apps);
        setCategories(cats);
        setOrders(ords);
        setPayouts(payreqs);
        setReports(reps);
        setSettings(setts);
        setAuditLogs(logs);
      } catch (err) {
        console.error('Error loading admin portal data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, [currentUser, isAdmin, navigate]);

  // Product actions
  const handleProductStatus = async (productId: string, newStatus: 'APPROVED' | 'REJECTED' | 'SUSPENDED') => {
    if (!currentUser) return;
    try {
      await adminService.updateProductStatus({
        productId,
        newStatus,
        adminId: currentUser.uid,
        adminEmail: currentUser.email || '',
        moderationNotes: moderationNotes || undefined,
      });
      alert(`Product marked as ${newStatus}`);
      const updated = await adminService.getProductsForReview();
      setProducts(updated);
      setModerationNotes('');
    } catch (err: any) {
      alert(`Error updating product: ${err.message}`);
    }
  };

  // Creator application actions
  const handleApproveCreator = async (app: CreatorApplication) => {
    if (!currentUser) return;
    try {
      await adminService.approveCreatorApplication(app, currentUser.uid, currentUser.email || '');
      alert(`Creator ${app.brandName} approved successfully!`);
      const updated = await adminService.getCreatorApplications();
      setApplications(updated);
    } catch (err: any) {
      alert(`Error approving creator: ${err.message}`);
    }
  };

  const handleRejectCreator = async (appId: string) => {
    if (!currentUser) return;
    const notes = prompt('Enter rejection reasons / guidance for the applicant:');
    if (notes === null) return;
    try {
      await adminService.rejectCreatorApplication(appId, currentUser.uid, currentUser.email || '', notes);
      alert('Creator application rejected.');
      const updated = await adminService.getCreatorApplications();
      setApplications(updated);
    } catch (err: any) {
      alert(`Error rejecting creator: ${err.message}`);
    }
  };

  // Payout actions
  const handleConfirmPayout = async () => {
    if (!currentUser || !selectedPayout || !payoutRef.trim()) {
      alert('Please enter an external bank / Telebirr transaction reference.');
      return;
    }
    try {
      await adminService.markPayoutPaid({
        payoutId: selectedPayout.id,
        creatorId: selectedPayout.creatorId,
        amountEtb: selectedPayout.amountEtb,
        transactionReference: payoutRef.trim(),
        adminId: currentUser.uid,
        adminEmail: currentUser.email || '',
      });
      alert('Payout recorded as PAID in financial ledger.');
      setSelectedPayout(null);
      setPayoutRef('');
      const updated = await adminService.getPayoutRequests();
      setPayouts(updated);
    } catch (err: any) {
      alert(`Error confirming payout: ${err.message}`);
    }
  };

  // Dynamic Category actions
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameEn) return;
    try {
      await adminService.saveCategory({
        slug: catSlug || catNameEn.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        nameEn: catNameEn,
        nameAm: catNameAm || catNameEn,
        descriptionEn: catDescEn,
        descriptionAm: catDescAm,
        sortOrder: parseInt(catSortOrder) || 1,
        isActive: true,
      });
      alert('Category saved to Firestore successfully.');
      setCategoryModalOpen(false);
      setCatNameEn('');
      setCatNameAm('');
      setCatSlug('');
      setCatDescEn('');
      setCatDescAm('');
      const updated = await adminService.getAllCategories();
      setCategories(updated);
    } catch (err: any) {
      alert(`Error saving category: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await adminService.deleteCategory(catId);
      const updated = await adminService.getAllCategories();
      setCategories(updated);
    } catch (err: any) {
      alert(`Error deleting category: ${err.message}`);
    }
  };

  // Settings update
  const handleUpdateCommission = async (newRateStr: string) => {
    if (!currentUser || !settings) return;
    const rate = parseFloat(newRateStr);
    if (isNaN(rate) || rate < 0 || rate > 0.5) {
      alert('Please enter a valid rate between 0 and 0.5 (e.g. 0.12 for 12%)');
      return;
    }
    try {
      await adminService.updateSettings({ commissionRate: rate }, currentUser.uid, currentUser.email || '');
      setSettings({ ...settings, commissionRate: rate });
      alert(`Marketplace commission updated to ${(rate * 100).toFixed(1)}%`);
    } catch (err: any) {
      alert(`Error updating settings: ${err.message}`);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" className="py-32" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-rose-600" />
            <span>{t('admin.panelTitle')}</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Strict server-authorized administration & financial ledger management.
          </p>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
            activeTab === 'products'
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>{t('admin.navProducts')}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px]">
            {products.filter((p) => p.status === 'PENDING_REVIEW').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('creators')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
            activeTab === 'creators'
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t('admin.navCreators')}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px]">
            {applications.filter((a) => a.status === 'pending').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('categories')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
            activeTab === 'categories'
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <FolderTree className="w-4 h-4" />
          <span>{t('admin.navCategories')}</span>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
            activeTab === 'orders'
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>{t('admin.navOrders')}</span>
        </button>

        <button
          onClick={() => setActiveTab('payouts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
            activeTab === 'payouts'
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>{t('admin.navPayouts')}</span>
          <span className="px-1.5 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px]">
            {payouts.filter((p) => p.status === 'REQUESTED').length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
            activeTab === 'reports'
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>{t('admin.navReports')}</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
            activeTab === 'settings'
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>{t('admin.navSettings')}</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
            activeTab === 'audit'
              ? 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>{t('admin.navAudit')}</span>
        </button>
      </div>

      {/* Tab 1: Product Moderation */}
      {activeTab === 'products' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Digital Products Moderation Queue
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Product</th>
                  <th className="py-3 px-4">Creator</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Current Status</th>
                  <th className="py-3 px-4 rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {products.map((prod) => (
                  <tr key={prod.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-4 flex items-center gap-3">
                      <img
                        src={prod.coverImageUrl || '/placeholder.png'}
                        alt={prod.titleEn}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {prod.titleEn}
                        </span>
                        <span className="text-xs text-slate-400 capitalize">
                          {prod.productType} &middot; {prod.categorySlug}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4">{prod.creatorName}</td>
                    <td className="py-4 px-4 font-bold">{prod.priceEtb.toLocaleString()} ETB</td>
                    <td className="py-4 px-4">
                      <Badge variant={prod.status === 'APPROVED' ? 'brand' : prod.status === 'PENDING_REVIEW' ? 'amber' : 'rose'}>
                        {prod.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        {prod.status !== 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleProductStatus(prod.id, 'APPROVED')}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            <span>Approve</span>
                          </Button>
                        )}
                        {prod.status !== 'REJECTED' && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              const notes = prompt('Enter moderation feedback for creator:');
                              if (notes !== null) {
                                setModerationNotes(notes);
                                handleProductStatus(prod.id, 'REJECTED');
                              }
                            }}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1" />
                            <span>Reject</span>
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Creator Applications */}
      {activeTab === 'creators' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Creator Onboarding Applications
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Brand / Creator</th>
                  <th className="py-3 px-4">Payout Method</th>
                  <th className="py-3 px-4">Account Number</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-4">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {app.brandName}
                      </span>
                      <span className="text-xs text-slate-400">{app.userEmail}</span>
                    </td>
                    <td className="py-4 px-4 uppercase font-semibold">{app.payoutMethod}</td>
                    <td className="py-4 px-4 font-mono">{app.payoutAccountNumber}</td>
                    <td className="py-4 px-4">
                      <Badge variant={app.status === 'approved' ? 'brand' : app.status === 'pending' ? 'amber' : 'rose'}>
                        {app.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      {app.status === 'pending' && (
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="primary" onClick={() => handleApproveCreator(app)}>
                            Approve
                          </Button>
                          <Button size="sm" variant="danger" onClick={() => handleRejectCreator(app.id)}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Dynamic Categories */}
      {activeTab === 'categories' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Dynamic Categories (Managed in Firestore)
            </h2>
            <Button onClick={() => setCategoryModalOpen(true)} variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              <span>Add Category</span>
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                      slug: {cat.slug}
                    </span>
                    <button
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-slate-400 hover:text-rose-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    {cat.nameEn}
                  </h3>
                  <h4 className="text-xs font-semibold text-slate-500 font-ethiopic mt-0.5">
                    {cat.nameAm}
                  </h4>
                  <p className="mt-2 text-xs text-slate-500 line-clamp-2">
                    {cat.descriptionEn}
                  </p>
                </div>
                <div className="mt-4 pt-2 border-t border-slate-200 dark:border-slate-700 flex justify-between text-xs text-slate-400">
                  <span>Order: {cat.sortOrder}</span>
                  <span className="text-emerald-600 font-bold">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 4: Orders & Transactions */}
      {activeTab === 'orders' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Orders & Payment Verification Records
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Transaction Ref</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Commission (12%)</th>
                  <th className="py-3 px-4 rounded-r-xl">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {orders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-4 font-mono text-xs">{ord.txRef}</td>
                    <td className="py-4 px-4 font-bold text-slate-900 dark:text-white">
                      {ord.productTitle}
                    </td>
                    <td className="py-4 px-4 font-bold text-emerald-700">
                      {ord.amountEtb.toLocaleString()} ETB
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={ord.status === 'PAID' ? 'brand' : ord.status === 'PENDING_PAYMENT' ? 'amber' : 'rose'}>
                        {ord.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 font-medium">
                      {(ord.commissionAmountEtb || 0).toLocaleString()} ETB
                    </td>
                    <td className="py-4 px-4 text-xs text-slate-400">
                      {new Date(ord.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Manual Creator Payouts */}
      {activeTab === 'payouts' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Manual Creator Payout Requests (Telebirr & CBE)
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="py-3 px-4 rounded-l-xl">Creator</th>
                  <th className="py-3 px-4">Amount Requested</th>
                  <th className="py-3 px-4">Payout Account</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {payouts.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-4">
                      <span className="font-bold text-slate-900 dark:text-white block">
                        {p.creatorName}
                      </span>
                      <span className="text-xs text-slate-400">{p.creatorEmail}</span>
                    </td>
                    <td className="py-4 px-4 font-extrabold text-base text-slate-900 dark:text-white">
                      {p.amountEtb.toLocaleString()} ETB
                    </td>
                    <td className="py-4 px-4 text-xs font-mono">
                      <span className="uppercase font-bold block">{p.payoutMethod}</span>
                      <span>{p.payoutAccountNumber} ({p.payoutAccountName})</span>
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={p.status === 'PAID' ? 'brand' : p.status === 'REQUESTED' ? 'amber' : 'rose'}>
                        {p.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4">
                      {p.status === 'REQUESTED' && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setSelectedPayout(p)}
                        >
                          Record Payment Sent
                        </Button>
                      )}
                      {p.status === 'PAID' && (
                        <span className="text-xs font-mono text-emerald-600">
                          Ref: {p.transactionReference}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Reports */}
      {activeTab === 'reports' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Marketplace Policy & Infringement Reports
          </h2>

          <div className="space-y-4">
            {reports.length === 0 ? (
              <p className="text-sm text-slate-400 py-4">No policy reports filed.</p>
            ) : (
              reports.map((rep) => (
                <div
                  key={rep.id}
                  className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
                      Reason: {rep.reason}
                    </span>
                    <Badge variant={rep.status.startsWith('RESOLVED') ? 'brand' : 'amber'}>
                      {rep.status}
                    </Badge>
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                    Target: {rep.productTitle}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    "{rep.description}"
                  </p>
                  <div className="pt-2 flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => adminService.resolveReport(rep.id, 'dismissed')}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => adminService.resolveReport(rep.id, 'product_suspended')}
                    >
                      Suspend Product
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 7: Settings */}
      {activeTab === 'settings' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6 max-w-2xl">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Marketplace Configuration & Commission
          </h2>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {t('admin.commissionRateLabel')} (Default: 12%)
              </label>
              <div className="flex gap-3">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="0.5"
                  defaultValue={settings?.commissionRate || 0.12}
                  id="commissionInput"
                  className="flex-1 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 font-bold"
                />
                <Button
                  variant="primary"
                  onClick={() => {
                    const input = document.getElementById('commissionInput') as HTMLInputElement;
                    handleUpdateCommission(input.value);
                  }}
                >
                  Save Rate
                </Button>
              </div>
              <p className="text-xs text-slate-400">
                Applied atomically on backend verification of completed orders. Current creators receive 88%.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 8: Audit Logs */}
      {activeTab === 'audit' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Immutable Administrator Audit Logs
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-bold text-slate-500">
                <tr>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Admin Email</th>
                  <th className="py-3 px-4">Collection / Target</th>
                  <th className="py-3 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 px-4 font-bold text-rose-700">{log.action}</td>
                    <td className="py-3 px-4">{log.adminEmail}</td>
                    <td className="py-3 px-4">{log.targetCollection} / {log.targetDocId}</td>
                    <td className="py-3 px-4">{new Date(log.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirm Payout Modal */}
      {selectedPayout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-600" />
              <span>Confirm Manual Transfer</span>
            </h3>

            <p className="text-xs text-slate-500">
              Transfer <strong>{selectedPayout.amountEtb.toLocaleString()} ETB</strong> via{' '}
              <strong className="uppercase">{selectedPayout.payoutMethod}</strong> to account{' '}
              <strong>{selectedPayout.payoutAccountNumber}</strong> ({selectedPayout.payoutAccountName}).
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                {t('admin.transferReference')} *
              </label>
              <input
                type="text"
                required
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                placeholder="e.g. CBE-TX-9988123 or TELEBIRR-REF-4455"
                className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-mono"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setSelectedPayout(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="primary" onClick={handleConfirmPayout}>
                {t('admin.markPaid')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Add New Dynamic Category
            </h3>

            <form onSubmit={handleSaveCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Name (English) *
                </label>
                <input
                  type="text"
                  required
                  value={catNameEn}
                  onChange={(e) => setCatNameEn(e.target.value)}
                  placeholder="e.g. 3D Printing & Fabrication"
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Name (Amharic) *
                </label>
                <input
                  type="text"
                  required
                  value={catNameAm}
                  onChange={(e) => setCatNameAm(e.target.value)}
                  placeholder="ለምሳሌ፡ 3D ህትመት እና ሞዴሊንግ"
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Slug (Optional)
                </label>
                <input
                  type="text"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  placeholder="3d-printing"
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Sort Order
                </label>
                <input
                  type="number"
                  min="1"
                  value={catSortOrder}
                  onChange={(e) => setCatSortOrder(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={catDescEn}
                  onChange={(e) => setCatDescEn(e.target.value)}
                  className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setCategoryModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary">
                  Save to Firestore
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
