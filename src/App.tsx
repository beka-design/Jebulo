import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HomePage } from './pages/HomePage';
import { ExplorePage } from './pages/ExplorePage';
import { ProductDetailPage } from './pages/ProductDetailPage';
import { CheckoutPage } from './pages/CheckoutPage';
import { CheckoutSimulatorPage } from './pages/CheckoutSimulatorPage';
import { CheckoutCallbackPage } from './pages/CheckoutCallbackPage';
import { LibraryPage } from './pages/LibraryPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { BecomeSellerPage } from './pages/BecomeSellerPage';
import { CreatorDashboardPage } from './pages/CreatorDashboardPage';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { PolicyPage } from './pages/PolicyPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans transition-colors">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/products/:productId" element={<ProductDetailPage />} />
            <Route path="/checkout/:productId" element={<CheckoutPage />} />
            {import.meta.env.DEV || import.meta.env.VITE_ENABLE_SIMULATOR === 'true' ? (
              <Route path="/checkout/simulator" element={<CheckoutSimulatorPage />} />
            ) : null}
            <Route path="/checkout/callback" element={<CheckoutCallbackPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/become-seller" element={<BecomeSellerPage />} />
            <Route path="/creator" element={<CreatorDashboardPage />} />
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/signup" element={<SignUpPage />} />
            <Route path="/policies/:policyType" element={<PolicyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
};
