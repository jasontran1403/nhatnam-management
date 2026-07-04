// src/pages/accountant/AccountantVendorDebtPage.jsx
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import VendorDebtShared from '../shared/VendorDebtShared.jsx';

export default function AccountantVendorDebtPage() {
  const { pathname } = useLocation();
  const { role } = useAuth();
  const isSuperAccountant = pathname.startsWith('/super-accountant');
  const basePath = isSuperAccountant ? '/super-accountant/vendor-debts' : '/accountant/vendor-debts';
  const paymentHistoryPath = isSuperAccountant ? '/super-accountant/expenses' : '/accountant/expenses';

  return (
    <VendorDebtShared
      basePath={basePath}
      canCreateExpense
      canManageVendors={role === 'SUPER_ACCOUNTANT'}
      paymentHistoryPath={paymentHistoryPath}
    />
  );
}
